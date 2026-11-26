# tg-bridge-channel README 实测（2026-11-26）

检查对象：AliceLJY/tg-bridge-channel main 最新提交 03f5dcb（2026-11-24）。
环境：云端 Ubuntu 24.04（Linux x86_64），Node v22.23.5 / npm 10.9.9，Bun 1.4.4，Python 3.13.18，tmux 有，`codex` 没有。每个仓用临时空 HOME 跑，不碰真实账号。

**结论：走到连 Telegram 前一步，补 3 处。**

**11-24 那次改动有没有用：有用。** 11-24 把示例配置的 `shared.cwd` 默认改成 `"."` 并在 README 写明。这次没改 cwd，`check` 显示 `cwd=<仓库目录>`，直接通过，不用再猜要填什么路径。

### 逐步命令和结果
1. 拿代码：Quick start 直接从 `bun install` 开始，没写克隆，也没在这一节写要先装 Bun（只有页首一个 Bun 徽章）（卡点 1、2）。我自己 `git clone` 后 `cd`。
2. 第 1 步建 bot：要 Telegram 账号和 @BotFather，**云端未做**（不申请 token）。
3. `bun install` → `139 packages installed`。
4. `cp config.example.json config.json`。
5. 不改任何值直接跑 `bun run check --config config.json`：
   ```
   1. backends.claude.telegramBotToken: must be a real Telegram bot token, not an empty or placeholder value.
   2. backends.codex.telegramBotToken: duplicates the bot token used by backends.claude.telegramBotToken. Use one bot token per backend.
   ```
   报错清楚。把 `ownerTelegramId` 和 `backends.claude.telegramBotToken` 换成格式对的假值（README 第 3 步只要求改这两个）后：`[check] ok`（另有一条 warning：`~/.claude` 下没有登录状态）。这个 `check` 命令 README 的 Quick start 没提（卡点 3）。
6. 第 4 步 `CLAUDE_REPLY_ENGINE=1 bun run start --backend claude --config config.json`：进程起来后去连 `api.telegram.org`，被云端网络拦下（403），没法往下走。就算放行，假 token 也会被 Telegram 拒。reply 引擎还要 Claude Code 的 Remote Control / 订阅会话，**云端未验证**。
7. 测试：`bun test` **330 条全过（38 个文件）**；`bun run check:claude-contract` **87 条全过（5 个文件）**。跑测试时打出一行 `[shared-context] read failed: database is locked`，不影响结果。

### 卡点
1. **没写怎么拿到代码**。原文：代码块第一条是 `bun install`。实际：不知道要先克隆。绕法：自己克隆。→ 改动 1。
2. **Quick start 没写要装 Bun**。原文：只有页首徽章。实际：没 Bun 的人第一条 `bun install` 就报找不到命令。→ 改动 1（同一处加一句）。
3. **没写怎么在没 token 时先验证配置**。原文：第 3 步编辑完直接第 4 步 `start`。实际：仓里有 `bun run check`，不连 Telegram 就能逐条报出配置哪里不对，我用它确认了配置形状；README 这一节没提。→ 改动 2。
4. （没改）README 没说怎么拿自己的 Telegram 数字用户 ID。这要在 Telegram 里操作，我没验证任何办法，所以不往 README 里写猜的步骤，留给 CC 定。

### 最终走到哪
依赖装好、配置校验通过、两组测试全过；停在连 Telegram 那一步。

### 改动和卡点对应
- 改动 1（两份 README Quick start 代码块前加 Bun 说明、代码块开头加「0. 拿到代码」）↔ 卡点 1、2
- 改动 2（第 3 步后加「3b. 离线校验」）↔ 卡点 3

### 补丁（`git diff`，中英两份 README；同目录 readme.patch 是同一份，可直接 `git apply`）

```diff
diff --git a/README.md b/README.md
index 887211d..f87e06c 100644
--- a/README.md
+++ b/README.md
@@ -147,7 +147,13 @@ The synthetic local-contract fixtures dated 2026-07-17 were re-run against Claud
 
 Claude Code is installed separately from this package. For a Claude CLI engine, install a current Claude Code release, verify it with `claude --version`, and check the compatibility boundary above before upgrading an existing bridge.
 
+You also need [Bun](https://bun.sh) (the bridge runs on Bun, not Node).
+
 ```bash
+# 0. get the code
+git clone https://github.com/AliceLJY/tg-bridge-channel.git
+cd tg-bridge-channel
+
 # 1. create a bot: in Telegram, open @BotFather, send /newbot, copy the token it returns
 #    you also need your own numeric Telegram user ID for ownerTelegramId
 
@@ -158,6 +164,10 @@ bun install
 cp config.example.json config.json
 # edit config.json: set ownerTelegramId, backends.claude.telegramBotToken, and shared.cwd (defaults to ".")
 
+# 3b. optional: validate config.json offline before starting (no Telegram connection);
+#     it prints "[check] ok", or a numbered list of fields to fix
+bun run check --backend claude --config config.json
+
 # 4. run with the reply engine (recommended)
 CLAUDE_REPLY_ENGINE=1 bun run start --backend claude --config config.json
 ```
diff --git a/README_CN.md b/README_CN.md
index 0cf4f89..de3df33 100644
--- a/README_CN.md
+++ b/README_CN.md
@@ -147,7 +147,13 @@ bridge **不会捆绑或自动升级 Claude Code**。CLI 引擎读取 `CLAUDE_CL
 
 Claude Code 需独立安装，不包含在本包内。使用 Claude CLI 引擎时，请安装当前版本、用 `claude --version` 确认，并在升级现有 bridge 前核对上面的兼容边界。
 
+另外需要先装 [Bun](https://bun.sh)（bridge 跑在 Bun 上，不是 Node）。
+
 ```bash
+# 0. 拿到代码
+git clone https://github.com/AliceLJY/tg-bridge-channel.git
+cd tg-bridge-channel
+
 # 1. 建 bot：在 Telegram 里打开 @BotFather，发送 /newbot，复制它返回的 token
 #    还需要你自己的 Telegram 数字用户 ID，填进 ownerTelegramId
 
@@ -158,6 +164,10 @@ bun install
 cp config.example.json config.json
 # 编辑 config.json：设置 ownerTelegramId 和 backends.claude.telegramBotToken，按需修改 shared.cwd（默认 "." 即当前目录）
 
+# 3b. 可选：启动前先离线校验 config.json（不连 Telegram）；
+#     通过时打印 "[check] ok"，不通过时逐条列出要改的字段
+bun run check --backend claude --config config.json
+
 # 4. 用 reply 引擎运行（推荐）
 CLAUDE_REPLY_ENGINE=1 bun run start --backend claude --config config.json
 ```
```
