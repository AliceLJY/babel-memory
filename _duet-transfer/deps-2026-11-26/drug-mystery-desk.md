# drug-mystery-desk 依赖复核（2026-11-26）

- 基于：main d833ecb（11-25 合入 #1、#2 之后）
- 环境：Node 22.23.5，npm 10.9.9，`npm ci` 从头装

## npm audit 计数（critical / high / moderate / low）
- 改前：0 / 2 / 6 / 0（共 8，与 11-25 #1 合并后的结果相同）
- 改后：0 / 2 / 6 / 0（共 8，没有改动）
- 清掉 0 条，剩 8 条

## 升级的包
无。剩下的 8 条在补丁和小版本范围内都没有修法。

## package.json diff
无改动。

附一份没采用的试验 diff：`drug-mystery-desk-overrides-NOT-ADOPTED.diff`（见下面「试验」一节）。

## 没清的每一条

| 包 | 级别 | 为什么不清 |
|---|---|---|
| vinext 0.0.50（直接依赖） | high | 经由 @vercel/og 和 image-size。0.0.x 线最新 0.0.55，依赖和 0.0.50 完全一样（image-size 锁 2.0.2、@vercel/og ^0.8.6），升了不清告警。修法是 vinext 1.x（最新 1.4.6），跨大版本；11-25 试过 1.0.0 / 1.1.0 / 1.2.0，构建产物会 import "cloudflare:workers"，rendered-html 测试第 1 条挂；≥1.2.1 还要 react ^19.3.1。要大版本 + 可能要改代码。 |
| image-size 2.0.2（vinext 锁死） | high | 修复版 2.0.3 起，但 vinext 写死 2.0.2，只能靠 vinext 1.x 或 overrides。 |
| @vercel/og 0.8.6（vinext 依赖） | moderate | 修复在 1.0.3，vinext 0.0.x 要求 ^0.8.6（不含 1.x）。同上。 |
| satori 0.16.0（@vercel/og 依赖） | moderate | 跟着 @vercel/og 走，同上。 |
| drizzle-kit 0.31.10（直接依赖） | moderate | 经由 @esbuild-kit/esm-loader。最新 0.31.11 仍依赖 @esbuild-kit/esm-loader ^2.5.5，npm 给的修法是降到 0.18.1（大版本，等于回退）。上游没修。 |
| @esbuild-kit/esm-loader 2.6.5 | moderate | drizzle-kit 依赖，同上。 |
| @esbuild-kit/core-utils 3.3.2 | moderate | 同上，包已标 deprecated（并入 tsx）。 |
| esbuild 0.18.20（@esbuild-kit/core-utils 依赖） | moderate | 同上。这条链只在跑 `drizzle-kit` 的开发工具里，不进线上构建。 |

## 试验（没采用，已还原）
在 package.json 加 overrides：image-size 2.0.4、@vercel/og 1.0.3（diff 见附件）。
- audit：0 / 0 / 7 / 0（共 7）。2 条 high 清零，但 @vercel/og 1.0.3 带来 satori 0.33.5，又多出一条 fflate moderate（unzipSync 解析畸形 ZIP64 死循环）。
- `npm test` 2/2 通过，`npm run lint` 通过。
- 没采用的原因：overrides 是强行改依赖的依赖，超出任务单「只改版本号和 lockfile」的范围，而且 vinext 0.0.50 没声明支持 @vercel/og 1.x。要不要这么做由 CC 定。

## 测试和构建（main 原样）
- `npm test`（先 vinext build，再 node --test tests/rendered-html.test.mjs）：tests 2，pass 2，fail 0
- `npm run build`：输出 `Build complete. Run vinext start to start the production server.`

## 结论
不开 PR。剩下 8 条要么要 vinext 1.x 大版本（4 条），要么上游 drizzle-kit 没修（4 条）。
