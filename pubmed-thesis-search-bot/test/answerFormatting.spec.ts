import { describe, expect, it } from 'vitest';
import { formatClinicalAnswerForDisplay } from '../src/answerFormatting';

describe('Clinical answer display formatting', () => {
  it('turns a dense one-line answer into three scan-friendly sections', () => {
    const dense = '臨床結論：治療可改善結果 [E1｜摘要]。主要研究證據： - E1 納入 62 名病人 [E1｜摘要]。 - E2 為回顧性研究 [E2｜摘要]。侷限與適用性： - 僅有摘要資料。 - 不宜外推至成人。';
    const formatted = formatClinicalAnswerForDisplay(dense);

    expect(formatted).toContain('## 臨床結論\n\n> 治療可改善結果');
    expect(formatted).toContain('## 主要研究證據\n\n- E1 納入 62 名病人');
    expect(formatted).toContain('\n- E2 為回顧性研究');
    expect(formatted).toContain('## 侷限與適用性\n\n- 僅有摘要資料。');
    expect(formatted).toContain('\n- 不宜外推至成人。');
  });

  it('leaves PubMed evidence cards and original source content untouched', () => {
    const dense = '臨床結論：結果有直接證據支持 [E1｜摘要]。\n---\n<div class="evidence-card">Original English abstract text</div>';
    const formatted = formatClinicalAnswerForDisplay(dense);

    expect(formatted).toContain('## 臨床結論');
    expect(formatted).toContain('<div class="evidence-card">Original English abstract text</div>');
  });
});
