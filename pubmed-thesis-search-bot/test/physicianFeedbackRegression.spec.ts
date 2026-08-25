import { describe, expect, it } from 'vitest';
import {
  buildEnhancedSearchQuery,
  buildPubMedSearchTerm,
  extractPopulationDetail,
  extractSampleSize,
  extractStudyDesign,
  extractStudyDuration,
  filterArticlesByPublicationDate,
  parseClinicalQuery,
  selectBalancedClinicalEvidence,
  selectDiverseClinicalEvidence,
} from '../src/clinicalRetrieval';
import {
  canonicalizeVerifiedCandidates,
  verifyCanonicalMetadata,
} from '../src/canonicalPubMedGate';
import { createEvidenceObjects } from '../src/citationIntegrity';
import { verifyClaimAccuracy } from '../src/claimAccuracy';
import { parseCanonicalPubMedRecord } from '../src/canonicalPubMedParser';
import { PubMedArticle } from '../src/pubmedBigQuery';
import { renderEvidenceOverviewBanner, renderProfessionalUISections } from '../src/professionalUI';

const bigQueryCandidate: PubMedArticle = {
  pmid: '37654321',
  title: 'Unverified candidate title',
  abstract: 'Unverified candidate abstract that must never be used for a clinical claim.',
  journal: 'Unknown journal',
  publication_date: '2023',
};

const canonicalRecord: PubMedArticle = {
  pmid: '37654321',
  title: 'Canonical PubMed title for pediatric atopic dermatitis',
  abstract: 'This canonical PubMed abstract reports a randomized trial in pediatric patients with atopic dermatitis and contains the verified clinical findings.',
  journal: 'The Lancet',
  publication_date: '2023',
  doi: '10.1016/S0140-6736(23)00000-0',
};

describe('Physician feedback regression coverage', () => {
  it('turns a mixed Traditional-Chinese JAK question into searchable clinical concepts', () => {
    const parsed = parseClinicalQuery('請問 JAK inhibitor 在兒童異位性皮膚炎病患之使用');

    expect(parsed.filterCriteria.diseaseFilter).toContain('atopic dermatitis');
    expect(parsed.filterCriteria.drugFilter).toContain('jak inhibitor');
    expect(parsed.filterCriteria.populationFilter).toContain('pediatric');

    const pubmedTerm = buildPubMedSearchTerm(parsed);
    expect(pubmedTerm).toContain('"atopic dermatitis"[Title/Abstract]');
    expect(pubmedTerm).toContain('"upadacitinib"[Title/Abstract]');
    expect(pubmedTerm).toContain('"pediatric"[Title/Abstract]');
    expect(pubmedTerm).toContain('"adolescent"[Title/Abstract]');
    expect(pubmedTerm).toContain(' AND ');
  });

  it('parses GLP-1 2026/07 後 as a strict publication-date lower bound', () => {
    const parsed = parseClinicalQuery('GLP-1 2026/07 後之最新研究');
    expect(parsed.filterCriteria.drugFilter).toContain('glp-1 receptor agonist');
    expect(parsed.filterCriteria.dateFilter).toEqual({
      from: '2026-07-01',
      to: undefined,
      precision: 'month',
      mode: 'from',
    });
    expect(buildPubMedSearchTerm(parsed)).toContain('"2026/07/01"[Date - Publication]');

    const filtered = filterArticlesByPublicationDate([
      { pmid: '1', title: 'June paper', publication_date: '2026 Jun 30' },
      { pmid: '2', title: 'July paper', publication_date: '2026 Jul 05' },
      { pmid: '3', title: 'August paper', publication_date: '2026-08-01' },
      { pmid: '4', title: 'Unknown month', publication_date: '2026' },
    ], parsed.filterCriteria.dateFilter);
    expect(filtered.map((article) => article.pmid)).toEqual(['2', '3']);
  });

  it('treats 2026 七月 without 後 as that exact calendar month', () => {
    const parsed = parseClinicalQuery('GLP-1 2026 七月最新研究');
    expect(parsed.filterCriteria.dateFilter?.from).toBe('2026-07-01');
    expect(parsed.filterCriteria.dateFilter?.to).toBe('2026-07-31');
    const filtered = filterArticlesByPublicationDate([
      { pmid: '1', title: 'July paper', publication_date: '2026 July 12' },
      { pmid: '2', title: 'Wrong year', publication_date: '2025 Jul 12' },
      { pmid: '3', title: 'Wrong month', publication_date: '2026 Aug 01' },
    ], parsed.filterCriteria.dateFilter);
    expect(filtered.map((article) => article.pmid)).toEqual(['1']);
  });

  it('filters latest-research questions by first public date rather than a future journal issue', () => {
    const parsed = parseClinicalQuery('GLP-1 2026/07 後之相關最新研究');
    const filtered = filterArticlesByPublicationDate([
      {
        pmid: '40637782',
        title: 'Future issue but old online publication',
        publication_date: '2026 Sep',
        journal_issue_date: '2026 Sep',
        electronic_publication_date: '2025 Jul 10',
        first_publication_date: '2025 Jul 10',
      },
      {
        pmid: '42419792',
        title: 'Actually published after the requested date',
        publication_date: '2026 Jul 08',
        first_publication_date: '2026 Jul 08',
      },
    ], parsed.filterCriteria.dateFilter);

    expect(filtered.map((article) => article.pmid)).toEqual(['42419792']);
    const pubmedTerm = buildPubMedSearchTerm(parsed);
    expect(pubmedTerm).toContain('[Date - Electronic]');
    expect(pubmedTerm).not.toContain('3000');
  });

  it('keeps PubMed journal issue, electronic, and first-public dates separate', () => {
    const parsed = parseCanonicalPubMedRecord(`
      <PubmedArticle><MedlineCitation><PMID>40637782</PMID><Article>
      <ArticleTitle>Impact of GLP-1 receptor agonists: systematic review and meta-analysis</ArticleTitle>
      <Journal><JournalIssue><PubDate><Year>2026</Year><Month>Sep</Month></PubDate></JournalIssue><Title>Clinical Research in Cardiology</Title></Journal>
      <ArticleDate DateType="Electronic"><Year>2025</Year><Month>07</Month><Day>10</Day></ArticleDate>
      <Abstract><AbstractText>Six studies including 4043 patients were analyzed.</AbstractText></Abstract>
      <PublicationTypeList><PublicationType UI="D017418">Meta-Analysis</PublicationType><PublicationType UI="D000078182">Systematic Review</PublicationType></PublicationTypeList>
      </Article></MedlineCitation></PubmedArticle>
    `);

    expect(parsed?.journal_issue_date).toBe('2026 Sep');
    expect(parsed?.electronic_publication_date).toBe('2025 07 10');
    expect(parsed?.first_publication_date).toBe('2025 07 10');
    expect(parsed?.publication_types).toContain('Meta-Analysis');
  });

  it('extracts GLP-1 study facts only from explicit clinical context', () => {
    const networkMeta = 'This network meta-analysis comprised 262 trials (99 791 participants) evaluating 19 drugs with follow-up from 12 to 172 weeks.';
    expect(extractStudyDesign(networkMeta, ['Meta-Analysis', 'Systematic Review'])).toBe('Meta-Analysis');
    expect(extractSampleSize(networkMeta)).toBe('99,791 名受試者（262 項研究）');
    expect(extractStudyDuration(networkMeta)).toBe('追蹤 12–172 週');

    const secondaryRct = 'This is secondary analysis of a randomized controlled trial involving 193 adults with obesity (age 18-65 years). Endpoints were measured from randomization to the end of treatment (weeks 0-52).';
    expect(extractStudyDesign(secondaryRct)).toBe('Secondary Analysis of RCT');
    expect(extractSampleSize(secondaryRct)).toBe('193 名受試者');
    expect(extractStudyDuration(secondaryRct)).toBe('52 週');
    expect(extractPopulationDetail(secondaryRct.toLowerCase(), parseClinicalQuery('GLP-1'))).toMatchObject({
      detail: '成人（18–65 歲）',
    });
  });

  it('does not confuse age, screened counts, or treatment-arm counts with totals and follow-up', () => {
    const observational = 'The cohort included 229 467 patients. Mean age was 47.2 years. With a median follow-up of 2 years, outcomes were assessed.';
    expect(extractSampleSize(observational)).toBe('229,467 名受試者');
    expect(extractStudyDuration(observational)).toBe('中位追蹤 2 年');

    const reimagine = '294 people were screened for eligibility, 189 of whom were enrolled and randomly assigned to treatment (n=62, n=63, or n=64) for 40 weeks. Adults aged 18 years or older were eligible.';
    expect(extractSampleSize(reimagine)).toBe('189 名受試者');
    expect(extractStudyDuration(reimagine)).toBe('40 週');

    const surpass = '16 979 participants were screened and 13 299 (2948 with high-risk chronic kidney disease) were randomly assigned. Participants aged 40 years or older were eligible. After a median follow-up of 4.0 years, outcomes were assessed.';
    expect(extractSampleSize(surpass)).toBe('13,299 名受試者');
    expect(extractStudyDuration(surpass)).toBe('中位追蹤 4.0 年');
  });

  it('keeps major journals as a tie-breaker in BigQuery retrieval', () => {
    const sql = buildEnhancedSearchQuery(parseClinicalQuery('JAK inhibitor pediatric atopic dermatitis'), 15);
    expect(sql).toContain('lancet');
    expect(sql).toContain('jama');
    expect(sql).toContain('n engl j med');
  });

  it('fails closed when PubMed cannot verify a BigQuery PMID', () => {
    const result = canonicalizeVerifiedCandidates([bigQueryCandidate], new Map());
    expect(result.verified).toEqual([]);
    expect(result.rejected).toHaveLength(1);
  });

  it('uses the canonical PubMed title, abstract, journal and DOI as one inseparable record', () => {
    const canonicalMap = new Map([[canonicalRecord.pmid, canonicalRecord]]);
    const result = verifyCanonicalMetadata(bigQueryCandidate, canonicalMap);

    expect(result.isValid).toBe(true);
    expect(result.canonicalArticle).toMatchObject(canonicalRecord);
    expect(result.canonicalArticle?.abstract).not.toBe(bigQueryCandidate.abstract);
  });

  it('assigns a unique evidence foreign key to every paper', () => {
    const evidence = createEvidenceObjects([
      canonicalRecord,
      { ...canonicalRecord, pmid: '38367737', title: 'Second verified paper' },
      { ...canonicalRecord, pmid: '38687341', title: 'Third verified paper' },
    ]);
    expect(evidence.map((item) => item.id)).toEqual(['E1', 'E2', 'E3']);
    expect(new Set(evidence.map((item) => item.pmid)).size).toBe(3);
  });

  it('preserves direct-evidence metadata in the physician-facing evidence overview', () => {
    const evidence = createEvidenceObjects([{
      ...canonicalRecord,
      evidenceType: 'direct',
      evidenceCategory: 'Direct Evidence',
      conditionMatchStatus: 'confirmed',
      interventionMatchStatus: 'confirmed',
      populationMatchStatus: 'confirmed',
      studyDesign: 'Randomized Controlled Trial',
    } as any]);

    expect(evidence[0].evidenceCategory).toBe('Direct Evidence');
    const overview = renderEvidenceOverviewBanner(new Map([[evidence[0].id, evidence[0]]]), evidence.map((item) => item.id));
    expect(overview).toContain('最符合關鍵字：<strong>1</strong>');
    expect(overview).toContain('可能相關：<strong>0</strong>');
  });

  it('labels supplemental papers as related and reports only citations actually used by the answer', () => {
    const evidence = createEvidenceObjects([
      {
        ...canonicalRecord,
        result_group: 'best_match',
        evidenceCategory: 'Direct Evidence',
        doi: '10.1000/direct',
      } as any,
      {
        ...canonicalRecord,
        pmid: '40637782',
        title: 'Supplemental meta-analysis',
        result_group: 'possibly_related',
        evidenceCategory: 'Direct Evidence',
        doi: '10.1000/related',
      } as any,
    ]);
    const map = new Map(evidence.map((item) => [item.id, item]));
    const html = renderProfessionalUISections(map, ['E1', 'E2'], {
      used_evidence_ids: ['E1'],
      retrieved_count: 30,
    });

    expect(html).toContain('最符合關鍵字：<strong>1</strong>');
    expect(html).toContain('可能相關：<strong>1</strong>');
    expect(html).toContain('回答採用篇數：</strong> 1');
    expect(html).toContain('<a href="https://doi.org/10.1000/direct"');
    expect(html).not.toContain('[DOI: 10.1000/direct]');
  });

  it('prioritizes an explicit pediatric title over incidental adult mentions in a review', () => {
    const text = 'GLP-1 receptor agonists in pediatric obesity. These agents were initially approved in adults before pediatric studies became available.';
    expect(extractPopulationDetail(text, parseClinicalQuery('GLP-1'))).toMatchObject({
      detail: '兒童／青少年族群',
    });
    expect(extractStudyDesign('Ecnoglutide: First Approvals. This article summarizes clinical development.', ['Journal Article'])).toBe('Drug Approval Review');
  });

  it('keeps pivotal original trials ahead of reviews in the final evidence set', () => {
    const ranked = [
      { pmid: '1', evidenceType: 'direct', studyDesign: 'Systematic Review' },
      { pmid: '2', evidenceType: 'direct', studyDesign: 'Randomized Controlled Trial' },
      { pmid: '3', evidenceType: 'related', studyDesign: 'Randomized Controlled Trial' },
    ] as any;
    expect(selectDiverseClinicalEvidence(ranked, 3).map((article) => article.pmid)).toEqual(['2', '1', '3']);
  });

  it('selects extra candidates for five best matches and five possibly related papers', () => {
    const ranked = Array.from({ length: 14 }, (_, index) => ({
      pmid: String(index + 1),
      evidenceType: index < 8 ? 'direct' : 'related',
      evidenceCategory: index < 8 ? 'Direct Evidence' : 'Partially Relevant',
      studyDesign: 'Clinical Study',
      clinicalScore: 100 - index,
    })) as any;
    const selected = selectBalancedClinicalEvidence(ranked, 5, 5);
    expect(selected).toHaveLength(10);
    expect(selected.slice(0, 5).every((article) => article.evidenceType === 'direct')).toBe(true);
    expect(selected.slice(5).every((article) => article.evidenceType === 'related' || Number(article.pmid) > 5)).toBe(true);
  });

  it('validates a specific JAK drug against a JAK-inhibitor class query without treating E1 as a number', () => {
    const evidence = createEvidenceObjects([{
      pmid: '32492087',
      title: 'Efficacy and Safety of Abrocitinib in Patients With Moderate-to-Severe Atopic Dermatitis',
      abstract: 'This phase 3 randomized clinical trial evaluated abrocitinib in adolescents and adults with moderate-to-severe atopic dermatitis.',
      journal: 'JAMA Dermatology',
      relevance_score: 95,
    }])[0];
    const evidenceMap = new Map([[evidence.id, evidence]]);

    const report = verifyClaimAccuracy(
      'Abrocitinib 已有青少年異位性皮膚炎的隨機試驗資料 [E1]。',
      evidenceMap,
      'JAK inhibitor pediatric atopic dermatitis'
    );

    expect(report.abstainRequired).toBe(false);
    expect(report.validatedAnswer).toContain('[E1｜摘要]');
  });

  it('rejects an answer when no evidence citation survives final claim validation', () => {
    const evidence = createEvidenceObjects([canonicalRecord])[0];
    const report = verifyClaimAccuracy(
      '這是一段沒有任何可驗證引用的臨床結論。',
      new Map([[evidence.id, evidence]]),
      'pediatric atopic dermatitis'
    );

    expect(report.abstainRequired).toBe(true);
    expect(report.validatedAnswer).toContain('查無足以支持具體臨床結論');
  });

  it('decodes PubMed XML entities before displaying canonical metadata', () => {
    const parsed = parseCanonicalPubMedRecord(`
      <PubmedArticle><MedlineCitation><PMID>41239921</PMID><Article>
      <ArticleTitle>Safety across 6&#x2009;years &amp; follow-up</ArticleTitle>
      <Abstract><AbstractText>Results &amp; conclusions were reported.</AbstractText></Abstract>
      <Journal><JournalIssue><PubDate><Year>2025</Year></PubDate></JournalIssue><Title>Journal &amp; Medicine</Title></Journal>
      </Article></MedlineCitation></PubmedArticle>
    `);

    expect(parsed?.title).toBe('Safety across 6 years & follow-up');
    expect(parsed?.abstract).toContain('Results & conclusions');
    expect(parsed?.journal).toBe('Journal & Medicine');
  });
});
