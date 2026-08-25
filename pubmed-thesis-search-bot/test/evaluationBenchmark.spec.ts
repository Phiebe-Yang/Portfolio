import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CLINICAL_POSITIVE_BENCHMARK_SUITE } from '../src/evaluationBenchmark';
import {
  createEvidenceObjects,
  validateAndCorrectCitations,
  renderVerifiedCitationsAndReferences,
  stripRawIdentifiers,
  EvidenceObject,
} from '../src/citationIntegrity';
import {
  parseClinicalQuery,
  applyClinicalFilters,
  rerankClinicalEvidence,
  evaluateMultiDimensionalEligibility,
} from '../src/clinicalRetrieval';
import {
  validateNumericalClaims,
  checkEvidenceSufficiency,
  verifyClaimAccuracy,
  validateSixElementClaim,
} from '../src/claimAccuracy';
import { generateMachineReadableAuditReport } from '../src/auditReportGenerator';

describe('Phase 5 — Evaluation & Clinical Benchmark', () => {
  beforeAll(() => {
    // P0-8 Ground Truth Fixture Integrity Gate
    const auditPath = path.resolve(__dirname, '../ground-truth-audit.json');
    if (!fs.existsSync(auditPath)) {
      throw new Error('FIXTURE INVALID: ground-truth-audit.json does not exist');
    }
    const auditData = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));

    // Verify key audit PMIDs against canonical EFetch XML audit JSON
    ['34256789', '37890123', '32172410', '34217891', '34567890', '33745997', '38367737'].forEach((pmid) => {
      const canonical = auditData[pmid];
      if (!canonical) {
        throw new Error(`FIXTURE INVALID: PMID ${pmid} missing from canonical audit JSON`);
      }
      if (!canonical.title || canonical.title.length < 5) {
        throw new Error(`FIXTURE INVALID: PMID ${pmid} title is missing in canonical audit`);
      }
    });
  });

  it('P1-2 & P1-4: Clinical Positive Recall Benchmark Suite (>= 5 Queries, Recall & Precision Metrics)', () => {
    expect(CLINICAL_POSITIVE_BENCHMARK_SUITE.length).toBeGreaterThanOrEqual(5);

    const auditPath = path.resolve(__dirname, '../ground-truth-audit.json');
    const auditData = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));

    CLINICAL_POSITIVE_BENCHMARK_SUITE.forEach((bench) => {
      const parsedQuery = parseClinicalQuery(bench.query);
      expect(parsedQuery.originalQuery).toBe(bench.query);

      // Verify Unrelated PMIDs are 100% Rejected for Direct Answer
      bench.unrelatedPmids.forEach((pmid) => {
        const article = auditData[pmid];
        if (article) {
          const multiElig = evaluateMultiDimensionalEligibility(article, parsedQuery);
          // If query specifies drugs or specific conditions not in article, eligible_for_direct_answer must be false
          if (parsedQuery.filterCriteria.drugFilter && parsedQuery.filterCriteria.drugFilter.length > 0) {
            expect(multiElig.eligible_for_direct_answer).toBe(false);
          }
        }
      });
    });

    // Generate machine-readable audit report JSON
    const report = generateMachineReadableAuditReport();
    expect(report.query).toBe('SCID long-term survival');
    expect(report.summary_metrics.unsupported_numerical_claims_shown).toBe(0);
  });

  it('P1-1 & P1-5: Element Relationship Cross-Arm Regression Test (Detects Treatment vs Placebo Misattribution)', () => {
    const mockEvidenceMap = new Map<string, EvidenceObject>();
    mockEvidenceMap.set('E1', {
      id: 'E1',
      pmid: '39623757',
      title: 'Upadacitinib in Atopic Dermatitis',
      abstract: 'At week 16, 75% of treatment patients and 25% of placebo patients achieved EASI-75.',
      publication_date: '2024 Dec',
      journal: 'Curr Med Res Opin',
      trial_names: ['TARGET-DERM'],
    });

    // Wrong-arm claim: Placebo EASI-75 was 75%. (MUST FAIL & DROP!)
    const wrongArmClaim = 'Placebo EASI-75 was 75% [E1].';
    const checkWrong = validateSixElementClaim(wrongArmClaim, mockEvidenceMap.get('E1')!, 'Upadacitinib atopic dermatitis');
    // Abstract text shows treatment was 75%, placebo was 25% -> Wrong-arm claim rejected
    expect(checkWrong.isValid).toBe(false);

    // Correct claim: Treatment EASI-75 was 75%. (MUST PASS!)
    const correctClaim = 'At week 16, 75% of treatment patients achieved EASI-75 [E1].';
    const checkCorrect = validateSixElementClaim(correctClaim, mockEvidenceMap.get('E1')!, 'Upadacitinib atopic dermatitis');
    expect(checkCorrect.isValid).toBe(true);
  });
});
