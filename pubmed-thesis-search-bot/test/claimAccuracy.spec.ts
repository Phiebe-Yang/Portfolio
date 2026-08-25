import { describe, it, expect } from 'vitest';
import {
  extractSupportingPassage,
  validateNumericalClaims,
  checkEvidenceSufficiency,
  enrichCitationsWithSourceAwareness,
  verifyClaimAccuracy,
} from '../src/claimAccuracy';
import { EvidenceObject } from '../src/citationIntegrity';

describe('Phase 3 — Claim Accuracy', () => {
  const mockEvidenceMap = new Map<string, EvidenceObject>();
  mockEvidenceMap.set('E1', {
    id: 'E1',
    pmid: '40000001',
    title: 'Pembrolizumab in NSCLC',
    abstract: 'In KEYNOTE-024, Pembrolizumab significantly improved overall survival compared to chemotherapy (HR 0.68, 95% CI 0.53-0.86, p=0.001). The 5-year OS rate was 31.9%.',
    publication_date: '2021-03',
    journal: 'N Engl J Med',
    relevance_score: 95,
    trial_names: ['KEYNOTE-024'],
  });

  it('1. Claim-level citation & 3. Supporting passage: extracts exact sentence from abstract', () => {
    const claim = 'Pembrolizumab 顯著延長整體存活期 (HR 0.68) [E1]。';
    const passage = extractSupportingPassage(claim, mockEvidenceMap.get('E1')!.abstract);

    expect(passage).toBeDefined();
    expect(passage).toContain('HR 0.68');
  });

  it('2. Numerical claim validation: detects accurate numbers and catches mismatches', () => {
    const validClaim = 'KEYNOTE-024 中 5 年整體存活率為 31.9% [E1]。';
    const valResultPass = validateNumericalClaims(validClaim, mockEvidenceMap.get('E1')!.abstract);
    expect(valResultPass.hasMismatch).toBe(false);

    // Mismatched number: 45.5% does not exist in abstract
    const invalidClaim = 'KEYNOTE-024 中 5 年整體存活率為 45.5% [E1]。';
    const valResultFail = validateNumericalClaims(invalidClaim, mockEvidenceMap.get('E1')!.abstract);
    expect(valResultFail.hasMismatch).toBe(true);
    expect(valResultFail.details).toContain('45.5%');
  });

  it('4. Evidence insufficient / abstention: triggers abstention when evidence is missing or low quality', () => {
    const emptyMap = new Map<string, EvidenceObject>();
    const sufficiency = checkEvidenceSufficiency(emptyMap, '罕見基因突變治療');

    expect(sufficiency.isSufficient).toBe(false);
    expect(sufficiency.abstainReason).toContain('查無與「罕見基因突變治療」相關的直接 PubMed 實證文獻');
  });

  it('5. Source-type awareness & 6. Abstract vs full-text distinction: annotates citations with source type', () => {
    const rawAnswer = 'Pembrolizumab 能大幅提高存活率 [E1]。';
    const enriched = enrichCitationsWithSourceAwareness(rawAnswer, mockEvidenceMap);

    expect(enriched).toBe('Pembrolizumab 能大幅提高存活率 [E1｜摘要]。');
  });

  it('Pipeline integration: verifyClaimAccuracy generates complete report', () => {
    const answer = 'KEYNOTE-024 研究顯示 HR 0.68，5 年存活率為 31.9% [E1]。';
    const report = verifyClaimAccuracy(answer, mockEvidenceMap, 'Pembrolizumab 存活率');

    expect(report.abstainRequired).toBe(false);
    expect(report.overallConfidence).toBe('High');
    expect(report.validatedAnswer).toContain('[E1｜摘要]');
    expect(report.claimVerifications).toHaveLength(1);
    expect(report.claimVerifications[0].isVerified).toBe(true);
  });
});
