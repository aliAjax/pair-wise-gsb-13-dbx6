import type { Batch, Deduction, DeductionKind } from "../types";
import { TEMP_MIN, TEMP_MAX } from "../data/catalog";

export function remainingOf(batch: Batch, deductions: Deduction[]): number {
  const used = deductions
    .filter((d) => d.batchId === batch.id)
    .reduce((sum, d) => sum + d.qty, 0);
  return batch.initialQty - used;
}

export function batchQty(
  batchId: string,
  deductions: Deduction[],
  kind?: DeductionKind,
  shiftId?: string
): number {
  return deductions
    .filter(
      (d) =>
        d.batchId === batchId &&
        (!kind || d.kind === kind) &&
        (!shiftId || d.shiftId === shiftId)
    )
    .reduce((sum, d) => sum + d.qty, 0);
}

export function shiftQty(deductions: Deduction[], shiftId: string, kind: DeductionKind): number {
  return deductions
    .filter((d) => d.shiftId === shiftId && d.kind === kind)
    .reduce((sum, d) => sum + d.qty, 0);
}

export function isExpired(batch: Batch, now: Date): boolean {
  return new Date(batch.expiresAt).getTime() <= now.getTime();
}

export function isTempOutOfRange(temp: number): boolean {
  return !Number.isFinite(temp) || temp < TEMP_MIN || temp > TEMP_MAX;
}

export type DeductionCheck = { ok: true } | { ok: false; reason: string };

export function checkDeduction(
  batch: Batch,
  deductions: Deduction[],
  qty: number
): DeductionCheck {
  if (!Number.isFinite(qty) || qty <= 0) {
    return { ok: false, reason: "扣减数量必须大于 0" };
  }
  const remaining = remainingOf(batch, deductions);
  if (qty > remaining) {
    return { ok: false, reason: `扣减 ${qty} 超过批次 ${batch.code} 结余 ${remaining}` };
  }
  return { ok: true };
}

export interface BatchFlag {
  kind: "temp" | "expired" | "soon" | "cleared";
  text: string;
}

export function batchFlags(batch: Batch, deductions: Deduction[], now: Date): BatchFlag[] {
  const flags: BatchFlag[] = [];
  const remaining = remainingOf(batch, deductions);
  if (isTempOutOfRange(batch.arrivalTemp)) {
    flags.push({ kind: "temp", text: `到货超温 ${batch.arrivalTemp}℃` });
  }
  if (remaining > 0 && isExpired(batch, now)) {
    flags.push({ kind: "expired", text: "已过期待处理" });
  } else if (
    remaining > 0 &&
    new Date(batch.expiresAt).getTime() - now.getTime() <= 2 * 3600_000
  ) {
    flags.push({ kind: "soon", text: "临近到期" });
  }
  if (remaining === 0) {
    flags.push({ kind: "cleared", text: "已清空" });
  }
  return flags;
}

export interface HandoverBlocker {
  kind: "display-temp" | "expired" | "overdraw";
  message: string;
}

export function handoverBlockers(args: {
  batches: Batch[];
  deductions: Deduction[];
  displayTemp: number | null;
  now: Date;
}): HandoverBlocker[] {
  const { batches, deductions, displayTemp, now } = args;
  const blockers: HandoverBlocker[] = [];

  if (displayTemp === null || !Number.isFinite(displayTemp)) {
    blockers.push({ kind: "display-temp", message: `请填写陈列温度（要求 ${TEMP_MIN}–${TEMP_MAX}℃）` });
  } else if (isTempOutOfRange(displayTemp)) {
    blockers.push({
      kind: "display-temp",
      message: `陈列温度 ${displayTemp}℃ 超出 ${TEMP_MIN}–${TEMP_MAX}℃ 范围`
    });
  }

  for (const batch of batches) {
    const remaining = remainingOf(batch, deductions);
    if (remaining < 0) {
      blockers.push({
        kind: "overdraw",
        message: `批次 ${batch.code} 扣减超过结余（剩余 ${remaining}），需先更正`
      });
    } else if (remaining > 0 && isExpired(batch, now)) {
      blockers.push({
        kind: "expired",
        message: `批次 ${batch.code} 已过期，剩余 ${remaining} 待报损处理`
      });
    }
  }

  return blockers;
}
