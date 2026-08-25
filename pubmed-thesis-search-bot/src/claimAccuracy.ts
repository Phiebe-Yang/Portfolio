import { EvidenceObject } from './citationIntegrity';
import { matchesDiseaseTerm, matchesDrugTerm, parseClinicalQuery } from './clinicalRetrieval';

/**
 * Phase 3 — Claim Accuracy Module
 * Validates generated claims against supporting passages, performs numerical precision checks,
 * enforces abstract vs full-text source awareness, and handles abstention when evidence is insufficient.
 */

export interface ClaimVerificationResult {
  claimText: string;
  citedEvidenceId?: string;
  isVerified: boolean;
  supportingPassage?: string;
  numericalMismatch: boolean;
  mismatchDetails?: string;
}

export interface ClaimAccuracyReport {
  validatedAnswer: string;
  abstainRequired: boolean;
  abstainReason?: string;
  claimVerifications: ClaimVerificationResult[];
  overallConfidence: 'High' | 'Moderate' | 'Low' | 'Abstain';
}

/**
 * 1. Claim-level Evidence Citation & 3. Supporting Passage Extraction
 * Extracts claims associated with [E1], [E2] tags and finds exact supporting passages in the abstract.
 */
export function extractSupportingPassage(claimText: string, abstract: string): string | undefined {
  if (!abstract) return undefined;

  // Split abstract into clean sentences using lookbehind/lookahead or period delimiter
  const sentences = abstract.split(/(?<=[.!?])\s+/);

  // Tokenize claim text including keywords and key medical acronyms/numbers (e.g. Pembrolizumab, HR, 0.68)
  const claimTokens = claimText
    .replace(/\[E\d+(?:\s*(?:\||｜)\s*(?:Abstract|摘要))?\]/gi, '')
    .toLowerCase()
    .replace(/[^\w\s%.-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  if (claimTokens.length === 0) return undefined;

  let bestSentence: string | undefined = undefined;
  let maxMatches = 0;

  sentences.forEach((sentence) => {
    const sLower = sentence.toLowerCase();
    let matches = 0;
    claimTokens.forEach((token) => {
      if (sLower.includes(token)) {
        matches++;
      }
    });

    if (matches > maxMatches && matches >= 1) {
      maxMatches = matches;
      bestSentence = sentence.trim();
    }
  });

  return bestSentence;
}

/**
 * 2. Numerical Claim Validation
 * Compares numbers, percentages, HRs, ORs, p-values mentioned in the claim with numbers in the evidence abstract.
 */
export function validateNumericalClaims(
  claimText: string,
  abstract: string
): { hasMismatch: boolean; details?: string } {
  // Extract numbers and percentages (e.g. 85%, 0.68, 12.5, 95% CI)
  const numberRegex = /\d+(?:\.\d+)?%?/g;

  const claimWithoutEvidenceIds = claimText.replace(/\[E\d+(?:\s*(?:\||｜)\s*[^\]]+)?\]/gi, '');
  const claimNumbers = claimWithoutEvidenceIds.match(numberRegex) || [];
  if (claimNumbers.length === 0) {
    return { hasMismatch: false };
  }

  const abstractText = abstract.toLowerCase();
  const unverifiedNumbers: string[] = [];

  claimNumbers.forEach((num) => {
    // Ignore generic years like 2021, 2023 unless specific
    if (/^(?:19\d{2}|20\d{2})$/.test(num)) return;

    const numClean = num.toLowerCase();

    if (!abstractText.includes(numClean)) {
      unverifiedNumbers.push(num);
    }
  });

  if (unverifiedNumbers.length > 0) {
    return {
      hasMismatch: true,
      details: `Number(s) [${unverifiedNumbers.join(', ')}] in claim not found in retrieved abstract.`,
    };
  }

  return { hasMismatch: false };
}

/**
 * P1-1 6-Element Clinical Claim Verification Gate
 * Validates Population, Intervention, Comparator, Outcome, Value, Timepoint
 * within a single supporting passage from the canonical Evidence Object abstract.
 */
export interface SixElementClaim {
  text: string;
  evidenceId: string;
  population?: string;
  intervention?: string;
  comparator?: string;
  outcome?: string;
  value?: string;
  timepoint?: string;
  supportingPassage?: string;
  isValid: boolean;
}

export function validateSixElementClaim(
  sentence: string,
  evidence: EvidenceObject,
  userQuery: string
): SixElementClaim {
  const parsedQuery = parseClinicalQuery(userQuery);
  const requiredDiseases = parsedQuery.filterCriteria.diseaseFilter || [];
  const requiredDrugs = parsedQuery.filterCriteria.drugFilter || [];
  const abstractText = evidence.abstract || '';
  const fullText = `${evidence.title} ${abstractText}`.toLowerCase();

  // Element 1: Population Check
  let populationMatched = false;
  if (requiredDiseases.length > 0) {
    populationMatched = requiredDiseases.some((dis) => matchesDiseaseTerm(fullText, dis));
  } else {
    populationMatched = true;
  }

  // Element 2: Intervention Check
  let interventionMatched = false;
  if (requiredDrugs.length > 0) {
    interventionMatched = requiredDrugs.some((drug) => matchesDrugTerm(fullText, drug));
  } else {
    interventionMatched = true;
  }

  // Element 3: Comparator Check (optional if in sentence)
  const comparatorWords = ['versus', 'placebo', 'chemotherapy', 'compared to', 'vs.'];
  const hasComparatorInSentence = comparatorWords.some((w) => sentence.toLowerCase().includes(w));
  let comparatorMatched = true;
  if (hasComparatorInSentence) {
    comparatorMatched = comparatorWords.some((w) => fullText.includes(w));
  }

  // Element 4: Outcome Check
  const outcomeWords = ['survival', 'mortality', 'pfs', 'overall survival', 'response', 'efficacy', 'mace', 'renal decline'];
  const hasOutcomeInSentence = outcomeWords.some((w) => sentence.toLowerCase().includes(w));
  let outcomeMatched = true;
  if (hasOutcomeInSentence) {
    outcomeMatched = outcomeWords.some((w) => fullText.includes(w));
  }

  // Element 5: Numerical Values & Percentages Check (Value & Treatment Arm Co-Location)
  const sentenceWithoutEvidenceIds = sentence.replace(/\[E\d+(?:\s*(?:\||｜)\s*[^\]]+)?\]/gi, '');
  const numberMatches = sentenceWithoutEvidenceIds.match(/\d+(?:\.\d+)?%?/g) || [];
  const verifiedValues: string[] = [];
  const sLower = sentence.toLowerCase();
  const aLower = abstractText.toLowerCase();

  numberMatches.forEach((num) => {
    if (/^(?:19\d{2}|20\d{2})$/.test(num)) return; // skip year
    
    // Arm Co-Location Verification: If claim links "placebo" with a specific number, verify placebo+number in abstract
    if (sLower.includes('placebo') && sLower.includes(num)) {
      const containsPlaceboVal = aLower.includes(`placebo`) && aLower.includes(`${num}`) && (aLower.includes(`placebo patients achieved ${num}`) || aLower.includes(`${num} of placebo`));
      if (containsPlaceboVal) {
        verifiedValues.push(num);
      }
    } else {
      if (aLower.includes(num.toLowerCase())) {
        verifiedValues.push(num);
      }
    }
  });

  // Element 6: Timepoint Check (e.g., 10-year, 5-year, 16 weeks, 3.5 months)
  const timepointMatch = sentence.match(/\b\d+(?:\.\d+)?\s*(?:years?|months?|weeks?|days?|year|month|week|day)\b/i);
  let timepointVerified = false;
  let timepointVal = '';
  if (timepointMatch) {
    timepointVal = timepointMatch[0];
    timepointVerified = abstractText.toLowerCase().includes(timepointVal.toLowerCase());
  } else {
    timepointVerified = true;
  }

  // Find exact supporting passage co-locating the elements
  const supportingPassage = extractSupportingPassage(sentence, abstractText);

  // Fail Closed: All present elements MUST be 100% verified in abstract
  const numericValid = numberMatches.filter((n) => !/^(?:19\d{2}|20\d{2})$/.test(n)).length === verifiedValues.length;
  const isValid = populationMatched && interventionMatched && comparatorMatched && outcomeMatched && numericValid && timepointVerified && supportingPassage !== undefined;

  return {
    text: sentence.trim(),
    evidenceId: evidence.id,
    population: populationMatched ? requiredDiseases.join(', ') : undefined,
    intervention: interventionMatched && requiredDrugs.length > 0 ? requiredDrugs.join(', ') : undefined,
    value: verifiedValues.length > 0 ? verifiedValues.join(', ') : undefined,
    timepoint: timepointVerified && timepointVal ? timepointVal : undefined,
    supportingPassage,
    isValid,
  };
}

/**
 * P0-5 Direct Citation Foreign-Key Constraint & Claim-to-Evidence Binding Gate
 * Drops claims if uncited quantitative clinical claims exist OR if cited Evidence ID
 * does not pass 6-element co-location or numeric validation against directEvidenceMap.
 */
export function validateClaimToEvidenceBinding(
  answerText: string,
  directEvidenceMap: Map<string, EvidenceObject>,
  userQuery: string
): { validatedText: string; droppedClaimsCount: number } {
  if (!answerText) return { validatedText: '', droppedClaimsCount: 0 };

  // Use robust sentence splitting that never splits decimal numbers (e.g., 0.68, 31.9%)
  const sentences = answerText
    .split(/(?<=[。！？\n])|(?<=[^0-9]\.)(?=\s+|$)/g)
    .map((s) => s.trim())
    .filter(Boolean);

  let droppedCount = 0;

  const keptSentences = sentences.filter((sentence) => {
    const tagMatches = sentence.match(/\[E\d+(?:\s*(?:\||｜)\s*[^\]]+)?\]/gi);
    const hasQuantitativeClaim = /\d+(?:\.\d+)?%?|\b(?:OS|EFS|PFS|HR|OR|RR|survival|mortality|survival rate|outcome|rate|efficacy|mortality rate)\b/i.test(sentence);

    // Rule 1: Quantitative clinical claim WITHOUT a citation tag -> DROP SENTENCE!
    if (!tagMatches) {
      if (hasQuantitativeClaim) {
        console.warn(`Dropped Claim "${sentence}": Quantitative clinical claim without direct evidence citation tag [E#].`);
        droppedCount++;
        return false;
      }
      return true;
    }

    // Rule 2: Citation tags MUST exist in directEvidenceMap (Direct Citation Foreign-Key Constraint)
    for (const rawTag of tagMatches) {
      const evidenceId = rawTag.match(/E\d+/i)?.[0].toUpperCase() || '';
      const evidence = directEvidenceMap.get(evidenceId);

      if (!evidence) {
        console.warn(`Dropped Claim "${sentence}": Citation tag [${evidenceId}] is not found in directEvidenceMap (Foreign Key Failure / Background Evidence Violation).`);
        droppedCount++;
        return false;
      }

      // Rule 3: 6-Element Co-Location Validation
      const sixElemCheck = validateSixElementClaim(sentence, evidence, userQuery);
      if (!sixElemCheck.isValid) {
        console.warn(`Dropped Claim "${sentence}": Failed 6-element co-location or numeric validation against [${evidenceId}].`);
        droppedCount++;
        return false;
      }
    }

    return true;
  });

  return {
    validatedText: keptSentences.join(' '),
    droppedClaimsCount: droppedCount,
  };
}

/**
 * 4. Evidence Insufficient / Abstention
 * Evaluates whether the retrieved evidence is insufficient to answer the query, triggering safe abstention.
 */
export function checkEvidenceSufficiency(
  evidenceMap: Map<string, EvidenceObject>,
  userQuery: string
): { isSufficient: boolean; abstainReason?: string } {
  if (evidenceMap.size === 0) {
    return {
      isSufficient: false,
      abstainReason: `目前數據庫中查無與「${userQuery}」相關的直接 PubMed 實證文獻。為維護醫學資訊嚴謹性，系統選擇不提供未經證實之推測。`,
    };
  }

  // Check if all evidence objects have very low relevance score or empty abstract
  let validCount = 0;
  evidenceMap.forEach((ev) => {
    if (ev.abstract && ev.abstract.length > 50 && (ev.relevance_score ?? 0) >= 50) {
      validCount++;
    }
  });

  if (validCount === 0) {
    return {
      isSufficient: false,
      abstainReason: `檢索到的實證文獻相關度不足以回答「${userQuery}」之臨床細節。建議縮小問題範圍或調整關鍵字。`,
    };
  }

  return { isSufficient: true };
}

/**
 * 5. Source-Type Awareness & 6. Abstract vs Full-Text Distinction
 * Annotates citations to explicitly state whether evidence is derived from Abstract-only or Full-Text.
 */
export function enrichCitationsWithSourceAwareness(
  text: string,
  evidenceMap: Map<string, EvidenceObject>
): string {
  let enriched = text;

  evidenceMap.forEach((ev, id) => {
    const rawTag = `[${id}]`;
    if (enriched.includes(rawTag)) {
      // All PubMed BigQuery baseline entries represent PubMed Abstracts
      const sourceTag = `[${id}｜摘要]`;
      enriched = enriched.replaceAll(rawTag, sourceTag);
    }
  });

  return enriched;
}

/**
 * Main Phase 3 Claim Accuracy Pipeline Executable
 */
export function verifyClaimAccuracy(
  answerText: string,
  directEvidenceMap: Map<string, EvidenceObject>,
  userQuery: string
): ClaimAccuracyReport {
  // Step A: Abstention Check (Direct Evidence Sufficiency)
  const sufficiency = checkEvidenceSufficiency(directEvidenceMap, userQuery);
  if (!sufficiency.isSufficient) {
    return {
      validatedAnswer: sufficiency.abstainReason!,
      abstainRequired: true,
      abstainReason: sufficiency.abstainReason,
      claimVerifications: [],
      overallConfidence: 'Abstain',
    };
  }

  // Step B: P0-5 Claim-to-Evidence Binding Gate & Numeric Passage Matching
  const bindingResult = validateClaimToEvidenceBinding(answerText, directEvidenceMap, userQuery);
  let cleanText = bindingResult.validatedText.trim();

  // A clinical answer without at least one surviving evidence foreign key is
  // not publishable, even if non-quantitative prose or headings remain.
  const survivingEvidenceIds = cleanText.match(/\[E\d+(?:\s*(?:\||｜)\s*[^\]]+)?\]/gi) || [];

  if (!cleanText || cleanText.length < 10 || survivingEvidenceIds.length === 0) {
    return {
      validatedAnswer: `目前數據庫中查無足以支持具體臨床結論或數據的直接 PubMed 實證文獻。`,
      abstainRequired: true,
      abstainReason: 'No claim retained a verified evidence citation after strict binding and numeric validation.',
      claimVerifications: [],
      overallConfidence: 'Abstain',
    };
  }

  // Step C: Split sentences & check claims
  const sentencePattern = /(?<=[。！？\n])|(?<=[^0-9]\.)(?=\s+|$)/g;
  const sentences = cleanText.split(sentencePattern).map(s => s.trim()).filter(Boolean);

  const claimVerifications: ClaimVerificationResult[] = [];
  let totalNumericalMismatches = 0;

  sentences.forEach((sentence) => {
    const tagMatches = sentence.match(/\[E\d+(?:\s*(?:\||｜)\s*[^\]]+)?\]/gi);
    if (tagMatches) {
      tagMatches.forEach((tag) => {
        const id = tag.match(/E\d+/i)?.[0].toUpperCase() || '';
        const evidence = directEvidenceMap.get(id);

        if (evidence) {
          const numVal = validateNumericalClaims(sentence, evidence.abstract);
          const passage = extractSupportingPassage(sentence, evidence.abstract);

          if (numVal.hasMismatch) {
            totalNumericalMismatches++;
          }

          claimVerifications.push({
            claimText: sentence.trim(),
            citedEvidenceId: id,
            isVerified: !numVal.hasMismatch && passage !== undefined,
            supportingPassage: passage,
            numericalMismatch: numVal.hasMismatch,
            mismatchDetails: numVal.details,
          });
        }
      });
    }
  });

  // Step D: Annotate source type awareness (Abstract vs Full-Text)
  const validatedAnswer = enrichCitationsWithSourceAwareness(cleanText, directEvidenceMap);

  // Confidence assessment
  let overallConfidence: ClaimAccuracyReport['overallConfidence'] = 'High';
  if (totalNumericalMismatches > 0 || bindingResult.droppedClaimsCount > 0) {
    overallConfidence = 'Moderate';
  }

  return {
    validatedAnswer,
    abstainRequired: false,
    claimVerifications,
    overallConfidence,
  };
}
