import json
import re
import sys

txt_path = r'C:\Users\Phiebe\OneDrive\Desktop\實習\頭頸癌衛教影片機器人\頭頸癌標靶治療指南.txt'
out_path = r'C:\Users\Phiebe\OneDrive\Desktop\實習\頭頸癌衛教影片機器人\chat-w-taylor-on-newheights-and-travis-gq-autorag-openaioss\src\transcriptData.ts'

with open(txt_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

segments = []
current_seg = {'startTime': 0, 'endTime': 0, 'text': ''}
seg_idx = 1
start_time_str = '00:00'
m2 = '00'
s2 = '00'

for line in lines:
    match = re.search(r'\[(\d{2}):(\d{2}):(\d{2}),\d{3} --> (\d{2}):(\d{2}):(\d{2}),\d{3}\]\s+(.*)', line)
    if not match: 
        continue
    
    h1, m1, s1, h2, m2, s2, text = match.groups()
    start_sec = int(h1)*3600 + int(m1)*60 + int(s1)
    end_sec = int(h2)*3600 + int(m2)*60 + int(s2)
    
    if current_seg['startTime'] == 0 and current_seg['text'] == '':
        current_seg['startTime'] = start_sec
        start_time_str = f'{m1}:{s1}'
    
    current_seg['endTime'] = end_sec
    current_seg['text'] += text.strip() + '，'
    
    # 切割約 25 秒的段落
    if (end_sec - current_seg['startTime'] >= 25):
        end_time_str = f'{m2}:{s2}'
        segments.append(f"""{{
    id: "seg-{seg_idx}",
    title: "衛教內容段落 {seg_idx}",
    startTime: {current_seg['startTime']},
    endTime: {current_seg['endTime']},
    formattedStart: "{start_time_str}",
    formattedEnd: "{end_time_str}",
    text: "{current_seg['text'].rstrip('，')}",
    summary: "頭頸癌衛教內容",
    keywords: []
}}""")
        seg_idx += 1
        current_seg = {'startTime': 0, 'endTime': 0, 'text': ''}

if current_seg['text'] != '':
    end_time_str = f'{m2}:{s2}'
    segments.append(f"""{{
    id: "seg-{seg_idx}",
    title: "衛教內容段落 {seg_idx}",
    startTime: {current_seg['startTime']},
    endTime: {current_seg['endTime']},
    formattedStart: "{start_time_str}",
    formattedEnd: "{end_time_str}",
    text: "{current_seg['text'].rstrip('，')}",
    summary: "頭頸癌衛教內容",
    keywords: []
}}""")

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
''' + ',\\n'.join(segments) + '''
];

export interface SearchResult {
	query: string;
	topSegments: TranscriptSegment[];
	primaryTime: number;
	formattedPrimaryTime: string;
}

export function searchTranscript(query: string): SearchResult {
	const q = query.toLowerCase().trim();
    
    let matches = TRANSCRIPT_SEGMENTS.filter(s => s.text.includes(q));
    if (matches.length === 0) {
        matches = TRANSCRIPT_SEGMENTS.slice(0, 5);
    }
    
	return {
		query,
		topSegments: matches.slice(0, 5),
		primaryTime: matches[0].startTime,
		formattedPrimaryTime: matches[0].formattedStart
	};
}
'''

with open(out_path, 'w', encoding='utf-8') as f:
    f.write(out_content)

print("寫入成功！")
