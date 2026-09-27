import type { ProductInfo } from "../types";

export const TEMP_MIN = 2;
export const TEMP_MAX = 8;

export const PRODUCTS: ProductInfo[] = [
  { id: "bento", name: "便当", unit: "份", shelfLifeHours: 24 },
  { id: "oden", name: "关东煮", unit: "串", shelfLifeHours: 12 },
  { id: "sandwich", name: "三明治", unit: "个", shelfLifeHours: 24 },
  { id: "milk", name: "低温鲜奶", unit: "瓶", shelfLifeHours: 72 }
];

export const SHIFT_NAMES = ["早班", "中班", "晚班"];

export function productOf(id: string): ProductInfo {
  return PRODUCTS.find((product) => product.id === id) ?? PRODUCTS[0];
}
