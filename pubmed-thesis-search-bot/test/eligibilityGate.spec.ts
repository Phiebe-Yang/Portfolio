import { describe, it, expect } from 'vitest';
import { parseClinicalQuery, applyClinicalFilters } from '../src/clinicalRetrieval';
import { validateClaimToEvidenceBinding } from '../src/claimAccuracy';
import { EvidenceObject } from '../src/citationIntegrity';

describe('Known-Negative Regression & Evidence Eligibility Gate Suite', () => {
  const scidQuery = parseClinicalQuery('SCID long-term survival');

  // Known Negative Non-SCID PMIDs reported in audit (including Sugarcane paper PMID 34256789)
  const knownNegativeArticles = [
    {
      pmid: '34256789', // Canonical NCBI Title: Sugarcane phenotyping study
      title: 'A systematic high-throughput phenotyping assay for sugarcane stalk quality characterization by near-infrared spectroscopy.',
      abstract: 'High throughput screening for sugarcane stalk quality parameters.',
      publication_date: '2021-07',
      journal: 'Plant Methods',
      doi: '10.1186/s13007-021-00777-8',
    },
    {
      pmid: '32172410',
      title: 'Emergency endovascular treatments for delayed hemorrhage after pancreaticobiliary surgery',
      abstract: 'Retrospective cohort on pancreaticobiliary surgery outcomes.',
      publication_date: '2020-08',
      journal: 'Abdom Radiol',
      doi: '10.1007/s00261-020-02480-z',
    },
    {
      pmid: '34217891',
      title: 'Pregnancy Tdap Vaccination and Infant Outcomes',
      abstract: 'Evaluating maternal Tdap immunization in pregnant women.',
      publication_date: '2021-03',
      journal: 'J Pediatr',
      doi: '10.1016/j.jpeds.2021.03.015',
    },
    {
      pmid: '34567890',
      title: 'Multicenter Study on Hepatic Resection Techniques',
      abstract: 'Clinical outcomes after major liver resection.',
      publication_date: '2021-09',
      journal: 'Ann Surg',
    },
    {
      pmid: '33745997',
      title: 'Cardiovascular Risk in Adult Hypertension',
      abstract: 'Observational trial on blood pressure control in adults.',
      publication_date: '2021-03',
      journal: 'Hypertension',
    },
  ];

  it('P0-9 Known-Negative Hard Reject: Non-SCID papers MUST fail eligibility for SCID query', () => {
    knownNegativeArticles.forEach((article) => {
      const isEligible = applyClinicalFilters([article], scidQuery.filterCriteria);
      expect(isEligible).toHaveLength(0); // Hard rejected!
    });
  });

  it('P0-5 Claim-to-Evidence Binding Gate: Drops LLM claims that attempt to cite non-SCID evidence for SCID claims', () => {
    const mockEvidenceMap = new Map<string, EvidenceObject>();
    mockEvidenceMap.set('E1', {
      id: 'E1',
      pmid: '32172410',
      title: 'Pancreaticobiliary Surgery',
      abstract: 'Endovascular treatments for delayed hemorrhage after pancreaticobiliary surgery.',
      publication_date: '2020-08',
      journal: 'Abdom Radiol',
      trial_names: [],
    });

    const hallucinatedLLMAnswer = 'SCID 病人的 10 年整體存活率為 90-95% [E1]。';
    const bindingResult = validateClaimToEvidenceBinding(hallucinatedLLMAnswer, mockEvidenceMap, 'SCID long-term survival');

    expect(bindingResult.droppedClaimsCount).toBe(1);
    expect(bindingResult.validatedText).toBe(''); // Dropped completely because E1 is NOT a SCID paper!
  });

  it('Known Positive SCID Paper: Passes Evidence Eligibility Gate', () => {
    const positiveSCIDArticle = {
      pmid: '38367737', // True Canonical NCBI SCID Paper
      title: 'Immune reconstitution following hematopoietic stem cell transplantation for severe combined immunodeficiency',
      abstract: 'Immune reconstitution and long-term outcomes following hematopoietic stem cell transplantation (HSCT) for severe combined immunodeficiency (SCID).',
      publication_date: '2024 Apr',
      journal: 'Clin Immunol',
      doi: '10.1016/j.clim.2024.109939',
    };

    const eligible = applyClinicalFilters([positiveSCIDArticle], scidQuery.filterCriteria);
    expect(eligible).toHaveLength(1);
    expect(eligible[0].pmid).toBe('38367737');
  });
});
