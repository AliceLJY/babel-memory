# babel-memory

**The first standalone library fixing the multilingual blind spot in AI memory systems.**

> *Not affiliated with Babel.js. Named after the Tower of Babel — breaking the language barrier in AI agent memory.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/babel-memory)](https://www.npmjs.com/package/babel-memory)

---

## Why This Exists

Every major AI memory / RAG system today — mem0, Letta, LanceDB-based stores — **silently fails on non-English content**. Research across 8 academic papers (MMTEB, XRAG, MIT 2025) reveals a systematic **5-layer semantic loss cascade**:

| Layer | What Breaks | Impact |
|-------|-------------|--------|
| Token estimation | `string.length / 4` underestimates CJK by **4-8x** | Context overflow |
| BM25 tokenization | Whitespace split on Chinese = **0 matches** | Hybrid search degrades to vector-only |
| LLM extraction | English-only KG/summary prompts | **-24% factual accuracy** on non-English |
| Cross-lingual retrieval | Query/document language mismatch | **-56% recall** (XRAG benchmark) |
| Auto-evaluation | LLM-as-Judge overestimates non-English quality | Problems go **systematically unreported** |

**babel-memory is the fix for layers 2-4.** Three functions. One `npm install`. Zero config.

## Before & After

```
BEFORE babel-memory:
  Store: "机器学习在自然语言处理中的应用"
  BM25 search("机器学习") → [] (zero results)
  KG extract → English prompt struggles with Chinese entities
  
AFTER babel-memory:
  Store: "机器学习在自然语言处理中的应用"
         → fts_text: "机器 学习 机器学习 自然 语言 处理 自然语言 应用"
  BM25 search("机器学习") → [match found!]
  KG extract → Chinese prompt with CJK few-shot examples
```

## Install

```bash
npm install babel-memory
# or
bun add babel-memory
```

~2MB total (jieba-wasm). Zero native compilation. Works everywhere.

## Quick Start

```typescript
import { detectLanguage, initTokenizer, tokenizeForFts, getKgPrompt } from "babel-memory";

// 1. Initialize once at startup
await initTokenizer();

// 2. Detect language (zero dependencies, pure Unicode analysis)
detectLanguage("这个项目的架构设计非常优秀");  // "zh"
detectLanguage("東京タワーはとても高いです");    // "ja" (not "zh" — hiragana detected first)
detectLanguage("이 프로젝트는 매우 훌륭합니다"); // "ko"

// 3. Pre-tokenize for BM25 (the core fix)
tokenizeForFts("机器学习很有趣", "zh");
// → "机器 学习 很 有趣"  (jieba word segmentation)

tokenizeForFts("東京タワー", "ja");
// → "東 京 タ ワ ー"  (character-level split)

// 4. Get bilingual prompts for LLM calls
const { system, userTemplate } = getKgPrompt("zh");
// system → "你是知识图谱提取助手..."
// Predicates stay English (normalized keys), examples are bilingual
```

## How It Works

The key insight: **pre-tokenize CJK text before FTS indexing**.

```
Standard FTS pipeline (broken for Chinese):
  "知识图谱提取" → whitespace split → ["知识图谱提取"] → 1 giant token → no matches

babel-memory pipeline (fixed):
  "知识图谱提取" → jieba segmentation → "知识 图谱 知识图谱 提取" → whitespace split → 4 tokens → matches!
```

This works with **any** whitespace-based FTS engine: Tantivy (LanceDB), SQLite FTS5, Elasticsearch, Meilisearch. No engine modifications needed.

### Detection Order Matters

Japanese uses kanji (CJK characters). Naive CJK detection would misclassify Japanese as Chinese. babel-memory checks **language-unique scripts first**:

1. Hiragana/Katakana present? → Japanese (unique to Japanese)
2. Hangul present? → Korean (unique to Korean)  
3. CJK Ideographs without Japanese/Korean markers? → Chinese
4. Default → English

## API Reference

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `detectLanguage(text)` | `string` | `"zh" \| "ja" \| "ko" \| "en"` | Unicode script ratio analysis. Zero dependencies. |
| `initTokenizer()` | — | `Promise<void>` | Load jieba-wasm. Call once. Idempotent. |
| `tokenizeForFts(text, lang)` | `string, string` | `string` | Pre-tokenize for BM25. Chinese=jieba, Ja/Ko=char-split, En=passthrough. |
| `getKgPrompt(lang)` | `string` | `{ system, userTemplate }` | Bilingual KG triple extraction prompt. `{text}` placeholder. |
| `getSessionPrompt(lang)` | `string` | `{ system, dimensionLabels }` | Bilingual session summary prompt. 9 structured dimensions. |

## Supported Languages

| Code | Language | FTS Strategy | Quality |
|------|----------|-------------|---------|
| `zh` | Chinese | jieba search-mode (word-level, overlapping) | Production |
| `ja` | Japanese | Character-level CJK + kana split | Functional (lindera planned) |
| `ko` | Korean | Character-level hangul + CJK split | Functional (mecab-ko planned) |
| `en` | English | Passthrough (no preprocessing) | Native |

Architecture is extensible — Arabic, Hindi, Thai support planned.

## Who Is This For

- **AI memory system builders** — if you're building on LanceDB, ChromaDB, or any vector+BM25 hybrid store
- **RAG pipeline developers** — if your users speak CJK languages and BM25 returns empty
- **MCP server authors** — if your memory tools need multilingual support
- **Anyone** who's noticed their AI agent "forgets" non-English conversations

## Used By

- [RecallNest](https://github.com/AliceLJY/recallnest) — MCP-native memory system (first integration)

## Research References

This library is informed by findings from:
- MMTEB: Massive Multilingual Text Embedding Benchmark (arXiv 2502.13595)
- XRAG: Cross-lingual Retrieval-Augmented Generation (arXiv 2505.10089)
- MIT: Tokenization Changes Meaning in LLMs (Computational Linguistics, 2025)

## License

MIT
