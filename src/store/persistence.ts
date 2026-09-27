import type { Batch, Deduction, Handover, PersistedState, Shift } from "../types";
import { SHIFT_NAMES } from "../data/catalog";

const STORAGE_KEY = "dfwlfront-7-batch-handover";
const VERSION = 1;
const HOUR = 3600_000;

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.version !== VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state: PersistedState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY);
}

function code(at: Date, seq: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `B-${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(seq)}`;
}

export function seedState(now = new Date()): PersistedState {
  const iso = (ms: number) => new Date(ms).toISOString();
  const t = now.getTime();

  const prevShift: Shift = {
    id: "seed-shift-prev",
    name: SHIFT_NAMES[2],
    seq: 2,
    openedAt: iso(t - 10 * HOUR),
    closedAt: iso(t - 2 * HOUR),
    displayTemp: 4.6
  };
  const currentShift: Shift = {
    id: "seed-shift-current",
    name: SHIFT_NAMES[0],
    seq: 3,
    openedAt: prevShift.closedAt as string,
    closedAt: null,
    displayTemp: null
  };

  const batches: Batch[] = [
    {
      id: "seed-batch-bento",
      code: code(new Date(t - 10 * HOUR), 1),
      productId: "bento",
      shiftId: prevShift.id,
      initialQty: 12,
      arrivalTemp: 4.2,
      expiresAt: iso(t + 10 * HOUR),
      createdAt: prevShift.openedAt
    },
    {
      id: "seed-batch-oden",
      code: code(new Date(t - 10 * HOUR), 2),
      productId: "oden",
      shiftId: prevShift.id,
      initialQty: 20,
      arrivalTemp: 6.1,
      expiresAt: iso(t - 3 * HOUR),
      createdAt: prevShift.openedAt
    },
    {
      id: "seed-batch-sandwich",
      code: code(new Date(t - 2 * HOUR), 3),
      productId: "sandwich",
      shiftId: currentShift.id,
      initialQty: 8,
      arrivalTemp: 3.6,
      expiresAt: iso(t + 20 * HOUR),
      createdAt: iso(t - 90 * 60_000)
    },
    {
      id: "seed-batch-milk",
      code: code(new Date(t - 2 * HOUR), 4),
      productId: "milk",
      shiftId: currentShift.id,
      initialQty: 6,
      arrivalTemp: 9.4,
      expiresAt: iso(t + 60 * HOUR),
      createdAt: iso(t - 60 * 60_000)
    },
    {
      id: "seed-batch-bento2",
      code: code(new Date(t - 2 * HOUR), 5),
      productId: "bento",
      shiftId: currentShift.id,
      initialQty: 4,
      arrivalTemp: 5.2,
      expiresAt: iso(t - 30 * 60_000),
      createdAt: iso(t - 2 * HOUR)
    }
  ];

  const deductions: Deduction[] = [
    { id: "seed-ded-1", batchId: "seed-batch-bento", shiftId: prevShift.id, kind: "sale", qty: 5, at: iso(t - 9 * HOUR), note: "" },
    { id: "seed-ded-2", batchId: "seed-batch-bento", shiftId: prevShift.id, kind: "spoilage", qty: 1, at: iso(t - 8 * HOUR), note: "包装破损" },
    { id: "seed-ded-3", batchId: "seed-batch-oden", shiftId: prevShift.id, kind: "sale", qty: 17, at: iso(t - 5 * HOUR), note: "" },
    { id: "seed-ded-4", batchId: "seed-batch-oden", shiftId: prevShift.id, kind: "spoilage", qty: 3, at: iso(t - 3 * HOUR), note: "超时未售报废" },
    { id: "seed-ded-5", batchId: "seed-batch-sandwich", shiftId: currentShift.id, kind: "sale", qty: 2, at: iso(t - 60 * 60_000), note: "" },
    { id: "seed-ded-6", batchId: "seed-batch-bento2", shiftId: currentShift.id, kind: "sale", qty: 3, at: iso(t - 90 * 60_000), note: "" }
  ];

  const handovers: Handover[] = [
    {
      id: "seed-handover-prev",
      shiftId: prevShift.id,
      shiftName: prevShift.name,
      closedAt: prevShift.closedAt as string,
      displayTemp: 4.6,
      lines: [
        { batchId: "seed-batch-bento", code: batches[0].code, productId: "bento", initialQty: 12, soldHere: 5, spoiledHere: 1, carried: 6 },
        { batchId: "seed-batch-oden", code: batches[1].code, productId: "oden", initialQty: 20, soldHere: 17, spoiledHere: 3, carried: 0 }
      ],
      totalCarried: 6
    }
  ];

  return {
    version: VERSION,
    shifts: [prevShift, currentShift],
    batches,
    deductions,
    handovers
  };
}
