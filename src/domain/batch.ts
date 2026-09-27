export const TEMP_MIN = 2;
export const TEMP_MAX = 8;
export const SOON_EXPIRY_MS = 2 * 60 * 60 * 1000;

export type MovementKind = "sale" | "waste";

export interface Batch {
  id: string;
  category: string;
  initialQty: number;
  arrivalTemp: number;
  expiryAt: string;
  shiftId: string;
  createdAt: string;
}

export interface Movement {
  id: string;
  batchId: string;
  kind: MovementKind;
  qty: number;
  shiftId: string;
  at: string;
}

export interface Shift {
  id: string;
  name: string;
  openedAt: string;
  closedAt: string | null;
  displayTemp: number | null;
}

export interface HandoverState {
  batches: Batch[];
  movements: Movement[];
  shifts: Shift[];
}

export const SHIFT_NAMES = ["早班", "中班", "晚班"] as const;

export function nextShiftName(index: number, date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${SHIFT_NAMES[index % SHIFT_NAMES.length]}`;
}

export function currentShift(state: HandoverState): Shift {
  return state.shifts[state.shifts.length - 1];
}

export function batchLabel(batch: Batch): string {
  return `${batch.category}#${batch.id.slice(0, 4).toUpperCase()}`;
}

export function remainingOf(batch: Batch, movements: Movement[]): number {
  return (
    batch.initialQty -
    movements
      .filter((movement) => movement.batchId === batch.id)
      .reduce((sum, movement) => sum + movement.qty, 0)
  );
}

export function movedQty(batchId: string, movements: Movement[], kind: MovementKind): number {
  return movements
    .filter((movement) => movement.batchId === batchId && movement.kind === kind)
    .reduce((sum, movement) => sum + movement.qty, 0);
}

export function isTempOutOfRange(temp: number): boolean {
  return Number.isFinite(temp) && (temp < TEMP_MIN || temp > TEMP_MAX);
}

export function isExpired(batch: Batch, now: number): boolean {
  return new Date(batch.expiryAt).getTime() <= now;
}

export function isExpiringSoon(batch: Batch, now: number): boolean {
  const expiry = new Date(batch.expiryAt).getTime();
  return expiry > now && expiry - now <= SOON_EXPIRY_MS;
}

export function batchStatus(batch: Batch, movements: Movement[], now: number): string {
  const remaining = remainingOf(batch, movements);
  if (remaining <= 0) return "已清空";
  if (isExpired(batch, now)) return "已过期";
  if (isExpiringSoon(batch, now)) return "临期";
  return "正常";
}

export function checkDeduction(batch: Batch, movements: Movement[], qty: number): string | null {
  if (!Number.isFinite(qty) || qty <= 0) return "扣减数量必须大于 0";
  const remaining = remainingOf(batch, movements);
  if (qty > remaining) return `扣减超过结余：批次剩余 ${remaining}，无法扣减 ${qty}`;
  return null;
}

export function handoverBlockers(state: HandoverState, displayTemp: number, now: number): string[] {
  const blockers: string[] = [];
  if (!Number.isFinite(displayTemp)) {
    blockers.push(`请先填写陈列温度（${TEMP_MIN}~${TEMP_MAX}℃ 方可交班）`);
  } else if (displayTemp < TEMP_MIN || displayTemp > TEMP_MAX) {
    blockers.push(`陈列温度 ${displayTemp}℃ 超出 ${TEMP_MIN}~${TEMP_MAX}℃ 范围`);
  }
  for (const batch of state.batches) {
    const remaining = remainingOf(batch, state.movements);
    if (remaining < 0) {
      blockers.push(`批次 ${batchLabel(batch)} 扣减超过结余（剩余 ${remaining}），请先修正台账`);
    } else if (remaining > 0 && isExpired(batch, now)) {
      blockers.push(`批次 ${batchLabel(batch)} 已过期，剩余 ${remaining} 待报损处理`);
    }
  }
  return blockers;
}
