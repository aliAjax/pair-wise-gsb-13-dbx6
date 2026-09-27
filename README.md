# 加油站便利店商品批次交接台

- 行业：石油（加油站便利店）
- 技术栈：Vue3、Vite、TypeScript、Pinia、Element Plus
- 启动：`npm install && npm run dev`
- 构建：`npm run build`

## 功能

- 批次登记：品类、初始数量、到货温度、到期时刻
- 按批次扣减：售卖 / 报损逐批核销，扣减超过结余会被拦截
- 班次移交：结余随班次移交，交班时生成快照
- 交班校验：陈列温度超出 2–8℃、存在已过期待处理批次或扣减超结余时无法交班
- 班次查询：按班次查看接收结余、登记批次、售卖报损明细与移交结余

## 目录结构

- `src/data/catalog.ts`：商品资料（品类、单位、保质期、温区常量）
- `src/domain/rules.ts`：判定逻辑（结余、超温、过期、扣减与交班校验）
- `src/store/persistence.ts`：本机保存（localStorage 读写与演示数据）
- `src/store/shiftStore.ts`：状态与动作（Pinia）
- `src/components/`、`src/App.vue`：页面

数据默认保存在浏览器 localStorage 中，重开后可按班次查询剩余与处置记录。
