import fs from 'fs';
import path from 'path';

const auditPmids = [
  '34256789',
  '37890123',
  '32172410',
  '34217891',
  '34567890',
  '33745997',
  '38367737',
];

async function runAudit() {
  const rootDir = process.cwd();
  const rawDir = path.join(rootDir, 'audit', 'raw');
  const parsedDir = path.join(rootDir, 'audit', 'parsed');

  fs.mkdirSync(rawDir, { recursive: true });
  fs.mkdirSync(parsedDir, { recursive: true });

  console.log(`Starting Audit for PMIDs: ${auditPmids.join(', ')}`);

  const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${auditPmids.join(',')}&retmode=xml`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`NCBI EFetch API failed with status ${res.status}`);
  }

  const xmlText = await res.text();

  // Split into PubmedArticle blocks
  const articleBlocks = xmlText.split(/<PubmedArticle\b[^>]*>/i).slice(1);

  const parsedRecords: Record<string, any> = {};

  articleBlocks.forEach((block) => {
    const fullXml = `<PubmedArticle>${block}`;
    const pmidMatch = block.match(/<PMID[^>]*>(\d+)<\/PMID>/i);
    if (!pmidMatch) return;

    const pmid = pmidMatch[1].trim();

    // 1. Save Raw XML
    const rawFilePath = path.join(rawDir, `${pmid}.xml`);
    fs.writeFileSync(rawFilePath, fullXml, 'utf-8');

    // 2. Deterministic Parsing
    const titleMatch = block.match(/<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/i);
    let cleanTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    if (cleanTitle.endsWith('.')) cleanTitle = cleanTitle.slice(0, -1);

    const abstractMatches = block.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/gi);
    let abstractText = '';
    if (abstractMatches) {
      abstractText = abstractMatches.map((a) => a.replace(/<[^>]+>/g, '').trim()).join(' ');
    }

    const journalMatch = block.match(/<Title>([\s\S]*?)<\/Title>/i) || block.match(/<MedlineTA>([\s\S]*?)<\/MedlineTA>/i);
    const journalText = journalMatch ? journalMatch[1].replace(/<[^>]+>/g, '').trim() : '';

    const yearMatch = block.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/i) || block.match(/<DateCompleted>[\s\S]*?<Year>(\d{4})<\/Year>/i);
    const monthMatch = block.match(/<PubDate>[\s\S]*?<Month>([A-Za-z0-9]+)<\/Month>/i);
    let pubDate = yearMatch ? yearMatch[1] : '';
    if (yearMatch && monthMatch) {
      pubDate = `${yearMatch[1]} ${monthMatch[1]}`;
    }

    const doiMatch = block.match(/<ArticleId\s+IdType=["']doi["']>([\s\S]*?)<\/ArticleId>/i);
    const doiText = doiMatch ? doiMatch[1].replace(/<[^>]+>/g, '').trim() : undefined;

    const meshMatches = block.match(/<DescriptorName[^>]*>([\s\S]*?)<\/DescriptorName>/gi);
    let meshList: string[] = [];
    if (meshMatches) {
      meshList = meshMatches.map((m) => m.replace(/<[^>]+>/g, '').trim());
    }

    const parsedRecord = {
      pmid,
      title: cleanTitle,
      journal: journalText,
      publication_date: pubDate,
      doi: doiText || null,
      mesh_terms: meshList,
      abstract: abstractText,
    };

    parsedRecords[pmid] = parsedRecord;

    // Save Parsed JSON per PMID
    const parsedFilePath = path.join(parsedDir, `${pmid}.json`);
    fs.writeFileSync(parsedFilePath, JSON.stringify(parsedRecord, null, 2), 'utf-8');
  });

  // Save full ground-truth-audit.json
  const auditReportPath = path.join(rootDir, 'ground-truth-audit.json');
  fs.writeFileSync(auditReportPath, JSON.stringify(parsedRecords, null, 2), 'utf-8');

  console.log(`Audit complete. Raw XML saved in ${rawDir}, Parsed JSON saved in ${parsedDir}, Ground Truth Audit saved in ${auditReportPath}`);
}

runAudit().catch(console.error);
