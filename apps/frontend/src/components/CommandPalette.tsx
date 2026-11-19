import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Search, LayoutDashboard, BrainCircuit, FileText, Briefcase, TrendingUp, Settings, HelpCircle } from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function CommandPalette({ open, setOpen }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = [
    { label: "Go to Dashboard", category: "Navigation", path: "/dashboard", icon: LayoutDashboard },
    { label: "Start Practice Interview", category: "Interview", path: "/workspace/interviews", icon: BrainCircuit },
    { label: "View Practice History", category: "Interview", path: "/workspace/interviews", icon: BrainCircuit },
    { label: "ATS Resume Checker", category: "ATS", path: "/workspace/ats", icon: FileText },
    { label: "Job Description Matcher", category: "ATS", path: "/workspace/ats", icon: Briefcase },
    { label: "Configure Preferences & Profile", category: "Settings", path: "/workspace/settings", icon: Settings },
  ];

  // Filter commands based on fuzzy query search
  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  // Focus input automatically on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation handler
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = filtered[selectedIndex];
        if (selected) {
          navigate(selected.path);
          setOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, filtered, selectedIndex, navigate, setOpen]);

  // Click outside listener
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh] px-4"
        >
          <motion.div
            ref={containerRef}
            initial={{ scale: 0.98, y: -6 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.98, y: -6 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-[550px] rounded-md border border-zinc-800 bg-[#0c0c0e] shadow-2xl overflow-hidden font-sans"
          >
            {/* Search Input block */}
            <div className="flex items-center gap-3 px-4 border-b border-zinc-800 h-12 bg-black">
              <Search className="size-4 text-zinc-500 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command or search workspace..."
                className="w-full h-full bg-transparent border-0 text-white text-xs outline-none placeholder:text-zinc-600"
              />
              <span className="bg-zinc-900 border border-zinc-800 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded text-zinc-500">
                ESC
              </span>
            </div>

            {/* Commands List */}
            <div className="max-h-[300px] overflow-y-auto p-2">
              {filtered.length > 0 ? (
                filtered.map((cmd, idx) => {
                  const Icon = cmd.icon;
                  const isSelected = idx === selectedIndex;

                  return (
                    <div
                      key={cmd.label + idx}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => {
                        navigate(cmd.path);
                        setOpen(false);
                      }}
                      className={`flex items-center justify-between px-3 py-2 rounded cursor-pointer transition-colors ${
                        isSelected 
                          ? "bg-zinc-900 text-white" 
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`size-4 ${isSelected ? "text-emerald-400" : "text-zinc-500"}`} />
                        <span className="text-xs font-medium">{cmd.label}</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 bg-black px-1.5 py-0.5 rounded border border-zinc-800">
                        {cmd.category}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center text-zinc-500 gap-2 font-mono text-xs">
                  <HelpCircle className="size-6 text-zinc-600" />
                  <p>No results for "{query}"</p>
                </div>
              )}
            </div>
            
            {/* Navigation instructions footer */}
            <div className="h-8 px-4 bg-black border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
              <span className="flex items-center gap-1">
                Navigate <kbd className="bg-zinc-900 border border-zinc-800 px-1 rounded">↑</kbd> <kbd className="bg-zinc-900 border border-zinc-800 px-1 rounded">↓</kbd>
              </span>
              <span>
                Select <kbd className="bg-zinc-900 border border-zinc-800 px-1 rounded">Enter</kbd>
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
