# babel-memory

**首个专门解决 AI 记忆系统多语言盲区的独立工具库。**

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

**babel-memory 修复了第 2-4 层。** 三个函数，一行 `npm install`，零配置。

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

## 安装

```bash
npm install babel-memory
# 或
bun add babel-memory
```

总大小约 2MB（jieba-wasm），零原生编译，跨平台运行。

## 快速上手

```typescript
import { detectLanguage, initTokenizer, tokenizeForFts, getKgPrompt } from "babel-memory";

// 1. 启动时初始化一次
await initTokenizer();

// 2. 检测语言（零依赖，纯 Unicode 分析）
detectLanguage("这个项目的架构设计非常优秀");  // "zh"
detectLanguage("東京タワーはとても高いです");    // "ja"（不会误判为中文——先检测到假名）
detectLanguage("이 프로젝트는 매우 훌륭합니다"); // "ko"

// 3. BM25 预分词（核心修复）
tokenizeForFts("机器学习很有趣", "zh");
// → "机器 学习 很 有趣"  （jieba 词级分词）

tokenizeForFts("東京タワー", "ja");
// → "東 京 タ ワ ー"  （字符级切分）

// 4. 获取双语 LLM prompt
const { system, userTemplate } = getKgPrompt("zh");
// system → "你是知识图谱提取助手..."
// 谓词保持英文（规范化 key），示例为双语
```

## 工作原理

核心思路：**在 FTS 索引之前，对 CJK 文本做预分词。**

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
3. CJK 表意文字但无日韩标记？→ 中文
4. 默认 → 英文

## API 参考

| 函数 | 输入 | 输出 | 说明 |
|------|------|------|------|
| `detectLanguage(text)` | `string` | `"zh" \| "ja" \| "ko" \| "en"` | 基于 Unicode 字符比例分析，零依赖 |
| `initTokenizer()` | — | `Promise<void>` | 加载 jieba-wasm，调用一次即可，幂等 |
| `tokenizeForFts(text, lang)` | `string, string` | `string` | BM25 预分词。中文=jieba 词级，日韩=字符级，英文=原样 |
| `getKgPrompt(lang)` | `string` | `{ system, userTemplate }` | 双语知识图谱三元组提取 prompt，含 `{text}` 占位符 |
| `getSessionPrompt(lang)` | `string` | `{ system, dimensionLabels }` | 双语会话总结 prompt，9 个结构化维度 |

## 支持的语言

| 代码 | 语言 | FTS 分词策略 | 成熟度 |
|------|------|-------------|--------|
| `zh` | 中文 | jieba 搜索模式（词级，含重叠分词） | 生产可用 |
| `ja` | 日文 | CJK 汉字 + 假名字符级切分 | 可用（计划接入 lindera） |
| `ko` | 韩文 | 谚文 + CJK 汉字字符级切分 | 可用（计划接入 mecab-ko） |
| `en` | 英文 | 直接返回（无需预处理） | 原生 |

架构支持扩展——阿拉伯语、印地语、泰语支持已在规划中。

## 适用场景

- **AI 记忆系统开发者** — 在 LanceDB、ChromaDB 或任何向量+BM25 混合存储上构建
- **RAG 管线开发者** — 用户说中日韩语但 BM25 搜不到东西
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
