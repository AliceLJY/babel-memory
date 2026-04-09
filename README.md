<div align="center">

# babel-memory

**The first standalone library fixing the multilingual blind spot in AI memory systems.**

*27+ languages. Zero required dependencies. Drop-in fix for BM25 + RAG.*

> *Not affiliated with Babel.js. Named after the Tower of Babel — breaking the language barrier in AI agent memory.*

[![npm](https://img.shields.io/npm/v/babel-memory)](https://www.npmjs.com/package/babel-memory)
[![npm downloads](https://img.shields.io/npm/dm/babel-memory)](https://www.npmjs.com/package/babel-memory)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/AliceLJY/babel-memory?style=social)](https://github.com/AliceLJY/babel-memory)
[![Languages](https://img.shields.io/badge/Languages-27+-orange)](https://github.com/AliceLJY/babel-memory)
[![Dependencies](https://img.shields.io/badge/Required_deps-0-brightgreen)](https://github.com/AliceLJY/babel-memory)

**English** | [简体中文](README_CN.md)

</div>

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

**babel-memory is the fix for layers 2-4.** Same simple API. Zero required dependencies. Install only the language packs you need.

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

```
BEFORE babel-memory (European):
  Store: "Maschinelles Lernen verbessert die Verarbeitung"
  BM25 search("Verarbeitung") → [match]
  BM25 search("verarbeitet") → [] (different form, zero results)

AFTER babel-memory + snowball-stemmers:
  Store: "Maschinelles Lernen verbessert die Verarbeitung"
         → fts_text: "maschinell lern verbess verarbeit"
  BM25 search("verarbeitet") → stem("verarbeitet") = "verarbeit" → [match found!]
```

## Modular Install

```bash
# Core only (zero dependencies — pure TypeScript)
npm install babel-memory

# Add language packs as needed:
npm install jieba-wasm          # Chinese
npm install @sglkc/kuromoji     # Japanese
npm install wordcut             # Thai
npm install snowball-stemmers   # 20 European languages (German, French, Spanish, Russian, etc.)
```

**You only pay for what you use.** The core package has zero dependencies — language packs are loaded lazily at runtime. If a package isn't installed, babel-memory gracefully falls back to a simpler strategy (character-level split or passthrough). It never crashes.

## Quick Start

```typescript
import { detectLanguage, initTokenizer, tokenizeForFts, getKgPrompt } from "babel-memory";

// 1. Initialize once at startup (loads whichever packages are installed)
await initTokenizer();

// 2. Detect language (zero dependencies, pure Unicode analysis)
detectLanguage("这个项目的架构设计非常优秀");  // "zh"
detectLanguage("東京タワーはとても高いです");    // "ja" (not "zh" — hiragana detected first)
detectLanguage("이 프로젝트는 매우 훌륭합니다"); // "ko"
detectLanguage("สวัสดีครับ");                    // "th"
detectLanguage("مرحبا بالعالم");                 // "ar"
detectLanguage("Машинное обучение");              // "ru"

// 3. Pre-tokenize for BM25 (the core fix)
tokenizeForFts("机器学习很有趣", "zh");
// → "机器 学习 很 有趣"  (jieba word segmentation)

tokenizeForFts("東京タワー", "ja");
// → "東京 タワー"  (kuromoji word segmentation)

tokenizeForFts("Maschinelles Lernen", "de");
// → "maschinell lern"  (Snowball stemming)

// 4. Get bilingual prompts for LLM calls
const { system, userTemplate } = getKgPrompt("zh");
// system → "你是知识图谱提取助手..."
// Predicates stay English (normalized keys), examples are bilingual
```

## How It Works

The key insight: **pre-tokenize non-whitespace-delimited text before FTS indexing, and stem inflected languages.**

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
3. Thai script? → Thai
4. Arabic script? → Arabic
5. Devanagari? → Hindi
6. Cyrillic? → Russian
7. CJK Ideographs without Japanese/Korean markers? → Chinese
8. Default → English

## Graceful Degradation

babel-memory **never crashes** due to a missing optional package. Each language has a fallback chain:

| Language | With package installed | Without package |
|----------|----------------------|-----------------|
| Chinese | jieba word segmentation | Character-level CJK split |
| Japanese | kuromoji word segmentation | Character-level CJK + kana split |
| Thai | wordcut segmentation | Passthrough |
| European (de, fr, es...) | Snowball stemming | Passthrough |
| Korean | Character-level split | Character-level split (no extra package needed) |
| Arabic, Hindi, Russian | Auto-detected | Passthrough (Snowball stemming available for ar, ru) |
| English | Passthrough | Passthrough |

A warning is logged once per missing package so you know what to install for better quality. Your application keeps working regardless.

## API Reference

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `detectLanguage(text)` | `string` | `Language` | Unicode script ratio analysis. Detects zh, ja, ko, th, ar, hi, ru, en. Zero dependencies. |
| `initTokenizer()` | — | `Promise<void>` | Load all available tokenizers in parallel. Call once. Idempotent. Non-fatal if any fail. |
| `tokenizeForFts(text, lang)` | `string, string` | `string` | Pre-tokenize for BM25. Routes by language to the appropriate strategy. |
| `getKgPrompt(lang)` | `string` | `{ system, userTemplate }` | Bilingual KG triple extraction prompt. `{text}` placeholder in template. |
| `getSessionPrompt(lang)` | `string` | `{ system, dimensionLabels }` | Bilingual session summary prompt. 9 structured dimensions. |

**Type:** `Language = "zh" | "ja" | "ko" | "th" | "ar" | "hi" | "ru" | "en"`

`tokenizeForFts` also accepts any Snowball language code (e.g., `"de"`, `"fr"`, `"es"`) as a string.

## Supported Languages

### Auto-Detected (via `detectLanguage`)

| Code | Language | Script | FTS Strategy | Package |
|------|----------|--------|-------------|---------|
| `zh` | Chinese | CJK Ideographs | jieba search-mode word segmentation | `jieba-wasm` |
| `ja` | Japanese | Hiragana + Katakana + CJK | kuromoji word segmentation | `@sglkc/kuromoji` |
| `ko` | Korean | Hangul + CJK | Character-level split | (built-in) |
| `th` | Thai | Thai script | wordcut segmentation | `wordcut` |
| `ar` | Arabic | Arabic script | Snowball stemming | `snowball-stemmers` |
| `hi` | Hindi | Devanagari | Passthrough | (none) |
| `ru` | Russian | Cyrillic | Snowball stemming | `snowball-stemmers` |
| `en` | English | Latin | Passthrough | (none) |

### Snowball-Stemmed Languages (pass code to `tokenizeForFts`)

| Code | Language | Code | Language |
|------|----------|------|----------|
| `de` | German | `nl` | Dutch |
| `fr` | French | `sv` | Swedish |
| `es` | Spanish | `no` | Norwegian |
| `pt` | Portuguese | `da` | Danish |
| `it` | Italian | `fi` | Finnish |
| `hu` | Hungarian | `tr` | Turkish |
| `ro` | Romanian | `cs` | Czech |

Total: **8 auto-detected + 14 explicit Snowball = 27+ languages** (Arabic and Russian appear in both lists).

## Who Is This For

- **AI memory system builders** — if you're building on LanceDB, ChromaDB, or any vector+BM25 hybrid store
- **RAG pipeline developers** — if your users speak non-English languages and BM25 returns empty
- **MCP server authors** — if your memory tools need multilingual support
- **Anyone** who's noticed their AI agent "forgets" non-English conversations

## Compared to Alternatives

Most AI memory / RAG systems treat tokenization as solved. They're not wrong — for English. For the rest of the world:

| | babel-memory | mem0 | Letta | Raw LanceDB FTS |
|---|---|---|---|---|
| CJK word segmentation | jieba / kuromoji | None | None | Character bigrams |
| European stemming | Snowball (20 langs) | None | None | None |
| Language detection | 8 script systems | None | None | None |
| Bilingual KG prompts | EN + CJK | English only | English only | N/A |
| Required dependencies | **0** | Heavy | Heavy | N/A |
| Works with any FTS engine | Tantivy, SQLite FTS5, ES, Meilisearch | Locked in | Locked in | LanceDB only |

babel-memory is **not** a memory system — it's a preprocessing layer that makes any memory system work properly across languages.

## Used By

- [RecallNest](https://github.com/AliceLJY/recallnest) — MCP-native shared memory for Claude Code, Codex, and Gemini CLI
- [UltraMemory](https://github.com/win4r/UltraMemory) — Universal AI agent long-term memory engine ([integration PR](https://github.com/win4r/UltraMemory/pull/14))

## Research References

This library is informed by findings from:
- MMTEB: Massive Multilingual Text Embedding Benchmark (arXiv 2502.13595)
- XRAG: Cross-lingual Retrieval-Augmented Generation (arXiv 2505.10089)
- MIT: Tokenization Changes Meaning in LLMs (Computational Linguistics, 2025)

## License

MIT
