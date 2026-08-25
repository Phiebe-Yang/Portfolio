import { PubMedArticle } from './pubmedBigQuery';

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(parseInt(decimal, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseDateBlock(block?: string): string | undefined {
  if (!block) return undefined;
  const yearMatch = block.match(/<Year>(\d{4})<\/Year>/i);
  const monthMatch = block.match(/<Month>([A-Za-z0-9]+)<\/Month>/i);
  const dayMatch = block.match(/<Day>(\d{1,2})<\/Day>/i);
  const medlineDateMatch = block.match(/<MedlineDate>([\s\S]*?)<\/MedlineDate>/i);
  if (medlineDateMatch) return decodeXmlEntities(medlineDateMatch[1].replace(/<[^>]+>/g, '').trim());
  if (!yearMatch) return undefined;
  return [yearMatch[1], monthMatch?.[1], dayMatch?.[1]].filter(Boolean).join(' ');
}

function dateSortValue(value?: string): number | undefined {
  if (!value) return undefined;
  const year = Number(value.match(/\b(19\d{2}|20\d{2})\b/)?.[1]);
  if (!year) return undefined;
  const monthNames: Record<string, number> = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
    apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
    aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10,
    october: 10, nov: 11, november: 11, dec: 12, december: 12,
  };
  const tail = value.slice(value.search(/\b(19\d{2}|20\d{2})\b/) + 4);
  const numericMonth = tail.match(/^[\s/.\-]*(0?[1-9]|1[0-2])/);
  const namedMonth = tail.toLowerCase().match(/\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\b/);
  const month = numericMonth ? Number(numericMonth[1]) : namedMonth ? monthNames[namedMonth[1]] : 1;
  const day = Number(tail.match(/(?:\b[A-Za-z]+|\b\d{1,2})\s+(\d{1,2})\b/)?.[1] || 1);
  return year * 10000 + month * 100 + day;
}

/**
 * P0-3 Shared Deterministic Canonical PubMed XML Parser
 * Shared between Production, Audit Script, and Integration Tests.
 * P0-4: Strict PubDate parsing. NO DateCompleted fallback.
 */
export function parseCanonicalPubMedRecord(xmlArticleBlock: string): PubMedArticle | null {
  if (!xmlArticleBlock) return null;

  // Extract PMID
  const pmidMatch = xmlArticleBlock.match(/<PMID[^>]*>(\d+)<\/PMID>/i);
  if (!pmidMatch) return null;
  const pmid = pmidMatch[1].trim();

  // Extract Article Title
  const titleMatch = xmlArticleBlock.match(/<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/i);
  let cleanTitle = titleMatch ? decodeXmlEntities(titleMatch[1].replace(/<[^>]+>/g, '').trim()) : '';
  if (cleanTitle.endsWith('.')) cleanTitle = cleanTitle.slice(0, -1);
  if (!cleanTitle) return null;

  // Extract Abstract
  const abstractMatches = xmlArticleBlock.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/gi);
  let abstractText = '';
  if (abstractMatches) {
    abstractText = abstractMatches.map((a) => decodeXmlEntities(a.replace(/<[^>]+>/g, '').trim())).join(' ');
  }

  // Extract Journal
  const journalMatch = xmlArticleBlock.match(/<Journal>[\s\S]*?<Title>([\s\S]*?)<\/Title>/i) ||
    xmlArticleBlock.match(/<MedlineTA>([\s\S]*?)<\/MedlineTA>/i);
  const journalText = journalMatch ? decodeXmlEntities(journalMatch[1].replace(/<[^>]+>/g, '').trim()) : undefined;

  // Keep journal-issue and electronic dates separate. Date filtering uses the
  // earliest verifiable public date so future print issues do not masquerade
  // as newly published research.
  let journalIssueDate: string | undefined;
  let electronicPublicationDate: string | undefined;

  const pubDateBlockMatch = xmlArticleBlock.match(/<JournalIssue[^>]*>[\s\S]*?<PubDate>([\s\S]*?)<\/PubDate>/i) ||
    xmlArticleBlock.match(/<PubDate>([\s\S]*?)<\/PubDate>/i);
  journalIssueDate = parseDateBlock(pubDateBlockMatch?.[1]);

  const articleDateMatch = xmlArticleBlock.match(/<ArticleDate[^>]*DateType=["']Electronic["'][^>]*>([\s\S]*?)<\/ArticleDate>/i) ||
    xmlArticleBlock.match(/<ArticleDate[^>]*>([\s\S]*?)<\/ArticleDate>/i);
  electronicPublicationDate = parseDateBlock(articleDateMatch?.[1]);

  const dateCandidates = [journalIssueDate, electronicPublicationDate]
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => (dateSortValue(a) || Number.MAX_SAFE_INTEGER) - (dateSortValue(b) || Number.MAX_SAFE_INTEGER));
  const firstPublicationDate = dateCandidates[0];

  const publicationTypeMatches = Array.from(xmlArticleBlock.matchAll(/<PublicationType[^>]*>([\s\S]*?)<\/PublicationType>/gi));
  const publicationTypes = publicationTypeMatches
    .map((match) => decodeXmlEntities(match[1].replace(/<[^>]+>/g, '').trim()))
    .filter(Boolean);

  // Structured DOI Identifier strictly from <ArticleId IdType="doi">
  const doiMatch = xmlArticleBlock.match(/<ArticleId\s+IdType=["']doi["']>([\s\S]*?)<\/ArticleId>/i);
  const doiText = doiMatch ? doiMatch[1].replace(/<[^>]+>/g, '').trim() : undefined;

  // Authors
  const authorMatches = xmlArticleBlock.match(/<Author[\s\S]*?<\/Author>/gi);
  let authorsList: string[] | undefined = undefined;
  if (authorMatches) {
    authorsList = authorMatches.map((aBlock) => {
      const lastName = (aBlock.match(/<LastName>([\s\S]*?)<\/LastName>/i) || [])[1] || '';
      const foreName = (aBlock.match(/<Initials>([\s\S]*?)<\/Initials>/i) || aBlock.match(/<ForeName>([\s\S]*?)<\/ForeName>/i) || [])[1] || '';
      return `${lastName} ${foreName}`.trim();
    }).filter(Boolean);
  }

  // MeSH Terms
  const meshMatches = xmlArticleBlock.match(/<DescriptorName[^>]*>([\s\S]*?)<\/DescriptorName>/gi);
  let meshList: string[] | undefined = undefined;
  if (meshMatches) {
    meshList = meshMatches.map((m) => m.replace(/<[^>]+>/g, '').trim());
  }

  return {
    pmid,
    title: cleanTitle,
    abstract: abstractText,
    authors: authorsList,
    publication_date: journalIssueDate || electronicPublicationDate,
    journal_issue_date: journalIssueDate,
    electronic_publication_date: electronicPublicationDate,
    first_publication_date: firstPublicationDate,
    publication_types: publicationTypes.length > 0 ? publicationTypes : undefined,
    journal: journalText,
    doi: doiText,
    mesh_terms: meshList,
  };
}
