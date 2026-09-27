<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watchEffect } from "vue";
import { CATALOG, catalogItem, unitOf } from "./data/catalog";
import {
  TEMP_MAX,
  TEMP_MIN,
  batchLabel,
  batchStatus,
  checkDeduction,
  currentShift,
  handoverBlockers,
  isTempOutOfRange,
  movedQty,
  nextShiftName,
  remainingOf,
  type Batch,
  type HandoverState,
  type Movement,
  type MovementKind,
} from "./domain/batch";
import { loadState, saveState } from "./store/persistence";

const state = ref<HandoverState>(loadState());
const now = ref(Date.now());
const timer = window.setInterval(() => {
  now.value = Date.now();
}, 30_000);
onBeforeUnmount(() => window.clearInterval(timer));

const shift = computed(() => currentShift(state.value));

function persist() {
  saveState(state.value);
}

const pad = (n: number) => String(n).padStart(2, "0");

function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------- 登记批次 ----------
const batchForm = reactive({
  category: CATALOG[0].category,
  initialQty: 6,
  arrivalTemp: 5,
  expiryAt: "",
});

function refreshExpiry() {
  const hours = catalogItem(batchForm.category)?.shelfLifeHours ?? 8;
  batchForm.expiryAt = toLocalInput(new Date(Date.now() + hours * 3600_000));
}
refreshExpiry();

const batchError = ref("");

function registerBatch() {
  batchError.value = "";
  const qty = Number(batchForm.initialQty);
  const temp = Number(batchForm.arrivalTemp);
  const expiry = new Date(batchForm.expiryAt);
  if (!Number.isInteger(qty) || qty <= 0) {
    batchError.value = "初始数量必须为正整数";
    return;
  }
  if (!Number.isFinite(temp)) {
    batchError.value = "请填写到货温度";
    return;
  }
  if (!batchForm.expiryAt || Number.isNaN(expiry.getTime())) {
    batchError.value = "请填写到期时刻";
    return;
  }
  const batch: Batch = {
    id: crypto.randomUUID(),
    category: batchForm.category,
    initialQty: qty,
    arrivalTemp: temp,
    expiryAt: expiry.toISOString(),
    shiftId: shift.value.id,
    createdAt: new Date().toISOString(),
  };
  state.value = { ...state.value, batches: [batch, ...state.value.batches] };
  persist();
  batchForm.initialQty = 6;
  batchForm.arrivalTemp = 5;
  refreshExpiry();
}

// ---------- 售卖 / 报损扣减 ----------
const deductForm = reactive({ batchId: "", kind: "sale" as MovementKind, qty: 1 });
const deductError = ref("");

const activeBatches = computed(() =>
  state.value.batches.filter((batch) => remainingOf(batch, state.value.movements) > 0)
);

watchEffect(() => {
  if (!activeBatches.value.some((batch) => batch.id === deductForm.batchId)) {
    deductForm.batchId = activeBatches.value[0]?.id ?? "";
  }
});

function deduct() {
  deductError.value = "";
  const batch = state.value.batches.find((item) => item.id === deductForm.batchId);
  if (!batch) {
    deductError.value = "请选择批次";
    return;
  }
  const qty = Number(deductForm.qty);
  const error = checkDeduction(batch, state.value.movements, qty);
  if (error) {
    deductError.value = error;
    return;
  }
  const movement: Movement = {
    id: crypto.randomUUID(),
    batchId: batch.id,
    kind: deductForm.kind,
    qty,
    shiftId: shift.value.id,
    at: new Date().toISOString(),
  };
  state.value = { ...state.value, movements: [...state.value.movements, movement] };
  persist();
  deductForm.qty = 1;
}

// ---------- 交班 ----------
const displayTemp = ref<number | string>("");
const handoverNote = ref("");

const blockers = computed(() =>
  handoverBlockers(
    state.value,
    typeof displayTemp.value === "number" ? displayTemp.value : Number.NaN,
    now.value
  )
);

function handover() {
  if (blockers.value.length > 0) return;
  const at = new Date();
  const shifts = state.value.shifts.map((item, index) =>
    index === state.value.shifts.length - 1
      ? { ...item, closedAt: at.toISOString(), displayTemp: Number(displayTemp.value) }
      : item
  );
  const next = {
    id: crypto.randomUUID(),
    name: nextShiftName(shifts.length, at),
    openedAt: at.toISOString(),
    closedAt: null,
    displayTemp: null,
  };
  const carried = activeBatches.value.length;
  state.value = { ...state.value, shifts: [...shifts, next] };
  persist();
  handoverNote.value = `已交班：结余 ${carried} 个批次随班移交 ${next.name}`;
  displayTemp.value = "";
}

// ---------- 批次台账 ----------
const STATUS_PRIORITY: Record<string, number> = { 已过期: 0, 临期: 1, 正常: 2, 已清空: 3 };

const rows = computed(() =>
  state.value.batches
    .map((batch) => {
      const movements = state.value.movements;
      return {
        batch,
        remaining: remainingOf(batch, movements),
        sold: movedQty(batch.id, movements, "sale"),
        wasted: movedQty(batch.id, movements, "waste"),
        status: batchStatus(batch, movements, now.value),
        tempOut: isTempOutOfRange(batch.arrivalTemp),
        unit: unitOf(batch.category),
      };
    })
    .sort(
      (a, b) =>
        (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9) ||
        new Date(a.batch.expiryAt).getTime() - new Date(b.batch.expiryAt).getTime()
    )
);

const metricLabels = ["在架批次", "剩余总量", "过期待处理", "本班报损"];

const metrics = computed(() => {
  const active = rows.value.filter((row) => row.remaining > 0);
  const totalRemaining = active.reduce((sum, row) => sum + row.remaining, 0);
  const expiredPending = active.filter((row) => row.status === "已过期").length;
  const shiftWaste = state.value.movements
    .filter((movement) => movement.shiftId === shift.value.id && movement.kind === "waste")
    .reduce((sum, movement) => sum + movement.qty, 0);
  return [active.length, totalRemaining, expiredPending, shiftWaste];
});

// ---------- 班次查询 ----------
const historyShiftId = ref("");
watchEffect(() => {
  if (!state.value.shifts.some((item) => item.id === historyShiftId.value)) {
    historyShiftId.value = shift.value.id;
  }
});

const historyShift = computed(
  () => state.value.shifts.find((item) => item.id === historyShiftId.value) ?? shift.value
);

const historyEnd = computed(() =>
  historyShift.value.closedAt ? new Date(historyShift.value.closedAt).getTime() : now.value
);

const historySnapshot = computed(() =>
  state.value.batches
    .filter((batch) => new Date(batch.createdAt).getTime() <= historyEnd.value)
    .map((batch) => {
      const used = state.value.movements
        .filter((movement) => movement.batchId === batch.id && new Date(movement.at).getTime() <= historyEnd.value)
        .reduce((sum, movement) => sum + movement.qty, 0);
      return { batch, remaining: batch.initialQty - used, unit: unitOf(batch.category) };
    })
    .filter((row) => row.remaining > 0)
);

const historyMovements = computed(() =>
  state.value.movements
    .filter((movement) => movement.shiftId === historyShift.value.id)
    .map((movement) => ({
      movement,
      batch: state.value.batches.find((batch) => batch.id === movement.batchId),
    }))
    .sort((a, b) => new Date(b.movement.at).getTime() - new Date(a.movement.at).getTime())
);

function statusClass(status: string): string {
  if (status === "正常") return "ok";
  if (status === "临期") return "warn";
  if (status === "已过期") return "bad";
  return "mute";
}
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">加油站便利店 · 鲜食批次管理</p>
          <h1>商品批次交接台</h1>
          <p class="subtitle">
            登记品类、初始数量、到货温度与到期时刻；售卖与报损按批次扣减，结余随班次移交。
            陈列温度需在 {{ TEMP_MIN }}~{{ TEMP_MAX }}℃、无过期待处理且扣减不超结余方可交班。
          </p>
        </div>
        <div class="stack">
          <span class="tag">Vue3</span>
          <span class="tag">TypeScript</span>
          <span class="tag">localStorage</span>
        </div>
      </header>

      <section class="metrics">
        <article v-for="(label, index) in metricLabels" :key="label" class="metric">
          <span>{{ label }}</span>
          <strong>{{ metrics[index] }}</strong>
        </article>
      </section>

      <section class="workspace">
        <div class="side">
          <form class="panel" @submit.prevent="registerBatch">
            <h2>登记批次</h2>
            <div class="form-grid">
              <label>
                品类
                <select v-model="batchForm.category" @change="refreshExpiry">
                  <option v-for="item in CATALOG" :key="item.category" :value="item.category">
                    {{ item.category }}（保质约 {{ item.shelfLifeHours }} 小时）
                  </option>
                </select>
              </label>
              <label>
                初始数量（{{ unitOf(batchForm.category) }}）
                <input v-model.number="batchForm.initialQty" type="number" min="1" step="1" required />
              </label>
              <label>
                到货温度（℃）
                <input v-model.number="batchForm.arrivalTemp" type="number" step="0.1" required />
              </label>
              <label>
                到期时刻
                <input v-model="batchForm.expiryAt" type="datetime-local" required />
              </label>
              <p v-if="batchError" class="error-text">{{ batchError }}</p>
              <button type="submit">登记入库</button>
            </div>
          </form>

          <form class="panel" @submit.prevent="deduct">
            <h2>售卖 / 报损扣减</h2>
            <div class="form-grid">
              <label>
                批次
                <select v-model="deductForm.batchId">
                  <option v-for="batch in activeBatches" :key="batch.id" :value="batch.id">
                    {{ batchLabel(batch) }} · 剩余 {{ remainingOf(batch, state.movements) }}
                  </option>
                </select>
              </label>
              <label>
                类型
                <select v-model="deductForm.kind">
                  <option value="sale">售卖</option>
                  <option value="waste">报损</option>
                </select>
              </label>
              <label>
                数量
                <input v-model.number="deductForm.qty" type="number" min="1" step="1" required />
              </label>
              <p v-if="deductError" class="error-text">{{ deductError }}</p>
              <button type="submit" :disabled="activeBatches.length === 0">按批次扣减</button>
            </div>
          </form>

          <section class="panel">
            <h2>交班</h2>
            <div class="form-grid">
              <p class="shift-line">
                当前班次：<strong>{{ shift.name }}</strong>（{{ fmtTime(shift.openedAt) }} 开班）
              </p>
              <label>
                陈列温度（℃，{{ TEMP_MIN }}~{{ TEMP_MAX }}）
                <input v-model="displayTemp" type="number" step="0.1" placeholder="交班前实测" />
              </label>
              <ul v-if="blockers.length" class="blockers">
                <li v-for="item in blockers" :key="item">{{ item }}</li>
              </ul>
              <p v-else class="success-text">检查通过，可以交班。</p>
              <button type="button" :disabled="blockers.length > 0" @click="handover">
                交班并移交结余
              </button>
              <p v-if="handoverNote" class="success-text">{{ handoverNote }}</p>
            </div>
          </section>
        </div>

        <section class="list-panel">
          <div class="toolbar">
            <h2>批次台账</h2>
            <span class="tag">超温：到货温度超出 {{ TEMP_MIN }}~{{ TEMP_MAX }}℃；超时：已过到期时刻</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>批次</th>
                <th>品类</th>
                <th class="num">剩余/初始</th>
                <th>到货温度</th>
                <th>到期时刻</th>
                <th class="num">累计售/损</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.batch.id">
                <td>{{ batchLabel(row.batch) }}</td>
                <td>{{ row.batch.category }}</td>
                <td class="num">{{ row.remaining }}/{{ row.batch.initialQty }} {{ row.unit }}</td>
                <td>
                  <span :class="{ 'temp-out': row.tempOut }">{{ row.batch.arrivalTemp }}℃</span>
                  <span v-if="row.tempOut" class="badge bad">超温</span>
                </td>
                <td>{{ fmtTime(row.batch.expiryAt) }}</td>
                <td class="num">售 {{ row.sold }} / 损 {{ row.wasted }}</td>
                <td><span class="badge" :class="statusClass(row.status)">{{ row.status }}</span></td>
              </tr>
              <tr v-if="rows.length === 0">
                <td colspan="7" class="empty">暂无批次</td>
              </tr>
            </tbody>
          </table>

          <div class="toolbar section-gap">
            <h2>班次查询</h2>
            <select v-model="historyShiftId" class="shift-select">
              <option v-for="item in [...state.shifts].reverse()" :key="item.id" :value="item.id">
                {{ item.name }}{{ item.closedAt ? "" : "（当前）" }}
              </option>
            </select>
          </div>
          <p class="shift-line">
            {{ fmtTime(historyShift.openedAt) }} 开班 →
            {{ historyShift.closedAt ? fmtTime(historyShift.closedAt) + " 交班" : "进行中" }}；
            陈列温度 {{ historyShift.displayTemp === null ? "未记录" : historyShift.displayTemp + "℃" }}
          </p>

          <h3 class="subhead">期末结余</h3>
          <table>
            <thead>
              <tr>
                <th>批次</th>
                <th>品类</th>
                <th class="num">期末剩余</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in historySnapshot" :key="row.batch.id">
                <td>{{ batchLabel(row.batch) }}</td>
                <td>{{ row.batch.category }}</td>
                <td class="num">{{ row.remaining }} {{ row.unit }}</td>
              </tr>
              <tr v-if="historySnapshot.length === 0">
                <td colspan="3" class="empty">该班次期末无结余</td>
              </tr>
            </tbody>
          </table>

          <h3 class="subhead">本班扣减与处置</h3>
          <table>
            <thead>
              <tr>
                <th>时刻</th>
                <th>批次</th>
                <th>类型</th>
                <th class="num">数量</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in historyMovements" :key="item.movement.id">
                <td>{{ fmtTime(item.movement.at) }}</td>
                <td>{{ item.batch ? batchLabel(item.batch) : "—" }}</td>
                <td>
                  <span class="badge" :class="item.movement.kind === 'waste' ? 'bad' : 'ok'">
                    {{ item.movement.kind === "waste" ? "报损" : "售卖" }}
                  </span>
                </td>
                <td class="num">{{ item.movement.qty }}</td>
              </tr>
              <tr v-if="historyMovements.length === 0">
                <td colspan="4" class="empty">该班次暂无扣减记录</td>
              </tr>
            </tbody>
          </table>
        </section>
      </section>
    </div>
  </main>
</template>
