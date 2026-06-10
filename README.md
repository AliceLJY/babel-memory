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
npm install jieba-wasm          # Chinese (highest quality)
npm install @sglkc/kuromoji     # Japanese (highest quality)
npm install wordcut             # Thai
npm install snowball-stemmers   # 20 European languages (German, French, Spanish, Russian, etc.)
npm install tinyld              # auto-detect Latin-script languages (de/fr/es/...)
```

**You only pay for what you use.** The core package has zero dependencies — language packs are loaded lazily at runtime. And thanks to the built-in **Intl.Segmenter tier** (ICU dictionaries shipped with Node 16+/Bun/Deno/browsers), a zero-dependency install already gets **word-level segmentation** for Chinese, Japanese and Thai — installing the packs upgrades quality further. It never crashes.

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

// 4. ⚠️ CRITICAL: apply the SAME tokenization to your queries.
// Tokenization only matches when index side and query side agree:
const ftsQuery = tokenizeForFts(userQuery, detectLanguage(userQuery));
// store side:  "机器学习很有趣" → "机器 学习 很 有趣"  (indexed)
// query side:  "机器学习"       → "机器 学习"          (matches!)
// forgetting this = querying one giant token "机器学习" against
// segmented text = zero results. This is THE classic FTS pre-tokenization trap.

// 5. Get language-matched prompts for LLM calls
const { system, userTemplate } = getKgPrompt("zh"); // → Chinese prompt
getKgPrompt("ja"); // → native Japanese prompt
getKgPrompt("ko"); // → English prompt (instructions in a third language hurt quality)
// Predicates stay English (normalized keys) in every variant

// 6. Optional power tools
import { detectLanguageDetailed, detectLanguageExtended, getLoadedTokenizers } from "babel-memory";

detectLanguageDetailed("我在用 TypeScript 写 hook");
// → { language: "en", scripts: { cjk: 0.38, latin: 0.62, ... }, isMixed: true }
// AI conversation logs mix CN/EN constantly — isMixed tells you when.
// (Embedded CJK runs are segmented automatically either way; see below.)

detectLanguageExtended("Das ist ein guter Tag");
// → "de" when tinyld is installed; "en" otherwise (graceful degrade)

tokenizeForFts("机器学习的应用", "zh", { removeStopwords: true });
// → "机器 学习 应用"  (的 removed; opt-in, default off)

getLoadedTokenizers(); // → ["jieba", "kuromoji", "tinyld"] — verify deployment

// Selective init when you don't need everything (kuromoji alone = ~1-2s + ~17MB):
await initTokenizer({ languages: ["zh", "de"] });
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

### Measured: the gap is not subtle

`bun bench/recall-benchmark.ts` — SQLite FTS5, 20 Chinese documents, 12 queries:

| Tier | Recall | Queries returning nothing |
|------|--------|---------------------------|
| raw text (what most memory systems do) | **0.0%** | 12/12 |
| zero-dependency tier (Intl.Segmenter + bigrams) | **100%** | 0/12 |
| full tier (jieba) | **100%** | 0/12 |

Raw Chinese text in a whitespace FTS engine doesn't degrade — it **fails completely**. Every single query returns empty.

### Mixed-script text (the AI-conversation reality)

Real agent conversations constantly mix languages: *"I fixed 机器学习模型 using TensorFlow"*. Ratio-based detection classifies this as `en` — and the Chinese island used to pass through unsegmented and unsearchable. Now `tokenizeForFts(text, "en")` detects embedded CJK/Hangul/Thai runs and routes each run to its proper tokenizer while Latin parts stay untouched. Use `detectLanguageDetailed()` if you want the mixing signal explicitly.

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

babel-memory **never crashes** due to a missing optional package. Each language has a *three-tier* fallback chain — and since v2.1 the middle tier (ICU via `Intl.Segmenter`, built into Node 16+/Bun/Deno) gives zero-dependency installs word-level quality:

| Language | Tier 1: package installed | Tier 2: zero deps (built-in ICU) | Tier 3: last resort |
|----------|---------------------------|----------------------------------|---------------------|
| Chinese | jieba search-mode segmentation | ICU word segmentation + CJK bigrams | Character split |
| Japanese | kuromoji segmentation | ICU word segmentation + CJK bigrams | Character split |
| Thai | wordcut segmentation | ICU word segmentation | Passthrough |
| European (de, fr, es...) | Snowball stemming | Passthrough | Passthrough |
| Korean | — | Syllable-level split (deliberate: see note) | Same |
| Arabic, Russian | Snowball stemming | Passthrough | Passthrough |
| Hindi | — | Passthrough (space-delimited) | Same |
| English | — | Passthrough | Same |

> **Why bigrams?** ICU emits whole compounds ("東京タワー" as one token), which breaks partial-match queries like "タワー". CJK tokens of length ≥ 3 get bigram expansion on both index and query side — the same approach lunr-languages uses.
>
> **Why is Korean syllable-level?** Korean is agglutinative: "프로젝트는" = "프로젝트" + topic particle. Word-level tokens make the query "프로젝트" miss entirely; syllable split keeps BM25 partial matching stable.

A warning is logged once per missing package so you know what to install for better quality. Your application keeps working regardless.

## API Reference

| Function | Input | Output | Description |
|----------|-------|--------|-------------|
| `detectLanguage(text)` | `string` | `Language` | Unicode script ratio analysis. Detects zh, ja, ko, th, ar, hi, ru, en. Zero dependencies. |
| `detectLanguageDetailed(text)` | `string` | `LanguageDetail` | Same + per-script ratios and `isMixed` flag for mixed-script text. |
| `detectLanguageExtended(text)` | `string` | `string` | Refines Latin-script text to de/fr/es/... when `tinyld` is installed; otherwise identical to `detectLanguage`. |
| `initTokenizer(opts?)` | `{ languages?: string[] }` | `Promise<void>` | Load available tokenizers in parallel. Pass `languages` to load selectively. Idempotent, non-fatal. |
| `tokenizeForFts(text, lang, opts?)` | `string, string, { removeStopwords? }` | `string` | NFKC-normalize, then pre-tokenize for BM25. Apply to **both** indexed text and queries. |
| `getLoadedTokenizers()` | — | `string[]` | Diagnostic: which optional packs are actually loaded. |
| `segmentWithIntl(text, locale)` | `string, string` | `string \| null` | Raw ICU word segmentation building block. `null` when unavailable. |
| `intlWithBigrams(text, locale)` | `string, string` | `string \| null` | ICU segmentation + CJK bigram expansion (what the zh/ja fallback uses). |
| `getKgPrompt(lang)` | `string` | `{ system, userTemplate }` | KG triple extraction prompt. zh → Chinese, ja → Japanese, others → English. |
| `getSessionPrompt(lang)` | `string` | `{ system, dimensionLabels }` | Session summary prompt, same language routing. 9 structured dimensions. |

**Type:** `Language = "zh" | "ja" | "ko" | "th" | "ar" | "hi" | "ru" | "en"`

`tokenizeForFts` also accepts any Snowball language code (e.g., `"de"`, `"fr"`, `"es"`) as a string.

> **Note on script-based detection limits:** `detectLanguage` cannot distinguish languages that share the Latin alphabet — German, French and Spanish all return `"en"`. That's why `detectLanguageExtended` + the optional `tinyld` pack exist: install it and Latin-script languages resolve automatically, completing the auto-detect → Snowball stemming chain. Traditional Chinese note: ICU and jieba both handle zh-Hant text, but jieba's dictionary is Simplified-centric; for mixed Simplified/Traditional corpora consider normalizing externally (OpenCC) before indexing.

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

With the optional `tinyld` pack installed, `detectLanguageExtended()` auto-detects the Latin-script languages too — closing the loop so all 27+ become reachable without the caller knowing the language up front.

## Who Is This For

- **AI memory system builders** — if you're building on LanceDB, ChromaDB, or any vector+BM25 hybrid store
- **RAG pipeline developers** — if your users speak non-English languages and BM25 returns empty
- **MCP server authors** — if your memory tools need multilingual support
- **Anyone** who's noticed their AI agent "forgets" non-English conversations

## Compared to Alternatives

Most AI memory / RAG systems treat tokenization as solved. They're not wrong — for English. For the rest of the world:

| | babel-memory | mem0 | Letta | Raw LanceDB FTS |
|---|---|---|---|---|
| CJK word segmentation | jieba / kuromoji, ICU built-in fallback | None | None | Character bigrams |
| Zero-install CJK quality | **Word-level** (Intl.Segmenter + bigrams) | — | — | Character bigrams |
| Mixed CN/EN text | Script-run routing | None | None | None |
| European stemming | Snowball (20 langs) | None | None | None |
| Language detection | 8 scripts + optional tinyld (62 langs) | None | None | None |
| Language-matched LLM prompts | EN + ZH + JA | English only | English only | N/A |
| Required dependencies | **0** | Heavy | Heavy | N/A |
| Works with any FTS engine | Tantivy, SQLite FTS5, ES, Meilisearch | Locked in | Locked in | LanceDB only |
| Measured Chinese BM25 recall | 100% (vs 0% raw — see bench/) | unmeasured | unmeasured | partial |

babel-memory is **not** a memory system — it's a preprocessing layer that makes any memory system work properly across languages.

## Used By

- [RecallNest](https://github.com/AliceLJY/recallnest) — MCP-native shared memory for Claude Code, Codex, and Gemini CLI

## Research References

This library is informed by findings from:
- MMTEB: Massive Multilingual Text Embedding Benchmark (arXiv 2502.13595)
- XRAG: Cross-lingual Retrieval-Augmented Generation (arXiv 2505.10089)
- MIT: Tokenization Changes Meaning in LLMs (Computational Linguistics, 2025)

## License

MIT
