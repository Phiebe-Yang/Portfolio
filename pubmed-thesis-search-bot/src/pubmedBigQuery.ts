import crypto from 'node:crypto';
import { getLivePubMedSyncStatus, PubMedSyncStatus } from './canonicalPubMedGate';

/**
 * PubMed BigQuery Module
 * Queries PubMed data from Google BigQuery for QA purposes
 */

export function getPubMedDatasetInfo(): PubMedSyncStatus {
  return getLivePubMedSyncStatus(new Date().toISOString());
}

export interface PubMedArticle {
  pmid: string;
  title: string;
  abstract: string;
  authors?: string[];
  publication_date?: string;
  /** Date assigned to the journal issue/volume by PubMed. */
  journal_issue_date?: string;
  /** Date the article first became electronically available, when PubMed reports it. */
  electronic_publication_date?: string;
  /** Earliest verifiable public publication date; used for user-supplied date filters. */
  first_publication_date?: string;
  /** Canonical PubMed Publication Type values, e.g. Review or Randomized Controlled Trial. */
  publication_types?: string[];
  journal?: string;
  mesh_terms?: string[];
  relevance_score?: number;
  result_group?: 'best_match' | 'possibly_related';
  doi?: string;
}

export interface BigQueryResult {
  pmid: string;
  title: string;
  abstract: string;
  authors: string | null;
  pubdate: string | null;
  journal: string | null;
  mesh_headings: string | null;
}

export class PubMedBigQueryClient {
  private projectId: string;
  private clientEmail?: string;
  private privateKey?: string;
  private clientId?: string;
  private clientSecret?: string;
  private refreshToken?: string;
  private cachedAccessToken: string | null = null;
  private tokenExpiry: number = 0;

  private async executeQuery(sqlQuery: string, accessToken: string, maxResults: number): Promise<any> {
    const response = await fetch(
      `https://bigquery.googleapis.com/bigquery/v2/projects/${this.projectId}/queries`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          query: sqlQuery,
          useLegacySql: false,
          useQueryCache: true,
          timeoutMs: 20000,
          maxResults,
        }),
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`BigQuery API error (${response.status}): ${detail.slice(0, 500)}`);
    }

    let data = await response.json() as any;
    if (data.jobComplete === false && data.jobReference?.jobId) {
      const location = data.jobReference.location
        ? `&location=${encodeURIComponent(data.jobReference.location)}`
        : '';
      const resultResponse = await fetch(
        `https://bigquery.googleapis.com/bigquery/v2/projects/${this.projectId}/queries/${encodeURIComponent(data.jobReference.jobId)}?maxResults=${maxResults}&timeoutMs=15000${location}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!resultResponse.ok) {
        throw new Error(`BigQuery result polling failed (${resultResponse.status})`);
      }
      data = await resultResponse.json() as any;
    }

    if (data.jobComplete === false) {
      throw new Error('BigQuery query did not complete within the clinical response time budget.');
    }
    return data;
  }

  constructor(projectId: string, creds: { client_email?: string; private_key?: string; client_id?: string; client_secret?: string; refresh_token?: string } | string, privateKeyArg?: string) {
    this.projectId = projectId;
    
    if (typeof creds === 'string') {
      // Legacy signature: constructor(projectId, clientEmail, privateKey)
      this.clientEmail = creds;
      this.privateKey = privateKeyArg;
    } else {
      // Credentials object (Service Account or OAuth2 Refresh Token)
      this.clientEmail = creds.client_email;
      this.privateKey = creds.private_key;
      this.clientId = creds.client_id;
      this.clientSecret = creds.client_secret;
      this.refreshToken = creds.refresh_token;
    }
  }

  /**
   * Get or refresh access token
   */
  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    
    // Return cached token if still valid
    if (this.cachedAccessToken && now < this.tokenExpiry - 300) {
      return this.cachedAccessToken;
    }

    // Support Option A: OAuth2 Refresh Token
    if (this.refreshToken && this.clientId && this.clientSecret) {
      try {
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            refresh_token: this.refreshToken,
            grant_type: "refresh_token",
          }).toString(),
        });

        if (!tokenResponse.ok) {
          const errText = await tokenResponse.text();
          throw new Error(`Failed to refresh token (${tokenResponse.status}): ${errText}`);
        }

        const tokenData = await tokenResponse.json() as any;
        this.cachedAccessToken = tokenData.access_token;
        this.tokenExpiry = now + (tokenData.expires_in || 3600);
        return this.cachedAccessToken!;
      } catch (error) {
        console.error("Error obtaining access token via refresh_token:", error);
        throw error;
      }
    }

    // Support Option B: Service Account Private Key (RS256 JWT)
    if (this.clientEmail && this.privateKey) {
      const header = {
        alg: "RS256",
        typ: "JWT",
      };

      const payload = {
        iss: this.clientEmail,
        sub: this.clientEmail,
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
        scope: "https://www.googleapis.com/auth/bigquery",
      };

      const encodedHeader = Buffer.from(JSON.stringify(header)).toString("base64url");
      const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const unsignedToken = `${encodedHeader}.${encodedPayload}`;

      // Format private key if it contains escaped newlines
      const formattedPrivateKey = this.privateKey ? this.privateKey.replace(/\\n/g, '\n') : '';

      const signer = crypto.createSign("RSA-SHA256");
      signer.update(unsignedToken);
      const signature = signer.sign(formattedPrivateKey, "base64url");

      const jwt = `${unsignedToken}.${signature}`;

      try {
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
            assertion: jwt,
          }).toString(),
        });

        if (!tokenResponse.ok) {
          const errText = await tokenResponse.text();
          throw new Error(`Failed to get access token (${tokenResponse.status}): ${errText}`);
        }

        const tokenData = await tokenResponse.json() as any;
        this.cachedAccessToken = tokenData.access_token;
        this.tokenExpiry = now + (tokenData.expires_in || 3600);
        return this.cachedAccessToken!;
      } catch (error) {
        console.error("Error getting access token via Service Account JWT:", error);
        throw error;
      }
    }

    throw new Error("Invalid PubMed BigQuery credentials. Must provide either Service Account (client_email, private_key) or OAuth2 Refresh Token (client_id, client_secret, refresh_token).");
  }

  /**
   * Query PubMed articles from BigQuery using custom SQL or query string
   */
  async searchArticlesCustomSQL(
    sqlQuery: string,
    limit: number = 20
  ): Promise<PubMedArticle[]> {
    const accessToken = await this.getAccessToken();

    try {
      const data = await this.executeQuery(sqlQuery, accessToken, limit);
      return this.parseResults(data.rows || []);
    } catch (error) {
      console.error("BigQuery search error:", error);
      throw error;
    }
  }

  /**
   * Query PubMed articles from BigQuery based on search terms
   */
  async searchArticles(
    query: string,
    limit: number = 10
  ): Promise<PubMedArticle[]> {
    const sqlQuery = this.buildSearchQuery(query, limit);
    const accessToken = await this.getAccessToken();

    try {
      const data = await this.executeQuery(sqlQuery, accessToken, limit);
      const keywords = query.split(/\s+/).filter(w => w.length > 0);
      return this.parseResults(data.rows || [], keywords);
    } catch (error) {
      console.error("BigQuery search error:", error);
      throw error;
    }
  }

  /**
   * Get detailed information about a specific PubMed article
   */
  async getArticleDetails(pmid: string): Promise<PubMedArticle | null> {
    const sqlQuery = `
      SELECT
        pmid,
        title,
        abstract,
        authors,
        pubdate,
        journal,
        mesh_headings,
        doi
      FROM
        \`ncbi-bigquery.pubmed.baseline\`
      WHERE
        pmid = '${pmid}'
      LIMIT 1
    `;

    const accessToken = await this.getAccessToken();

    try {
      const data = await this.executeQuery(sqlQuery, accessToken, 1);
      const articles = this.parseResults(data.rows || []);
      return articles.length > 0 ? articles[0] : null;
    } catch (error) {
      console.error("Error fetching article details:", error);
      return null;
    }
  }

  /**
   * Build SQL query for searching PubMed articles
   */
  private buildSearchQuery(query: string, limit: number): string {
    // Escape single quotes in query
    const escapedQuery = query.replace(/'/g, "''");

    return `
      SELECT
        pmid,
        title,
        abstract,
        authors,
        pubdate,
        journal,
        mesh_headings,
        doi
      FROM
        \`ncbi-bigquery.pubmed.baseline\`
      WHERE
        LOWER(title) LIKE LOWER('%${escapedQuery}%')
        OR LOWER(abstract) LIKE LOWER('%${escapedQuery}%')
        OR LOWER(mesh_headings) LIKE LOWER('%${escapedQuery}%')
      ORDER BY pubdate DESC
      LIMIT ${limit}
    `;
  }

  /**
   * Parse BigQuery response into PubMedArticle objects with relevance calculation
   */
  private parseResults(rows: any[], queryKeywords?: string[]): PubMedArticle[] {
    const articles = rows
      .map((row) => {
        const values = row.f || [];
        const title = values[1]?.v || "";
        const abstract = values[2]?.v || "";
        const mesh_headings = values[6]?.v || "";
        const doiVal = values[7]?.v || undefined;

        // Calculate relevance score based on keyword match density
        let relevance_score = 75; // Base score for matches
        if (queryKeywords && queryKeywords.length > 0) {
          let matches = 0;
          const fullText = (title + " " + abstract + " " + mesh_headings).toLowerCase();
          queryKeywords.forEach(kw => {
            if (kw.length > 1 && fullText.includes(kw.toLowerCase())) {
              matches++;
            }
          });
          const matchRatio = matches / queryKeywords.length;
          relevance_score = Math.min(99, Math.round(70 + matchRatio * 28));
        }

        return {
          pmid: values[0]?.v ? String(values[0].v).trim() : "",
          title: title ? String(title).trim() : "",
          abstract: abstract ? String(abstract).trim() : "",
          authors: values[3]?.v
            ? values[3].v.split(";").map((a: string) => a.trim()).filter(Boolean)
            : undefined,
          publication_date: values[4]?.v ? String(values[4].v).trim() : undefined,
          journal: values[5]?.v ? String(values[5].v).trim() : undefined,
          mesh_terms: values[6]?.v
            ? values[6].v.split(";").map((t: string) => t.trim())
            : undefined,
          doi: doiVal ? String(doiVal).trim() : undefined,
          relevance_score: relevance_score,
        };
      })
      .filter((article) => article.pmid && article.title);

    return articles;
  }

  /**
   * Generate a summary response from articles
   */
  async generateSummaryResponse(
    articles: PubMedArticle[],
    question: string
  ): Promise<string> {
    if (articles.length === 0) {
      return `找不到與「${question}」相關的 PubMed 文章。`;
    }

    // Format articles for display
    const articleSummary = articles
      .slice(0, 5)
      .map(
        (article, index) =>
          `${index + 1}. **${article.title}** (PMID: ${article.pmid})
       作者: ${article.authors && article.authors.length > 0 ? article.authors.join(", ") : "未知"}
       期刊: ${article.journal || "未知"}
       發表日期: ${article.publication_date || "未知"}
       摘要: ${article.abstract?.substring(0, 200)}...`
      )
      .join("\n\n");

    return `基於 PubMed 數據庫的搜索結果，以下是與「${question}」相關的文章：\n\n${articleSummary}`;
  }
}
