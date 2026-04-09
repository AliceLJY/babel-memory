# babel-memory

面向 AI 记忆系统的多语言预处理库 -- 填补 AI Agent 记忆的多语言空白。

*与 Babel.js 无关。这是一个独立的 AI 记忆多语言预处理库。*

## 问题背景

大多数 AI 记忆和 RAG 系统都假定输入文本是英文。当遇到中文、日文、韩文（CJK）内容时，系统在每一层都会出现问题：

1. **Token 估算** -- 基于空格的计数器会将 CJK 文本低估 2-5 倍
2. **分词** -- BM25/FTS 引擎按空格切分，导致整句中文被当作一个 token
3. **检索** -- BM25 搜索对中文查询返回零结果，因为没有 token 能匹配
4. **推理** -- 纯英文的提取 prompt 降低了 LLM 对 CJK 输入的输出质量
5. **评估** -- 当 prompt 语言与内容语言不匹配时，会话总结丢失语义细节

这就是 **5 层语义损失级联**：每一层都在悄悄降级，等到你注意到时，记忆系统对非英文内容已经近乎失明。

babel-memory 通过三个聚焦的工具解决了第 2-5 层的问题：语言检测、FTS 预分词、双语 prompt 模板。

## 安装

```bash
npm install babel-memory
# 或
bun add babel-memory
```

## 快速上手

### 语言检测

```typescript
import { detectLanguage } from "babel-memory";

detectLanguage("今天的会议讨论了新的架构方案");  // "zh"
detectLanguage("今日のミーティングで新しい設計を議論した");  // "ja"
detectLanguage("오늘 회의에서 새로운 아키텍처를 논의했습니다");  // "ko"
detectLanguage("We discussed the new architecture today");  // "en"
```

### FTS 分词

```typescript
import { initTokenizer, tokenizeForFts } from "babel-memory";

// 初始化 jieba-wasm（启动时调用一次）
await initTokenizer();

// 中文：jieba 搜索模式分词
tokenizeForFts("知识图谱提取", "zh");
// → "知识 图谱 知识图谱 提取"

// 日文：字符级切分
tokenizeForFts("新しい設計", "ja");
// → "新 し い 設 計"

// 英文：直接返回
tokenizeForFts("knowledge graph", "en");
// → "knowledge graph"
```

### 获取双语 Prompt

```typescript
import { getKgPrompt, getSessionPrompt } from "babel-memory";

// 知识图谱提取 prompt（中文版）
const kg = getKgPrompt("zh");
// kg.system → "你是知识图谱提取助手..."
// kg.userTemplate → 包含 {text} 占位符的模板

// 会话总结 prompt（英文版）
const session = getSessionPrompt("en");
// session.system → "You are a session summarizer..."
// session.dimensionLabels → { user_intent: "User intent and requests", ... }
```

## API 参考

| 函数 | 参数 | 返回值 | 说明 |
|---|---|---|---|
| `detectLanguage` | `text: string` | `"zh" \| "ja" \| "ko" \| "en"` | 通过 Unicode 脚本分析检测主要语言 |
| `initTokenizer` | 无 | `Promise<void>` | 初始化 jieba-wasm，启动时调用一次，幂等 |
| `tokenizeForFts` | `text: string, language: string` | `string` | 为 BM25 FTS 索引预分词 |
| `getKgPrompt` | `lang: string` | `KgPrompt` | 获取双语知识图谱提取 prompt |
| `getSessionPrompt` | `lang: string` | `SessionPrompt` | 获取双语会话总结 prompt |

## 支持的语言

| 代码 | 语言 | 分词策略 |
|---|---|---|
| `zh` | 中文 | jieba 搜索模式分词 |
| `ja` | 日文 | 字符级切分（CJK 汉字 + 假名） |
| `ko` | 韩文 | 字符级切分（谚文 + CJK 汉字） |
| `en` | 英文 | 直接返回（无需预处理） |

## 工作原理

标准 FTS 引擎（SQLite FTS5、Tantivy 等）通过空格和标点切分文本进行分词。这对英文有效，但对 CJK 语言无效，因为 CJK 语言的词与词之间没有空格分隔。

babel-memory 采用 **预分词** 方案：

```
中文输入:     "知识图谱提取"
                   ↓ jieba 分词
预分词结果:   "知识 图谱 知识图谱 提取"
                   ↓ 标准 FTS 分词器
FTS tokens:   ["知识", "图谱", "知识图谱", "提取"]
```

通过在索引 *之前* 在语义单元之间插入空格，任何基于空格的 FTS 引擎都能正确索引和搜索 CJK 文本。jieba 的搜索模式会生成重叠分词以提高召回率（例如同时索引 "知识" 和 "知识图谱"）。

对于日文和韩文，采用字符级切分作为轻量替代方案，无需语言专用词典即可提供合理的召回率。

## 许可证

MIT
