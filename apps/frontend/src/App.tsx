import "styles/globals.css";
import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router";
import { Toaster } from "sonner";
import { authClient } from "./lib/auth";

// Components & Layout
import { Login } from "./components/Login";
import { SidebarLayout } from "./components/SidebarLayout";
import { Interview } from "./components/Interview";
import { Result } from "./components/Result";

// Workspace Sub-views
import { DashboardView } from "./components/workspace/DashboardView";
import { HistoryView } from "./components/workspace/HistoryView";
import { SettingsView } from "./components/workspace/SettingsView";
import { AtsView } from "./components/workspace/AtsView";

// Orchestrator Check for Base Root /
function RootCheckpoint() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    // Safety fallback: if session checking hangs for more than 1.5 seconds, fall back gracefully
    const timer = setTimeout(() => {
      const isGuest = localStorage.getItem("hyrd_guest_mode") === "true";
      if (isGuest) {
        navigate("/dashboard");
      } else {
        navigate("/login");
      }
    }, 1500);

    if (!isPending) {
      clearTimeout(timer);
      const isGuest = localStorage.getItem("hyrd_guest_mode") === "true";
      if (isGuest) {
        navigate("/dashboard");
      } else if (!session) {
        navigate("/login");
      } else {
        navigate("/dashboard");
      }
    }

    return () => clearTimeout(timer);
  }, [session, isPending, navigate]);

  return (
    <div className="min-h-screen w-screen bg-black flex flex-col justify-center items-center gap-3">
      <div className="size-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      <p className="text-[11px] text-zinc-500 font-mono tracking-wider">
        Loading Workspace...
      </p>
    </div>
  );
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    const isGuest = localStorage.getItem("hyrd_guest_mode") === "true";
    if (!isPending && !session && !isGuest) {
      navigate("/login");
    }
  }, [session, isPending, navigate]);

  if (isPending) {
    return (
      <div className="min-h-screen w-screen bg-black flex flex-col justify-center items-center gap-3">
        <div className="size-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Base Orchestration checkpoints */}
        <Route path="/" element={<RootCheckpoint />} />
        <Route path="/login" element={<Login />} />

        {/* Workspace Sidebar Wrapper */}
        <Route 
          element={
            <ProtectedRoute>
              <SidebarLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardView />} />
          <Route path="/workspace/interviews" element={<HistoryView />} />
          <Route path="/workspace/ats" element={<AtsView />} />
          <Route path="/workspace/ats/:analysisId" element={<AtsView />} />
          <Route path="/workspace/settings" element={<SettingsView />} />
          <Route path="/interview/:interviewId" element={<Interview />} />
          <Route path="/result/:interviewId" element={<Result />} />
        </Route>
      </Routes>
      <Toaster position="bottom-left" theme="dark" />
    </BrowserRouter>
  );
}

export default App;
