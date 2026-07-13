import { BACKEND_URL } from "@/lib/config";
import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
    Loader2,
    Sparkles,
    CheckCircle2,
    HelpCircle,
    ArrowLeft,
    AlertTriangle,
    ShieldCheck,
    Terminal,
    ChevronRight,
    Award,
    BookOpen,
    Clock
} from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";
import type { SuspiciousEvent } from "./Interview";
import { toast } from "sonner";

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

interface CodingSubmissionData {
    id: string;
    submittedCode: string;
    status: string;
    timeComplexity: string | null;
    spaceComplexity: string | null;
    feedback: string | null;
    score: number | null;
    challenge: {
        title: string;
        description: string;
    };
}

interface ResultData {
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
    codingSubmissions?: CodingSubmissionData[];
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
    const [suspiciousEvents, setSuspiciousEvents] = useState<SuspiciousEvent[]>([]);

    // Study Plan Roadmap States
    const [roadmapLoading, setRoadmapLoading] = useState(false);
    const [roadmapResult, setRoadmapResult] = useState<any>(null);

    useEffect(() => {
        const raw = sessionStorage.getItem(`suspicious_events_${interviewId}`);
        if (raw) {
            try { setSuspiciousEvents(JSON.parse(raw)); } catch (_) {}
        }
    }, [interviewId]);

    // Fetch study plan if it was previously generated
    useEffect(() => {
        if (!interviewId) return;
        axios.get(`${BACKEND_URL}/api/v1/study-plan/${interviewId}`)
            .then((res) => setRoadmapResult(res.data))
            .catch(() => {}); // silent if not generated yet
    }, [interviewId]);

    useEffect(() => {
        const fetchResult = () =>
            axios.get(`${BACKEND_URL}/api/v1/result/${interviewId}`).then((response) => {
                setResult(response.data);
                return response.data.status as ResultData["status"];
            });

        fetchResult();
        const intervalId = setInterval(async () => {
            const s = await fetchResult();
            if (s === "Done") clearInterval(intervalId);
        }, 3000);

        return () => clearInterval(intervalId);
    }, [interviewId]);

    // Generate study plan handler
    async function onGenerateRoadmap() {
        setRoadmapLoading(true);
        try {
            const res = await axios.post(`${BACKEND_URL}/api/v1/study-plan/generate`, {
                interviewId,
            });
            setRoadmapResult(res.data);
            toast.success("Study roadmap generated!");
        } catch (error) {
            console.error(error);
        } finally {
            setRoadmapLoading(false);
        }
    }

    const ready = result.status === "Done";

    const getDifficultyColor = (diff: string | null) => {
        if (!diff) return "bg-slate-800 text-slate-400";
        const d = diff.toLowerCase();
        if (d.includes("easy")) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
        if (d.includes("hard")) return "bg-rose-500/10 text-rose-455 border-rose-500/20";
        return "bg-amber-500/10 text-amber-450 border-amber-500/20";
    };

    const getScoreColor = (score: number | null) => {
        if (score === null) return "text-slate-450";
        if (score >= 8) return "text-emerald-400";
        if (score >= 5) return "text-amber-450";
        return "text-rose-455";
    };

    return (
        <main className="min-h-screen w-screen bg-slate-950 text-slate-50 py-12 px-4 sm:px-6 overflow-y-auto">
            <div className="mx-auto w-full max-w-5xl">
                
                <header className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-6">
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                            Interview Evaluation
                        </h1>
                        <p className="mt-1.5 text-xs text-slate-450 font-medium">
                            {result.interviewType || "Technical Round"} • {result.difficulty || "Adaptive"} • {result.language || "English"}
                        </p>
                    </div>
                    <Button 
                        onClick={() => navigate("/")}
                        className="bg-slate-900 border border-slate-850 hover:bg-slate-850 text-slate-200 text-xs font-bold cursor-pointer rounded-xl h-10 px-4 shrink-0 flex items-center gap-2"
                    >
                        <ArrowLeft className="size-3.5" />
                        Dashboard
                    </Button>
                </header>

                {!ready ? (
                    <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-slate-850 bg-slate-900/30 py-24 text-center backdrop-blur shadow-xl">
                        <div className="relative flex size-12 items-center justify-center">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500/20 opacity-75" />
                            <Loader2 className="size-6 animate-spin text-sky-400" />
                        </div>
                        <div className="space-y-1">
                            <p className="font-bold text-slate-200 text-sm">Formulating Recruiter Report…</p>
                            <p className="text-xs text-slate-500 max-w-xs mx-auto">
                                Gemini is analyzing emotional intelligence, dialog turns, and coding submission metrics.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        {/* Overall Layout: Split columns */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            
                            {/* Column 1: AI Recruiter decision and metrics */}
                            <div className="space-y-6">
                                {/* Recruiter Decision Card */}
                                {result.hireReport && (
                                    <Card className={`border overflow-hidden bg-slate-900/60 backdrop-blur shadow-2xl ${
                                        result.hireReport.decision === "YES" ? "border-emerald-800/40" : "border-rose-900/40"
                                    }`}>
                                        <div className={`px-5 py-3 border-b flex items-center justify-between font-bold text-xs uppercase tracking-wider ${
                                            result.hireReport.decision === "YES" ? "bg-emerald-950/20 border-emerald-900/30 text-emerald-400" : "bg-rose-955/20 border-rose-900/30 text-rose-455"
                                        }`}>
                                            <span>Hire Recommendation</span>
                                            <span>Conf: {result.hireReport.confidence}%</span>
                                        </div>
                                        <CardContent className="p-5 space-y-4">
                                            <div className="flex items-center gap-4">
                                                <div className={`text-4xl font-black px-5 py-2.5 rounded-xl border tracking-wider shadow-inner ${
                                                    result.hireReport.decision === "YES" ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-400" : "bg-rose-955/30 border-rose-800/50 text-rose-455"
                                                }`}>
                                                    {result.hireReport.decision}
                                                </div>
                                                <div className="space-y-0.5">
                                                    <h3 className="text-xs font-bold text-slate-300">Recruiter Decision</h3>
                                                    <p className="text-[10px] text-slate-550">Based on dynamic dialogue analytics</p>
                                                </div>
                                            </div>

                                            <p className="text-xs text-slate-400 leading-relaxed font-sans border-l-2 border-slate-800 pl-3">
                                                {result.hireReport.recommendation}
                                            </p>

                                            {/* Strengths */}
                                            {result.hireReport.strengths && result.hireReport.strengths.length > 0 && (
                                                <div className="space-y-1.5">
                                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Key Strengths</h4>
                                                    <ul className="space-y-1">
                                                        {result.hireReport.strengths.map((str, i) => (
                                                            <li key={i} className="text-xs text-slate-300 flex items-start gap-1">
                                                                <span className="text-emerald-500 shrink-0">•</span>
                                                                <span>{str}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {/* Weaknesses */}
                                            {result.hireReport.weaknesses && result.hireReport.weaknesses.length > 0 && (
                                                <div className="space-y-1.5">
                                                    <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Key Weaknesses</h4>
                                                    <ul className="space-y-1">
                                                        {result.hireReport.weaknesses.map((weak, i) => (
                                                            <li key={i} className="text-xs text-slate-305 flex items-start gap-1">
                                                                <span className="text-rose-500 shrink-0">•</span>
                                                                <span>{weak}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Score Dashboard Panel */}
                                {result.liveMetrics && (
                                    <Card className="bg-slate-900/60 border-slate-850/80 backdrop-blur shadow-2xl">
                                        <CardHeader className="py-4">
                                            <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-450 flex items-center gap-1.5">
                                                <Sparkles className="size-3 text-sky-400" />
                                                Prep Metrics Profile
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3.5 pb-5">
                                            {[
                                                { label: "Communication", key: "communication", color: "bg-violet-500" },
                                                { label: "Technical Skill", key: "technical", color: "bg-sky-500" },
                                                { label: "Confidence", key: "confidence", color: "bg-amber-500" },
                                                { label: "Problem Solving", key: "problemSolving", color: "bg-emerald-500" },
                                                { label: "System Design", key: "systemDesign", color: "bg-rose-500" },
                                            ].map((item) => {
                                                const val = (result.liveMetrics as any)[item.key] || 5;
                                                return (
                                                    <div key={item.key} className="space-y-1">
                                                        <div className="flex items-center justify-between text-[11px] font-medium">
                                                            <span className="text-slate-450">{item.label}</span>
                                                            <span className="text-slate-205 font-bold">{val} / 10</span>
                                                        </div>
                                                        <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                                                            <div
                                                                className={`h-full ${item.color} rounded-full transition-all duration-500`}
                                                                style={{ width: `${val * 10}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </CardContent>
                                    </Card>
                                )}
                            </div>

                            {/* Column 2: Question breakdown, Coding, and Roadmap */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Overall Summary Card */}
                                <Card className="bg-slate-900/60 border-slate-850/80 backdrop-blur shadow-2xl overflow-hidden relative">
                                    <div className="absolute top-0 right-0 p-4 opacity-15">
                                        <Sparkles className="size-36 text-sky-450" />
                                    </div>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-bold uppercase tracking-widest text-slate-450 flex items-center gap-1.5">
                                            <Sparkles className="size-4 text-sky-400" />
                                            Executive Evaluation
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="flex flex-col sm:flex-row items-start gap-6">
                                        <div className="flex flex-col items-center justify-center border border-slate-800 bg-slate-950/60 w-28 h-28 rounded-xl shrink-0 shadow-inner">
                                            <span className="text-[9px] font-bold tracking-wider text-slate-500 uppercase">Avg Score</span>
                                            <span className="text-3xl font-black text-sky-400 mt-1">
                                                {result.score}
                                            </span>
                                            <span className="text-[9px] font-semibold text-slate-500">out of 10</span>
                                        </div>

                                        <div className="space-y-2 flex-1">
                                            <div className="text-xs font-bold text-slate-300">Executive Summary:</div>
                                            <p className="text-slate-400 text-xs leading-relaxed whitespace-pre-wrap">
                                                {result.feedback}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Coding Round Submissions (if any) */}
                                {result.codingSubmissions && result.codingSubmissions.length > 0 && (
                                    <section className="space-y-4">
                                        <h2 className="text-xs font-bold tracking-widest uppercase text-slate-450 flex items-center gap-2">
                                            <Terminal className="size-4 text-sky-400" />
                                            Coding Assessment Submissions
                                        </h2>

                                        {result.codingSubmissions.map((sub) => (
                                            <Card key={sub.id} className="bg-slate-900/60 border-slate-850 shadow-xl overflow-hidden">
                                                <div className="px-5 py-3 border-b border-slate-900 bg-slate-900/10 flex items-center justify-between flex-wrap gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-slate-200">{sub.challenge.title}</span>
                                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                                            sub.status === "Success" ? "bg-emerald-500/10 text-emerald-450 border-emerald-500/20" : "bg-rose-500/10 text-rose-455 border-rose-500/20"
                                                        }`}>
                                                            {sub.status}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-400 font-mono">
                                                        Score: <span className="text-sky-400 font-bold">{sub.score} / 10</span>
                                                    </div>
                                                </div>
                                                <CardContent className="p-5 space-y-4">
                                                    {/* Code block */}
                                                    <div className="rounded-xl border border-slate-850/80 bg-slate-950 p-4 font-mono text-xs text-slate-300 overflow-x-auto max-h-56">
                                                        <pre>{sub.submittedCode}</pre>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="p-3 rounded-lg bg-slate-955/40 border border-slate-900 text-xs">
                                                            <div className="text-[10px] text-slate-500 font-semibold mb-1">Estimated Time Complexity</div>
                                                            <div className="font-mono text-slate-205 font-semibold">{sub.timeComplexity || "O(N)"}</div>
                                                        </div>
                                                        <div className="p-3 rounded-lg bg-slate-955/40 border border-slate-900 text-xs">
                                                            <div className="text-[10px] text-slate-500 font-semibold mb-1">Estimated Space Complexity</div>
                                                            <div className="font-mono text-slate-205 font-semibold">{sub.spaceComplexity || "O(1)"}</div>
                                                        </div>
                                                    </div>

                                                    {sub.feedback && (
                                                        <div className="p-4 rounded-xl bg-sky-955/5 border border-sky-900/10 space-y-1">
                                                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-sky-400">Gemini Observer Feedback</h4>
                                                            <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{sub.feedback}</p>
                                                        </div>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </section>
                                )}

                                {/* Q&A Breakdown */}
                                <section className="space-y-4">
                                    <h2 className="text-xs font-bold tracking-widest uppercase text-slate-450 flex items-center gap-2">
                                        <CheckCircle2 className="size-4 text-sky-400" />
                                        Dialogue Segment Analytics
                                    </h2>

                                    {result.questions.map((q, idx) => (
                                        <Card key={q.id} className="bg-slate-900/60 border-slate-850 hover:border-slate-800 transition-all duration-200">
                                            <CardHeader className="py-3 px-5 border-b border-slate-900 bg-slate-900/10 flex flex-row items-center justify-between gap-4 flex-wrap">
                                                <div className="flex items-center gap-3">
                                                    <span className="inline-flex size-6 items-center justify-center rounded-lg bg-slate-950 border border-slate-800 text-xs font-bold text-slate-400 shadow-inner">
                                                        Q{idx + 1}
                                                    </span>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-xs font-bold text-slate-200">{q.topic}</span>
                                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${getDifficultyColor(q.difficulty)}`}>
                                                            {q.difficulty || "Medium"}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-xs font-bold bg-slate-950/80 px-3 py-1 rounded-lg border border-slate-850">
                                                    Score: <span className={getScoreColor(q.score)}>{q.score !== null ? `${q.score}/10` : "N/A"}</span>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-5 space-y-4 text-xs">
                                                {/* Question */}
                                                <div className="space-y-1">
                                                    <div className="text-[9px] font-bold tracking-wider uppercase text-slate-500 flex items-center gap-1">
                                                        <HelpCircle className="size-3 text-sky-450" />
                                                        Interviewer Question
                                                    </div>
                                                    <p className="text-slate-200 font-medium leading-relaxed pl-4 border-l border-sky-500/25">
                                                        {q.questionText}
                                                    </p>
                                                </div>

                                                {/* Answer */}
                                                <div className="space-y-1">
                                                    <div className="text-[9px] font-bold tracking-wider uppercase text-slate-500">
                                                        Candidate Answer
                                                    </div>
                                                    <p className="text-slate-400 leading-relaxed italic pl-4 border-l border-slate-800">
                                                        {q.answerText || "No response recorded / silence."}
                                                    </p>
                                                </div>

                                                {/* Feedback */}
                                                {q.feedback && (
                                                    <div className="space-y-1 pt-2 border-t border-slate-900">
                                                        <div className="text-[9px] font-bold tracking-wider uppercase text-sky-400">
                                                            Evaluation Notes
                                                        </div>
                                                        <p className="text-slate-450 leading-relaxed pl-4">
                                                            {q.feedback}
                                                        </p>
                                                    </div>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </section>

                                {/* Dialogue Timeline Replay */}
                                {result.conversations && result.conversations.length > 0 && (
                                    <section className="space-y-4">
                                        <h2 className="text-xs font-bold tracking-widest uppercase text-slate-450 flex items-center gap-2">
                                            <Clock className="size-4 text-sky-400" />
                                            Dialogue Replay Timeline
                                        </h2>

                                        <Card className="bg-slate-900/60 border-slate-850 p-6">
                                            <div className="relative border-l-2 border-slate-800 ml-4 pl-6 space-y-6">
                                                {result.conversations.map((msg, i) => (
                                                    <div key={msg.id} className="relative">
                                                        {/* Marker node */}
                                                        <span className={`absolute -left-[31px] top-1 flex size-4 items-center justify-center rounded-full border ${
                                                            msg.type === "Assistant" ? "bg-violet-500 border-violet-400" : "bg-sky-500 border-sky-400"
                                                        }`}>
                                                            <span className="size-1.5 rounded-full bg-white" />
                                                        </span>
                                                        <div className="space-y-1 text-xs">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-extrabold uppercase text-[9px] tracking-wider text-slate-500">
                                                                    {msg.type === "Assistant" ? "AI Interviewer" : "Candidate"}
                                                                </span>
                                                                <span className="text-[9px] text-slate-600">
                                                                    {new Date(msg.createdAt).toLocaleTimeString()}
                                                                </span>
                                                            </div>
                                                            <p className="text-slate-300 leading-relaxed whitespace-pre-wrap bg-slate-950/40 p-3 rounded-lg border border-slate-900 max-w-[90%]">
                                                                {msg.message}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </Card>
                                    </section>
                                )}

                                {/* Personalized Placement Prep Plan Widget */}
                                <section className="space-y-4">
                                    <h2 className="text-xs font-bold tracking-widest uppercase text-slate-450 flex items-center gap-2">
                                        <BookOpen className="size-4 text-sky-400" />
                                        Personal Prep Plan Generator
                                    </h2>

                                    <Card className="bg-slate-900/60 border-slate-850">
                                        <CardContent className="p-6 space-y-4">
                                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                                <div className="space-y-0.5 text-center sm:text-left">
                                                    <h3 className="text-xs font-bold text-slate-200">Personalized Prep Roadmap</h3>
                                                    <p className="text-[10px] text-slate-450 max-w-sm">Generate a customized 3-day roadmap detailing focal topics based on interview weaknesses.</p>
                                                </div>
                                                <Button
                                                    disabled={roadmapLoading}
                                                    onClick={onGenerateRoadmap}
                                                    className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold px-6 py-4 rounded-xl cursor-pointer shrink-0"
                                                >
                                                    {roadmapLoading ? (
                                                        <>
                                                            <Loader2 className="size-4 animate-spin mr-1.5" />
                                                            Building Roadmap...
                                                        </>
                                                    ) : (
                                                        <>Generate Roadmap</>
                                                    )}
                                                </Button>
                                            </div>

                                            {roadmapResult && (
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-900">
                                                    {roadmapResult.dayByDayPlan?.map((plan: any, i: number) => (
                                                        <div key={i} className="p-4 rounded-xl bg-slate-950/50 border border-slate-850 flex flex-col justify-between">
                                                            <div>
                                                                <h4 className="text-xs font-black text-sky-400 mb-1">{plan.day}</h4>
                                                                <h5 className="text-[11px] font-bold text-slate-200 mb-2">{plan.topic}</h5>
                                                                <ul className="space-y-1">
                                                                    {plan.tasks?.map((task: string, k: number) => (
                                                                        <li key={k} className="text-slate-450 text-[10px] leading-relaxed flex items-start gap-1">
                                                                            <span className="text-sky-500 shrink-0">•</span>
                                                                            <span>{task}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </section>

                                {/* Proctoring Report */}
                                <section className="space-y-4">
                                    <h2 className="text-xs font-bold tracking-widest uppercase text-slate-450 flex items-center gap-2">
                                        {suspiciousEvents.length === 0
                                            ? <ShieldCheck className="size-4 text-emerald-450 shrink-0" />
                                            : <AlertTriangle className="size-4 text-amber-450 shrink-0" />}
                                        Proctoring Integrity Report
                                    </h2>
                                    {suspiciousEvents.length === 0 ? (
                                        <Card className="bg-emerald-950/20 border-emerald-900/30 p-5 flex items-center gap-3">
                                            <ShieldCheck className="size-5 text-emerald-450 shrink-0" />
                                            <p className="text-emerald-300 text-xs leading-relaxed">System proctoring confirms full compliance. No tab swaps, visibility toggles, or framing violations were detected.</p>
                                        </Card>
                                    ) : (
                                        <Card className="bg-amber-950/10 border-amber-900/30 overflow-hidden">
                                            <CardHeader className="py-2.5 px-5 border-b border-amber-900/30 bg-amber-955/20">
                                                <CardTitle className="text-xs font-bold text-amber-300 flex items-center gap-2">
                                                    <AlertTriangle className="size-4" />
                                                    {suspiciousEvents.length} suspicious event{suspiciousEvents.length !== 1 ? "s" : ""} logged
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="p-0">
                                                <div className="divide-y divide-amber-900/20">
                                                    {suspiciousEvents.map((ev, i) => (
                                                        <div key={i} className="flex items-start gap-4 px-5 py-3 text-xs">
                                                            <span className="text-[10px] text-slate-500 shrink-0 font-mono pt-0.5">
                                                                {new Date(ev.timestamp).toLocaleTimeString()}
                                                            </span>
                                                            <span className="text-amber-200/80">{ev.message}</span>
                                                            <span className="ml-auto text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-400 shrink-0">
                                                                {ev.type.replace(/_/g, " ")}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </section>
                            </div>
                            
                        </div>
                    </div>
                )}

            </div>
        </main>
    );
}

export default Result;
