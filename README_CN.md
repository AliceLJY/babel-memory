<div align="center">

# babel-memory

**首个专门解决 AI 记忆系统多语言盲区的独立工具库。**

*22 个受支持语言代码。零必需依赖。BM25 + RAG 的即插即用预处理层。*

> *与 Babel.js 无关。以巴别塔命名——打破 AI Agent 记忆的语言壁垒。*

[![npm](https://img.shields.io/npm/v/babel-memory)](https://www.npmjs.com/package/babel-memory)
[![npm downloads](https://img.shields.io/npm/dm/babel-memory)](https://www.npmjs.com/package/babel-memory)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/AliceLJY/babel-memory?style=social)](https://github.com/AliceLJY/babel-memory)
[![Languages](https://img.shields.io/badge/Language_codes-22-orange)](https://github.com/AliceLJY/babel-memory)
[![Dependencies](https://img.shields.io/badge/Required_deps-0-brightgreen)](https://github.com/AliceLJY/babel-memory)

[English](README.md) | **简体中文**

</div>

---

## 为什么需要这个库

依赖空格切词的检索管线，在不以空格分隔词语的语言上经常损失召回。综合 8 篇学术论文（MMTEB、XRAG、MIT 2025）的研究结果，可以看到一条更广泛的 **5 层语义损失级联**：

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
npm install jieba-wasm          # 中文（最高质量）
npm install @sglkc/kuromoji     # 日文（最高质量）
npm install wordcut             # 泰文
npm install snowball-stemmers   # 本库当前可用的 16 个映射算法
npm install tinyld              # 拉丁字母语言自动检测（de/fr/es/...）
```

**用什么装什么。** 核心包零依赖——语言包在运行时懒加载。而且得益于内置的 **Intl.Segmenter 层**（Node 16+/Bun/Deno/浏览器自带的 ICU 词典），零依赖安装就已经能获得中文、日文、泰文的**词级分词**——安装语言包则进一步提升质量。绝不会崩溃。

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

// 4. ⚠️ 关键：查询侧必须做同样的分词处理。
// 分词只有在索引侧和查询侧一致时才能匹配：
const ftsQuery = tokenizeForFts(userQuery, detectLanguage(userQuery));
// 存储侧:  "机器学习很有趣" → "机器 学习 很 有趣"  （已索引）
// 查询侧:  "机器学习"       → "机器 学习"          （命中！）
// 忘记这一步 = 拿整串 "机器学习" 去匹配分词后的文本 = 零结果。
// 这是 FTS 预分词方案最经典的坑。

// 5. 获取语言匹配的 LLM prompt
const { system, userTemplate } = getKgPrompt("zh"); // → 中文 prompt
getKgPrompt("ja"); // → 日语原生 prompt
getKgPrompt("ko"); // → 英文 prompt（用无关第三语言写指令会伤害质量）
// 所有变体中谓词都保持英文（规范化 key）

// 6. 进阶工具
import { detectLanguageDetailed, detectLanguageExtended, getLoadedTokenizers } from "babel-memory";

detectLanguageDetailed("我在用 TypeScript 给 RecallNest 写 tokenizer hook");
// → { language: "en", scripts: { cjk: 0.13, latin: 0.83, ... }, isMixed: true }
// AI 对话里中英混排是常态——isMixed 告诉你何时发生。
// 需要分词的文字系统（CJK/泰文）从约 2% 占比起就标记混排：
// 哪怕一小段中文岛不分词也是搜不到的。
// （无论如何，嵌入的中文片段都会被自动分词，见下文。）

detectLanguageExtended("Das ist ein guter Tag");
// → 装了 tinyld 时返回 "de"；未装时返回 "en"（优雅降级）

tokenizeForFts("机器学习的应用", "zh", { removeStopwords: true });
// → "机器 学习 应用"  （"的"被移除；opt-in，默认关闭）

getLoadedTokenizers(); // → ["jieba", "kuromoji", "tinyld"] — 验证部署配置

// 按需加载（kuromoji 单独就要 ~1-2s + ~17MB 内存）：
await initTokenizer({ languages: ["zh", "de"] });
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

### 小型确定性 smoke benchmark

`bun bench/recall-benchmark.ts` — SQLite FTS5，20 条中文文档，12 个查询：

| 档位 | 召回率 | 零命中查询数 |
|------|--------|-------------|
| 原始文本（多数记忆系统的现状） | **0.0%** | 12/12 |
| 零依赖档（Intl.Segmenter + bigram） | **100%** | 0/12 |
| 完整档（jieba） | **100%** | 0/12 |

在这组固定的 20 篇中文文档 / 12 个查询 fixture 上，原始文本没有返回结果，两档预处理都召回了预期文档。它用于防回归，不代表普遍检索质量。

### 混排文本（AI 对话的真实形态）

真实的 Agent 对话大量中英混排：*"I fixed 机器学习模型 using TensorFlow"*。按字符比例检测会依占比落到 `zh` 或 `en`——现在两条路都能正确处理混排：`zh` 路径的分词器会原样保留英文 token，`en` 路径会探测内嵌的中文/谚文/泰文片段并把每段路由给对应分词器。v2.1 之前，被判成 `en` 的文本里的中文岛会原样穿过、无法搜索。需要显式的混排信号时用 `detectLanguageDetailed()`。

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

babel-memory **绝不会**因缺少可选包而崩溃。每种语言都有**三档**降级链——v2.1 起中间档（运行时内置的 ICU `Intl.Segmenter`）让零依赖安装也有词级质量：

| 语言 | 第一档：已装语言包 | 第二档：零依赖（内置 ICU） | 第三档：兜底 |
|------|-------------------|---------------------------|-------------|
| 中文 | jieba 搜索模式分词 | ICU 词级分词 + CJK bigram | 字符切分 |
| 日文 | kuromoji 分词 | ICU 词级分词 + CJK bigram | 字符切分 |
| 泰文 | wordcut 分词 | ICU 词级分词 | 原样返回 |
| 欧洲语言（德、法、西...） | Snowball 词干提取 | 原样返回 | 原样返回 |
| 韩文 | — | 音节级切分（刻意设计，见下） | 同左 |
| 阿拉伯语、俄语 | Snowball 词干提取 | 原样返回 | 原样返回 |
| 印地语 | — | 原样返回（天城文带空格） | 同左 |
| 英文 | — | 原样返回 | 同左 |

> **为什么要 bigram？** ICU 会把复合词整词输出（"東京タワー"是一个 token），部分匹配查询"タワー"就失配了。长度 ≥ 3 的 CJK token 在索引侧和查询侧都做 bigram 扩展——与 lunr-languages 的做法一致。
>
> **韩文为什么是音节级？** 韩语是黏着语："프로젝트는" = "프로젝트" + 主题助词。词级 token 会让查询"프로젝트"完全失配；音节切分让 BM25 部分匹配保持稳定。

每个缺失的包只会输出一次警告日志，让你知道安装什么可以获得更好的质量。应用程序始终正常运行。

## API 参考

| 函数 | 输入 | 输出 | 说明 |
|------|------|------|------|
| `detectLanguage(text)` | `string` | `Language` | 基于 Unicode 字符比例分析。检测 zh、ja、ko、th、ar、hi、ru、en，零依赖。 |
| `detectLanguageDetailed(text)` | `string` | `LanguageDetail` | 同上 + 各文字系统占比和混排标志 `isMixed`。 |
| `detectLanguageExtended(text)` | `string` | `string` | 装了 `tinyld` 时把拉丁字母文本细分为 de/fr/es/...；未装时等同 `detectLanguage`。 |
| `initTokenizer(opts?)` | `{ languages?: string[] }` | `Promise<void>` | 并行加载分词器。传 `languages` 可按需加载。幂等，加载失败不影响整体。 |
| `tokenizeForFts(text, lang, opts?)` | `string, string, { removeStopwords? }` | `string` | 先 NFKC 归一化，再 BM25 预分词。**索引侧和查询侧都要调用**。 |
| `getLoadedTokenizers()` | — | `string[]` | 诊断：当前实际加载了哪些可选包。 |
| `segmentWithIntl(text, locale)` | `string, string` | `string \| null` | 原始 ICU 词级分词构件。不可用时返回 `null`。 |
| `intlWithBigrams(text, locale)` | `string, string` | `string \| null` | ICU 分词 + CJK bigram 扩展（zh/ja 降级路径用的就是它）。 |
| `getKgPrompt(lang)` | `string` | `{ system, userTemplate }` | KG 三元组提取 prompt。zh → 中文，ja → 日语，其余 → 英文。 |
| `getSessionPrompt(lang)` | `string` | `{ system, dimensionLabels }` | 会话总结 prompt，同样的语言路由，9 个结构化维度。 |

**类型：** `Language = "zh" | "ja" | "ko" | "th" | "ar" | "hi" | "ru" | "en"`

`tokenizeForFts` 也接受任何 Snowball 语言代码（如 `"de"`、`"fr"`、`"es"`）作为字符串参数。

> **关于 script 检测的局限**：`detectLanguage` 无法区分共用拉丁字母的语言——德语、法语、西班牙语都会返回 `"en"`。这正是 `detectLanguageExtended` + 可选包 `tinyld` 存在的意义：装上它，拉丁字母语言就能自动识别，补全"自动检测 → Snowball 词干提取"的闭环。繁体中文说明：ICU 和 jieba 都能处理繁体文本，但 jieba 词典以简体为主；简繁混合语料建议先用外部工具（OpenCC）归一化再索引。

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

总计：**22 个不同的受支持语言代码**：8 个自动检测代码，加 14 个额外显式 Snowball 代码；阿拉伯语和俄语已经包含在前 8 个中。

装上可选包 `tinyld` 后，`detectLanguageExtended()` 可以把本库支持的拉丁字母语言路由到对应 Snowball 算法，调用方无需预先传代码。

## 适用场景

- **AI 记忆系统开发者** — 在 LanceDB、ChromaDB 或任何向量+BM25 混合存储上构建
- **RAG 管线开发者** — 用户说非英语但 BM25 搜不到东西
- **MCP Server 作者** — 记忆工具需要多语言支持
- **所有人** — 如果你注意到 AI Agent 会"忘记"非英文对话

## 范围与集成

| 能力 | babel-memory 提供什么 |
|---|---|
| CJK/泰语分词 | 可选 jieba / kuromoji / wordcut，并有 ICU 零依赖 fallback |
| 混排文本 | 在拉丁字母主导文本中识别并路由其他文字系统片段 |
| 词干提取 | 当前可用 16 个 Snowball 映射，其中 14 个是 8 个自动检测代码之外的额外代码 |
| 语言检测 | 8 个基于文字系统的代码，可用 tinyld 细化本库支持的拉丁字母语言 |
| 语言匹配 prompt | 英文、中文、日文 KG / session prompt |
| FTS 集成 | 输出空格分隔文本，可接 Tantivy、SQLite FTS5、Elasticsearch、Meilisearch 等引擎 |
| 必需依赖 | 0 |

babel-memory **不是**记忆系统——它是一个预处理层，让任何记忆系统都能正确处理多语言内容。

## 谁在使用

- [RecallNest](https://github.com/AliceLJY/recallnest) — MCP 原生共享记忆，服务 Claude Code、Codex 和 Gemini CLI

## 研究参考

本库的设计基于以下研究成果：
- MMTEB: 大规模多语言文本嵌入基准 (arXiv 2502.13595)
- XRAG: 跨语言检索增强生成 (arXiv 2505.10089)
- MIT: 分词如何改变 LLM 中的语义 (Computational Linguistics, 2025)

## 许可证

MIT
