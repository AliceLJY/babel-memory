# babel-memory

**首个专门解决 AI 记忆系统多语言盲区的独立工具库。支持 27+ 种语言，零必需依赖，按需安装。**

> *与 Babel.js 无关。以巴别塔命名——打破 AI Agent 记忆的语言壁垒。*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/babel-memory)](https://www.npmjs.com/package/babel-memory)

---

## 为什么需要这个库

当前所有主流 AI 记忆/RAG 系统——mem0、Letta、基于 LanceDB 的存储——**在非英文内容上都会静默失败**。综合 8 篇学术论文（MMTEB、XRAG、MIT 2025）的研究结果，我们发现了一条系统性的 **5 层语义损失级联**：

| 层级 | 出了什么问题 | 影响 |
|------|-------------|------|
| Token 估算 | `string.length / 4` 对中文低估 **4-8 倍** | 上下文溢出 |
| BM25 分词 | 按空格切分中文 = **0 个匹配** | 混合检索退化为纯向量搜索 |
| LLM 提取 | 英文 KG/摘要 prompt 处理中文 | 事实准确性**下降 24%** |
| 跨语言检索 | 查询与文档语言不匹配 | 召回率**下降 56%**（XRAG 基准） |
| 自动评估 | LLM-as-Judge 高估非英文质量 | 问题被**系统性漏报** |

**babel-memory 修复了第 2-4 层。** 相同的简洁 API，零必需依赖，按需安装语言包。

## 修复前 vs 修复后

```
修复前：
  存储: "机器学习在自然语言处理中的应用"
  BM25 搜索("机器学习") → [] （零结果）
  KG 提取 → 英文 prompt 处理中文实体，质量降级
  
修复后：
  存储: "机器学习在自然语言处理中的应用"
         → fts_text: "机器 学习 机器学习 自然 语言 处理 自然语言 应用"
  BM25 搜索("机器学习") → [命中！]
  KG 提取 → 中文 prompt + 中文 few-shot 示例，提取质量大幅提升
```

```
修复前（欧洲语言）：
  存储: "Maschinelles Lernen verbessert die Verarbeitung"
  BM25 搜索("Verarbeitung") → [命中]
  BM25 搜索("verarbeitet") → [] （词形不同，零结果）

修复后 + snowball-stemmers：
  存储: "Maschinelles Lernen verbessert die Verarbeitung"
         → fts_text: "maschinell lern verbess verarbeit"
  BM25 搜索("verarbeitet") → stem("verarbeitet") = "verarbeit" → [命中！]
```

## 模块化安装

```bash
# 仅安装核心（零依赖——纯 TypeScript）
npm install babel-memory

# 按需添加语言包：
npm install jieba-wasm          # 中文
npm install @sglkc/kuromoji     # 日文
npm install wordcut             # 泰文
npm install snowball-stemmers   # 20 种欧洲语言（德语、法语、西班牙语、俄语等）
```

**用什么装什么。** 核心包零依赖——语言包在运行时懒加载。如果某个包未安装，babel-memory 会优雅降级到更简单的策略（字符级切分或原样返回），绝不会崩溃。

## 快速上手

```typescript
import { detectLanguage, initTokenizer, tokenizeForFts, getKgPrompt } from "babel-memory";

// 1. 启动时初始化一次（加载已安装的语言包）
await initTokenizer();

// 2. 检测语言（零依赖，纯 Unicode 分析）
detectLanguage("这个项目的架构设计非常优秀");  // "zh"
detectLanguage("東京タワーはとても高いです");    // "ja"（不会误判为中文——先检测到假名）
detectLanguage("이 프로젝트는 매우 훌륭합니다"); // "ko"
detectLanguage("สวัสดีครับ");                    // "th"
detectLanguage("مرحبا بالعالم");                 // "ar"
detectLanguage("Машинное обучение");              // "ru"

// 3. BM25 预分词（核心修复）
tokenizeForFts("机器学习很有趣", "zh");
// → "机器 学习 很 有趣"  （jieba 词级分词）

tokenizeForFts("東京タワー", "ja");
// → "東京 タワー"  （kuromoji 词级分词）

tokenizeForFts("Maschinelles Lernen", "de");
// → "maschinell lern"  （Snowball 词干提取）

// 4. 获取双语 LLM prompt
const { system, userTemplate } = getKgPrompt("zh");
// system → "你是知识图谱提取助手..."
// 谓词保持英文（规范化 key），示例为双语
```

## 工作原理

核心思路：**在 FTS 索引之前，对无空格分隔的文本做预分词，对屈折语言做词干提取。**

```
标准 FTS 流程（中文不工作）:
  "知识图谱提取" → 按空格切分 → ["知识图谱提取"] → 1 个巨大 token → 搜不到

babel-memory 流程（修复）:
  "知识图谱提取" → jieba 分词 → "知识 图谱 知识图谱 提取" → 按空格切分 → 4 个 token → 命中！
```

这个方案兼容**任何**基于空格的 FTS 引擎：Tantivy（LanceDB）、SQLite FTS5、Elasticsearch、Meilisearch。无需修改引擎本身。

### 检测顺序很重要

日文使用汉字（CJK 字符）。简单的 CJK 检测会把日文误判为中文。babel-memory 优先检测**语言独有的文字系统**：

1. 检测到平假名/片假名？→ 日文（日文独有）
2. 检测到谚文？→ 韩文（韩文独有）
3. 泰文字符？→ 泰文
4. 阿拉伯文字？→ 阿拉伯语
5. 天城文？→ 印地语
6. 西里尔字母？→ 俄语
7. CJK 表意文字但无日韩标记？→ 中文
8. 默认 → 英文

## 优雅降级

babel-memory **绝不会**因缺少可选包而崩溃。每种语言都有降级链：

| 语言 | 安装了对应包 | 未安装对应包 |
|------|-------------|-------------|
| 中文 | jieba 词级分词 | 字符级 CJK 切分 |
| 日文 | kuromoji 词级分词 | 字符级 CJK + 假名切分 |
| 泰文 | wordcut 分词 | 原样返回 |
| 欧洲语言（德、法、西...） | Snowball 词干提取 | 原样返回 |
| 韩文 | 字符级切分 | 字符级切分（无需额外包） |
| 阿拉伯语、印地语、俄语 | 自动检测 | 原样返回（阿拉伯语、俄语可用 Snowball 词干提取） |
| 英文 | 原样返回 | 原样返回 |

每个缺失的包只会输出一次警告日志，让你知道安装什么可以获得更好的质量。应用程序始终正常运行。

## API 参考

| 函数 | 输入 | 输出 | 说明 |
|------|------|------|------|
| `detectLanguage(text)` | `string` | `Language` | 基于 Unicode 字符比例分析。检测 zh、ja、ko、th、ar、hi、ru、en，零依赖。 |
| `initTokenizer()` | — | `Promise<void>` | 并行加载所有已安装的分词器。调用一次即可，幂等。任何分词器加载失败不影响整体。 |
| `tokenizeForFts(text, lang)` | `string, string` | `string` | BM25 预分词。按语言路由到对应策略。 |
| `getKgPrompt(lang)` | `string` | `{ system, userTemplate }` | 双语知识图谱三元组提取 prompt，模板中含 `{text}` 占位符。 |
| `getSessionPrompt(lang)` | `string` | `{ system, dimensionLabels }` | 双语会话总结 prompt，9 个结构化维度。 |

**类型：** `Language = "zh" | "ja" | "ko" | "th" | "ar" | "hi" | "ru" | "en"`

`tokenizeForFts` 也接受任何 Snowball 语言代码（如 `"de"`、`"fr"`、`"es"`）作为字符串参数。

## 支持的语言

### 自动检测（通过 `detectLanguage`）

| 代码 | 语言 | 文字系统 | FTS 分词策略 | 所需包 |
|------|------|---------|-------------|--------|
| `zh` | 中文 | CJK 表意文字 | jieba 搜索模式词级分词 | `jieba-wasm` |
| `ja` | 日文 | 平假名 + 片假名 + CJK | kuromoji 词级分词 | `@sglkc/kuromoji` |
| `ko` | 韩文 | 谚文 + CJK | 字符级切分 | （内置） |
| `th` | 泰文 | 泰文字符 | wordcut 分词 | `wordcut` |
| `ar` | 阿拉伯语 | 阿拉伯文字 | Snowball 词干提取 | `snowball-stemmers` |
| `hi` | 印地语 | 天城文 | 原样返回 | （无） |
| `ru` | 俄语 | 西里尔字母 | Snowball 词干提取 | `snowball-stemmers` |
| `en` | 英文 | 拉丁字母 | 原样返回 | （无） |

### Snowball 词干提取语言（将语言代码传给 `tokenizeForFts`）

| 代码 | 语言 | 代码 | 语言 |
|------|------|------|------|
| `de` | 德语 | `nl` | 荷兰语 |
| `fr` | 法语 | `sv` | 瑞典语 |
| `es` | 西班牙语 | `no` | 挪威语 |
| `pt` | 葡萄牙语 | `da` | 丹麦语 |
| `it` | 意大利语 | `fi` | 芬兰语 |
| `hu` | 匈牙利语 | `tr` | 土耳其语 |
| `ro` | 罗马尼亚语 | `cs` | 捷克语 |

总计：**8 种自动检测 + 14 种显式 Snowball = 27+ 种语言**（阿拉伯语和俄语在两个列表中都有出现）。

## 适用场景

- **AI 记忆系统开发者** — 在 LanceDB、ChromaDB 或任何向量+BM25 混合存储上构建
- **RAG 管线开发者** — 用户说非英语但 BM25 搜不到东西
- **MCP Server 作者** — 记忆工具需要多语言支持
- **所有人** — 如果你注意到 AI Agent 会"忘记"非英文对话

## 谁在使用

- [RecallNest](https://github.com/AliceLJY/recallnest) — MCP 原生记忆系统（首个集成）

## 研究参考

本库的设计基于以下研究成果：
- MMTEB: 大规模多语言文本嵌入基准 (arXiv 2502.13595)
- XRAG: 跨语言检索增强生成 (arXiv 2505.10089)
- MIT: 分词如何改变 LLM 中的语义 (Computational Linguistics, 2025)

## 许可证

MIT
