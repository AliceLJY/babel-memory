// Smoke test for the zero-dependency install path.
// MUST be run from a directory that contains ./dist but NO node_modules,
// so every optional package import fails and the fallback chain engages.
// CI copies dist/ + package.json + this file to a temp dir; locally:
//   bun run build && mkdir -p /tmp/bm-smoke && cp -r dist package.json scripts/smoke-no-optional.mjs /tmp/bm-smoke/ && (cd /tmp/bm-smoke && node smoke-no-optional.mjs)
// (package.json carries "type":"module" so dist/index.js parses as ESM the
//  same way it does inside a real npm install)
import {
  detectLanguage,
  detectLanguageExtended,
  getLoadedTokenizers,
  initTokenizer,
  tokenizeForFts,
} from "./dist/index.js";

let failed = 0;
function check(name, cond, detail = "") {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const warnings = [];
const originalWarn = console.warn;
console.warn = (...args) => warnings.push(args.map(String).join(" "));
await initTokenizer(); // every optional load fails gracefully

const loaded = getLoadedTokenizers();
check("no optional packs loaded", loaded.length === 0, `loaded: ${loaded.join(",")}`);

const zh = tokenizeForFts("机器学习在自然语言处理中的应用", "zh");
check("zh is word-level via Intl.Segmenter", zh.split(" ").length >= 4, zh);
check("zh contains real words, not only chars", zh.split(" ").includes("机器"), zh);

const ja = tokenizeForFts("東京タワーはとても高いです", "ja");
check("ja segments without kuromoji", ja.split(" ").length >= 3, ja);

const th = tokenizeForFts("สวัสดีครับผมชอบกินข้าว", "th");
console.warn = originalWarn;
check("th is NOT passthrough (old bug: one giant token)", th.split(" ").length >= 3, th);
check(
  "missing wordcut uses the default ICU tier without a warning",
  !warnings.some((warning) => warning.includes("wordcut")),
  warnings.join(" | ")
);

const ko = tokenizeForFts("프로젝트", "ko");
check("ko stays syllable-level", ko === "프 로 젝 트", ko);

const en = "just a plain English sentence";
check("pure en passthrough preserved", tokenizeForFts(en, "en") === en);

const mixed = tokenizeForFts("I fixed 机器学习模型 using TensorFlow", "en");
check("CJK island inside en text gets segmented", !mixed.includes("机器学习模型"), mixed);
check("Latin part survives mixed routing", mixed.includes("TensorFlow"), mixed);

check("detect still works (zero-dep by design)", detectLanguage("机器学习") === "zh");
check(
  "extended detect degrades to 'en' without tinyld",
  detectLanguageExtended("Das ist ein guter Tag") === "en"
);

const de = tokenizeForFts("Maschinelles Lernen verbessert", "de");
check("snowball language passthrough without package", de.length > 0);

if (failed > 0) {
  console.error(`\n${failed} smoke check(s) failed`);
  process.exit(1);
}
console.log("\nALL NO-OPTIONAL SMOKE CHECKS PASSED");
