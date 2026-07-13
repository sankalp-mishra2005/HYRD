import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { toast } from "sonner";
import axios from "axios";
import { BACKEND_URL } from "@/lib/config";
import { useNavigate } from "react-router";
import {
  ArrowRight,
  Github,
  Loader2,
  FileText,
  UploadCloud,
  Linkedin,
  Award,
  ShieldCheck,
  Zap,
  CheckCircle,
  AlertCircle,
  FileCode,
  BookOpen,
  Settings,
  BrainCircuit,
  Sparkles,
  RefreshCw
} from "lucide-react";

type Tab = "interview" | "analyzer" | "matcher" | "roadmap";

export function Form() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("interview");
  const [loading, setLoading] = useState(false);

  // --- Mock Interview Config State ---
  const [role, setRole] = useState("Software Engineer");
  const [company, setCompany] = useState("");
  const [experienceLevel, setExperienceLevel] = useState("Fresher");
  const [duration, setDuration] = useState("30");
  const [difficulty, setDifficulty] = useState("Adaptive");
  const [language, setLanguage] = useState("English");
  const [interviewType, setInterviewType] = useState("Technical Interview");
  const [github, setGithub] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [interviewResume, setInterviewResume] = useState<File | null>(null);
  const [interviewLinkedin, setInterviewLinkedin] = useState<File | null>(null);

  // --- Resume Analyzer State ---
  const [analyzerFile, setAnalyzerFile] = useState<File | null>(null);
  const [analyzerLoading, setAnalyzerLoading] = useState(false);
  const [analyzerResult, setAnalyzerResult] = useState<any>(null);

  // --- JD Matcher State ---
  const [matcherFile, setMatcherFile] = useState<File | null>(null);
  const [matcherJd, setMatcherJd] = useState("");
  const [matcherLoading, setMatcherLoading] = useState(false);
  const [matcherResult, setMatcherResult] = useState<any>(null);

  // --- Learning Roadmap State ---
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [roadmapResult, setRoadmapResult] = useState<any>(null);
  const [roadmapInterviewId, setRoadmapInterviewId] = useState("");

  const interviewResumeRef = useRef<HTMLInputElement>(null);
  const interviewLinkedinRef = useRef<HTMLInputElement>(null);
  const analyzerResumeRef = useRef<HTMLInputElement>(null);
  const matcherResumeRef = useRef<HTMLInputElement>(null);

  // Auto-load last completed interview ID for Roadmap tab
  useEffect(() => {
    const id = localStorage.getItem("last_interview_id");
    if (id) {
      setRoadmapInterviewId(id);
    }
  }, []);

  // --- Mock Interview Submit Handler ---
  async function onStartInterview() {
    setLoading(true);
    try {
      const formData = new FormData();
      if (interviewResume) formData.append("resume", interviewResume);
      if (interviewLinkedin) formData.append("linkedin", interviewLinkedin);
      formData.append("github", github.trim());
      formData.append("role", role);
      formData.append("company", company.trim());
      formData.append("experienceLevel", experienceLevel);
      formData.append("duration", duration);
      formData.append("jobDescription", jobDescription.trim());
      formData.append("difficulty", difficulty);
      formData.append("language", language);
      formData.append("interviewType", interviewType);

      const response = await axios.post(`${BACKEND_URL}/api/v1/pre-interview`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success("Profile fused and interview ready!");
      // Track last interview ID
      localStorage.setItem("last_interview_id", response.data.id);
      navigate(`/interview/${response.data.id}`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to start mock interview. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  // --- Resume Analyzer Handler ---
  async function onAnalyzeResume() {
    if (!analyzerFile) {
      toast.error("Please upload a resume PDF first");
      return;
    }
    setAnalyzerLoading(true);
    try {
      const formData = new FormData();
      formData.append("resume", analyzerFile);
      const res = await axios.post(`${BACKEND_URL}/api/v1/resume-analyzer`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      setAnalyzerResult(res.data);
      toast.success("ATS Analysis completed!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to analyze resume. Please try again.");
    } finally {
      setAnalyzerLoading(false);
    }
  }

  // --- JD Matcher Handler ---
  async function onMatchJd() {
    if (!matcherFile || !matcherJd.trim()) {
      toast.error("Please upload your resume and paste the job description");
      return;
    }
    setMatcherLoading(true);
    try {
      const formData = new FormData();
      formData.append("resume", matcherFile);
      formData.append("jdText", matcherJd.trim());
      const res = await axios.post(`${BACKEND_URL}/api/v1/jd-matcher`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      setMatcherResult(res.data);
      toast.success("JD matching analysis completed!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to match JD. Please try again.");
    } finally {
      setMatcherLoading(false);
    }
  }

  // --- Generate Study Plan Handler ---
  async function onGenerateRoadmap() {
    if (!roadmapInterviewId) {
      toast.error("No valid completed interview ID found. Complete an interview first!");
      return;
    }
    setRoadmapLoading(true);
    try {
      const res = await axios.post(`${BACKEND_URL}/api/v1/study-plan/generate`, {
        interviewId: roadmapInterviewId,
      });
      setRoadmapResult(res.data);
      toast.success("Study roadmap generated successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Roadmap generation failed. Ensure your interview has been evaluated.");
    } finally {
      setRoadmapLoading(false);
    }
  }

  return (
    <main className="min-h-screen w-screen bg-slate-950 text-slate-50 flex flex-col items-center py-10 px-4 sm:px-6 overflow-y-auto">
      <div className="w-full max-w-5xl flex flex-col items-center">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/50 px-3.5 py-1.5 text-xs font-semibold text-sky-400 backdrop-blur shadow-inner">
            <BrainCircuit className="size-4 animate-pulse text-sky-400" />
            AI Placement Copilot Dashboard
          </span>
          <h1 className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-4xl sm:text-5xl font-extrabold tracking-tight text-transparent">
            Placement Prep Suite
          </h1>
          <p className="mt-3 max-w-2xl text-slate-450 text-xs sm:text-sm">
            Evaluate your resume, align with target job descriptions, conduct adaptive voice mock interviews, and access custom roadmap recommendations.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex flex-wrap items-center justify-center gap-2 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800/80 mb-8 max-w-full">
          <button
            onClick={() => setActiveTab("interview")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "interview"
                ? "bg-sky-500 text-white shadow-md shadow-sky-500/10"
                : "text-slate-450 hover:text-slate-200 hover:bg-slate-855"
            }`}
          >
            <BrainCircuit className="size-4" />
            Adaptive Mock Interview
          </button>
          <button
            onClick={() => setActiveTab("analyzer")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "analyzer"
                ? "bg-sky-500 text-white shadow-md shadow-sky-500/10"
                : "text-slate-450 hover:text-slate-200 hover:bg-slate-855"
            }`}
          >
            <Award className="size-4" />
            ATS Resume Analyzer
          </button>
          <button
            onClick={() => setActiveTab("matcher")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "matcher"
                ? "bg-sky-500 text-white shadow-md shadow-sky-500/10"
                : "text-slate-450 hover:text-slate-200 hover:bg-slate-855"
            }`}
          >
            <ShieldCheck className="size-4" />
            JD Matcher
          </button>
          <button
            onClick={() => setActiveTab("roadmap")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "roadmap"
                ? "bg-sky-500 text-white shadow-md shadow-sky-500/10"
                : "text-slate-450 hover:text-slate-200 hover:bg-slate-855"
            }`}
          >
            <BookOpen className="size-4" />
            Learning Roadmap
          </button>
        </div>

        {/* --- Tab Content --- */}
        <div className="w-full">
          {/* TAB 1: MOCK INTERVIEW */}
          {activeTab === "interview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
              {/* Left Column: Knowledge Fusion */}
              <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-200 flex items-center gap-2">
                    <Zap className="size-5 text-amber-400" />
                    Knowledge Fusion Sources
                  </CardTitle>
                  <CardDescription className="text-slate-450 text-xs">
                    Supply your profiles to feed your Candidate Knowledge Graph for resume-targeted challenges.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Resume Upload */}
                  <div className="space-y-2">
                    <Label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider">Resume PDF (Challenge Mode)</Label>
                    <input
                      type="file"
                      ref={interviewResumeRef}
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => setInterviewResume(e.target.files?.[0] || null)}
                    />
                    <div
                      onClick={() => interviewResumeRef.current?.click()}
                      className={`border border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2 bg-slate-950/40 hover:bg-slate-955/80 ${
                        interviewResume ? "border-sky-500/80 bg-sky-950/10" : "border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {interviewResume ? (
                        <>
                          <FileText className="size-8 text-sky-400" />
                          <div className="text-xs font-semibold text-slate-200 truncate max-w-xs">{interviewResume.name}</div>
                          <div className="text-[10px] text-slate-500">{(interviewResume.size / (1024 * 1024)).toFixed(2)} MB • Click to replace</div>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="size-8 text-slate-500" />
                          <div className="text-xs font-semibold text-slate-300">Upload Resume PDF</div>
                          <div className="text-[10px] text-slate-500">Enable resume challenge questions</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* LinkedIn Upload */}
                  <div className="space-y-2">
                    <Label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider">LinkedIn Profile PDF</Label>
                    <input
                      type="file"
                      ref={interviewLinkedinRef}
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => setInterviewLinkedin(e.target.files?.[0] || null)}
                    />
                    <div
                      onClick={() => interviewLinkedinRef.current?.click()}
                      className={`border border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2 bg-slate-955/40 hover:bg-slate-955/80 ${
                        interviewLinkedin ? "border-indigo-500/80 bg-indigo-950/10" : "border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      {interviewLinkedin ? (
                        <>
                          <Linkedin className="size-8 text-indigo-400" />
                          <div className="text-xs font-semibold text-slate-200 truncate max-w-xs">{interviewLinkedin.name}</div>
                          <div className="text-[10px] text-slate-500">{(interviewLinkedin.size / (1024 * 1024)).toFixed(2)} MB • Click to replace</div>
                        </>
                      ) : (
                        <>
                          <UploadCloud className="size-8 text-slate-500" />
                          <div className="text-xs font-semibold text-slate-300">Upload LinkedIn PDF</div>
                          <div className="text-[10px] text-slate-500">Incorporate experiences into the questions</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* GitHub Input */}
                  <div className="space-y-2">
                    <Label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider">GitHub Username or URL</Label>
                    <div className="relative flex items-center rounded-xl border border-slate-850 bg-slate-950/60 focus-within:border-slate-700">
                      <div className="pl-3 text-slate-500">
                        <Github className="size-4" />
                      </div>
                      <Input
                        type="text"
                        placeholder="e.g. github.com/username"
                        value={github}
                        onChange={(e) => setGithub(e.target.value)}
                        className="border-0 bg-transparent text-slate-200 shadow-none focus-visible:ring-0 placeholder:text-slate-650 text-xs h-10 w-full"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Right Column: Configurations */}
              <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur shadow-2xl flex flex-col justify-between">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-200 flex items-center gap-2">
                    <Settings className="size-5 text-sky-400" />
                    Adaptive Parameters
                  </CardTitle>
                  <CardDescription className="text-slate-455 text-xs font-medium">
                    Configure the interviewer agent to match your exact placement interview format.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Role selector */}
                    <div className="space-y-1.5">
                      <Label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider">Target Role</Label>
                      <Select value={role} onValueChange={setRole}>
                        <SelectTrigger className="w-full bg-slate-955/50 border-slate-850 text-slate-300 text-xs h-10">
                          <SelectValue placeholder="Select Role" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                          <SelectItem value="Frontend Engineer">Frontend</SelectItem>
                          <SelectItem value="Backend Engineer">Backend</SelectItem>
                          <SelectItem value="Full Stack Engineer">Full Stack</SelectItem>
                          <SelectItem value="AI/ML Engineer">AI/ML</SelectItem>
                          <SelectItem value="Data Science Analyst">Data Science</SelectItem>
                          <SelectItem value="DevOps Specialist">DevOps</SelectItem>
                          <SelectItem value="Mobile App Developer">Mobile</SelectItem>
                          <SelectItem value="HR Recruiter">HR Round</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Interview Type Selector */}
                    <div className="space-y-1.5">
                      <Label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider">Interview Type</Label>
                      <Select value={interviewType} onValueChange={setInterviewType}>
                        <SelectTrigger className="w-full bg-slate-955/50 border-slate-850 text-slate-300 text-xs h-10">
                          <SelectValue placeholder="Select Type" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                          <SelectItem value="Technical Interview">Technical Round</SelectItem>
                          <SelectItem value="HR Interview">HR Interview</SelectItem>
                          <SelectItem value="DSA Interview">DSA Interview</SelectItem>
                          <SelectItem value="System Design">System Design</SelectItem>
                          <SelectItem value="Machine Learning">Machine Learning</SelectItem>
                          <SelectItem value="Behavioral">Behavioral (STAR)</SelectItem>
                          <SelectItem value="Project Discussion">Project Discussion</SelectItem>
                          <SelectItem value="Resume Review">Resume Challenge</SelectItem>
                          <SelectItem value="Leadership">Leadership Round</SelectItem>
                          <SelectItem value="Manager Round">Manager Round</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Experience Level */}
                    <div className="space-y-1.5">
                      <Label className="text-slate-355 text-[10px] font-bold uppercase tracking-wider">Experience</Label>
                      <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                        <SelectTrigger className="w-full bg-slate-955/50 border-slate-850 text-slate-300 text-xs h-10">
                          <SelectValue placeholder="Select Experience" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                          <SelectItem value="Fresher">Fresher / Graduate</SelectItem>
                          <SelectItem value="1-2 Years">1 - 2 Years</SelectItem>
                          <SelectItem value="3-5 Years">3 - 5 Years</SelectItem>
                          <SelectItem value="Senior">Senior (5+ Years)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Difficulty setting */}
                    <div className="space-y-1.5">
                      <Label className="text-slate-355 text-[10px] font-bold uppercase tracking-wider">Difficulty</Label>
                      <Select value={difficulty} onValueChange={setDifficulty}>
                        <SelectTrigger className="w-full bg-slate-955/50 border-slate-850 text-slate-300 text-xs h-10">
                          <SelectValue placeholder="Select Difficulty" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                          <SelectItem value="Easy">Easy</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Hard">Hard</SelectItem>
                          <SelectItem value="Adaptive">Adaptive (Dynamic)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Duration */}
                    <div className="space-y-1.5">
                      <Label className="text-slate-355 text-[10px] font-bold uppercase tracking-wider">Duration</Label>
                      <Select value={duration} onValueChange={setDuration}>
                        <SelectTrigger className="w-full bg-slate-955/50 border-slate-850 text-slate-300 text-xs h-10">
                          <SelectValue placeholder="Select Duration" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                          <SelectItem value="15">15 Minutes</SelectItem>
                          <SelectItem value="30">30 Minutes</SelectItem>
                          <SelectItem value="45">45 Minutes</SelectItem>
                          <SelectItem value="60">60 Minutes</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Language Selection */}
                    <div className="space-y-1.5">
                      <Label className="text-slate-355 text-[10px] font-bold uppercase tracking-wider">Language</Label>
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger className="w-full bg-slate-955/50 border-slate-850 text-slate-300 text-xs h-10">
                          <SelectValue placeholder="Select Language" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
                          <SelectItem value="English">English</SelectItem>
                          <SelectItem value="Hindi">Hindi (हिंदी)</SelectItem>
                          <SelectItem value="Hinglish">Hinglish</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Target Company */}
                    <div className="space-y-1.5">
                      <Label className="text-slate-355 text-[10px] font-bold uppercase tracking-wider">Target Company (Optional)</Label>
                      <Input
                        type="text"
                        placeholder="e.g. Google, McKinsey"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        className="bg-slate-955/50 border-slate-855 text-slate-200 text-xs h-10 placeholder:text-slate-650 focus-visible:ring-slate-700"
                      />
                    </div>
                    {/* Job Description Upload */}
                    <div className="space-y-1.5">
                      <Label className="text-slate-355 text-[10px] font-bold uppercase tracking-wider">Job Description (JD)</Label>
                      <Input
                        type="text"
                        placeholder="Paste target JD details below..."
                        disabled
                        className="bg-slate-955/20 border-slate-900 text-slate-500 text-xs h-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-350 text-[10px] font-bold uppercase tracking-wider">Paste Job Description (optional)</Label>
                    <Textarea
                      placeholder="Paste JD details to target questions specifically to the open role..."
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      className="bg-slate-955/50 border-slate-855 text-slate-200 text-xs h-20 resize-none focus-visible:ring-slate-700 placeholder:text-slate-650"
                    />
                  </div>

                  <Button
                    disabled={loading}
                    onClick={onStartInterview}
                    className="w-full py-6 mt-2 text-xs font-bold bg-sky-500 hover:bg-sky-600 text-white rounded-xl shadow-lg shadow-sky-500/10 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Generating System Prompt & Setting Up Session...
                      </>
                    ) : (
                      <>
                        Start Voice Interview
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 2: ATS RESUME ANALYZER */}
          {activeTab === "analyzer" && (
            <div className="space-y-6 w-full">
              <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-200 flex items-center gap-2">
                    <Award className="size-5 text-sky-400" />
                    ATS Resume Analyzer
                  </CardTitle>
                  <CardDescription className="text-slate-455 text-xs">
                    Evaluate your resume against industry-standard ATS (Applicant Tracking Systems) patterns using LLM parsers.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-center p-6 border border-dashed border-slate-800 rounded-xl bg-slate-955/30">
                    <input
                      type="file"
                      ref={analyzerResumeRef}
                      accept="application/pdf"
                      className="hidden"
                      onChange={(e) => setAnalyzerFile(e.target.files?.[0] || null)}
                    />
                    <div
                      onClick={() => analyzerResumeRef.current?.click()}
                      className="flex items-center gap-3 px-5 py-3 border border-slate-800 rounded-xl bg-slate-955/50 hover:bg-slate-955/90 cursor-pointer text-slate-300 text-xs font-bold transition-all"
                    >
                      <UploadCloud className="size-4 text-sky-400" />
                      {analyzerFile ? analyzerFile.name : "Select Resume PDF"}
                    </div>

                    <Button
                      disabled={analyzerLoading || !analyzerFile}
                      onClick={onAnalyzeResume}
                      className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold cursor-pointer rounded-xl h-10 px-6 shrink-0 flex items-center gap-2 disabled:opacity-40"
                    >
                      {analyzerLoading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Evaluating ATS Formats...
                        </>
                      ) : (
                        <>
                          Analyze Resume Score
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Analyzer Results Display */}
                  {analyzerResult && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-900">
                      {/* Radial Progress Score Card */}
                      <Card className="bg-slate-955/40 border-slate-900 flex flex-col items-center justify-center p-6 text-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">ATS Compatibility Score</span>
                        <div className="relative flex items-center justify-center w-36 h-36">
                          {/* Radial Progress Indicator */}
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="72" cy="72" r="60" stroke="#1e293b" strokeWidth="10" fill="transparent" />
                            <circle
                              cx="72"
                              cy="72"
                              r="60"
                              stroke={analyzerResult.atsScore >= 80 ? "#10b981" : analyzerResult.atsScore >= 50 ? "#f59e0b" : "#ef4444"}
                              strokeWidth="10"
                              fill="transparent"
                              strokeDasharray={2 * Math.PI * 60}
                              strokeDashoffset={2 * Math.PI * 60 * (1 - analyzerResult.atsScore / 100)}
                              strokeLinecap="round"
                              className="transition-all duration-1000"
                            />
                          </svg>
                          <div className="absolute flex flex-col items-center justify-center">
                            <span className="text-3xl font-extrabold text-white">{analyzerResult.atsScore}</span>
                            <span className="text-[10px] font-bold text-slate-550">/ 100</span>
                          </div>
                        </div>
                        {analyzerResult.candidateName && (
                          <div className="mt-4">
                            <h3 className="text-sm font-bold text-slate-300">{analyzerResult.candidateName}</h3>
                            <p className="text-[10px] text-slate-500">{analyzerResult.email}</p>
                          </div>
                        )}
                      </Card>

                      {/* Detailed Strengths and Improvements */}
                      <div className="md:col-span-2 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Key Strengths */}
                          <div className="p-4 bg-emerald-955/10 border border-emerald-900/20 rounded-xl space-y-2">
                            <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                              <CheckCircle className="size-4" />
                              Resume Strengths
                            </h3>
                            <ul className="space-y-1">
                              {analyzerResult.strengths?.map((str: string, i: number) => (
                                <li key={i} className="text-slate-300 text-xs flex items-start gap-1">
                                  <span className="text-emerald-500 shrink-0">•</span>
                                  <span>{str}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Suggested Improvements */}
                          <div className="p-4 bg-amber-955/10 border border-amber-900/20 rounded-xl space-y-2">
                            <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
                              <AlertCircle className="size-4" />
                              Areas for Improvement
                            </h3>
                            <ul className="space-y-1">
                              {analyzerResult.improvements?.map((imp: string, i: number) => (
                                <li key={i} className="text-slate-300 text-xs flex items-start gap-1">
                                  <span className="text-amber-500 shrink-0">•</span>
                                  <span>{imp}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Formatting & Content Details */}
                        <div className="p-4 bg-slate-955/50 border border-slate-900 rounded-xl space-y-3">
                          <div>
                            <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-widest mb-1.5">Detected Skills ({analyzerResult.skills?.length || 0})</h4>
                            <div className="flex flex-wrap gap-1.5">
                              {analyzerResult.skills?.map((skill: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div>
                            <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-widest mb-1">General Styling & Section Layouts</h4>
                            <p className="text-xs text-slate-400 leading-relaxed">{analyzerResult.rawAnalysisText}</p>
                          </div>

                          {analyzerResult.formattingTips?.length > 0 && (
                            <div>
                              <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-widest mb-1">ATS Optimization Quick Tips</h4>
                              <ul className="space-y-1">
                                {analyzerResult.formattingTips.map((tip: string, i: number) => (
                                  <li key={i} className="text-slate-400 text-xs flex items-start gap-1.5">
                                    <span className="text-sky-500 shrink-0">→</span>
                                    <span>{tip}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 3: JD MATCHER */}
          {activeTab === "matcher" && (
            <div className="space-y-6 w-full">
              <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-200 flex items-center gap-2">
                    <ShieldCheck className="size-5 text-sky-400" />
                    Job Description Matcher
                  </CardTitle>
                  <CardDescription className="text-slate-455 text-xs font-semibold">
                    Compare your candidate profile directly with a target Job Description to highlight matches and identify key technology gaps.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left pane: File Upload */}
                    <div className="space-y-3">
                      <Label className="text-slate-300 text-xs font-semibold uppercase tracking-wider">1. Upload your Resume (PDF)</Label>
                      <input
                        type="file"
                        ref={matcherResumeRef}
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) => setMatcherFile(e.target.files?.[0] || null)}
                      />
                      <div
                        onClick={() => matcherResumeRef.current?.click()}
                        className={`border border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 bg-slate-955/40 hover:bg-slate-955/80 ${
                          matcherFile ? "border-sky-500/80 bg-sky-955/10" : "border-slate-800 hover:border-slate-700"
                        }`}
                      >
                        {matcherFile ? (
                          <>
                            <FileText className="size-10 text-sky-400" />
                            <div className="text-sm font-semibold text-slate-200 truncate max-w-xs">{matcherFile.name}</div>
                            <div className="text-xs text-slate-500">{(matcherFile.size / (1024 * 1024)).toFixed(2)} MB • Click to replace</div>
                          </>
                        ) : (
                          <>
                            <UploadCloud className="size-10 text-slate-500" />
                            <div className="text-sm font-semibold text-slate-300">Upload your Resume PDF</div>
                            <div className="text-xs text-slate-550">File will be cross-referenced with the JD</div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right pane: Paste JD */}
                    <div className="flex flex-col space-y-2">
                      <Label className="text-slate-350 text-xs font-bold uppercase tracking-wider">2. Paste Job Description</Label>
                      <Textarea
                        placeholder="Paste the target Job Description (roles, responsibilities, requirements, and tech stack details)..."
                        value={matcherJd}
                        onChange={(e) => setMatcherJd(e.target.value)}
                        className="bg-slate-955/50 border-slate-855 text-slate-200 text-xs flex-1 min-h-[140px] resize-none focus-visible:ring-slate-700 placeholder:text-slate-655"
                      />
                    </div>
                  </div>

                  <div className="flex justify-center border-t border-slate-900 pt-4">
                    <Button
                      disabled={matcherLoading || !matcherFile || !matcherJd.trim()}
                      onClick={onMatchJd}
                      className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold cursor-pointer rounded-xl h-12 px-8 flex items-center gap-2.5 shadow-lg shadow-sky-500/10 disabled:opacity-40"
                    >
                      {matcherLoading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Evaluating Alignment and Gaps...
                        </>
                      ) : (
                        <>
                          Run JD Match Analysis
                          <ArrowRight className="size-4" />
                        </>
                      )}
                    </Button>
                  </div>

                  {/* JD Matcher Results Display */}
                  {matcherResult && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-900">
                      {/* Match Percentage Progress Panel */}
                      <Card className="bg-slate-955/30 border-slate-900 flex flex-col items-center justify-center p-6 text-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Job Match Alignment</span>
                        <div className="relative flex items-center justify-center w-36 h-36">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="72" cy="72" r="60" stroke="#1e293b" strokeWidth="10" fill="transparent" />
                            <circle
                              cx="72"
                              cy="72"
                              r="60"
                              stroke={matcherResult.matchPercentage >= 75 ? "#10b981" : matcherResult.matchPercentage >= 50 ? "#f59e0b" : "#ef4444"}
                              strokeWidth="10"
                              fill="transparent"
                              strokeDasharray={2 * Math.PI * 60}
                              strokeDashoffset={2 * Math.PI * 60 * (1 - matcherResult.matchPercentage / 100)}
                              strokeLinecap="round"
                              className="transition-all duration-1000"
                            />
                          </svg>
                          <div className="absolute flex flex-col items-center justify-center">
                            <span className="text-3xl font-extrabold text-white">{matcherResult.matchPercentage}%</span>
                            <span className="text-[10px] font-bold text-slate-500">Fit Index</span>
                          </div>
                        </div>
                        <span className="text-xs text-slate-400 mt-4 leading-relaxed">
                          {matcherResult.matchPercentage >= 75 ? "🎉 Excellent alignment with the role" : matcherResult.matchPercentage >= 50 ? "⚠️ Good alignment, but technical gaps exist" : "🚨 Poor alignment – heavy customization needed"}
                        </span>
                      </Card>

                      {/* Matching vs Missing Skills */}
                      <div className="md:col-span-2 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Matching Skills */}
                          <div className="p-4 bg-emerald-955/10 border border-emerald-900/20 rounded-xl space-y-2">
                            <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                              <CheckCircle className="size-4" />
                              Matching Skills
                            </h3>
                            <div className="flex flex-wrap gap-1.5">
                              {matcherResult.matchingSkills?.length === 0 ? (
                                <span className="text-slate-500 text-xs">No direct skill matches found.</span>
                              ) : (
                                matcherResult.matchingSkills?.map((skill: string, i: number) => (
                                  <span key={i} className="px-2 py-0.5 rounded bg-emerald-955/30 border border-emerald-900/40 text-[10px] text-emerald-300">
                                    {skill}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Missing Skills */}
                          <div className="p-4 bg-rose-955/10 border border-rose-900/20 rounded-xl space-y-2">
                            <h3 className="text-xs font-bold text-rose-450 flex items-center gap-1.5 uppercase tracking-wider">
                              <AlertCircle className="size-4" />
                              Missing / Gap Skills
                            </h3>
                            <div className="flex flex-wrap gap-1.5">
                              {matcherResult.missingSkills?.length === 0 ? (
                                <span className="text-slate-500 text-xs">No missing skills detected!</span>
                              ) : (
                                matcherResult.missingSkills?.map((skill: string, i: number) => (
                                  <span key={i} className="px-2 py-0.5 rounded bg-rose-955/30 border border-rose-900/40 text-[10px] text-rose-350">
                                    {skill}
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Fit Analysis details */}
                        <div className="p-4 bg-slate-955/50 border border-slate-900 rounded-xl space-y-2">
                          <h4 className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">Comparative Gap Analysis</h4>
                          <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{matcherResult.fitAnalysis}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 4: LEARNING ROADMAP */}
          {activeTab === "roadmap" && (
            <div className="space-y-6 w-full">
              <Card className="bg-slate-900/60 border-slate-800/80 backdrop-blur shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-xl text-slate-200 flex items-center gap-2">
                    <BookOpen className="size-5 text-sky-400" />
                    Learning Roadmap & Study Plan
                  </CardTitle>
                  <CardDescription className="text-slate-455 text-xs">
                    Access a structured study plan designed dynamically to address weak areas uncovered during your previous mock interviews.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Load / Generate Plan Input Row */}
                  <div className="flex flex-col sm:flex-row gap-3 items-center justify-center p-4 border border-slate-800 rounded-xl bg-slate-955/40">
                    <div className="w-full sm:flex-1 max-w-sm">
                      <Label className="sr-only">Interview ID</Label>
                      <Input
                        type="text"
                        placeholder="Insert evaluated Interview ID..."
                        value={roadmapInterviewId}
                        onChange={(e) => setRoadmapInterviewId(e.target.value)}
                        className="bg-slate-955 border-slate-855 text-slate-200 text-xs h-10 w-full"
                      />
                    </div>
                    <Button
                      disabled={roadmapLoading || !roadmapInterviewId.trim()}
                      onClick={onGenerateRoadmap}
                      className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold cursor-pointer rounded-xl h-10 px-6 shrink-0 flex items-center gap-2 disabled:opacity-40"
                    >
                      {roadmapLoading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Constructing roadmap tasks...
                        </>
                      ) : (
                        <>
                          Generate Roadmap
                          <RefreshCw className="size-3.5" />
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Plan Content Display */}
                  {roadmapResult ? (
                    <div className="space-y-6 border-t border-slate-900 pt-6">
                      {/* Weaknesses Summary */}
                      {roadmapResult.weaknesses?.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-450">Identified Focus Areas</h3>
                          <div className="flex flex-wrap gap-2">
                            {roadmapResult.weaknesses.map((weak: string, i: number) => (
                              <span key={i} className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-350">
                                ⚠️ {weak}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Day-by-Day Study Plan */}
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-450">3-Day Prep Study Plan</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {roadmapResult.dayByDayPlan?.map((plan: any, i: number) => (
                            <Card key={i} className="bg-slate-955/40 border-slate-900/60 overflow-hidden flex flex-col">
                              {/* Day Header */}
                              <div className="bg-slate-900 border-b border-slate-850 px-4 py-3 flex items-center justify-between">
                                <span className="text-xs font-extrabold text-sky-400">{plan.day}</span>
                                <span className="text-[10px] text-slate-500 font-semibold uppercase">Daily Tasks</span>
                              </div>
                              {/* Day Content */}
                              <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                                <div>
                                  <h4 className="text-xs font-bold text-slate-200 mb-2">{plan.topic}</h4>
                                  <ul className="space-y-2">
                                    {plan.tasks?.map((task: string, k: number) => (
                                      <li key={k} className="text-slate-400 text-xs flex items-start gap-2 leading-relaxed">
                                        <input type="checkbox" className="mt-0.5 accent-sky-500" />
                                        <span>{task}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10 text-slate-550 text-xs flex flex-col items-center justify-center gap-2">
                      <FileCode className="size-8 text-slate-600" />
                      <span>Input an evaluated Interview ID and click "Generate Roadmap" to display your personalized 3-day prep timeline.</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default Form;
