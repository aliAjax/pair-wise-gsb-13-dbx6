<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import { PRODUCTS, productOf, TEMP_MIN, TEMP_MAX } from "../data/catalog";
import { isTempOutOfRange } from "../domain/rules";
import { useShiftStore } from "../store/shiftStore";
import { toLocalInputValue } from "../utils/format";

const store = useShiftStore();

const form = reactive({
  productId: PRODUCTS[0].id,
  initialQty: 6,
  arrivalTemp: 4,
  expiresAt: ""
});

const message = ref("");

function defaultExpiry(): string {
  const product = productOf(form.productId);
  return toLocalInputValue(new Date(Date.now() + product.shelfLifeHours * 3600_000));
}

form.expiresAt = defaultExpiry();
watch(
  () => form.productId,
  () => {
    form.expiresAt = defaultExpiry();
  }
);

function submit() {
  if (!Number.isFinite(form.initialQty) || form.initialQty <= 0) {
    message.value = "初始数量需大于 0";
    return;
  }
  if (!form.expiresAt) {
    message.value = "请填写到期时刻";
    return;
  }
  const batch = store.registerBatch({ ...form });
  message.value = batch ? `已登记批次 ${batch.code}（${productOf(batch.productId).name}）` : "登记失败，请检查输入";
  if (batch) {
    form.initialQty = 6;
    form.arrivalTemp = 4;
    form.expiresAt = defaultExpiry();
  }
}
</script>

<template>
  <form class="panel" @submit.prevent="submit">
    <h2>登记商品批次</h2>
    <div class="form-grid">
      <label>
        品类
        <select v-model="form.productId" required>
          <option v-for="product in PRODUCTS" :key="product.id" :value="product.id">
            {{ product.name }}（{{ product.unit }}）
          </option>
        </select>
      </label>
      <label>
        初始数量
        <input v-model.number="form.initialQty" type="number" min="1" step="1" required />
      </label>
      <label>
        到货温度（℃）
        <input v-model.number="form.arrivalTemp" type="number" step="0.1" required />
        <span v-if="isTempOutOfRange(form.arrivalTemp)" class="field-warn">
          超出冷链 {{ TEMP_MIN }}–{{ TEMP_MAX }}℃，登记后请优先处置
        </span>
      </label>
      <label>
        到期时刻
        <input v-model="form.expiresAt" type="datetime-local" required />
      </label>
      <button type="submit">登记批次</button>
      <p v-if="message" class="form-message">{{ message }}</p>
    </div>
  </form>
</template>
