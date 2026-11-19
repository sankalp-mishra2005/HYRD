import { useState, useEffect } from "react";
import axios from "axios";
import { BACKEND_URL } from "../../lib/config";
import { toast } from "sonner";
import { 
  User, 
  Settings, 
  Loader2, 
  Zap, 
  Languages, 
  Moon, 
  Github, 
  Linkedin,
  ShieldCheck
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { authClient } from "../../lib/auth";

export function SettingsView() {
  const { data: session } = authClient.useSession();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tier, setTier] = useState("Free");

  // Profile Form States
  const [targetRole, setTargetRole] = useState("Software Engineer");
  const [experienceLevel, setExperienceLevel] = useState("Fresher");
  const [goalCompany, setGoalCompany] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");

  // Preferences Form States
  const [theme, setTheme] = useState("system");
  const [language, setLanguage] = useState("English");
  const [voice, setVoice] = useState("alloy");
  const [interviewLength, setInterviewLength] = useState("30");

  useEffect(() => {
    // Fetch initial profile & settings values
    axios.get(`${BACKEND_URL}/api/v1/settings`, {
      withCredentials: true,
    })
    .then((res) => {
      const { profile, settings } = res.data;
      if (profile) {
        setTargetRole(profile.targetRole || "Software Engineer");
        setExperienceLevel(profile.experienceLevel || "Fresher");
        setGoalCompany(profile.goalCompany || "");
        setGithubUrl(profile.githubUrl || "");
        setLinkedinUrl(profile.linkedinUrl || "");
      }
      if (settings) {
        setTheme(settings.theme || "system");
        setLanguage(settings.language || "English");
        setVoice(settings.voice || "alloy");
        setInterviewLength(String(settings.interviewLength || 30));
      }
      if ((session?.user as any)?.tier) {
        setTier((session?.user as any)?.tier);
      }
    })
    .catch((err) => {
      console.error(err);
      toast.error("Failed to load settings configuration");
    })
    .finally(() => {
      setLoading(false);
    });
  }, [session]);

  // Save configurations trigger
  async function handleSaveSettings() {
    setSaving(true);
    try {
      // 1. Save Profile
      await axios.put(`${BACKEND_URL}/api/v1/settings/profile`, {
        targetRole,
        experienceLevel,
        goalCompany,
        githubUrl,
        linkedinUrl,
      }, {
        withCredentials: true,
      });

      // 2. Save Preferences
      await axios.put(`${BACKEND_URL}/api/v1/settings/preferences`, {
        theme,
        language,
        voice,
        interviewLength: parseInt(interviewLength, 10),
      }, {
        withCredentials: true,
      });

      toast.success("Workspace configuration updated successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-zinc-900 rounded w-1/4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-72 bg-zinc-900 rounded md:col-span-2" />
          <div className="h-72 bg-zinc-900 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full max-w-7xl mx-auto space-y-6 font-sans">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-white tracking-tight">Workspace Configuration</h1>
            <span className="render-status-live">✓ Active Profile</span>
          </div>
          <p className="text-xs text-zinc-400">
            Calibrate your target role defaults, speech preferences, and developer profile links.
          </p>
        </div>

        <Button
          onClick={handleSaveSettings}
          disabled={saving}
          className="render-btn-primary"
        >
          {saving ? (
            <>
              <Loader2 className="size-3.5 animate-spin mr-1.5" />
              <span>Saving...</span>
            </>
          ) : (
            <span>Save Configuration</span>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* ─── LEFT COLUMN: PROFILE & PREFERENCES (2 cols) ─── */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Profile Card */}
          <div className="render-card p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-zinc-300 uppercase tracking-wider">
                <User className="size-3.5 text-zinc-400" />
                <span>Career Profile</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">context parameters</span>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Target Role */}
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs font-semibold">Default Target Role</Label>
                  <Select value={targetRole} onValueChange={setTargetRole}>
                    <SelectTrigger className="h-9 rounded bg-black border-zinc-800 text-xs text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0c0c0e] border-zinc-800 text-xs text-white">
                      <SelectItem value="Software Engineer">Software Engineer</SelectItem>
                      <SelectItem value="Frontend Engineer">Frontend Engineer</SelectItem>
                      <SelectItem value="Backend Engineer">Backend Engineer</SelectItem>
                      <SelectItem value="AI/ML Engineer">AI/ML Engineer</SelectItem>
                      <SelectItem value="Fullstack Engineer">Fullstack Engineer</SelectItem>
                      <SelectItem value="Product Manager">Product Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Experience level */}
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs font-semibold">Experience Level</Label>
                  <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                    <SelectTrigger className="h-9 rounded bg-black border-zinc-800 text-xs text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0c0c0e] border-zinc-800 text-xs text-white">
                      <SelectItem value="Fresher">Graduate / Fresher</SelectItem>
                      <SelectItem value="Junior">Junior (1-2 years)</SelectItem>
                      <SelectItem value="Mid-Level">Mid-Level (3-5 years)</SelectItem>
                      <SelectItem value="Senior">Senior (5+ years)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Goal Company */}
              <div className="space-y-1.5">
                <Label className="text-zinc-400 text-xs font-semibold">Primary Goal Company</Label>
                <Input 
                  value={goalCompany}
                  onChange={(e) => setGoalCompany(e.target.value)}
                  placeholder="e.g. Stripe, OpenAI, Google"
                  className="h-9 rounded bg-black border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus-visible:ring-zinc-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* GitHub */}
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs font-semibold flex items-center gap-1.5">
                    <Github className="size-3 text-zinc-400" />
                    GitHub Profile
                  </Label>
                  <Input 
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/username"
                    className="h-9 rounded bg-black border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus-visible:ring-zinc-500"
                  />
                </div>

                {/* LinkedIn */}
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs font-semibold flex items-center gap-1.5">
                    <Linkedin className="size-3 text-zinc-400" />
                    LinkedIn Profile
                  </Label>
                  <Input 
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="h-9 rounded bg-black border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus-visible:ring-zinc-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Preferences Card */}
          <div className="render-card p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-zinc-300 uppercase tracking-wider">
                <Settings className="size-3.5 text-zinc-400" />
                <span>Interviewer Session Preferences</span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">audio / proctor</span>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Theme */}
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs font-semibold flex items-center gap-1.5">
                    <Moon className="size-3 text-zinc-400" />
                    Display Theme
                  </Label>
                  <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger className="h-9 rounded bg-black border-zinc-800 text-xs text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0c0c0e] border-zinc-800 text-xs text-white">
                      <SelectItem value="dark">Dark Theme (Render)</SelectItem>
                      <SelectItem value="system">System Default</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Language */}
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs font-semibold flex items-center gap-1.5">
                    <Languages className="size-3 text-zinc-400" />
                    Spoken Language
                  </Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="h-9 rounded bg-black border-zinc-800 text-xs text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0c0c0e] border-zinc-800 text-xs text-white">
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Hindi">Hindi</SelectItem>
                      <SelectItem value="Hinglish">Hinglish</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Voice */}
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs font-semibold">Gemini Live Voice Voice</Label>
                  <Select value={voice} onValueChange={setVoice}>
                    <SelectTrigger className="h-9 rounded bg-black border-zinc-800 text-xs text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0c0c0e] border-zinc-800 text-xs text-white">
                      <SelectItem value="alloy">Alloy (Balanced)</SelectItem>
                      <SelectItem value="echo">Echo (Male)</SelectItem>
                      <SelectItem value="shimmer">Shimmer (Female)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Length */}
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-xs font-semibold">Default Interview Duration</Label>
                  <Select value={interviewLength} onValueChange={setInterviewLength}>
                    <SelectTrigger className="h-9 rounded bg-black border-zinc-800 text-xs text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0c0c0e] border-zinc-800 text-xs text-white">
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="45">45 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ─── RIGHT COLUMN: SUBSCRIPTION & PLAN (1 col) ─── */}
        <div className="space-y-6">
          
          {/* Subscription Plan Card */}
          <div className="render-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <span className="text-[10px] text-zinc-500 font-mono font-semibold uppercase tracking-wider">Plan & Quotas</span>
              <span className="render-status-live">✓ Active</span>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="size-4 text-emerald-400" />
                <span>{tier} Developer Account</span>
              </h3>
              <p className="text-xs text-zinc-400">
                Full platform access to AI Interviewer & ATS Intelligence
              </p>
            </div>

            <div className="pt-2 border-t border-zinc-800/80 space-y-2 text-xs font-sans">
              <div className="flex items-center gap-2 text-zinc-300">
                <ShieldCheck className="size-3.5 text-emerald-400 shrink-0" />
                <span>Unlimited ATS resume audits</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <ShieldCheck className="size-3.5 text-emerald-400 shrink-0" />
                <span>Real-time Gemini Live voice mock interviews</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <ShieldCheck className="size-3.5 text-emerald-400 shrink-0" />
                <span>Evidence-based STAR bullet suggestions</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <ShieldCheck className="size-3.5 text-emerald-400 shrink-0" />
                <span>Command palette navigation (Ctrl+K)</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
