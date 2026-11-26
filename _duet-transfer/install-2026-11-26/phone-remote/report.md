# phone-remote README 实测（2026-11-26）

检查对象：AliceLJY/phone-remote main 最新提交 a6fda9d（2026-10-19）。
环境：云端 Ubuntu 24.04（Linux x86_64），Node v22.23.5 / npm 10.9.9，Bun 1.4.4，Python 3.13.18，tmux 有，`codex` 没有。每个仓用临时空 HOME 跑，不碰真实账号。

**结论：只有 macOS 能装，Linux 上能起服务，补 4 处。**

（这个仓 11-24 没改过，不在「顺带验证」之列。）

### 逐步命令和结果
1. 照字面 `git clone https://github.com/<you>/phone-remote.git ~/Projects/phone-remote`：`bash: line 1: you: No such file or directory`——`<you>` 被 shell 当成输入重定向，命令根本没执行（卡点 1）。换成 `AliceLJY` 后克隆成功。
2. `./install.sh`：先打印 repo / node / label（`com.example.phone-remote`），然后 `mktemp: too few X's in template 'pr_launcher'` 退出——这是 macOS 写法，后面还要 `clang`、`codesign`、`launchctl`。**需要 macOS，云端未验证**。README 没写只能在 macOS 上装、要 Xcode Command Line Tools（脚本里自己会检查 `clang`）（卡点 2）。
3. 前台跑 `node server.js`：
   ```
   phone-remote 已启动
     手机访问: http://<本机IP>:8787/?t=<token>
     局域网也可用 vm:8787
   ```
   `.token` 自动生成，权限 `-rw-------`。但服务实际只听 `127.0.0.1`（代码默认值），日志却叫你用局域网地址访问，README 安装一节也只写了「会打印手机地址」（卡点 3）。地址里的 `<本机IP>` 是没装 Tailscale 时原样打出来的占位符（卡点 4）。
4. 本机 curl：`/health` → `{"ok":true}`；`POST /key` 不带 token → 401；带 token、`{"action":"enter"}` → `{"error":"spawn osascript ENOENT"}`（没有 macOS 的 osascript，符合预期）；`/launch` 传不在白名单的 `nope` → `{"error":"unknown app: nope"}`。
5. 辅助功能授权、`launchctl kickstart`、手机打开、加到主屏幕：**需要 macOS 和手机，云端未验证**。README 里的 `launchctl kickstart -k gui/$(id -u)/<label>` 也是占位符，陌生人不知道 label 是什么（卡点 5）。
6. 仓里没有测试，CI 只做 `node --check server.js`；本地跑了一遍，通过。

### 卡点
1. **克隆地址是占位符 `<you>`，照抄会被 shell 当重定向**。→ 改动 1（换成真实地址）。
2. **没写平台和前置要求**：只能在 macOS 13+ 上装（Info.plist 里写的最低 13.0），要 Node 和 Xcode Command Line Tools。→ 改动 1。
3. **前台 `node server.js` 默认只听本机，手机连不上**；Security 一节写了要设 `HOST`，安装一节没提。另外 `install.sh` 写的 LaunchAgent 也没设 `HOST`，后台服务同样只听本机——README 没说给后台服务怎么设 `HOST`，这是读脚本得出的，没在 Mac 上验证；补丁只把事实写明，怎么让 LaunchAgent 开放给手机请 CC 定。→ 改动 2。
4. **没 Tailscale 时地址里是 `<本机IP>` 占位符**。→ 改动 4。
5. **`<label>` 占位符**：默认 label 是 `com.example.phone-remote`（`install.sh` 的 `PR_LABEL` 默认值）。→ 改动 3。`install.sh` 结束时自己打印的提示里也是 `<label>`，那是脚本，不在只改文档的范围内，没动。

### 最终走到哪
克隆成功；服务在 Linux 上能起、token 校验和白名单生效；真正发按键和装 `.app` 要 macOS，没走。

### 改动和卡点对应
- 改动 1（两份 README「Install / 安装」开头加平台要求，克隆地址换成 AliceLJY）↔ 卡点 1、2
- 改动 2（「node server.js」代码块改成两行并加一段说明）↔ 卡点 3
- 改动 3（`launchctl kickstart` 那句写出默认 label）↔ 卡点 5
- 改动 4（「Use it from the phone / 手机端怎么用」地址示例后加一句）↔ 卡点 4

### 补丁（`git diff`，中英两份 README；同目录 readme.patch 是同一份，可直接 `git apply`）

```diff
diff --git a/README.md b/README.md
index 7da931e..2f6d81a 100644
--- a/README.md
+++ b/README.md
@@ -43,8 +43,12 @@ same setup works on iPhone and Android side by side.
 
 ## Install
 
+Requires macOS 13+, Node.js on your `PATH`, and Xcode Command Line Tools
+(`install.sh` compiles the wrapper with `clang` and signs it with `codesign`;
+install them with `xcode-select --install`). It does not run on Linux.
+
 ```bash
-git clone https://github.com/<you>/phone-remote.git ~/Projects/phone-remote
+git clone https://github.com/AliceLJY/phone-remote.git ~/Projects/phone-remote
 cd ~/Projects/phone-remote
 ./install.sh
 ```
@@ -56,9 +60,13 @@ Zero npm dependencies — Node's standard library only.
 To run it in the foreground instead:
 
 ```bash
-node server.js     # prints the tokenized phone URL
+node server.js                 # listens on 127.0.0.1 only: the phone can't reach it yet
+HOST=0.0.0.0 node server.js    # reachable from the LAN / Tailscale (see Security)
 ```
 
+Both print the tokenized phone URL. The LaunchAgent that `install.sh` writes
+sets no `HOST`, so the background service also listens on `127.0.0.1` only.
+
 ### One manual step: Accessibility
 
 Synthesizing keystrokes requires Accessibility permission, which macOS grants
@@ -67,7 +75,8 @@ per executable:
 > System Settings → Privacy & Security → Accessibility → **+** → Applications →
 > **Phone Remote** → toggle on
 
-Then `launchctl kickstart -k gui/$(id -u)/<label>`. Until this is granted,
+Then `launchctl kickstart -k gui/$(id -u)/com.example.phone-remote` (the default
+label; use your own if you ran `install.sh` with `PR_LABEL=...`). Until this is granted,
 `/type` and `/key` return a `not allowed to send keystrokes (1002)` error.
 
 **Why the .app wrapper**: macOS grants Accessibility per executable. If launchd
@@ -84,6 +93,9 @@ The startup log (`~/ops-logs/phone-remote/stdout.log`) prints a tokenized URL:
 http://100.x.y.z:8787/?t=<token>
 ```
 
+The IP comes from `tailscale ip -4`; without Tailscale it prints a literal
+`<本机IP>` ("this machine's IP") placeholder, so put in the Mac's LAN IP yourself.
+
 Open it on the phone (over Tailscale, or `<your-mac>.local:8787` on the same
 LAN), then **Add to Home Screen** — it becomes a full-screen app that carries
 its own token, indistinguishable from a native one.
diff --git a/README_CN.md b/README_CN.md
index ecbbf7d..d0df830 100644
--- a/README_CN.md
+++ b/README_CN.md
@@ -37,8 +37,12 @@ phone-remote 绕开这条路——不做跨会话转发，而是**在目标 Mac
 
 ## 安装
 
+需要 macOS 13+、`PATH` 里有 Node.js，以及 Xcode Command Line Tools（`install.sh`
+用 `clang` 编译包装器、用 `codesign` 签名；没有的话先跑 `xcode-select --install`）。
+Linux 上跑不了。
+
 ```bash
-git clone https://github.com/<你>/phone-remote.git ~/Projects/phone-remote
+git clone https://github.com/AliceLJY/phone-remote.git ~/Projects/phone-remote
 cd ~/Projects/phone-remote
 ./install.sh
 ```
@@ -49,16 +53,21 @@ LaunchAgent（开机自启、崩溃自动重启）并启动服务。零 npm 依
 想前台跑：
 
 ```bash
-node server.js     # 会打印带 token 的手机访问地址
+node server.js                 # 只听 127.0.0.1：这时手机还连不上
+HOST=0.0.0.0 node server.js    # 局域网 / Tailscale 可达（先看「安全」一节）
 ```
 
+两种都会打印带 token 的手机访问地址。`install.sh` 写的 LaunchAgent 没有设
+`HOST`，所以后台服务同样只听 `127.0.0.1`。
+
 ### 唯一需要手动点一次的：辅助功能授权
 
 合成键盘事件需要「辅助功能」权限，macOS 是**按可执行文件**授权的：
 
 > 系统设置 → 隐私与安全性 → 辅助功能 → **+** → 应用程序 → **Phone Remote** → 打开开关
 
-然后 `launchctl kickstart -k gui/$(id -u)/<label>` 重启一下。没授权之前，
+然后 `launchctl kickstart -k gui/$(id -u)/com.example.phone-remote` 重启一下（这是默认
+label；如果跑 `install.sh` 时设了 `PR_LABEL=...`，换成你自己的）。没授权之前，
 `/type` 和 `/key` 会返回 `不允许发送按键 (1002)`。
 
 **为什么要包一层 .app**：macOS 按可执行文件授权，若 launchd 直接指
@@ -74,6 +83,8 @@ node server.js     # 会打印带 token 的手机访问地址
 http://100.x.y.z:8787/?t=<token>
 ```
 
+IP 取自 `tailscale ip -4`；没装 Tailscale 时会原样打印占位符 `<本机IP>`，需要自己换成 Mac 的局域网 IP。
+
 手机上打开它（走 Tailscale，或同一局域网用 `<your-mac>.local:8787`），然后
 **添加到主屏幕**——就成了一个全屏 App，token 带在里面，点开即用。
 
```
