# copium 依赖复核（2026-11-26）

- 基于：main a6ba9a0（11-25 合入的 #1 之后）
- 环境：Node 22.23.5，npm 10.9.9，`npm ci` 从头装

## npm audit 计数（critical / high / moderate / low）
- 改前：0 / 0 / 0 / 0（共 0）
- 改后：0 / 0 / 0 / 0（共 0，没有改动）
- 清掉 0 条，剩 0 条

## 升级的包
无。

## package.json diff
无改动。

## 没清的
无。

## 测试和构建（main 原样）
- `npm test`（vitest run）：Test Files 1 passed (1)，Tests 28 passed (28)
- `npm run build`（next build）：成功，路由表正常输出（`○ (Static) prerendered as static content`）

## 结论
11-24 的 17 条已在 11-25 的 #1 清零，最新 main 没有回涨，不需要 PR。
