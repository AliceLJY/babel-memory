# Changelog

## 2.1.2 (2026-08-13)

### Fixed

- `wordcut` is now an explicit Thai quality upgrade instead of an automatically installed optional dependency. Default installs use the existing `Intl.Segmenter` Thai fallback and no longer inherit `glob`, `inflight`, `body`, or `raw-body` from `wordcut`.
- A missing `wordcut` package no longer emits an inaccurate character-level fallback warning. Environments without both `wordcut` and `Intl.Segmenter` still receive a passthrough warning.

## 2.1.1 (2026-08-13)

### Fixed

- Snowball-backed tokenizers now normalize case and punctuation boundaries consistently across indexing and querying.
- Added a CJK index/query symmetry regression test so tokenizer changes cannot silently split stored text and queries differently.
- Packaging CI now rejects bundled optional dependencies and publishing-machine path leaks, and uses current official GitHub Actions.

### Changed

- Knowledge-graph extraction prompts now use a discrete five-level confidence rubric in all three supported prompt languages.
- Documentation and migration examples now match the behavior of the mixed-script fallback path, including low-ratio embedded CJK text.

## 2.1.0 (2026-06-11)

### Fixed

- **Critical ([#1](https://github.com/AliceLJY/babel-memory/issues/1)): optional tokenizers never loaded on any machine but the build machine.** The 2.0.0 `dist` (1MB) inlined the optional dependencies' source *including hardcoded absolute paths from the publishing machine*, so jieba-wasm / kuromoji silently fell back to character-level on every other computer — Windows, Linux, and other Macs alike. 2.1.0 builds with explicit `--external` for all optional deps (dist is now ~20KB); they resolve dynamically from the user's `node_modules` at runtime. CI now guards against path leaks and re-inlining. Thanks @mrqx0195 for the excellent report.
- **Packaging**: `dist` was ESM-only with no `"type"` declaration and no `exports` map — `require('babel-memory')` crashed on Node < 22.12, and `import` triggered a double-parse warning on every Node. Now ships dual ESM (`dist/index.js`) + CJS (`dist/index.cjs`) builds with a proper `exports` map, `files`, and `engines` (`node >= 18`).
- **Thai without `wordcut`** no longer degrades to passthrough (one giant token = zero BM25 matches); it now falls back to ICU word segmentation.
- **Digit runs** are no longer dropped by the Intl fallback path (ICU marks them non-word-like under some locales).

### Added

- **Intl.Segmenter middle fallback tier** — zero-dependency installs now get *word-level* segmentation for Chinese, Japanese and Thai via the runtime's built-in ICU dictionaries (previously: per-character split / passthrough). Long CJK compounds are expanded with bigrams so partial queries like `タワー` still match `東京タワー` (same approach as lunr-languages, same multi-granularity philosophy as jieba's `cut_for_search`).
- **Mixed-script routing** — text classified as `en` that embeds CJK/Hangul/Thai runs (the norm in AI conversation logs: *"I fixed 机器学习模型 yesterday"*) now has those runs segmented instead of passing through as unsearchable blobs.
- `detectLanguageDetailed()` — per-script ratios + `isMixed` flag.
- `detectLanguageExtended()` + optional **tinyld** integration (5th optional dependency) — refines Latin-script text into `de`/`fr`/`es`/... so Snowball stemming becomes reachable via auto-detection. Without tinyld it behaves exactly like `detectLanguage()`.
- **NFKC normalization** at the `tokenizeForFts` entry: fullwidth Latin/digits fold to ASCII, halfwidth katakana folds to fullwidth — the same folding ES/Lucene ICU analyzers apply.
- **Stopword removal (opt-in)**: `tokenizeForFts(text, lang, { removeStopwords: true })` with built-in minimal zh/ja/en tables.
- `initTokenizer({ languages: [...] })` — selective loading (kuromoji alone costs ~1-2s + ~17MB; skip it if you only need Chinese).
- `getLoadedTokenizers()` diagnostic.
- `segmentWithIntl()` / `intlWithBigrams()` exported as building blocks.
- **Japanese prompts**: `getKgPrompt("ja")` / `getSessionPrompt("ja")` now return native Japanese templates.
- **CI**: bun test, Node 18/20/22 CJS+ESM smoke, and a zero-optional-deps job exercising the entire fallback chain.
- **Benchmark** (`bun bench/recall-benchmark.ts`): SQLite FTS5, 20 Chinese docs / 12 queries — raw text scores **0% recall (12/12 queries return nothing)**; both the zero-dep Intl tier and jieba tier score 100%.

### Changed

- **`getKgPrompt("ko")` / `getSessionPrompt("ko")` now return the English template** (previously the Chinese one — a prompt in an unrelated third language hurt extraction quality for Korean content).
- `tokenizeForFts` output for fullwidth characters changed (NFKC folding). Re-index for consistency if your corpus contains fullwidth forms.

### ⚠️ Migration: re-index existing FTS data

If you indexed documents with **2.0.0 on any machine other than the publishing machine**, your stored `fts_text` for Chinese/Japanese is character-level (or raw, if the hook wasn't active) because of the issue #1 path bug — while 2.1.0 queries produce word-level tokens (+bigrams). Old index and new queries share almost no tokens, so Chinese BM25 recall on old rows collapses. **Rebuild the FTS field with 2.1.0's `tokenizeForFts` over your corpus.** Hybrid (vector+BM25) stores degrade more gracefully — the vector path is unaffected — but the BM25 contribution still needs the rebuild. The NFKC change above folds into the same re-index pass.

### Notes

- Korean stays deliberately syllable-level: Korean is agglutinative ("프로젝트는" = "프로젝트" + topic particle), so word-level tokens break BM25 partial matching. Syllable split keeps recall stable.

## 2.0.0 (2026-04-09)

- Lazy-load tokenizer architecture: kuromoji (ja), wordcut (th), snowball-stemmers (20 European languages).
- `detectLanguage` expanded to Thai, Arabic, Hindi, Russian.
- Zero required dependencies; all tokenizers optional.

## 1.0.0 (2026-04-09)

- Initial release: jieba-wasm Chinese segmentation, language detection, bilingual KG/session prompts.
