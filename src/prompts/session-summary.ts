export interface SessionPrompt {
  system: string;
  dimensionLabels: Record<string, string>;
}

const DIMENSIONS_EN: Record<string, string> = {
  user_intent: "User intent and requests",
  technical_concepts: "Key technical concepts",
  files_and_code: "Files and code segments involved",
  errors_and_fixes: "Errors and fix records",
  problem_solving: "Problem solving process",
  user_quotes: "User original quotes preserved",
  unfinished_tasks: "Unfinished tasks",
  current_state: "Current work state",
  next_steps: "Suggested next steps",
};

const DIMENSIONS_CJK: Record<string, string> = {
  user_intent: "用户意图和请求",
  technical_concepts: "关键技术概念",
  files_and_code: "涉及的文件和代码片段",
  errors_and_fixes: "错误和修复记录",
  problem_solving: "问题解决过程",
  user_quotes: "保留的用户原话",
  unfinished_tasks: "未完成的任务",
  current_state: "当前工作状态",
  next_steps: "建议的下一步",
};

function buildSystemPrompt(dimensions: Record<string, string>, intro: string): string {
  const sections = Object.values(dimensions)
    .map((label, i) => `## ${i + 1}. ${label}`)
    .join("\n");
  return `${intro}
Output format (MUST follow exactly):
<analysis>Brief analysis of what happened in this session</analysis>
<summary>
${sections}
</summary>`;
}

const SESSION_SYSTEM_EN = buildSystemPrompt(
  DIMENSIONS_EN,
  "You are a session summarizer. Analyze the conversation and produce a structured summary.",
);

const SESSION_SYSTEM_CJK = buildSystemPrompt(
  DIMENSIONS_CJK,
  "你是会话总结助手。分析对话并生成结构化总结。",
);

const CJK_LANGUAGES = new Set(["zh", "ja", "ko"]);

export function getSessionPrompt(lang: string): SessionPrompt {
  if (CJK_LANGUAGES.has(lang)) {
    return { system: SESSION_SYSTEM_CJK, dimensionLabels: DIMENSIONS_CJK };
  }
  return { system: SESSION_SYSTEM_EN, dimensionLabels: DIMENSIONS_EN };
}
