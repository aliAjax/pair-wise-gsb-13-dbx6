export interface CatalogItem {
  category: string;
  unit: string;
  shelfLifeHours: number;
}

export const CATALOG: readonly CatalogItem[] = [
  { category: "临期便当", unit: "盒", shelfLifeHours: 12 },
  { category: "关东煮", unit: "串", shelfLifeHours: 6 },
  { category: "三角饭团", unit: "个", shelfLifeHours: 10 },
  { category: "三明治", unit: "个", shelfLifeHours: 16 },
  { category: "现制热饮", unit: "杯", shelfLifeHours: 4 },
];

export function catalogItem(category: string): CatalogItem | undefined {
  return CATALOG.find((item) => item.category === category);
}

export function unitOf(category: string): string {
  return catalogItem(category)?.unit ?? "件";
}
