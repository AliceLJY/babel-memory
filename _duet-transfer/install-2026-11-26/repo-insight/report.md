# repo-insight README 实测（2026-11-26）

检查对象：AliceLJY/repo-insight main 最新提交 baba53d（2026-11-24）。
环境：云端 Ubuntu 24.04（Linux x86_64），Node v22.23.5 / npm 10.9.9，Bun 1.4.4，Python 3.13.18，tmux 有，`codex` 没有。每个仓用临时空 HOME 跑，不碰真实账号。

**结论：两种装法都装上了，补 2 处；README.zh.md 不用改。**

**11-24 那次改动：** 改的是技能本身（阶段 7 加隐私检查），不涉及安装说明，这次安装照样能装上；改动内容本身的效果要在 Claude Code 里跑技能才能看到，云端未验证。

**三份 README：** `README.zh.md` 只有 3 行，是「中文文档已迁移到 README_CN.md」的跳转页，内容不重复，不用同步。补丁只改 `README.md` 和 `README_CN.md`。

### 逐步命令和结果
1. npx 装法：在一个空目录里跑 `npx skills add AliceLJY/repo-insight`（`skills` 1.9.0）。它识别到在 agent 里运行，自动非交互安装，结果：
   ```
   ✓ ~/proj/.agents/skills/repo-insight
     universal: Amp, Antigravity, Antigravity CLI, Cline, Codex +19 more
     symlinked: Claude Code, Eve
   ```
   东西都装进了**当前目录**（`./.claude/skills/`、`./.agents/skills/`、`./agent/skills/`、`./skills-lock.json`），`~/.claude/skills` 根本没建（卡点 1）。
2. 查 `npx skills add --help`，有 `-g`（用户级）和 `-a`（指定 agent）。在另一个空目录跑 `npx skills add AliceLJY/repo-insight -g -a claude-code` → `✓ repo-insight (copied)`，装到 `~/.claude/skills/repo-insight`，当前目录干干净净。
3. 手动装法（macOS / Linux）：`git clone … ~/repo-insight` 成功；`ln -s ~/repo-insight/skills/repo-insight ~/.claude/skills/repo-insight` 失败：`ln: failed to create symbolic link '…/.claude/skills/repo-insight': No such file or directory`（卡点 2）。先 `mkdir -p ~/.claude/skills` 再 `ln -s` 成功，链接指向的目录顶层有 `SKILL.md`。
4. Windows 那两行：没有 Windows 环境，**未验证**；补丁里加的 `if not exist … mkdir …` 是按同一个卡点类推写的，请 CC 在 Windows 上确认。
5. 「Verify」：要新开 Claude Code 会话跑 `/repo-insight`，**需要 Claude Code，云端未验证**。
6. 仓内测试 `npm test`（安全契约 lint）：`Safety contract lint passed: main skill, 2 delegated prompt templates, version 1.1.0.`，退出码 0。

### 卡点
1. **npx 装法默认装进当前目录**。原文：`npx skills add AliceLJY/repo-insight`，没说装到哪。实际：只在当时所在的文件夹生效，还会链接给它认识的一大串 agent。绕法：加 `-g -a claude-code`。→ 改动 1。另外：人在普通终端里跑时它可能会弹交互问题，我这边被识别成 agent 自动跳过了，交互流程没看到。
2. **手动装法里 `~/.claude/skills` 不存在时 `ln` 失败**。原文：直接 `ln -s`。实际：新机器上报 No such file or directory。绕法：先建目录。→ 改动 2。

### 最终走到哪
两种装法都把技能放到了 Claude Code 会读的位置，lint 通过；在 Claude Code 里实际调用没走。

### 改动和卡点对应
- 改动 1（两份 README「npx」代码块换成带 `-g -a claude-code`，下面加一段解释）↔ 卡点 1
- 改动 2（两份 README 手动装法 macOS/Linux 加 `mkdir -p`，Windows 加 `if not exist … mkdir`）↔ 卡点 2

### 补丁（`git diff`，中英两份 README；同目录 readme.patch 是同一份，可直接 `git apply`）

```diff
diff --git a/README.md b/README.md
index 58be5ac..50b097d 100644
--- a/README.md
+++ b/README.md
@@ -17,9 +17,11 @@ Compatible with [Claude Code](https://claude.ai/claude-code), [Codex](https://gi
 **npx (Recommended)**
 
 ```bash
-npx skills add AliceLJY/repo-insight
+npx skills add AliceLJY/repo-insight -g -a claude-code
 ```
 
+`-g` installs for your user (`~/.claude/skills/repo-insight`) and `-a claude-code` limits it to Claude Code. Without `-g`, `skills` installs into the **current directory** (it creates `.claude/skills/`, `.agents/skills/` and `skills-lock.json` there), so the skill only works in that folder; without `-a` it links into every agent it knows about.
+
 **Manual (Git Clone + Symlink)**
 
 The skill lives in a nested `skills/repo-insight/` directory, so clone the repo anywhere and link the inner directory into your skills folder (cloning the whole repo directly into `~/.claude/skills/` will NOT work — Claude Code expects `SKILL.md` at the top level of each skill directory):
@@ -27,10 +29,12 @@ The skill lives in a nested `skills/repo-insight/` directory, so clone the repo
 ```bash
 # macOS / Linux
 git clone https://github.com/AliceLJY/repo-insight.git ~/repo-insight
+mkdir -p ~/.claude/skills    # ln fails with "No such file or directory" if this folder doesn't exist yet
 ln -s ~/repo-insight/skills/repo-insight ~/.claude/skills/repo-insight
 
 # Windows (junction, no admin required)
 git clone https://github.com/AliceLJY/repo-insight.git %USERPROFILE%\repo-insight
+if not exist %USERPROFILE%\.claude\skills mkdir %USERPROFILE%\.claude\skills
 mklink /J %USERPROFILE%\.claude\skills\repo-insight %USERPROFILE%\repo-insight\skills\repo-insight
 ```
 
diff --git a/README_CN.md b/README_CN.md
index bd5acab..63a7580 100644
--- a/README_CN.md
+++ b/README_CN.md
@@ -15,9 +15,11 @@ AI 编码助手技能，用于开源项目深度架构分析。不止于"用了
 **npx（推荐）**
 
 ```bash
-npx skills add AliceLJY/repo-insight
+npx skills add AliceLJY/repo-insight -g -a claude-code
 ```
 
+`-g` 装到用户级（`~/.claude/skills/repo-insight`），`-a claude-code` 只装给 Claude Code。不加 `-g` 时 `skills` 会装进**当前目录**（在那里建 `.claude/skills/`、`.agents/skills/` 和 `skills-lock.json`），技能只在这个文件夹里生效；不加 `-a` 会链接进它认识的所有 agent。
+
 **手动安装（Git Clone + 软链接）**
 
 技能本体在嵌套的 `skills/repo-insight/` 目录里，所以要把仓库 clone 到任意位置后，将内层目录链接进 skills 文件夹（把整个仓库直接 clone 进 `~/.claude/skills/` 是**不行**的——Claude Code 要求每个技能目录顶层就有 `SKILL.md`）：
@@ -25,10 +27,12 @@ npx skills add AliceLJY/repo-insight
 ```bash
 # macOS / Linux
 git clone https://github.com/AliceLJY/repo-insight.git ~/repo-insight
+mkdir -p ~/.claude/skills    # 这个目录还不存在时，ln 会报 "No such file or directory"
 ln -s ~/repo-insight/skills/repo-insight ~/.claude/skills/repo-insight
 
 # Windows（junction，无需管理员权限）
 git clone https://github.com/AliceLJY/repo-insight.git %USERPROFILE%\repo-insight
+if not exist %USERPROFILE%\.claude\skills mkdir %USERPROFILE%\.claude\skills
 mklink /J %USERPROFILE%\.claude\skills\repo-insight %USERPROFILE%\repo-insight\skills\repo-insight
 ```
 
```
