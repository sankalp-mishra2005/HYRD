import { useState } from "react";
import { signIn, signUp } from "../lib/auth";
import { toast } from "sonner";
import { useNavigate } from "react-router";
import { 
  Loader2, 
  ArrowRight, 
  Mic, 
  Activity, 
  ShieldCheck, 
  Terminal, 
  Cpu, 
  Lock, 
  Mail, 
  User, 
  X, 
  CheckCircle2, 
  Sparkles,
  GitBranch,
  Volume2,
  FileCode2,
  BarChart3
} from "lucide-react";
import { Button } from "./ui/button";

export function Login() {
  const navigate = useNavigate();

  // Auth Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Active Live Preview Category
  const [activeTab, setActiveTab] = useState<"system" | "dsa" | "frontend" | "fullstack">("system");

  const previewTracks = {
    system: {
      round: "Distributed Systems Architecture",
      target: "L5 / Senior Backend Engineer",
      question: "How would you design a distributed, idempotent rate limiter handling 150,000 requests/sec with cross-region replication?",
      expectedConcepts: ["Token Bucket / Leaky Bucket", "Redis Cluster & Lua Scripts", "Eventual vs Linearizable Consistency", "Fallback Degradation Modes"],
      agentPersona: "Alex (Staff Systems Interviewer)"
    },
    dsa: {
      round: "Algorithms & Data Structures",
      target: "Core Infrastructure Engineer",
      question: "Given a sliding window over an infinite stream of integer timestamps, how would you calculate the median in O(log k) time?",
      expectedConcepts: ["Two Heaps (Min-Max)", "Self-Balancing BST", "Amortized Complexity", "Memory Eviction Bounds"],
      agentPersona: "Alex (Algorithms Lead)"
    },
    frontend: {
      round: "Web Architecture & Performance",
      target: "Staff UI Engineer",
      question: "How do you eliminate rendering waterfalls and prevent main-thread jank when streaming 60fps WebSocket telemetry in React?",
      expectedConcepts: ["Virtualization & Offscreen Canvas", "Web Workers & MessageChannel", "Concurrent Transitions", "State Boundaries"],
      agentPersona: "Alex (Frontend Architect)"
    },
    fullstack: {
      round: "Engineering Manager / Technical Lead",
      target: "Full Stack Team Lead",
      question: "Walk me through how you safely execute zero-downtime database schema migrations on a PostgreSQL table with 100M rows.",
      expectedConcepts: ["Expand/Contract Pattern", "Concurrent Index Creation", "Backfill Batches", "Lock Timeout Guardrails"],
      agentPersona: "Alex (Director of Engineering)"
    }
  };

  // Instant Guest Sandbox Round Entry
  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      const guestId = Math.random().toString(36).substring(2, 8);
      const guestEmail = `developer_${guestId}@sandbox.hyrd.ai`;
      const guestPassword = `sandboxPass_${Date.now()}`;
      const guestName = "Developer Candidate";

      localStorage.setItem("hyrd_guest_mode", "true");

      await signUp.email({
        email: guestEmail,
        password: guestPassword,
        name: guestName,
        callbackURL: "/dashboard",
      });

      toast.success("Welcome! Entered developer sandbox session.");
      navigate("/dashboard");
    } catch {
      localStorage.setItem("hyrd_guest_mode", "true");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  // Direct Email / Password Auth
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password.");
      return;
    }
    if (isRegistering && !name) {
      toast.error("Please enter your name.");
      return;
    }

    setLoading(true);
    try {
      if (isRegistering) {
        await signUp.email({
          email,
          password,
          name,
          callbackURL: "/dashboard",
        });
        toast.success("Account created successfully!");
      } else {
        await signIn.email({
          email,
          password,
          callbackURL: "/dashboard",
        });
        toast.success("Logged in successfully!");
      }
      setShowAuthModal(false);
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err?.message || "Authentication failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  // Simulated Social OAuth
  const handleSocialSignIn = async (provider: "github" | "google") => {
    setLoading(true);
    const socialEmail = `${provider}.developer@hyrd.ai`;
    const socialName = `${provider.toUpperCase()} Developer`;
    const socialPassword = "SimulatedDeveloperPassword123!";

    try {
      await signIn.email({
        email: socialEmail,
        password: socialPassword,
        callbackURL: "/dashboard",
      });
      toast.success(`Welcome! Signed in with ${provider.toUpperCase()}.`);
      navigate("/dashboard");
    } catch {
      try {
        await signUp.email({
          email: socialEmail,
          password: socialPassword,
          name: socialName,
          callbackURL: "/dashboard",
        });
        toast.success(`Welcome! Registered with ${provider.toUpperCase()}.`);
        navigate("/dashboard");
      } catch (signupErr: any) {
        toast.error(`Simulated ${provider.toUpperCase()} login failed.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const currentTrack = previewTracks[activeTab];

  return (
    <div className="min-h-screen w-screen bg-black text-zinc-100 font-sans selection:bg-zinc-800 selection:text-white relative overflow-x-hidden antialiased">
      
      {/* ─── RENDER DEVELOPER NAVIGATION ─── */}
      <header className="border-b border-zinc-800/80 bg-black/95 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate("/")}>
              <div className="size-6 rounded bg-white flex items-center justify-center font-black text-black text-xs font-mono shadow-sm">
                H
              </div>
              <span className="font-bold tracking-tight text-white text-base">HYRD</span>
              <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
                v1.1
              </span>
            </div>

            <nav className="hidden md:flex items-center gap-5 text-xs text-zinc-400 font-mono">
              <button 
                onClick={() => document.getElementById("architecture")?.scrollIntoView({ behavior: "smooth" })}
                className="hover:text-white transition-colors cursor-pointer"
              >
                /architecture
              </button>
              <button 
                onClick={() => document.getElementById("voice-engine")?.scrollIntoView({ behavior: "smooth" })}
                className="hover:text-white transition-colors cursor-pointer"
              >
                /voice-engine
              </button>
              <button 
                onClick={() => document.getElementById("ats-fusion")?.scrollIntoView({ behavior: "smooth" })}
                className="hover:text-white transition-colors cursor-pointer"
              >
                /ats-fusion
              </button>
              <button 
                onClick={() => document.getElementById("benchmarks")?.scrollIntoView({ behavior: "smooth" })}
                className="hover:text-white transition-colors cursor-pointer"
              >
                /benchmarks
              </button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setIsRegistering(false);
                setShowAuthModal(true);
              }}
              className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 transition-colors cursor-pointer font-medium font-mono"
            >
              Sign In
            </button>
            <button
              onClick={handleGuestLogin}
              className="render-btn-primary"
            >
              <span>Launch Sandbox Round</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── HERO SECTION (RENDER DEVELOPER THEME) ─── */}
      <section className="pt-16 pb-14 px-6 max-w-5xl mx-auto text-center space-y-5">
        
        {/* Render Live Badge */}
        <div className="inline-flex items-center gap-2">
          <span className="render-status-live">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Gemini Multimodal Live Speech Online
          </span>
          <span className="text-xs font-mono text-zinc-500">·</span>
          <span className="text-xs font-mono text-zinc-400">PostgreSQL + Prisma 7</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight max-w-4xl mx-auto leading-tight">
          Autonomous Voice-Driven Technical Interviews
        </h1>

        {/* Hero Subtitle */}
        <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Practice realistic engineering interviews with a real-time AI interviewer. Sub-450ms bidirectional voice streaming, dynamic drill-down questions, and recruiter hiring rubrics.
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={handleGuestLogin}
            disabled={loading}
            className="render-btn-primary h-10 px-5 text-sm"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : (
              <>
                <span>Launch Free Sandbox Session</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
          <button
            onClick={() => {
              setIsRegistering(true);
              setShowAuthModal(true);
            }}
            className="render-btn-secondary h-10 px-4 text-xs font-mono"
          >
            Create Developer Account
          </button>
        </div>

        {/* Quick Tech Badges */}
        <div className="flex flex-wrap justify-center items-center gap-4 pt-3 text-[11px] font-mono text-zinc-500">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3 text-emerald-400" />
            16kHz PCM Web Audio Streaming
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3 text-emerald-400" />
            Zero-Token Simulated Fallback
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3 text-emerald-400" />
            STAR Evaluation Diagnostics
          </span>
        </div>
      </section>

      {/* ─── LIVE INTERACTIVE TERMINAL / CONSOLE PREVIEW ─── */}
      <section id="architecture" className="max-w-5xl mx-auto px-6 pb-20">
        <div className="render-card overflow-hidden">
          
          {/* Terminal Window Header Bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-black/60">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-red-500/80" />
              <span className="size-2.5 rounded-full bg-yellow-500/80" />
              <span className="size-2.5 rounded-full bg-emerald-500/80" />
              <span className="text-xs font-mono text-zinc-400 ml-2">hyrd-telemetry://gemini-live/session-demo</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                CONNECTED (24kHz PCM)
              </span>
            </div>
          </div>

          {/* Interactive Role Switcher Tabs */}
          <div className="flex border-b border-zinc-800 bg-[#09090b] overflow-x-auto text-xs font-mono">
            {(["system", "dsa", "frontend", "fullstack"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 border-r border-zinc-800 cursor-pointer transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? "bg-[#0c0c0e] text-white border-b-2 border-b-white font-semibold"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab === "system" && "Distributed Systems"}
                {tab === "dsa" && "Algorithms & DSA"}
                {tab === "frontend" && "Frontend Architecture"}
                {tab === "fullstack" && "Fullstack / Engineering Lead"}
              </button>
            ))}
          </div>

          {/* Terminal Body */}
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                  Round: {currentTrack.round}
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  Target Level: <span className="text-white">{currentTrack.target}</span>
                </span>
              </div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Interviewer Question
              </h3>
            </div>

            {/* Question Card */}
            <div className="p-4 rounded border border-zinc-800 bg-black/50 space-y-3 font-mono text-xs">
              <div className="flex items-center gap-2 text-zinc-400">
                <Mic className="size-3.5 text-blue-400" />
                <span className="text-zinc-300 font-semibold">{currentTrack.agentPersona} speaks:</span>
              </div>
              <p className="text-zinc-200 leading-relaxed font-sans text-sm pl-5 border-l-2 border-blue-500">
                "{currentTrack.question}"
              </p>
            </div>

            {/* Evaluation Signals & Expected Depth */}
            <div className="space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                Core Architectural Signals Graded
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
                {currentTrack.expectedConcepts.map((concept, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 rounded bg-black/40 border border-zinc-800/80 text-zinc-300">
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                    <span>{concept}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Bar inside Terminal */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-zinc-800">
              <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
                <Activity className="size-3.5 text-emerald-400" />
                <span>Audio Latency: <strong className="text-white">380ms</strong></span>
                <span>·</span>
                <span>Adaptive Difficulty: <strong className="text-white">Active</strong></span>
              </div>
              <button
                onClick={handleGuestLogin}
                className="render-btn-primary text-xs"
              >
                <span>Launch This Question in Real Voice</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── DEVELOPER PILLARS (RENDER ARCHITECTURAL CARDS) ─── */}
      <section id="voice-engine" className="max-w-5xl mx-auto px-6 pb-24 space-y-8">
        <div className="space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
            Platform Capabilities
          </span>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Engineered for Serious Technical Rigor
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Card 1: Voice Engine */}
          <div className="render-card p-5 space-y-3">
            <div className="size-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400">
              <Volume2 className="size-4" />
            </div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Bidirectional Gemini Voice
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              Real-time WebSocket audio streaming using Gemini Live native audio. Sub-second latency, natural conversational interruptions, and speech rate pacing.
            </p>
            <div className="pt-2 text-[11px] font-mono text-zinc-500 border-t border-zinc-800">
              <code>wss://generativelanguage.../BidiGenerateContent</code>
            </div>
          </div>

          {/* Card 2: ATS Intelligence */}
          <div id="ats-fusion" className="render-card p-5 space-y-3">
            <div className="size-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-blue-400">
              <FileCode2 className="size-4" />
            </div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              ATS & Profile Knowledge Fusion
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              Extracts verifiable technical projects from your PDF resume and GitHub repositories, feeding concrete codebase context into the interviewer.
            </p>
            <div className="pt-2 text-[11px] font-mono text-zinc-500 border-t border-zinc-800">
              <code>POST /api/v1/ats/analyze (6 Weighted Categories)</code>
            </div>
          </div>

          {/* Card 3: Hiring Committee Diagnostics */}
          <div id="benchmarks" className="render-card p-5 space-y-3">
            <div className="size-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center text-indigo-400">
              <BarChart3 className="size-4" />
            </div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Recruiter & Committee Reports
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              Graded on defined engineering rubrics (0-10). Produces complete STAR breakdown, candidate weakness mapping, and structured hiring verdicts.
            </p>
            <div className="pt-2 text-[11px] font-mono text-zinc-500 border-t border-zinc-800">
              <code>Decision: YES/NO with Confidence Metrics</code>
            </div>
          </div>

        </div>
      </section>

      {/* ─── AUTHENTICATION MODAL (CLEAN RENDER DEVELOPER POPUP) ─── */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="render-card w-full max-w-sm p-6 space-y-5 bg-[#0c0c0e] border-zinc-800 shadow-2xl relative">
            
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="size-5 rounded bg-white flex items-center justify-center font-black text-black text-[10px] font-mono">
                  H
                </div>
                <h3 className="text-base font-bold text-white">
                  {isRegistering ? "Create Developer Account" : "Sign In to HYRD"}
                </h3>
              </div>
              <p className="text-xs text-zinc-400">
                {isRegistering ? "Access persistent interview archives and ATS audits." : "Welcome back to your interview workspace."}
              </p>
            </div>

            {/* Quick 1-Click Guest Option */}
            <div className="p-3 rounded bg-zinc-900 border border-zinc-800 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-300 font-semibold font-mono">Instant Sandbox Round</span>
                <span className="render-status-live">Zero Setup</span>
              </div>
              <button
                type="button"
                onClick={handleGuestLogin}
                disabled={loading}
                className="w-full h-8 render-btn-primary text-xs justify-center font-mono"
              >
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : "Enter Sandbox Immediately"}
              </button>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-zinc-800 w-full" />
              <span className="bg-[#0c0c0e] px-2 text-[10px] font-mono text-zinc-500 uppercase">
                or email credentials
              </span>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-3">
              {isRegistering && (
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-zinc-400">Developer Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Rivera"
                    className="w-full bg-black border border-zinc-800 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-mono text-zinc-400">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="developer@example.com"
                  className="w-full bg-black border border-zinc-800 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-mono text-zinc-400">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-black border border-zinc-800 rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-zinc-500 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-9 bg-zinc-200 hover:bg-white text-black font-semibold text-xs rounded transition-colors mt-2 cursor-pointer flex items-center justify-center gap-1.5 font-mono"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : isRegistering ? "Register Account" : "Sign In"}
              </button>
            </form>

            {/* Social Simulated OAuth */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleSocialSignIn("github")}
                className="h-8 render-btn-secondary text-[11px] font-mono justify-center"
              >
                <GitBranch className="size-3" />
                GitHub
              </button>
              <button
                type="button"
                onClick={() => handleSocialSignIn("google")}
                className="h-8 render-btn-secondary text-[11px] font-mono justify-center"
              >
                <Sparkles className="size-3" />
                Google
              </button>
            </div>

            <div className="text-center pt-2 text-xs text-zinc-500 font-mono">
              {isRegistering ? "Existing account?" : "Need an account?"}{" "}
              <button
                type="button"
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-white hover:underline font-semibold cursor-pointer"
              >
                {isRegistering ? "Sign in" : "Create one"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── FOOTER BAR (RENDER DEVELOPER STYLE) ─── */}
      <footer className="border-t border-zinc-800/80 bg-black py-8 px-6 text-xs text-zinc-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="size-4 rounded bg-white flex items-center justify-center font-black text-black text-[9px] font-mono">
              H
            </div>
            <span className="font-bold text-zinc-300">HYRD Cloud</span>
            <span>— AI-Powered Voice Engineering Interviews</span>
          </div>
          <div className="flex items-center gap-4 text-zinc-400">
            <span>Bun 1.3</span>
            <span>·</span>
            <span>Prisma 7.8</span>
            <span>·</span>
            <span>Gemini Live API</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
