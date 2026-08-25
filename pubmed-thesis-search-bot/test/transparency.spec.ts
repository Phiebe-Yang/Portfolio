import { describe, it, expect } from 'vitest';
import {
  renderAISynthesisAndSourcesBlock,
  renderAnswerProvenanceBlock,
  renderProfessionalUISections,
  ProvenanceData,
} from '../src/professionalUI';
import { EvidenceObject } from '../src/citationIntegrity';

describe('Model & Evidence Transparency Verification Suite', () => {
  const mockEvidenceMap = new Map<string, EvidenceObject>();
  mockEvidenceMap.set('E1', {
    id: 'E1',
    pmid: '91000001',
    title: 'Randomized Trial of Semaglutide in Obesity',
    abstract: 'In a randomized controlled trial (RCT) involving 344 patients over 16 weeks, Semaglutide significantly reduced body weight.',
    publication_date: '2024-03',
    journal: 'JAMA Dermatol',
    relevance_score: 95,
    trial_names: ['SELECT'],
    doi: '10.1001/jamadermatol.2024.0001',
  });

  it('1. AI Synthesis vs Evidence Source distinction block', () => {
    const block = renderAISynthesisAndSourcesBlock('Cloudflare Workers AI', '@cf/openai/gpt-oss-120b', 1);

    expect(block).toContain('AI 回答摘要');
    expect(block).toContain('Cloudflare Workers AI');
    expect(block).toContain('@cf/openai/gpt-oss-120b');

    expect(block).toContain('實證來源');
    expect(block).toContain('PubMed');
    expect(block).toContain('1 篇 PubMed 紀錄');
    expect(block).toContain('全文：');
  });

  it('2. Answer Provenance Block with dynamic request & validation metrics', () => {
    const prov: ProvenanceData = {
      provider: 'Cloudflare Workers AI',
      model_id: '@cf/openai/gpt-oss-120b',
      evidence_database: 'PubMed',
      retrieved_count: 15,
      used_count: 1,
      citation_validation_passed: 1,
      citation_validation_total: 1,
      pmid_title_passed: 1,
      pmid_title_total: 1,
      request_id: 'req-test-uuid-1234',
    };

    const provHTML = renderAnswerProvenanceBlock(prov);

    expect(provHTML).toContain('回答來源追溯');
    expect(provHTML).toContain('Cloudflare Workers AI');
    expect(provHTML).toContain('@cf/openai/gpt-oss-120b');
    expect(provHTML).toContain('檢索篇數：</strong> 15');
    expect(provHTML).toContain('回答採用篇數：</strong> 1');
    expect(provHTML).toContain('引用驗證：</strong> 1 / 1 通過');
    expect(provHTML).toContain('req-test-uuid-1234');
  });

  it('3. Professional UI combines transparency headers, study cards, and provenance', () => {
    const fullUI = renderProfessionalUISections(mockEvidenceMap, ['E1'], {
      provider: 'Cloudflare Workers AI',
      model_id: '@cf/openai/gpt-oss-120b',
      retrieved_count: 10,
      request_id: 'req-test-999',
    });

    expect(fullUI).toContain('AI 回答摘要');
    expect(fullUI).toContain('實證來源');
    expect(fullUI).toContain('檢索實證總覽');
    expect(fullUI).toContain('PubMed 書目資料已核對');
    expect(fullUI).toContain('摘要原文佐證句');
    expect(fullUI).toContain('回答來源追溯');
    expect(fullUI).toContain('req-test-999');
  });
});
