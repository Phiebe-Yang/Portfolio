export interface TranscriptSegment {
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
{
    id: "seg-1",
    title: "影片介紹與開場",
    startTime: 0,
    endTime: 84,
    formattedStart: "00:00",
    formattedEnd: "01:24",
    text: "大家好,歡迎來到我們今天的解析單元，說真的,一聽到各種深色的醫學名詞和治療方案，很多人第一時間都會覺得腦袋一片空白，甚至有點焦慮,對吧?，這真的完全是正常的反應，今天呢,我們要來把一份非常重要的衛教治療拆解來，主題就是頭頸癌標靶治療，別擔心,我們絕對不會用那種像教科書一樣難懂的火星文來轟炸你，我們會用最白話、最清晰的方式，一步一步帶你揭開標靶治療的神祕面紗，讓你真正掌握最關鍵的資訊，畫面上這句話,瞭解治療方式是一起面對疾病的重要一步，我覺得說的真的是太貼切,太有力量了，面對頭頸癌,你絕對不是孤軍奮戰哦，不管你是患者本人,是照顧家人的家屬，還是單純想多補充點健康知識的朋友，擁有正確的觀念,就是我們建立信心，跟醫療團隊並肩作戰的，最強武器，這也是我們今天做這期解析最主要的目的了，好,爲了讓大家有個清楚的方向，我們今天會分成四個簡單的步驟來聊，第一,先帶你認識什麼是標靶治療，第二,認識兩種最常見的標靶藥物，第三,是治療時機跟怎麼搭配，最後呢,就是注意事項跟後續的追蹤，馬上進入我們的第一部分",
    summary: "影片介紹與開場",
    keywords: []
},
{
    id: "seg-2",
    title: "認識標靶治療與化療比較",
    startTime: 84,
    endTime: 145,
    formattedStart: "01:24",
    formattedEnd: "02:25",
    text: "認識標靶治療，它的核心概念就跟副標題，寫得一樣,就是精準鎖定癌細胞，其實啊,標靶治療可以說是，這幾年癌症治療裏面，超級重要的一個大突破，它完全打破了以前那種，浴室聚焚的傳統印象，讓整個治療變得更聰明，更剋制化，你想想看哦,傳統的化學治療，就有點像是進行大範圍的轟炸，雖然確實能消滅敵人，但難免會波及到旁邊無辜的正常細胞，但是呢,標靶治療，其實標靶治療就不一樣了哦，它簡直就像是一個配備了，高科技瞄準鏡的神射手，它會先去認出，癌細胞表面那些，很特別的標記，然後直接鎖定它們當作目標，因爲它主要是衝着癌細胞去的，對正常細胞的影響，相對就小很多，這也代表着，它有機會能大幅減輕那些，讓人很不舒服的副作用，接下來第二部分",
    summary: "認識標靶治療與化療比較",
    keywords: []
},
{
    id: "seg-3",
    title: "常見標靶藥物：EGFR抑制劑",
    startTime: 145,
    endTime: 218,
    formattedStart: "02:25",
    formattedEnd: "03:38",
    text: "我們來看看兩種，最常見的標靶醫學，也就是EGFR跟VEGF抑制劑，先別被這串英文字母給嚇退了，我們一個一個來，首先登場的是EGFR抑制劑，臨牀上有一塊很常見的藥物，叫做耳壁德書，講白話一點，癌細胞的表面長了一些，叫做EGFR的受體，你就可以把這些受體，想象成是癌細胞專用的天線，專門用來接收那種，趕快長大啊，趕快分裂啊，的訊號，而耳壁德書的任務呢，就是跑過去精準的把這些天線給卡死，他作戰的方式大致上分三步，第一步，藥物先死死地結合到癌細胞的EGFR天線上，接着第二步，這招超狠，就等於是直接剪斷了癌細胞的通訊電纜，癌細胞收不到生長訊號，自然就沒辦法繼續擴張了，更厲害的是第三步，這款藥不只能切斷訊號，它還像是在癌細胞頭上打了一盞超級亮的探照燈，讓我們先天的免疫系統可以一眼認出，嘿，壞人在這兒，然後主動發動攻擊",
    summary: "常見標靶藥物：EGFR抑制劑",
    keywords: []
},
{
    id: "seg-4",
    title: "常見標靶藥物：VEGF抑制劑",
    startTime: 218,
    endTime: 279,
    formattedStart: "03:38",
    formattedEnd: "04:39",
    text: "真的是一個非常聰明，多管齊下的戰術，好，那第二種藥物是VEGF抑制劑，大家比較常聽到的名字是癌絲亭，他的作戰邏輯跟剛剛完全不一樣，他不是直接去跟癌細胞硬碰硬，而是用了一招釜底抽薪的戰術，他直接盯上了，腫瘤旁邊的血管，你看哦，腫瘤想要越長越大，就需要喫東西嘛，要有源源不絕的養分，所以他會拼命叫周圍長出新的微血管，來幫他運送物質，那VEGF抑制劑的第一步，就是直接攔截不準腫瘤長出新血管，第二步，沒有了血管，就等於狠狠切斷了腫瘤的補給線，癌細胞能拿到的氧氣跟養分瞬間就變少了，到了第三步，癌細胞在這種又餓，又餓又餓的情況下，當然就長不大啦，這不就達到抑制腫瘤生長的目的了嗎，這招是不是真的超級巧妙，瞭解了武器怎麼運作，我們來到第三部分",
    summary: "常見標靶藥物：VEGF抑制劑",
    keywords: []
},
{
    id: "seg-5",
    title: "治療時機與搭配方式",
    startTime: 279,
    endTime: 335,
    formattedStart: "04:39",
    formattedEnd: "05:35",
    text: "治療時機與搭配，看看醫生怎麼打造完整的治療策略，聽到這裏，你生理可能在想，那我什麼時候該用這些標靶藥物啊，通常呢會用在中晚期，或者是復發轉移性的頭頸癌，當然啦，這都必須由專業的醫師，根據你個人的真實狀況，做非常謹慎的評估，而且打仗通常不能只靠單挑對吧，醫師常常會把標靶治療，跟其他的武器搭在一起用，像是放射線治療啦，化學治療，或者是這幾年討論度超高的免疫治療，把這些療法靈活的組合在一起，爲了救世，幫你量身打造一套最強，最完整的作戰計劃，把整理的治療效果拉到最高，這絕對是一場講求團隊合作的戰役，最後一個部分，也就是第四部分，注意事項與追蹤，還有爲什麼與醫療團隊，密切合作這麼重要",
    summary: "治療時機與搭配方式",
    keywords: []
},
{
    id: "seg-6",
    title: "標靶治療常見的副作用與緩解",
    startTime: 335,
    endTime: 387,
    formattedStart: "05:35",
    formattedEnd: "06:27",
    text: "雖然我們前面說，標靶治療就像神射手，副作用相對比較少，但老實說，這也不代表完全沒有，對於副作用，我們不需要過度害怕，而是要把它當作一個，可預期可管理的過程，這會根據你用哪一種藥而有所不同，舉例來說，有些藥可能會影響你的血壓，腎功能，或是讓傷口好得比較慢，那有些藥可能會影響你的血壓，有些藥可能會讓你皮膚長皮疹，拉肚子，覺得特別累，或是嘴巴破皮很不舒服，這也是爲什麼在治療期間，一定要乖乖定期回診，追蹤這些素質跟身體狀況，這真的非常關鍵，注意咯，今天講了這麼多，這個觀念絕對是最重要的一點，一定要主動告知醫療團隊，你的任何不舒服，你的醫療團隊看過太多狀況了，他們有非常多方法，可以幫你緩解這些副作用，但大前提是",
    summary: "標靶治療常見的副作用與緩解",
    keywords: []
},
{
    id: "seg-7",
    title: "注意事項與免責提醒",
    startTime: 387,
    endTime: 500,
    formattedStart: "06:27",
    formattedEnd: "07:11",
    text: "他們必須要，知道你現在感覺怎麼樣啊，千萬千萬不要覺得，哎呀這點小痛，我忍一下就過去了，真的不要，任何微小的不舒服，都應該馬上跟醫師或護理師說，這不只能讓你在治療期間舒服一點，更是確保整個治療計劃，能順利走下去的最大關鍵，當然啦，最後還是得囉嗦一下，今天的慰教解習，是爲了幫大家建立清楚的觀念，這絕對不能取代專業醫師，親自爲你做的診斷跟治療哦，好啦，現在你已經完全搞懂，了頭頸癌標靶治療的運作原理，跟基本策略，那麼你準備好，帶着今天學到的知識，去跟你的醫療團隊，好好討論，專屬於你的作戰計劃了嗎，保持希望，積極面對，我們下次解析再見咯",
    summary: "注意事項與免責提醒",
    keywords: []
}
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
