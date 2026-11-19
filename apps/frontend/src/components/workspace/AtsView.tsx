import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import axios from "axios";
import { BACKEND_URL } from "../../lib/config";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Printer,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Briefcase,
  Building2,
  Search,
  ListFilter,
  PlusCircle,
  Clock,
  Loader2,
  Wand2,
  Terminal,
} from "lucide-react";
import { Button } from "../ui/button";

interface AtsAnalysisRecord {
  id: string;
  resumeFileName: string;
  jobTitle: string | null;
  companyName: string | null;
  jobDescriptionText: string;
  overallScore: number;
  scoreBreakdown: {
    skillsMatch: number;
    requiredKeywords: number;
    experienceRelevance: number;
    projectRelevance: number;
    educationAlignment: number;
    structureReadability: number;
  };
  keywordMatches: {
    matchedExact: string[];
    matchedRelated: string[];
    missingRequired: string[];
    missingPreferred: string[];
    evidenceList: Array<{
      keyword: string;
      category: string;
      matched: boolean;
      matchType: string;
      evidenceQuote: string | null;
    }>;
  };
  compatibilityChecks: {
    standardHeadings: { area: string; passed: boolean; finding: string; details: string };
    contactVisibility: { area: string; passed: boolean; finding: string; details: string };
    formatConsistency: { area: string; passed: boolean; finding: string; details: string };
    dateConsistency: { area: string; passed: boolean; finding: string; details: string };
    bulletQuality: { area: string; passed: boolean; finding: string; details: string };
    excessiveFormatting: { area: string; passed: boolean; finding: string; details: string };
    unclearAbbreviations: { area: string; passed: boolean; finding: string; details: string };
    missingSections: string[];
    keywordStuffingWarnings: string[];
  };
  recommendations: Array<{
    id: string;
    title: string;
    issue: string;
    whyItMatters: string;
    howToImprove: string;
    sectionLocation: string;
    priority: "High" | "Medium" | "Low";
  }>;
  improvements?: {
    bulletPoints: Array<{
      original: string;
      improved: string;
      reason: string;
      contextRoleOrProject: string;
    }>;
    projectDescriptions: Array<{
      projectName: string;
      originalSummary: string;
      improvedSummary: string;
      recommendedTechHighlights: string[];
    }>;
    impactSuggestions: Array<{
      section: string;
      prompt: string;
      exampleMetric: string;
    }>;
  };
  createdAt: string;
}

export function AtsView() {
  const { analysisId } = useParams();
  const navigate = useNavigate();

  // State
  const [history, setHistory] = useState<AtsAnalysisRecord[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AtsAnalysisRecord | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  // Form Inputs
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [companyName, setCompanyName] = useState("");

  // View Controls
  const [activeTab, setActiveTab] = useState<"keywords" | "diagnostics" | "recommendations" | "improve">("keywords");
  const [priorityFilter, setPriorityFilter] = useState<"All" | "High" | "Medium" | "Low">("All");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  // Handle URL parameter for specific analysis
  useEffect(() => {
    if (analysisId && history.length > 0) {
      const match = history.find((h) => h.id === analysisId);
      if (match) {
        setSelectedAnalysis(match);
      }
    }
  }, [analysisId, history]);

  async function loadHistory() {
    try {
      setLoadingHistory(true);
      const res = await axios.get(`${BACKEND_URL}/api/v1/ats`, { withCredentials: true });
      setHistory(res.data);
      if (analysisId) {
        const found = res.data.find((item: AtsAnalysisRecord) => item.id === analysisId);
        if (found) setSelectedAnalysis(found);
      }
    } catch (err) {
      console.warn("Failed to load ATS history:", err);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleRunAnalysis(e: React.FormEvent) {
    e.preventDefault();

    if (!resumeFile) {
      toast.error("Please upload a resume file (PDF, DOCX, or TXT).");
      return;
    }

    setAnalyzing(true);
    const toastId = toast.loading(
      jobDescription.trim()
        ? "Matching resume against Job Description keywords..."
        : "Running general ATS resume format & compatibility audit..."
    );

    try {
      const formData = new FormData();
      formData.append("resume", resumeFile);
      formData.append("jdText", jobDescription.trim());
      formData.append("jobDescription", jobDescription.trim());
      if (jobTitle.trim()) {
        formData.append("jobTitle", jobTitle.trim());
        formData.append("role", jobTitle.trim());
      }
      if (companyName.trim()) {
        formData.append("company", companyName.trim());
      }

      const res = await axios.post(`${BACKEND_URL}/api/v1/ats/analyze`, formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("ATS Analysis completed successfully!", { id: toastId });
      setSelectedAnalysis(res.data);
      setHistory((prev) => [res.data, ...prev.filter((p) => p.id !== res.data.id)]);
      navigate(`/workspace/ats/${res.data.id}`, { replace: true });
    } catch (err: any) {
      const msg = err.response?.data?.error || "Analysis failed. Please check your file and try again.";
      toast.error(msg, { id: toastId });
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleDeleteAnalysis(id: string) {
    try {
      await axios.delete(`${BACKEND_URL}/api/v1/ats/${id}`, { withCredentials: true });
      toast.success("Analysis deleted");
      setHistory((prev) => prev.filter((item) => item.id !== id));
      if (selectedAnalysis?.id === id) {
        setSelectedAnalysis(null);
        navigate("/workspace/ats", { replace: true });
      }
    } catch (err) {
      toast.error("Failed to delete analysis");
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedText(null), 2000);
  }

  // Score styling helpers
  function getScoreColor(score: number) {
    if (score >= 80) return "text-emerald-400";
    if (score >= 60) return "text-amber-400";
    return "text-rose-400";
  }

  function getScoreBadge(score: number) {
    if (score >= 80) return "render-status-live";
    if (score >= 60) return "render-status-deploying";
    return "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-rose-500/10 text-rose-400 border border-rose-500/25";
  }

  function getScoreLabel(score: number) {
    if (score >= 80) return "ATS Optimized • 80%+ Match";
    if (score >= 60) return "Moderate Fit • Gaps Detected";
    return "Action Needed • Critical Missing Requirements";
  }

  return (
    <div className="flex flex-col w-full max-w-6xl mx-auto space-y-8 pb-16 antialiased print:p-0 print:m-0">
      
      {/* ─── RENDER TOP HEADER & BREADCRUMB ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5 print:hidden">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-400 mb-2">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            ats-matcher-pipeline
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Resume ATS Checker & Job Description Matcher
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Recruiter compatibility analysis, keyword coverage audit, and deterministic scoring.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {selectedAnalysis && (
            <>
              <button
                onClick={() => {
                  setSelectedAnalysis(null);
                  navigate("/workspace/ats");
                }}
                className="render-btn-secondary"
              >
                <PlusCircle className="size-3.5" />
                New Audit
              </button>
              <button
                onClick={() => window.print()}
                className="render-btn-primary"
              >
                <Printer className="size-3.5" />
                Export Report
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Two-Column Layout (Form / Results + History Drawer) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Form OR Results (8 or 9 cols) */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-6">
          {!selectedAnalysis ? (
            /* ─── RENDER INPUT / UPLOAD VIEW ─── */
            <div className="render-card p-6 sm:p-7 space-y-6">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-white">Create New ATS Audit</h2>
                <p className="text-xs text-zinc-400">
                  Upload candidate resume in PDF, Word (.docx), or plain text, and paste the target job description.
                </p>
              </div>

              <form onSubmit={handleRunAnalysis} className="space-y-5">
                
                {/* 1. Resume File Upload */}
                <div className="space-y-2.5">
                  <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <FileText className="size-3.5 text-zinc-300" />
                      1. Resume File (PDF, DOCX, TXT) <span className="text-red-400">*</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 font-normal">Direct Upload</span>
                  </label>

                  {/* Clean Full-Width Dropzone */}
                  <div
                    className={`border border-dashed rounded-md p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
                      resumeFile
                        ? "border-emerald-500/60 bg-emerald-950/10"
                        : "border-zinc-700 hover:border-zinc-500 bg-zinc-950/80"
                    }`}
                    onClick={() => document.getElementById("ats-resume-upload")?.click()}
                  >
                    <input
                      id="ats-resume-upload"
                      type="file"
                      accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setResumeFile(file);
                        }
                      }}
                    />
                    <UploadCloud className={`size-6 mb-2 ${resumeFile ? "text-emerald-400" : "text-zinc-400"}`} />
                    {resumeFile ? (
                      <div className="space-y-1">
                        <p className="text-xs font-mono font-semibold text-emerald-300 truncate max-w-md">{resumeFile.name}</p>
                        <p className="text-[10px] font-mono text-zinc-500">{(resumeFile.size / 1024).toFixed(1)} KB • Ready to parse</p>
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setResumeFile(null);
                          }}
                          className="text-[10px] text-rose-400 hover:underline pt-1 cursor-pointer"
                        >
                          Remove and upload different file
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-zinc-300">Click to upload or drag resume file here</p>
                        <p className="text-[10px] font-mono text-zinc-500">Supports PDF, Word (.docx), or plain text (.txt) up to 10MB</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Target Role & Company (Optional) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono text-zinc-400 font-semibold flex items-center gap-1.5">
                      <Briefcase className="size-3.5 text-zinc-500" />
                      Target Job Title (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Senior Software Engineer"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono text-zinc-400 font-semibold flex items-center gap-1.5">
                      <Building2 className="size-3.5 text-zinc-500" />
                      Target Company Name (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Stripe, Google, Linear"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors font-mono"
                    />
                  </div>
                </div>

                {/* 3. Job Description Textarea (Optional) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1.5">
                      <Search className="size-3.5 text-zinc-500" />
                      2. Target Job Description (Optional — leave empty for general ATS audit)
                    </label>
                    <span className="text-[10px] font-mono text-zinc-500">{jobDescription.length} characters</span>
                  </div>
                  <textarea
                    rows={6}
                    placeholder="Paste target job description to match specific keywords, or leave empty for a general ATS format, readability, and section audit..."
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md p-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors leading-relaxed font-mono"
                  />
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={analyzing}
                  className="w-full render-btn-primary justify-center h-10 text-xs font-semibold"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Parsing & Evaluating ATS Compatibility...
                    </>
                  ) : (
                    <>
                      <Terminal className="size-3.5" />
                      {jobDescription.trim() ? "Execute ATS & Job Description Match" : "Run General ATS Resume Audit"}
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* ─── RENDER RESULTS DASHBOARD ─── */
            <div className="space-y-6">
              
              {/* Header Overview Card */}
              <div className="render-card p-6 space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
                  
                  {/* Left: Metadata */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className={getScoreBadge(selectedAnalysis.overallScore)}>
                        {selectedAnalysis.overallScore >= 80 ? "✓" : "•"} {selectedAnalysis.overallScore}/100 Match Score
                      </span>
                      <span className="text-zinc-500 text-xs font-mono">id-{selectedAnalysis.id.slice(0, 8)}</span>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      {selectedAnalysis.jobTitle || "Software Engineer"} {selectedAnalysis.companyName ? `at ${selectedAnalysis.companyName}` : ""}
                    </h2>

                    <p className="text-xs font-mono text-zinc-400 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1 text-zinc-300">
                        <FileText className="size-3 text-zinc-500" />
                        {selectedAnalysis.resumeFileName}
                      </span>
                      <span>•</span>
                      <span>{new Date(selectedAnalysis.createdAt).toLocaleDateString()}</span>
                    </p>
                  </div>

                  {/* Right: Score Gauge */}
                  <div className="bg-zinc-950 border border-zinc-800 rounded-md p-4 flex flex-col items-center justify-center min-w-[170px]">
                    <div className="flex items-baseline gap-1">
                      <span className={`text-3xl font-extrabold font-mono ${getScoreColor(selectedAnalysis.overallScore)}`}>
                        {selectedAnalysis.overallScore}
                      </span>
                      <span className="text-xs font-mono text-zinc-500">/ 100</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400 text-center mt-1">
                      {getScoreLabel(selectedAnalysis.overallScore)}
                    </span>
                  </div>
                </div>

                {/* 6 Category Breakdown Progress Bars */}
                <div className="pt-4 border-t border-zinc-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
                  
                  <div className="bg-zinc-950 border border-zinc-800/80 rounded p-2.5 space-y-1.5">
                    <div className="flex justify-between text-[10px] text-zinc-400">
                      <span>Skills</span>
                      <span className="text-white font-bold">{selectedAnalysis.scoreBreakdown.skillsMatch}/30</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
                      <div className="bg-emerald-400 h-1 rounded-full" style={{ width: `${(selectedAnalysis.scoreBreakdown.skillsMatch / 30) * 100}%` }} />
                    </div>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-800/80 rounded p-2.5 space-y-1.5">
                    <div className="flex justify-between text-[10px] text-zinc-400">
                      <span>Keywords</span>
                      <span className="text-white font-bold">{selectedAnalysis.scoreBreakdown.requiredKeywords}/20</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
                      <div className="bg-emerald-400 h-1 rounded-full" style={{ width: `${(selectedAnalysis.scoreBreakdown.requiredKeywords / 20) * 100}%` }} />
                    </div>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-800/80 rounded p-2.5 space-y-1.5">
                    <div className="flex justify-between text-[10px] text-zinc-400">
                      <span>Experience</span>
                      <span className="text-white font-bold">{selectedAnalysis.scoreBreakdown.experienceRelevance}/20</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
                      <div className="bg-emerald-400 h-1 rounded-full" style={{ width: `${(selectedAnalysis.scoreBreakdown.experienceRelevance / 20) * 100}%` }} />
                    </div>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-800/80 rounded p-2.5 space-y-1.5">
                    <div className="flex justify-between text-[10px] text-zinc-400">
                      <span>Projects</span>
                      <span className="text-white font-bold">{selectedAnalysis.scoreBreakdown.projectRelevance}/15</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
                      <div className="bg-emerald-400 h-1 rounded-full" style={{ width: `${(selectedAnalysis.scoreBreakdown.projectRelevance / 15) * 100}%` }} />
                    </div>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-800/80 rounded p-2.5 space-y-1.5">
                    <div className="flex justify-between text-[10px] text-zinc-400">
                      <span>Education</span>
                      <span className="text-white font-bold">{selectedAnalysis.scoreBreakdown.educationAlignment}/10</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
                      <div className="bg-emerald-400 h-1 rounded-full" style={{ width: `${(selectedAnalysis.scoreBreakdown.educationAlignment / 10) * 100}%` }} />
                    </div>
                  </div>

                  <div className="bg-zinc-950 border border-zinc-800/80 rounded p-2.5 space-y-1.5">
                    <div className="flex justify-between text-[10px] text-zinc-400">
                      <span>Structure</span>
                      <span className="text-white font-bold">{selectedAnalysis.scoreBreakdown.structureReadability}/5</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-1 overflow-hidden">
                      <div className="bg-emerald-400 h-1 rounded-full" style={{ width: `${(selectedAnalysis.scoreBreakdown.structureReadability / 5) * 100}%` }} />
                    </div>
                  </div>

                </div>
              </div>

              {/* Navigation Tabs (Render Pill Style) */}
              <div className="flex items-center gap-1.5 border-b border-zinc-800 pb-2 overflow-x-auto print:hidden font-mono text-xs">
                <button
                  onClick={() => setActiveTab("keywords")}
                  className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === "keywords"
                      ? "bg-zinc-900 text-white border border-zinc-700"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Keywords & Evidence ({selectedAnalysis.keywordMatches.matchedExact.length + selectedAnalysis.keywordMatches.matchedRelated.length})
                </button>

                <button
                  onClick={() => setActiveTab("diagnostics")}
                  className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === "diagnostics"
                      ? "bg-zinc-900 text-white border border-zinc-700"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  ATS Diagnostics (9 Checks)
                </button>

                <button
                  onClick={() => setActiveTab("recommendations")}
                  className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === "recommendations"
                      ? "bg-zinc-900 text-white border border-zinc-700"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Recommendations ({selectedAnalysis.recommendations.length})
                </button>

                <button
                  onClick={() => setActiveTab("improve")}
                  className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === "improve"
                      ? "bg-zinc-900 text-emerald-400 border border-emerald-500/40"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Wand2 className="size-3" />
                  STAR Rewrites
                </button>
              </div>

              {/* ─── TAB 1: KEYWORDS & EVIDENCE ─── */}
              {activeTab === "keywords" && (
                <div className="space-y-4">
                  {/* Skill Group Badges */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    
                    {/* Exact Matches */}
                    <div className="render-card p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-mono font-semibold text-emerald-400">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="size-3.5" />
                          Exact Keyword Matches ({selectedAnalysis.keywordMatches.matchedExact.length})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 font-mono">
                        {selectedAnalysis.keywordMatches.matchedExact.map((k, i) => (
                          <span key={i} className="px-2 py-0.5 bg-zinc-950 border border-zinc-800 text-emerald-300 text-[11px] rounded">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Related Matches */}
                    <div className="render-card p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-mono font-semibold text-zinc-300">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="size-3.5 text-zinc-400" />
                          Related & Semantic Skills ({selectedAnalysis.keywordMatches.matchedRelated.length})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 font-mono">
                        {selectedAnalysis.keywordMatches.matchedRelated.map((k, i) => (
                          <span key={i} className="px-2 py-0.5 bg-zinc-950 border border-zinc-800 text-zinc-300 text-[11px] rounded">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Missing Required */}
                    <div className="render-card p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-mono font-semibold text-rose-400">
                        <span className="flex items-center gap-1.5">
                          <XCircle className="size-3.5" />
                          Missing Required Skills ({selectedAnalysis.keywordMatches.missingRequired.length})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 font-mono">
                        {selectedAnalysis.keywordMatches.missingRequired.map((k, i) => (
                          <span key={i} className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] rounded">
                            {k}
                          </span>
                        ))}
                        {selectedAnalysis.keywordMatches.missingRequired.length === 0 && (
                          <p className="text-xs text-emerald-400 italic font-mono">Zero missing required skills</p>
                        )}
                      </div>
                    </div>

                    {/* Missing Preferred */}
                    <div className="render-card p-4 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-mono font-semibold text-amber-400">
                        <span className="flex items-center gap-1.5">
                          <AlertTriangle className="size-3.5" />
                          Missing Preferred / Bonus ({selectedAnalysis.keywordMatches.missingPreferred.length})
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 font-mono">
                        {selectedAnalysis.keywordMatches.missingPreferred.map((k, i) => (
                          <span key={i} className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] rounded">
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>

                  </div>

                  {/* Verbatim Evidence Table */}
                  <div className="render-card p-5 space-y-3 font-mono">
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <Terminal className="size-3.5 text-zinc-400" />
                        Verbatim Evidence Citations Log
                      </h3>
                      <p className="text-[11px] text-zinc-500 font-sans mt-0.5">
                        Extracted text evidence verifying exact matches in candidate resume.
                      </p>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-800 text-zinc-500 text-[10px]">
                            <th className="py-2 px-3 font-medium">KEYWORD</th>
                            <th className="py-2 px-3 font-medium">CATEGORY</th>
                            <th className="py-2 px-3 font-medium">STATUS</th>
                            <th className="py-2 px-3 font-medium">EXTRACTED EVIDENCE QUOTE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60 font-sans">
                          {selectedAnalysis.keywordMatches.evidenceList?.map((ev, i) => (
                            <tr key={i} className="hover:bg-zinc-950/60 font-mono text-[11px]">
                              <td className="py-2.5 px-3 font-bold text-white">{ev.keyword}</td>
                              <td className="py-2.5 px-3 text-zinc-500">{ev.category}</td>
                              <td className="py-2.5 px-3">
                                {ev.matched ? (
                                  <span className="text-emerald-400 font-semibold">✓ {ev.matchType}</span>
                                ) : (
                                  <span className="text-rose-400 font-semibold">✗ Missing</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-zinc-300 max-w-md font-mono text-[10px]">
                                {ev.evidenceQuote ? `"${ev.evidenceQuote}"` : <span className="text-zinc-600">None detected</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── TAB 2: ATS DIAGNOSTICS (9 CHECKS) ─── */}
              {activeTab === "diagnostics" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {[
                    selectedAnalysis.compatibilityChecks.standardHeadings,
                    selectedAnalysis.compatibilityChecks.contactVisibility,
                    selectedAnalysis.compatibilityChecks.formatConsistency,
                    selectedAnalysis.compatibilityChecks.dateConsistency,
                    selectedAnalysis.compatibilityChecks.bulletQuality,
                    selectedAnalysis.compatibilityChecks.excessiveFormatting,
                    selectedAnalysis.compatibilityChecks.unclearAbbreviations,
                  ].map((check, idx) => (
                    <div
                      key={idx}
                      className={`render-card p-4 space-y-2 ${
                        check.passed ? "border-zinc-800" : "border-rose-500/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-white flex items-center gap-1.5 font-mono">
                          {check.passed ? (
                            <CheckCircle2 className="size-3.5 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="size-3.5 text-rose-400" />
                          )}
                          {check.area}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            check.passed
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {check.passed ? "PASS" : "WARN"}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 font-medium">{check.finding}</p>
                      <p className="text-[11px] text-zinc-500 leading-relaxed font-sans">{check.details}</p>
                    </div>
                  ))}

                  {/* Section Completeness */}
                  <div className="render-card p-4 space-y-2">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5 font-mono">
                      <FileText className="size-3.5 text-zinc-400" />
                      Section Completeness
                    </span>
                    {selectedAnalysis.compatibilityChecks.missingSections?.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-xs text-rose-400 font-medium">Missing Recommended Sections:</p>
                        <div className="flex flex-wrap gap-1 pt-1 font-mono">
                          {selectedAnalysis.compatibilityChecks.missingSections.map((s, i) => (
                            <span key={i} className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] rounded">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                        ✓ All standard sections detected
                      </p>
                    )}
                  </div>

                  {/* Anti-Keyword Stuffing */}
                  <div className="render-card p-4 space-y-2">
                    <span className="text-xs font-semibold text-white flex items-center gap-1.5 font-mono">
                      <ShieldCheck className="size-3.5 text-zinc-400" />
                      Anti-Keyword Stuffing Audit
                    </span>
                    {selectedAnalysis.compatibilityChecks.keywordStuffingWarnings?.length > 0 ? (
                      <div className="space-y-1 font-mono">
                        {selectedAnalysis.compatibilityChecks.keywordStuffingWarnings.map((w, i) => (
                          <p key={i} className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 p-2 rounded">
                            {w}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                        ✓ Natural distribution verified (no stuffing detected)
                      </p>
                    )}
                  </div>

                </div>
              )}

              {/* ─── TAB 3: RECOMMENDATIONS ─── */}
              {activeTab === "recommendations" && (
                <div className="space-y-4">
                  {/* Priority Filter */}
                  <div className="flex items-center gap-2 print:hidden font-mono text-xs">
                    <span className="text-zinc-500">Filter Priority:</span>
                    {(["All", "High", "Medium", "Low"] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPriorityFilter(p)}
                        className={`px-2.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                          priorityFilter === p
                            ? "bg-zinc-800 text-white border border-zinc-700"
                            : "bg-transparent text-zinc-500 hover:text-white"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  {/* Recommendation Cards */}
                  <div className="space-y-3">
                    {selectedAnalysis.recommendations
                      .filter((rec) => priorityFilter === "All" || rec.priority === priorityFilter)
                      .map((rec) => (
                        <div key={rec.id} className="render-card p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-white">{rec.title}</span>
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                                rec.priority === "High"
                                  ? "bg-rose-500/10 border border-rose-500/25 text-rose-400"
                                  : rec.priority === "Medium"
                                  ? "bg-amber-500/10 border border-amber-500/25 text-amber-400"
                                  : "bg-zinc-800 border border-zinc-700 text-zinc-300"
                              }`}
                            >
                              {rec.priority} Priority
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                            <div className="bg-zinc-950 p-3 rounded border border-zinc-800/80 space-y-1">
                              <span className="font-mono text-[10px] text-zinc-500 uppercase font-bold block">Issue</span>
                              <p className="text-zinc-300 text-xs leading-relaxed">{rec.issue}</p>
                            </div>
                            <div className="bg-zinc-950 p-3 rounded border border-zinc-800/80 space-y-1">
                              <span className="font-mono text-[10px] text-zinc-500 uppercase font-bold block">Why it matters</span>
                              <p className="text-zinc-300 text-xs leading-relaxed">{rec.whyItMatters}</p>
                            </div>
                            <div className="md:col-span-2 bg-zinc-900/60 p-3 rounded border border-zinc-800 space-y-1">
                              <span className="font-mono text-[10px] text-emerald-400 uppercase font-bold block">Actionable Fix</span>
                              <p className="text-white text-xs leading-relaxed">{rec.howToImprove}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500 pt-1">
                            <span>Target Section:</span>
                            <span className="text-zinc-300 font-semibold">{rec.sectionLocation}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* ─── TAB 4: STAR REWRITES & IMPROVEMENTS ─── */}
              {activeTab === "improve" && (
                <div className="space-y-6">
                  {/* STAR Bullet Point Rewrites */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Wand2 className="size-3.5 text-emerald-400" />
                        STAR Bullet Point Rewrites
                      </h3>
                      <span className="text-[10px] font-mono text-zinc-500">Recruiter Impact & Metric Optimization</span>
                    </div>

                    <div className="space-y-3">
                      {selectedAnalysis.improvements?.bulletPoints?.map((bp, i) => (
                        <div key={i} className="render-card p-4 space-y-3">
                          <span className="text-[10px] font-mono text-zinc-500 uppercase font-bold block">
                            Context: {bp.contextRoleOrProject}
                          </span>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            {/* Original */}
                            <div className="bg-zinc-950 p-3 rounded border border-zinc-800/80 space-y-1">
                              <span className="text-[10px] font-mono text-rose-400 uppercase">Original</span>
                              <p className="text-zinc-400 line-through text-xs leading-relaxed">{bp.original}</p>
                            </div>

                            {/* Improved STAR */}
                            <div className="bg-emerald-950/20 p-3 rounded border border-emerald-500/30 space-y-1 relative group">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold">Optimized STAR</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(bp.improved, `bp-${i}`)}
                                  className="h-6 px-2 text-zinc-400 hover:text-white bg-transparent border-0 cursor-pointer"
                                >
                                  {copiedText === `bp-${i}` ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                                </button>
                              </div>
                              <p className="text-emerald-200 text-xs font-medium leading-relaxed">{bp.improved}</p>
                            </div>
                          </div>

                          <p className="text-[11px] text-zinc-500 font-sans">
                            <span className="text-zinc-400 font-medium">Improvement rationale: </span>
                            {bp.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Impact Metric Placeholders */}
                  {selectedAnalysis.improvements?.impactSuggestions && selectedAnalysis.improvements.impactSuggestions.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-zinc-800">
                      <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Terminal className="size-3.5 text-zinc-400" />
                        Quantifiable Impact Prompts
                      </h3>
                      <p className="text-xs text-zinc-500 font-sans">
                        Substitute authentic metrics into your resume. HYRD avoids fabricating data.
                      </p>
                      <div className="space-y-2">
                        {selectedAnalysis.improvements.impactSuggestions.map((imp, i) => (
                          <div key={i} className="render-card p-3 space-y-1.5">
                            <span className="text-[10px] font-mono text-zinc-400 uppercase font-bold block">
                              Section: {imp.section}
                            </span>
                            <p className="text-xs text-zinc-300">{imp.prompt}</p>
                            <div className="bg-zinc-950 border border-zinc-800 p-2 rounded flex items-center justify-between font-mono text-xs">
                              <span className="text-zinc-300 text-[11px]">{imp.exampleMetric}</span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(imp.exampleMetric, `imp-${i}`)}
                                className="text-zinc-500 hover:text-white bg-transparent border-0 cursor-pointer px-1"
                              >
                                {copiedText === `imp-${i}` ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>

        {/* Right Column: History Drawer (4 or 3 cols) */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4 print:hidden">
          <div className="render-card p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="size-3.5 text-zinc-400" />
                Saved Audits
              </h3>
              <span className="text-[10px] font-mono text-zinc-500">{history.length} Saved</span>
            </div>

            {loadingHistory ? (
              <div className="py-6 flex flex-col items-center justify-center text-zinc-500 gap-2 font-mono text-xs">
                <Loader2 className="size-4 animate-spin" />
                <span>Loading...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="py-6 text-center text-zinc-500 space-y-1 font-mono text-xs">
                <FileText className="size-6 mx-auto opacity-30 mb-1" />
                <p>No saved audits</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[550px] overflow-y-auto pr-1">
                {history.map((item) => {
                  const isSelected = selectedAnalysis?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedAnalysis(item);
                        navigate(`/workspace/ats/${item.id}`);
                      }}
                      className={`p-2.5 rounded border transition-colors cursor-pointer group flex items-center justify-between ${
                        isSelected
                          ? "bg-zinc-900 border-zinc-700 text-white"
                          : "bg-zinc-950/60 border-zinc-800/80 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0 pr-2">
                        <p className="text-xs font-medium truncate text-white">
                          {item.jobTitle || item.resumeFileName}
                        </p>
                        <p className="text-[10px] font-mono text-zinc-500 truncate">
                          {item.companyName ? `${item.companyName} • ` : ""}
                          {new Date(item.createdAt).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded border ${
                            item.overallScore >= 80
                              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                              : "bg-amber-500/10 border-amber-500/25 text-amber-400"
                          }`}
                        >
                          {item.overallScore}
                        </span>
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            handleDeleteAnalysis(item.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-rose-400 transition-opacity bg-transparent border-0 cursor-pointer"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
