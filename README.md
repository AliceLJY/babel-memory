# babel-memory

Language-aware preprocessing for AI memory systems -- fixing the multilingual gap in AI agent memory.

*Not affiliated with Babel.js. This is a standalone library for multilingual AI memory preprocessing.*

## The Problem

Most AI memory and RAG systems assume English-like text. When they encounter Chinese, Japanese, or Korean (CJK) content, things break at every layer:

1. **Token estimation** -- whitespace-based counters undercount CJK text by 2-5x
2. **Tokenization** -- BM25/FTS engines split on whitespace, producing entire Chinese sentences as single tokens
3. **Retrieval** -- BM25 search returns zero results for CJK queries because no tokens match
4. **Reasoning** -- English-only extraction prompts degrade LLM output quality on CJK input
5. **Evaluation** -- session summaries lose nuance when the prompt language mismatches the content

This is the **5-layer semantic loss cascade**: each layer silently degrades, and by the time you notice, your memory system is effectively blind to non-English content.

babel-memory solves layers 2-5 with three focused utilities: language detection, FTS pre-tokenization, and bilingual prompt templates.

## Install

```bash
npm install babel-memory
# or
bun add babel-memory
```

## Quick Start

### Detect Language

```typescript
import { detectLanguage } from "babel-memory";

detectLanguage("今天的会议讨论了新的架构方案");  // "zh"
detectLanguage("今日のミーティングで新しい設計を議論した");  // "ja"
detectLanguage("오늘 회의에서 새로운 아키텍처를 논의했습니다");  // "ko"
detectLanguage("We discussed the new architecture today");  // "en"
```

### Tokenize for FTS

```typescript
import { initTokenizer, tokenizeForFts } from "babel-memory";

// Initialize jieba-wasm (call once at startup)
await initTokenizer();

// Chinese: jieba word segmentation
tokenizeForFts("知识图谱提取", "zh");
// → "知识 图谱 知识图谱 提取"

// Japanese: character-level split
tokenizeForFts("新しい設計", "ja");
// → "新 し い 設 計"

// English: passthrough
tokenizeForFts("knowledge graph", "en");
// → "knowledge graph"
```

### Get Bilingual Prompts

```typescript
import { getKgPrompt, getSessionPrompt } from "babel-memory";

// Knowledge graph extraction prompt (Chinese)
const kg = getKgPrompt("zh");
// kg.system → "你是知识图谱提取助手..."
// kg.userTemplate → template with {text} placeholder

// Session summary prompt (English)
const session = getSessionPrompt("en");
// session.system → "You are a session summarizer..."
// session.dimensionLabels → { user_intent: "User intent and requests", ... }
```

## API Reference

| Function | Parameters | Returns | Description |
|---|---|---|---|
| `detectLanguage` | `text: string` | `"zh" \| "ja" \| "ko" \| "en"` | Detect dominant language via Unicode script analysis |
| `initTokenizer` | none | `Promise<void>` | Initialize jieba-wasm. Call once at startup. Idempotent. |
| `tokenizeForFts` | `text: string, language: string` | `string` | Pre-tokenize text for BM25 FTS indexing |
| `getKgPrompt` | `lang: string` | `KgPrompt` | Get bilingual knowledge graph extraction prompt |
| `getSessionPrompt` | `lang: string` | `SessionPrompt` | Get bilingual session summary prompt |

## Supported Languages

| Code | Language | Tokenization Strategy |
|---|---|---|
| `zh` | Chinese | jieba search-mode word segmentation |
| `ja` | Japanese | Character-level split (CJK + kana) |
| `ko` | Korean | Character-level split (hangul + CJK) |
| `en` | English | Passthrough (no preprocessing needed) |

## How It Works

Standard FTS engines (SQLite FTS5, Tantivy, etc.) tokenize text by splitting on whitespace and punctuation. This works for English but fails for CJK languages where words are not separated by spaces.

babel-memory uses a **pre-tokenization** approach:

```
Chinese input:  "知识图谱提取"
                     ↓ jieba word segmentation
Pre-tokenized:  "知识 图谱 知识图谱 提取"
                     ↓ standard FTS tokenizer
FTS tokens:     ["知识", "图谱", "知识图谱", "提取"]
```

By inserting spaces between semantic units *before* indexing, any whitespace-based FTS engine can correctly index and search CJK text. jieba's search mode produces overlapping segments for better recall (e.g., both "知识" and "知识图谱" are indexed).

For Japanese and Korean, character-level splitting is used as a lightweight alternative that provides reasonable recall without requiring language-specific dictionaries.

## License

MIT
