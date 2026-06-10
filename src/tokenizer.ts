import type { Language } from "./detect";
import { isTinyldLoaded, loadTinyld } from "./detect";
import { getStopwords } from "./stopwords";

// ── Lazy-loaded tokenizer state ──────────────────────────────────────
let jiebaReady = false;
let cutForSearch: ((text: string, hmm?: boolean | null) => string[]) | null =
  null;

let kuromojiTokenizer: { tokenize: (t: string) => { surface_form: string }[] } | null = null;
let kuromojiReady = false;

let wordcutReady = false;
let wordcutModule: { cut: (t: string) => string } | null = null;

type SnowballStemmer = { stem: (w: string) => string };
const snowballStemmers = new Map<string, SnowballStemmer>();
let snowballFactory: ((lang: string) => SnowballStemmer) | null = null;
let snowballAvailableAlgorithms: string[] | null = null;

// Track one-time warnings so we don't spam the console
const warnedPackages = new Set<string>();
function warnOnce(pkg: string, msg: string) {
  if (!warnedPackages.has(pkg)) {
    warnedPackages.add(pkg);
    console.warn(`[babel-memory] ${msg}`);
  }
}

// ── Snowball language mapping ────────────────────────────────────────
// Maps ISO 639-1 codes to Snowball algorithm names
const SNOWBALL_LANG_MAP: Record<string, string> = {
  ar: "arabic",
  da: "danish",
  de: "german",
  el: "greek", // not available in snowball-stemmers, will fallback
  es: "spanish",
  fi: "finnish",
  fr: "french",
  hu: "hungarian",
  it: "italian",
  nl: "dutch",
  no: "norwegian",
  pl: "polish", // not available in snowball-stemmers, will fallback
  pt: "portuguese",
  ro: "romanian",
  ru: "russian",
  sv: "swedish",
  tr: "turkish",
  cs: "czech",
};

// ── Unicode character ranges ─────────────────────────────────────────
const CJK_CHAR_RE = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/;
const JA_CHAR_RE = /[\u3040-\u309F\u30A0-\u30FF]/;
const KO_CHAR_RE = /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/;

// \u2500\u2500 Intl.Segmenter middle fallback tier \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Built into Node 16+ / Bun / Deno / modern browsers (ICU dictionaries).
// Sits between the optional high-quality tokenizers and the char-split
// last resort: zero-dependency installs still get word-level tokens.
const intlSegmenters = new Map<string, Intl.Segmenter>();

/**
 * Word-segment text using the runtime's built-in ICU dictionaries.
 * Returns null when Intl.Segmenter is unavailable or produces no
 * word-like tokens, so callers can fall through to the next strategy.
 */
export function segmentWithIntl(text: string, locale: string): string | null {
  if (typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") {
    return null;
  }
  try {
    let seg = intlSegmenters.get(locale);
    if (!seg) {
      seg = new Intl.Segmenter(locale, { granularity: "word" });
      intlSegmenters.set(locale, seg);
    }
    const out: string[] = [];
    for (const s of seg.segment(text)) {
      // isWordLike alone drops digit runs in some locales (ICU marks
      // "2026" non-word-like under zh) — keep any segment containing
      // a letter or digit; only punctuation/whitespace gets filtered.
      if (s.isWordLike || /[\p{L}\p{N}]/u.test(s.segment)) {
        out.push(s.segment);
      }
    }
    return out.length > 0 ? out.join(" ") : null;
  } catch {
    return null;
  }
}

// Tokens made entirely of CJK ideographs / kana
const CJK_TOKEN_RE = /^[一-鿿㐀-䶿豈-﫿぀-ゟ゠-ヿ]+$/;

/**
 * ICU segmentation + bigram expansion for zh/ja.
 * ICU emits whole compounds ("東京タワー"), which breaks BM25 partial
 * matches (query "タワー" ≠ token "東京タワー"). Appending bigrams for
 * CJK tokens of length >= 3 restores recall — the same approach
 * lunr-languages uses, and the multi-granularity philosophy of jieba's
 * cut_for_search. Index side and query side stay symmetric.
 */
export function intlWithBigrams(text: string, locale: string): string | null {
  const segmented = segmentWithIntl(text, locale);
  if (segmented === null) return null;
  const out: string[] = [];
  for (const token of segmented.split(" ")) {
    out.push(token);
    if (token.length >= 3 && CJK_TOKEN_RE.test(token)) {
      for (let i = 0; i < token.length - 1; i++) {
        out.push(token.slice(i, i + 2));
      }
    }
  }
  return out.join(" ");
}

// ── Lazy loaders ─────────────────────────────────────────────────────

async function loadJieba(): Promise<boolean> {
  if (jiebaReady) return true;
  try {
    const mod = await import("jieba-wasm");
    cutForSearch = mod.cut_for_search;
    jiebaReady = true;
    return true;
  } catch {
    warnOnce("jieba-wasm", "jieba-wasm not available, Chinese will use character-level fallback");
    return false;
  }
}

async function loadKuromoji(): Promise<boolean> {
  if (kuromojiReady) return true;
  try {
    const mod = await import("@sglkc/kuromoji");
    const kuromoji = mod.default || mod;
    const path = await import("path");
    const dictPath = path.join(
      require.resolve("@sglkc/kuromoji"),
      "..",
      "..",
      "dict"
    );

    return new Promise<boolean>((resolve) => {
      kuromoji.builder({ dicPath: dictPath }).build(
        (err: Error | null, tokenizer: typeof kuromojiTokenizer) => {
          if (err || !tokenizer) {
            warnOnce("@sglkc/kuromoji", `kuromoji build failed: ${err?.message || "unknown error"}`);
            resolve(false);
            return;
          }
          kuromojiTokenizer = tokenizer;
          kuromojiReady = true;
          resolve(true);
        }
      );
    });
  } catch {
    warnOnce("@sglkc/kuromoji", "kuromoji not available, Japanese will use character-level fallback");
    return false;
  }
}

async function loadWordcut(): Promise<boolean> {
  if (wordcutReady) return true;
  try {
    // wordcut is CJS-only, use require
    const mod = require("wordcut");
    mod.init();
    wordcutModule = mod;
    wordcutReady = true;
    return true;
  } catch {
    warnOnce("wordcut", "wordcut not available, Thai will use character-level fallback");
    return false;
  }
}

async function loadSnowball(): Promise<boolean> {
  if (snowballFactory) return true;
  try {
    const mod = await import("snowball-stemmers");
    snowballFactory = mod.newStemmer;
    snowballAvailableAlgorithms = mod.algorithms();
    return true;
  } catch {
    warnOnce("snowball-stemmers", "snowball-stemmers not available, European languages will use passthrough");
    return false;
  }
}

function getSnowballStemmer(lang: string): SnowballStemmer | null {
  const algoName = SNOWBALL_LANG_MAP[lang];
  if (!algoName) return null;

  // Check cache
  const cached = snowballStemmers.get(algoName);
  if (cached) return cached;

  if (!snowballFactory) {
    // Try synchronous load as fallback
    try {
      const mod = require("snowball-stemmers");
      snowballFactory = mod.newStemmer;
      snowballAvailableAlgorithms = mod.algorithms();
    } catch {
      return null;
    }
  }

  // Check if algorithm is available
  if (snowballAvailableAlgorithms && !snowballAvailableAlgorithms.includes(algoName)) {
    return null;
  }

  try {
    const stemmer = snowballFactory!(algoName);
    snowballStemmers.set(algoName, stemmer);
    return stemmer;
  } catch {
    return null;
  }
}

// ── Public API ───────────────────────────────────────────────────────

export interface InitOptions {
  /**
   * Only load tokenizers for these language codes (e.g. ["zh", "de"]).
   * Saves startup time and memory — kuromoji alone costs ~1-2s dictionary
   * build and ~17MB RSS. Omit to load everything that's installed.
   */
  languages?: string[];
}

/**
 * Initialize available tokenizers in parallel.
 * Non-fatal if any fail -- each will fall back gracefully.
 * Safe to call multiple times (idempotent).
 */
export async function initTokenizer(opts?: InitOptions): Promise<void> {
  const langs = opts?.languages ? new Set(opts.languages) : null;
  // tinyld is always loaded when present: it's the lightweight detector
  // upgrade, not a per-language tokenizer.
  const tasks: Promise<boolean>[] = [loadTinyld()];
  if (!langs || langs.has("zh")) tasks.push(loadJieba());
  if (!langs || langs.has("ja")) tasks.push(loadKuromoji());
  if (!langs || langs.has("th")) tasks.push(loadWordcut());
  if (!langs || [...langs].some((l) => SNOWBALL_LANG_MAP[l])) {
    tasks.push(loadSnowball());
  }
  await Promise.allSettled(tasks);
}

/**
 * Diagnostic: which optional packs are actually loaded right now.
 * Useful for verifying deployment configuration.
 */
export function getLoadedTokenizers(): string[] {
  const out: string[] = [];
  if (jiebaReady) out.push("jieba");
  if (kuromojiReady) out.push("kuromoji");
  if (wordcutReady) out.push("wordcut");
  if (snowballFactory) out.push("snowball");
  if (isTinyldLoaded()) out.push("tinyld");
  return out;
}

export interface TokenizeOptions {
  /** Strip high-frequency function words (zh/ja/en tables built in). Default false. */
  removeStopwords?: boolean;
}

/**
 * Pre-tokenize text for BM25 FTS indexing.
 *
 * Input is NFKC-normalized first (fullwidth→ASCII, halfwidth kana→fullwidth),
 * then routed by language:
 * - zh: jieba search-mode segmentation (fallback: ICU+bigrams, then char split)
 * - ja: kuromoji segmentation (fallback: ICU+bigrams, then char split)
 * - ko: character-level split (agglutinative: syllables keep BM25 recall stable)
 * - th: wordcut segmentation (fallback: ICU word segmentation)
 * - Snowball languages: word-level stemming
 * - en / unknown: passthrough; embedded CJK/Hangul/Thai runs get segmented
 *
 * IMPORTANT: apply the same call to both the indexed text AND the query —
 * tokenization only matches when both sides agree.
 */
export function tokenizeForFts(
  text: string,
  language: Language | string,
  opts?: TokenizeOptions
): string {
  if (!text) return "";

  // Unicode normalization: fold fullwidth Latin/digits, halfwidth kana,
  // compatibility forms — the same folding ES/Lucene ICU analyzers do
  // before tokenization.
  text = text.normalize("NFKC");

  const result = routeTokenize(text, language);
  if (!opts?.removeStopwords) return result;

  const table = getStopwords(typeof language === "string" ? language : String(language));
  if (!table) return result;
  return result
    .split(" ")
    .filter((t) => t && !table.has(t.toLowerCase()) && !table.has(t))
    .join(" ");
}

function routeTokenize(text: string, language: Language | string): string {
  // Chinese
  if (language === "zh") {
    return tokenizeChinese(text);
  }

  // Japanese
  if (language === "ja") {
    return tokenizeJapanese(text);
  }

  // Korean: deliberately syllable-level. Korean is agglutinative
  // ("프로젝트는" = 프로젝트 + topic particle), so word-level tokens fail
  // BM25 partial matches; syllable split keeps recall stable.
  if (language === "ko") {
    return tokenizeCjkChars(text, KO_CHAR_RE, CJK_CHAR_RE);
  }

  // Thai
  if (language === "th") {
    return tokenizeThai(text);
  }

  // Snowball-supported languages
  if (SNOWBALL_LANG_MAP[language]) {
    return tokenizeSnowball(text, language);
  }

  // English and unknown: if the text embeds CJK/Hangul/Thai runs
  // (CN/EN mixed tech chat is the norm in AI conversations), segment
  // those runs instead of letting them pass through unsegmented.
  if (NONLATIN_RUN_PROBE_RE.test(text)) {
    return tokenizeMixedScript(text);
  }
  return text;
}

// ── Mixed-script routing ─────────────────────────────────────────────
// Latin-heavy text gets classified "en" by ratio thresholds, but AI
// conversation logs constantly embed CJK islands ("I fixed 机器学习模型
// yesterday"). Split the text into same-script runs and give each run
// its proper tokenizer; Latin parts stay as-is.

// One capture group with three alternations: CJK+kana run | Hangul run | Thai run.
// Kana and kanji stay in ONE run so Japanese words aren't torn apart.
const SCRIPT_RUN_SPLIT_RE =
  /([一-鿿㐀-䶿豈-﫿぀-ゟ゠-ヿ]+|[가-힯ᄀ-ᇿ㄰-㆏]+|[฀-๿]+)/g;
const NONLATIN_RUN_PROBE_RE =
  /[一-鿿㐀-䶿豈-﫿぀-ゟ゠-ヿ가-힯ᄀ-ᇿ㄰-㆏฀-๿]/;
const RUN_HAS_KANA_RE = /[぀-ゟ゠-ヿ]/;
const RUN_IS_HANGUL_RE = /^[가-힯ᄀ-ᇿ㄰-㆏]+$/;
const RUN_IS_THAI_RE = /^[฀-๿]+$/;

function tokenizeMixedScript(text: string): string {
  const parts = text.split(SCRIPT_RUN_SPLIT_RE);
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (RUN_IS_HANGUL_RE.test(part)) {
      out.push(tokenizeCjkChars(part, KO_CHAR_RE, CJK_CHAR_RE));
    } else if (RUN_IS_THAI_RE.test(part)) {
      out.push(tokenizeThai(part));
    } else if (CJK_CHAR_RE.test(part) || RUN_HAS_KANA_RE.test(part)) {
      // kana present → Japanese strategy; pure ideographs → Chinese
      out.push(
        RUN_HAS_KANA_RE.test(part) ? tokenizeJapanese(part) : tokenizeChinese(part)
      );
    } else {
      const trimmed = part.trim();
      if (trimmed) out.push(trimmed);
    }
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

// ── Internal tokenizers ──────────────────────────────────────────────

function tokenizeChinese(text: string): string {
  if (!cutForSearch || !jiebaReady) {
    return intlWithBigrams(text, "zh") ?? tokenizeCjkChars(text, CJK_CHAR_RE);
  }
  const words: string[] = cutForSearch(text, true);
  return words.join(" ").replace(/\s+/g, " ").trim();
}

function tokenizeJapanese(text: string): string {
  if (!kuromojiTokenizer || !kuromojiReady) {
    // Fallback: ICU word segmentation (+bigrams), then per-character split
    return intlWithBigrams(text, "ja") ?? tokenizeCjkChars(text, JA_CHAR_RE, CJK_CHAR_RE);
  }
  const tokens = kuromojiTokenizer.tokenize(text);
  return tokens
    .map((t) => t.surface_form)
    .filter((s) => s.trim().length > 0)
    .join(" ");
}

function tokenizeThai(text: string): string {
  if (!wordcutModule || !wordcutReady) {
    // Try synchronous require as a last resort
    try {
      const mod = require("wordcut");
      mod.init();
      wordcutModule = mod;
      wordcutReady = true;
    } catch {
      // Fallback: ICU word segmentation beats passthrough (Thai has no
      // spaces, so passthrough means one giant token = zero BM25 matches)
      return segmentWithIntl(text, "th") ?? text;
    }
  }
  // wordcut returns pipe-separated string
  const result = wordcutModule!.cut(text);
  return result
    .split("|")
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0)
    .join(" ");
}

function tokenizeSnowball(text: string, lang: string): string {
  const stemmer = getSnowballStemmer(lang);
  if (!stemmer) {
    // Fallback: passthrough
    return text;
  }
  return text
    .split(/\s+/)
    .map((word) => {
      if (!word) return "";
      try {
        return stemmer.stem(word);
      } catch {
        return word;
      }
    })
    .filter((w) => w.length > 0)
    .join(" ");
}

function tokenizeCjkChars(text: string, ...charPatterns: RegExp[]): string {
  const result: string[] = [];
  let latinBuffer = "";

  for (const char of text) {
    const isCjk = charPatterns.some((re) => re.test(char));
    if (isCjk) {
      if (latinBuffer.trim()) {
        result.push(latinBuffer.trim());
        latinBuffer = "";
      }
      result.push(char);
    } else {
      latinBuffer += char;
    }
  }
  if (latinBuffer.trim()) result.push(latinBuffer.trim());

  return result.join(" ");
}
