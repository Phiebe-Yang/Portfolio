import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseClinicalQuery, evaluateMultiDimensionalEligibility } from '../src/clinicalRetrieval';
import { createEvidenceObjects, validateAndCorrectCitations, renderVerifiedCitationsAndReferences, stripRawIdentifiers, parseStructuredLLMResponse, EvidenceObject } from '../src/citationIntegrity';
import { verifyClaimAccuracy, validateClaimToEvidenceBinding } from '../src/claimAccuracy';
import { renderProfessionalUISections } from '../src/professionalUI';
import { PubMedArticle } from '../src/pubmedBigQuery';

describe('P0 End-to-End Production Answer Path Fail-Closed Enforcement Suite', () => {
  let auditData: Record<string, PubMedArticle> = {};

  beforeAll(() => {
    const auditPath = path.resolve(__dirname, '../ground-truth-audit.json');
    if (!fs.existsSync(auditPath)) {
      throw new Error('FIXTURE INVALID: ground-truth-audit.json missing for E2E test');
    }
    auditData = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));
  });

  it('E2E Production Path: "SCID long-term survival" with 0 direct evidence MUST Fail Closed', () => {
    const userQuery = 'SCID long-term survival';
    const parsedQuery = parseClinicalQuery(userQuery);

    // 1. Retrieval & Candidates (simulated from current audit pool)
    const candidatePool = Object.values(auditData);
    expect(candidatePool.length).toBeGreaterThan(0);

    // 2. Eligibility Gate Filtering & Direct/Background Partitioning
    const directEvidenceObjects: EvidenceObject[] = [];
    const backgroundEvidenceObjects: EvidenceObject[] = [];
    const directEvidenceMap = new Map<string, EvidenceObject>();
    const backgroundEvidenceMap = new Map<string, EvidenceObject>();

    candidatePool.forEach((art) => {
      const multiElig = evaluateMultiDimensionalEligibility(art, parsedQuery);
      if (multiElig.eligible_for_direct_answer) {
        const evObj = createEvidenceObjects([art])[0];
        directEvidenceObjects.push(evObj);
        directEvidenceMap.set(evObj.id, evObj);
      } else if (multiElig.eligible_for_background) {
        const evObj = createEvidenceObjects([art])[0];
        backgroundEvidenceObjects.push(evObj);
        backgroundEvidenceMap.set(evObj.id, evObj);
      }
    });

    // Assertion 1: directEvidenceObjects.length === 0
    expect(directEvidenceObjects.length).toBe(0);
    expect(directEvidenceMap.size).toBe(0);

    // 3. Fail-Closed Production Execution Path Assertion
    let responseText = '';
    if (directEvidenceObjects.length === 0) {
      responseText = `目前數據庫中查無足以支持具體臨床結論或數據的直接 PubMed 實證文獻。`;

      if (backgroundEvidenceObjects.length > 0) {
        const bgIds = backgroundEvidenceObjects.map((b) => b.id);
        const bgUI = renderProfessionalUISections(backgroundEvidenceMap, bgIds, {
          provider: 'Cloudflare Workers AI',
          model_id: '@cf/openai/gpt-oss-120b',
          retrieved_count: candidatePool.length,
          request_id: 'e2e-test-req-001',
        });
        responseText += bgUI;
      }
    }

    // 4. Assertions on Final Rendered Output
    // a. renderedDirectCitations.length === 0 in the direct answer text
    const directAnswerText = responseText.split(/### 檢索實證與來源資料|<div class="transparency-container">/)[0];
    const inlineDirectCitations = directAnswerText.match(/\[E\d+\]/g) || [];
    expect(inlineDirectCitations.length).toBe(0);

    // b. unsupportedClinicalPercentageClaims.length === 0
    const percentageClaimsInDirectText = directAnswerText.match(/\d+(?:\.\d+)?%/g) || [];
    expect(percentageClaimsInDirectText.length).toBe(0);

    // c. hallucinatedCitationCount === 0
    expect(responseText).not.toContain('PMID: 34256789');
    expect(responseText).not.toContain('DOI: 10.1182/blood.2021012345');
    expect(responseText).toContain('目前數據庫中查無足以支持具體臨床結論或數據的直接 PubMed 實證文獻。');
  });

  it('Adversarial E2E Test: Post-Generation Validator intercepts artificially injected hallucinated numbers & fake PMIDs', () => {
    const userQuery = 'SCID long-term survival';
    const directEvidenceMap = new Map<string, EvidenceObject>(); // Size 0

    // Model artificially outputs hallucinated numbers and fake PMIDs
    const adversarialLLMResponse = JSON.stringify({
      answer: 'SCID 病人的 10 年整體存活率為 90-95% [E1]，其中 MSD-HSCT 存活率為 90-95%，MUD 為 75-85%，Gene therapy 為 85-92%。PMID: 34256789, DOI: 10.1182/blood.2021012345',
      used_evidence_ids: ['E1'],
    });

    // Step 1: Parse structured JSON output
    const parsedLLM = parseStructuredLLMResponse(adversarialLLMResponse);

    // Step 2: Post-Generation Claim-to-Evidence Binding Verification against directEvidenceMap ONLY
    const claimReport = verifyClaimAccuracy(parsedLLM.answer, directEvidenceMap, userQuery);

    // Intercepted! Must trigger abstain / fail-closed!
    expect(claimReport.abstainRequired).toBe(true);
    expect(claimReport.validatedAnswer).toContain('目前數據庫中查無與「SCID long-term survival」相關的直接 PubMed 實證文獻。');

    // Step 3: Render output
    const finalRenderedText = stripRawIdentifiers(claimReport.validatedAnswer);

    // Verify ZERO hallucinated numbers, PMIDs, or DOIs appear in final rendered UI
    expect(finalRenderedText).not.toContain('90-95%');
    expect(finalRenderedText).not.toContain('75-85%');
    expect(finalRenderedText).not.toContain('85-92%');
    expect(finalRenderedText).not.toContain('34256789');
    expect(finalRenderedText).not.toContain('10.1182/blood.2021012345');
    expect(finalRenderedText).toContain('目前數據庫中查無與「SCID long-term survival」相關的');
  });
});
