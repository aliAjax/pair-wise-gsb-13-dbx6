<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import { isExpired, remainingOf, shiftQty } from "./domain/rules";
import { useShiftStore } from "./store/shiftStore";
import BatchRegisterForm from "./components/BatchRegisterForm.vue";
import BatchBoard from "./components/BatchBoard.vue";
import HandoverPanel from "./components/HandoverPanel.vue";
import ShiftHistory from "./components/ShiftHistory.vue";

const store = useShiftStore();

const now = ref(new Date());
const timer = setInterval(() => {
  now.value = new Date();
}, 30_000);
onUnmounted(() => clearInterval(timer));

const metricLabels = ["在架结余（件）", "过期待处理（批）", "本班售卖", "本班报损"];

const metrics = computed(() => {
  const shift = store.currentShift;
  const remainingTotal = store.batches.reduce(
    (sum, batch) => sum + Math.max(0, remainingOf(batch, store.deductions)),
    0
  );
  const expiredPending = store.batches.filter(
    (batch) => remainingOf(batch, store.deductions) > 0 && isExpired(batch, now.value)
  ).length;
  const sold = shift ? shiftQty(store.deductions, shift.id, "sale") : 0;
  const spoiled = shift ? shiftQty(store.deductions, shift.id, "spoilage") : 0;
  return [remainingTotal, expiredPending, sold, spoiled];
});

function resetDemo() {
  if (window.confirm("将清空本机数据并恢复演示班次，确定继续？")) {
    store.resetDemo();
    window.location.reload();
  }
}
</script>

<template>
  <main class="app">
    <div class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">石油行业 · 加油站便利店</p>
          <h1>商品批次交接台</h1>
          <p class="subtitle">
            临期便当、关东煮按批次登记与扣减：记录品类、初始数量、到货温度和到期时刻，
            售卖报损逐批核销，结余随班次移交；陈列温度超出 2–8℃、已过期待处理或扣减超结余时无法交班。
          </p>
        </div>
        <div class="stack">
          <span class="tag">Vue3</span>
          <span class="tag">TypeScript</span>
          <span class="tag">Pinia</span>
          <span class="tag">localStorage</span>
          <button type="button" class="secondary" @click="resetDemo">重置演示数据</button>
        </div>
      </header>

      <section class="metrics">
        <article v-for="(label, index) in metricLabels" :key="label" class="metric">
          <span>{{ label }}</span>
          <strong>{{ metrics[index] }}</strong>
        </article>
      </section>

      <section class="workspace">
        <BatchRegisterForm />
        <BatchBoard />
      </section>

      <HandoverPanel />
      <ShiftHistory />
    </div>
  </main>
</template>
