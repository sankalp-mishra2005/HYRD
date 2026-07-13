import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";

const proxyUrl = process.env.PROXY_URL;
// Only use proxy if it's defined and not the dummy default localhost URL
const httpsAgent = proxyUrl && !proxyUrl.includes("127.0.0.1:7890") && proxyUrl.trim() !== "" 
    ? new HttpsProxyAgent(proxyUrl) 
    : undefined;

export async function scrapeGithub(username: string) {
    const userRepos = await axios.request({
        url: `https://api.github.com/users/${username}/repos`, 
        ...(httpsAgent ? { httpsAgent } : {})
    });
    return userRepos.data.map((x: any) => ({
        description: x.description,
        name: x.name,
        fullName: x.full_name,
        starCount: x.stargazers_count
    }))

}