import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import axios from "axios";
import { BACKEND_URL } from "../../lib/config";
import { authClient } from "../../lib/auth";
import { 
  Play, 
  ArrowRight, 
  Terminal, 
  FileCode, 
  ShieldCheck, 
  Activity, 
  CheckCircle2, 
  Clock, 
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { Button } from "../ui/button";

export function DashboardView() {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  const [latestInterview, setLatestInterview] = useState<any>(null);
  const [pastSessions, setPastSessions] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [atsCount, setAtsCount] = useState<number>(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      const [interviewsResp, settingsResp, atsResp] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/v1/interviews`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/v1/settings`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/v1/ats`, { withCredentials: true }).catch(() => ({ data: [] })),
      ]);

      setPastSessions(interviewsResp.data || []);
      const completed = (interviewsResp.data || []).filter((i: any) => i.status === "Done");
      if (completed.length > 0) {
        setLatestInterview(completed[0]);
      }
      if (settingsResp.data?.profile) {
        setProfile(settingsResp.data.profile);
      }
      setAtsCount((atsResp.data || []).length);
    } catch (e: any) {
      if (e?.response?.status !== 401) {
        console.warn("Dashboard data fetch:", e?.message);
      }
    }
  }

  const name = session?.user?.name || "Developer";
  const targetRole = latestInterview?.role || profile?.targetRole || "Software Engineer";
  const targetCompany = latestInterview?.company || profile?.goalCompany || "Stripe";

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto space-y-10 py-4 antialiased">
      
      {/* ─── RENDER HERO SECTION ─── */}
      <div className="space-y-4 pt-2">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          HYRD v1.1 Production Environment
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.15] max-w-3xl">
          Your fastest path to placement with mock interviews & ATS intelligence
        </h1>

        <p className="text-sm sm:text-base text-zinc-400 max-w-2xl leading-relaxed">
          Intuitive infrastructure to practice realistic mock technical voice rounds and audit your resume against target job descriptions with deterministic scoring.
        </p>

        {/* Action Buttons (Render signature high-contrast CTAs) */}
        <div className="flex items-center gap-3 pt-2 flex-wrap">
          <Link to="/workspace/interviews">
            <button className="render-btn-primary">
              <Play className="size-3.5 fill-black" />
              Start practice interview &gt;
            </button>
          </Link>
          <Link to="/workspace/ats">
            <button className="render-btn-secondary">
              <FileCode className="size-3.5 text-zinc-400" />
              Run ATS Resume Check
            </button>
          </Link>
        </div>
      </div>

      {/* ─── RENDER SERVICES / PIPELINES GRID ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
            Services & Infrastructure
          </span>
          <span className="text-[11px] font-mono text-zinc-400">2 Active Pipelines</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Service 1: AI Mock Interview Engine */}
          <div 
            onClick={() => navigate("/workspace/interviews")}
            className="render-card p-5 space-y-4 cursor-pointer hover:border-zinc-700 transition-colors group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
                  <Terminal className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-zinc-200 flex items-center gap-1.5">
                    interview-voice-service
                    <ExternalLink className="size-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <span className="text-[11px] font-mono text-zinc-500">Real-time WebSocket • Gemini Live</span>
                </div>
              </div>
              <span className="render-status-live">
                ✓ Live
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Adaptive technical, system design, and behavioral questions tailored for <span className="text-zinc-200 font-mono">{targetRole}</span> at <span className="text-zinc-200 font-mono">{targetCompany}</span>.
            </p>

            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span>Sessions: {pastSessions.length} total</span>
              <span className="text-zinc-400 group-hover:text-white flex items-center gap-1 font-sans text-xs">
                Launch &rarr;
              </span>
            </div>
          </div>

          {/* Service 2: Resume ATS Intelligence & JD Matcher */}
          <div 
            onClick={() => navigate("/workspace/ats")}
            className="render-card p-5 space-y-4 cursor-pointer hover:border-zinc-700 transition-colors group"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="size-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
                  <FileCode className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-zinc-200 flex items-center gap-1.5">
                    ats-matcher-engine
                    <ExternalLink className="size-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <span className="text-[11px] font-mono text-zinc-500">Parser • PDF/DOCX/TXT Multi-format</span>
                </div>
              </div>
              <span className="render-status-live">
                ✓ Live
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Deterministic 6-category scoring ($30+20+20+15+10+5$), exact & related keyword evidence citations, and STAR bullet point rewrites.
            </p>

            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span>Audits: {atsCount} saved</span>
              <span className="text-zinc-400 group-hover:text-white flex items-center gap-1 font-sans text-xs">
                Audit Resume &rarr;
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* ─── RENDER RECENT DEPLOYMENTS / SESSIONS TABLE ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-semibold">
            Recent Practice Deployments & Audits
          </span>
          <Link to="/workspace/interviews" className="text-xs text-zinc-400 hover:text-white flex items-center gap-1">
            View all &rarr;
          </Link>
        </div>

        <div className="render-card overflow-hidden">
          {pastSessions.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <p className="text-xs font-mono text-zinc-500">No mock interview sessions recorded yet.</p>
              <Link to="/workspace/interviews">
                <button className="render-btn-primary mt-2">
                  Launch First Mock Interview
                </button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 text-[11px]">
                    <th className="py-2.5 px-4 font-medium">Session ID / Role</th>
                    <th className="py-2.5 px-4 font-medium">Target Company</th>
                    <th className="py-2.5 px-4 font-medium">Type</th>
                    <th className="py-2.5 px-4 font-medium">Score</th>
                    <th className="py-2.5 px-4 font-medium">Status</th>
                    <th className="py-2.5 px-4 font-medium text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-sans">
                  {pastSessions.slice(0, 5).map((session) => (
                    <tr 
                      key={session.id}
                      onClick={() => navigate(session.status === "Done" ? `/result/${session.id}` : `/interview/${session.id}`)}
                      className="hover:bg-zinc-900/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-white truncate max-w-[200px]">
                          {session.role || "Software Engineer"}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-500 truncate max-w-[120px]">
                          id-{session.id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-300 font-mono text-xs">
                        {session.company || "General"}
                      </td>
                      <td className="py-3 px-4 text-zinc-400 text-xs">
                        {session.interviewType || "Technical"}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        {session.score !== null ? (
                          <span className={session.score >= 75 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                            {session.score}%
                          </span>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {session.status === "Done" ? (
                          <span className="render-status-live">
                            ✓ Evaluated
                          </span>
                        ) : (
                          <span className="render-status-deploying">
                            In Progress
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[11px] text-zinc-500">
                        {new Date(session.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
