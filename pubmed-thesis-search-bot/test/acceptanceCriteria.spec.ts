import { describe, it, expect } from 'vitest';
import {
  createEvidenceObjects,
  formatEvidenceForPrompt,
  stripRawIdentifiers,
  validateAndCorrectCitations,
  renderVerifiedCitationsAndReferences,
  EvidenceObject,
} from '../src/citationIntegrity';
import {
  parseClinicalQuery,
  applyClinicalFilters,
  rerankClinicalEvidence,
} from '../src/clinicalRetrieval';
import {
  validateNumericalClaims,
  checkEvidenceSufficiency,
  verifyClaimAccuracy,
} from '../src/claimAccuracy';
import {
  classifyEvidenceHierarchy,
  generateExplainableRelevance,
  deriveClinicalLimitations,
  renderProfessionalUISections,
} from '../src/professionalUI';
import { PubMedArticle } from '../src/pubmedBigQuery';

describe('Acceptance Criteria Final Verification Suite', () => {
  // Mock Database Evidence Objects
  const dbArticles: PubMedArticle[] = [
    {
      pmid: '12345678',
      title: 'Pediatric vs Adult Efficacy of Semaglutide in Obesity: A Phase 3 RCT',
      abstract: 'In this randomized controlled trial (RCT) involving pediatric (children) and adult patients, Semaglutide 2.4 mg led to a 16.1% mean reduction in BMI compared to 0.6% in placebo (p<0.001).',
      authors: ['Silva M', 'Chen K', 'Davis R', 'White T'],
      publication_date: '2023-11',
      journal: 'N Engl J Med',
      relevance_score: 96,
      doi: '10.1056/NEJMoa2214050',
    },
    {
      pmid: '87654321',
      title: 'KEYNOTE-024: Pembrolizumab (PD-1 Inhibitor Class) in Advanced NSCLC',
      abstract: 'KEYNOTE-024 evaluated Pembrolizumab vs chemotherapy in NSCLC. Overall survival was significantly prolonged (HR 0.60, 95% CI 0.41-0.89).',
      authors: ['Reck M', 'Rodriguez A'],
      publication_date: '2016-11',
      journal: 'N Engl J Med',
      relevance_score: 92,
      doi: '10.1056/NEJMoa1606774',
    },
  ];

  const evidenceList = createEvidenceObjects(dbArticles);
  const evidenceMap = new Map<string, EvidenceObject>();
  evidenceList.forEach((ev) => evidenceMap.set(ev.id, ev));

  describe('1. Citation Acceptance Criteria', () => {
    it('所有 PMID / DOI 都來自 database，不來自 LLM，且 URL 由 backend 產生', () => {
      const promptContext = formatEvidenceForPrompt(evidenceList);
      // Ensure prompt context hides raw PMIDs and DOIs from LLM to prevent writing raw identifiers
      expect(promptContext).not.toContain('12345678');
      expect(promptContext).not.toContain('10.1056/NEJMoa2214050');

      const llmText = 'Semaglutide 顯著改善兒童肥胖 [E1]。';
      const rendered = renderVerifiedCitationsAndReferences(llmText, evidenceMap, ['E1']);

      // All URLs and PMIDs are strictly rendered by backend from database metadata
      expect(rendered).toContain('https://pubmed.ncbi.nlm.nih.gov/12345678/');
      expect(rendered).toContain('10.1056/NEJMoa2214050');
    });

    it('PMID ↔ title 以及 DOI ↔ PMID 永遠一致', () => {
      const ev1 = evidenceMap.get('E1')!;
      expect(ev1.pmid).toBe('12345678');
      expect(ev1.title).toContain('Pediatric vs Adult Efficacy of Semaglutide');
      expect(ev1.doi).toBe('10.1056/NEJMoa2214050');
    });

    it('LLM 無法引用不存在的 Evidence ID', () => {
      const hallucinatedLLMOutput = '這是一個未知的聲明 [E99]。';
      const validated = validateAndCorrectCitations(hallucinatedLLMOutput, evidenceMap);

      expect(validated.validatedAnswer).toBe('這是一個未知的聲明 。');
      expect(validated.verifiedEvidenceIds).not.toContain('E99');
    });

    it('不再出現 trial name 與 PMID cross-mapping', () => {
      // LLM cited E1 (Pediatric Semaglutide) for KEYNOTE-024!
      const crossMappedLLMOutput = 'KEYNOTE-024 試驗顯示整體存活期顯著改善 [E1]。';
      const validated = validateAndCorrectCitations(crossMappedLLMOutput, evidenceMap);

      // Re-mapped to E2 (KEYNOTE-024, PMID 87654321)
      expect(validated.validatedAnswer).toContain('[E2]');
      expect(validated.validatedAnswer).not.toContain('[E1]');

      const rendered = renderVerifiedCitationsAndReferences(validated.validatedAnswer, evidenceMap, validated.verifiedEvidenceIds);
      expect(rendered).toContain('https://pubmed.ncbi.nlm.nih.gov/87654321/');
      expect(rendered).not.toContain('https://pubmed.ncbi.nlm.nih.gov/12345678/');
    });
  });

  describe('2. Medical Evidence Acceptance Criteria', () => {
    it('Pediatric / adolescent / adult 可以區分', () => {
      const pedQuery = parseClinicalQuery('Semaglutide for pediatric children obesity');
      expect(pedQuery.filterCriteria.populationFilter).toContain('pediatric');

      const pedFiltered = applyClinicalFilters(dbArticles, pedQuery.filterCriteria);
      expect(pedFiltered).toHaveLength(1);
      expect(pedFiltered[0].pmid).toBe('12345678');
    });

    it('Drug class evidence 與 specific-drug evidence 可以區分', () => {
      const classQuery = parseClinicalQuery('PD-1 inhibitor for NSCLC');
      const reranked = rerankClinicalEvidence(dbArticles, classQuery);

      expect(reranked[0].evidenceType).toBe('direct');
      expect(reranked[0].pmid).toBe('87654321');
    });

    it('RCT / review / observational study 可以區分', () => {
      const tierRCT = classifyEvidenceHierarchy(dbArticles[0].abstract);
      expect(tierRCT).toBe('Level 2: RCT / Phase 3');

      const tierReview = classifyEvidenceHierarchy('Systematic Review and Meta-Analysis of RCTs');
      expect(tierReview).toBe('Level 1: Meta-Analysis / Systematic Review');
    });

    it('沒有足夠證據時可以回答 evidence insufficient', () => {
      const emptyMap = new Map<string, EvidenceObject>();
      const sufficiency = checkEvidenceSufficiency(emptyMap, '未知的神經退化疾患治療');

      expect(sufficiency.isSufficient).toBe(false);
      expect(sufficiency.abstainReason).toContain('查無與「未知的神經退化疾患治療」相關的直接 PubMed 實證文獻');
    });

    it('不可以虛構數字 (Numerical Claim Validation)', () => {
      const abstract = dbArticles[0].abstract; // contains 16.1% and 0.6%

      const validClaim = 'Semaglutide 組平均 BMI 降低 16.1% [E1]。';
      const passResult = validateNumericalClaims(validClaim, abstract);
      expect(passResult.hasMismatch).toBe(false);

      const hallucinatedClaim = 'Semaglutide 組平均 BMI 降低 42.8% [E1]。';
      const failResult = validateNumericalClaims(hallucinatedClaim, abstract);
      expect(failResult.hasMismatch).toBe(true);
      expect(failResult.details).toContain('42.8');
    });
  });

  describe('3. UX Acceptance Criteria', () => {
    it('保留中文短句與快速閱讀 (Quick View)', () => {
      const answer = 'Semaglutide 能顯著降低兒童與青少年肥胖族群之 BMI [E1｜摘要]。';
      const report = verifyClaimAccuracy(answer, evidenceMap, 'Semaglutide 兒童肥胖');

      expect(report.validatedAnswer).toContain('Semaglutide 能顯著降低兒童與青少年肥胖族群之 BMI');
    });

    it('專業人員可以展開查看詳細 evidence 與所有研究之來源 (Study Cards)', () => {
      const htmlUI = renderProfessionalUISections(evidenceMap, ['E1', 'E2']);

      expect(htmlUI).toContain('class="evidence-card"');
      expect(htmlUI).toContain('第 2 級：RCT／第三期臨床試驗');
      expect(htmlUI).toContain('前往 PubMed 官方頁面核對');
      expect(htmlUI).toContain('可驗證條件對照：');
      expect(htmlUI).toContain('臨床侷限與注意：');
      expect(htmlUI).toContain('https://pubmed.ncbi.nlm.nih.gov/12345678/');
      expect(htmlUI).toContain('https://pubmed.ncbi.nlm.nih.gov/87654321/');
    });
  });
});
