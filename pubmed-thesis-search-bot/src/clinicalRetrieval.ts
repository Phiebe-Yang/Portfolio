import { PubMedArticle } from './pubmedBigQuery';

/**
 * Phase 2 — Retrieval Quality Module
 * Advanced clinical retrieval pipeline incorporating PICO extraction, Query Expansion,
 * multi-faceted filtering (Disease, Drug, Population, Study Type), and Clinical Relevance Reranking.
 */

export interface PICOStructure {
  p: string[]; // Population / Patient / Problem (e.g. "elderly", "breast cancer", "NSCLC")
  i: string[]; // Intervention (e.g. "pembrolizumab", "Olaparib", "CAR-T")
  c: string[]; // Comparison / Control (e.g. "chemotherapy", "placebo", "standard of care")
  o: string[]; // Outcome (e.g. "overall survival", "progression-free survival", "mortality")
}

export interface ParsedClinicalQuery {
  originalQuery: string;
  pico: PICOStructure;
  expandedKeywords: string[];
  filterCriteria: {
    diseaseFilter?: string[];
    drugFilter?: string[];
    populationFilter?: string[];
    studyTypeFilter?: ('RCT' | 'Systematic Review' | 'Meta-Analysis' | 'Observational' | 'Clinical Trial')[];
    dateFilter?: {
      from: string;
      to?: string;
      precision: 'month' | 'year';
      mode: 'from' | 'exact';
    };
  };
}

export interface RerankedArticle extends PubMedArticle {
  clinicalScore: number; // 0-100
  evidenceType: 'direct' | 'related';
  evidenceCategory: 'Direct Evidence' | 'Partially Relevant' | 'Background / Related Evidence';
  conditionMatchStatus: 'confirmed' | 'mismatch' | 'unconfirmed';
  interventionMatchStatus: 'confirmed' | 'mismatch' | 'unconfirmed';
  populationMatchStatus: 'confirmed' | 'partial' | 'mismatch' | 'unconfirmed';
  populationDetail: string;
  sampleSize: string;
  studyDuration: string;
  studyDesign: string;
  matchBreakdown: {
    diseaseMatch: boolean;
    drugMatch: boolean;
    studyTypeBonus: number;
    recencyBonus: number;
  };
}

/**
 * Common Dictionary for Clinical Query Parsing & Synonyms Expansion
 */
const DRUG_SYNONYMS: Record<string, string[]> = {
  'glp-1 receptor agonist': [
    'glp-1', 'glp1', 'glucagon-like peptide-1 receptor agonist',
    'semaglutide', 'liraglutide', 'dulaglutide', 'exenatide',
    'lixisenatide', 'tirzepatide'
  ],
  'jak inhibitor': [
    'janus kinase inhibitor',
    'upadacitinib',
    'abrocitinib',
    'baricitinib',
    'ruxolitinib',
    'delgocitinib',
    'tofacitinib'
  ],
  upadacitinib: ['rinvoq', 'jak1 inhibitor', 'janus kinase 1 inhibitor'],
  abrocitinib: ['cibinqo', 'jak1 inhibitor', 'janus kinase 1 inhibitor'],
  baricitinib: ['olumiant', 'jak1 jak2 inhibitor', 'janus kinase inhibitor'],
  ruxolitinib: ['opzelura', 'jak1 jak2 inhibitor', 'topical jak inhibitor'],
  delgocitinib: ['corectim', 'pan-jak inhibitor', 'topical jak inhibitor'],
  pembrolizumab: ['keytruda', 'pd-1 inhibitor', 'pd-l1 blocker'],
  keytruda: ['pembrolizumab', 'pd-1 inhibitor'],
  nivolumab: ['opdivo', 'pd-1 inhibitor'],
  ipilimumab: ['yervoy', 'ctla-4 inhibitor'],
  trastuzumab: ['herceptin', 'her2 blocker', 'anti-her2'],
  olaparib: ['lynparza', 'parp inhibitor'],
  osimertinib: ['tagrisso', 'egfr inhibitor', '3rd-gen egfr tki'],
  dapagliflozin: ['farxiga', 'farxiga/forxiga', 'sglt2 inhibitor', 'sglt-2 blocker'],
  metformin: ['glucophage', 'biguanide'],
  semaglutide: ['ozempic', 'wegovy', 'glp-1 agonist', 'glp-1 receptor agonist'],
  liraglutide: ['victoza', 'saxenda', 'glp-1 receptor agonist'],
  dulaglutide: ['trulicity', 'glp-1 receptor agonist'],
  tirzepatide: ['mounjaro', 'zepbound', 'dual gip glp-1 receptor agonist'],
};

const DISEASE_SYNONYMS: Record<string, string[]> = {
  'atopic dermatitis': ['atopic eczema', 'eczema', '異位性皮膚炎', '異位性皮炎'],
  scid: [
    'severe combined immunodeficiency',
    'severe combined immune deficiency',
    'scid patients',
    'x-linked scid',
    'x-scid',
    'ada-scid',
    'il2rg deficiency',
    'rag1 deficiency',
    'rag2 deficiency',
    'jak3 deficiency',
    'artemis deficiency',
    'adenosine deaminase deficiency'
  ],
  nsclc: ['non-small cell lung cancer', 'lung adenocarcinoma', 'lung carcinoma'],
  'breast cancer': ['mammary carcinoma', 'breast neoplasm', 'breast tumor'],
  melanoma: ['malignant melanoma', 'skin cancer'],
  'type 2 diabetes': ['t2dm', 'type ii diabetes', 'non-insulin dependent diabetes'],
  obesity: ['obese', 'overweight', 'adiposity', 'weight loss'],
  ckd: ['chronic kidney disease', 'renal disease', 'renal decline', 'nephropathy'],
  covid19: ['sars-cov-2', 'coronavirus', '2019-ncov'],
  'prostate cancer': ['prostatic adenocarcinoma', 'prostate carcinoma'],
};

const CHINESE_CLINICAL_TERMS: Array<[RegExp, string]> = [
  [/異位性皮膚炎|異位性皮炎/g, ' atopic dermatitis '],
  [/嚴重複合型免疫缺乏症|重症複合型免疫缺乏症/g, ' severe combined immunodeficiency '],
  [/兒童|小兒/g, ' pediatric '],
  [/青少年/g, ' adolescent '],
  [/成人/g, ' adult '],
  [/老年人|高齡/g, ' elderly '],
  [/隨機(?:分派)?對照試驗/g, ' randomized controlled trial '],
  [/系統性回顧/g, ' systematic review '],
  [/統合分析|薈萃分析/g, ' meta-analysis '],
  [/存活率|生存率/g, ' survival '],
  [/死亡率/g, ' mortality '],
  [/療效|有效性/g, ' efficacy '],
  [/安全性|不良反應/g, ' safety adverse events '],
  [/使用|治療/g, ' treatment '],
];

const POPULATION_SYNONYMS: Record<string, string[]> = {
  pediatric: ['pediatric', 'paediatric', 'child', 'children', 'adolescent', 'adolescents'],
  children: ['child', 'children', 'pediatric', 'paediatric', 'adolescent', 'adolescents'],
  adolescent: ['adolescent', 'adolescents', 'teen', 'youth', 'pediatric', 'paediatric'],
  adolescents: ['adolescent', 'adolescents', 'teen', 'youth', 'pediatric', 'paediatric'],
  adult: ['adult', 'adults'],
  elderly: ['elderly', 'aged', 'geriatric', 'older adult'],
};

function normalizeClinicalQuery(query: string): string {
  return CHINESE_CLINICAL_TERMS.reduce(
    (normalized, [pattern, replacement]) => normalized.replace(pattern, replacement),
    query
  ).replace(/\s+/g, ' ').trim();
}

const CHINESE_MONTHS: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6,
  七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 十二: 12,
};

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parsePublicationDateFilter(query: string): ParsedClinicalQuery['filterCriteria']['dateFilter'] {
  const numericMonth = query.match(/\b(20\d{2})\s*(?:年|[/.\-])\s*(0?[1-9]|1[0-2])\s*月?/i);
  const chineseMonth = query.match(/\b(20\d{2})\s*(?:年\s*)?(十二|十一|十|[一二三四五六七八九])月/);
  const monthMatch = numericMonth || chineseMonth;

  if (monthMatch) {
    const year = Number(monthMatch[1]);
    const month = numericMonth ? Number(monthMatch[2]) : CHINESE_MONTHS[monthMatch[2]];
    const matchIndex = monthMatch.index || 0;
    const nearbyText = query.slice(Math.max(0, matchIndex - 4), matchIndex + monthMatch[0].length + 12);
    const fromMode = /(?:後|以后|以後|之後|起|迄今|至今|after|since|onward)/i.test(nearbyText);

    return {
      from: isoDate(year, month, 1),
      to: fromMode ? undefined : isoDate(year, month, lastDayOfMonth(year, month)),
      precision: 'month',
      mode: fromMode ? 'from' : 'exact',
    };
  }

  const yearMatch = query.match(/\b(20\d{2})\b/);
  if (!yearMatch) return undefined;
  const year = Number(yearMatch[1]);
  const suffix = query.slice((yearMatch.index || 0) + yearMatch[0].length, (yearMatch.index || 0) + yearMatch[0].length + 12);
  const fromMode = /(?:後|以后|以後|之後|起|迄今|至今|after|since|onward)/i.test(suffix);
  return {
    from: isoDate(year, 1, 1),
    to: fromMode ? undefined : isoDate(year, 12, 31),
    precision: 'year',
    mode: fromMode ? 'from' : 'exact',
  };
}

function publicationYearMonth(value?: string): { year: number; month?: number } | undefined {
  if (!value) return undefined;
  const yearMatch = value.match(/\b(19\d{2}|20\d{2})\b/);
  if (!yearMatch) return undefined;
  const year = Number(yearMatch[1]);
  const tail = value.slice((yearMatch.index || 0) + yearMatch[0].length);
  const numericMonth = tail.match(/^[\s/\-.]*(0?[1-9]|1[0-2])(?:\D|$)/);
  if (numericMonth) return { year, month: Number(numericMonth[1]) };

  const monthNames: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
    aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10,
    october: 10, nov: 11, november: 11, dec: 12, december: 12,
  };
  const nameMatch = tail.toLowerCase().match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\b/);
  return nameMatch ? { year, month: monthNames[nameMatch[1]] } : { year };
}

export function filterArticlesByPublicationDate(
  articles: PubMedArticle[],
  dateFilter?: ParsedClinicalQuery['filterCriteria']['dateFilter']
): PubMedArticle[] {
  if (!dateFilter) return articles;
  const fromYear = Number(dateFilter.from.slice(0, 4));
  const fromMonth = Number(dateFilter.from.slice(5, 7));
  const toYear = dateFilter.to ? Number(dateFilter.to.slice(0, 4)) : undefined;
  const toMonth = dateFilter.to ? Number(dateFilter.to.slice(5, 7)) : undefined;

  return articles.filter((article) => {
    const parsed = publicationYearMonth(
      article.first_publication_date || article.electronic_publication_date || article.publication_date
    );
    if (!parsed) return false;
    if (parsed.year < fromYear) return false;
    if (parsed.year === fromYear && fromMonth > 1 && (!parsed.month || parsed.month < fromMonth)) return false;
    if (toYear !== undefined && parsed.year > toYear) return false;
    if (toYear !== undefined && toMonth !== undefined && parsed.year === toYear && toMonth < 12 && (!parsed.month || parsed.month > toMonth)) return false;
    return true;
  });
}

const STUDY_TYPE_KEYWORDS: Record<string, string[]> = {
  RCT: ['randomized controlled trial', 'randomised', 'rct', 'double-blind', 'placebo-controlled'],
  'Systematic Review': ['systematic review', 'prisma', 'scoping review'],
  'Meta-Analysis': ['meta-analysis', 'meta analysis', 'pooled analysis'],
  'Clinical Trial': ['clinical trial', 'phase 1', 'phase 2', 'phase 3', 'phase i', 'phase ii', 'phase iii'],
  Observational: ['cohort study', 'case-control', 'cross-sectional', 'observational'],
};

/** Shared entity matchers used by both retrieval and post-generation validation. */
export function matchesDiseaseTerm(text: string, disease: string): boolean {
  const lower = text.toLowerCase();
  return [disease, ...(DISEASE_SYNONYMS[disease] || [])]
    .some((term) => lower.includes(term.toLowerCase()));
}

export function matchesDrugTerm(text: string, drug: string): boolean {
  const lower = text.toLowerCase();
  return [drug, ...(DRUG_SYNONYMS[drug] || [])]
    .some((term) => lower.includes(term.toLowerCase()));
}

/**
 * 1. Clinical Query Parser & 2. PICO / Entity Extraction
 * Parses unstructured clinical queries into structured PICO elements and filters.
 */
export function parseClinicalQuery(query: string): ParsedClinicalQuery {
  const normalizedQuery = normalizeClinicalQuery(query);
  const lower = normalizedQuery.toLowerCase();

  const pico: PICOStructure = { p: [], i: [], c: [], o: [] };
  const filterCriteria: ParsedClinicalQuery['filterCriteria'] = {};
  const dateFilter = parsePublicationDateFilter(query);
  if (dateFilter) filterCriteria.dateFilter = dateFilter;

  // Extract Intervention (Drugs)
  const drugMatches: string[] = [];
  Object.keys(DRUG_SYNONYMS).forEach((drugKey) => {
    if (lower.includes(drugKey)) {
      drugMatches.push(drugKey);
    } else {
      DRUG_SYNONYMS[drugKey].forEach((syn) => {
        if (lower.includes(syn)) {
          drugMatches.push(drugKey);
        }
      });
    }
  });
  if (drugMatches.length > 0) {
    pico.i = Array.from(new Set(drugMatches));
    filterCriteria.drugFilter = pico.i;
  }

  // Extract Disease (Population)
  const diseaseMatches: string[] = [];
  Object.keys(DISEASE_SYNONYMS).forEach((disKey) => {
    if (lower.includes(disKey)) {
      diseaseMatches.push(disKey);
    } else {
      DISEASE_SYNONYMS[disKey].forEach((syn) => {
        if (lower.includes(syn)) {
          diseaseMatches.push(disKey);
        }
      });
    }
  });
  if (diseaseMatches.length > 0) {
    pico.p = Array.from(new Set(diseaseMatches));
    filterCriteria.diseaseFilter = pico.p;
  }

  // Extract Population traits (elderly, pediatric, female, male, advanced, metastatic)
  const popTraits = ['elderly', 'pediatric', 'children', 'adolescent', 'adolescents', 'adult', 'female', 'male', 'advanced', 'metastatic', 'recurrent', 'refractory'];
  const matchedPop = popTraits.filter((trait) => lower.includes(trait));
  if (matchedPop.length > 0) {
    pico.p.push(...matchedPop);
    filterCriteria.populationFilter = matchedPop;
  }

  // Extract Outcomes
  const outcomeTraits = ['survival', 'mortality', 'progression-free', 'pfs', 'overall survival', 'os', 'response rate', 'safety', 'adverse events', 'efficacy'];
  const matchedOutcomes = outcomeTraits.filter((out) => lower.includes(out));
  if (matchedOutcomes.length > 0) {
    pico.o = matchedOutcomes;
  }

  // Extract Study Type Filters
  const matchedStudyTypes: ('RCT' | 'Systematic Review' | 'Meta-Analysis' | 'Observational' | 'Clinical Trial')[] = [];
  Object.entries(STUDY_TYPE_KEYWORDS).forEach(([stType, kwList]) => {
    if (kwList.some((kw) => lower.includes(kw))) {
      matchedStudyTypes.push(stType as any);
    }
  });
  if (matchedStudyTypes.length > 0) {
    filterCriteria.studyTypeFilter = matchedStudyTypes;
  }

  // 3. Query Expansion
  const expandedSet = new Set<string>();
  // Add original non-stopword tokens
  normalizedQuery
    .split(/\s+/)
    .map((w) => w.replace(/[^\w-]/g, '').toLowerCase())
    .filter((w) => w.length > 2 && !['the', 'and', 'for', 'with', 'what', 'how', 'does', 'show'].includes(w))
    .forEach((w) => expandedSet.add(w));

  // Expand drug synonyms
  pico.i.forEach((drug) => {
    expandedSet.add(drug);
    (DRUG_SYNONYMS[drug] || []).forEach((syn) => expandedSet.add(syn));
  });

  // Expand disease synonyms
  pico.p.forEach((dis) => {
    expandedSet.add(dis);
    (DISEASE_SYNONYMS[dis] || []).forEach((syn) => expandedSet.add(syn));
  });

  return {
    originalQuery: query,
    pico,
    expandedKeywords: Array.from(expandedSet),
    filterCriteria,
  };
}

/**
 * Builds an Entrez/PubMed query from the same parsed PICO dimensions used by
 * BigQuery. Keeping this deterministic avoids asking the language model to
 * invent search terms and makes Traditional-Chinese questions searchable.
 */
export function buildPubMedSearchTerm(parsed: ParsedClinicalQuery): string {
  const fieldedGroup = (terms: string[]): string => {
    const unique = Array.from(new Set(terms.map((term) => term.trim()).filter(Boolean)));
    return `(${unique.map((term) => `"${term.replace(/"/g, '')}"[Title/Abstract]`).join(' OR ')})`;
  };

  const dimensions: string[] = [];
  const diseases = parsed.pico.p
    .filter((term) => DISEASE_SYNONYMS[term])
    .flatMap((term) => [term, ...(DISEASE_SYNONYMS[term] || [])])
    .filter((term) => !/[\u3400-\u9fff]/u.test(term));
  const interventions = parsed.pico.i
    .flatMap((term) => [term, ...(DRUG_SYNONYMS[term] || [])]);
  const populations = (parsed.filterCriteria.populationFilter || [])
    .flatMap((term) => POPULATION_SYNONYMS[term] || [term]);
  const outcomes = parsed.pico.o || [];

  if (diseases.length > 0) dimensions.push(fieldedGroup(diseases));
  if (interventions.length > 0) dimensions.push(fieldedGroup(interventions));
  if (populations.length > 0) dimensions.push(fieldedGroup(populations));
  if (outcomes.length > 0) dimensions.push(fieldedGroup(outcomes));

  if (parsed.filterCriteria.studyTypeFilter?.length) {
    const publicationTypes = parsed.filterCriteria.studyTypeFilter.map((studyType) => {
      if (studyType === 'RCT') return 'Randomized Controlled Trial[Publication Type]';
      if (studyType === 'Systematic Review') return 'Systematic Review[Publication Type]';
      if (studyType === 'Meta-Analysis') return 'Meta-Analysis[Publication Type]';
      if (studyType === 'Clinical Trial') return 'Clinical Trial[Publication Type]';
      return 'Observational Study[Publication Type]';
    });
    dimensions.push(`(${publicationTypes.join(' OR ')})`);
  }

  if (parsed.filterCriteria.dateFilter) {
    const from = parsed.filterCriteria.dateFilter.from.replaceAll('-', '/');
    const to = (parsed.filterCriteria.dateFilter.to || new Date().toISOString().slice(0, 10)).replaceAll('-', '/');
    dimensions.push(`(("${from}"[Date - Publication] : "${to}"[Date - Publication]) OR ("${from}"[Date - Electronic] : "${to}"[Date - Electronic]))`);
  }

  if (dimensions.length > 0) return dimensions.join(' AND ');

  const fallbackTerms = parsed.expandedKeywords
    .filter((term) => !/[\u3400-\u9fff]/u.test(term))
    .slice(0, 8);
  return fallbackTerms.length > 0 ? fieldedGroup(fallbackTerms) : parsed.originalQuery;
}

/**
 * 3. Query Expansion & BigQuery SQL Builder
 * Builds optimized BigQuery SQL with expanded keywords and study type conditions.
 */
export function buildEnhancedSearchQuery(parsed: ParsedClinicalQuery, limit: number = 20): string {
  const clauses: string[] = [];

  // Disease or Drug clauses
  if (parsed.pico.i.length > 0 || parsed.pico.p.length > 0) {
    const terms = Array.from(new Set([
      ...parsed.pico.i.flatMap((term) => [term, ...(DRUG_SYNONYMS[term] || [])]),
      ...parsed.pico.p.flatMap((term) => [term, ...(DISEASE_SYNONYMS[term] || [])]),
      ...(parsed.filterCriteria.populationFilter || []).flatMap((term) => POPULATION_SYNONYMS[term] || [term]),
      ...parsed.expandedKeywords,
    ])).filter((term) => !/[\u3400-\u9fff]/u.test(term)).slice(0, 16);
    const subClauses = terms.map((t) => {
      const escaped = t.replace(/'/g, "''");
      return `LOWER(title) LIKE '%${escaped}%' OR LOWER(abstract) LIKE '%${escaped}%' OR LOWER(mesh_headings) LIKE '%${escaped}%'`;
    });
    clauses.push(`(${subClauses.join(' OR ')})`);
  } else {
    // Fallback query
    const escaped = normalizeClinicalQuery(parsed.originalQuery).replace(/'/g, "''");
    clauses.push(`(LOWER(title) LIKE '%${escaped}%' OR LOWER(abstract) LIKE '%${escaped}%' OR LOWER(mesh_headings) LIKE '%${escaped}%')`);
  }

  // Study type SQL restriction if specified
  if (parsed.filterCriteria.studyTypeFilter && parsed.filterCriteria.studyTypeFilter.length > 0) {
    const studyTypeSql: string[] = [];
    parsed.filterCriteria.studyTypeFilter.forEach((st) => {
      const kws = STUDY_TYPE_KEYWORDS[st] || [];
      kws.forEach((kw) => {
        studyTypeSql.push(`LOWER(title) LIKE '%${kw}%' OR LOWER(abstract) LIKE '%${kw}%' OR LOWER(mesh_headings) LIKE '%${kw}%'`);
      });
    });
    if (studyTypeSql.length > 0) {
      clauses.push(`(${studyTypeSql.join(' OR ')})`);
    }
  }

  if (parsed.filterCriteria.dateFilter) {
    const fromYear = parsed.filterCriteria.dateFilter.from.slice(0, 4);
    const toYear = parsed.filterCriteria.dateFilter.to?.slice(0, 4);
    clauses.push(`CAST(REGEXP_EXTRACT(CAST(pubdate AS STRING), r'(19\\d{2}|20\\d{2})') AS INT64) >= ${fromYear}`);
    if (toYear) {
      clauses.push(`CAST(REGEXP_EXTRACT(CAST(pubdate AS STRING), r'(19\\d{2}|20\\d{2})') AS INT64) <= ${toYear}`);
    }
  }

  const whereClause = clauses.join(' AND ');

  return `
    SELECT
      pmid,
      title,
      abstract,
      authors,
      pubdate,
      journal,
      mesh_headings,
      doi
    FROM
      \`ncbi-bigquery.pubmed.baseline\`
    WHERE
      ${whereClause}
    ORDER BY
      CASE
        WHEN REGEXP_CONTAINS(LOWER(COALESCE(journal, '')), r'(new england journal of medicine|n engl j med|lancet|jama|bmj)') THEN 1
        ELSE 0
      END DESC,
      pubdate DESC
    LIMIT ${limit}
  `;
}

export type MatchState = 'confirmed' | 'mismatch' | 'unknown' | 'not_applicable';

export interface MachineEligibilityReason {
  reason_codes: Array<
    | 'CONDITION_MATCH'
    | 'CONDITION_MISMATCH'
    | 'INTERVENTION_MATCH'
    | 'INTERVENTION_MISMATCH'
    | 'INTERVENTION_NOT_APPLICABLE'
    | 'OUTCOME_MATCH'
    | 'OUTCOME_MISMATCH'
    | 'POPULATION_MATCH'
    | 'POPULATION_MISMATCH'
    | 'POPULATION_UNKNOWN'
  >;
  matched_terms: {
    condition: string[];
    intervention: string[];
    outcome: string[];
    population: string[];
  };
}

export interface MultiDimensionalEligibility {
  pmid: string;
  condition_match: boolean;
  outcome_match: boolean;
  population_match: MatchState;
  intervention_match: MatchState;
  eligible_for_direct_answer: boolean;
  eligible_for_background: boolean;
  evidenceCategory: 'Direct Evidence' | 'Partially Relevant' | 'Background / Related Evidence';
  reasons: MachineEligibilityReason;
  isEligible: boolean;
}

export function evaluateMultiDimensionalEligibility(
  article: PubMedArticle,
  parsedQuery: ParsedClinicalQuery
): MultiDimensionalEligibility {
  const fullText = `${article.title} ${article.abstract || ''} ${article.mesh_terms?.join(' ') || ''}`.toLowerCase();
  const reasonCodes: MachineEligibilityReason['reason_codes'] = [];
  const matchedTerms = { condition: [] as string[], intervention: [] as string[], outcome: [] as string[], population: [] as string[] };

  // 1. Condition Match Check (Independent Evaluation: No Short-Circuiting for Audit)
  const primaryDiseases = parsedQuery.filterCriteria.diseaseFilter || [];
  let condition_match = false;
  if (primaryDiseases.length > 0) {
    condition_match = primaryDiseases.some((dis) => {
      const syns = [dis, ...(DISEASE_SYNONYMS[dis] || [])];
      const matched = syns.filter((s) => fullText.includes(s.toLowerCase()));
      if (matched.length > 0) {
        matchedTerms.condition.push(...matched);
        return true;
      }
      return false;
    });
  } else {
    condition_match = true;
  }

  if (condition_match) reasonCodes.push('CONDITION_MATCH');
  else reasonCodes.push('CONDITION_MISMATCH');

  // 2. Intervention Match Check (Independent Evaluation: Set to 'not_applicable' if no drug required by query)
  const reqDrugs = parsedQuery.filterCriteria.drugFilter || [];
  let intervention_match: MatchState = 'not_applicable';
  if (reqDrugs.length > 0) {
    const matched = reqDrugs.filter((drug) => {
      const syns = [drug, ...(DRUG_SYNONYMS[drug] || [])];
      const synHits = syns.filter((s) => fullText.includes(s.toLowerCase()));
      if (synHits.length > 0) {
        matchedTerms.intervention.push(...synHits);
        return true;
      }
      return false;
    });
    if (matched.length > 0) {
      intervention_match = 'confirmed';
      reasonCodes.push('INTERVENTION_MATCH');
    } else {
      intervention_match = 'mismatch';
      reasonCodes.push('INTERVENTION_MISMATCH');
    }
  } else {
    intervention_match = 'not_applicable';
    reasonCodes.push('INTERVENTION_NOT_APPLICABLE');
  }

  // 3. Outcome Match Check (Independent Evaluation: Query-Type Specific)
  const reqOutcomes = parsedQuery.pico.o || [];
  let outcome_match = false;
  if (reqOutcomes.length > 0) {
    outcome_match = reqOutcomes.some((o) => {
      if (fullText.includes(o.toLowerCase())) {
        matchedTerms.outcome.push(o);
        return true;
      }
      return false;
    });
  } else {
    const lowerQuery = parsedQuery.originalQuery.toLowerCase();
    const survivalKw = ['survival', 'mortality', 'death', 'renal decline', 'follow-up', 'follow up', 'long-term', 'long term', 'prognosis', 'outcome', 'outcomes', 'risk', 'efficacy', 'benefit'];
    const queryRequestsSurvival = survivalKw.some((kw) => lowerQuery.includes(kw));
    if (queryRequestsSurvival) {
      const matched = survivalKw.filter((kw) => fullText.includes(kw));
      if (matched.length > 0) {
        outcome_match = true;
        matchedTerms.outcome.push(...matched);
      } else {
        outcome_match = false;
      }
    } else {
      outcome_match = true;
    }
  }

  if (outcome_match) reasonCodes.push('OUTCOME_MATCH');
  else reasonCodes.push('OUTCOME_MISMATCH');

  // 4. Population Match Check (Independent Evaluation & Correct Semantics)
  const reqPops = parsedQuery.filterCriteria.populationFilter || [];
  let population_match: MatchState = 'not_applicable';
  if (reqPops.length > 0) {
    const popRes = extractPopulationDetail(fullText, parsedQuery);
    if (popRes.status === 'confirmed') {
      population_match = 'confirmed';
      reasonCodes.push('POPULATION_MATCH');
      if (popRes.detail && popRes.detail !== 'General Clinical Population') {
        matchedTerms.population.push(popRes.detail);
      }
    } else if (popRes.status === 'partial') {
      population_match = 'mismatch';
      reasonCodes.push('POPULATION_MISMATCH');
    } else {
      population_match = 'unknown';
      reasonCodes.push('POPULATION_UNKNOWN');
    }
  } else {
    population_match = 'not_applicable';
  }

  // 5. Query-Type Specific Direct Answer Eligibility Gate
  // For Direct Evidence: MUST have condition_match = true AND outcome_match = true AND intervention_match !== 'mismatch' AND population_match !== 'mismatch'
  const eligible_for_direct_answer = condition_match && outcome_match && (reqDrugs.length === 0 || intervention_match === 'confirmed') && (reqPops.length === 0 || population_match === 'confirmed');
  const eligible_for_background = condition_match;

  let evidenceCategory: MultiDimensionalEligibility['evidenceCategory'] = 'Background / Related Evidence';
  if (eligible_for_direct_answer) {
    evidenceCategory = 'Direct Evidence';
  } else if (condition_match) {
    evidenceCategory = 'Partially Relevant';
  }

  return {
    pmid: article.pmid,
    condition_match,
    outcome_match,
    population_match,
    intervention_match,
    eligible_for_direct_answer,
    eligible_for_background,
    evidenceCategory,
    reasons: { reason_codes: reasonCodes, matched_terms: matchedTerms },
    isEligible: condition_match,
  };
}

/**
 * 5. Disease Filter, 6. Drug Filter, 7. Population Filter, 8. Study Type Filter
 * Filters candidate articles based on clinical criteria.
 */
export function applyClinicalFilters(
  articles: PubMedArticle[],
  filterCriteria: ParsedClinicalQuery['filterCriteria']
): PubMedArticle[] {
  return articles.filter((article) => {
    const fullText = `${article.title} ${article.abstract || ''} ${article.mesh_terms?.join(' ') || ''}`.toLowerCase();

    // Hard Disease/Condition Filter check
    if (filterCriteria.diseaseFilter && filterCriteria.diseaseFilter.length > 0) {
      const hasDisease = filterCriteria.diseaseFilter.some((dis) => {
        return matchesDiseaseTerm(fullText, dis);
      });
      if (!hasDisease) return false;
    }

    // Drug Filter check
    if (filterCriteria.drugFilter && filterCriteria.drugFilter.length > 0) {
      const hasDrug = filterCriteria.drugFilter.some((drug) => {
        return matchesDrugTerm(fullText, drug);
      });
      if (!hasDrug) return false;
    }

    // Population Filter check
    if (filterCriteria.populationFilter && filterCriteria.populationFilter.length > 0) {
      const hasPop = filterCriteria.populationFilter.some((pop) =>
        (POPULATION_SYNONYMS[pop] || [pop]).some((synonym) => fullText.includes(synonym.toLowerCase()))
      );
      if (!hasPop) return false;
    }

    if (filterCriteria.dateFilter && filterArticlesByPublicationDate([article], filterCriteria.dateFilter).length === 0) {
      return false;
    }

    return true;
  });
}

/**
 * Helper to extract Sample Size from title/abstract if reported.
 * Follows NO SOURCE -> NO DISPLAY rule.
 */
export function extractSampleSize(text: string): string {
  const normalizedNumber = (value: string): string => {
    const digits = value.replace(/[^\d]/g, '');
    return digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : value.trim();
  };
  const numberPattern = String.raw`\d(?:[\d,\s\u2009\u202F\u2008]*\d)?`;

  const cohortMatches = Array.from(text.matchAll(new RegExp(`cohort\\s*(\\d+)\\s*:\\s*N\\s*=\\s*(${numberPattern})`, 'gi')));
  if (cohortMatches.length > 1) {
    return cohortMatches.map((match) => `Cohort ${match[1]}：${normalizedNumber(match[2])} 人`).join('；');
  }

  const metaMatch = text.match(new RegExp(`(?:comprised|included)\\s+(${numberPattern})\\s+(?:trials?|studies)[^.!?]{0,80}?\\((${numberPattern})\\s+(?:patients|participants|subjects|individuals)\\)`, 'i'));
  if (metaMatch) return `${normalizedNumber(metaMatch[2])} 名受試者（${normalizedNumber(metaMatch[1])} 項研究）`;

  const orderedPatterns = [
    new RegExp(`(${numberPattern})(?:\\s*\\([^)]{0,60}\\))?\\s+(?:of whom\\s+were\\s+)?(?:were\\s+)?(?:enrolled\\s+and\\s+)?(?:included\\s+and\\s+)?(?:randomly assigned|randomized|randomised)`, 'i'),
    new RegExp(`(?:randomly assigned|randomized|randomised)\\s+(${numberPattern})\\s+(?:patients|participants|subjects|individuals|adults)`, 'i'),
    new RegExp(`(?:study cohort|cohort|study|trial|analysis)\\s+(?:included|involved|enrolled|comprised)\\s+(${numberPattern})\\s+(?:patients|participants|subjects|individuals|adults|cases)`, 'i'),
    new RegExp(`(?:including|involving)\\s+(${numberPattern})\\s+(?:patients|participants|subjects|individuals|adults|cases)`, 'i'),
  ];
  for (const pattern of orderedPatterns) {
    const match = text.match(pattern);
    if (match) return `${normalizedNumber(match[1])} 名受試者`;
  }

  const singleCohort = cohortMatches[0];
  if (singleCohort) return `Cohort ${singleCohort[1]}：${normalizedNumber(singleCohort[2])} 人`;

  const screenedMatch = text.match(new RegExp(`(${numberPattern})\\s+(?:patients|participants|subjects|individuals|people)\\s+(?:were\\s+)?screened`, 'i'));
  if (screenedMatch) return `篩選 ${normalizedNumber(screenedMatch[1])} 人（實際納入數未明確辨識）`;

  return '現有 PubMed 摘要未明確報告總樣本數';
}

/**
 * Helper to extract Study Duration / Follow-up from title/abstract if reported.
 * Follows NO SOURCE -> NO DISPLAY rule.
 */
export function extractStudyDuration(text: string): string {
  const unit = (raw: string): string => {
    const lower = raw.toLowerCase();
    if (lower.startsWith('year')) return '年';
    if (lower.startsWith('month')) return '個月';
    if (lower.startsWith('week')) return '週';
    return '天';
  };

  const median = text.match(/median\s+follow-up\s+(?:time\s+)?of\s+(\d+(?:\.\d+)?)\s*(years?|months?|weeks?|days?)/i);
  if (median) return `中位追蹤 ${median[1]} ${unit(median[2])}`;

  const range = text.match(/follow-up\s+(?:ranged\s+)?from\s+(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s*(years?|months?|weeks?|days?)/i);
  if (range) return `追蹤 ${range[1]}–${range[2]} ${unit(range[3])}`;

  const treatmentRange = text.match(/(?:end of treatment|treatment period)[^.!?]{0,30}?weeks?\s*0\s*[-–]\s*(\d+(?:\.\d+)?)/i);
  if (treatmentRange) return `${treatmentRange[1]} 週`;

  const forDuration = text.match(/(?:for|over|during)\s+(\d+(?:\.\d+)?)\s*(years?|months?|weeks?|days?)(?=[\s,.;)])/i);
  if (forDuration) return `${forDuration[1]} ${unit(forDuration[2])}`;

  const endpointWeek = Array.from(text.matchAll(/(?:at|through|to)\s+week\s+(\d+(?:\.\d+)?)/gi))
    .map((match) => Number(match[1]))
    .filter(Number.isFinite);
  if (endpointWeek.length > 0) return `${Math.max(...endpointWeek)} 週`;

  const explicitFollowup = text.match(/follow-up\s+(?:of|was|is|:)\s*(\d+(?:\.\d+)?)\s*(years?|months?|weeks?|days?)/i);
  if (explicitFollowup) return `追蹤 ${explicitFollowup[1]} ${unit(explicitFollowup[2])}`;

  return '現有 PubMed 摘要未明確報告研究期間';
}

/**
 * Helper to extract Study Design from title/abstract.
 */
export function extractStudyDesign(text: string, publicationTypes: string[] = []): string {
  const lower = text.toLowerCase();
  const typeText = publicationTypes.join(' ').toLowerCase();
  if (typeText.includes('meta-analysis')) return 'Meta-Analysis';
  if (typeText.includes('systematic review')) return 'Systematic Review';
  if (typeText.includes('randomized controlled trial')) return 'Randomized Controlled Trial';
  if (typeText.includes('clinical trial')) return 'Clinical Trial';
  if (typeText.includes('review')) return 'Review Article';
  if (typeText.includes('observational study')) return 'Observational Study';

  const title = text.split(/(?<=[.!?])\s/)[0]?.toLowerCase() || lower;
  if (/\bfirst approvals?\b/.test(title)) return 'Drug Approval Review';
  if (title.includes('meta-analysis') || title.includes('meta analysis') || lower.includes('meta-analysis') || lower.includes('meta analysis')) {
    return 'Meta-Analysis';
  }
  if (title.includes('systematic review') || lower.includes('systematic review')) {
    return 'Systematic Review';
  }
  if (/\bthis review\b|\breview synthes(?:ises|izes)\b/i.test(text)) return 'Review Article';
  if (lower.includes('target trial emulation')) return 'Observational Study';
  if (/secondary analysis of (?:a )?randomi[sz]ed controlled trial/i.test(text)) return 'Secondary Analysis of RCT';
  if (lower.includes('randomized controlled trial') || lower.includes('randomised controlled trial') || /\brct\b/i.test(text) || /randomi[sz]ed[^.!?]{0,80}(?:trial|study)/i.test(text)) {
    return 'Randomized Controlled Trial';
  }
  if (lower.includes('clinical trial')) {
    return 'Clinical Trial';
  }
  if (lower.includes('cohort study') || lower.includes('cohort')) {
    return 'Cohort Study';
  }
  if (lower.includes('observational')) {
    return 'Observational Study';
  }
  return 'Clinical Study';
}

/**
 * Helper to extract Population Detail and Match Status.
 */
export function extractPopulationDetail(
  text: string,
  parsedQuery: ParsedClinicalQuery
): { status: 'confirmed' | 'partial' | 'mismatch' | 'unconfirmed'; detail: string } {
  const lower = text.toLowerCase();
  const title = lower.split(/(?<=[.!?])\s/)[0] || lower;
  const reqPops = parsedQuery.filterCriteria.populationFilter || [];

  const mentionsPediatric = lower.includes('pediatric') || lower.includes('children') || lower.includes('child');
  const mentionsAdolescent = /\b(?:adolescents?|youth|teenagers?)\b/.test(lower);
  const mentionsAdult = lower.includes('adult') || lower.includes('adults');
  const mentionsElderly = /\b(?:elderly|geriatric|older adults?)\b/.test(lower) || /aged\s+(?:6[5-9]|[7-9]\d)\s+years?\s+or\s+older/.test(lower);
  const ageRange = lower.match(/(?:age|aged)\s*(\d{1,2})\s*[-–]\s*(\d{1,2})\s*years?/);
  const minimumAge = lower.match(/(?:participants?|patients?|adults?)\s+aged\s+(\d{1,2})\s+years?\s+or\s+older/);

  if (reqPops.length === 0) {
    let detail = '一般臨床族群';
    if (/\b(?:pediatric|paediatric|children|childhood)\b/.test(title)) detail = '兒童／青少年族群';
    else if (/\badolescents?\b/.test(title)) detail = '青少年族群';
    else if (ageRange && Number(ageRange[1]) >= 18) detail = `成人（${ageRange[1]}–${ageRange[2]} 歲）`;
    else if (minimumAge && Number(minimumAge[1]) >= 18) detail = `成人（${minimumAge[1]} 歲以上）`;
    else if (mentionsAdult) detail = '成人族群';
    else if (mentionsAdolescent && mentionsPediatric) detail = '兒童與青少年族群';
    else if (mentionsAdolescent) detail = '青少年（12–17 歲）';
    else if (mentionsPediatric) detail = '兒童族群（未滿 12 歲）';
    else if (mentionsElderly) detail = '高齡族群（65 歲以上）';
    return { status: 'confirmed', detail };
  }

  const reqPed = reqPops.some((p) => p === 'pediatric' || p === 'children');
  const reqAdo = reqPops.some((p) => p === 'adolescent' || p === 'adolescents');

  if (reqPed || reqAdo) {
    if (mentionsPediatric || mentionsAdolescent) {
      const detail = mentionsAdolescent ? '青少年（12–17 歲）' : '兒童族群（未滿 12 歲）';
      return { status: 'confirmed', detail };
    }
    if (mentionsAdult) {
      return { status: 'partial', detail: '僅納入成人；摘要未報告兒童資料' };
    }
    return { status: 'unconfirmed', detail: '族群年齡：無法由 PubMed 摘要確認' };
  }

  return { status: 'confirmed', detail: '研究族群符合問題條件' };
}

/**
 * 9. Clinical Relevance Reranking & 10. Direct vs Related Evidence Classification
 * Scores candidate articles based on PICO match, study design evidence hierarchy, and publication recency,
 * then classifies articles into Direct Evidence, Partially Relevant, or Background / Related Evidence.
 */
export function rerankClinicalEvidence(
  articles: PubMedArticle[],
  parsedQuery: ParsedClinicalQuery
): RerankedArticle[] {
  const reranked: RerankedArticle[] = articles.map((article) => {
    const fullText = `${article.title} ${article.abstract || ''} ${article.mesh_terms?.join(' ') || ''}`.toLowerCase();

    // 1. Disease Match
    const primaryDiseases = parsedQuery.filterCriteria.diseaseFilter || [];
    let diseaseMatch = false;
    if (primaryDiseases.length > 0) {
      diseaseMatch = primaryDiseases.some((dis) => {
        return matchesDiseaseTerm(fullText, dis);
      });
    } else if (parsedQuery.pico.p.length > 0) {
      diseaseMatch = parsedQuery.pico.p.some((dis) => {
        return matchesDiseaseTerm(fullText, dis);
      });
    } else {
      diseaseMatch = true;
    }

    // 2. Drug Match
    let drugMatch = false;
    if (parsedQuery.pico.i.length > 0) {
      drugMatch = parsedQuery.pico.i.some((drug) => {
        return matchesDrugTerm(fullText, drug);
      });
    } else {
      drugMatch = true;
    }

    // 3. Population Detail
    const popRes = extractPopulationDetail(`${article.title}. ${article.abstract || ''}`, parsedQuery);

    // 4. Sample Size, Duration & Design
    const sampleSize = extractSampleSize(`${article.title} ${article.abstract || ''}`);
    const studyDuration = extractStudyDuration(`${article.title} ${article.abstract || ''}`);
    const studyDesign = extractStudyDesign(`${article.title}. ${article.abstract || ''}`, article.publication_types);

    // 5. Evidence Level / Study Type Bonus
    let studyTypeBonus = 0;
    if (studyDesign === 'Meta-Analysis' || studyDesign === 'Systematic Review') {
      studyTypeBonus = 40;
    } else if (studyDesign === 'Randomized Controlled Trial' || studyDesign === 'Secondary Analysis of RCT') {
      studyTypeBonus = 20;
    } else if (studyDesign === 'Clinical Trial') {
      studyTypeBonus = 15;
    } else if (studyDesign === 'Cohort Study' || studyDesign === 'Observational Study') {
      studyTypeBonus = 10;
    }

    // 6. Recency Bonus
    let recencyBonus = 0;
    if (article.publication_date) {
      const yearMatch = article.publication_date.match(/\b(19\d{2}|20\d{2})\b/);
      if (yearMatch) {
        const year = parseInt(yearMatch[0], 10);
        if (year >= 2024) recencyBonus = 15;
        else if (year >= 2022) recencyBonus = 10;
        else if (year >= 2018) recencyBonus = 5;
      }
    }

    // 7. Keyword match density
    let keywordHits = 0;
    parsedQuery.expandedKeywords.forEach((kw) => {
      if (kw.length > 2) {
        const kwRegex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (kwRegex.test(fullText)) {
          keywordHits++;
        }
      }
    });
    const keywordBonus = Math.min(20, keywordHits * 4);

    // Small tie-breaker for journals the physician explicitly expects to see.
    // This never overrides PICO eligibility or evidence design quality.
    const journalBonus = /(?:n engl j med|new england journal of medicine|lancet|jama|bmj)/i.test(article.journal || '') ? 6 : 0;

    // Calculate Base Score
    let clinicalScore = 40;
    if (diseaseMatch) clinicalScore += 15;
    if (drugMatch) clinicalScore += 15;
    clinicalScore += studyTypeBonus + recencyBonus + keywordBonus + journalBonus;

    // Categorization into 3 Tiers via Multi-Dimensional Eligibility
    const multiElig = evaluateMultiDimensionalEligibility(article, parsedQuery);
    const evidenceCategory = multiElig.evidenceCategory;
    const evidenceType: 'direct' | 'related' = multiElig.eligible_for_direct_answer ? 'direct' : 'related';

    return {
      ...article,
      clinicalScore,
      relevance_score: Math.min(99, Math.max(10, Math.round(clinicalScore))),
      evidenceType,
      evidenceCategory,
      conditionMatchStatus: multiElig.condition_match ? 'confirmed' : 'unconfirmed',
      interventionMatchStatus: drugMatch ? 'confirmed' : 'unconfirmed',
      populationMatchStatus: popRes.status,
      populationDetail: popRes.detail,
      sampleSize,
      studyDuration,
      studyDesign,
      matchBreakdown: {
        diseaseMatch,
        drugMatch,
        studyTypeBonus,
        recencyBonus,
      },
    };
  });

  // Sort by Evidence Category (Direct -> Partial -> Background), then by clinicalScore
  return reranked.sort((a, b) => {
    const catOrder = { 'Direct Evidence': 1, 'Partially Relevant': 2, 'Background / Related Evidence': 3 };
    const orderA = catOrder[a.evidenceCategory];
    const orderB = catOrder[b.evidenceCategory];
    if (orderA !== orderB) return orderA - orderB;
    return b.clinicalScore - a.clinicalScore;
  });
}

/**
 * Keeps pivotal original trials visible instead of allowing a result page to be
 * filled entirely by reviews. Relevance and direct-evidence eligibility are
 * still determined before this diversity pass.
 */
export function selectDiverseClinicalEvidence(
  articles: RerankedArticle[],
  limit: number = 8
): RerankedArticle[] {
  const selected: RerankedArticle[] = [];
  const selectedPmids = new Set<string>();
  const add = (article: RerankedArticle) => {
    if (selected.length < limit && !selectedPmids.has(article.pmid)) {
      selected.push(article);
      selectedPmids.add(article.pmid);
    }
  };

  const directArticles = articles.filter((article) => article.evidenceType === 'direct');

  directArticles
    .filter((article) => article.studyDesign === 'Randomized Controlled Trial' || article.studyDesign === 'Clinical Trial')
    .slice(0, 4)
    .forEach(add);
  directArticles
    .filter((article) => article.studyDesign === 'Meta-Analysis' || article.studyDesign === 'Systematic Review')
    .slice(0, 2)
    .forEach(add);
  directArticles.forEach(add);
  articles.forEach(add);

  return selected;
}

/**
 * Selects extra candidates so strict PubMed canonical verification can still
 * yield five highest-match papers plus five lower-ranked related papers.
 */
export function selectBalancedClinicalEvidence(
  articles: RerankedArticle[],
  directCandidateLimit: number = 10,
  relatedCandidateLimit: number = 10
): RerankedArticle[] {
  const direct = selectDiverseClinicalEvidence(
    articles.filter((article) => article.evidenceType === 'direct'),
    directCandidateLimit
  );
  const directPmids = new Set(direct.map((article) => article.pmid));
  const related = articles
    .filter((article) => !directPmids.has(article.pmid))
    .slice(0, relatedCandidateLimit);
  return [...direct, ...related];
}
