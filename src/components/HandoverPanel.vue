<script setup lang="ts">
import { computed, ref } from "vue";
import { productOf, TEMP_MIN, TEMP_MAX } from "../data/catalog";
import { isExpired, remainingOf } from "../domain/rules";
import { useShiftStore } from "../store/shiftStore";
import { fmtTime } from "../utils/format";

const store = useShiftStore();

const displayTemp = ref<number | null>(null);
const doneMessage = ref("");

const blockers = computed(() => store.currentBlockers(displayTemp.value));

const carryLines = computed(() =>
  store.batches
    .map((batch) => ({ batch, remaining: remainingOf(batch, store.deductions) }))
    .filter((line) => line.remaining > 0 && !isExpired(line.batch, new Date()))
);

const carryTotal = computed(() => carryLines.value.reduce((sum, line) => sum + line.remaining, 0));

function submit() {
  if (displayTemp.value === null) return;
  const result = store.handover(Number(displayTemp.value));
  if (result.ok && result.record) {
    const carriedBatches = result.record.lines.filter((line) => line.carried > 0).length;
    const next = store.currentShift;
    doneMessage.value = `${result.record.shiftName} 已交班：${carriedBatches} 个批次共 ${result.record.totalCarried} 件结余${next ? `移交至 ${next.name}` : ""}。`;
    displayTemp.value = null;
  }
}
</script>

<template>
  <section class="panel handover-panel">
    <div class="handover-grid">
      <div class="handover-main">
        <h2>交班校验</h2>
        <p class="hint">
          当前班次：<strong>{{ store.currentShift?.name ?? "—" }}</strong>
          （开始于 {{ fmtTime(store.currentShift?.openedAt) }}）
        </p>
        <label>
          陈列温度（℃）
          <input
            v-model.number="displayTemp"
            type="number"
            step="0.1"
            :placeholder="`冷柜实测温度，需 ${TEMP_MIN}–${TEMP_MAX}℃`"
          />
        </label>

        <ul v-if="blockers.length > 0" class="blocker-list">
          <li v-for="blocker in blockers" :key="blocker.message">{{ blocker.message }}</li>
        </ul>
        <p v-else class="ok-line">校验通过：温度正常、无过期待处理、扣减未超结余，可以交班。</p>

        <button type="button" :disabled="blockers.length > 0" @click="submit">
          确认交班并移交结余
        </button>
        <p v-if="doneMessage" class="done-line">{{ doneMessage }}</p>
      </div>

      <div class="handover-side">
        <h3>预计移交结余（{{ carryTotal }} 件）</h3>
        <ul class="carry-list">
          <li v-for="line in carryLines" :key="line.batch.id">
            <span>{{ line.batch.code }} · {{ productOf(line.batch.productId).name }}</span>
            <strong>{{ line.remaining }} {{ productOf(line.batch.productId).unit }}</strong>
          </li>
          <li v-if="carryLines.length === 0" class="muted">无待移交结余</li>
        </ul>
      </div>
    </div>
  </section>
</template>
