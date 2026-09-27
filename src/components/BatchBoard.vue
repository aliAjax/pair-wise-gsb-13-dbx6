<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from "vue";
import { productOf } from "../data/catalog";
import { batchFlags, batchQty, isExpired, isTempOutOfRange, remainingOf } from "../domain/rules";
import { useShiftStore } from "../store/shiftStore";
import { fmtTime } from "../utils/format";

const store = useShiftStore();

const now = ref(new Date());
const timer = setInterval(() => {
  now.value = new Date();
}, 30_000);
onUnmounted(() => clearInterval(timer));

const qtyInputs = reactive<Record<string, number>>({});
const errors = reactive<Record<string, string>>({});

const rows = computed(() => {
  const shiftId = store.currentShift?.id;
  return store.batches
    .map((batch) => {
      const remaining = remainingOf(batch, store.deductions);
      return {
        batch,
        remaining,
        flags: batchFlags(batch, store.deductions, now.value),
        expiredPending: remaining > 0 && isExpired(batch, now.value),
        soldHere: shiftId ? batchQty(batch.id, store.deductions, "sale", shiftId) : 0,
        spoiledHere: shiftId ? batchQty(batch.id, store.deductions, "spoilage", shiftId) : 0,
        fromCurrentShift: batch.shiftId === shiftId
      };
    })
    .filter((row) => row.remaining > 0 || row.fromCurrentShift)
    .sort((a, b) => a.batch.expiresAt.localeCompare(b.batch.expiresAt));
});

function act(batchId: string, kind: "sale" | "spoilage") {
  const qty = qtyInputs[batchId] ?? 1;
  const result = store.deduct(batchId, kind, qty);
  errors[batchId] = result.ok ? "" : result.reason;
  if (result.ok) qtyInputs[batchId] = 1;
}

function dispose(batchId: string) {
  const result = store.disposeBatch(batchId);
  errors[batchId] = result.ok ? "" : result.reason;
}
</script>

<template>
  <section class="list-panel">
    <div class="toolbar">
      <h2>在架批次台</h2>
      <span class="toolbar-note">售卖 / 报损按批次扣减，结余随班次移交</span>
    </div>

    <div v-if="rows.length === 0" class="empty">当前没有在架批次，请先登记</div>

    <div v-else class="table-wrap">
      <table class="batch-table">
        <thead>
          <tr>
            <th>批次</th>
            <th>品类</th>
            <th>结余</th>
            <th>到货温度</th>
            <th>到期时刻</th>
            <th>状态</th>
            <th>本班扣减</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.batch.id" :class="{ 'row-expired': row.expiredPending }">
            <td>
              <strong>{{ row.batch.code }}</strong>
              <span class="sub">{{ row.fromCurrentShift ? "本班登记" : "上一班移交" }}</span>
            </td>
            <td>{{ productOf(row.batch.productId).name }}</td>
            <td>
              <strong>{{ row.remaining }}</strong>
              <span class="sub">/ {{ row.batch.initialQty }} {{ productOf(row.batch.productId).unit }}</span>
            </td>
            <td :class="{ 'text-warn': isTempOutOfRange(row.batch.arrivalTemp) }">
              {{ row.batch.arrivalTemp }}℃
            </td>
            <td :class="{ 'text-danger': row.expiredPending }">{{ fmtTime(row.batch.expiresAt) }}</td>
            <td>
              <span v-for="flag in row.flags" :key="flag.kind" class="badge" :class="`badge-${flag.kind}`">
                {{ flag.text }}
              </span>
              <span v-if="row.flags.length === 0" class="badge badge-ok">正常</span>
            </td>
            <td>售 {{ row.soldHere }} · 损 {{ row.spoiledHere }}</td>
            <td>
              <div class="deduct">
                <input
                  v-model.number="qtyInputs[row.batch.id]"
                  type="number"
                  min="1"
                  :max="row.remaining"
                  placeholder="1"
                  :disabled="row.remaining === 0"
                />
                <button type="button" :disabled="row.remaining === 0" @click="act(row.batch.id, 'sale')">售卖</button>
                <button type="button" class="secondary" :disabled="row.remaining === 0" @click="act(row.batch.id, 'spoilage')">报损</button>
                <button v-if="row.expiredPending" type="button" class="danger" @click="dispose(row.batch.id)">
                  过期报废
                </button>
              </div>
              <p v-if="errors[row.batch.id]" class="row-error">{{ errors[row.batch.id] }}</p>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
