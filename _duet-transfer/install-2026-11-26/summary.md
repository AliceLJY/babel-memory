# 8 个仓 README 实测汇总（2026-11-26）

环境：云端 Ubuntu 24.04，Node 22.23.5 / npm 10.9.9，Bun 1.4.4，Python 3.13.18。每个仓从最新 main 克隆，用临时空 HOME，假 token / 假配置，不登录任何账号。云端连不上 api.telegram.org 和微信登录接口，下不了无头浏览器，所以 Telegram、微信、手机、macOS/launchd、Claude Code 登录这几步一律写「云端未验证」。这批没开 PR、没推送：要改的仓在各自目录下有 report.md（实测记录 + 补丁 + 改动与卡点对应）和 readme.patch（纯 `git diff`，已在干净克隆上 `git apply --check` 通过）。

| 仓 | 最新提交 | 测试 | 结论 | 补丁 |
|---|---|---|---|---|
| trio-handoff | 070edf2 | 6/6 | 走通；缺克隆步骤，README 英文、输出中文 | 2 处 |
| agent-room-cli | f3010d4 | 84/84 | 装上；Quick Start 的 `trio` 缺 codex 即退出 | 1 处 |
| tg-bridge-channel | 03f5dcb | 330/330 + 87/87 | 停在连 Telegram；缺克隆、Bun、离线校验 | 2 处 |
| wechat-ai-bridge | 3157ffa | 43/43 | 停在扫码；占位值办法写在代码块后面 | 2 处 |
| cobbler | 0fe017e | nest 193/193，app 11/11 + tsc | nest 跑通；浅克隆 1 条测试挂，generate 会调 Claude | 2 处 |
| telegram-ai-bridge | 1d242ac | 176/176 | 停在连 Telegram | 走通，无需改 |
| repo-insight | baba53d | lint 过 | npx 默认装进当前目录；`ln` 缺目录 | 2 处 |
| phone-remote | a6fda9d | 无测试，`node --check` 过 | 只能 macOS 装；克隆地址是 `<you>` 占位符 | 4 处 |

11-24 改过的 6 个仓：trio-handoff（Desktop 自动建）、agent-room-cli（克隆+build 装法）、tg-bridge-channel（cwd 默认 "."）、wechat-ai-bridge（from_user_id 三步）这 4 处改动实测有用；cobbler（Claude CLI 查找）只验证了环境变量那条路；repo-insight 的改动在技能内容里，要在 Claude Code 里跑才看得到。

repo-insight 的 README.zh.md 只是跳转到 README_CN.md 的 3 行占位页，不用同步。
