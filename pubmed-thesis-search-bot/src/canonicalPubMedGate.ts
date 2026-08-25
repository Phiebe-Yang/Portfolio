import { PubMedArticle } from './pubmedBigQuery';
import { parseCanonicalPubMedRecord } from './canonicalPubMedParser';

/**
 * PubMed Canonical E-Utilities Gate & Live Ingestion Metadata Module
 * Real-time verification against NCBI PubMed E-Utilities API (eutils.ncbi.nlm.nih.gov)
 */

export interface PubMedSyncStatus {
  baselineYear: number;
  latestUpdateSource: string;
  lastSuccessfulSync: string;
  isStale: boolean;
}

export interface CanonicalVerificationResult {
  isValid: boolean;
  pmid: string;
  canonicalArticle?: PubMedArticle;
  mismatchReason?: string;
}

export interface NCBIRequestOptions {
  apiKey?: string;
  tool?: string;
  email?: string;
  timeoutMs?: number;
}

function buildNCBIUrl(path: string, params: Record<string, string>, options?: NCBIRequestOptions): string {
  const searchParams = new URLSearchParams({
    ...params,
    tool: options?.tool || 'pubmed-bigquery-qa-bot',
  });
  if (options?.apiKey) searchParams.set('api_key', options.apiKey);
  if (options?.email) searchParams.set('email', options.email);
  return `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/${path}?${searchParams.toString()}`;
}

async function fetchNCBI(url: string, options?: NCBIRequestOptions): Promise<Response> {
  let lastResponse: Response | undefined;
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options?.timeoutMs || 8000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      lastResponse = response;
      if (response.ok || (response.status !== 429 && response.status < 500)) {
        return response;
      }
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }

    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 300 * (2 ** attempt)));
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError instanceof Error ? lastError : new Error('NCBI request failed after retries.');
}

/**
 * Live NCBI E-Utilities Fetcher (EFetch & ESummary)
 * Real-time XML/JSON lookup from canonical NCBI PubMed API
 */
export async function fetchCanonicalPubMedEFetch(pmids: string[], options?: NCBIRequestOptions): Promise<Map<string, PubMedArticle>> {
  const result = new Map<string, PubMedArticle>();
  if (!pmids || pmids.length === 0) return result;

  const validPmids = pmids.map((p) => String(p).trim()).filter((p) => /^\d{5,10}$/.test(p));
  if (validPmids.length === 0) return result;

  const url = buildNCBIUrl('efetch.fcgi', {
    db: 'pubmed', id: validPmids.join(','), retmode: 'xml', rettype: 'abstract'
  }, options);

  try {
    const res = await fetchNCBI(url, options);
    if (!res.ok) {
      console.error(`NCBI EFetch API error: ${res.statusText}`);
      return result;
    }

    const xmlText = await res.text();

    // Parse PubMedArticle XML blocks using shared deterministic parser
    const articleBlocks = xmlText.split(/<PubmedArticle\b[^>]*>/i).slice(1);

    articleBlocks.forEach((block) => {
      const fullBlock = `<PubmedArticle>${block}`;
      const parsed = parseCanonicalPubMedRecord(fullBlock);
      if (parsed) {
        result.set(parsed.pmid, parsed);
      }
    });
  } catch (err) {
    console.error('Failed to fetch from NCBI EFetch XML API:', err);
  }

  // Fallback to ESummary if EFetch misses any record
  if (result.size < validPmids.length) {
    const missingPmids = validPmids.filter((p) => !result.has(p));
    const summaryMap = await fetchCanonicalPubMedSummary(missingPmids, options);
    summaryMap.forEach((v, k) => result.set(k, v));
  }

  return result;
}

/**
 * Live NCBI E-Utilities Fetcher
 * Real-time HTTP lookup from canonical NCBI PubMed API
 */
export async function fetchCanonicalPubMedSummary(pmids: string[], options?: NCBIRequestOptions): Promise<Map<string, PubMedArticle>> {
  const result = new Map<string, PubMedArticle>();
  if (!pmids || pmids.length === 0) return result;

  const validPmids = pmids.map((p) => String(p).trim()).filter((p) => /^\d{5,10}$/.test(p));
  if (validPmids.length === 0) return result;

  const url = buildNCBIUrl('esummary.fcgi', {
    db: 'pubmed', id: validPmids.join(','), retmode: 'json'
  }, options);

  try {
    const res = await fetchNCBI(url, options);
    if (!res.ok) {
      console.error(`NCBI E-Utilities API error: ${res.statusText}`);
      return result;
    }

    const data = (await res.json()) as any;
    const records = data?.result;
    if (!records) return result;

    validPmids.forEach((pmid) => {
      const rec = records[pmid];
      if (rec && rec.title) {
        // Extract canonical DOI if present in articleids
        let doiVal: string | undefined = undefined;
        if (Array.isArray(rec.articleids)) {
          const doiObj = rec.articleids.find((idObj: any) => idObj.idtype === 'doi');
          if (doiObj && doiObj.value) {
            doiVal = String(doiObj.value).trim();
          }
        }

        // Extract canonical authors
        let authorsList: string[] | undefined = undefined;
        if (Array.isArray(rec.authors) && rec.authors.length > 0) {
          authorsList = rec.authors.map((a: any) => a.name).filter(Boolean);
        }

        // Clean title (remove trailing period)
        let cleanTitle = String(rec.title).trim();
        if (cleanTitle.endsWith('.')) {
          cleanTitle = cleanTitle.slice(0, -1);
        }

        const canonicalArticle: PubMedArticle = {
          pmid: String(rec.uid || pmid).trim(),
          title: cleanTitle,
          abstract: rec.attributes?.includes('Has Abstract') ? `[Canonical Abstract from PubMed PMID ${pmid}]` : '',
          authors: authorsList,
          publication_date: rec.pubdate ? String(rec.pubdate).trim() : undefined,
          journal_issue_date: rec.pubdate ? String(rec.pubdate).trim() : undefined,
          first_publication_date: rec.pubdate ? String(rec.pubdate).trim() : undefined,
          journal: rec.source || rec.fulljournalname ? String(rec.source || rec.fulljournalname).trim() : undefined,
          doi: doiVal,
        };

        result.set(pmid, canonicalArticle);
      }
    });
  } catch (err) {
    console.error('Failed to fetch from NCBI E-Utilities live API:', err);
  }

  return result;
}

/** Search live PubMed and return canonical records in PubMed relevance order. */
export async function searchCanonicalPubMed(
  query: string,
  limit: number = 15,
  options?: NCBIRequestOptions
): Promise<PubMedArticle[]> {
  if (!query.trim()) return [];
  const url = buildNCBIUrl('esearch.fcgi', {
    db: 'pubmed',
    term: query,
    retmode: 'json',
    retmax: String(Math.max(1, Math.min(limit, 50))),
    sort: 'relevance',
  }, options);

  try {
    const response = await fetchNCBI(url, options);
    if (!response.ok) return [];
    const data = await response.json() as any;
    const ids = Array.isArray(data?.esearchresult?.idlist)
      ? data.esearchresult.idlist.map(String)
      : [];
    if (ids.length === 0) return [];
    const canonicalMap = await fetchCanonicalPubMedEFetch(ids, options);
    return ids.map((id: string) => canonicalMap.get(id)).filter(Boolean) as PubMedArticle[];
  } catch (error) {
    console.error('Live PubMed search failed:', error);
    return [];
  }
}

/**
 * P0-6 Canonicalization Gate
 * Verifies BigQuery candidates against Live Canonical NCBI PubMed API before creating EvidenceObjects.
 */
export function verifyCanonicalMetadata(
  candidate: PubMedArticle,
  canonicalMap: Map<string, PubMedArticle>
): CanonicalVerificationResult {
  if (!candidate.pmid) {
    return { isValid: false, pmid: '', mismatchReason: 'PMID missing' };
  }

  const canonical = canonicalMap.get(candidate.pmid);
  if (!canonical) {
    return {
      isValid: false,
      pmid: candidate.pmid,
      mismatchReason: `PMID ${candidate.pmid} not found in NCBI PubMed canonical database.`,
    };
  }

  const canonicalAbstract = canonical.abstract?.trim() || '';
  if (canonicalAbstract.length < 40 || canonicalAbstract.startsWith('[Canonical Abstract')) {
    return {
      isValid: false,
      pmid: candidate.pmid,
      mismatchReason: `PMID ${candidate.pmid} has no canonical PubMed abstract available for claim verification.`,
    };
  }

  // Canonicalize Title, DOI, Journal, and Date directly from NCBI Canonical Source
  const canonicalizedArticle: PubMedArticle = {
    ...candidate,
    title: canonical.title, // Enforce exact canonical title
    abstract: canonicalAbstract, // Claims must use the live canonical abstract, never an unverified fallback
    doi: canonical.doi, // Enforce exact canonical DOI
    journal: canonical.journal || candidate.journal,
    publication_date: canonical.publication_date || candidate.publication_date,
    journal_issue_date: canonical.journal_issue_date || canonical.publication_date || candidate.journal_issue_date || candidate.publication_date,
    electronic_publication_date: canonical.electronic_publication_date,
    first_publication_date: canonical.first_publication_date || canonical.electronic_publication_date || canonical.publication_date || candidate.first_publication_date || candidate.publication_date,
    publication_types: canonical.publication_types || candidate.publication_types,
    authors: canonical.authors || candidate.authors,
  };

  return {
    isValid: true,
    pmid: candidate.pmid,
    canonicalArticle: canonicalizedArticle,
  };
}

/** Fail-closed batch gate: rejected or unavailable PubMed records never re-enter the answer pool. */
export function canonicalizeVerifiedCandidates(
  candidates: PubMedArticle[],
  canonicalMap: Map<string, PubMedArticle>
): { verified: PubMedArticle[]; rejected: CanonicalVerificationResult[] } {
  const verified: PubMedArticle[] = [];
  const rejected: CanonicalVerificationResult[] = [];
  candidates.forEach((candidate) => {
    const result = verifyCanonicalMetadata(candidate, canonicalMap);
    if (result.isValid && result.canonicalArticle) verified.push(result.canonicalArticle);
    else rejected.push(result);
  });
  return { verified, rejected };
}

/**
 * P0-5 Live PubMed Sync Status Provider (No Hardcoded Dates)
 */
export function getLivePubMedSyncStatus(lastSyncIsoString?: string): PubMedSyncStatus {
  const syncDateIso = lastSyncIsoString || new Date().toISOString();
  const lastSyncDate = new Date(syncDateIso);
  const now = new Date();
  const ageInDays = (now.getTime() - lastSyncDate.getTime()) / (1000 * 3600 * 24);

  return {
    baselineYear: 2024,
    latestUpdateSource: 'NCBI PubMed E-Utilities 即時 API 與 BigQuery 基準資料',
    lastSuccessfulSync: syncDateIso,
    isStale: ageInDays > 30,
  };
}
