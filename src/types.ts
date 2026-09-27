export interface ProductInfo {
  id: string;
  name: string;
  unit: string;
  shelfLifeHours: number;
}

export interface Batch {
  id: string;
  code: string;
  productId: string;
  shiftId: string;
  initialQty: number;
  arrivalTemp: number;
  expiresAt: string;
  createdAt: string;
}

export type DeductionKind = "sale" | "spoilage";

export interface Deduction {
  id: string;
  batchId: string;
  shiftId: string;
  kind: DeductionKind;
  qty: number;
  at: string;
  note: string;
}

export interface Shift {
  id: string;
  name: string;
  seq: number;
  openedAt: string;
  closedAt: string | null;
  displayTemp: number | null;
}

export interface HandoverLine {
  batchId: string;
  code: string;
  productId: string;
  initialQty: number;
  soldHere: number;
  spoiledHere: number;
  carried: number;
}

export interface Handover {
  id: string;
  shiftId: string;
  shiftName: string;
  closedAt: string;
  displayTemp: number;
  lines: HandoverLine[];
  totalCarried: number;
}

export interface PersistedState {
  version: number;
  shifts: Shift[];
  batches: Batch[];
  deductions: Deduction[];
  handovers: Handover[];
}
