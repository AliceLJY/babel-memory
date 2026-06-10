// BM25 recall benchmark: raw text vs babel-memory preprocessing.
// Engine: SQLite FTS5 (whitespace tokenizer) via bun:sqlite — the same
// "whitespace-based FTS" situation as Tantivy/LanceDB.
//
//   bun bench/recall-benchmark.ts
//
// Three tiers measured:
//   raw    — store/query text as-is (what most memory systems do today)
//   intl   — zero-dependency tier: Intl.Segmenter + CJK bigrams
//   full   — jieba word segmentation (requires jieba-wasm installed)
import { Database } from "bun:sqlite";
import { initTokenizer, tokenizeForFts, intlWithBigrams } from "../src/tokenizer";

interface QueryCase {
  query: string;
  relevant: number[]; // indices into DOCS
}

const DOCS: string[] = [
  /* 0 */ "机器学习在自然语言处理中的应用越来越广泛",
  /* 1 */ "深度学习模型需要大量的训练数据才能收敛",
  /* 2 */ "知识图谱可以帮助大模型减少幻觉问题",
  /* 3 */ "今天去超市买了新鲜的蔬菜和水果",
  /* 4 */ "向量数据库支持高效的相似度检索",
  /* 5 */ "全文检索引擎使用倒排索引加速查询",
  /* 6 */ "我们的记忆系统昨天上线了新的检索功能",
  /* 7 */ "周末计划去公园散步然后看一场电影",
  /* 8 */ "分词质量直接影响搜索引擎的召回率",
  /* 9 */ "这家餐厅的红烧肉做得非常地道",
  /* 10 */ "大语言模型的上下文窗口限制了长文档处理",
  /* 11 */ "嵌入向量的维度选择需要平衡效果和成本",
  /* 12 */ "中文分词是自然语言处理的基础任务",
  /* 13 */ "他每天早上跑步五公里保持身体健康",
  /* 14 */ "混合检索结合了关键词匹配和语义相似度",
  /* 15 */ "数据库索引设计不当会导致查询变慢",
  /* 16 */ "春节期间高铁车票非常难买",
  /* 17 */ "模型微调需要准备高质量的标注数据集",
  /* 18 */ "缓存策略可以显著降低系统响应延迟",
  /* 19 */ "她用周末时间学习了三门编程语言",
];

const QUERIES: QueryCase[] = [
  { query: "机器学习", relevant: [0] },
  { query: "深度学习", relevant: [1] },
  { query: "学习", relevant: [0, 1, 19] },
  { query: "知识图谱", relevant: [2] },
  { query: "检索", relevant: [4, 5, 6, 14] },
  { query: "分词", relevant: [8, 12] },
  { query: "数据库", relevant: [4, 15] },
  { query: "记忆系统", relevant: [6] },
  { query: "自然语言处理", relevant: [0, 12] },
  { query: "模型", relevant: [1, 2, 10, 17] },
  { query: "周末", relevant: [7, 19] },
  { query: "召回率", relevant: [8] },
];

type Preprocess = (text: string) => string;

function escapeFtsQuery(tokens: string): string {
  // quote each whitespace token so FTS5 treats them as terms (OR them)
  return tokens
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => `"${t.replace(/"/g, '""')}"`)
    .join(" OR ");
}

function evaluate(name: string, prep: Preprocess) {
  const db = new Database(":memory:");
  db.run("CREATE VIRTUAL TABLE docs USING fts5(content)");
  const insert = db.prepare("INSERT INTO docs (rowid, content) VALUES (?, ?)");
  DOCS.forEach((d, i) => insert.run(i + 1, prep(d)));

  let totalRelevant = 0;
  let totalHit = 0;
  let queriesWithZeroHits = 0;

  for (const qc of QUERIES) {
    const q = escapeFtsQuery(prep(qc.query));
    const rows = q
      ? (db.query(`SELECT rowid FROM docs WHERE docs MATCH ?`).all(q) as { rowid: number }[])
      : [];
    const got = new Set(rows.map((r) => r.rowid - 1));
    const hit = qc.relevant.filter((i) => got.has(i)).length;
    totalRelevant += qc.relevant.length;
    totalHit += hit;
    if (hit === 0) queriesWithZeroHits++;
  }

  const recall = totalHit / totalRelevant;
  return { name, recall, queriesWithZeroHits };
}

await initTokenizer();

const tiers = [
  evaluate("raw (no preprocessing)", (t) => t),
  evaluate("intl (zero-dep tier)", (t) => intlWithBigrams(t.normalize("NFKC"), "zh") ?? t),
  evaluate("full (jieba)", (t) => tokenizeForFts(t, "zh")),
];

console.log(`\nBM25 recall on ${DOCS.length} Chinese docs, ${QUERIES.length} queries (SQLite FTS5):\n`);
console.log("| Tier | Recall | Queries with 0 hits |");
console.log("|------|--------|---------------------|");
for (const t of tiers) {
  console.log(
    `| ${t.name} | ${(t.recall * 100).toFixed(1)}% | ${t.queriesWithZeroHits}/${QUERIES.length} |`
  );
}
console.log();
