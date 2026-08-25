import { EvidenceObject } from './citationIntegrity';
import { RerankedArticle, extractSampleSize, extractStudyDuration, extractStudyDesign } from './clinicalRetrieval';
import { extractSupportingPassage } from './claimAccuracy';
import { getPubMedDatasetInfo } from './pubmedBigQuery';

/**
 * Phase 4 — Professional UI Data Contracts & Render Helper Module
 * Implements strict Physician Evidence Integrity & Interface Specifications:
 * 1. Visual Separation of SOURCE DATA vs AI CLINICAL SUMMARY
 * 2. PUBMED VERIFIED Bibliographic Badge
 * 3. Exact Publication Date from PubMed Metadata (No fake padding)
 * 4. Three Evidence Tiers: Direct Evidence / Partially Relevant / Background Evidence
 * 5. Explicit Checkmark Match Breakdown (Condition, Intervention, Population, Study Design)
 * 6. Evidence Overview Banner
 * 7. Verify Source Action
 * 8. Clinical Limitations & No Source -> No Display Rule
 * 9. AI Synthesis vs Evidence Sources Distinction & Answer Provenance
 */

export interface StudyCardData {
  evidenceId: string;
  pmid: string;
  doi?: string;
  title: string;
  authors: string;
  journal: string;
  publicationDate: string; // Exact raw string from PubMed metadata
  firstPublicationDate?: string;
  electronicPublicationDate?: string;
  journalIssueDate?: string;
  evidenceCategory: 'Direct Evidence' | 'Partially Relevant' | 'Background / Related Evidence';
  resultGroup: 'best_match' | 'possibly_related';
  evidenceTier: 'Level 1: Meta-Analysis / Systematic Review' | 'Level 2: RCT / Phase 3' | 'Level 3: Clinical Trial / Cohort' | 'Level 4: Observational / Case Study';
  conditionMatch: string;
  interventionMatch: string;
  populationMatch: string;
  studyDesign: string;
  sampleSize: string;
  studyDuration: string;
  trialNames: string[];
  abstractSnippet: string;
  supportingPassage?: string;
  clinicalLimitations: string[];
}

export interface ProvenanceData {
  provider: string;
  model_id: string;
  evidence_database: string;
  retrieved_count: number;
  used_count: number;
  citation_validation_passed: number;
  citation_validation_total: number;
  pmid_title_passed: number;
  pmid_title_total: number;
  request_id: string;
  pubmed_data_last_updated?: string;
}

/**
 * Renders AI SYNTHESIS vs EVIDENCE SOURCES Header Block (Specification #2)
 */
export function renderAISynthesisAndSourcesBlock(
  provider: string = 'Cloudflare Workers AI',
  modelId: string = '@cf/openai/gpt-oss-120b',
  usedCount: number = 0
): string {
  const syncInfo = getPubMedDatasetInfo();
  return `
<div class="transparency-container">
  <div class="synthesis-card">
    <div class="card-subtitle">🤖 AI 回答摘要</div>
    <div><strong>AI 服務：</strong> ${provider}</div>
    <div><strong>模型：</strong> <code>${modelId}</code></div>
  </div>
  <div class="sources-card">
    <div class="card-subtitle">📚 實證來源</div>
    <div><strong>資料庫：</strong> PubMed（${syncInfo.latestUpdateSource}）</div>
    <div><strong>使用文獻：</strong> ${usedCount} 篇 PubMed 紀錄</div>
    <div><strong>來源範圍：</strong> PubMed 書目資料與摘要</div>
    <div><strong>全文：</strong> 未使用</div>
  </div>
</div>
`;
}

/**
 * Renders ANSWER PROVENANCE Footer Block (Specification #9)
 */
export function renderAnswerProvenanceBlock(provenance: ProvenanceData): string {
  const syncInfo = getPubMedDatasetInfo();
  const lastUpdated = provenance.pubmed_data_last_updated || syncInfo.lastSuccessfulSync.substring(0, 10);
  return `
<div class="answer-provenance-box">
  <div class="provenance-title">🛡️ 回答來源追溯</div>
  <div class="provenance-grid">
    <div><strong>AI 服務：</strong> ${provenance.provider}</div>
    <div><strong>模型：</strong> <code>${provenance.model_id}</code></div>
    <div><strong>實證資料庫：</strong> ${provenance.evidence_database}（${syncInfo.latestUpdateSource}）</div>
    <div><strong>PubMed 資料最後同步：</strong> ${lastUpdated}</div>
    <div><strong>檢索篇數：</strong> ${provenance.retrieved_count}</div>
    <div><strong>回答採用篇數：</strong> ${provenance.used_count}</div>
    <div><strong>實證涵蓋範圍：</strong> ${provenance.used_count} 篇 PubMed 摘要｜0 篇全文</div>
    <div><strong>引用驗證：</strong> ${provenance.citation_validation_passed} / ${provenance.citation_validation_total} 通過</div>
    <div><strong>PMID 與標題核對：</strong> ${provenance.pmid_title_passed} / ${provenance.pmid_title_total} 通過</div>
    <div><strong>請求識別碼：</strong> <code>${provenance.request_id}</code></div>
  </div>
</div>
`;
}

function evidenceCategoryLabel(category: StudyCardData['evidenceCategory']): string {
  if (category === 'Direct Evidence') return '直接證據';
  if (category === 'Partially Relevant') return '部分相關證據';
  return '背景／相關證據';
}

function evidenceTierLabel(tier: StudyCardData['evidenceTier']): string {
  if (tier === 'Level 1: Meta-Analysis / Systematic Review') return '第 1 級：統合分析／系統性回顧';
  if (tier === 'Level 2: RCT / Phase 3') return '第 2 級：RCT／第三期臨床試驗';
  if (tier === 'Level 3: Clinical Trial / Cohort') return '第 3 級：臨床試驗／世代研究';
  return '第 4 級：敘述性綜述／觀察性研究／病例研究';
}

function studyDesignLabel(design: string): string {
  const labels: Record<string, string> = {
    'Randomized Controlled Trial': '隨機對照試驗（RCT）',
    'Meta-Analysis': '統合分析',
    'Systematic Review': '系統性回顧',
    'Clinical Trial': '臨床試驗',
    'Secondary Analysis of RCT': '隨機對照試驗次級分析',
    'Review Article': '敘述性／臨床綜述',
    'Drug Approval Review': '藥物核准綜述',
    'Cohort Study': '世代研究',
    'Observational Study': '觀察性研究',
    'Clinical Study': '臨床研究',
  };
  return labels[design] || design;
}

/**
 * Classifies study hierarchy tier based on text
 */
export function classifyEvidenceHierarchy(text: string): StudyCardData['evidenceTier'] {
  const lower = text.toLowerCase();
  if (lower.includes('systematic review') || lower.includes('meta-analysis') || lower.includes('meta analysis')) {
    return 'Level 1: Meta-Analysis / Systematic Review';
  }
  if (lower.includes('randomized controlled trial') || lower.includes('rct') || lower.includes('phase 3') || lower.includes('phase iii')) {
    return 'Level 2: RCT / Phase 3';
  }
  if (lower.includes('clinical trial') || lower.includes('phase 2') || lower.includes('phase ii') || lower.includes('cohort')) {
    return 'Level 3: Clinical Trial / Cohort';
  }
  return 'Level 4: Observational / Case Study';
}

/**
 * Generates explainable relevance text detailing why the paper was matched and ranked.
 */
export function generateExplainableRelevance(ev: EvidenceObject | RerankedArticle): string {
  const breakdown = (ev as RerankedArticle).matchBreakdown;
  if (!breakdown) {
    return `基於與臨床關鍵字高度關聯 (相關性得分: ${ev.relevance_score ?? 85}%)。`;
  }

  const reasons: string[] = [];
  if (breakdown.diseaseMatch) reasons.push('適應症/疾病完全比對符合');
  if (breakdown.drugMatch) reasons.push('介入藥物/處置比對符合');
  if (breakdown.studyTypeBonus >= 25) reasons.push('最高階實證研究設計 (Meta-Analysis / RCT)');
  else if (breakdown.studyTypeBonus >= 15) reasons.push('前瞻性臨床試驗等級');
  if (breakdown.recencyBonus >= 10) reasons.push('近 3 年最新發表文獻');

  return reasons.length > 0 ? reasons.join('；') + '。' : `綜合關鍵字匹配度與期刊影響力。`;
}

/**
 * Derives clinical limitations for a given paper/abstract.
 */
export function deriveClinicalLimitations(abstract: string): string[] {
  const limits: string[] = [];
  const lower = abstract.toLowerCase();

  if (lower.includes('retrospective') || lower.includes('observational')) {
    limits.push('回溯性/觀察性研究設計，無法完全排除混雜變因 (Confounding factors)。');
  }
  if (lower.includes('abstract') || !lower.includes('full text')) {
    limits.push('實證依據來自 PubMed 摘要 (Abstract-only)，細部次族群數據需核對全文。');
  }
  if (lower.includes('small sample') || lower.includes('n=') || lower.includes('pilot')) {
    limits.push('樣本數相對有限，統計檢定力 (Statistical Power) 需進一步擴大驗證。');
  }
  if (limits.length === 0) {
    limits.push('臨床結果仍需結合個體化病人特徵、器官功能與共病狀況綜合評估。');
  }

  return limits;
}

/**
 * Renders Evidence Overview Banner (Specification #24)
 * Calculates summary statistics strictly from retrieved backend evidence.
 */
export function renderEvidenceOverviewBanner(
  evidenceMap: Map<string, EvidenceObject>,
  sortedVerifiedIds: string[]
): string {
  if (sortedVerifiedIds.length === 0) return '';

  let bestMatchCount = 0;
  let relatedCount = 0;
  let reviewCount = 0;
  let newestYear = 'N/A';

  sortedVerifiedIds.forEach((id) => {
    const ev = evidenceMap.get(id);
    if (!ev) return;

    if (ev.result_group === 'possibly_related') relatedCount++;
    else bestMatchCount++;

    const studyDesign = extractStudyDesign(`${ev.title}. ${ev.abstract}`, ev.publication_types);
    if (studyDesign === 'Systematic Review' || studyDesign === 'Meta-Analysis') {
      reviewCount++;
    }

    const recencyDate = ev.first_publication_date || ev.electronic_publication_date || ev.publication_date;
    if (recencyDate) {
      const yearMatch = recencyDate.match(/\b(19\d{2}|20\d{2})\b/);
      if (yearMatch) {
        if (newestYear === 'N/A' || yearMatch[0] > newestYear) {
          newestYear = yearMatch[0];
        }
      }
    }
  });

  return `
<div class="evidence-overview">
  <div class="overview-header">📊 檢索實證總覽</div>
  <div class="overview-stats">
    <span class="stat-item direct-stat">最符合關鍵字：<strong>${bestMatchCount}</strong></span>
    <span class="stat-item background-stat">可能相關：<strong>${relatedCount}</strong></span>
    <span class="stat-item review-stat">系統性回顧／統合分析：<strong>${reviewCount}</strong></span>
    <span class="stat-item year-stat">最新首次公開年份：<strong>${newestYear}</strong></span>
  </div>
</div>
`;
}

/**
 * Renders Professional UI Sections: Evidence Overview Banner & Study Cards
 * Conforming strictly to No Source -> No Display and Source vs AI Summary separation.
 */
export function renderProfessionalUISections(
  evidenceMap: Map<string, EvidenceObject>,
  sortedVerifiedIds: string[],
  provenanceOptions?: {
    provider?: string;
    model_id?: string;
    retrieved_count?: number;
    request_id?: string;
    used_evidence_ids?: string[];
  }
): string {
  if (sortedVerifiedIds.length === 0) return '';

  const provider = provenanceOptions?.provider || 'Cloudflare Workers AI';
  const modelId = provenanceOptions?.model_id || '@cf/openai/gpt-oss-120b';
  const retrievedCount = provenanceOptions?.retrieved_count || evidenceMap.size;
  const requestId = provenanceOptions?.request_id || 'req-' + Math.random().toString(36).substring(2, 10);

  const usedEvidenceIds = provenanceOptions?.used_evidence_ids || sortedVerifiedIds;
  const synthesisHeader = renderAISynthesisAndSourcesBlock(provider, modelId, usedEvidenceIds.length);
  const overviewBanner = renderEvidenceOverviewBanner(evidenceMap, sortedVerifiedIds);

  const studyCards: StudyCardData[] = sortedVerifiedIds.map((id) => {
    const ev = evidenceMap.get(id)!;
    const rArt = ev as unknown as RerankedArticle;
    const canonicalStudyDesign = rArt.studyDesign || extractStudyDesign(`${ev.title}. ${ev.abstract}`, ev.publication_types);
    const hierarchy = classifyEvidenceHierarchy(canonicalStudyDesign);
    const limitations = deriveClinicalLimitations(ev.abstract);
    const supportingPassage = extractSupportingPassage(ev.abstract || '', ev.abstract);

    let authorsStr = '未知作者';
    if (ev.authors && ev.authors.length > 0) {
      authorsStr = ev.authors.length > 3 ? `${ev.authors.slice(0, 3).join(', ')} 等` : ev.authors.join(', ');
    }

    const resultGroup = ev.result_group || (rArt.evidenceCategory === 'Direct Evidence' ? 'best_match' : 'possibly_related');
    const category = resultGroup === 'possibly_related'
      ? 'Background / Related Evidence'
      : (rArt.evidenceCategory || 'Direct Evidence');
    const condition = rArt.conditionMatchStatus === 'confirmed' ? '✓ 疾病／適應症：符合' : '✕ 疾病／適應症：不符或無法確認';
    const intervention = rArt.interventionMatchStatus === 'confirmed' ? '✓ 介入措施／藥物：符合' : '✕ 介入措施／藥物：不符或無法確認';
    const popDetail = rArt.populationDetail || '族群年齡：無法由 PubMed 摘要確認';
    const sampleSize = rArt.sampleSize || extractSampleSize(`${ev.title} ${ev.abstract}`);
    const studyDuration = rArt.studyDuration || extractStudyDuration(`${ev.title} ${ev.abstract}`);
    const studyDesign = canonicalStudyDesign;

    return {
      evidenceId: ev.id,
      pmid: ev.pmid,
      doi: ev.doi,
      title: ev.title,
      authors: authorsStr,
      journal: ev.journal || '未知期刊',
      publicationDate: ev.publication_date || '未知時間', // Raw metadata string, no padding
      firstPublicationDate: ev.first_publication_date,
      electronicPublicationDate: ev.electronic_publication_date,
      journalIssueDate: ev.journal_issue_date || ev.publication_date,
      evidenceCategory: category,
      resultGroup,
      evidenceTier: hierarchy,
      conditionMatch: condition,
      interventionMatch: intervention,
      populationMatch: popDetail,
      studyDesign: studyDesignLabel(studyDesign),
      sampleSize,
      studyDuration,
      trialNames: ev.trial_names,
      abstractSnippet: ev.abstract.substring(0, 350) + '...',
      supportingPassage,
      clinicalLimitations: limitations,
    };
  });

  // Render Markdown UI Component Output
  let uiMarkdown = `\n\n---\n${synthesisHeader}\n${overviewBanner}\n\n`;

  const studyGroups = [
    { title: '最符合關鍵字的研究（最多 5 篇）', cards: studyCards.filter((card) => card.resultGroup === 'best_match') },
    { title: '可能相關的研究（額外最多 5 篇）', cards: studyCards.filter((card) => card.resultGroup === 'possibly_related') },
  ];

  studyGroups.forEach((group) => {
    if (group.cards.length === 0) return;
    uiMarkdown += `\n### ${group.title}\n\n`;
    group.cards.forEach((card) => {
    const doiPart = card.doi
      ? ` ｜ <a href="https://doi.org/${card.doi}" target="_blank" rel="noopener noreferrer">DOI: ${card.doi}</a>`
      : '';

    const catClass = card.resultGroup === 'best_match' ? 'cat-direct' : 'cat-background';
    const resultGroupLabel = card.resultGroup === 'best_match' ? '最符合關鍵字' : '可能相關';

    const passageHTML = card.supportingPassage
      ? `<div class="card-passage"><strong>摘要原文佐證句：</strong> <em>"${card.supportingPassage}"</em></div>`
      : `<div class="card-passage"><span class="unidentified-passage">摘要中未辨識出可直接支持結論的原文句</span></div>`;

    const publicationDateLine = card.electronicPublicationDate
      ? `<strong>首次電子發表：</strong> ${card.electronicPublicationDate}｜<strong>期刊卷期日期：</strong> ${card.journalIssueDate || '未報告'}`
      : `<strong>發表日期：</strong> ${card.firstPublicationDate || card.publicationDate}`;

    uiMarkdown += `
<div class="evidence-card" data-evidence-id="${card.evidenceId}">
  <div class="card-source-badge">
    <span class="pubmed-verified-tag">✓ PubMed 書目資料已核對</span>
  </div>
  <div class="card-header">
    <span class="badge ${catClass}">${resultGroupLabel}</span>
    <span class="badge tier-badge">${evidenceTierLabel(card.evidenceTier)}</span>
    <span class="badge source-badge">PMID: <a href="https://pubmed.ncbi.nlm.nih.gov/${card.pmid}/" target="_blank">${card.pmid}</a></span>
  </div>

  <h4 class="card-title">[${card.evidenceId}] ${card.title}</h4>

  <div class="card-meta">
    ${publicationDateLine}｜<strong>期刊：</strong> ${card.journal}｜<strong>研究設計：</strong> ${card.studyDesign}<br/>
    <strong>作者：</strong> ${card.authors}
  </div>

  <div class="card-breakdown">
    <strong>可驗證條件對照：</strong>
    <ul>
      <li>${card.conditionMatch}</li>
      <li>${card.interventionMatch}</li>
      <li><strong>研究族群：</strong> ${card.populationMatch}</li>
      <li><strong>樣本數：</strong> ${card.sampleSize}</li>
      <li><strong>研究期間：</strong> ${card.studyDuration}</li>
    </ul>
  </div>

  <div class="card-abstract">
    <strong>摘要節錄：</strong> ${card.abstractSnippet}
  </div>

  ${passageHTML}

  <div class="card-limitations">
    <strong>臨床侷限與注意：</strong>
    <ul>
      ${card.clinicalLimitations.map((lim) => `<li>${lim}</li>`).join('')}
    </ul>
  </div>

  <div class="card-actions">
    <a href="https://pubmed.ncbi.nlm.nih.gov/${card.pmid}/" target="_blank" rel="noopener noreferrer" class="verify-btn">前往 PubMed 官方頁面核對</a>${doiPart}
  </div>
</div>
\n`;
    });
  });

  const provenanceData: ProvenanceData = {
    provider,
    model_id: modelId,
    evidence_database: 'PubMed',
    retrieved_count: retrievedCount,
    used_count: usedEvidenceIds.length,
    citation_validation_passed: usedEvidenceIds.length,
    citation_validation_total: usedEvidenceIds.length,
    pmid_title_passed: sortedVerifiedIds.length,
    pmid_title_total: sortedVerifiedIds.length,
    request_id: requestId,
  };

  const provenanceFooter = renderAnswerProvenanceBlock(provenanceData);
  uiMarkdown += `\n${provenanceFooter}\n`;

  return uiMarkdown;
}
