import { describe, it, expect } from 'vitest';
import {
  parseClinicalQuery,
  buildEnhancedSearchQuery,
  applyClinicalFilters,
  rerankClinicalEvidence,
} from '../src/clinicalRetrieval';
import { PubMedArticle } from '../src/pubmedBigQuery';

describe('Phase 2 — Retrieval Quality', () => {
  const mockCandidates: PubMedArticle[] = [
    {
      pmid: '30000001',
      title: 'Pembrolizumab versus Chemotherapy in Advanced Non-Small Cell Lung Cancer (NSCLC)',
      abstract: 'A randomized controlled trial (RCT) evaluated Pembrolizumab (Keytruda) in elderly patients with NSCLC. Overall survival was significantly improved in 2023.',
      authors: ['Smith A', 'Johnson B'],
      publication_date: '2023-05',
      journal: 'Lancet Oncol',
      relevance_score: 80,
    },
    {
      pmid: '30000002',
      title: 'Observational Study of Chemotherapy in Breast Cancer Patients',
      abstract: 'Retrospective cohort of breast cancer patients treated with standard chemotherapy.',
      authors: ['Lee C'],
      publication_date: '2018-01',
      journal: 'Breast Cancer Res',
      relevance_score: 70,
    },
    {
      pmid: '30000003',
      title: 'Meta-Analysis of Pembrolizumab plus Chemotherapy in Advanced NSCLC',
      abstract: 'Systematic review and meta-analysis of phase 3 randomized trials for NSCLC using Keytruda in 2024.',
      authors: ['Zhang Y', 'Wang X'],
      publication_date: '2024-02',
      journal: 'J Clin Oncol',
      relevance_score: 85,
    },
  ];

  it('1. Clinical Query Parser & 2. PICO extraction: extracts PICO elements accurately', () => {
    const query = 'Is pembrolizumab effective for elderly patients with advanced NSCLC in randomized controlled trial?';
    const parsed = parseClinicalQuery(query);

    expect(parsed.pico.i).toContain('pembrolizumab');
    expect(parsed.pico.p).toContain('nsclc');
    expect(parsed.pico.p).toContain('elderly');
    expect(parsed.pico.p).toContain('advanced');

    expect(parsed.filterCriteria.drugFilter).toContain('pembrolizumab');
    expect(parsed.filterCriteria.diseaseFilter).toContain('nsclc');
    expect(parsed.filterCriteria.studyTypeFilter).toContain('RCT');
  });

  it('3. Query expansion: expands drug and disease synonyms', () => {
    const query = 'Keytruda for NSCLC';
    const parsed = parseClinicalQuery(query);

    expect(parsed.expandedKeywords).toContain('pembrolizumab');
    expect(parsed.expandedKeywords).toContain('keytruda');
    expect(parsed.expandedKeywords).toContain('non-small cell lung cancer');
  });

  it('4. Candidate retrieval SQL builder: includes expanded keywords and study type filters', () => {
    const query = 'Pembrolizumab for NSCLC RCT';
    const parsed = parseClinicalQuery(query);
    const sql = buildEnhancedSearchQuery(parsed, 10);

    expect(sql).toContain('pembrolizumab');
    expect(sql).toContain('ncbi-bigquery.pubmed.baseline');
    expect(sql).toContain('LIMIT 10');
  });

  it('5-8. Filters (Disease, Drug, Population, Study Type): filters out non-matching articles', () => {
    const parsed = parseClinicalQuery('Pembrolizumab for NSCLC');
    const filtered = applyClinicalFilters(mockCandidates, parsed.filterCriteria);

    // Article 30000002 is for Breast Cancer, not NSCLC
    expect(filtered).toHaveLength(2);
    expect(filtered.map((a) => a.pmid)).toEqual(['30000001', '30000003']);
  });

  it('9. Clinical relevance reranking & 10. Direct vs Related evidence: prioritizes direct evidence and high study hierarchy', () => {
    const parsed = parseClinicalQuery('Pembrolizumab for NSCLC in 2024');
    const reranked = rerankClinicalEvidence(mockCandidates, parsed);

    // Both 30000001 and 30000003 match Pembrolizumab and NSCLC (Direct Evidence)
    expect(reranked[0].evidenceType).toBe('direct');
    expect(reranked[1].evidenceType).toBe('direct');
    expect(reranked[2].evidenceType).toBe('related'); // Breast cancer

    // Meta-analysis 30000003 from 2024 should rank highest
    expect(reranked[0].pmid).toBe('30000003');
    expect(reranked[0].clinicalScore).toBeGreaterThan(reranked[1].clinicalScore);
  });
});
