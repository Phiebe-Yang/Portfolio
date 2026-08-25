import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import styled from '@emotion/styled';
import { marked } from 'marked';
import { formatClinicalAnswerForDisplay } from './answerFormatting';

interface Message {
  id: string;
  text: string | { response: string } | any;
  timestamp: number;
  isAI?: boolean;
  pubmedResults?: Array<{
    pmid: string;
    doi?: string;
    title: string;
    authors?: string[];
    journal?: string;
    publication_date?: string;
    journal_issue_date?: string;
    electronic_publication_date?: string;
    first_publication_date?: string;
    relevance_score?: number;
    result_group?: 'best_match' | 'possibly_related';
  }>;
  meta?: {
    provider?: string;
    model_id?: string;
    request_id?: string;
    retrieved_count?: number;
    used_count?: number;
  };
}

interface ChatInitResponse {
  id: string;
}

interface ChatResponse {
  messages: Message[];
}

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  min-height: 100svh;
  width: 100%;
  overflow: hidden;
  background: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #1e293b;
`;

const Header = styled.div`
  background: #1e3a8a;
  padding: 24px 20px;
  text-align: center;
  border-bottom: 3px solid #2563eb;
  color: white;
  flex: 0 0 auto;
  
  h1 {
    font-size: 1.8rem;
    font-weight: 700;
    margin: 0 0 8px 0;
    letter-spacing: -0.025em;
  }
  
  .subtitle {
    color: #93c5fd;
    font-size: 0.95rem;
    font-weight: 400;
  }

  @media (max-width: 640px) {
    padding: calc(12px + env(safe-area-inset-top, 0px)) 12px 12px;

    h1 {
      font-size: clamp(1.05rem, 5vw, 1.3rem);
      margin-bottom: 4px;
      line-height: 1.25;
    }

    .subtitle {
      font-size: 0.82rem;
      line-height: 1.35;
    }
  }
`;

const ChatContainer = styled.div`
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  @media (max-width: 640px) {
    padding: 12px 10px;
    gap: 12px;
  }
`;

const MessageBubble = styled.div<{ isAI?: boolean }>`
  display: flex;
  width: 100%;
  min-width: 0;
  justify-content: ${props => props.isAI ? 'flex-start' : 'flex-end'};
`;

const AIMessagePanel = styled.div`
  width: 85%;
  min-width: 0;

  @media (max-width: 640px) {
    width: 100%;
  }
`;

const MessageContent = styled.div<{ isAI?: boolean; fullWidth?: boolean }>`
  max-width: ${props => props.fullWidth ? '100%' : '85%'};
  width: ${props => props.fullWidth ? '100%' : 'auto'};
  min-width: 0;
  padding: 14px 18px;
  border-radius: 8px;
  background: ${props => props.isAI ? '#ffffff' : '#2563eb'};
  color: ${props => props.isAI ? '#0f172a' : '#ffffff'};
  border: ${props => props.isAI ? '1px solid #cbd5e1' : 'none'};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  line-height: 1.6;
  font-size: 0.95rem;
  overflow-x: auto;
  overflow-wrap: anywhere;
  word-break: break-word;

  a {
    overflow-wrap: anywhere;
    word-break: break-word;
  }

  img, video {
    max-width: 100%;
    height: auto;
  }

  p {
    margin: 0 0 10px 0;
    &:last-child {
      margin-bottom: 0;
    }
  }

  h1, h2, h3, h4, h5, h6 {
    margin: 14px 0 8px 0;
    font-weight: 700;
    line-height: 1.3;
    color: ${props => props.isAI ? '#1e3a8a' : '#ffffff'};
  }

  h1 { font-size: 1.25rem; }
  h2 {
    font-size: 1.15rem;
    padding-bottom: 7px;
    border-bottom: 1px solid ${props => props.isAI ? '#bfdbfe' : 'rgba(255, 255, 255, 0.3)'};
  }
  h3 { font-size: 1.05rem; }

  blockquote {
    margin: 8px 0 16px;
    padding: 12px 14px;
    border-left: 4px solid ${props => props.isAI ? '#2563eb' : '#ffffff'};
    border-radius: 6px;
    background: ${props => props.isAI ? '#eff6ff' : 'rgba(255, 255, 255, 0.12)'};
    color: ${props => props.isAI ? '#1e3a8a' : '#ffffff'};

    p {
      margin: 0;
    }
  }

  strong, b {
    font-weight: 700;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    margin: 12px 0;
    font-size: 0.88rem;
    display: block;
    overflow-x: auto;
    max-width: 100%;
    -webkit-overflow-scrolling: touch;
  }

  th, td {
    border: 1px solid ${props => props.isAI ? '#cbd5e1' : 'rgba(255, 255, 255, 0.3)'};
    padding: 8px 12px;
    text-align: left;
  }

  th {
    background-color: ${props => props.isAI ? '#f1f5f9' : 'rgba(255, 255, 255, 0.15)'};
    font-weight: 600;
    color: ${props => props.isAI ? '#1e3a8a' : '#ffffff'};
  }

  tr:nth-of-type(even) {
    background-color: ${props => props.isAI ? '#f8fafc' : 'rgba(255, 255, 255, 0.05)'};
  }

  ul, ol {
    margin: 8px 0 12px 0;
    padding-left: 20px;
  }

  li {
    margin-bottom: 4px;
  }

  code {
    background: ${props => props.isAI ? '#f1f5f9' : 'rgba(0, 0, 0, 0.2)'};
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.85em;
    overflow-wrap: anywhere;
  }

  pre {
    background: ${props => props.isAI ? '#0f172a' : 'rgba(0, 0, 0, 0.3)'};
    color: ${props => props.isAI ? '#f8fafc' : '#ffffff'};
    padding: 12px;
    border-radius: 6px;
    overflow-x: auto;
    margin: 10px 0;
    code {
      background: none;
      padding: 0;
      white-space: pre;
    }
  }

  hr {
    border: none;
    border-top: 1px solid ${props => props.isAI ? '#e2e8f0' : 'rgba(255, 255, 255, 0.3)'};
    margin: 14px 0;
  }

  /* Transparency Block Styles */
  .transparency-container {
    display: flex;
    gap: 12px;
    margin: 12px 0;
    font-size: 0.85rem;

    @media (max-width: 640px) {
      flex-direction: column;
    }

    .synthesis-card {
      min-width: 0;
      flex: 1;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 6px;
      padding: 10px 12px;
      color: #0369a1;

      .card-subtitle {
        font-weight: 700;
        color: #0284c7;
        margin-bottom: 4px;
      }
    }

    .sources-card {
      min-width: 0;
      flex: 1;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 10px 12px;
      color: #15803d;

      .card-subtitle {
        font-weight: 700;
        color: #166534;
        margin-bottom: 4px;
      }
    }
  }

  /* Answer Provenance Box Styles */
  .answer-provenance-box {
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 14px 16px;
    margin: 16px 0 8px 0;
    font-size: 0.85rem;

    .provenance-title {
      font-weight: 700;
      color: #1e3a8a;
      margin-bottom: 10px;
      font-size: 0.9rem;
    }

    .provenance-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
      gap: 8px;
      color: #334155;
    }
  }

  /* Supporting passage in card */
  .card-passage {
    background: #fdf4ff;
    border: 1px solid #f5d0fe;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 0.88rem;
    color: #86198f;
    margin-bottom: 10px;

    .unidentified-passage {
      color: #a21caf;
      font-style: italic;
    }
  }

  /* Evidence Overview Banner Styles */
  .evidence-overview {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 8px;
    padding: 12px 16px;
    margin: 12px 0;

    .overview-header {
      font-weight: 700;
      color: #166534;
      font-size: 0.95rem;
      margin-bottom: 8px;
    }

    .overview-stats {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 0.85rem;
      color: #15803d;
    }

    .stat-item {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      padding: 4px 10px;
      border-radius: 6px;
    }
  }

  /* Professional UI Evidence Cards Styles */
  .evidence-card {
    min-width: 0;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-left: 4px solid #2563eb;
    border-radius: 8px;
    padding: 16px;
    margin: 14px 0;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

    .card-source-badge {
      margin-bottom: 8px;
      .pubmed-verified-tag {
        display: inline-block;
        max-width: 100%;
        white-space: normal;
        background: #065f46;
        color: #ffffff;
        font-size: 0.72rem;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 4px;
        letter-spacing: 0.03em;
      }
    }

    .card-header {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
    }

    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.78rem;
      font-weight: 700;
    }

    .cat-direct {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #86efac;
    }

    .cat-partial {
      background: #fef9c3;
      color: #a16207;
      border: 1px solid #fde047;
    }

    .cat-background {
      background: #f1f5f9;
      color: #475569;
      border: 1px solid #cbd5e1;
    }

    .tier-badge {
      background: #dbeafe;
      color: #1e40af;
    }

    .score-badge {
      background: #dcfce7;
      color: #166534;
    }

    .source-badge {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
    }

    .card-title {
      font-size: 1.05rem;
      font-weight: 700;
      color: #1e3a8a;
      margin: 6px 0;
      overflow-wrap: anywhere;
    }

    .card-meta {
      font-size: 0.88rem;
      color: #475569;
      margin-bottom: 10px;
      overflow-wrap: anywhere;
    }

    .card-breakdown {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 0.88rem;
      color: #1e40af;
      margin-bottom: 10px;

      ul {
        margin: 4px 0 0 18px;
        padding: 0;
      }
    }

    .card-abstract {
      font-size: 0.9rem;
      color: #334155;
      margin-bottom: 10px;
      line-height: 1.5;
    }

    .card-limitations {
      background: #fffbebf1;
      border: 1px solid #fde68a;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 0.85rem;
      color: #92400e;
      margin-bottom: 12px;

      ul {
        margin: 4px 0 0 18px;
        padding: 0;
      }
    }

    .card-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 0.88rem;
      flex-wrap: wrap;
      min-width: 0;

      > a {
        max-width: 100%;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      .verify-btn {
        display: inline-block;
        background: #2563eb;
        color: #ffffff;
        padding: 6px 12px;
        border-radius: 4px;
        text-decoration: none;
        font-weight: 600;
        transition: background 0.2s;

        &:hover {
          background: #1d4ed8;
          color: #ffffff;
        }
      }
    }
  }

  @media (max-width: 640px) {
    max-width: ${props => props.fullWidth || props.isAI ? '100%' : '88%'};
    padding: 11px 12px;
    font-size: 0.9rem;
    line-height: 1.5;
    border-radius: 7px;

    table {
      font-size: 0.8rem;
    }

    th, td {
      padding: 6px 8px;
      min-width: 132px;
      vertical-align: top;
    }

    .transparency-container {
      gap: 8px;
    }

    .answer-provenance-box,
    .evidence-overview,
    .evidence-card {
      padding: 11px;
      margin: 10px 0;
    }

    .provenance-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .overview-stats {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 6px;
    }

    .stat-item {
      width: 100%;
      padding: 6px 8px;
    }

    .evidence-card {
      border-left-width: 3px;

      .card-header {
        gap: 6px;
      }

      .badge {
        max-width: 100%;
        white-space: normal;
        overflow-wrap: anywhere;
      }

      .card-breakdown,
      .card-passage,
      .card-limitations {
        padding: 8px 9px;
      }

      .card-actions {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;

        .verify-btn {
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
      }
    }

    h1 { font-size: 1.1rem; }
    h2 { font-size: 1.0rem; }
    h3 { font-size: 0.95rem; }
  }
`;

const LoadingMessage = styled.div<{ isAI?: boolean }>`
  display: flex;
  justify-content: flex-start;

  .loading-card {
    padding: 14px 18px;
    background: #ffffff;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    border-left: 4px solid #2563eb;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    max-width: 85%;
  }

  .stage-title {
    font-weight: 700;
    color: #1e3a8a;
    font-size: 0.95rem;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .model-info {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 0.82rem;
    color: #64748b;
    border-top: 1px solid #f1f5f9;
    padding-top: 6px;

    code {
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      color: #0f172a;
    }
  }

  @media (max-width: 640px) {
    .loading-card {
      padding: 10px 14px;
      max-width: 100%;
      width: 100%;
    }
  }
`;

const MessageActions = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
`;

const ExportCsvButton = styled.button`
  min-height: 40px;
  padding: 9px 14px;
  border: 1px solid #93c5fd;
  border-radius: 6px;
  background: #eff6ff;
  color: #1e40af;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: #dbeafe;
  }

  @media (max-width: 640px) {
    width: 100%;
    min-height: 44px;
  }
`;

const InputContainer = styled.div`
  padding: 16px 20px;
  background: white;
  border-top: 1px solid #e2e8f0;
  display: flex;
  gap: 12px;
  align-items: center;
  flex: 0 0 auto;

  @media (max-width: 640px) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    padding: 10px 10px 8px;
    gap: 8px;
  }
`;

const Input = styled.textarea`
  flex: 1;
  min-width: 0;
  width: 100%;
  min-height: 46px;
  max-height: 112px;
  padding: 12px 16px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 16px; /* Prevents auto-zoom on iOS mobile browsers */
  outline: none;
  resize: vertical;
  line-height: 1.4;
  font-family: inherit;
  transition: border-color 0.2s;

  &:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
  }

  &:disabled {
    background: #f1f5f9;
  }

  @media (max-width: 640px) {
    grid-column: 1 / -1;
    min-height: 68px;
    max-height: 128px;
    padding: 10px 12px;
    resize: none;
  }
`;

const Button = styled.button<{ variant?: 'primary' | 'secondary' }>`
  padding: 12px 20px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  border: none;
  transition: background-color 0.2s;
  white-space: nowrap;
  flex-shrink: 0;

  ${props => props.variant === 'secondary' ? `
    background: #e2e8f0;
    color: #334155;
    &:hover { background: #cbd5e1; }
  ` : `
    background: #2563eb;
    color: white;
    &:hover { background: #1d4ed8; }
  `}

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    padding: 10px 12px;
    font-size: 0.85rem;
    width: 100%;
    min-height: 44px;
  }
`;

const Footer = styled.div`
  padding: 12px 20px;
  background: #f1f5f9;
  border-top: 1px solid #e2e8f0;
  text-align: center;
  font-size: 0.85rem;
  color: #64748b;
  flex: 0 0 auto;

  a {
    color: #2563eb;
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }

  @media (max-width: 640px) {
    padding: 6px 10px max(6px, env(safe-area-inset-bottom, 0px));
    font-size: 0.68rem;
    line-height: 1.35;
  }
`;

function renderMarkdownHTML(text: any): string {
  let content = '';
  
  if (typeof text === 'string') {
    content = text;
  } else if (text && typeof text === 'object') {
    if (text.choices && Array.isArray(text.choices) && text.choices[0]?.message?.content) {
      content = text.choices[0].message.content;
    } else if (typeof text.response === 'string') {
      content = text.response;
    } else if (typeof text.text === 'string') {
      content = text.text;
    } else if (typeof text.message === 'string') {
      content = text.message;
    } else {
      content = JSON.stringify(text);
    }
  } else {
    content = String(text || '');
  }

  // If content is a JSON string, attempt to parse choices/response/answer
  if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed.answer === 'string') {
        content = parsed.answer;
      } else if (parsed.choices && Array.isArray(parsed.choices) && parsed.choices[0]?.message?.content) {
        content = parsed.choices[0].message.content;
      } else if (typeof parsed.response === 'string') {
        content = parsed.response;
      } else if (typeof parsed.text === 'string') {
        content = parsed.text;
      }
    } catch {
      // keep content as is
    }
  }

  // Remove emojis
  let cleanContent = content.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{2B06}]|[0-9]️⃣/gu, '');

  const legacyLabelReplacements: Array<[string, string]> = [
    ['AI SYNTHESIS', 'AI 回答摘要'],
    ['EVIDENCE SOURCES', '實證來源'],
    ['ANSWER PROVENANCE', '回答來源追溯'],
    ['EVIDENCE OVERVIEW (檢索實證總覽)', '檢索實證總覽'],
    ['Newest Direct Evidence:', '最新直接證據年份：'],
    ['Direct Evidence:', '直接證據：'],
    ['Partially Relevant:', '部分相關證據：'],
    ['Background Evidence:', '背景證據：'],
    ['Systematic Reviews / Meta-Analyses:', '系統性回顧／統合分析：'],
    ['PUBMED VERIFIED (Bibliographic Identity Verified)', 'PubMed 書目資料已核對'],
    ['檢索實證與來源資料 (Source Data - PubMed Verified)', '已核對的 PubMed 實證與來源資料'],
    ['Source Data - PubMed Verified', '已核對的 PubMed 來源資料'],
    ['可驗證條件對照 (Verified Match Breakdown):', '可驗證條件對照：'],
    ['發表時間 (Publication Date):', '發表時間：'],
    ['摘要精華 (Abstract Snippet):', '摘要節錄：'],
    ['原文佐證句 (Supporting Passage):', '摘要原文佐證句：'],
    ['Supporting Passage', '摘要原文佐證句'],
    ['Clinical Limitations', '臨床侷限與注意'],
    ['Verified Match Breakdown', '可驗證條件對照'],
    ['Verify Source (PubMed 官方校驗)', '前往 PubMed 官方頁面核對'],
    ['AI Provider:', 'AI 服務：'],
    ['Provider:', 'AI 服務：'],
    ['Model:', '模型：'],
    ['Evidence Database:', '實證資料庫：'],
    ['Database:', '資料庫：'],
    ['Evidence used:', '使用文獻：'],
    ['Source coverage:', '來源範圍：'],
    ['Full text:', '全文：'],
    ['PubMed Dataset Last Sync:', 'PubMed 資料最後同步：'],
    ['Retrieved Papers:', '檢索篇數：'],
    ['Papers Used in Answer:', '回答採用篇數：'],
    ['Evidence Coverage:', '實證涵蓋範圍：'],
    ['Citation Validation:', '引用驗證：'],
    ['PMID-Title Validation:', 'PMID 與標題核對：'],
    ['Request ID:', '請求識別碼：'],
    ['Condition: Matched', '疾病／適應症：符合'],
    ['Condition: Mismatch / Unconfirmed', '疾病／適應症：不符或無法確認'],
    ['Intervention: Matched', '介入措施／藥物：符合'],
    ['Intervention: Mismatch / Unconfirmed', '介入措施／藥物：不符或無法確認'],
    ['Population:', '研究族群：'],
    ['Sample Size:', '樣本數：'],
    ['Study Duration:', '研究期間：'],
    ['Not used', '未使用'],
    ['passed', '通過'],
    ['Level 1: Meta-Analysis / Systematic Review', '第 1 級：統合分析／系統性回顧'],
    ['Level 2: RCT / Phase 3', '第 2 級：RCT／第三期臨床試驗'],
    ['Level 3: Clinical Trial / Cohort', '第 3 級：臨床試驗／世代研究'],
    ['Level 4: Observational / Case Study', '第 4 級：觀察性研究／病例研究'],
    ['NCBI PubMed E-Utilities Live API & BigQuery Baseline', 'NCBI PubMed E-Utilities 即時 API 與 BigQuery 基準資料'],
    ['PubMed metadata + abstracts', 'PubMed 書目資料與摘要'],
    ['Randomized Controlled Trial', '隨機對照試驗（RCT）'],
    ['Meta-Analysis', '統合分析'],
    ['Systematic Review', '系統性回顧'],
    ['Clinical Trial', '臨床試驗'],
    ['Cohort Study', '世代研究'],
    ['Observational Study', '觀察性研究'],
    ['Clinical Study', '臨床研究'],
    ['Pediatric & Adolescent Population', '兒童與青少年族群'],
    ['Pediatric Population (<12 years)', '兒童族群（未滿 12 歲）'],
    ['Adolescents (12-17 years)', '青少年（12–17 歲）'],
    ['Adult Population', '成人族群'],
    ['Elderly Population (>=65 years)', '高齡族群（65 歲以上）'],
    ['General Clinical Population', '一般臨床族群'],
    ['Adults only; no pediatric data reported', '僅納入成人；摘要未報告兒童資料'],
    ['Population age: Cannot be confirmed from PubMed abstract', '族群年齡：無法由 PubMed 摘要確認'],
    ['Direct supporting passage not identified in abstract', '摘要中未辨識出可直接支持結論的原文句'],
    ['期刊:', '期刊：'],
    ['研究設計:', '研究設計：'],
    ['作者:', '作者：'],
  ];
  legacyLabelReplacements.forEach(([from, to]) => {
    cleanContent = cleanContent.replaceAll(from, to);
  });
  cleanContent = cleanContent.replace(/\[E(\d+)\s*\|\s*Abstract\]/gi, '[E$1｜摘要]');
  cleanContent = cleanContent.replace(/(\d+)\s+PubMed records/gi, '$1 篇 PubMed 紀錄');
  cleanContent = cleanContent.replace(/(\d+)\s+PubMed abstracts\s*\|\s*(\d+)\s+full-text articles/gi, '$1 篇 PubMed 摘要｜$2 篇全文');
  cleanContent = cleanContent.replace(/<span class="badge cat-direct">Direct Evidence<\/span>/gi, '<span class="badge cat-direct">直接證據</span>');
  cleanContent = cleanContent.replace(/<span class="badge cat-partial">Partially Relevant<\/span>/gi, '<span class="badge cat-partial">部分相關證據</span>');
  cleanContent = cleanContent.replace(/<span class="badge cat-background">Background \/ Related Evidence<\/span>/gi, '<span class="badge cat-background">背景／相關證據</span>');
  cleanContent = cleanContent.replace(
    /(<strong>樣本數：<\/strong>\s*)([\d,.]+)\s+(patients?|subjects?|participants|cases|individuals)/gi,
    (_match, prefix: string, value: string, unit: string) => {
      const unitLabel: Record<string, string> = {
        patient: '名病人', patients: '名病人', subject: '名受試者', subjects: '名受試者',
        participant: '名受試者', participants: '名受試者', cases: '個病例', individuals: '人',
      };
      return `${prefix}${value} ${unitLabel[unit.toLowerCase()] || unit}`;
    }
  );
  cleanContent = cleanContent.replace(
    /(<strong>研究期間：<\/strong>\s*)([\d.]+)\s+(years?|months?|weeks?|days?)(?:\s+(follow-up|treatment|duration))?/gi,
    (_match, prefix: string, value: string, unit: string, suffix?: string) => {
      const unitLabel: Record<string, string> = {
        year: '年', years: '年', month: '個月', months: '個月',
        week: '週', weeks: '週', day: '天', days: '天',
      };
      const suffixLabel: Record<string, string> = { 'follow-up': '追蹤', treatment: '治療', duration: '期間' };
      return `${prefix}${value} ${unitLabel[unit.toLowerCase()] || unit}${suffix ? suffixLabel[suffix.toLowerCase()] || suffix : ''}`;
    }
  );
  cleanContent = formatClinicalAnswerForDisplay(cleanContent);

  try {
    // Render Markdown strictly without scanning LLM text for PMID or DOI autolinking
    let parsedHtml = marked.parse(cleanContent, { gfm: true, breaks: true }) as string;
    parsedHtml = parsedHtml.replace(/<a href="/g, '<a target="_blank" rel="noopener noreferrer" href="');
    return parsedHtml;
  } catch {
    return cleanContent;
  }
}

function exportMessagePapersCsv(message: Message): void {
  const papers = message.pubmedResults || [];
  if (papers.length === 0) return;

  const csvCell = (value: unknown): string => {
    let text = value == null ? '' : String(value);
    if (/^[=+\-@]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };

  const header = ['清單分類', 'PMID', 'DOI', '論文標題', '作者', '期刊', '首次公開日期', '電子發表日期', '期刊卷期日期', '相關性分數', 'PubMed 連結'];
  const rows = papers.map((paper) => [
    paper.result_group === 'best_match' ? '最符合關鍵字' : '可能相關',
    paper.pmid,
    paper.doi || '',
    paper.title,
    paper.authors?.join('; ') || '',
    paper.journal || '',
    paper.first_publication_date || paper.electronic_publication_date || paper.publication_date || '',
    paper.electronic_publication_date || '',
    paper.journal_issue_date || paper.publication_date || '',
    paper.relevance_score ?? '',
    `https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`,
  ]);
  const csv = '\uFEFF' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `pubmed-papers-${message.meta?.request_id || message.id}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatStateId, setChatStateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [activeModelId, setActiveModelId] = useState('@cf/openai/gpt-oss-120b');
  const [activeProvider, setActiveProvider] = useState('Cloudflare Workers AI');

  const processingStages = [
    '正在解析臨床問題',
    '正在搜尋 PubMed 數據庫',
    '正在篩選相關論文',
    '正在驗證 PMID 與文獻資料',
    '正在整理臨床證據',
    '正在驗證回答引用',
    '正在產生最終回答'
  ];

  useEffect(() => {
    let timer: any;
    if (isLoading) {
      timer = setInterval(() => {
        setStageIndex((prev) => (prev + 1) % processingStages.length);
      }, 1500);
    } else {
      setStageIndex(0);
    }
    return () => clearInterval(timer);
  }, [isLoading]);

  useEffect(() => {
    const initializeChat = async () => {
      try {
        const initResponse = await fetch('/chat/init', { method: 'POST' });
        const initData = await initResponse.json() as ChatInitResponse;
        const id = initData.id;
        window.localStorage.removeItem('pubmed-chat-state-id');
        const response = await fetch(`/chat/${id}`);

        const data = await response.json() as ChatResponse;
        setChatStateId(id);
        setMessages(data.messages || []);
      } catch (error) {
        console.error('Failed to initialize shared chat:', error);
      }
    };

    initializeChat();
  }, []);

  const sendMessage = async () => {
    if (!newMessage.trim() || !chatStateId) return;

    try {
      setIsLoading(true);
      const userMessage: Message = {
        id: crypto.randomUUID(),
        text: newMessage,
        timestamp: Date.now(),
        isAI: false
      };
      
      setMessages(prev => [...prev, userMessage]);
      setNewMessage('');

      const response = await fetch(`/chat/${chatStateId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: newMessage,
          usePubMed: true
        }),
      });
      const data = await response.json() as { messages: Message[] };
      
      if (data.messages && Array.isArray(data.messages)) {
        const aiMessage = data.messages[1];
        if (aiMessage) {
          if (aiMessage.meta) {
            if (aiMessage.meta.model_id) setActiveModelId(aiMessage.meta.model_id);
            if (aiMessage.meta.provider) setActiveProvider(aiMessage.meta.provider);
          }
          setMessages(prev => [...prev, aiMessage]);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = async () => {
    if (!chatStateId) return;

    try {
      await fetch(`/chat/${chatStateId}`, { method: 'DELETE' });
      setMessages([]);
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewMessage(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <AppContainer>
      <Header>
        <h1>PubMed BigQuery 醫學問答機器人</h1>
        <div className="subtitle">串接 Google BigQuery 檢索 PubMed 生醫文獻資料庫與 AI 智慧問答</div>
      </Header>
      
      <ChatContainer>
        {messages.map(message => {
          const htmlContent = renderMarkdownHTML(message.text);
          return (
            <MessageBubble key={message.id} isAI={message.isAI}>
              {message.isAI ? (
                <AIMessagePanel>
                  <MessageContent isAI fullWidth dangerouslySetInnerHTML={{ __html: htmlContent }} />
                  {message.pubmedResults && message.pubmedResults.length > 0 && (
                    <MessageActions>
                      <ExportCsvButton type="button" onClick={() => exportMessagePapersCsv(message)}>
                        匯出本次論文清單（CSV）
                      </ExportCsvButton>
                    </MessageActions>
                  )}
                </AIMessagePanel>
              ) : (
                <MessageContent isAI={false} dangerouslySetInnerHTML={{ __html: htmlContent }} />
              )}
            </MessageBubble>
          );
        })}
        {isLoading && (
          <LoadingMessage isAI>
            <div className="loading-card">
              <div className="stage-title">
                <span>⏳</span> {processingStages[stageIndex]}...
              </div>
              <div className="model-info">
                <span><strong>AI 服務：</strong> {activeProvider}</span>
                <span><strong>模型：</strong> <code>{activeModelId}</code></span>
              </div>
            </div>
          </LoadingMessage>
        )}
      </ChatContainer>
      
      <InputContainer>
        <Input
          value={newMessage}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          rows={1}
          aria-label="醫學問題"
          placeholder="請輸入醫學相關問題（例如：請提供癌症免疫療法的最新文獻摘要）..."
          disabled={isLoading}
        />
        <Button onClick={sendMessage} disabled={isLoading}>
          發送
        </Button>
        <Button variant="secondary" onClick={clearChat} disabled={isLoading}>
          清除對話
        </Button>
      </InputContainer>
      
      <Footer>
        PubMed BigQuery 資料庫整合服務｜架構於 Cloudflare Workers、Workers AI 與 Google BigQuery API
      </Footer>
    </AppContainer>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
