# cobbler README 实测（2026-11-26）

检查对象：AliceLJY/cobbler main 最新提交 0fe017e（2026-11-24）。
环境：云端 Ubuntu 24.04（Linux x86_64），Node v22.23.5 / npm 10.9.9，Bun 1.4.4，Python 3.13.18，tmux 有，`codex` 没有。每个仓用临时空 HOME 跑，不碰真实账号。

**结论：nest 能跑、测试全过，补 3 处。**

**11-24 那次改动有没有用：这次验证不到。** 11-24 改的是「Claude CLI 从环境变量、本地 bin 或 PATH 里找」（代码，不是 README）。我为了不在云端用到账号，把 `COBBLER_CLAUDE_BIN` 指向不存在的路径，日志如实打出 `spawn /nonexistent/claude ENOENT` 并重试一次后走模板兜底，说明环境变量这条路是通的；真 Claude 那条路没跑。

### 逐步命令和结果
1. 拿代码：「Nest quick start」直接从 `cd nest` 开始，没写克隆（卡点 1）。我先用浅克隆（`--depth 1`）。
2. `cd nest && npm test`：**193 条里 1 条失败**，`notify-fail.test.js:278` 要 `git archive 9be5895`，报 `fatal: not a valid object name: 9be5895`——这条测试要读一个旧提交，浅克隆里没有（卡点 1）。
3. 改成完整克隆后重跑：**193 条全过**。
4. `node generate.js`：README 没说它会调用本机 Claude、也没说怎么不调用（卡点 2）。我用 `COBBLER_CLAUDE_BIN=/nonexistent/claude node generate.js`：
   ```
   [nest] claude 调用失败: exit=ENOENT | message=spawn /nonexistent/claude ENOENT [第 1/2 次,重试]
   [nest] claude 调用失败: exit=ENOENT | message=spawn /nonexistent/claude ENOENT
   [cobbler-nest] ok mood=grumbly
   ```
   写出 `nest/data/state.json`，里面有 mood、mutter 和一条日记。
5. `node server.js` → `[cobbler-api] listening on 127.0.0.1:8790`。`curl /api/state` 返回上面那份状态；`/api/card/today` 返回 `{"error":"no card today","generating":true}`（空 HOME 里没有 git 历史，README 架构一节说过可能没有卡片，符合预期）；`/api/cards` 200。
6. `bash install.sh`、`tailscale serve`：**需要 macOS（launchd）和 Tailscale 账号，云端未验证**。
7. app：`cd app && npm install`（报 `9 vulnerabilities (7 moderate, 2 high)`，改写锁文件 12 行，已还原），`npm run check` → **11 条测试全过 + `tsc --noEmit` 无报错**；`npm run audit:ci` 通过（列出 3 条已接受的上游告警）。真机 / EAS 构建要 Android 手机和 Expo 账号，云端未验证。

### 卡点
1. **没写怎么拿到代码，且浅克隆会让 1 条测试挂**。原文：从 `cd nest` 开始。实际：不知道克隆；用 `--depth 1` 克隆的话 `npm test` 193 过 192。绕法：完整克隆。→ 改动 1。
2. **`node generate.js` 会把历史发给本机 Claude，quick start 里没提、也没说怎么不调用**。原文：「run the daily pipeline once」。实际：README 架构和隐私段说了会调 Claude，但 quick start 这行没提；没 Claude 时的试跑办法没写。绕法：用 README 列出的 `COBBLER_CLAUDE_BIN` 指向不存在的路径，走模板兜底。→ 改动 1（那行注释）+ 改动 2。
3. **`install.sh` / `tailscale` 需要 macOS 和 Tailscale 登录，这一节只说是「personal Mac mini wiring」**。→ 改动 2（同一段开头一句）。

### 最终走到哪
nest 测试全过、管线跑一轮、API 起来能查；app 测试和类型检查全过。launchd、Tailscale、安卓真机没走。

### 改动和卡点对应
- 改动 1（两份 README「Nest quick start / 巢的快速开始」代码块：加克隆行，`cd nest` 改 `cd cobbler/nest`，`generate.js` 那行注释）↔ 卡点 1、2
- 改动 2（代码块后新加一段「不调用 Claude 怎么试跑」，并在原 `install.sh` 段开头加一句需要 macOS 和 Tailscale）↔ 卡点 2、3

### 补丁（`git diff`，中英两份 README；同目录 readme.patch 是同一份，可直接 `git apply`）

```diff
diff --git a/README.md b/README.md
index 95b0402..dc793aa 100644
--- a/README.md
+++ b/README.md
@@ -32,15 +32,18 @@ Mac mini (the nest)                             Android phone (the body)
 ## Nest quick start
 
 ```sh
-cd nest
+git clone https://github.com/AliceLJY/cobbler.git   # full clone: one test reads an old commit, so --depth 1 makes it fail
+cd cobbler/nest
 npm test                 # node:test suite, no runtime dependencies
-node generate.js         # run the daily pipeline once
+node generate.js         # run the daily pipeline once (calls the installed Claude CLI; see below to skip it)
 node server.js           # serve the API on 127.0.0.1:8790
 bash install.sh          # install/reload all five personal launchd agents
 tailscale serve --bg --https=10000 http://127.0.0.1:8790   # expose inside your tailnet
 ```
 
-`install.sh` is personal Mac mini wiring: its launchd templates expect this repository at `~/Projects/cobbler`. The three Telegram feeds and listener also expect an ignored `nest/data/tg.json`; the book and knowledge feeds depend on Alice's local libraries. They are not required to run the API or Android app. The knowledge feed's library path defaults to `~/knowledge-vault`; override it with the `COBBLER_HIPPO_DIR` environment variable to point at your own notes directory.
+`node generate.js` sends selected history text to the `claude` on your `PATH`. To try the pipeline without Claude, point `COBBLER_CLAUDE_BIN` at a path that does not exist (e.g. `COBBLER_CLAUDE_BIN=/nonexistent node generate.js`): it logs two `claude 调用失败` lines, falls back to templates, and still writes `nest/data/state.json`. On a machine with no matching history, `GET /api/card/today` then answers `{"error":"no card today",...}`; that is expected.
+
+`install.sh` and `tailscale serve` need macOS (launchd) and a Tailscale login. `install.sh` is personal Mac mini wiring: its launchd templates expect this repository at `~/Projects/cobbler`. The three Telegram feeds and listener also expect an ignored `nest/data/tg.json`; the book and knowledge feeds depend on Alice's local libraries. They are not required to run the API or Android app. The knowledge feed's library path defaults to `~/knowledge-vault`; override it with the `COBBLER_HIPPO_DIR` environment variable to point at your own notes directory.
 
 Optional machine-local settings (knowledge-vault path, ebook path, Claude binary/model, port/host) go in `~/.config/cobbler/env` as `KEY=VALUE` lines — never in the repo. `install.sh` reads that file and writes the keys into every launchd plist, so re-running it keeps them. Keys: `COBBLER_HIPPO_DIR`, `COBBLER_EBOOKS_DIR`, `COBBLER_CLAUDE_BIN`, `COBBLER_CLAUDE_MODEL`, `COBBLER_PORT`, `COBBLER_HOST`.
 
diff --git a/README_CN.md b/README_CN.md
index afd25c8..102cfac 100644
--- a/README_CN.md
+++ b/README_CN.md
@@ -32,15 +32,18 @@ Mac mini(巢)                                   Android 手机(身体)
 ## 巢的快速开始
 
 ```sh
-cd nest
+git clone https://github.com/AliceLJY/cobbler.git   # 要完整克隆:有一条测试读旧提交,--depth 1 会让它失败
+cd cobbler/nest
 npm test                 # node:test 测试,无运行时依赖
-node generate.js         # 手动跑一轮每日管线
+node generate.js         # 手动跑一轮每日管线(会调用本机的 Claude CLI,不想调用见下文)
 node server.js           # API 起在 127.0.0.1:8790
 bash install.sh          # 安装或重载全部五个个人 launchd 服务
 tailscale serve --bg --https=10000 http://127.0.0.1:8790   # 在 tailnet 内暴露
 ```
 
-`install.sh` 是 Alice 的 Mac mini 专用接线,launchd 模板要求仓库位于 `~/Projects/cobbler`。三条 Telegram 投喂和监听器还需要被 git 忽略的 `nest/data/tg.json`;藏书与知识页投喂依赖 Alice 本机的资料库。只运行 API 或 Android app 不需要这些可选条件。知识页投喂的资料库路径默认是 `~/knowledge-vault`,可用 `COBBLER_HIPPO_DIR` 环境变量指向你自己的笔记目录。
+`node generate.js` 会把选中的历史文本交给 `PATH` 里的 `claude`。只想试跑、不调用 Claude 时,把 `COBBLER_CLAUDE_BIN` 指向一个不存在的路径(例如 `COBBLER_CLAUDE_BIN=/nonexistent node generate.js`):它会打两行 `claude 调用失败`,改用模板兜底,照样写出 `nest/data/state.json`。机器上没有符合条件的历史时,`GET /api/card/today` 会返回 `{"error":"no card today",...}`,这是正常的。
+
+`install.sh` 和 `tailscale serve` 需要 macOS(launchd)和已登录的 Tailscale。`install.sh` 是 Alice 的 Mac mini 专用接线,launchd 模板要求仓库位于 `~/Projects/cobbler`。三条 Telegram 投喂和监听器还需要被 git 忽略的 `nest/data/tg.json`;藏书与知识页投喂依赖 Alice 本机的资料库。只运行 API 或 Android app 不需要这些可选条件。知识页投喂的资料库路径默认是 `~/knowledge-vault`,可用 `COBBLER_HIPPO_DIR` 环境变量指向你自己的笔记目录。
 
 本机可选设置（知识库路径、电子书路径、Claude 可执行文件与模型、端口/主机）写在 `~/.config/cobbler/env`，一行一个 `KEY=VALUE`，不入仓；`install.sh` 会读取该文件并写进每个 launchd plist，重跑不丢。可用键：`COBBLER_HIPPO_DIR`、`COBBLER_EBOOKS_DIR`、`COBBLER_CLAUDE_BIN`、`COBBLER_CLAUDE_MODEL`、`COBBLER_PORT`、`COBBLER_HOST`。
 
```
