# 第 4 件：三仓依赖复核（2026-11-26）

| 仓 | main | 改前 | 改后 | 清掉 | 剩 | PR |
|---|---|---|---|---|---|---|
| copium | a6ba9a0 | 0 | 0 | 0 | 0 | 不开 |
| drug-mystery-desk | d833ecb | 8（2 high / 6 moderate） | 8 | 0 | 8 | 不开 |
| agentdeck | dddcf00 | 0 | 0 | 0 | 0 | 不开 |

三个仓 package.json 都没有改动，所以没有 lockfile 要重新生成。每个仓的详细汇报见同目录 `<仓名>.md`。
`drug-mystery-desk-overrides-NOT-ADOPTED.diff` 是一个没采用的试验，说明见 drug-mystery-desk.md。
