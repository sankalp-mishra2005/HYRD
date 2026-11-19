import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation, Outlet } from "react-router";
import { authClient, signOut } from "../lib/auth";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LogOut, 
  Menu,
  Search,
  CheckCircle2,
  Settings,
  ChevronDown,
  User as UserIcon,
} from "lucide-react";
import { Button } from "./ui/button";
import { CommandPalette } from "./CommandPalette";

export function SidebarLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session, isPending } = authClient.useSession();
  const isGuest = localStorage.getItem("hyrd_guest_mode") === "true";
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Keyboard shortcut listener for Ctrl + K Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!isPending && !session && !isGuest) {
      navigate("/login");
    }
  }, [session, isPending, isGuest, navigate]);

  if (isPending) {
    return (
      <div className="min-h-screen w-screen bg-black flex flex-col justify-center items-center gap-3">
        <div className="size-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        <p className="text-[11px] text-zinc-500 font-mono tracking-wider">
          Connecting to workspace...
        </p>
      </div>
    );
  }

  if (!session && !isGuest) {
    return null;
  }

  const currentUser = session?.user || (isGuest ? {
    name: "Guest Developer",
    email: "guest@hyrd.ai",
  } as any : null);

  const userInitials = (currentUser?.name || "Candidate")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleLogout() {
    try {
      localStorage.removeItem("hyrd_guest_mode");
      if (session) {
        await signOut();
      }
      toast.success("Logged out successfully");
      navigate("/login");
    } catch (e) {
      toast.error("Logout failed");
    }
  }

  const navItems = [
    { label: "Dashboard", path: "/dashboard", iconName: "terminal" },
    { label: "AI Interview", path: "/workspace/interviews", iconName: "mic" },
    { label: "ATS Checker", path: "/workspace/ats", iconName: "document_scanner" },
    { label: "Settings", path: "/workspace/settings", iconName: "settings" },
  ];

  return (
    <div className="min-h-screen w-screen bg-black text-[#ededed] flex relative overflow-hidden antialiased">

      {/* ─── RENDER DEVELOPER SIDEBAR ─── */}
      <aside 
        className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-60 border-r border-zinc-800 bg-black z-50 shrink-0"
      >
        {/* Brand Header */}
        <div className="h-14 flex items-center px-5 gap-2.5 border-b border-zinc-800/80">
          <div className="size-6 rounded bg-white flex items-center justify-center font-black text-black text-xs font-mono shadow-sm">
            H
          </div>
          <span className="font-bold tracking-tight text-white text-base">HYRD</span>
          <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.2 rounded ml-auto">
            v1.1
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-semibold">
            Services
          </div>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== "/dashboard" && location.pathname.startsWith(item.path));

            return (
              <Link key={item.label} to={item.path} className="block">
                <div
                  className={`flex items-center h-8 px-3 rounded-md transition-all gap-2.5 text-xs font-medium ${
                    isActive 
                      ? "bg-zinc-900 text-white border border-zinc-800 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] text-zinc-400">{item.iconName}</span>
                  <span>{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* System Status Footer */}
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/60">
          <div className="flex items-center justify-between px-2 py-1.5 text-xs text-zinc-500 font-mono">
            <span className="flex items-center gap-1.5 text-zinc-300 text-[11px]">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Engine Online
            </span>
            <span className="text-[10px] text-zinc-600 font-medium">LIVE</span>
          </div>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <div className="flex md:hidden absolute top-0 left-0 right-0 h-14 border-b border-zinc-800 bg-black/90 backdrop-blur px-4 items-center justify-between z-30">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded bg-white flex items-center justify-center font-black text-black text-xs font-mono">
            H
          </div>
          <span className="font-bold text-sm text-white">HYRD</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            onClick={() => setCommandPaletteOpen(true)}
            className="size-8 p-0 text-zinc-400 hover:text-white cursor-pointer"
          >
            <Search className="size-4" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="size-8 p-0 text-zinc-400 hover:text-white cursor-pointer"
          >
            <Menu className="size-4" />
          </Button>
        </div>
      </div>

      {/* MOBILE DRAWER */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.2 }}
            className="fixed inset-y-0 left-0 w-64 bg-black border-r border-zinc-800 p-4 flex flex-col z-50 md:hidden"
          >
            <div className="flex justify-between items-center mb-6 pb-3 border-b border-zinc-800">
              <span className="font-bold text-sm text-white">Menu</span>
              <Button variant="ghost" onClick={() => setMobileOpen(false)} className="text-zinc-400 text-xs cursor-pointer">
                Close
              </Button>
            </div>
            <nav className="flex-1 space-y-1">
              {navItems.map((item) => (
                <Link key={item.label} to={item.path} onClick={() => setMobileOpen(false)}>
                  <div className="flex items-center gap-2.5 p-2 rounded-md hover:bg-zinc-900 text-zinc-300 text-xs font-medium">
                    <span className="material-symbols-outlined text-[16px] text-zinc-400">{item.iconName}</span>
                    <span>{item.label}</span>
                  </div>
                </Link>
              ))}
            </nav>
            <button 
              onClick={() => { setMobileOpen(false); handleLogout(); }}
              className="w-full text-left flex items-center gap-2 p-2 rounded-md text-red-400 hover:bg-red-500/10 text-xs font-medium border-0 bg-transparent cursor-pointer mt-auto"
            >
              <LogOut className="size-4 text-red-400" />
              <span>Sign out</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── MAIN CONTENT ─── */}
      <main className="flex-1 pl-0 md:pl-60 flex flex-col min-w-0 bg-black min-h-screen">
        
        {/* Top Header Controls Bar */}
        <header className="hidden md:flex fixed top-0 right-0 left-60 h-14 bg-black/90 backdrop-blur-md border-b border-zinc-800/80 z-40">
          <div className="max-w-7xl mx-auto w-full h-full flex items-center justify-between px-6">
            
            {/* Search Input Bar (Render Command Palette Style) */}
            <div className="flex-1 max-w-sm">
              <div 
                onClick={() => setCommandPaletteOpen(true)}
                className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-md text-xs text-zinc-400 cursor-pointer transition-colors"
              >
                <Search className="size-3.5 text-zinc-500" />
                <span className="text-xs text-zinc-400">Search commands, docs, actions...</span>
                <kbd className="ml-auto font-mono text-[10px] text-zinc-500 bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded">
                  Ctrl K
                </kbd>
              </div>
            </div>
            
            {/* Right Controls & Developer Profile */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <button 
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2.5 hover:bg-zinc-900 px-2.5 py-1 rounded-md transition-colors bg-transparent border-0 cursor-pointer text-left"
                >
                  {/* Clean Developer Initials Badge */}
                  <div className="size-6 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-mono font-bold text-white">
                    {userInitials}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-xs font-medium text-zinc-200">{currentUser?.name || "Developer"}</div>
                  </div>
                  <ChevronDown className="size-3.5 text-zinc-500" />
                </button>

                {/* Profile Dropdown */}
                <AnimatePresence>
                  {profileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 mt-1 w-48 rounded-md bg-[#0d0d10] border border-zinc-800 shadow-2xl p-1 z-50 flex flex-col gap-0.5 font-sans"
                    >
                      <div className="px-2.5 py-2 border-b border-zinc-800/80 mb-1">
                        <p className="text-xs font-semibold text-white truncate">{currentUser?.name || "Developer"}</p>
                        <p className="text-[10px] text-zinc-500 font-mono truncate">{currentUser?.email || "developer@hyrd.ai"}</p>
                      </div>

                      <Link to="/workspace/settings" onClick={() => setProfileOpen(false)}>
                        <div className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors">
                          <Settings className="size-3.5" />
                          Account Settings
                        </div>
                      </Link>

                      <div className="h-px bg-zinc-800/80 my-1" />

                      <button 
                        onClick={() => { setProfileOpen(false); handleLogout(); }}
                        className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 text-xs rounded text-red-400 hover:bg-red-500/10 border-0 bg-transparent cursor-pointer transition-colors font-medium"
                      >
                        <LogOut className="size-3.5 text-red-400" />
                        Sign out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

          </div>
        </header>

        {/* Dynamic Nested Sub-view */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pt-18 max-w-7xl mx-auto w-full relative">
          <Outlet />
        </div>
      </main>

      <CommandPalette open={commandPaletteOpen} setOpen={setCommandPaletteOpen} />
    </div>
  );
}
