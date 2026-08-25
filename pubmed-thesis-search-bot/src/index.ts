import { ChatState } from './chatState';
import puppeteer from '@cloudflare/puppeteer';

export interface Env {
	CHAT_STATE: DurableObjectNamespace;
	ASSETS: Fetcher;
	BROWSER: Fetcher; // Add browser rendering binding
	AI: {
		autorag: (name: string) => {
			aiSearch: (params: { query: string }) => Promise<string>;
		};
		run: (model: string, params: { messages: Array<{ role: string; content: string }> }) => Promise<any>;
	};
	PUBMED_BIGQUERY_CREDENTIALS?: string;
	PUBMED_BIGQUERY_PROJECT_ID?: string;
	PUBMED_QUERY_MODE?: boolean;
}

// Function to scrape GQ article using browser rendering
async function scrapeGQArticle(env: Env): Promise<string> {
	const browser = await puppeteer.launch(env.BROWSER);
	const page = await browser.newPage();
	
	try {
		console.log('Navigating to GQ article...');
		
		// Set viewport
		await page.setViewport({ width: 1280, height: 720 });
		
		// Increase timeout and try different wait strategies
		await page.goto('https://www.gq.com/story/travis-kelce-september-cover-2025-interview-super-bowl-taylor-swift', {
			waitUntil: 'domcontentloaded', // Changed from networkidle0
			timeout: 60000 // Increased to 60 seconds
		});
		
		console.log('Page loaded, waiting for content...');
		
		// Wait a bit more for any dynamic content
		await new Promise(resolve => setTimeout(resolve, 3000));
		
		console.log('Extracting JSON-LD data...');
		
		// Extract the JSON-LD structured data
		const articleContent = await page.evaluate(() => {
			console.log('Starting content extraction...');
			
			// Look for JSON-LD script tags
			const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
			console.log(`Found ${jsonLdScripts.length} JSON-LD scripts`);
			
			for (let i = 0; i < jsonLdScripts.length; i++) {
				try {
					const script = jsonLdScripts[i];
					const jsonData = JSON.parse(script.textContent || '');
					console.log(`Script ${i} type:`, jsonData['@type']);
					
					// Check if this is the NewsArticle schema
					if (jsonData['@type'] === 'NewsArticle' && jsonData.articleBody) {
						console.log('Found NewsArticle with articleBody');
						return jsonData.articleBody;
					}
					
					// Handle arrays of JSON-LD objects
					if (Array.isArray(jsonData)) {
						for (const item of jsonData) {
							if (item['@type'] === 'NewsArticle' && item.articleBody) {
								console.log('Found NewsArticle in array with articleBody');
								return item.articleBody;
							}
						}
					}
				} catch (e) {
					console.log(`Failed to parse JSON-LD script ${i}:`, (e as Error).message);
					continue;
				}
			}
			
			console.log('No JSON-LD found, trying DOM extraction...');
			
			// Fallback: try to extract article content the old way
			const contentSelectors = [
				'article',
				'[data-module="ArticleBody"]',
				'.ArticleBodyWrapper',
				'.content-body',
				'article .body__inner-container',
				'article .article-body',
				'main'
			];
			
			for (const selector of contentSelectors) {
				const element = document.querySelector(selector);
				if (element && (element as HTMLElement).innerText.length > 500) {
					console.log(`Found content with selector: ${selector}`);
					return (element as HTMLElement).innerText;
				}
			}
			
			console.log('No content found with any selector');
			return null;
		});
		
		console.log(`Extracted ${articleContent?.length || 0} characters`);
		
		if (!articleContent || articleContent.length < 100) {
			throw new Error('Could not extract meaningful content from the article');
		}
		
		return articleContent;
		
	} catch (error) {
		console.error('Error scraping GQ article:', error);
		throw error;
	} finally {
		await browser.close();
	}
}

  

// Helper function to fetch content from URL
async function fetchContentFromURL(url: string): Promise<string> {
	try {
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		return await response.text();
	} catch (error) {
		console.error('Error fetching content:', error);
		return `Error loading content: ${error as string}`;
	}
}

// Helper function to format content nicely
function formatContent(content: string): string {
	// Display full content, format for readability
	return content
		.replace(/\n\n/g, '</p><p>')
		.replace(/\n/g, '<br>')
		.replace(/^/, '<p>')
		.replace(/$/, '</p>');
}

// Helper function to create PubMed demo HTML
function createPubMedDemoHTML(): string {
	return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>PubMed BigQuery 醫學問答機器人</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
			background: #f8fafc;
			min-height: 100vh;
			padding: 20px;
			color: #1e293b;
		}
		
		.container {
			max-width: 1200px;
			margin: 0 auto;
			background: white;
			border-radius: 8px;
			box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
			overflow: hidden;
			border: 1px solid #e2e8f0;
		}
		
		.header {
			background: #1e3a8a;
			color: white;
			padding: 32px 20px;
			text-align: center;
			border-bottom: 3px solid #2563eb;
		}
		
		.header h1 {
			font-size: 2.2em;
			margin-bottom: 8px;
		}
		
		.header p {
			font-size: 1em;
			color: #93c5fd;
		}
		
		.content {
			padding: 30px;
		}
		
		.chat-container {
			background: #f1f5f9;
			border-radius: 8px;
			height: 400px;
			overflow-y: auto;
			margin-bottom: 20px;
			padding: 20px;
			border: 1px solid #cbd5e1;
		}
		
		.message {
			margin-bottom: 15px;
			padding: 12px;
			border-radius: 8px;
			animation: slideIn 0.3s ease;
		}
		
		@keyframes slideIn {
			from {
				opacity: 0;
				transform: translateY(10px);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}
		
		.user-message {
			background: #2563eb;
			color: white;
			margin-left: 40px;
			text-align: right;
		}
		
		.ai-message {
			background: #ffffff;
			color: #0f172a;
			border: 1px solid #cbd5e1;
			margin-right: 40px;
		}
		
		.article-link {
			background: #f1f5f9;
			color: #1e3a8a;
			padding: 8px 12px;
			border-radius: 4px;
			font-size: 0.9em;
			margin: 5px 0;
			border-left: 3px solid #2563eb;
		}
		
		.input-group {
			display: flex;
			gap: 10px;
			margin-bottom: 20px;
		}
		
		input[type="text"] {
			flex: 1;
			padding: 12px;
			border: 1px solid #cbd5e1;
			border-radius: 6px;
			font-size: 1em;
		}
		
		button {
			padding: 12px 24px;
			background: #2563eb;
			color: white;
			border: none;
			border-radius: 6px;
			cursor: pointer;
			font-size: 1em;
			font-weight: 600;
			transition: background-color 0.2s;
		}
		
		button:hover {
			background: #1d4ed8;
		}
		
		button:disabled {
			opacity: 0.6;
			cursor: not-allowed;
		}
		
		.features {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 20px;
			margin: 20px 0 30px 0;
		}
		
		.feature-card {
			background: #f8fafc;
			padding: 20px;
			border-radius: 8px;
			border: 1px solid #e2e8f0;
			border-left: 4px solid #2563eb;
		}
		
		.feature-card h3 {
			color: #1e3a8a;
			margin-bottom: 8px;
			font-size: 1.1em;
		}

		.feature-card p {
			color: #475569;
			font-size: 0.95em;
		}
		
		@media (max-width: 768px) {
			body {
				padding: 8px;
			}

			.content {
				padding: 16px 12px;
			}

			.header {
				padding: 20px 12px;
			}

			.header h1 {
				font-size: 1.4em;
			}

			.header p {
				font-size: 0.85em;
			}

			.features {
				grid-template-columns: 1fr;
				gap: 12px;
				margin: 12px 0 20px 0;
			}

			.user-message {
				margin-left: 10px;
			}

			.ai-message {
				margin-right: 10px;
			}

			.input-group {
				gap: 8px;
			}

			input[type="text"] {
				font-size: 16px;
				padding: 10px 12px;
			}

			button {
				padding: 10px 14px;
				font-size: 0.88em;
				white-space: nowrap;
			}
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>PubMed BigQuery 醫學問答機器人</h1>
			<p>結合 Google BigQuery 與 AI 進行生醫文獻研究問答</p>
		</div>
		
		<div class="content">
			<div class="features">
				<div class="feature-card">
					<h3>PubMed 檢索</h3>
					<p>透過 Google BigQuery API 精準查詢 PubMed 數據庫中的生醫論文</p>
				</div>
				<div class="feature-card">
					<h3>AI 智慧解答</h3>
					<p>基於實證文獻摘要，由語言模型生成專業邏輯的解答</p>
				</div>
				<div class="feature-card">
					<h3>文獻引用標示</h3>
					<p>自動整理相關的 PubMed 論文與 PMID 識別碼</p>
				</div>
			</div>

			<div style="background: #f1f5f9; border-left: 4px solid #2563eb; padding: 16px 20px; border-radius: 6px; margin-bottom: 24px;">
				<h3 style="color: #1e3a8a; margin-bottom: 8px; font-size: 1em;">示例問題參考</h3>
				<ul style="margin-left: 20px; color: #475569; font-size: 0.95em;">
					<li>請查詢關於冠狀病毒的最新研究論文</li>
					<li>告訴我關於 mRNA 疫苗機制的相關文獻</li>
					<li>檢索有關癌症免疫療法的研究進展</li>
				</ul>
			</div>
			
			<div class="input-group">
				<input 
					type="text" 
					id="questionInput" 
					placeholder="輸入您的醫學問題..."
				>
				<button id="submitBtn">發送問題</button>
			</div>
			
			<div class="chat-container" id="chatContainer">
				<div style="text-align: center; color: #64748b; padding: 50px 20px;">
					<p>請在上方輸入框提出與 PubMed 醫學研究相關的問題。</p>
				</div>
			</div>
		</div>
	</div>
	
	<script>
		const chatContainer = document.getElementById('chatContainer');
		const questionInput = document.getElementById('questionInput');
		const submitBtn = document.getElementById('submitBtn');
		
		submitBtn.addEventListener('click', async () => {
			const question = questionInput.value.trim();
			if (!question) return;
			
			const userMsg = document.createElement('div');
			userMsg.className = 'message user-message';
			userMsg.textContent = question;
			chatContainer.appendChild(userMsg);
			chatContainer.scrollTop = chatContainer.scrollHeight;
			
			questionInput.value = '';
			submitBtn.disabled = true;
			
			try {
				const response = await fetch('/chat/', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ text: question, usePubMed: true })
				});
				
				const data = await response.json();
				
				data.messages.forEach(msg => {
					if (msg.isAI) {
						const aiMsg = document.createElement('div');
						aiMsg.className = 'message ai-message';
						aiMsg.textContent = msg.text;
						
						if (msg.pubmedResults && msg.pubmedResults.length > 0) {
							const articlesDiv = document.createElement('div');
							articlesDiv.style.marginTop = '10px';
							msg.pubmedResults.forEach(article => {
								const link = document.createElement('div');
								link.className = 'article-link';
								link.innerHTML = \`<strong>\${article.title}</strong><br>PMID: <a href="https://pubmed.ncbi.nlm.nih.gov/\${article.pmid}/" target="_blank" rel="noopener noreferrer">\${article.pmid}</a>\`;
								articlesDiv.appendChild(link);
							});
							aiMsg.appendChild(articlesDiv);
						}
						
						chatContainer.appendChild(aiMsg);
					}
				});
				
				chatContainer.scrollTop = chatContainer.scrollHeight;
			} catch (error) {
				const errorMsg = document.createElement('div');
				errorMsg.className = 'message ai-message';
				errorMsg.textContent = '錯誤：' + error.message;
				chatContainer.appendChild(errorMsg);
			} finally {
				submitBtn.disabled = false;
				questionInput.focus();
			}
		});
		
		questionInput.addEventListener('keypress', (e) => {
			if (e.key === 'Enter' && !submitBtn.disabled) {
				submitBtn.click();
			}
		});
	</script>
</body>
</html>`;
}

// Helper function to create source page HTML
function createSourcePageHTML(title: string, content: string): string {
	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${title} | Taylor & Travis Chat</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		
		body {
			font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			background: linear-gradient(135deg, 
				#FFD700 0%, 
				#FF8C00 15%, 
				#DDA0DD 30%, 
				#DC143C 45%, 
				#FF1493 60%, 
				#9370DB 75%, 
				#FF6347 90%, 
				#FFD700 100%
			);
			background-size: 600% 600%;
			animation: eraShift 15s ease infinite;
			min-height: 100vh;
			color: white;
			line-height: 1.6;
		}
		
		@keyframes eraShift {
			0% { background-position: 0% 50%; }
			25% { background-position: 100% 50%; }
			50% { background-position: 100% 100%; }
			75% { background-position: 0% 100%; }
			100% { background-position: 0% 50%; }
		}
		
		.container {
			max-width: 800px;
			margin: 0 auto;
			padding: 40px 20px;
			background: rgba(255, 255, 255, 0.1);
			backdrop-filter: blur(20px);
			border-radius: 20px;
			margin-top: 20px;
			margin-bottom: 20px;
			box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
		}
		
		.header {
			text-align: center;
			margin-bottom: 30px;
			padding-bottom: 20px;
			border-bottom: 2px solid rgba(255, 215, 0, 0.4);
		}
		
		.header h1 {
			font-size: 2.5rem;
			font-weight: 900;
			text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.4);
			background: linear-gradient(45deg, #FFD700, #FF1493);
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
			background-clip: text;
			margin-bottom: 10px;
		}
		
		.back-link {
			display: inline-block;
			background: linear-gradient(135deg, #FF1493 0%, #FFD700 100%);
			color: white;
			padding: 12px 24px;
			border-radius: 25px;
			text-decoration: none;
			font-weight: 600;
			margin-bottom: 20px;
			transition: transform 0.3s ease;
			box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
		}
		
		.back-link:hover {
			transform: translateY(-2px) scale(1.05);
			text-decoration: none;
			color: white;
		}
		
		.content {
			background: rgba(255, 255, 255, 0.95);
			color: #2C1810;
			padding: 30px;
			border-radius: 15px;
			box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
			font-size: 1.1rem;
			line-height: 1.8;
			max-height: 70vh;
			overflow-y: auto;
		}
		
		.content::-webkit-scrollbar {
			width: 8px;
		}
		
		.content::-webkit-scrollbar-track {
			background: rgba(255, 215, 0, 0.2);
			border-radius: 4px;
		}
		
		.content::-webkit-scrollbar-thumb {
			background: linear-gradient(45deg, #FFD700, #FF1493);
			border-radius: 4px;
		}
		
		.content p {
			margin-bottom: 1.2rem;
		}
		
		.excerpt-notice {
			background: linear-gradient(135deg, #FFD700 0%, #FF1493 100%);
			color: white;
			padding: 15px;
			border-radius: 10px;
			margin-bottom: 20px;
			font-weight: 600;
			text-align: center;
			font-size: 0.95rem;
		}
		
		.warning {
			background: rgba(255, 140, 0, 0.9);
			color: white;
			padding: 15px;
			border-radius: 10px;
			margin-bottom: 20px;
			font-weight: 600;
			text-align: center;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<a href="/" class="back-link">← Back to Chat</a>
			<h1>${title}</h1>
		</div>
		<div class="content">
			${content}
		</div>
	</div>
</body>
</html>`;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// Handle static assets
		if (url.pathname === '/' || url.pathname.startsWith('/bundle.js')) {
			return env.ASSETS.fetch(request);
		}

		// Handle scraping and displaying GQ article
		if (url.pathname === '/scrape-gq') {
			try {
				console.log('Scraping GQ article...');
				const content = await scrapeGQArticle(env);
				
				// Due to copyrights, excerpt shown instead of full article
				const excerpt = content.length > 2000 ? 
					content.substring(0, 2000) + '\n\n[Article excerpt shown - Full article available at GQ.com and was scraped for this app]' : 
					content;
				
				const formattedContent = formatContent(excerpt);
				
				const html = createSourcePageHTML(
					'📰 Travis Kelce GQ Article',
					`
					<div style="background: rgba(255, 215, 0, 0.1); padding: 15px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
						<strong>🔥 Content scraped from GQ.com 🔥</strong><br>
						<small>Scraped: ${new Date().toLocaleString()}</small><br>
						<small><a href="https://www.gq.com/story/travis-kelce-september-cover-2025-interview-super-bowl-taylor-swift" target="_blank">View full article on GQ.com</a></small>
					</div>
					<div style="font-family: Georgia, serif;">
						${formattedContent}
					</div>
					`
				);
				
				return new Response(html, {
					headers: { 'Content-Type': 'text/html' }
				});
			} catch (error) {
				console.error('GQ scraping error:', error);
				
				const errorHtml = createSourcePageHTML(
					'📰 Travis Kelce GQ Article',
					`
					<div style="text-align: center; padding: 40px;">
						<h2 style="color: #dc143c;">Scraping Failed</h2>
						<p><strong>Error:</strong> ${error}</p>
						<p><a href="https://www.gq.com/story/travis-kelce-september-cover-2025-interview-super-bowl-taylor-swift" target="_blank">Read original article on GQ.com</a></p>
						<br>
						<h3>Troubleshooting:</h3>
						<ul style="text-align: left; display: inline-block;">
							<li>Make sure browser rendering is enabled in wrangler.toml</li>
							<li>Check if @cloudflare/puppeteer is installed</li>
							<li>Verify the GQ URL is accessible</li>
							<li>Check worker logs with: wrangler tail</li>
						</ul>
					</div>
					`
				);
				
				return new Response(errorHtml, {
					headers: { 'Content-Type': 'text/html' }
				});
			}
		}

		// Handle transcript page
		if (url.pathname === '/transcript') {
			const transcriptUrl = 'https://pub-67f358acd2164754bf3f8ee30a75ef03.r2.dev/Taylor%20Swift%20on%20Reclaiming%20Her%20Masters%2C%20Wrapping%20The%20Eras%20Tour%2C%20and%20The%20Life%20of%20a%20Showgirl%20%20NHTV.txt';
			
			const content = await fetchContentFromURL(transcriptUrl);
			const formattedContent = formatContent(content);
			
			const html = createSourcePageHTML(
				'🎤 New Heights Podcast Transcript scraped from <a href="https://www.youtube.com/watch?v=M2lX9XESvDE&t=6297s">YouTube</a>',
				`
				<div style="font-family: Georgia, serif;">
					${formattedContent}
				</div>
				`
			);
			
			return new Response(html, {
				headers: { 'Content-Type': 'text/html' }
			});
		}

		// Handle GQ article page
		if (url.pathname === '/gq-article') {
			const articleUrl = 'https://pub-67f358acd2164754bf3f8ee30a75ef03.r2.dev/travisgq.txt';
			
			const content = await fetchContentFromURL(articleUrl);
			const formattedContent = formatContent(content);
			
			const html = createSourcePageHTML(
				'<a href="https://www.gq.com/story/travis-kelce-september-cover-2025-interview-super-bowl-taylor-swift">📰 Travis Kelce GQ Article</a> scraped with Cloudflare Browser Rendering',
				`
				<div style="font-family: Georgia, serif;">
					${formattedContent}
				</div>
				`
			);
			
			return new Response(html, {
				headers: { 'Content-Type': 'text/html' }
			});
		}

		// Handle chat routes
		if (url.pathname.startsWith('/chat/')) {
			if (url.pathname === '/chat/init') {
				// The product intentionally uses one shared physician conversation.
				// A new name starts the shared room without reviving stale, incorrect
				// answers stored by the pre-verification implementation.
				const id = env.CHAT_STATE.idFromName('shared-medical-chat-v2');
				return new Response(JSON.stringify({ id: id.toString() }), {
					headers: { 'Content-Type': 'application/json' },
				});
			}

			// Always route chat traffic to the shared room. This also migrates
			// already-open browsers that still hold a former per-browser ID.
			const id = env.CHAT_STATE.idFromName('shared-medical-chat-v2');
			const obj = env.CHAT_STATE.get(id);
			return obj.fetch(request);
		}

		// Handle PubMed demo page
		if (url.pathname === '/pubmed') {
			const pubmedHTML = createPubMedDemoHTML();
			return new Response(pubmedHTML, {
				headers: { 'Content-Type': 'text/html' }
			});
		}

		return new Response('Not found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;

export { ChatState };
