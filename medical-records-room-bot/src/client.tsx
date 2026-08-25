import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import styled from '@emotion/styled';

interface Message {
  id: string;
  text: string | { response: string } | any;
  timestamp: number;
  isAI?: boolean;
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
  background: linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 50%, #80deea 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  position: relative;
`;

const Header = styled.div`
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  padding: 20px;
  text-align: center;
  border-bottom: 1px solid rgba(0, 150, 136, 0.2);
  position: relative;
  
  h1 {
    color: #00796b;
    font-size: 1.8rem;
    font-weight: 700;
    margin: 0 0 5px 0;
  }
  
  .subtitle {
    color: #004d40;
    font-size: 0.9rem;
    font-weight: 500;
  }

  .jersey-numbers {
    position: absolute;
    top: 20px;
    right: 20px;
    display: flex;
    gap: 8px;
  }

  .jersey-number {
    background: #009688;
    color: white;
    width: 48px;
    height: 32px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .ntuh-med-record {
    background: #e0f2f1;
    color: #00796b;
  }
`;

const IntroSection = styled.div`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  padding: 16px 20px;
  margin: 16px 20px 0 20px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  position: relative;

  &::before {
    content: '💫';
    position: absolute;
    top: 8px;
    left: 12px;
    font-size: 1.2rem;
    opacity: 0.8;
  }

  &::after {
    content: '🔥';
    position: absolute;
    top: 8px;
    right: 12px;
    font-size: 1.2rem;
    opacity: 0.8;
  }

  h3 {
    color: white;
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0 0 8px 0;
    text-align: center;
  }

  p {
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.9rem;
    line-height: 1.4;
    margin: 0 0 12px 0;
    text-align: center;
  }

  .source-links {
    display: flex;
    gap: 10px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .source-link {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    padding: 6px 12px;
    border-radius: 16px;
    text-decoration: none;
    font-weight: 500;
    font-size: 0.85rem;
    transition: background-color 0.2s ease;
    border: 1px solid rgba(255, 255, 255, 0.3);
    position: relative;

    &:hover {
      background: rgba(255, 255, 255, 0.3);
      text-decoration: none;
      color: white;
    }

    &:first-of-type::before {
      content: '📄';
      margin-right: 4px;
    }

`;

const ChatContainer = styled.div`
  flex: 1;
  padding: 16px 20px 20px 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(0, 150, 136, 0.1);
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 150, 136, 0.3);
    border-radius: 3px;
  }
`;

const MessageBubble = styled.div<{ isAI?: boolean }>`
  background: ${props => props.isAI 
    ? 'rgba(0, 150, 136, 0.9)'
    : 'rgba(255, 255, 255, 0.95)'
  };
  padding: 12px 16px;
  border-radius: 18px;
  max-width: 75%;
  align-self: ${props => props.isAI ? 'flex-end' : 'flex-start'};
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: 1px solid ${props => props.isAI 
    ? 'rgba(255, 255, 255, 0.2)' 
    : 'rgba(0, 150, 136, 0.2)'
  };
  position: relative;
`;

const MessageContent = styled.div<{ isAI?: boolean }>`
  color: ${props => props.isAI ? 'white' : '#333'};
  font-size: 0.95rem;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;

  a {
    color: ${props => props.isAI ? '#ffe082' : '#00796b'};
    text-decoration: underline;
    font-weight: 600;

    &:hover {
      color: ${props => props.isAI ? '#ffffff' : '#004d40'};
    }
  }

  h1, h2, h3, h4, h5, h6 {
    font-weight: 700;
    margin: 8px 0 4px 0;
    color: ${props => props.isAI ? '#ffffff' : '#004d40'};
  }

  h1 { font-size: 1.3rem; }
  h2 { font-size: 1.15rem; }
  h3 { font-size: 1.05rem; }

  strong, b {
    font-weight: 700;
    color: ${props => props.isAI ? '#fff8e1' : '#000000'};
  }

  /* Table Styles */
  .table-wrapper {
    overflow-x: auto;
    margin: 12px 0;
    border-radius: 8px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.88rem;
    text-align: left;
    background: ${props => props.isAI ? 'rgba(255, 255, 255, 0.15)' : '#ffffff'};
    color: ${props => props.isAI ? '#ffffff' : '#222222'};
    border: 1px solid ${props => props.isAI ? 'rgba(255, 255, 255, 0.3)' : '#d6d6d6'};
  }

  th, td {
    padding: 8px 12px;
    border: 1px solid ${props => props.isAI ? 'rgba(255, 255, 255, 0.25)' : '#d6d6d6'};
    vertical-align: top;
    white-space: normal;
  }

  th {
    background: ${props => props.isAI ? 'rgba(0, 77, 64, 0.7)' : '#e0f2f1'};
    color: ${props => props.isAI ? '#ffffff' : '#004d40'};
    font-weight: 700;
  }

  tr:nth-of-type(even) {
    background: ${props => props.isAI ? 'rgba(255, 255, 255, 0.08)' : '#f8f9fa'};
  }
`;

const LoadingMessage = styled(MessageBubble)`
  background: rgba(0, 150, 136, 0.9);
  align-self: flex-end;
  
  .loading-text {
    color: white;
    font-size: 0.95rem;
    
    &::after {
      content: '...';
      animation: dots 1.5s steps(4, end) infinite;
    }
  }

  @keyframes dots {
    0%, 20% { color: rgba(255, 255, 255, 0.4); }
    40% { color: white; }
    100% { color: rgba(255, 255, 255, 0.4); }
  }
`;

const InputContainer = styled.div`
  padding: 16px 20px;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  border-top: 1px solid rgba(0, 150, 136, 0.2);
  display: flex;
  gap: 10px;
  position: relative;
`;


const Input = styled.input`
  flex: 1;
  padding: 12px 16px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  outline: none;
  font-size: 16px;
  background: rgba(255, 255, 255, 0.9);
  color: #333;
  
  &:focus {
    border-color: rgba(255, 255, 255, 0.6);
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.2);
  }

  &::placeholder {
    color: rgba(0, 0, 0, 0.5);
  }
`;

const Button = styled.button<{ variant?: 'secondary' }>`
  padding: 12px 20px;
  background: ${props => props.variant === 'secondary' 
    ? 'rgba(0, 150, 136, 0.6)'
    : '#009688'
  };
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: opacity 0.2s ease;
  position: relative;
  
  &:hover:not(:disabled) {
    opacity: 0.9;
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const Footer = styled.footer`
  position: sticky;
  bottom: 0;
  text-align: center;
  padding: 12px 20px;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  color: #00796b;
  font-size: 13px;
  font-weight: 500;
  border-top: 1px solid rgba(0, 150, 136, 0.2);
  position: relative;

  .heart {
    color: #ff1493;
    margin: 0 2px;
  }

  .bridge {
    color: #ffd700;
    font-weight: 600;
  }
`;



function extractTextFromObjectOrJson(obj: any): string {
  if (!obj) return '';
  if (typeof obj === 'string') {
    const trimmed = obj.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        const extracted = extractTextFromObjectOrJson(parsed);
        if (extracted && extracted !== trimmed) return extracted;
      } catch {
        // Not JSON
      }
    }
    return obj;
  }
  if (obj.choices?.[0]?.message?.content) {
    const content = obj.choices[0].message.content;
    if (typeof content === 'string') return extractTextFromObjectOrJson(content);
    if (Array.isArray(content)) {
      return content.map((c: any) => (typeof c === 'string' ? c : c.text || '')).join('');
    }
  }
  if (typeof obj.response === 'string') return extractTextFromObjectOrJson(obj.response);
  if (typeof obj.text === 'string') return extractTextFromObjectOrJson(obj.text);
  if (typeof obj.message === 'string') return extractTextFromObjectOrJson(obj.message);
  if (obj.response) return extractTextFromObjectOrJson(obj.response);
  return JSON.stringify(obj);
}

function sanitizeResponseText(text: string): string {
  if (!text) return text;
  let cleaned = extractTextFromObjectOrJson(text);

  // 1. 徹底移除各種「根據...文件/檔案/資料/文章/內容/xray_application_info.md...」開頭與過渡贅句
  cleaned = cleaned.replace(/(?:根據|依據|基於|參考)\s*(?:提供|上述|相關|檢索|檢索到)?\s*的?\s*(?:[a-zA-Z0-9_\-\.]+\.(?:md|txt|html?)|[a-zA-Z0-9_\-\.]+\s*(?:文件|檔案|資料))?\s*(?:文件|資料|文章|資料庫|紀錄|檔案)?\s*(?:內容)?\s*(?:顯示|指出|提及|記載|說明|所述)?\s*[，：:\s]*/g, '');
  cleaned = cleaned.replace(/根據[a-zA-Z0-9_\-\.]+\s*(?:文件|檔案|資料)?[，：:\s]*/g, '');

  // 2. 去除用中括號包裹 URL 的格式，例如 [https://example.com] -> https://example.com
  cleaned = cleaned.replace(/\[(https?:\/\/[^\]]+)\]/g, '$1');

  cleaned = cleaned.trim();

  // 3. 移除重複行與重複段落
  const lines = cleaned.split('\n');
  const uniqueLines: string[] = [];
  let prevLine = '';
  for (const l of lines) {
    const trimmedLine = l.trim();
    if (trimmedLine !== '' && trimmedLine === prevLine) {
      continue;
    }
    uniqueLines.push(l);
    if (trimmedLine !== '') {
      prevLine = trimmedLine;
    }
  }
  cleaned = uniqueLines.join('\n');

  // 去除重複句/重複網址與尾部殘留贅字拼接
  const urlPattern = /https?:\/\/[^\s\n\r>"\)]+/g;
  const matches = Array.from(cleaned.matchAll(urlPattern));
  if (matches.length > 0) {
    const firstMatch = matches[0];
    const endOfFirstUrl = (firstMatch.index || 0) + firstMatch[0].length;
    let afterUrl = cleaned.substring(endOfFirstUrl).trim();
    if (/^[。，；：\s]*$/v.test(afterUrl) || afterUrl.includes('https://') || afterUrl.length < 15) {
      cleaned = cleaned.substring(0, endOfFirstUrl).trim();
    }
  }

  // 4. 若包含第一行的問題題目（以？或?結尾，或包含「請問」），去除第一行問題，僅保留第二行開始的答案內容
  const finalLines = cleaned.split('\n');
  if (finalLines.length > 1) {
    const firstLine = finalLines[0].trim();
    if (firstLine.endsWith('？') || firstLine.endsWith('?') || firstLine.startsWith('請問')) {
      finalLines.shift();
      while (finalLines.length > 0 && finalLines[0].trim() === '') {
        finalLines.shift();
      }
      cleaned = finalLines.join('\n');
    }
  }

  return cleaned.trim();
}

function cleanUrlAndTrailing(rawUrl: string): { url: string; trailing: string } {
  let url = rawUrl;
  let trailing = '';

  while (url.length > 0) {
    const lastChar = url.slice(-1);

    // 剝離尾部常見中文與英文標點符號
    if (/[。，、；：！？」』】〕｣,;:!?>\]"'\s]/.test(lastChar)) {
      trailing = lastChar + trailing;
      url = url.slice(0, -1);
      continue;
    }

    // 剝離尾部未配對的右括號 ')' 或 '）'
    if (lastChar === ')' || lastChar === '）') {
      const openChar = lastChar === ')' ? '(' : '（';
      const openCount = url.split(openChar).length - 1;
      const closeCount = url.split(lastChar).length - 1;
      if (closeCount > openCount) {
        trailing = lastChar + trailing;
        url = url.slice(0, -1);
        continue;
      }
    }

    break;
  }

  return { url, trailing };
}

function parseInline(rawText: string): React.ReactNode[] {
  if (!rawText) return [];
  // 1. First extract URLs and Markdown links
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>"'\n\r]+)|(www\.[^\s<>"'\n\r]+)/g;
  const chunks: { type: 'text' | 'link'; text?: string; href?: string; display?: string; trailing?: string }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(rawText)) !== null) {
    if (match.index > lastIndex) {
      chunks.push({ type: 'text', text: rawText.substring(lastIndex, match.index) });
    }

    if (match[1] && match[2]) {
      const { url: cleanLinkUrl, trailing } = cleanUrlAndTrailing(match[2]);
      chunks.push({ type: 'link', display: match[1], href: cleanLinkUrl, trailing });
    } else if (match[3] || match[4]) {
      const rawUrl = match[3] || match[4];
      const { url: cleanUrl, trailing } = cleanUrlAndTrailing(rawUrl);
      const href = cleanUrl.startsWith('www.') ? `https://${cleanUrl}` : cleanUrl;
      chunks.push({ type: 'link', display: cleanUrl, href, trailing });
    }
    lastIndex = linkPattern.lastIndex;
  }
  if (lastIndex < rawText.length) {
    chunks.push({ type: 'text', text: rawText.substring(lastIndex) });
  }

  // 2. Format bold (**text**) and italic (*text*) inside text chunks
  const inlineNodes: React.ReactNode[] = [];
  chunks.forEach((chunk, chunkIdx) => {
    if (chunk.type === 'link') {
      inlineNodes.push(
        <a key={`link-${chunkIdx}`} href={chunk.href} target="_blank" rel="noopener noreferrer">
          {chunk.display}
        </a>
      );
      if (chunk.trailing) {
        inlineNodes.push(chunk.trailing);
      }
    } else if (chunk.text) {
      // Parse **bold** and *italic*
      const formatPattern = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3/g;
      let textLastIdx = 0;
      let fmtMatch: RegExpExecArray | null;

      while ((fmtMatch = formatPattern.exec(chunk.text)) !== null) {
        if (fmtMatch.index > textLastIdx) {
          inlineNodes.push(chunk.text.substring(textLastIdx, fmtMatch.index));
        }

        if (fmtMatch[2] !== undefined) {
          // Bold **text**
          inlineNodes.push(<strong key={`b-${chunkIdx}-${fmtMatch.index}`}>{fmtMatch[2]}</strong>);
        } else if (fmtMatch[4] !== undefined) {
          // Italic *text*
          inlineNodes.push(<em key={`i-${chunkIdx}-${fmtMatch.index}`}>{fmtMatch[4]}</em>);
        }

        textLastIdx = formatPattern.lastIndex;
      }

      if (textLastIdx < chunk.text.length) {
        inlineNodes.push(chunk.text.substring(textLastIdx));
      }
    }
  });

  return inlineNodes;
}

function parseTableCell(cellText: string): React.ReactNode {
  const parts = cellText.split(/<br\s*\/?>/i);
  return parts.map((part, idx) => (
    <React.Fragment key={idx}>
      {idx > 0 && <br />}
      {parseInline(part)}
    </React.Fragment>
  ));
}

interface TableBlock {
  type: 'table';
  headers: string[];
  rows: string[][];
}

interface LinesBlock {
  type: 'lines';
  lines: string[];
}

type Block = TableBlock | LinesBlock;

function parseBlocks(text: string): Block[] {
  const lines = text.split('\n');
  const blocks: Block[] = [];

  let i = 0;
  let currentLines: string[] = [];

  const isTableLine = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  const isSeparatorLine = (l: string) => /^\s*\|(?:\s*:?-+:?\s*\|)+\s*$/.test(l);

  while (i < lines.length) {
    const line = lines[i];

    if (isTableLine(line) && i + 1 < lines.length && isSeparatorLine(lines[i + 1])) {
      if (currentLines.length > 0) {
        blocks.push({ type: 'lines', lines: currentLines });
        currentLines = [];
      }

      const headerLine = line;
      i += 2; // Skip header and separator

      const headers = headerLine
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map(s => s.trim());

      const rows: string[][] = [];

      while (i < lines.length && isTableLine(lines[i])) {
        const rowCells = lines[i]
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map(s => s.trim());

        // 補齊或截斷列數以符合 header 欄數
        while (rowCells.length < headers.length) {
          rowCells.push('');
        }
        rows.push(rowCells.slice(0, headers.length));
        i++;
      }

      blocks.push({ type: 'table', headers, rows });
    } else {
      currentLines.push(line);
      i++;
    }
  }

  if (currentLines.length > 0) {
    blocks.push({ type: 'lines', lines: currentLines });
  }

  return blocks;
}

function renderFormattedText(text: string) {
  if (!text) return null;

  const blocks = parseBlocks(text);

  return blocks.map((block, blockIdx) => {
    if (block.type === 'table') {
      return (
        <div key={`tbl-${blockIdx}`} className="table-wrapper">
          <table>
            <thead>
              <tr>
                {block.headers.map((h, hIdx) => (
                  <th key={hIdx}>{parseTableCell(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx}>{parseTableCell(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return block.lines.map((line, lineIdx) => {
      const headerMatch = /^\s*(#{1,6})\s+(.*)$/.exec(line);
      let HeaderTag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | null = null;
      let textToFormat = line;

      if (headerMatch) {
        const level = headerMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
        HeaderTag = `h${level}` as any;
        textToFormat = headerMatch[2];
      }

      const inlineContent = parseInline(textToFormat);

      return (
        <React.Fragment key={`l-${blockIdx}-${lineIdx}`}>
          {HeaderTag ? <HeaderTag>{inlineContent}</HeaderTag> : inlineContent}
          {(lineIdx < block.lines.length - 1 || blockIdx < blocks.length - 1) && '\n'}
        </React.Fragment>
      );
    });
  });
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatStateId, setChatStateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetch('/chat/init', { method: 'POST' })
      .then(res => res.json() as Promise<ChatInitResponse>)
      .then(data => {
        setChatStateId(data.id);
        return fetch(`/chat/${data.id}`);
      })
      .then(res => res.json() as Promise<ChatResponse>)
      .then(data => setMessages(data.messages))
      .catch(console.error);
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
        body: JSON.stringify({ text: newMessage }),
      });
      const data = await response.json() as { messages: Message[] };
      
      if (data.messages && Array.isArray(data.messages)) {
        const aiMessage = data.messages[1];
        if (aiMessage) {
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <AppContainer>
      <Header>
        <div className="jersey-numbers">
          <div className="jersey-number ntuh-med-record">NTUH</div>
          <div className="jersey-number" style={{ background: '#00796b', color: 'white' }}>RAG</div>
        </div>
        <h1>🏥 台大醫院病歷申請查詢 RAG 系統</h1>
        <div className="subtitle">快速查詢病歷申請相關規定、流程與常見問題</div>
      </Header>

      <ChatContainer>
        {messages.map(message => {
          let content = extractTextFromObjectOrJson(message.text);
          
          if (message.isAI) {
            content = sanitizeResponseText(content);
          }
          
          return (
            <MessageBubble key={message.id} isAI={message.isAI}>
              <MessageContent isAI={message.isAI}>
                {renderFormattedText(content)}
              </MessageContent>
            </MessageBubble>
          );
        })}
        {isLoading && (
          <LoadingMessage isAI>
            <div className="loading-text">Thinking</div>
          </LoadingMessage>
        )}
      </ChatContainer>
      
      <InputContainer>
        <Input
          value={newMessage}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="詢問有關台大醫院病歷申請的規定或常見問題..."
          disabled={isLoading}
        />
        <Button onClick={sendMessage} disabled={isLoading}>
          Send
        </Button>
        <Button variant="secondary" onClick={clearChat} disabled={isLoading}>
          Clear
        </Button>
      </InputContainer>
      
      <Footer>
      <strong>made with <span className="heart">❤️</span> in SF<span className="bridge">🌉</span> w/ <span className="cloudflare-ref">Cloudflare <a href="https://developers.cloudflare.com/autorag/">AutoRAG</a>, <a href="https://developers.cloudflare.com/durable-objects/get-started/">Durable Objects</a>, <a href="https://developers.cloudflare.com/workers-ai/models/gpt-oss-120b/">OpenAI gpt-oss-120b</a> on Workers AI, <a href="https://developers.cloudflare.com/workers/">Workers</a> and <a href="https://developers.cloudflare.com/r2/">R2</a></span>. Code on GitHub <a href="https://github.com/elizabethsiegle/chat-w-ntuh-med-record-rag.git">here</a></strong>
      </Footer>
    </AppContainer>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}