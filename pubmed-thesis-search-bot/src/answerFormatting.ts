const SECTION_NAMES = ['臨床結論', '主要研究證據', '侷限與適用性'] as const;

function formatSectionBody(sectionName: string, body: string): string {
  let normalized = body
    .trim()
    .replace(/\s+[•]\s+/g, '\n- ')
    .replace(/\s+-\s+(?=\S)/g, '\n- ')
    .replace(/(\[E\d+(?:\s*(?:\||｜)\s*(?:Abstract|摘要))?\][。；])\s*(?=\S)/gi, '$1\n');

  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim().replace(/^[-•]\s*/, ''))
    .filter(Boolean);

  if (lines.length === 0) return '';

  if (sectionName === '臨床結論') {
    return lines.map((line) => `> ${line}`).join('\n>\n');
  }

  return lines.map((line) => `- ${line}`).join('\n');
}

/**
 * Converts the AI's three required clinical sections into deterministic,
 * scan-friendly Markdown. It only formats the answer before the first
 * evidence separator, leaving PubMed cards and original source text intact.
 */
export function formatClinicalAnswerForDisplay(text: string): string {
  if (!text) return text;

  const separatorMatch = text.match(/\n---\n/);
  const separatorIndex = separatorMatch?.index ?? -1;
  const answerPart = separatorIndex >= 0 ? text.slice(0, separatorIndex) : text;
  const evidencePart = separatorIndex >= 0 ? text.slice(separatorIndex) : '';

  // New server-rendered answers are already formatted. This makes the helper
  // safe to apply again in the browser for legacy shared-chat messages.
  if (/^## (?:臨床結論|主要研究證據|侷限與適用性)\s*$/m.test(answerPart)) {
    return text;
  }

  const sectionPattern = /\s*(?:#{1,6}\s*)?\**(臨床結論|主要研究證據|侷限與適用性)\s*[：:]?\**\s*/g;
  const marked = answerPart.replace(sectionPattern, (_match, sectionName: string) => `\n\n@@SECTION:${sectionName}@@\n`);

  if (!marked.includes('@@SECTION:')) return text;

  const chunks = marked.split(/(?=@@SECTION:)/).map((chunk) => chunk.trim()).filter(Boolean);
  const formatted = chunks.map((chunk) => {
    const match = chunk.match(/^@@SECTION:(臨床結論|主要研究證據|侷限與適用性)@@\s*([\s\S]*)$/);
    if (!match) return chunk;
    const [, sectionName, body] = match;
    const sectionBody = formatSectionBody(sectionName, body);
    return `## ${sectionName}\n\n${sectionBody}`.trim();
  }).join('\n\n');

  return formatted + evidencePart;
}

export const CLINICAL_ANSWER_SECTIONS = SECTION_NAMES;
