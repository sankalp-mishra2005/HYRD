import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import axios from "axios";
import { BACKEND_URL } from "../../lib/config";
import { toast } from "sonner";
import {
  Loader2,
  ArrowRight,
  Briefcase,
  Building2,
  FileText,
  X,
  UploadCloud,
  Terminal,
  Github,
  Linkedin,
  HelpCircle,
  Code2,
  Layers,
  Users
} from "lucide-react";
import { Button } from "../ui/button";

export function HistoryView() {
  const navigate = useNavigate();
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [history, setHistory] = useState<any[]>([]);

  // Setup Form States
  const [role, setRole] = useState("Fullstack Engineer");
  const [company, setCompany] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("Mid-Level");
  const [duration, setDuration] = useState("30");
  const [difficulty, setDifficulty] = useState("Standard");
  const [language, setLanguage] = useState("English");
  const [interviewType, setInterviewType] = useState("Technical Interview");
  const [github, setGithub] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Quick preset chips
  const rolePresets = [
    "Fullstack Engineer",
    "Frontend Engineer",
    "Backend / Systems Engineer",
    "System Design",
    "DevOps Engineer",
  ];

  const companyPresets = ["Stripe", "Google", "Amazon", "Meta", "General Tech"];

  // Formats catalog with descriptions
  const interviewFormats = [
    {
      id: "Technical Interview",
      title: "Technical Round",
      icon: Code2,
      desc: "Combines core language internals, framework architecture, and applied problem solving.",
    },
    {
      id: "System Design",
      title: "System Design",
      icon: Layers,
      desc: "Tests distributed systems, database scaling, caching, message queues, and trade-offs.",
    },
    {
      id: "DSA Assessment",
      title: "Coding & DSA",
      icon: Terminal,
      desc: "Evaluates algorithms, data structure choices, and time/space complexity analysis.",
    },
    {
      id: "Behavioral / HR",
      title: "Behavioral (STAR)",
      icon: Users,
      desc: "Focuses on past leadership, cross-functional collaboration, and conflict resolution.",
    },
  ];

  // Load history and prefill user profile on mount
  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    try {
      const [historyResp, settingsResp] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/v1/interviews`, { withCredentials: true }),
        axios.get(`${BACKEND_URL}/api/v1/settings`, { withCredentials: true }).catch(() => ({ data: {} })),
      ]);

      setHistory(historyResp.data || []);

      if (settingsResp.data?.profile) {
        const p = settingsResp.data.profile;
        if (p.targetRole) setRole(p.targetRole);
        if (p.goalCompany) setCompany(p.goalCompany);
        if (p.githubUrl) setGithub(p.githubUrl);
        if (p.linkedinUrl) setLinkedin(p.linkedinUrl);
        if (p.experienceLevel) setExperienceLevel(p.experienceLevel);
      }
    } catch (err) {
      console.warn("Failed to load interview history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }

  // Launch interview
  async function handleStartInterview(e: React.FormEvent) {
    e.preventDefault();
    if (!role.trim()) {
      toast.error("Please specify a target role");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("role", role.trim());
      formData.append("company", company.trim() || "General");
      formData.append("experienceLevel", experienceLevel);
      formData.append("duration", duration);
      formData.append("jobDescription", jobDescription.trim());
      formData.append("difficulty", difficulty);
      formData.append("language", language);
      formData.append("interviewType", interviewType);
      formData.append("github", github.trim());
      formData.append("linkedinUrl", linkedin.trim());
      if (resumeFile) {
        formData.append("resume", resumeFile);
      }

      const response = await axios.post(`${BACKEND_URL}/api/v1/interviews/pre-interview`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        withCredentials: true,
      });

      toast.success("Interview session initialized");
      navigate(`/interview/${response.data.id}`);
    } catch (e: any) {
      console.error(e);
      const errMsg = e?.response?.data?.error || "Could not initialize interview session. Please try again.";
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto space-y-6 font-sans">
      
      {/* ─── HEADER BAR ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-white tracking-tight">Generate Your Practice Interview</h1>
            <span className="render-status-live">● Ready to generate</span>
          </div>
          <p className="text-xs text-zinc-400">
            Step 1 of 3: Start from a job description, your target role, or a company bar. Answer with voice or text with honest pacing.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ─── LEFT: SERVICE CONFIGURATION FORM (8 Cols) ─── */}
        <form
          onSubmit={handleStartInterview}
          className="lg:col-span-8 render-card p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="text-xs font-mono font-semibold text-zinc-300 uppercase tracking-wider">
              1. Choose Role & Questions
            </div>
            <span className="text-[11px] font-mono text-zinc-500">mode: audio or text</span>
          </div>

          {/* Role Section */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Briefcase className="size-3.5 text-zinc-400" />
                Target Engineering Role <span className="text-red-400">*</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-500">Required</span>
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Senior Frontend Engineer"
              className="w-full bg-black border border-zinc-800 rounded px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 font-sans"
            />
            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {rolePresets.map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => setRole(r)}
                  className={`text-[11px] px-2.5 py-1 rounded border transition-all cursor-pointer font-mono ${
                    role === r
                      ? "bg-zinc-800 text-white border-zinc-600"
                      : "bg-black text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Interview Format Selector */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
              <span>Interview Format & Evaluation Rubric</span>
              <span className="text-[10px] font-mono text-zinc-500">Determines Alex Morgan's questioning focus</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {interviewFormats.map((fmt) => {
                const Icon = fmt.icon;
                const isSelected = interviewType === fmt.id;
                return (
                  <div
                    key={fmt.id}
                    onClick={() => setInterviewType(fmt.id)}
                    className={`p-3 rounded border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-zinc-900 border-zinc-500 shadow-sm"
                        : "bg-black border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`size-3.5 ${isSelected ? "text-emerald-400" : "text-zinc-500"}`} />
                      <span className="text-xs font-semibold text-white">{fmt.title}</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                      {fmt.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Target Company (100% OPTIONAL) */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Building2 className="size-3.5 text-zinc-400" />
                Target Company <span className="text-zinc-500 font-normal">(Optional)</span>
              </span>
              <span className="text-[10px] font-mono text-zinc-500">Leave blank for universal tech standard</span>
            </label>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Stripe, Google, or leave empty for general tech bar"
              className="w-full bg-black border border-zinc-800 rounded px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {companyPresets.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCompany(c === "General Tech" ? "" : c)}
                  className={`text-[11px] px-2 py-0.5 rounded border transition-all cursor-pointer font-mono ${
                    company === c || (c === "General Tech" && !company)
                      ? "bg-zinc-800 text-white border-zinc-600"
                      : "bg-black text-zinc-400 border-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* GitHub & LinkedIn Context Integration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            
            {/* GitHub URL / Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Github className="size-3.5 text-zinc-400" />
                  GitHub Profile <span className="text-zinc-500 font-normal">(Optional)</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-400">Scrapes Repos</span>
              </label>
              <input
                type="text"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                placeholder="github.com/username or username"
                className="w-full bg-black border border-zinc-800 rounded px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
              />
              <p className="text-[10px] text-zinc-500">
                Pulls real public repositories so Alex Morgan asks about your actual code.
              </p>
            </div>

            {/* LinkedIn Profile */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Linkedin className="size-3.5 text-zinc-400" />
                  LinkedIn Profile <span className="text-zinc-500 font-normal">(Optional)</span>
                </span>
                <span className="text-[10px] font-mono text-zinc-500">Work Context</span>
              </label>
              <input
                type="text"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="linkedin.com/in/username"
                className="w-full bg-black border border-zinc-800 rounded px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
              />
              <p className="text-[10px] text-zinc-500">
                Fuses your professional background into the interview knowledge graph.
              </p>
            </div>

          </div>

          {/* Resume Upload Section (100% OPTIONAL) */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="size-3.5 text-zinc-400" />
                Resume / CV <span className="text-zinc-500 font-normal">(Optional — Never Mandatory)</span>
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">PDF, DOCX or TXT</span>
            </label>
            {resumeFile ? (
              <div className="flex items-center justify-between p-3 rounded bg-zinc-900/60 border border-zinc-800">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileText className="size-4 text-emerald-400 shrink-0" />
                  <span className="text-xs text-white truncate max-w-xs">{resumeFile.name}</span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    ({Math.round(resumeFile.size / 1024)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setResumeFile(null)}
                  className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-4 rounded border border-dashed border-zinc-800 hover:border-zinc-700 bg-black/40 hover:bg-zinc-900/20 cursor-pointer transition-colors group">
                <UploadCloud className="size-5 text-zinc-500 group-hover:text-zinc-300 transition-colors mb-1" />
                <span className="text-xs text-zinc-300 font-medium">Click to attach resume for project-specific questions</span>
                <span className="text-[10px] text-zinc-500 mt-0.5">Optional: Practice works perfectly with or without a resume file</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setResumeFile(e.target.files[0]);
                    }
                  }}
                />
              </label>
            )}
          </div>

          {/* Difficulty & Job Description */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-semibold text-zinc-300">Difficulty Calibration</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { val: "Friendly", label: "Friendly Practice", desc: "Supportive pace for initial warm-ups." },
                { val: "Standard", label: "Standard Technical", desc: "Realistic engineering follow-ups." },
                { val: "Challenging", label: "Deep-Dive", desc: "Edge cases and architectural trade-offs." },
              ].map((item) => (
                <div
                  key={item.val}
                  onClick={() => setDifficulty(item.val)}
                  className={`p-3 rounded border cursor-pointer transition-all ${
                    difficulty === item.val
                      ? "bg-zinc-900 border-zinc-500"
                      : "bg-black border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  <div className="font-semibold text-xs text-white">{item.label}</div>
                  <div className="text-[10px] text-zinc-400 mt-1 leading-relaxed">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Optional Job Description */}
          <div className="space-y-2 pt-1">
            <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
              <span>Job Description / Key Topics (Optional)</span>
              <span className="text-[10px] text-zinc-500 font-mono">Tailors questions to specific stack</span>
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste specific job requirements or tech stack topics (e.g. Next.js, Redis, distributed systems)..."
              rows={2}
              className="w-full bg-black border border-zinc-800 rounded p-3 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* Submit CTA */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-10 bg-white hover:bg-zinc-200 text-black font-semibold text-xs rounded flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin text-black" />
                  <span>Fusing Context & Provisioning Session...</span>
                </>
              ) : (
                <>
                  <span>Deploy Interview Session</span>
                  <ArrowRight className="size-3.5 text-black" />
                </>
              )}
            </Button>
          </div>
        </form>

        {/* ─── RIGHT: SPEC OVERVIEW & DEPLOYMENT LOGS (4 Cols) ─── */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Active Spec Summary Card */}
          <div className="render-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <span className="text-xs font-mono font-semibold text-zinc-300 uppercase tracking-wider">
                Deployment Spec
              </span>
              <span className="render-status-live">✓ Ready</span>
            </div>

            <div className="space-y-2.5 text-xs font-mono">
              <div className="flex justify-between items-center text-zinc-400">
                <span>role</span>
                <span className="text-white font-sans font-medium">{role || "General"}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>company</span>
                <span className="text-white font-sans font-medium">{company || "General Tech Standard"}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>format</span>
                <span className="text-white font-sans font-medium">{interviewType}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>difficulty</span>
                <span className="text-white font-sans font-medium">{difficulty}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>github</span>
                <span className="text-zinc-300 truncate max-w-[140px]">
                  {github ? github.replace(/^https?:\/\/(www\.)?github\.com\//i, "") : "none"}
                </span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>linkedin</span>
                <span className="text-zinc-300 truncate max-w-[140px]">
                  {linkedin ? "connected" : "none"}
                </span>
              </div>
              <div className="flex justify-between items-center text-zinc-400">
                <span>resume</span>
                <span className="text-zinc-300 truncate max-w-[140px]">
                  {resumeFile ? resumeFile.name : "none (general profile)"}
                </span>
              </div>
            </div>

            <div className="p-3 rounded bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed font-sans">
              💡 Alex Morgan operates as a realistic technical interviewer. Questions adapt dynamically based on your spoken replies, repositories, and stack.
            </div>
          </div>

          {/* Past Practice Runs (Render Deployment History) */}
          <div className="render-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-zinc-300 uppercase tracking-wider">
                <Terminal className="size-3.5 text-zinc-400" />
                <span>Session Runs</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">{history.length} completed</span>
            </div>

            {loadingHistory ? (
              <div className="py-6 text-center">
                <Loader2 className="size-4 animate-spin text-zinc-500 mx-auto" />
              </div>
            ) : history.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {history.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(`/result/${item.id}`)}
                    className="p-3 rounded bg-black hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors cursor-pointer space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-medium text-white truncate max-w-[180px]">
                        {item.role}
                      </h4>
                      {item.score !== null && item.score !== undefined && (
                        <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                          {item.score}%
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                      <span>{item.company || "General"}</span>
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500 py-3 text-center">
                No past sessions yet. Deploy your first session above!
              </p>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
