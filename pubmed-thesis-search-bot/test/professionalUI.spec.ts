import { describe, it, expect } from 'vitest';
import {
  classifyEvidenceHierarchy,
  generateExplainableRelevance,
  deriveClinicalLimitations,
  renderProfessionalUISections,
} from '../src/professionalUI';
import { EvidenceObject } from '../src/citationIntegrity';

describe('Phase 4 — Professional UI', () => {
  const mockEvidenceMap = new Map<string, EvidenceObject>();
  mockEvidenceMap.set('E1', {
    id: 'E1',
    pmid: '50000001',
    title: 'Meta-Analysis of Pembrolizumab in NSCLC',
    abstract: 'A systematic review and meta-analysis of randomized controlled trials (RCTs). Retrospective data from small sample sizes were excluded.',
    publication_date: '2024-01',
    journal: 'Lancet Oncol',
    relevance_score: 96,
    trial_names: ['KEYNOTE-024'],
  });

  it('1. Evidence Hierarchy classification: identifies Level 1 Meta-Analysis correctly', () => {
    const tier = classifyEvidenceHierarchy(mockEvidenceMap.get('E1')!.abstract);
    expect(tier).toBe('Level 1: Meta-Analysis / Systematic Review');
  });

  it('2. Explainable relevance generator: creates plain-text reasoning for matches', () => {
    const explanation = generateExplainableRelevance(mockEvidenceMap.get('E1')!);
    expect(explanation).toBeDefined();
    expect(explanation).toContain('相關性得分');
  });

  it('3. Derive clinical limitations: extracts study limitations from abstract text', () => {
    const limits = deriveClinicalLimitations(mockEvidenceMap.get('E1')!.abstract);
    expect(limits.length).toBeGreaterThan(0);
    expect(limits[0]).toContain('回溯性');
  });

  it('4. Render professional UI sections: generates HTML Study Cards with Verify Source button', () => {
    const htmlCards = renderProfessionalUISections(mockEvidenceMap, ['E1']);

    expect(htmlCards).toContain('class="evidence-card"');
    expect(htmlCards).toContain('第 1 級：統合分析／系統性回顧');
    expect(htmlCards).toContain('前往 PubMed 官方頁面核對');
    expect(htmlCards).toContain('https://pubmed.ncbi.nlm.nih.gov/50000001/');
  });
});
