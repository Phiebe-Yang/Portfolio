import { searchTranscript, TranscriptSegment, TRANSCRIPT_SEGMENTS } from './transcriptData';

export interface ChatMessage {
	id: string;
	text: string;
	timestamp: number;
	isAI?: boolean;
	primaryTime?: number;
	formattedPrimaryTime?: string;
	segments?: {
		id: string;
		title: string;
		startTime: number;
		endTime: number;
		formattedStart: string;
		formattedEnd: string;
		summary: string;
	}[];
}

interface Env {
	AI: {
		run: (model: string, params: { messages: Array<{ role: string; content: string }> }) => Promise<any>;
		autorag?: (name: string) => {
			aiSearch: (params: { query: string }) => Promise<any>;
		};
	};
}

export class ChatState {
	private state: DurableObjectState;
	private messages: ChatMessage[];
	private env: Env;

	constructor(state: DurableObjectState, env: Env) {
		this.state = state;
		this.env = env;
		this.messages = [];
		this.state.blockConcurrencyWhile(async () => {
			const stored = await this.state.storage.get<ChatMessage[]>('messages');
			if (stored) {
				this.messages = stored;
			}
		});
	}

	async fetch(request: Request) {
		const url = new URL(request.url);

		if (request.method === 'GET') {
			return new Response(JSON.stringify({ messages: this.messages }), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		if (request.method === 'POST') {
			const body = (await request.json()) as { text: string };
			console.log('Received question:', body.text);

			const userMessage: ChatMessage = {
				id: crypto.randomUUID(),
				text: body.text,
				timestamp: Date.now(),
				isAI: false,
			};
			this.messages.push(userMessage);

			try {
				// Search transcript for relevant segments
				const searchRes = searchTranscript(body.text);
				const topSegs = searchRes.topSegments;

				// 直接將搜尋到的最相關逐字稿內容，原汁原味地組合起來作為回答
				// 這樣可以保證 100% 正確，且絕對會有文字出現（不需依賴 AI 生成）
				let aiAnswerText = "根據影片內容，為您找到以下原音解說：\n\n";
				
				topSegs.forEach((seg) => {
					aiAnswerText += `【${seg.title}】\n${seg.text}\n\n`;
				});

				aiAnswerText += "（您可以點擊下方按鈕，直接跳轉觀看影片中對應的片段）";

				const aiMessage: ChatMessage = {
					id: crypto.randomUUID(),
					text: aiAnswerText,
					timestamp: Date.now(),
					isAI: true,
					primaryTime: searchRes.primaryTime,
					formattedPrimaryTime: searchRes.formattedPrimaryTime,
					segments: topSegs.map((s) => ({
						id: s.id,
						title: s.title,
						startTime: s.startTime,
						endTime: s.endTime,
						formattedStart: s.formattedStart,
						formattedEnd: s.formattedEnd,
						summary: s.summary,
					})),
				};

				this.messages.push(aiMessage);
				await this.state.storage.put('messages', this.messages);

				return new Response(
					JSON.stringify({
						messages: [userMessage, aiMessage],
					}),
					{
						headers: { 'Content-Type': 'application/json' },
					}
				);
			} catch (error) {
				console.error('Error generating AI RAG response:', error);
				return new Response(
					JSON.stringify({
						messages: [userMessage],
					}),
					{
						headers: { 'Content-Type': 'application/json' },
					}
				);
			}
		}

		if (request.method === 'DELETE') {
			this.messages = [];
			await this.state.storage.delete('messages');
			return new Response(JSON.stringify({ success: true }), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		return new Response('Method not allowed', { status: 405 });
	}
}