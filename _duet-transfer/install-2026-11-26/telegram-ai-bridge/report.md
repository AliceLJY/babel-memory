# telegram-ai-bridge README 实测（2026-11-26）

检查对象：AliceLJY/telegram-ai-bridge main 最新提交 1d242ac（2026-11-19）。
环境：云端 Ubuntu 24.04（Linux x86_64），Node v22.23.5 / npm 10.9.9，Bun 1.4.4，Python 3.13.18，tmux 有，`codex` 没有。每个仓用临时空 HOME 跑，不碰真实账号。

**结论：走通，无需改。**

（这个仓 11-24 没改过，不在「顺带验证」之列。）

### 逐步命令和结果
1. `git clone … && cd telegram-ai-bridge`：成功（README 写了克隆、写了 Bun 前置要求）。
2. `bun install` → `135 packages installed`。
3. `bun run setup --backend claude`：交互向导，README 特意提醒要单独跑。在 tmux 里逐个回答：Owner ID 填假值 `111222333`，bot token 填格式对的假值，其他全部回车用默认值。最后 `Saved config to <仓库>/config.json`，退出码 0。
4. `bun run check --backend claude` → `[check] ok`，另有两条 warning：`~/.claude` 下没有登录状态；`claude CLI not found (<HOME>/.local/bin/claude)`。README 自己写了「check 只验格式、假 token 也会通过」，和实际一致。
5. `bun run start --backend claude`：
   ```
   [start] backend=claude source=config.json
   [TG] setMyCommands failed: Network request for 'setMyCommands' failed! (403: Forbidden (agent proxy: …))
   Telegram-AI-Bridge 启动中...
     实例后端: claude
   ```
   进程起来了，连 Telegram 时被云端网络拦下。之后需要真 Telegram bot 和已登录的 Claude Code，**云端未验证**。
6. 测试 `bun test`：**176 条全过（37 个文件）**。

### 卡点
无需要改 README 的卡点。两个小观察，没改：
- 向导的「Working directory」默认是 HOME，不是仓库目录，回车即可，不算卡点。
- `check` 说 `claude CLI not found (~/.local/bin/claude)`，但云端 `PATH` 里其实有 `claude`（不在那个固定路径）。这是代码怎么找 CLI 的问题，不是文档问题；README 已说明 check 不保证 CLI 可用。

### 最终走到哪
装好、向导写出配置、校验通过、测试全过；停在连 Telegram 那一步。**走通，无需改。**
