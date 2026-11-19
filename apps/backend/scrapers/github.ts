import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";

const proxyUrl = process.env.PROXY_URL;
// Only use proxy if it's defined and not the dummy default localhost URL
const httpsAgent =
  proxyUrl && !proxyUrl.includes("127.0.0.1:7890") && proxyUrl.trim() !== ""
    ? new HttpsProxyAgent(proxyUrl)
    : undefined;

export interface GithubRepoMetadata {
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  topics: string[];
  starCount: number;
  forkCount: number;
  updatedAt: string;
  htmlUrl: string;
}

export async function scrapeGithub(rawUsername: string): Promise<GithubRepoMetadata[]> {
  if (!rawUsername || !rawUsername.trim()) return [];

  // Sanitize username: strip URLs, trailing slashes, leading @
  const cleanUsername = rawUsername
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "")
    .split("/")[0]
    ?.trim();

  if (!cleanUsername) return [];

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "HYRD-AI-Profile-Parser",
  };

  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_API_TOKEN;
  if (token && token.trim()) {
    headers["Authorization"] = `Bearer ${token.trim()}`;
  }

  try {
    const response = await axios.get(
      `https://api.github.com/users/${encodeURIComponent(cleanUsername)}/repos?sort=updated&per_page=15`,
      {
        headers,
        timeout: 8000,
        ...(httpsAgent ? { httpsAgent } : {}),
      }
    );

    if (!Array.isArray(response.data)) return [];

    return response.data.map((repo: any) => ({
      name: String(repo.name || ""),
      fullName: String(repo.full_name || ""),
      description: repo.description ? String(repo.description) : null,
      language: repo.language ? String(repo.language) : null,
      topics: Array.isArray(repo.topics) ? repo.topics.map(String) : [],
      starCount: typeof repo.stargazers_count === "number" ? repo.stargazers_count : 0,
      forkCount: typeof repo.forks_count === "number" ? repo.forks_count : 0,
      updatedAt: String(repo.updated_at || new Date().toISOString()),
      htmlUrl: String(repo.html_url || `https://github.com/${cleanUsername}/${repo.name}`),
    }));
  } catch (error: any) {
    const status = error.response?.status;
    if (status === 404) {
      console.warn(`[GitHub Scraper] User "${cleanUsername}" not found.`);
    } else if (status === 403) {
      console.warn(`[GitHub Scraper] GitHub API rate limit reached. Proceeding without external repo metrics.`);
    } else {
      console.warn(`[GitHub Scraper] Notice while fetching repos for "${cleanUsername}":`, error.message || error);
    }
    return [];
  }
}
