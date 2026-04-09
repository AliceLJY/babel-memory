export interface KgPrompt {
  system: string;
  userTemplate: string;
}

const KG_SYSTEM_EN = `You are a knowledge graph extraction assistant. Extract (subject, predicate, object, confidence) tuples from text. Respond with valid JSON only.`;

const KG_USER_EN = `Extract knowledge graph triples from the following text.

Rules:
- Use simple predicates: uses, created_by, works_at, works_with, is_a, part_of, has, located_in, belongs_to, depends_on, implements, extends, related_to, caused_by, results_in, precedes, follows
- Assign confidence 0.0-1.0 based on how explicit the relationship is
- Extract 3-8 triples
- Return JSON: { "triples": [{ "subject": "", "predicate": "", "object": "", "confidence": 0.0 }] }

Examples:
Input: "Python is a programming language created by Guido van Rossum"
Output: { "triples": [{"subject":"Python","predicate":"is_a","object":"programming language","confidence":0.95},{"subject":"Python","predicate":"created_by","object":"Guido van Rossum","confidence":0.95}] }

Text to extract from:
{text}`;

const KG_SYSTEM_CJK = `你是知识图谱提取助手。从文本中提取 (主体, 谓词, 客体, 置信度) 四元组。仅返回有效 JSON。`;

const KG_USER_CJK = `从以下文本中提取知识图谱三元组。

规则：
- 使用简单谓词（保持英文作为规范化 key）: uses, created_by, works_at, works_with, is_a, part_of, has, located_in, belongs_to, depends_on, implements, extends, related_to, caused_by, results_in, precedes, follows
- 根据关系的明确程度分配置信度 0.0-1.0
- 提取 3-8 个三元组
- 返回 JSON: { "triples": [{ "subject": "", "predicate": "", "object": "", "confidence": 0.0 }] }

示例：
输入: "Python 是由 Guido van Rossum 创建的编程语言"
输出: { "triples": [{"subject":"Python","predicate":"is_a","object":"编程语言","confidence":0.95},{"subject":"Python","predicate":"created_by","object":"Guido van Rossum","confidence":0.95}] }

输入: "RecallNest 是基于 LanceDB 构建的 AI 记忆系统"
输出: { "triples": [{"subject":"RecallNest","predicate":"uses","object":"LanceDB","confidence":0.95},{"subject":"RecallNest","predicate":"is_a","object":"AI 记忆系统","confidence":0.90}] }

需要提取的文本：
{text}`;

const CJK_LANGUAGES = new Set(["zh", "ja", "ko"]);

export function getKgPrompt(lang: string): KgPrompt {
  if (CJK_LANGUAGES.has(lang)) {
    return { system: KG_SYSTEM_CJK, userTemplate: KG_USER_CJK };
  }
  return { system: KG_SYSTEM_EN, userTemplate: KG_USER_EN };
}
