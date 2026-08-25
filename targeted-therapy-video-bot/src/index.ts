import { ChatState } from './chatState';
import { TRANSCRIPT_SEGMENTS } from './transcriptData';

export interface Env {
	CHAT_STATE: DurableObjectNamespace;
	ASSETS: Fetcher;
	R2_BUCKET: R2Bucket;
	AI: {
		run: (model: string, params: { messages: Array<{ role: string; content: string }> }) => Promise<any>;
	};
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// Stream video.mp4 directly from R2 bucket with proper Range support
		if (url.pathname === '/video.mp4') {
			const rangeHeader = request.headers.get('range');
			let videoObject;
			
			if (rangeHeader) {
				// Parse Range header (e.g., "bytes=0-")
				videoObject = await env.R2_BUCKET.get('video.mp4', {
					httpMetadata: request.headers
				});
			} else {
				videoObject = await env.R2_BUCKET.get('video.mp4');
			}

			if (!videoObject) {
				return new Response('Video not found', { status: 404 });
			}

			const headers = new Headers();
			videoObject.writeHttpMetadata(headers);
			headers.set('etag', videoObject.httpEtag);
			headers.set('Accept-Ranges', 'bytes');

			// If it's a partial response from R2
			if (rangeHeader && videoObject.range) {
				headers.set('Content-Range', `bytes ${videoObject.range.offset}-${videoObject.range.offset + videoObject.range.length - 1}/${videoObject.size}`);
				headers.set('Content-Length', videoObject.range.length.toString());
				return new Response(videoObject.body, { 
					status: 206, 
					headers 
				});
			}

			headers.set('Content-Length', videoObject.size.toString());
			return new Response(videoObject.body, { headers });
		}

		// Return transcript API
		if (url.pathname === '/api/transcript') {
			return new Response(JSON.stringify({ segments: TRANSCRIPT_SEGMENTS }), {
				headers: { 'Content-Type': 'application/json' },
			});
		}

		// Handle chat routes with Durable Object
		if (url.pathname.startsWith('/chat/')) {
			// Change room name to force a clean slate and avoid cached old fallback strings
			const id = env.CHAT_STATE.idFromName('video-rag-session-v4');
			const obj = env.CHAT_STATE.get(id);

			if (url.pathname === '/chat/init') {
				return new Response(JSON.stringify({ id: id.toString() }), {
					headers: { 'Content-Type': 'application/json' },
				});
			}

			return obj.fetch(request);
		}

		// Fallback to static assets (HTML, bundle.js, video.mp4, etc.)
		return env.ASSETS.fetch(request);
	},
} satisfies ExportedHandler<Env>;

export { ChatState };