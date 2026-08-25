import { describe, it, expect } from 'vitest';
import {
  EvidenceObject,
  extractTrialNames,
  createEvidenceObjects,
  formatEvidenceForPrompt,
  stripRawIdentifiers,
  parseStructuredLLMResponse,
  validateAndCorrectCitations,
  renderVerifiedCitationsAndReferences,
} from '../src/citationIntegrity';
import { PubMedArticle } from '../src/pubmedBigQuery';

describe('Phase 1 — Citation Integrity', () => {
  const mockArticles: PubMedArticle[] = [
    {
      pmid: '10000001',
      title: 'CheckMate-067: Nivolumab plus Ipilimumab in Advanced Melanoma',
      abstract: 'In CheckMate-067 trial (NCT01844505), combined immunotherapy prolonged survival in 2021.',
      authors: ['Larkin J', 'Chiarion-Sileni V', 'Gonzalez R', 'GroTA B'],
      publication_date: '2021-07',
      journal: 'N Engl J Med',
      relevance_score: 95,
      doi: '10.1056/NEJMoa1504030',
    },
    {
      pmid: '20000002',
      title: 'KEYNOTE-024: Pembrolizumab versus Chemotherapy for PD-L1-Positive NSCLC',
      abstract: 'Results of KEYNOTE-024 study (NCT02142738) demonstrated long-term survival benefits.',
      authors: ['Reck M', 'Rodríguez-Abreu D', 'Robinson AG'],
      publication_date: '2021-03',
      journal: 'N Engl J Med',
      relevance_score: 92,
      doi: '10.1056/NEJMoa1606774',
    },
  ];

  it('1. Evidence Object & 2. Evidence ID: correctly assigns E1, E2 and extracts trial names', () => {
    const evidenceList = createEvidenceObjects(mockArticles);
    expect(evidenceList).toHaveLength(2);

    expect(evidenceList[0].id).toBe('E1');
    expect(evidenceList[0].pmid).toBe('10000001');
    expect(evidenceList[0].trial_names).toContain('CHECKMATE-067');
    expect(evidenceList[0].trial_names).toContain('NCT01844505');

    expect(evidenceList[1].id).toBe('E2');
    expect(evidenceList[1].pmid).toBe('20000002');
    expect(evidenceList[1].trial_names).toContain('KEYNOTE-024');
    expect(evidenceList[1].trial_names).toContain('NCT02142738');

    const formattedContext = formatEvidenceForPrompt(evidenceList);
    expect(formattedContext).toContain('[E1]');
    expect(formattedContext).toContain('[E2]');
    // Prompt context conceals raw PMIDs to forbid LLM from writing raw numbers
    expect(formattedContext).not.toContain('10000001');
    expect(formattedContext).not.toContain('20000002');
  });

  it('3. 禁止 LLM 產生 PMID / DOI / URL: strips raw PMID, DOI, and URLs', () => {
    const dirtyText = '研究結果顯示 (PMID: 99999999) (DOI: 10.1016/j.cell.2020.01.001) 連結為 https://pubmed.ncbi.nlm.nih.gov/99999999/ [E1]。';
    const sanitized = stripRawIdentifiers(dirtyText);
    expect(sanitized).not.toContain('PMID: 99999999');
    expect(sanitized).not.toContain('10.1016/j.cell.2020.01.001');
    expect(sanitized).not.toContain('https://pubmed.ncbi.nlm.nih.gov');
    expect(sanitized).toContain('[E1]');
  });

  it('4. Structured JSON output: parses json response safely', () => {
    const jsonString = '```json\n{\n  "answer": "KEYNOTE-024 顯著提升生存率 [E2]。",\n  "used_evidence_ids": ["E2"]\n}\n```';
    const parsed = parseStructuredLLMResponse(jsonString);
    expect(parsed.answer).toBe('KEYNOTE-024 顯著提升生存率 [E2]。');
    expect(parsed.used_evidence_ids).toEqual(['E2']);
  });

  it('5. Backend Citation Renderer: builds references strictly from Evidence Objects', () => {
    const evidenceList = createEvidenceObjects(mockArticles);
    const map = new Map<string, EvidenceObject>();
    evidenceList.forEach((ev) => map.set(ev.id, ev));

    const rendered = renderVerifiedCitationsAndReferences('KEYNOTE-024 改善總生存期 [E2]。', map, ['E2']);
    expect(rendered).toContain('KEYNOTE-024 改善總生存期 [E2]。');
    expect(rendered).toContain('### 已核對的參考文獻與實證對照');
    expect(rendered).toContain('[E2]');
    expect(rendered).toContain('https://pubmed.ncbi.nlm.nih.gov/20000002/');
    expect(rendered).toContain('10.1056/NEJMoa1606774');
  });

  it('6. Citation Validator & 8. Trial Name Validation: prevents mismatched PMID for trial names', () => {
    const evidenceList = createEvidenceObjects(mockArticles);
    const map = new Map<string, EvidenceObject>();
    evidenceList.forEach((ev) => map.set(ev.id, ev));

    // LLM mistakenly cited [E1] (CheckMate-067, PMID 10000001) for KEYNOTE-024!
    const mismatchedLLMAnswer = 'KEYNOTE-024 試驗結果顯示單藥免疫治療顯著延長非小細胞肺癌存活期 [E1]。';

    const result = validateAndCorrectCitations(mismatchedLLMAnswer, map);

    // Should automatically re-map [E1] to [E2] because E2 is KEYNOTE-024!
    expect(result.validatedAnswer).toContain('[E2]');
    expect(result.validatedAnswer).not.toContain('[E1]');
    expect(result.verifiedEvidenceIds).toContain('E2');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('Trial Name Mismatch');

    // Render verified references
    const finalHTML = renderVerifiedCitationsAndReferences(result.validatedAnswer, map, result.verifiedEvidenceIds);
    // KEYNOTE-024 must point to PMID 20000002, NOT 10000001!
    expect(finalHTML).toContain('https://pubmed.ncbi.nlm.nih.gov/20000002/');
    expect(finalHTML).not.toContain('https://pubmed.ncbi.nlm.nih.gov/10000001/');
  });

  it('7. Metadata consistency checks: handles invalid Evidence IDs and year mismatches', () => {
    const evidenceList = createEvidenceObjects(mockArticles);
    const map = new Map<string, EvidenceObject>();
    evidenceList.forEach((ev) => map.set(ev.id, ev));

    // E99 does not exist
    const invalidTagAnswer = '這是一個未知報告 [E99]。';
    const result = validateAndCorrectCitations(invalidTagAnswer, map);
    expect(result.validatedAnswer).toBe('這是一個未知報告 。');
    expect(result.warnings[0]).toContain('Invalid Evidence ID [E99] removed');
  });

  it('8. 中文摘要來源標籤仍可通過引用完整性驗證', () => {
    const evidenceList = createEvidenceObjects(mockArticles);
    const map = new Map<string, EvidenceObject>();
    evidenceList.forEach((ev) => map.set(ev.id, ev));

    const result = validateAndCorrectCitations('Pembrolizumab 改善存活結果 [E2｜摘要]。', map);
    expect(result.verifiedEvidenceIds).toContain('E2');
    expect(result.validatedAnswer).toContain('[E2｜摘要]');
  });
});
