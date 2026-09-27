import { computed, ref } from "vue";
import { defineStore } from "pinia";
import type { Batch, Deduction, DeductionKind, Handover, Shift } from "../types";
import { SHIFT_NAMES } from "../data/catalog";
import {
  batchQty,
  checkDeduction,
  handoverBlockers,
  remainingOf,
  type DeductionCheck,
  type HandoverBlocker
} from "../domain/rules";
import { loadState, saveState, seedState } from "./persistence";

const initial = loadState() ?? seedState();

export const useShiftStore = defineStore("shift", () => {
  const shifts = ref<Shift[]>(initial.shifts);
  const batches = ref<Batch[]>(initial.batches);
  const deductions = ref<Deduction[]>(initial.deductions);
  const handovers = ref<Handover[]>(initial.handovers);

  const currentShift = computed(
    () => shifts.value.find((shift) => shift.closedAt === null) ?? null
  );

  function persist() {
    saveState({
      version: 1,
      shifts: shifts.value,
      batches: batches.value,
      deductions: deductions.value,
      handovers: handovers.value
    });
  }

  function nextCode(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `B-${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(batches.value.length + 1)}`;
  }

  function registerBatch(input: {
    productId: string;
    initialQty: number;
    arrivalTemp: number;
    expiresAt: string;
  }): Batch | null {
    const shift = currentShift.value;
    if (
      !shift ||
      !Number.isFinite(input.initialQty) ||
      input.initialQty <= 0 ||
      !Number.isFinite(input.arrivalTemp) ||
      !input.expiresAt
    ) {
      return null;
    }
    const batch: Batch = {
      id: crypto.randomUUID(),
      code: nextCode(),
      productId: input.productId,
      shiftId: shift.id,
      initialQty: Math.floor(input.initialQty),
      arrivalTemp: input.arrivalTemp,
      expiresAt: new Date(input.expiresAt).toISOString(),
      createdAt: new Date().toISOString()
    };
    batches.value = [...batches.value, batch];
    persist();
    return batch;
  }

  function deduct(
    batchId: string,
    kind: DeductionKind,
    qty: number,
    note = ""
  ): DeductionCheck {
    const batch = batches.value.find((b) => b.id === batchId);
    const shift = currentShift.value;
    if (!batch || !shift) return { ok: false, reason: "批次或当前班次不存在" };
    const check = checkDeduction(batch, deductions.value, qty);
    if (!check.ok) return check;
    deductions.value = [
      ...deductions.value,
      {
        id: crypto.randomUUID(),
        batchId,
        shiftId: shift.id,
        kind,
        qty: Math.floor(qty),
        at: new Date().toISOString(),
        note
      }
    ];
    persist();
    return { ok: true };
  }

  function disposeBatch(batchId: string): DeductionCheck {
    const batch = batches.value.find((b) => b.id === batchId);
    if (!batch) return { ok: false, reason: "批次不存在" };
    const remaining = remainingOf(batch, deductions.value);
    if (remaining <= 0) return { ok: false, reason: "批次已无结余" };
    return deduct(batchId, "spoilage", remaining, "过期报废");
  }

  function currentBlockers(displayTemp: number | null): HandoverBlocker[] {
    return handoverBlockers({
      batches: batches.value,
      deductions: deductions.value,
      displayTemp,
      now: new Date()
    });
  }

  function handover(displayTemp: number): {
    ok: boolean;
    blockers: HandoverBlocker[];
    record?: Handover;
  } {
    const shift = currentShift.value;
    if (!shift) return { ok: false, blockers: [] };
    const blockers = currentBlockers(displayTemp);
    if (blockers.length > 0) return { ok: false, blockers };

    const now = new Date().toISOString();
    const lines = batches.value
      .map((batch) => ({
        batchId: batch.id,
        code: batch.code,
        productId: batch.productId,
        initialQty: batch.initialQty,
        soldHere: batchQty(batch.id, deductions.value, "sale", shift.id),
        spoiledHere: batchQty(batch.id, deductions.value, "spoilage", shift.id),
        carried: remainingOf(batch, deductions.value)
      }))
      .filter((line) => line.carried > 0 || line.soldHere > 0 || line.spoiledHere > 0);

    const record: Handover = {
      id: crypto.randomUUID(),
      shiftId: shift.id,
      shiftName: shift.name,
      closedAt: now,
      displayTemp,
      lines,
      totalCarried: lines.reduce((sum, line) => sum + line.carried, 0)
    };

    handovers.value = [...handovers.value, record];
    const nextSeq = shift.seq + 1;
    shifts.value = [
      ...shifts.value.map((s) =>
        s.id === shift.id ? { ...s, closedAt: now, displayTemp } : s
      ),
      {
        id: crypto.randomUUID(),
        name: SHIFT_NAMES[nextSeq % SHIFT_NAMES.length],
        seq: nextSeq,
        openedAt: now,
        closedAt: null,
        displayTemp: null
      }
    ];
    persist();
    return { ok: true, blockers: [], record };
  }

  function resetDemo() {
    const fresh = seedState();
    shifts.value = fresh.shifts;
    batches.value = fresh.batches;
    deductions.value = fresh.deductions;
    handovers.value = fresh.handovers;
    persist();
  }

  return {
    shifts,
    batches,
    deductions,
    handovers,
    currentShift,
    registerBatch,
    deduct,
    disposeBatch,
    currentBlockers,
    handover,
    resetDemo
  };
});
