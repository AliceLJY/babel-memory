# agent-room-cli README 实测（2026-11-26）

检查对象：AliceLJY/agent-room-cli main 最新提交 f3010d4（2026-11-24）。
环境：云端 Ubuntu 24.04（Linux x86_64），Node v22.23.5 / npm 10.9.9，Bun 1.4.4，Python 3.13.18，tmux 有，`codex` 没有。每个仓用临时空 HOME 跑，不碰真实账号。

**结论：装得上、测试全过，补 1 处。**

**11-24 那次改动有没有用：有用。** 11-24 把「`npm install -g github:...`」换成了克隆 + `npm install` + `npm run build` + `npm link`。这次照新写法一步一步走，全部成功，`agent-room` 命令可用。

### 逐步命令和结果
1. `git clone … && cd agent-room-cli`：成功。
2. `npm install`：成功。注意它会改写 `package-lock.json`（npm 10.9.9 删掉 18 行 `libc` 字段，锁文件像是更新版 npm 生成的），不影响使用，我没放进补丁。
3. `npm run build`：`tsc -p tsconfig.json` 无报错。
4. `npm link`：`added 1 package … found 0 vulnerabilities`，`which agent-room` 找得到。（云端是 root；普通用户的全局 npm 目录如果要 sudo，这一步可能报权限错，我没法验证。）
5. 测试：`npm test` **84 条全过（10 个文件）**；`npm run typecheck` 无报错；`npm run package:check` → `package smoke passed: 49 files, CLI 0.3.0`。
6. Quick Start 第一条 `agent-room trio --room dev --name me --fresh`：直接抛栈退出，`Error: codex CLI is required but was not found in PATH`（卡点 1）。
7. 改走 README 里「Only have Claude Code?」那条：`agent-room host --room dev --name me` 在 tmux 里起来，输出
   ```
   agent-room listening: http://127.0.0.1:43110
   room: dev
   you: @me
   ```
   另开终端 `agent-room send --server http://127.0.0.1:43110 --room dev --name tester "hello from send"` → `sent msg_mwx741gu_7041ffc0`；房间里 `/who`、`@cc …`、`/exit` 都能输入，`/exit` 后生成存档，`agent-room list` 显示 `room=dev  messages=2`。
8. `agent-room run claude …`：**需要已登录的 Claude Code，云端未验证**（不用真实账号登录）。`run codex` 需要 Codex，云端没有。

### 卡点
1. **Quick Start 第一条命令硬要求 Codex**。原文：Prerequisites 里写 Codex 是 optional，但 Quick Start 第一条就是 `trio`。实际：没装 codex 时 `trio` 打一大段 Node 栈直接退出。绕法：改用下面「Only have Claude Code?」的 `host` + `run claude`。→ 改动 1。

### 最终走到哪
装好、测试全过、房间服务能起、能收发消息和存档。接入 Claude Code / Codex 那一步没走（要账号）。

### 改动和卡点对应
- 改动 1（两份 README「Quick Start / 快速开始」第一句）↔ 卡点 1

### 补丁（`git diff`，中英两份 README；同目录 readme.patch 是同一份，可直接 `git apply`）

```diff
diff --git a/README.md b/README.md
index 4c4af99..058a9c1 100644
--- a/README.md
+++ b/README.md
@@ -77,7 +77,7 @@ Prerequisites:
 
 ## Quick Start
 
-One command opens a three-pane tmux room:
+One command opens a three-pane tmux room. `trio` needs **both** `claude` and `codex` on your `PATH`; if `codex` is missing it stops with `Error: codex CLI is required but was not found in PATH`. No Codex? Skip to **Only have Claude Code?** below.
 
 ```bash
 agent-room trio --room dev --name me --fresh
diff --git a/README_CN.md b/README_CN.md
index 2725d50..c4ff724 100644
--- a/README_CN.md
+++ b/README_CN.md
@@ -75,7 +75,7 @@ npm link
 
 ## 快速开始
 
-一条命令打开一个三窗格 tmux 房间：
+一条命令打开一个三窗格 tmux 房间。`trio` 要求 `claude` 和 `codex` **两个**都在 `PATH` 里；缺 `codex` 会直接报 `Error: codex CLI is required but was not found in PATH` 退出。没有 Codex 的话，直接看下面的「**只有 Claude Code？**」。
 
 ```bash
 agent-room trio --room dev --name me --fresh
```
