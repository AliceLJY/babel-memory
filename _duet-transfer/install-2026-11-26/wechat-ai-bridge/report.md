# wechat-ai-bridge README 实测（2026-11-26）

检查对象：AliceLJY/wechat-ai-bridge main 最新提交 3157ffa（2026-11-24）。
环境：云端 Ubuntu 24.04（Linux x86_64），Node v22.23.5 / npm 10.9.9，Bun 1.4.4，Python 3.13.18，tmux 有，`codex` 没有。每个仓用临时空 HOME 跑，不碰真实账号。

**结论：走到扫码前一步，补 2 处。**

**11-24 那次改动有没有用：有用，但顺序还会让人卡一下。** 11-24 加了「不知道 from_user_id 时先填占位值」三步。这次照做：占位值 `["replace-with-verified-from_user_id"]` 确实能让 `check` 通过；代码里那行日志的原文 `[authz] rejected message from unapproved from_user_id=…` 和 README 写的一致。问题是这三步写在代码块**下面**，照代码块往下走的人会先在 `check` 上撞墙（卡点 1）。

### 逐步命令和结果
1. `git clone … && cd wechat-ai-bridge`：成功。
2. `npm install`：`added 1 package, and audited 127 packages`，同时报 `5 vulnerabilities (3 moderate, 2 high)`，并改写 `package-lock.json`（删 12 行 `libc` 字段）。不影响使用，锁文件我还原了，没放进补丁。
3. `bun run bootstrap --backend claude`：
   ```
   Created starter config at <仓库>/config.json
   Required: set shared.allowedUserIds to verified iLink from_user_id values.
   ```
4. 照代码块注释「编辑 config.json，填 from_user_id」——陌生人此时没有这个值，直接跑 `bun run check --backend claude`：
   `1. shared.allowedUserIds: must be a non-empty array of WeChat from_user_id strings.`，退出码 1（卡点 1）。
5. 按代码块下面的三步填占位值后再 `check`：`[check] ok`（另有 warning：`~/.claude` 下没有登录状态）。
6. `bun run start --backend claude`：
   ```
   [auth] 未找到已保存的 token，需要扫码登录
   [auth] 获取登录二维码 (attempt 1/3)...
   ```
   去拿二维码时被云端网络拦下。之后要微信扫码，**需要微信，云端未验证**；拿 from_user_id 的那三步同样要真微信，没验证。
7. 测试：`npm test`（`node --test`）**43 条全过**；`bun run check:syntax` → `checked 44 JavaScript files`。

### 卡点
1. **代码块里没指向占位值办法**。原文：代码块注释只说「把核验过的 from_user_id 填入」，三步办法在代码块下方几段之后。实际：照代码块走的人在 `check` 上失败。绕法：往下读到那三步。→ 改动 1。
2. **「本机进程日志」没说在哪**。原文：在本机进程日志里找 `[authz]` 那行。实际：代码用 `console.warn` 打出来，就在跑 `start` 的那个终端里；README 没说，陌生人可能去找日志文件。→ 改动 2。（这点是读代码确认的，没有真收到微信消息验证。）

### 最终走到哪
依赖装好、配置校验通过、测试全过；停在获取微信登录二维码。

### 改动和卡点对应
- 改动 1（两份 README Quick Start 代码块里 `# 编辑 config.json` 注释下加一行）↔ 卡点 1
- 改动 2（两份 README 三步里第 3 步加括号说明）↔ 卡点 2

### 补丁（`git diff`，中英两份 README；同目录 readme.patch 是同一份，可直接 `git apply`）

```diff
diff --git a/README.md b/README.md
index 9dc18ae..aff03a3 100644
--- a/README.md
+++ b/README.md
@@ -137,6 +137,7 @@ cd wechat-ai-bridge
 npm install              # or: bun install
 bun run bootstrap --backend claude
 # Edit config.json and set shared.allowedUserIds to verified iLink from_user_id values.
+# Don't know your from_user_id yet? Use the placeholder from the 3 steps below this block, or check fails.
 bun run check --backend claude
 bun run start --backend claude
 ```
@@ -148,7 +149,7 @@ On first launch, a QR code appears in your terminal. Scan it with WeChat to auth
 If you do not already know your `from_user_id`:
 1. Temporarily set `"allowedUserIds": ["replace-with-verified-from_user_id"]` in `config.json` so `check` and `start` pass validation while still rejecting every real sender.
 2. Run `bun run start --backend claude`, scan the QR code to log in, and send a test message from your own WeChat account.
-3. Find the `[authz] rejected message from unapproved from_user_id="..."` line in the local process log, confirm it matches your own test message, replace the placeholder in `config.json` with that exact string, and restart the bridge.
+3. Find the `[authz] rejected message from unapproved from_user_id="..."` line in the local process log (it is printed in the terminal running `start`), confirm it matches your own test message, replace the placeholder in `config.json` with that exact string, and restart the bridge.
 
 On POSIX hosts, the bridge enforces mode `0600` on `config.json` and `~/.wechat-ai-bridge/token.json`, and mode `0700` on `~/.wechat-ai-bridge/` and the inbound `files/` directory. It refuses symbolic links for these private paths; Windows deployments should also restrict these paths with local ACLs.
 
diff --git a/README_CN.md b/README_CN.md
index d272980..5fc1f0f 100644
--- a/README_CN.md
+++ b/README_CN.md
@@ -135,6 +135,7 @@ cd wechat-ai-bridge
 npm install              # 或者: bun install
 bun run bootstrap --backend claude
 # 编辑 config.json，把核验过的 iLink from_user_id 填入 shared.allowedUserIds。
+# 还不知道自己的 from_user_id？先按代码块下面三步填占位值，否则 check 会失败。
 bun run check --backend claude
 bun run start --backend claude
 ```
@@ -146,7 +147,7 @@ bun run start --backend claude
 如果还不清楚自己的 `from_user_id`，可以这样获取：
 1. 先在 `config.json` 中临时填入占位值，例如 `"allowedUserIds": ["replace-with-verified-from_user_id"]`，以通过 `check` 和 `start` 的非空校验（所有真实发送者仍会被拒绝）。
 2. 运行 `bun run start --backend claude`，用微信扫码登录后，从自己的微信发送一条测试消息。
-3. 在本机进程日志中查看 `[authz] rejected message from unapproved from_user_id="..."` 这一行，确认对应自己刚发的消息后，将该精确字符串替换进 `config.json` 的 `shared.allowedUserIds`，然后重启 Bridge。
+3. 在本机进程日志（就是运行 `start` 的那个终端里的输出）中查看 `[authz] rejected message from unapproved from_user_id="..."` 这一行，确认对应自己刚发的消息后，将该精确字符串替换进 `config.json` 的 `shared.allowedUserIds`，然后重启 Bridge。
 
 在 POSIX 主机上，Bridge 会把 `config.json`、`~/.wechat-ai-bridge/token.json` 权限设为 `0600`，把 `~/.wechat-ai-bridge/` 和入站 `files/` 目录权限设为 `0700`，并拒绝这些私有路径使用符号链接。Windows 部署还应通过本机 ACL 限制这些路径。
 
```
