import json
import re

txt_path = r'C:\Users\Phiebe\OneDrive\Desktop\實習\頭頸癌衛教影片機器人\頭頸癌標靶治療指南.txt'
out_path = r'C:\Users\Phiebe\OneDrive\Desktop\實習\頭頸癌衛教影片機器人\chat-w-taylor-on-newheights-and-travis-gq-autorag-openaioss\src\transcriptData.ts'

with open(txt_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

def parse_time(h, m, s): return int(h)*3600 + int(m)*60 + int(s)

logical_splits = [
    {'title': '影片介紹與開場', 'start': 0, 'end': 84}, 
    {'title': '認識標靶治療與化療比較', 'start': 84, 'end': 145}, 
    {'title': '常見標靶藥物：EGFR抑制劑', 'start': 145, 'end': 218}, 
    {'title': '常見標靶藥物：VEGF抑制劑', 'start': 218, 'end': 279}, 
    {'title': '治療時機與搭配方式', 'start': 279, 'end': 335}, 
    {'title': '標靶治療常見的副作用與緩解', 'start': 335, 'end': 387}, 
    {'title': '注意事項與免責提醒', 'start': 387, 'end': 500} 
]

segments_data = [{'id': f'seg-{i+1}', 'title': s['title'], 'startTime': s['start'], 'endTime': s['end'], 'text': ''} for i, s in enumerate(logical_splits)]

last_m2, last_s2 = "07", "15"

for line in lines:
    match = re.search(r'\[(\d{2}):(\d{2}):(\d{2}),\d{3} --> (\d{2}):(\d{2}):(\d{2}),\d{3}\]\s+(.*)', line)
    if not match: continue
    h1, m1, s1, h2, m2, s2, text = match.groups()
    start_sec = parse_time(h1, m1, s1)
    last_m2, last_s2 = m2, s2
    
    for seg in segments_data:
        if seg['startTime'] <= start_sec < seg['endTime']:
            seg['text'] += text.strip() + '，'
            break

output_lines = []
for seg in segments_data:
    if seg['text']:
        m1, s1 = divmod(seg['startTime'], 60)
        m2, s2 = divmod(seg['endTime'], 60)
        if seg['endTime'] == 500:
            m2, s2 = int(last_m2), int(last_s2)
            
        output_lines.append(f'''{{
    id: "{seg['id']}",
    title: "{seg['title']}",
    startTime: {seg['startTime']},
    endTime: {seg['endTime']},
    formattedStart: "{m1:02d}:{s1:02d}",
    formattedEnd: "{m2:02d}:{s2:02d}",
    text: "{seg['text'].rstrip('，')}",
    summary: "{seg['title']}",
    keywords: []
}}''')

out_content = '''export interface TranscriptSegment {
	id: string;
	title: string;
	startTime: number;
	endTime: number;
	formattedStart: string;
	formattedEnd: string;
	text: string;
	keywords: string[];
	summary: string;
}

export const TRANSCRIPT_SEGMENTS: TranscriptSegment[] = [
''' + ',\n'.join(output_lines) + '''
];

export interface SearchResult {
	query: string;
	topSegments: TranscriptSegment[];
	primaryTime: number;
	formattedPrimaryTime: string;
}

export function searchTranscript(query: string): SearchResult {
	const q = query.toLowerCase().trim();
	let matches: TranscriptSegment[] = [];

	if (q.includes("副作用") || q.includes("腹瀉") || q.includes("皮膚") || q.includes("不適") || q.includes("皮疹")) {
		matches = TRANSCRIPT_SEGMENTS.filter(s => s.title.includes("副作用"));
	} else if (q.includes("egfr") || q.includes("vegf") || q.includes("受體") || q.includes("新生血管") || q.includes("藥物") || q.includes("爾必得舒") || q.includes("癌思停")) {
		matches = TRANSCRIPT_SEGMENTS.filter(s => s.title.includes("標靶藥物"));
	} else if (q.includes("階段") || q.includes("中晚期") || q.includes("時機") || q.includes("搭配")) {
		matches = TRANSCRIPT_SEGMENTS.filter(s => s.title.includes("時機"));
	} else if (q.includes("什麼是") || q.includes("化療")) {
        matches = TRANSCRIPT_SEGMENTS.filter(s => s.title.includes("化療比較"));
    }
    
	if (matches.length === 0) {
		matches = TRANSCRIPT_SEGMENTS.filter(s => s.text.includes(q) || s.title.includes(q));
	}
    
	if (matches.length === 0) {
        matches = TRANSCRIPT_SEGMENTS.filter(s => s.title.includes("化療比較"));
    }
    
	const topSegments = matches.slice(0, 2);
	return {
		query,
		topSegments: topSegments,
		primaryTime: topSegments[0] ? topSegments[0].startTime : 0,
		formattedPrimaryTime: topSegments[0] ? topSegments[0].formattedStart : "00:00"
	};
}
'''

with open(out_path, 'w', encoding='utf-8') as f:
    f.write(out_content)
