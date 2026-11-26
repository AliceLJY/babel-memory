# trio-handoff README 实测（2026-11-26）

检查对象：AliceLJY/trio-handoff main 最新提交 070edf2（2026-11-24）。
环境：云端 Ubuntu 24.04（Linux x86_64），Node v22.23.5 / npm 10.9.9，Bun 1.4.4，Python 3.13.18，tmux 有，`codex` 没有。每个仓用临时空 HOME 跑，不碰真实账号。

**结论：走通，补 2 处说明。**

**11-24 那次改动有没有用：有用。** 11-24 的提交是「写包前先建输出目录」（改代码 + 新测试，不是 README）。上一轮在没有 `~/Desktop` 的 HOME 里第一条命令直接 `FileNotFoundError`，这次同样条件下正常生成，`~/Desktop` 被自动建出来。

### 逐步命令和结果
1. 拿代码：README「Usage」直接从 `./trio-handoff.py` 开始，没写克隆（卡点 1）。我按常识 `git clone` 后 `cd trio-handoff`。
2. 准备假数据：在临时 HOME 的 `~/.claude/projects/-demo/` 放一份自己编的 Claude 会话（一次 Read、一次 Edit、一条 Bash、一段 thinking），配一个改过文件的临时 git 仓库。
3. `./trio-handoff.py`（HOME 里没有 Desktop）：
   ```
   方向: cc-to-codex
     首条输入: Please tidy calc.py add() and add a docstring.
   交接包已生成: <HOME>/Desktop/trio-handoff-cc2cx-065144.md
     goal 1 | examined 1 | external 0 | commands 1 | changed 1 | repos 1 | diff 有
   ⚠️  发出前务必手填 Caller Declaration（尤其 rejected alternatives）——空着这套交接白做。
   ```
   退出码 0。交接包开头是 `## Review 指令` 加一整段中文，thinking 内容没出现。
4. `./trio-handoff.py --check <包>`：Caller Declaration 空着，列出 9 个未填字段，退出码 1，符合 README。
5. `./trio-handoff.py --version` → `trio-handoff.py 2.5.0`。
6. 自带测试 `python3 -m unittest discover -s tests`：**6 条全过**（上轮 4 条，多的 2 条是 11-24 加的输出目录测试）。

### 卡点
1. **没写怎么拿到代码**。原文：「Usage」第一行就是 `./trio-handoff.py`。实际：陌生人不知道要先克隆、进哪个目录。绕法：自己 `git clone`。→ 改动 1。
2. **README 全英文，工具输出全中文**。原文：README 用英文引了一段 review instruction。实际：终端提示、`--help`、`--check` 提示和交接包正文都是中文。绕法：无，只是对不上。→ 改动 2（顺带写明 Desktop 会自动建）。

### 最终走到哪
生成交接包、`--check`、版本号、全部测试都跑通。没测 `codex-to-cc` 方向（上轮测过，这次 11-24 的改动不涉及）和 `--include-subagents`（没有现成子代理日志样本）。没有把包交给另一个模型审阅（要账号）。

### 改动和卡点对应
- 改动 1（两份 README「Usage / 用法」开头加克隆两行）↔ 卡点 1
- 改动 2（两份 README「Output is a Markdown bundle / 输出是一个 Markdown 交接包」那段）↔ 卡点 2

### 补丁（`git diff`，中英两份 README；同目录 readme.patch 是同一份，可直接 `git apply`）

```diff
diff --git a/README.md b/README.md
index d0af5ab..f569184 100644
--- a/README.md
+++ b/README.md
@@ -45,6 +45,15 @@ Same bundle structure; only the extractor differs — because the two agents obs
 
 ## Usage
 
+Get the script first (no install step, standard library only):
+
+```bash
+git clone https://github.com/AliceLJY/trio-handoff.git
+cd trio-handoff
+```
+
+Then run it from that directory:
+
 ```bash
 ./trio-handoff.py                          # latest Claude session -> bundle for Codex
 ./trio-handoff.py --direction codex-to-cc  # latest Codex rollout -> bundle for CC
@@ -60,7 +69,7 @@ Same bundle structure; only the extractor differs — because the two agents obs
 
 "Latest session" is picked by the **timestamp inside the JSONL**, not file mtime (bridge/patch processes batch-refresh mtimes, making them a lottery), and Claude sessions are searched across **all** `~/.claude/projects/*/` subdirectories (sessions scatter by cwd). After picking, the tool prints the session's first user message so you can eyeball that it grabbed the right one — if not, rerun with an explicit source path. If extraction yields nothing (wrong source, format drift), the tool refuses to emit a hollow bundle.
 
-Output is a Markdown bundle (default in `~/Desktop/`). **Fill in the Caller Declaration before sending**, then run `--check` on the bundle — it exits non-zero while `rejected alternatives` is still blank. Hand the path to the reviewing agent — it reads the bundle for guidance and can drill down into the raw log path at the bottom to verify any claim, so it never has to trust the compression blindly.
+Output is a Markdown bundle (default in `~/Desktop/`, created if missing). The terminal messages, `--help` text and the bundle body are written in Chinese; the section names (Objective Evidence, Caller Declaration, field names) stay in English. **Fill in the Caller Declaration before sending**, then run `--check` on the bundle — it exits non-zero while `rejected alternatives` is still blank. Hand the path to the reviewing agent — it reads the bundle for guidance and can drill down into the raw log path at the bottom to verify any claim, so it never has to trust the compression blindly.
 
 The bundle opens with a review instruction:
 
diff --git a/README_CN.md b/README_CN.md
index 72d2fca..c34926b 100644
--- a/README_CN.md
+++ b/README_CN.md
@@ -45,6 +45,15 @@ Claude 的 `thinking` 和 Codex 的 `reasoning` 按设计排除。隐藏的思
 
 ## 用法
 
+先拿到脚本(不用安装,只用标准库):
+
+```bash
+git clone https://github.com/AliceLJY/trio-handoff.git
+cd trio-handoff
+```
+
+然后在这个目录里运行:
+
 ```bash
 ./trio-handoff.py                          # 最近的 Claude 会话 -> 给 Codex 的包
 ./trio-handoff.py --direction codex-to-cc  # 最近的 Codex rollout -> 给 CC 的包
@@ -60,7 +69,7 @@ Claude 的 `thinking` 和 Codex 的 `reasoning` 按设计排除。隐藏的思
 
 "最近的会话"按 **JSONL 内部时间戳**选取而不是文件 mtime(bridge / patch 进程会批量刷新 mtime,让 mtime 排序退化成抽签),且 Claude 会话扫描覆盖 `~/.claude/projects/*/` **全部**子目录(session 按 cwd 散落)。选源后会打印该会话的首条用户输入,让你一眼核对抓对了没有——不对就显式传 source 路径重跑。抽取结果为空时(选错源 / 格式漂移)拒绝生成空壳包。
 
-输出是一个 Markdown 交接包(默认在 `~/Desktop/`)。**发出去之前先填好 Caller Declaration**,然后对包跑一次 `--check`——`rejected alternatives` 还空着时它会以非零码退出。把路径交给负责 review 的 agent——它读这个包作为导览,也能下钻到文末的原始日志路径核实任何一条,不必盲信压缩。
+输出是一个 Markdown 交接包(默认在 `~/Desktop/`,目录不存在会自动建)。终端提示、`--help` 和交接包正文都是中文;段落名(Objective Evidence、Caller Declaration 和各字段名)保留英文。**发出去之前先填好 Caller Declaration**,然后对包跑一次 `--check`——`rejected alternatives` 还空着时它会以非零码退出。把路径交给负责 review 的 agent——它读这个包作为导览,也能下钻到文末的原始日志路径核实任何一条,不必盲信压缩。
 
 交接包开头带一句 review 指令:
 
```
