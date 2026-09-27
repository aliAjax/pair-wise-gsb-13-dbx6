import type { HandoverState } from "../domain/batch";
import { nextShiftName } from "../domain/batch";

const STORAGE_KEY = "dfwlfront-7-batch-handover";

export function loadState(): HandoverState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as HandoverState;
      if (
        Array.isArray(parsed.batches) &&
        Array.isArray(parsed.movements) &&
        Array.isArray(parsed.shifts) &&
        parsed.shifts.length > 0
      ) {
        return parsed;
      }
    } catch {
      // 数据损坏时回退到演示数据
    }
  }
  return seedState();
}

export function saveState(state: HandoverState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function seedState(): HandoverState {
  const now = Date.now();
  const iso = (time: number) => new Date(time).toISOString();
  const shift = {
    id: crypto.randomUUID(),
    name: nextShiftName(0, new Date(now)),
    openedAt: iso(now - 2 * 3600_000),
    closedAt: null,
    displayTemp: null,
  };
  const bento = {
    id: crypto.randomUUID(),
    category: "临期便当",
    initialQty: 12,
    arrivalTemp: 5.2,
    expiryAt: iso(now + 6 * 3600_000),
    shiftId: shift.id,
    createdAt: iso(now - 2 * 3600_000),
  };
  const oden = {
    id: crypto.randomUUID(),
    category: "关东煮",
    initialQty: 30,
    arrivalTemp: 9.1,
    expiryAt: iso(now + 3 * 3600_000),
    shiftId: shift.id,
    createdAt: iso(now - 90 * 60_000),
  };
  const onigiri = {
    id: crypto.randomUUID(),
    category: "三角饭团",
    initialQty: 8,
    arrivalTemp: 4.6,
    expiryAt: iso(now - 30 * 60_000),
    shiftId: shift.id,
    createdAt: iso(now - 5 * 3600_000),
  };
  const sale = {
    id: crypto.randomUUID(),
    batchId: bento.id,
    kind: "sale" as const,
    qty: 3,
    shiftId: shift.id,
    at: iso(now - 40 * 60_000),
  };
  return { batches: [bento, oden, onigiri], movements: [sale], shifts: [shift] };
}
