import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import styled from '@emotion/styled';

interface Segment {
	id: string;
	title: string;
	startTime: number;
	endTime: number;
	formattedStart: string;
	formattedEnd: string;
	summary: string;
	text?: string;
}

interface Message {
	id: string;
	text: string;
	timestamp: number;
	isAI?: boolean;
	primaryTime?: number;
	formattedPrimaryTime?: string;
	segments?: Segment[];
}

import { TRANSCRIPT_SEGMENTS } from './transcriptData';

const TRANSCRIPT_PRESETS = TRANSCRIPT_SEGMENTS;

const SUGGESTED_QUESTIONS = [
	"標靶治療常見的副作用有哪些？",
	"什麼是EGFR抑制劑與VEGF抑制劑？",
	"爾必得舒跟癌思停有什麼差別？",
	"頭頸癌在什麼階段適合進行標靶治療？",
	"標靶治療與傳統化學治療有什麼不同？",
	"標靶治療會影響哪些身體器官或功能？"
];

// Styled Components
const PageContainer = styled.div`
  max-width: 820px;
  margin: 0 auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;

  @media (max-width: 768px) {
    padding: 10px;
    gap: 14px;
    width: 100%;
  }
`;

const Header = styled.header`
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border: 1px solid #334155;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  gap: 10px;

  @media (max-width: 768px) {
    padding: 16px;
    border-radius: 12px;
  }

  h1 {
    font-size: 1.75rem;
    font-weight: 800;
    color: #38bdf8;
    margin: 0;

    @media (max-width: 768px) {
      font-size: 1.35rem;
    }
  }

  p {
    color: #94a3b8;
    font-size: 0.95rem;
    line-height: 1.5;
    margin: 0;

    @media (max-width: 768px) {
      font-size: 0.85rem;
    }
  }
`;

const VideoCard = styled.div<{ isHighlighted?: boolean }>`
  background: #1e293b;
  border: 2px solid ${props => props.isHighlighted ? '#38bdf8' : '#334155'};
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
  transition: all 0.3s ease;
  ${props => props.isHighlighted && `
    box-shadow: 0 0 25px rgba(56, 189, 248, 0.4);
  `}

  @media (max-width: 768px) {
    border-radius: 12px;
  }

  .video-header {
    background: #0f172a;
    padding: 12px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #334155;

    @media (max-width: 768px) {
      padding: 10px 12px;
    }

    .header-left {
      font-weight: 700;
      color: #f8fafc;

      @media (max-width: 768px) {
        font-size: 0.85rem;
      }
    }

    .time-badge {
      background: #0284c7;
      color: #ffffff;
      padding: 4px 12px;
      border-radius: 12px;
      font-family: monospace;
      font-weight: 700;
      font-size: 0.9rem;

      @media (max-width: 768px) {
        padding: 3px 8px;
        font-size: 0.8rem;
      }
    }
  }

  .video-wrapper {
    position: relative;
    width: 100%;
    background: #000;
    display: flex;
    justify-content: center;
    align-items: center;

    video {
      width: 100%;
      max-height: 480px;
      outline: none;
      border: none;

      @media (max-width: 768px) {
        width: 100%;
        height: auto;
        aspect-ratio: 16 / 9;
        max-height: 220px;
        object-fit: contain;
      }
    }
  }

  .navigation-bar {
    padding: 16px;
    background: #0f172a;
    border-top: 1px solid #334155;

    @media (max-width: 768px) {
      padding: 12px;
    }

    .nav-title {
      font-size: 0.9rem;
      font-weight: 700;
      color: #94a3b8;
      display: flex;
      align-items: center;
      justify-content: space-between;

      @media (max-width: 768px) {
        font-size: 0.8rem;
      }
    }

    .segment-buttons {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-top: 12px;
      padding-bottom: 6px;
      -webkit-overflow-scrolling: touch;

      &::-webkit-scrollbar {
        height: 4px;
      }
    }
  }
`;

const SegNavButton = styled.button<{ isActive?: boolean }>`
  background: ${props => props.isActive ? '#0284c7' : '#334155'};
  color: ${props => props.isActive ? '#ffffff' : '#cbd5e1'};
  border: 1px solid ${props => props.isActive ? '#38bdf8' : '#475569'};
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;

  &:hover {
    background: ${props => props.isActive ? '#0369a1' : '#475569'};
    color: #ffffff;
    border-color: #38bdf8;
  }

  .time {
    font-family: monospace;
    font-size: 0.8rem;
    background: rgba(0, 0, 0, 0.25);
    padding: 2px 6px;
    border-radius: 4px;
  }
`;

const TranscriptDrawer = styled.div<{ isOpen: boolean }>`
  background: #0f172a;
  border-top: 1px solid #334155;
  max-height: ${props => props.isOpen ? '300px' : '0'};
  overflow-y: auto;
  transition: max-height 0.3s ease-in-out;

  .transcript-content {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .transcript-line {
    display: flex;
    gap: 12px;
    padding: 8px 12px;
    border-radius: 8px;
    background: #1e293b;
    border: 1px solid #334155;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: #334155;
      border-color: #38bdf8;
    }

    &.active {
      background: rgba(2, 132, 199, 0.25);
      border-color: #38bdf8;
    }

    .line-time {
      color: #38bdf8;
      font-family: monospace;
      font-weight: 700;
      font-size: 0.85rem;
      white-space: nowrap;
    }

    .line-text {
      color: #e2e8f0;
      font-size: 0.9rem;
      line-height: 1.4;
    }
  }
`;

const ChatSection = styled.div`
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 16px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ChatHeader = styled.div`
  background: #0f172a;
  padding: 16px 20px;
  border-bottom: 1px solid #334155;
  display: flex;
  align-items: center;
  justify-content: space-between;

  h2 {
    font-size: 1.2rem;
    font-weight: 700;
    color: #f8fafc;
    margin: 0;
  }

  .clear-btn {
    background: transparent;
    color: #94a3b8;
    border: 1px solid #334155;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: #334155;
      color: #f8fafc;
    }
  }
`;

const QuickQuestions = styled.div`
  padding: 16px 20px;
  background: rgba(15, 23, 42, 0.5);
  border-bottom: 1px solid #334155;

  @media (max-width: 768px) {
    padding: 12px;
  }

  .qq-title {
    font-size: 0.85rem;
    font-weight: 700;
    color: #94a3b8;
    margin-bottom: 10px;

    @media (max-width: 768px) {
      font-size: 0.8rem;
    }
  }

  .qq-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    @media (max-width: 768px) {
      overflow-x: auto;
      flex-wrap: nowrap;
      padding-bottom: 6px;
      -webkit-overflow-scrolling: touch;

      &::-webkit-scrollbar {
        height: 3px;
      }
    }
  }

  .qq-chip {
    background: #334155;
    color: #e2e8f0;
    border: 1px solid #475569;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;

    @media (max-width: 768px) {
      font-size: 0.8rem;
      padding: 6px 10px;
      touch-action: manipulation;
    }

    &:hover {
      background: #0284c7;
      color: #ffffff;
      border-color: #38bdf8;
      transform: translateY(-1px);
    }
  }
`;

const MessagesContainer = styled.div`
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 250px;
  max-height: 600px;
  overflow-y: auto;
  background: #475569;
  border-top: 2px solid #0284c7;
  border-bottom: 2px solid #0284c7;
  box-shadow: inset 0 4px 12px rgba(0, 0, 0, 0.4), inset 0 -4px 12px rgba(0, 0, 0, 0.4);
  position: relative;

  /* Custom scrollbar styling to make scrollable area immediately obvious */
  &::-webkit-scrollbar {
    width: 10px;
  }
  &::-webkit-scrollbar-track {
    background: #1e293b;
    border-radius: 5px;
  }
  &::-webkit-scrollbar-thumb {
    background: #0284c7;
    border-radius: 5px;
    border: 2px solid #1e293b;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: #38bdf8;
  }

  @media (max-width: 768px) {
    padding: 12px;
    gap: 14px;
    max-height: 450px;

    &::-webkit-scrollbar {
      width: 6px;
    }
  }
`;

const QuestionBoxCard = styled.div<{ isAI?: boolean }>`
  display: flex;
  flex-direction: column;
  width: 100%;
  flex-shrink: 0;
  background: ${props => props.isAI ? '#1e293b' : '#0369a1'};
  border: 1px solid ${props => props.isAI ? '#475569' : '#38bdf8'};
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);

  @media (max-width: 768px) {
    border-radius: 10px;
  }

  .card-header {
    background: ${props => props.isAI ? '#0f172a' : '#0284c7'};
    padding: 10px 16px;
    border-bottom: 1px solid ${props => props.isAI ? '#334155' : '#38bdf8'};
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;

    @media (max-width: 768px) {
      padding: 8px 12px;
    }

    .tag-badge {
      background: ${props => props.isAI ? 'rgba(56, 189, 248, 0.25)' : 'rgba(255, 255, 255, 0.25)'};
      color: ${props => props.isAI ? '#38bdf8' : '#ffffff'};
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 700;

      @media (max-width: 768px) {
        font-size: 0.8rem;
        padding: 3px 8px;
      }
    }

    .time-stamp {
      font-size: 0.75rem;
      color: #94a3b8;
    }
  }

  .card-body {
    padding: 18px 20px;
    color: #f8fafc;
    font-size: 0.95rem;
    line-height: 1.7;
    white-space: pre-wrap;
    overflow-wrap: break-word;

    @media (max-width: 768px) {
      padding: 12px 14px;
      font-size: 0.88rem;
      line-height: 1.6;
    }
  }

  .segments-box {
    margin: 0 16px 16px 16px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 10px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;

    @media (max-width: 768px) {
      margin: 0 10px 12px 10px;
      padding: 10px;
    }

    .seg-box-header {
      font-size: 0.85rem;
      font-weight: 700;
      color: #38bdf8;

      @media (max-width: 768px) {
        font-size: 0.8rem;
      }
    }

    .seg-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
  }
`;

const SegmentJumpBadge = styled.button`
  background: #0f172a;
  color: #f8fafc;
  border: 1px solid #0284c7;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-align: left;
  transition: all 0.2s ease;
  width: 100%;

  @media (max-width: 768px) {
    padding: 10px 12px;
    font-size: 0.82rem;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    touch-action: manipulation;
  }

  &:hover {
    background: #0284c7;
    color: #ffffff;
    border-color: #38bdf8;
  }

  .seg-badge-title {
    display: flex;
    align-items: center;
  }

  .play-tag {
    color: #38bdf8;
    font-weight: 700;
    margin-right: 8px;
  }

  &:hover .play-tag {
    color: #ffffff;
  }

  .seg-badge-time {
    background: rgba(56, 189, 248, 0.2);
    color: #38bdf8;
    padding: 3px 10px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.85rem;
    font-weight: 700;
    white-space: nowrap;

    @media (max-width: 768px) {
      font-size: 0.78rem;
      padding: 2px 6px;
      align-self: flex-end;
    }
  }

  &:hover .seg-badge-time {
    background: rgba(255, 255, 255, 0.25);
    color: #ffffff;
  }
`;

const InputContainer = styled.form`
  padding: 16px 20px;
  background: #0f172a;
  border-top: 1px solid #334155;
  display: flex;
  gap: 12px;

  @media (max-width: 768px) {
    padding: 10px 12px;
    gap: 8px;
  }

  input {
    flex: 1;
    background: #1e293b;
    border: 1px solid #334155;
    color: #f8fafc;
    padding: 12px 16px;
    border-radius: 10px;
    font-size: 0.95rem;
    outline: none;
    transition: border-color 0.2s;

    @media (max-width: 768px) {
      padding: 10px 12px;
      font-size: 0.88rem;
    }

    &:focus {
      border-color: #0284c7;
    }

    &::placeholder {
      color: #64748b;
    }
  }

  button {
    background: #0284c7;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 10px;
    font-weight: 700;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;

    @media (max-width: 768px) {
      padding: 10px 16px;
      font-size: 0.88rem;
      touch-action: manipulation;
    }

    &:hover:not(:disabled) {
      background: #0369a1;
    }

    &:disabled {
      background: #334155;
      color: #64748b;
      cursor: not-allowed;
    }
  }
`;

const Toast = styled.div<{ show: boolean }>`
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: #0284c7;
  color: white;
  padding: 12px 20px;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
  font-weight: 600;
  z-index: 1000;
  transform: translateY(${props => props.show ? '0' : '100px'});
  opacity: ${props => props.show ? '1' : '0'};
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);

  @media (max-width: 768px) {
    bottom: 16px;
    right: 16px;
    left: 16px;
    text-align: center;
    padding: 10px 16px;
    font-size: 0.85rem;
  }
`;

const App: React.FC = () => {
	const [messages, setMessages] = useState<Message[]>([
		{
			id: 'welcome-1',
			text: '您好！我是《頭頸癌標靶藥物治療》AI 衛教助理。\n您可以詢問標靶治療的相關問題（如副作用、藥物種類、作用機制等）。系統解答後，上方影片將會自動跳轉至最相關的字幕時間點。',
			timestamp: Date.now(),
			isAI: true,
			primaryTime: 14,
			formattedPrimaryTime: '00:14',
			segments: [TRANSCRIPT_PRESETS[0]]
		}
	]);
	const [input, setInput] = useState('');
	const [loading, setLoading] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [activeSegmentId, setActiveSegmentId] = useState<string>('seg-1');
	const [showChapters, setShowChapters] = useState(false);
	const [showDrawer, setShowDrawer] = useState(false);
	const [highlightVideo, setHighlightVideo] = useState(false);
	const [toastMsg, setToastMsg] = useState('');
	const [showToast, setShowToast] = useState(false);

	const videoRef = useRef<HTMLVideoElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const triggerToast = (msg: string) => {
		setToastMsg(msg);
		setShowToast(true);
		setTimeout(() => setShowToast(false), 3000);
	};

	const jumpToTime = (seconds: number, title?: string) => {
		if (videoRef.current) {
			const video = videoRef.current;
			const targetSec = Math.max(0, seconds);

			try {
				video.currentTime = targetSec;
				video.play().catch(e => console.log('Autoplay prevented:', e));
			} catch (err) {
				console.error('Seek error:', err);
			}

			setHighlightVideo(true);
			setTimeout(() => setHighlightVideo(false), 2000);

			video.scrollIntoView({ behavior: 'smooth', block: 'center' });

			const mins = Math.floor(targetSec / 60);
			const secs = Math.floor(targetSec % 60);
			const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
			triggerToast(`已跳轉影片至 [${formatted}] ${title || ''}`);
		}
	};

	const handleTimeUpdate = () => {
		if (!videoRef.current) return;
		const cur = videoRef.current.currentTime;
		setCurrentTime(cur);

		const matched = TRANSCRIPT_PRESETS.find(s => cur >= s.startTime && cur <= s.endTime);
		if (matched && matched.id !== activeSegmentId) {
			setActiveSegmentId(matched.id);
		}
	};

	const handleSendMessage = async (queryText?: string) => {
		const text = queryText || input.trim();
		if (!text || loading) return;

		const userMsg: Message = {
			id: crypto.randomUUID(),
			text: text,
			timestamp: Date.now(),
			isAI: false
		};

		setMessages(prev => [...prev, userMsg]);
		if (!queryText) setInput('');
		setLoading(true);

		try {
			const res = await fetch('/chat/query', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text })
			});

			const data = await res.json() as { messages: Message[] };
			if (data && data.messages) {
				setMessages(prev => {
					const filtered = prev.filter(m => m.id !== userMsg.id);
					return [...filtered, ...data.messages];
				});

				const aiMsg = data.messages.find(m => m.isAI);
				if (aiMsg && typeof aiMsg.primaryTime === 'number') {
					jumpToTime(aiMsg.primaryTime, `(${aiMsg.formattedPrimaryTime})`);
				}
			}
		} catch (err) {
			console.error('Failed to query RAG assistant:', err);
			triggerToast('傳送失敗，請稍後再試');
		} finally {
			setLoading(false);
		}
	};

	const clearChatHistory = async () => {
		try {
			await fetch('/chat/clear', { method: 'DELETE' });
		} catch (e) {
			console.log('Error clearing history:', e);
		}
		setMessages([messages[0]]);
	};

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages, loading]);

	const formatSeconds = (sec: number) => {
		const m = Math.floor(sec / 60);
		const s = Math.floor(sec % 60);
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	};

	return (
		<PageContainer>
			<Header>
				<h1>頭頸癌標靶藥物治療 - 影音 RAG 檢索系統</h1>
				<p>
					上方為《標靶藥物治療》MP4 影音播放區，下方為智慧問答區。向 AI 提問後，系統會結合字幕檔案準確回答，並自動跳轉播放對應時間點。
				</p>
			</Header>

			{/* Video Section */}
			<VideoCard isHighlighted={highlightVideo}>
				<div className="video-header">
					<div className="header-left">
						標靶藥物治療.mp4
					</div>
					<div className="time-badge">
						{formatSeconds(currentTime)} / 02:20
					</div>
				</div>

				<div className="video-wrapper">
					<video
						ref={videoRef}
						src="/video.mp4"
						controls
						playsInline
						webkit-playsinline="true"
						x5-playsinline="true"
						x5-video-player-type="h5-page"
						onTimeUpdate={handleTimeUpdate}
					/>
				</div>

				<div className="navigation-bar">
					<div className="nav-title">
						<span>影片重點章節列表 (點擊快速跳轉)</span>
						<div>
							<button 
								type="button"
								onClick={() => setShowChapters(!showChapters)}
								style={{ background: 'transparent', color: '#38bdf8', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, marginRight: '16px' }}
							>
								{showChapters ? '[收起章節列表]' : '[展開章節列表]'}
							</button>

							<button 
								type="button"
								onClick={() => setShowDrawer(!showDrawer)}
								style={{ background: 'transparent', color: '#38bdf8', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
							>
								{showDrawer ? '[收起完整字幕]' : '[展開完整逐字稿]'}
							</button>
						</div>
					</div>

					{showChapters && (
						<div className="segment-buttons">
							{TRANSCRIPT_PRESETS.map((seg) => (
								<SegNavButton
									key={seg.id}
									isActive={activeSegmentId === seg.id}
									onClick={() => jumpToTime(seg.startTime, seg.title)}
								>
									<span className="time">{seg.formattedStart}</span>
									<span>{seg.title.split('：')[1] || seg.title}</span>
								</SegNavButton>
							))}
						</div>
					)}
				</div>

				{/* Full Transcript Drawer */}
				<TranscriptDrawer isOpen={showDrawer}>
					<div className="transcript-content">
						{TRANSCRIPT_PRESETS.map((seg) => (
							<div
								key={seg.id}
								className={`transcript-line ${activeSegmentId === seg.id ? 'active' : ''}`}
								onClick={() => jumpToTime(seg.startTime, seg.title)}
							>
								<span className="line-time">[{seg.formattedStart} - {seg.formattedEnd}]</span>
								<span className="line-text">{seg.text}</span>
							</div>
						))}
					</div>
				</TranscriptDrawer>
			</VideoCard>

			{/* Chat Section */}
			<ChatSection>
				<ChatHeader>
					<h2>智慧影音問答區 (RAG Chat)</h2>
					<button className="clear-btn" onClick={clearChatHistory}>
						清空對話紀錄
					</button>
				</ChatHeader>

				<QuickQuestions>
					<div className="qq-title">常見快捷問題（點擊快速提問）：</div>
					<div className="qq-grid">
						{SUGGESTED_QUESTIONS.map((q, idx) => (
							<button 
								key={idx} 
								className="qq-chip"
								onClick={() => handleSendMessage(q)}
							>
								{q}
							</button>
						))}
					</div>
				</QuickQuestions>

				<MessagesContainer>
					{messages.map((msg) => (
						<QuestionBoxCard key={msg.id} isAI={msg.isAI}>
							<div className="card-header">
								<span className="tag-badge">
									{msg.isAI ? 'AI 衛教助理' : '使用者提問'}
								</span>
								<span className="time-stamp">
									{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
								</span>
							</div>

							<div className="card-body">
								{msg.text}
							</div>

							{/* Multiple Segments Jump Section */}
							{msg.isAI && msg.segments && msg.segments.length > 0 && (
								<div className="segments-box">
									<div className="seg-box-header">
										點擊以下片段按鈕，跳轉播放影片對應位置：
									</div>
									<div className="seg-list">
										{msg.segments.map((seg, idx) => (
											<SegmentJumpBadge
												key={seg.id || idx}
												onClick={() => jumpToTime(seg.startTime, seg.title)}
											>
												<div className="seg-badge-title">
													<span className="play-tag">[播放]</span>
													<span>片段 {idx + 1}：{seg.title}</span>
												</div>
												<div className="seg-badge-time">
													{seg.formattedStart} - {seg.formattedEnd}
												</div>
											</SegmentJumpBadge>
										))}
									</div>
								</div>
							)}
						</QuestionBoxCard>
					))}

					{loading && (
						<QuestionBoxCard isAI={true}>
							<div className="card-header">
								<span className="tag-badge">AI 衛教助理</span>
							</div>
							<div className="card-body">
								正在檢索影片逐字稿並生成解答...
							</div>
						</QuestionBoxCard>
					)}
					<div ref={messagesEndRef} />
				</MessagesContainer>

				<InputContainer onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="輸入您的醫療問題，例如：標靶治療有哪些副作用？爾必得舒的作用？"
						disabled={loading}
					/>
					<button type="submit" disabled={loading || !input.trim()}>
						{loading ? '檢索中...' : '發送問題'}
					</button>
				</InputContainer>
			</ChatSection>

			<Toast show={showToast}>
				{toastMsg}
			</Toast>
		</PageContainer>
	);
};

const container = document.getElementById('root');
if (container) {
	const root = createRoot(container);
	root.render(<App />);
}
