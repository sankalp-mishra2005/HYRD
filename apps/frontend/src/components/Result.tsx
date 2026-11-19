import { BACKEND_URL } from "@/lib/config";
import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Loader2,
  ArrowRight,
  FileText,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Award,
  Terminal,
  Activity,
  Sparkles,
  HelpCircle,
  MessageSquare,
  Quote
} from "lucide-react";
import { Button } from "./ui/button";

interface QuestionData {
  id: string;
  topic: string;
  questionText: string;
  answerText: string | null;
  score: number | null;
  feedback: string | null;
  difficulty: string | null;
}

interface MessageData {
  id: string;
  message: string;
  type: "User" | "Assistant";
  createdAt: string;
}

interface ResultData {
  role?: string;
  company?: string;
  score: number;
  feedback: string;
  questions: QuestionData[];
  status: "Done" | "InProgress" | "Pre";
  difficulty?: string;
  language?: string;
  interviewType?: string;
  liveMetrics?: {
    communication?: number;
    technical?: number;
    confidence?: number;
    problemSolving?: number;
    systemDesign?: number;
  };
  hireReport?: {
    decision?: "YES" | "NO";
    confidence?: number;
    strengths?: string[];
    weaknesses?: string[];
    recommendation?: string;
  };
  conversations: MessageData[];
}

export function Result() {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<ResultData>({
    score: 0,
    feedback: "",
    questions: [],
    status: "Pre",
    conversations: []
  });

  // Fetch & poll results safely without redundant duplicate evaluations
  useEffect(() => {
    let triggered = false;

    const fetchResult = async () => {
      try {
        const query = !triggered ? "?evaluate=true" : "";
        triggered = true;
        const response = await axios.get(`${BACKEND_URL}/api/v1/interviews/result/${interviewId}${query}`, { withCredentials: true });
        setResult(response.data);
        return response.data.status as ResultData["status"];
      } catch (err) {
        console.warn("Notice: result fetch:", err);
      }
    };

    fetchResult();
    const intervalId = setInterval(async () => {
      const s = await fetchResult();
      if (s === "Done") clearInterval(intervalId);
    }, 3000);

    return () => clearInterval(intervalId);
  }, [interviewId]);

  const ready = result.status === "Done";
  const roleTitle = result.role || "Software Engineer";

  const liveMetrics = result.liveMetrics || {
    communication: 8,
    technical: 8,
    confidence: 8,
    problemSolving: 8,
    systemDesign: 8
  };

  const hireReport = result.hireReport || {
    decision: (result.score >= 70 ? "YES" : "NO") as "YES" | "NO",
    confidence: 85,
    strengths: [],
    weaknesses: [],
    recommendation: result.feedback || "Evaluation processing..."
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12 font-sans">
      
      {/* ─── HEADER BAR ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-white tracking-tight">Interview Evaluation Report</h1>
            <span className={ready ? "render-status-live" : "render-status-deploying"}>
              {ready ? "✓ Evaluation Complete" : "● Analyzing Responses..."}
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Performance diagnostics and recruiter synthesis for <span className="text-white font-medium">{roleTitle}</span> {result.company && `at ${result.company}`}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate("/workspace/interviews")}
            variant="outline"
            className="h-8 text-xs font-medium border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded px-3 flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="size-3.5" />
            <span>Practice Again</span>
          </Button>

          <Button
            onClick={() => navigate("/workspace/ats")}
            className="h-8 bg-white hover:bg-zinc-200 text-black text-xs font-semibold rounded px-3.5 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <FileText className="size-3.5" />
            <span>Check Resume ATS</span>
            <ArrowRight className="size-3" />
          </Button>
        </div>
      </div>

      {!ready ? (
        /* Evaluation In-Progress State */
        <div className="render-card p-16 text-center space-y-4">
          <div className="size-8 mx-auto border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-white">Synthesizing Recruiter Rubric</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Analyzing conversational turns, answer structure, technical depth, and communication delivery.
            </p>
          </div>
        </div>
      ) : (
        /* Complete Render Developer Report */
        <div className="space-y-6">
          
          {/* Hire Recommendation Banner */}
          <div className="render-card p-6 bg-[#0c0c0e] border border-zinc-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className={`size-10 rounded flex items-center justify-center font-bold text-lg font-mono ${
                  hireReport.decision === "YES" 
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" 
                    : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                }`}>
                  {hireReport.decision === "YES" ? "✓" : "!"}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white tracking-tight">
                      {hireReport.decision === "YES" ? "Candidate Recommendation: Hire" : "Candidate Recommendation: Needs Improvement"}
                    </h2>
                    <span className="render-status-live">
                      Confidence: {hireReport.confidence || 85}%
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Overall Interview Score: <span className="font-mono font-semibold text-white">{result.score}/100</span>
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest block">Format</span>
                <span className="text-xs text-zinc-300 font-mono font-medium">{result.interviewType || "Technical"}</span>
              </div>
            </div>

            <div className="text-xs text-zinc-300 leading-relaxed font-sans bg-black p-4 rounded border border-zinc-800/80">
              <span className="text-zinc-500 font-mono text-[11px] block mb-1 uppercase tracking-wider font-semibold">Executive Recruiter Summary</span>
              {hireReport.recommendation || result.feedback}
            </div>
          </div>

          {/* Grid: Performance Metrics (Left) & Strengths/Weaknesses (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left 5 Cols: Metric Gauges */}
            <div className="lg:col-span-5 render-card p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                <div className="flex items-center gap-2 text-xs font-mono font-semibold text-zinc-300 uppercase tracking-wider">
                  <Activity className="size-3.5 text-zinc-400" />
                  <span>Performance Diagnostics</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">scale: 0-100</span>
              </div>

              <div className="space-y-4">
                
                {/* Technical Ability */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400 font-medium">Technical Depth</span>
                    <span className="text-white font-mono font-semibold">{Math.round((liveMetrics.technical || 8) * 10)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                    <div 
                      className="h-full bg-emerald-400 rounded-full" 
                      style={{ width: `${Math.min(100, Math.round((liveMetrics.technical || 8) * 10))}%` }} 
                    />
                  </div>
                </div>

                {/* Communication */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400 font-medium">Communication & Clarity</span>
                    <span className="text-white font-mono font-semibold">{Math.round((liveMetrics.communication || 8) * 10)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                    <div 
                      className="h-full bg-emerald-400 rounded-full" 
                      style={{ width: `${Math.min(100, Math.round((liveMetrics.communication || 8) * 10))}%` }} 
                    />
                  </div>
                </div>

                {/* Problem Solving */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400 font-medium">Problem Solving & Trade-offs</span>
                    <span className="text-white font-mono font-semibold">{Math.round((liveMetrics.problemSolving || 8) * 10)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                    <div 
                      className="h-full bg-emerald-400 rounded-full" 
                      style={{ width: `${Math.min(100, Math.round((liveMetrics.problemSolving || 8) * 10))}%` }} 
                    />
                  </div>
                </div>

                {/* Confidence */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400 font-medium">Confidence & Delivery</span>
                    <span className="text-white font-mono font-semibold">{Math.round((liveMetrics.confidence || 8) * 10)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                    <div 
                      className="h-full bg-emerald-400 rounded-full" 
                      style={{ width: `${Math.min(100, Math.round((liveMetrics.confidence || 8) * 10))}%` }} 
                    />
                  </div>
                </div>

              </div>

              <div className="p-3 bg-black rounded border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed font-sans">
                💡 Response pacing and structured STAR breakdowns significantly influence the technical score.
              </div>
            </div>

            {/* Right 7 Cols: Recruiter Synthesis & Strengths */}
            <div className="lg:col-span-7 space-y-6">
              
              <div className="render-card p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-mono font-semibold text-zinc-300 uppercase tracking-wider">
                    <Award className="size-3.5 text-zinc-400" />
                    <span>Candidate Strengths & Gaps</span>
                  </div>
                </div>

                {/* Identified Strengths */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 font-mono">
                    <CheckCircle2 className="size-3.5 text-emerald-400" />
                    Observed Strengths
                  </span>
                  {(hireReport.strengths && hireReport.strengths.length > 0) ? (
                    <div className="space-y-1.5">
                      {hireReport.strengths.map((str, i) => (
                        <div key={i} className="text-xs text-zinc-300 bg-black p-2.5 rounded border border-zinc-800/80 flex items-start gap-2">
                          <span className="text-emerald-400 font-mono text-[11px] mt-0.5">✓</span>
                          <span>{str}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 italic">No specific strengths recorded.</p>
                  )}
                </div>

                {/* Areas for Improvement */}
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 font-mono">
                    <AlertTriangle className="size-3.5 text-amber-400" />
                    Areas to Strengthen
                  </span>
                  {(hireReport.weaknesses && hireReport.weaknesses.length > 0) ? (
                    <div className="space-y-1.5">
                      {hireReport.weaknesses.map((w, i) => (
                        <div key={i} className="text-xs text-zinc-300 bg-black p-2.5 rounded border border-zinc-800/80 flex items-start gap-2">
                          <span className="text-amber-400 font-mono text-[11px] mt-0.5">⚠</span>
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-500 italic">No critical deficiencies identified.</p>
                  )}
                </div>

              </div>

              {/* Next Steps CTA Box */}
              <div className="render-card p-6 bg-[#0a0a0c] border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">Optimize Resume for this Role</h3>
                  <p className="text-xs text-zinc-400">
                    Run HYRD's ATS Intelligence engine against the job description to match keywords and eliminate blind spots.
                  </p>
                </div>
                <Button
                  onClick={() => navigate("/workspace/ats")}
                  className="render-btn-primary shrink-0"
                >
                  <span>Check ATS Score</span>
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>

            </div>

          </div>

          {/* ─── PER-QUESTION BREAKDOWN & STAR ANALYSIS (INTERVIEWSBY.AI STYLE) ─── */}
          {result.questions && result.questions.length > 0 && (
            <div className="space-y-4 pt-4">
              <div className="border-b border-zinc-800 pb-3">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <MessageSquare className="size-4 text-emerald-400" />
                  <span>Question-by-Question Breakdown & STAR Feedback</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Actionable notes on the answers you gave, what was clear vs. vague, and how to tighten your examples.
                </p>
              </div>

              <div className="space-y-4">
                {result.questions.map((q, idx) => (
                  <div key={q.id || idx} className="render-card p-6 space-y-4 bg-[#0a0a0c]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          Question {idx + 1}
                        </span>
                        <span className="text-xs font-mono text-zinc-400">{q.topic || "Core Technical"}</span>
                      </div>
                      {typeof q.score === "number" && (
                        <div className="flex items-center gap-1.5 text-xs font-mono">
                          <span className="text-zinc-500">Score:</span>
                          <span className={`font-bold ${q.score >= 75 ? "text-emerald-400" : q.score >= 55 ? "text-amber-400" : "text-red-400"}`}>
                            {q.score}/100
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-white leading-relaxed">
                        "{q.questionText}"
                      </h4>
                    </div>

                    {q.answerText && (
                      <div className="p-3 bg-black rounded border border-zinc-800/80 space-y-1">
                        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">Your Transcribed Response</span>
                        <p className="text-xs text-zinc-300 leading-relaxed italic">
                          "{q.answerText}"
                        </p>
                      </div>
                    )}

                    {q.feedback && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div className="p-3 rounded bg-zinc-900/60 border border-zinc-800 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                            <CheckCircle2 className="size-3.5" />
                            <span>What was clear</span>
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed">
                            {q.feedback.split(".")[0] ? `${q.feedback.split(".")[0]}.` : "Good technical framing and direct response to the core prompt."}
                          </p>
                        </div>

                        <div className="p-3 rounded bg-zinc-900/60 border border-zinc-800 space-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                            <Sparkles className="size-3.5" />
                            <span>STAR Improvement Tip</span>
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed">
                            {q.feedback.split(".").slice(1).join(".").trim() || "Add concrete scale metrics or measurable business outcomes to substantiate your impact."}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
