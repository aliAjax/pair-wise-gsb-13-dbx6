<script setup lang="ts">
import { computed, ref } from "vue";
import { productOf } from "../data/catalog";
import { remainingOf } from "../domain/rules";
import { useShiftStore } from "../store/shiftStore";
import { fmtTime } from "../utils/format";

const store = useShiftStore();

const selectedId = ref<string>(store.currentShift?.id ?? "");

const orderedShifts = computed(() => [...store.shifts].sort((a, b) => b.seq - a.seq));

const selected = computed(
  () => store.shifts.find((shift) => shift.id === selectedId.value) ?? store.currentShift ?? null
);

const handoverOf = computed(() =>
  selected.value ? store.handovers.find((h) => h.shiftId === selected.value!.id) ?? null : null
);

const prevHandover = computed(() => {
  const shift = selected.value;
  if (!shift) return null;
  const prev = store.shifts.find((s) => s.seq === shift.seq - 1);
  return prev ? store.handovers.find((h) => h.shiftId === prev.id) ?? null : null;
});

const receivedLines = computed(
  () => prevHandover.value?.lines.filter((line) => line.carried > 0) ?? []
);

const registeredHere = computed(() =>
  selected.value ? store.batches.filter((batch) => batch.shiftId === selected.value!.id) : []
);

const deductionsHere = computed(() => {
  const shift = selected.value;
  if (!shift) return [];
  return store.deductions
    .filter((d) => d.shiftId === shift.id)
    .map((d) => ({ ...d, batch: store.batches.find((b) => b.id === d.batchId) }))
    .sort((a, b) => b.at.localeCompare(a.at));
});

const carriedLines = computed(
  () => handoverOf.value?.lines.filter((line) => line.carried > 0) ?? []
);

const liveRemaining = computed(() => {
  const shift = selected.value;
  if (!shift || shift.closedAt) return [];
  return store.batches
    .map((batch) => ({ batch, remaining: remainingOf(batch, store.deductions) }))
    .filter((line) => line.remaining > 0);
});
</script>

<template>
  <section class="list-panel">
    <div class="toolbar">
      <h2>班次查询</h2>
      <select v-model="selectedId" class="shift-select">
        <option v-for="shift in orderedShifts" :key="shift.id" :value="shift.id">
          #{{ shift.seq }} {{ shift.name }} · {{ fmtTime(shift.openedAt) }}{{ shift.closedAt ? "" : "（当前）" }}
        </option>
      </select>
    </div>

    <template v-if="selected">
      <div class="shift-info">
        <span>开始：{{ fmtTime(selected.openedAt) }}</span>
        <span>结束：{{ selected.closedAt ? fmtTime(selected.closedAt) : "进行中" }}</span>
        <span>陈列温度：{{ selected.displayTemp === null ? "—" : `${selected.displayTemp}℃` }}</span>
      </div>

      <div class="history-grid">
        <div class="history-block">
          <h3>接收结余（自上一班）</h3>
          <ul class="line-list">
            <li v-for="line in receivedLines" :key="line.batchId">
              <span>{{ line.code }} · {{ productOf(line.productId).name }}</span>
              <strong>{{ line.carried }} {{ productOf(line.productId).unit }}</strong>
            </li>
            <li v-if="receivedLines.length === 0" class="muted">无接收结余</li>
          </ul>
        </div>

        <div class="history-block">
          <h3>本班登记批次（{{ registeredHere.length }}）</h3>
          <ul class="line-list">
            <li v-for="batch in registeredHere" :key="batch.id">
              <span>{{ batch.code }} · {{ productOf(batch.productId).name }} · 到货 {{ batch.arrivalTemp }}℃</span>
              <strong>{{ batch.initialQty }} {{ productOf(batch.productId).unit }}</strong>
            </li>
            <li v-if="registeredHere.length === 0" class="muted">本班未登记批次</li>
          </ul>
        </div>

        <div class="history-block wide">
          <h3>售卖与报损明细（{{ deductionsHere.length }}）</h3>
          <div v-if="deductionsHere.length === 0" class="muted">本班无扣减记录</div>
          <div v-else class="table-wrap">
            <table class="batch-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>批次</th>
                  <th>品类</th>
                  <th>类型</th>
                  <th>数量</th>
                  <th>备注</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in deductionsHere" :key="item.id">
                  <td>{{ fmtTime(item.at) }}</td>
                  <td>{{ item.batch?.code ?? "—" }}</td>
                  <td>{{ item.batch ? productOf(item.batch.productId).name : "—" }}</td>
                  <td>
                    <span class="badge" :class="item.kind === 'sale' ? 'badge-sale' : 'badge-spoilage'">
                      {{ item.kind === "sale" ? "售卖" : "报损" }}
                    </span>
                  </td>
                  <td>{{ item.qty }}</td>
                  <td>{{ item.note || "—" }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="history-block">
          <h3 v-if="selected.closedAt">移交结余（至下一班）</h3>
          <h3 v-else>当前剩余</h3>
          <template v-if="selected.closedAt">
            <ul class="line-list">
              <li v-for="line in carriedLines" :key="line.batchId">
                <span>{{ line.code }} · {{ productOf(line.productId).name }}</span>
                <strong>{{ line.carried }} {{ productOf(line.productId).unit }}</strong>
              </li>
              <li v-if="carriedLines.length === 0" class="muted">无移交结余</li>
            </ul>
            <p v-if="handoverOf" class="muted">合计移交 {{ handoverOf.totalCarried }} 件</p>
          </template>
          <ul v-else class="line-list">
            <li v-for="line in liveRemaining" :key="line.batch.id">
              <span>{{ line.batch.code }} · {{ productOf(line.batch.productId).name }}</span>
              <strong>{{ line.remaining }} {{ productOf(line.batch.productId).unit }}</strong>
            </li>
            <li v-if="liveRemaining.length === 0" class="muted">当前无剩余</li>
          </ul>
        </div>
      </div>
    </template>
  </section>
</template>
