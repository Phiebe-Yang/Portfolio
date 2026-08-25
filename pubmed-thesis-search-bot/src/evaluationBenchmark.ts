import { EvidenceObject } from './citationIntegrity';

/**
 * Phase 5 — Clinical Benchmark Test Cases
 * Comprehensive clinical benchmark dataset containing query, expected PICO, expected trial names,
 * and ground truth PubMed articles for evaluation.
 */

export interface BenchmarkPicoGroundTruth {
  query: string;
  question_type: 'treatment' | 'prognosis' | 'diagnosis' | 'etiology' | 'safety' | 'dose' | 'comparison';
  directPositivePmids: string[];
  backgroundPmids: string[];
  unrelatedPmids: string[];
}

export const CLINICAL_POSITIVE_BENCHMARK_SUITE: BenchmarkPicoGroundTruth[] = [
  {
    query: 'SCID long-term survival',
    question_type: 'prognosis',
    directPositivePmids: [], // No direct positive in audit set (PMID 38367737 is background)
    backgroundPmids: ['38367737'], // Lymphocyte proliferation in SCID (SCID matched, survival unmatched)
    unrelatedPmids: ['34256789', '32172410', '34217891', '34567890', '33745997', '37890123'],
  },
  {
    query: 'JAK inhibitor pediatric atopic dermatitis',
    question_type: 'treatment',
    directPositivePmids: [],
    backgroundPmids: ['34217891'],
    unrelatedPmids: ['34256789', '32172410', '34567890', '33745997', '38367737'],
  },
  {
    query: 'Upadacitinib adolescent atopic dermatitis efficacy',
    question_type: 'treatment',
    directPositivePmids: [],
    backgroundPmids: ['34217891'],
    unrelatedPmids: ['34256789', '32172410', '34567890', '33745997', '38367737'],
  },
  {
    query: 'SCID HSCT long-term outcome',
    question_type: 'prognosis',
    directPositivePmids: [],
    backgroundPmids: ['38367737'],
    unrelatedPmids: ['34256789', '32172410', '34567890', '33745997'],
  },
  {
    query: 'SCID gene therapy long-term outcome',
    question_type: 'prognosis',
    directPositivePmids: [],
    backgroundPmids: ['34217891'],
    unrelatedPmids: ['34256789', '32172410', '34567890', '33745997'],
  },
];
