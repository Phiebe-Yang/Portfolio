import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import styled from '@emotion/styled';

interface Message {
  id: string;
  text: string | { response: string } | any;
  timestamp: number;
  isAI?: boolean;
  images?: string[];
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
  background: #f0f7f2;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  position: relative;
  color: #2e4d3a;
`;

const Header = styled.div`
  background: #ffffff;
  padding: 18px 20px;
  text-align: center;
  border-bottom: 1px solid #c8e6c9;
  box-shadow: 0 2px 10px rgba(46, 77, 58, 0.05);
  position: relative;
  
  h1 {
    color: #2e4d3a;
    font-size: 1.6rem;
    font-weight: 700;
    margin: 0 0 4px 0;
  }
  
  .subtitle {
    color: #558b2f;
    font-size: 0.9rem;
    font-weight: 500;
  }

  @media (max-width: 600px) {
    padding: 14px 12px;

    h1 {
      font-size: 1.3rem;
    }

    .subtitle {
      font-size: 0.8rem;
    }
  }
`;

const IntroSection = styled.div`
  background: #ffffff;
  padding: 14px 20px;
  margin: 14px 20px 0 20px;
  border-radius: 12px;
  border: 1px solid #c8e6c9;
  box-shadow: 0 2px 8px rgba(46, 77, 58, 0.04);

  h3 {
    color: #2e4d3a;
    font-size: 1.05rem;
    font-weight: 600;
    margin: 0 0 6px 0;
    text-align: center;
  }

  p {
    color: #4a7055;
    font-size: 0.88rem;
    line-height: 1.4;
    margin: 0;
    text-align: center;
  }

  @media (max-width: 600px) {
    margin: 10px 10px 0 10px;
    padding: 12px 14px;

    h3 {
      font-size: 0.98rem;
    }

    p {
      font-size: 0.82rem;
    }
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
    background: #e8f5e9;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb {
    background: #a5d6a7;
    border-radius: 3px;
  }

  @media (max-width: 600px) {
    padding: 12px 10px;
    gap: 10px;
  }
`;

const MessageBubble = styled.div<{ isAI?: boolean }>`
  background: ${props => props.isAI 
    ? '#ffffff'
    : '#a8e6cf'
  };
  color: #2e4d3a;
  padding: 12px 16px;
  border-radius: 16px;
  max-width: 75%;
  align-self: ${props => props.isAI ? 'flex-start' : 'flex-end'};
  box-shadow: 0 2px 8px rgba(46, 77, 58, 0.06);
  border: 1px solid ${props => props.isAI 
    ? '#c8e6c9' 
    : '#81c784'
  };
  position: relative;

  @media (max-width: 600px) {
    max-width: 90%;
    padding: 10px 12px;
    border-radius: 12px;
  }
`;

const MessageContent = styled.div<{ isAI?: boolean }>`
  color: #2e4d3a;
  font-size: 0.95rem;
  line-height: 1.6;
  word-break: break-word;

  h1, h2, h3, h4, h5, h6 {
    color: #1b3e2b;
    margin: 12px 0 6px 0;
    font-weight: 700;
  }

  h1 { font-size: 1.3rem; border-bottom: 1px solid #c8e6c9; padding-bottom: 4px; }
  h2 { font-size: 1.15rem; }
  h3 { font-size: 1.05rem; }
  h4 { font-size: 0.98rem; }

  p {
    margin-bottom: 8px;
  }

  strong {
    font-weight: 700;
    color: #1b3e2b;
  }

  em {
    font-style: italic;
  }

  ul, ol {
    margin: 6px 0 10px 20px;
    padding: 0;
  }

  li {
    margin-bottom: 4px;
  }

  hr {
    border: none;
    border-top: 1px solid #c8e6c9;
    margin: 12px 0;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0;
    font-size: 0.88rem;
  }

  th, td {
    border: 1px solid #a5d6a7;
    padding: 6px 10px;
    text-align: left;
  }

  th {
    background: #e8f5e9;
    font-weight: 600;
  }

  code {
    background: #e8f5e9;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.9em;
  }

  blockquote {
    border-left: 3px solid #81c784;
    margin: 8px 0;
    padding-left: 10px;
    color: #4a7055;
  }

  @media (max-width: 600px) {
    font-size: 0.88rem;

    h1 { font-size: 1.15rem; }
    h2 { font-size: 1.05rem; }
    h3 { font-size: 0.98rem; }
  }
`;

/* 強力 Markdown 渲染解析器 */
const renderFormattedMarkdown = (text: string) => {
  if (!text) return null;

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inList: { type: 'ul' | 'ol'; items: React.ReactNode[] } | null = null;
  let inTable: { headers: string[]; rows: string[][] } | null = null;

  const parseInline = (inlineText: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = inlineText;
    let keyIdx = 0;

    while (remaining.length > 0) {
      // 全域正規表達式匹配標籤
      const boldMatch = remaining.match(/(\*\*|__)(.*?)\1/);
      const italicMatch = remaining.match(/(\*|_)(.*?)\1/);
      const codeMatch = remaining.match(/`(.*?)`/);

      const matches = [
        boldMatch ? { type: 'bold', index: boldMatch.index!, match: boldMatch } : null,
        italicMatch ? { type: 'italic', index: italicMatch.index!, match: italicMatch } : null,
        codeMatch ? { type: 'code', index: codeMatch.index!, match: codeMatch } : null,
      ].filter(Boolean).sort((a, b) => a!.index - b!.index);

      if (matches.length === 0) {
        parts.push(remaining);
        break;
      }

      const first = matches[0]!;
      if (first.index > 0) {
        parts.push(remaining.substring(0, first.index));
      }

      const matchedText = first.match[2];
      if (first.type === 'bold') {
        parts.push(<strong key={keyIdx++}>{parseInline(matchedText)}</strong>);
      } else if (first.type === 'italic') {
        parts.push(<em key={keyIdx++}>{parseInline(matchedText)}</em>);
      } else if (first.type === 'code') {
        parts.push(<code key={keyIdx++}>{matchedText}</code>);
      }

      remaining = remaining.substring(first.index + first.match[0].length);
    }

    return parts;
  };

  const flushList = () => {
    if (inList) {
      const ListTag = inList.type;
      elements.push(
        <ListTag key={`list-${elements.length}`}>
          {inList.items.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ListTag>
      );
      inList = null;
    }
  };

  const flushTable = () => {
    if (inTable) {
      elements.push(
        <table key={`table-${elements.length}`}>
          <thead>
            <tr>
              {inTable.headers.map((h, i) => (
                <th key={i}>{parseInline(h.trim())}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {inTable.rows.map((row, rIdx) => (
              <tr key={rIdx}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx}>{parseInline(cell.trim())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
      inTable = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. 處理表格 |
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      const cells = trimmed.slice(1, -1).split('|');
      if (cells.every(c => /^[\s:-]+$/.test(c))) {
        continue;
      }
      if (!inTable) {
        inTable = { headers: cells, rows: [] };
      } else {
        inTable.rows.push(cells);
      }
      continue;
    } else {
      flushTable();
    }

    // 2. 處理標題 (相容全形與半形 #，例如 ### 標題 或 ＃＃＃ 標題)
    const headingMatch = trimmed.match(/^(#{1,6}|＃{1,6})\s*(.*)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const titleText = headingMatch[2].replace(/^[\s:]+/, ''); // 清理標題前多餘冒號或空白
      const titleContent = parseInline(titleText);
      const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
      elements.push(<HeadingTag key={`h-${i}`}>{titleContent}</HeadingTag>);
      continue;
    }

    // 3. 處理水平線 --- 或 ***
    if (/^(---|[*]{3,}|_{3,})$/.test(trimmed)) {
      flushList();
      elements.push(<hr key={`hr-${i}`} />);
      continue;
    }

    // 4. 處理無序列表 (- 或 * 或 +)
    const ulMatch = trimmed.match(/^([-*+])\s+(.*)$/);
    if (ulMatch) {
      const itemContent = parseInline(ulMatch[2]);
      if (!inList || inList.type !== 'ul') {
        flushList();
        inList = { type: 'ul', items: [itemContent] };
      } else {
        inList.items.push(itemContent);
      }
      continue;
    }

    // 5. 處理有序列表 (1. 2. 3.)
    const olMatch = trimmed.match(/^(\d+)[.、]\s*(.*)$/);
    if (olMatch) {
      const itemContent = parseInline(olMatch[2]);
      if (!inList || inList.type !== 'ol') {
        flushList();
        inList = { type: 'ol', items: [itemContent] };
      } else {
        inList.items.push(itemContent);
      }
      continue;
    }

    // 6. 處理引用區塊 >
    if (trimmed.startsWith('>')) {
      flushList();
      const quoteContent = parseInline(trimmed.replace(/^>\s*/, ''));
      elements.push(<blockquote key={`quote-${i}`}>{quoteContent}</blockquote>);
      continue;
    }

    // 一般文字段落
    flushList();
    if (trimmed.length > 0) {
      elements.push(<p key={`p-${i}`}>{parseInline(line)}</p>);
    }
  }

  flushList();
  flushTable();

  return elements;
};

/* 圖片輪播切換元件 */
const CarouselContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 12px;
  background: #f4fbf6;
  border: 1px solid #c8e6c9;
  border-radius: 12px;
  padding: 10px;
  width: 100%;
`;

const CarouselHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-bottom: 8px;
`;

const CarouselTitle = styled.div`
  font-size: 0.82rem;
  font-weight: 600;
  color: #388e3c;
`;

const CarouselCounter = styled.div`
  font-size: 0.8rem;
  font-weight: 500;
  color: #558b2f;
`;

const CarouselBody = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 180px;
`;

const NavButton = styled.button<{ position: 'left' | 'right' }>`
  position: absolute;
  ${props => props.position === 'left' ? 'left: 6px;' : 'right: 6px;'}
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.9);
  color: #2e4d3a;
  border: 1px solid #a5d6a7;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-weight: bold;
  font-size: 14px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  z-index: 2;
  transition: all 0.2s ease;

  &:hover {
    background: #a8e6cf;
    color: #1b3e2b;
  }
`;

const CarouselImage = styled.img`
  max-width: 100%;
  max-height: 480px;
  border-radius: 8px;
  object-fit: contain;
  cursor: zoom-in;
  transition: transform 0.2s ease, opacity 0.2s ease;

  &:hover {
    opacity: 0.92;
  }

  @media (max-width: 600px) {
    max-height: 280px;
  }
`;

/* 點擊大圖全螢幕燈箱 (Modal) */
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  cursor: zoom-out;
  backdrop-filter: blur(4px);
`;

const ModalImage = styled.img`
  max-width: 92vw;
  max-height: 92vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
`;

const CloseHint = styled.div`
  position: absolute;
  top: 20px;
  right: 20px;
  color: #ffffff;
  font-size: 14px;
  background: rgba(0, 0, 0, 0.5);
  padding: 6px 14px;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  pointer-events: none;
`;

const ImageCarousel: React.FC<{ images: string[] }> = ({ images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!images || images.length === 0) return null;

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(prev => (prev === images.length - 1 ? 0 : prev + 1));
  };

  return (
    <>
      <CarouselContainer>
        <CarouselHeader>
          <CarouselTitle>檢索參考圖片 (點擊放大)</CarouselTitle>
          {images.length > 1 && (
            <CarouselCounter>{currentIndex + 1} / {images.length}</CarouselCounter>
          )}
        </CarouselHeader>
        <CarouselBody>
          {images.length > 1 && (
            <NavButton position="left" onClick={handlePrev} aria-label="上一張">
              &lt;
            </NavButton>
          )}
          <CarouselImage 
            src={images[currentIndex]} 
            alt={`參考圖片 ${currentIndex + 1}`} 
            onClick={() => setIsModalOpen(true)}
            title="點擊放大圖片"
          />
          {images.length > 1 && (
            <NavButton position="right" onClick={handleNext} aria-label="下一張">
              &gt;
            </NavButton>
          )}
        </CarouselBody>
      </CarouselContainer>

      {isModalOpen && (
        <ModalOverlay onClick={() => setIsModalOpen(false)}>
          <CloseHint>點擊任意處關閉</CloseHint>
          <ModalImage 
            src={images[currentIndex]} 
            alt={`放大檢視圖片 ${currentIndex + 1}`} 
          />
        </ModalOverlay>
      )}
    </>
  );
};

const LoadingMessage = styled(MessageBubble)`
  background: #ffffff;
  align-self: flex-start;
  border: 1px solid #c8e6c9;
  
  .loading-text {
    color: #558b2f;
    font-size: 0.95rem;
    
    &::after {
      content: '...';
      animation: dots 1.5s steps(4, end) infinite;
    }
  }

  @keyframes dots {
    0%, 20% { color: #a5d6a7; }
    40% { color: #2e4d3a; }
    100% { color: #a5d6a7; }
  }
`;

const InputContainer = styled.div`
  padding: 16px 20px;
  background: #ffffff;
  border-top: 1px solid #c8e6c9;
  display: flex;
  gap: 10px;

  @media (max-width: 600px) {
    padding: 10px 12px;
    gap: 6px;
  }
`;

const Input = styled.input`
  flex: 1;
  padding: 12px 16px;
  border: 1px solid #a5d6a7;
  border-radius: 20px;
  outline: none;
  font-size: 15px;
  background: #f4fbf6;
  color: #2e4d3a;
  
  &:focus {
    border-color: #66bb6a;
    background: #ffffff;
    box-shadow: 0 0 0 2px rgba(129, 199, 132, 0.2);
  }

  &::placeholder {
    color: #81c784;
  }

  @media (max-width: 600px) {
    padding: 10px 12px;
    font-size: 14px;
    border-radius: 16px;
  }
`;

const Button = styled.button<{ variant?: 'secondary' }>`
  padding: 12px 20px;
  background: ${props => props.variant === 'secondary' 
    ? '#e8f5e9'
    : '#81c784'
  };
  color: ${props => props.variant === 'secondary' ? '#2e4d3a' : '#ffffff'};
  border: 1px solid ${props => props.variant === 'secondary' ? '#a5d6a7' : '#66bb6a'};
  border-radius: 20px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 600;
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    background: ${props => props.variant === 'secondary' ? '#c8e6c9' : '#66bb6a'};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 600px) {
    padding: 10px 12px;
    font-size: 13px;
    border-radius: 16px;
  }
`;

const Footer = styled.footer`
  position: sticky;
  bottom: 0;
  text-align: center;
  padding: 10px 20px;
  background: #ffffff;
  color: #558b2f;
  font-size: 12px;
  font-weight: 500;
  border-top: 1px solid #e8f5e9;
`;



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
        const aiMessage = data.messages.find(m => m.isAI) || data.messages[1] || data.messages[data.messages.length - 1];
        if (aiMessage && aiMessage.id !== userMessage.id) {
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
        <h1>圖片問答系統</h1>
        <div className="subtitle">智能圖片內容分析與 AI 問答平台</div>
      </Header>

      <ChatContainer>
        {messages.map(message => {
          let content: string;
          if (typeof message.text === 'string') {
            content = message.text;
          } else if (message.text && typeof message.text === 'object') {
            const obj = message.text as any;
            if (obj.response) {
              content = obj.response;
            } else if (obj.text) {
              content = obj.text;
            } else if (obj.message) {
              content = obj.message;
            } else {
              content = JSON.stringify(obj);
            }
          } else {
            content = String(message.text);
          }
          
          return (
            <MessageBubble key={message.id} isAI={message.isAI}>
              {message.images && message.images.length > 0 && (
                <ImageCarousel images={message.images} />
              )}
              <MessageContent isAI={message.isAI}>
                {renderFormattedMarkdown(content)}
              </MessageContent>
            </MessageBubble>
          );
        })}
        {isLoading && (
          <LoadingMessage isAI>
            <div className="loading-text">分析與處理中</div>
          </LoadingMessage>
        )}
      </ChatContainer>
      
      <InputContainer>
        <Input
          value={newMessage}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder="請輸入關於圖片或圖像內容的問題..."
          disabled={isLoading}
        />
        <Button onClick={sendMessage} disabled={isLoading}>
          傳送
        </Button>
        <Button variant="secondary" onClick={clearChat} disabled={isLoading}>
          清除
        </Button>
      </InputContainer>
      
      <Footer>
        圖片問答系統 - Cloudflare Workers & AI 驅動
      </Footer>
    </AppContainer>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}