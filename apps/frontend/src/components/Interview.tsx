import { BACKEND_URL } from "@/lib/config";
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import {
  Loader2,
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  RotateCcw,
  Send,
  MessageSquare,
  Clock,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  User,
  Shield,
  HelpCircle,
  FileText
} from "lucide-react";
import { Button } from "./ui/button";
import axios from "axios";
import { toast } from "sonner";

type Status = "lobby" | "connecting" | "live" | "ending";

interface DialogueMessage {
  sender: "Assistant" | "User";
  text: string;
  time?: string;
}

export function Interview() {
  const { interviewId } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState<Status>("lobby");
  const [interviewMeta, setInterviewMeta] = useState<any>(null);

  // Audio / Visual levels
  const [userMicLevel, setUserMicLevel] = useState(0);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  // Conversation state
  const [dialogue, setDialogue] = useState<DialogueMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showTranscript, setShowTranscript] = useState(true);

  // Audio & WebSockets
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackAudioContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const activeAudioSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const isSpeakingRef = useRef(false);
  const recognitionRef = useRef<any>(null);
  const spokenTranscriptRef = useRef<string>("");

  // Helper: Play real 24kHz linear PCM audio chunks streamed from Gemini Live
  const playPcmChunk = (base64Data: string) => {
    try {
      if (!playbackAudioContextRef.current || playbackAudioContextRef.current.state === "closed") {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        playbackAudioContextRef.current = new AudioCtx({ sampleRate: 24000 });
      }
      const ctx = playbackAudioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }

      const binary = atob(base64Data);
      const len = binary.length;
      const evenLen = len - (len % 2);
      if (evenLen === 0) return;

      const bytes = new Uint8Array(evenLen);
      for (let i = 0; i < evenLen; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const int16 = new Int16Array(bytes.buffer, 0, evenLen / 2);
      const numSamples = int16.length;
      if (numSamples === 0) return;

      const float32 = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        float32[i] = (int16[i] ?? 0) / 32768.0;
      }

      const audioBuffer = ctx.createBuffer(1, numSamples, 24000);
      audioBuffer.copyToChannel(float32, 0);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const startTime = Math.max(ctx.currentTime, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;

      setIsAiSpeaking(true);
      activeAudioSourcesRef.current.push(source);

      source.onended = () => {
        activeAudioSourcesRef.current = activeAudioSourcesRef.current.filter((s) => s !== source);
        if (activeAudioSourcesRef.current.length === 0 && ctx.currentTime >= nextPlayTimeRef.current - 0.05) {
          setIsAiSpeaking(false);
        }
      };
    } catch (err) {
      console.warn("PCM audio playback notice:", err);
    }
  };

  const stopAllAiAudio = () => {
    for (const s of activeAudioSourcesRef.current) {
      try {
        s.stop();
        s.disconnect();
      } catch (e) {}
    }
    activeAudioSourcesRef.current = [];
    nextPlayTimeRef.current = 0;
    setIsAiSpeaking(false);
  };

  // Elapsed timer
  useEffect(() => {
    if (status !== "live") return;
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const formatElapsed = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Load interview configuration metadata
  useEffect(() => {
    axios
      .get(`${BACKEND_URL}/api/v1/interviews/details/${interviewId}`, { withCredentials: true })
      .then((res) => {
        setInterviewMeta(res.data);
      })
      .catch((err) => {
        console.warn("Could not load interview details:", err?.message);
      });
  }, [interviewId]);

  // Start webcam for lobby preview
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true,
      });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Audio meter for testing mic in lobby
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLobbyMic = () => {
        if (!cameraStreamRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i]!;
        const avg = sum / dataArray.length;
        setUserMicLevel(Math.min(1, avg / 50));
        requestAnimationFrame(updateLobbyMic);
      };
      updateLobbyMic();
    } catch (e) {
      console.warn("Camera/microphone preview setup:", e);
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      cleanup();
    };
  }, [interviewId]);

  // Human Speech Synthesis: speaks interviewer questions naturally aloud
  const speakQuestion = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Select a natural, professional voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(
        (v) =>
          v.name.includes("Natural") ||
          v.name.includes("Google US English") ||
          v.name.includes("Samantha") ||
          v.name.includes("Jenny") ||
          v.lang === "en-US"
      );
      if (preferred) utterance.voice = preferred;

      utterance.onstart = () => {
        setIsAiSpeaking(true);
        isSpeakingRef.current = true;
      };
      utterance.onend = () => {
        setIsAiSpeaking(false);
        isSpeakingRef.current = false;
      };
      utterance.onerror = () => {
        setIsAiSpeaking(false);
        isSpeakingRef.current = false;
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("Speech synthesis error:", e);
    }
  }, []);

  // Join the Live Interview Session
  const handleJoinInterview = async () => {
    setStatus("connecting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost = BACKEND_URL.replace("http://", "").replace("https://", "");
      const wsUrl = `${protocol}//${wsHost}/api/v1/interviews/session/${interviewId}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = async (event) => {
        try {
          const json = JSON.parse(event.data);

          // Assistant Model Turn: Audio playback and Question Text
          if (json.serverContent?.modelTurn?.parts) {
            let partText = "";
            for (const part of json.serverContent.modelTurn.parts) {
              if (part.inlineData?.data) {
                playPcmChunk(part.inlineData.data);
              }
              if (part.text) {
                partText += part.text;
              }
            }
            if (partText) {
              const cleanText = partText.trim();
              if (cleanText) {
                const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                setDialogue((prev) => {
                  // Prevent duplicate entries
                  if (prev.some((m) => m.sender === "Assistant" && m.text === cleanText)) {
                    return prev;
                  }
                  return [...prev, { sender: "Assistant", text: cleanText, time }];
                });
              }
            }
          }

          // User Turn Text (if transcribed from backend stream)
          if (json.serverContent?.userTurn?.parts) {
            let partText = "";
            for (const part of json.serverContent.userTurn.parts) {
              if (part.text) partText += part.text;
            }
            if (partText) {
              const cleanText = partText.trim();
              if (cleanText) {
                const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                setDialogue((prev) => {
                  if (prev.some((m) => m.sender === "User" && m.text === cleanText)) {
                    return prev;
                  }
                  return [...prev, { sender: "User", text: cleanText, time }];
                });
              }
            }
          }
        } catch (err) {
          console.error("Error processing message:", err);
        }
      };

      ws.onopen = async () => {
        if (audioContextRef.current?.state === "suspended") {
          await audioContextRef.current.resume();
        }
        setStatus("live");

        const source = audioContext.createMediaStreamSource(stream);
        const scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1);
        scriptProcessorRef.current = scriptProcessor;

        scriptProcessor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const inputData = e.inputBuffer.getChannelData(0);

          let sum = 0;
          for (let i = 0; i < inputData.length; i++) sum += Math.abs(inputData[i]!);
          const rms = sum / inputData.length;
          setUserMicLevel(Math.min(1, rms * 5));

          // If mic is muted, do not send audio chunks
          if (isMicMuted) return;

          const resampled = resample(inputData, e.inputBuffer.sampleRate, 16000);
          const int16Data = convertFloat32ToInt16(resampled);
          const base64Pcm = arrayBufferToBase64(int16Data.buffer as ArrayBuffer);

          ws.send(
            JSON.stringify({
              realtimeInput: {
                mediaChunks: [{ mimeType: "audio/pcm", data: base64Pcm }],
              },
            })
          );
        };

        source.connect(scriptProcessor);
        scriptProcessor.connect(audioContext.destination);
      };

      ws.onclose = () => {
        setStatus("lobby");
      };

      ws.onerror = (err) => {
        console.error("WebSocket connection error:", err);
        setStatus("lobby");
      };
    } catch (err) {
      console.error("Failed to start session:", err);
      setStatus("lobby");
      toast.error("Microphone access is required to join the interview");
    }
  };

  // Real-time Candidate Speech-to-Text via Web Speech API
  useEffect(() => {
    if (status !== "live") return;
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      console.warn("Web SpeechRecognition is not supported in this browser. Candidates may type their answers.");
      return;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = interviewMeta?.language === "Hindi" ? "hi-IN" : "en-US";

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        if (final) {
          spokenTranscriptRef.current += (spokenTranscriptRef.current ? " " : "") + final.trim();
          setInputText(spokenTranscriptRef.current);
        } else if (interim) {
          setInputText((spokenTranscriptRef.current ? spokenTranscriptRef.current + " " : "") + interim);
        }
      };

      recognition.onerror = (e: any) => {
        if (e?.error !== "no-speech") {
          console.warn("Speech recognition notice:", e?.error);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.warn("Speech recognition initialization notice:", e);
    }

    return () => {
      try {
        recognitionRef.current?.stop();
      } catch (err) {}
    };
  }, [status, interviewMeta?.language]);

  // Helper: Signal candidate completed answer
  const handleFinishAnswer = () => {
    stopAllAiAudio();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const msg = inputText.trim() || spokenTranscriptRef.current.trim();
      if (!msg) {
        toast.warning("Please speak your answer or type in the response box before submitting.");
        return;
      }
      setDialogue((prev) => [
        ...prev,
        { sender: "User", text: msg, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) },
      ]);
      spokenTranscriptRef.current = "";
      setInputText("");

      wsRef.current.send(
        JSON.stringify({
          clientContent: {
            turns: [{ role: "user", parts: [{ text: msg }] }],
            turnComplete: true,
            userMessage: msg,
          },
        })
      );
      toast.success("Answer submitted. Alex is preparing the next question.");
    }
  };

  // Helper: Repeat current question
  const handleRepeatQuestion = () => {
    if (currentQuestionText) {
      speakQuestion(currentQuestionText);
      toast.info("Re-reading question...");
    }
  };

  // Helper: Skip question
  const handleSkipQuestion = () => {
    stopAllAiAudio();
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          clientContent: {
            turns: [{ role: "user", parts: [{ text: "Let's skip to the next question." }] }],
            turnComplete: true,
            userMessage: "Let's skip to the next question.",
          },
        })
      );
      toast.info("Skipping to next question...");
    }
  };

  // Toggle Mute
  const toggleMute = () => {
    setIsMicMuted((prev) => {
      const next = !prev;
      if (micStreamRef.current) {
        micStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !next;
        });
      }
      return next;
    });
  };

  // Toggle Camera
  const toggleCamera = () => {
    setIsCameraOff((prev) => {
      const next = !prev;
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getVideoTracks().forEach((track) => {
          track.enabled = !next;
        });
      }
      return next;
    });
  };

  // End Interview and view results
  const endInterview = async () => {
    setStatus("ending");
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    try {
      recognitionRef.current?.stop();
    } catch (e) {}
    cleanup();
    toast.success("Interview completed! Generating your evaluation...");

    try {
      await axios.post(`${BACKEND_URL}/api/v1/interviews/conclude/${interviewId}`, {}, { withCredentials: true });
    } catch (concludeErr) {
      console.warn("Notice: conclude request:", concludeErr);
    }

    setTimeout(() => {
      navigate(`/result/${interviewId}`);
    }, 600);
  };

  function cleanup() {
    stopAllAiAudio();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    try {
      recognitionRef.current?.stop();
    } catch (e) {}
    scriptProcessorRef.current?.disconnect();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
    wsRef.current?.close();
    audioContextRef.current?.close().catch(() => {});
    playbackAudioContextRef.current?.close().catch(() => {});
  }

  // Audio Conversion Helpers
  function convertFloat32ToInt16(float32Array: Float32Array) {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]!));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  }

  function resample(source: Float32Array, fromRate: number, toRate: number) {
    if (fromRate === toRate) return source;
    const ratio = fromRate / toRate;
    const newLength = Math.round(source.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const idx = Math.round(i * ratio);
      result[i] = source[idx] || 0;
    }
    return result;
  }

  function arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]!);
    }
    return window.btoa(binary);
  }

  // Extract latest question text
  const assistantQuestions = dialogue.filter((d) => d.sender === "Assistant");
  const currentQuestionText =
    assistantQuestions.slice(-1)[0]?.text ||
    `Hello! Welcome to your technical interview for the ${interviewMeta?.role || "Software Engineer"} position. Could you introduce yourself and talk about your recent engineering experience?`;

  const questionNumber = Math.max(1, assistantQuestions.length);

  // ─────────────────────────────────────────────────────────────
  // 1. LOBBY: SOUND & CAMERA CHECK-IN (RENDER DEVELOPER AESTHETIC)
  // ─────────────────────────────────────────────────────────────
  if (status === "lobby") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-100px)] w-full px-4 py-8 max-w-5xl mx-auto font-sans">
        <div className="w-full render-card p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row gap-6 items-stretch">
            
            {/* Left: Candidate Video & Audio Test */}
            <div className="flex-1 flex flex-col justify-between space-y-4">
              <div>
                <div className="inline-flex items-center gap-2 mb-2">
                  <span className="render-status-live">
                    <Shield className="size-3 text-emerald-400" />
                    Hardware Diagnostic
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">Camera & Sound Check</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Verify your camera framing and microphone level before launching the session.</p>
              </div>

              {/* Video Preview Box */}
              <div className="relative aspect-video w-full rounded border border-zinc-800 overflow-hidden bg-black flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute bottom-2.5 left-2.5 flex items-center gap-2 bg-black/90 backdrop-blur px-2.5 py-1 rounded border border-zinc-800">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-mono font-medium text-zinc-300">✓ Video Feed Active</span>
                </div>
              </div>

              {/* Mic Activity Meter */}
              <div className="p-3 rounded bg-black border border-zinc-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 flex items-center gap-1.5 text-[11px] font-mono">
                    <Mic className="size-3 text-zinc-400" />
                    Microphone Input
                  </span>
                  <span className={`font-mono text-[11px] ${userMicLevel > 0.05 ? "text-emerald-400 font-semibold" : "text-zinc-500"}`}>
                    {userMicLevel > 0.05 ? "✓ Audio Detected" : "Speak to test"}
                  </span>
                </div>
                <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full rounded-full transition-all duration-100"
                    style={{ width: `${Math.max(4, userMicLevel * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Right: Interview Overview & Direct Entry */}
            <div className="flex-1 flex flex-col justify-between space-y-5 md:pl-6 border-t md:border-t-0 md:border-l border-zinc-800 pt-5 md:pt-0">
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-semibold">Configured Session</span>
                  <h3 className="text-lg font-bold text-white mt-0.5">
                    {interviewMeta?.role || "Software Engineer"}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                    {interviewMeta?.company ? `Company: ${interviewMeta.company}` : "General Tech"} • {interviewMeta?.interviewType || "Technical Round"}
                  </p>
                </div>

                {/* Interviewer Persona Card */}
                <div className="p-4 rounded bg-[#050506] border border-zinc-800 flex items-center gap-3.5">
                  <div className="size-10 rounded bg-white text-black font-bold font-mono text-sm flex items-center justify-center shrink-0">
                    AM
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-white text-xs">Alex Morgan</h4>
                      <span className="render-status-live text-[10px] py-0 px-1.5">Lead Proctor</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      "I'll be asking questions, listening to your problem-solving approaches, and providing constructive feedback."
                    </p>
                  </div>
                </div>

                {/* Helpful Guidance */}
                <div className="space-y-1.5 text-xs text-zinc-400 font-sans">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Speak naturally and explain architectural trade-offs step-by-step.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Repeat questions anytime or submit supplementary notes during the call.</span>
                  </div>
                </div>
              </div>

              {/* Start CTA */}
              <div className="space-y-2 pt-2">
                <Button
                  onClick={handleJoinInterview}
                  className="w-full h-10 bg-white hover:bg-zinc-200 text-black font-semibold text-xs rounded flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Sparkles className="size-3.5" />
                  <span>Connect to Interview Room</span>
                </Button>
                <p className="text-[10px] text-center text-zinc-500 font-mono">
                  Gemini Live WebSocket stream initialized on demand
                </p>
              </div>

            </div>

          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. CONNECTING SCREEN
  // ─────────────────────────────────────────────────────────────
  if (status === "connecting") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-140px)] w-full px-6 font-sans">
        <div className="render-card p-8 max-w-sm w-full text-center space-y-4">
          <div className="size-10 mx-auto border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-white">Connecting with Alex Morgan</h3>
            <p className="text-xs text-zinc-400 font-mono text-[11px]">
              Establishing 24kHz linear PCM audio WebSocket...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 3. LIVE INTERVIEW PLATFORM (RENDER MINIMALIST THEME)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-80px)] w-full max-w-7xl mx-auto px-4 py-3 gap-3 overflow-hidden font-sans">
      
      {/* Top Bar: Call Status & Controls */}
      <header className="flex items-center justify-between render-card px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <span className="render-status-live">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Session
          </span>
          <div className="h-3.5 w-px bg-zinc-800" />
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-white">
              {interviewMeta?.role || "Software Engineer"}
            </h2>
            <span className="text-[11px] text-zinc-500 font-mono">
              • {interviewMeta?.company || "General"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded">
            <Clock className="size-3 text-zinc-400" />
            <span>{formatElapsed(elapsedTime)}</span>
          </div>

          <Button
            onClick={() => setShowTranscript(!showTranscript)}
            variant="outline"
            className="text-xs font-medium border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded px-2.5 py-1 h-7 flex items-center gap-1.5 cursor-pointer"
          >
            <MessageSquare className="size-3" />
            <span>{showTranscript ? "Hide Notes" : "View Notes"}</span>
          </Button>

          <Button
            onClick={endInterview}
            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold px-3 py-1 h-7 rounded flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <PhoneOff className="size-3" />
            <span>End Call</span>
          </Button>
        </div>
      </header>

      {/* Main Stage Grid */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 overflow-hidden min-h-0">
        
        {/* Left / Center: Main Video & Question Stage */}
        <div className="flex-1 flex flex-col gap-3 overflow-hidden min-h-0">
          
          {/* Active Question Spotlight Banner */}
          <div className="render-card p-4 space-y-3 shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 max-w-3xl">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wider">
                    Question {questionNumber}
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono">Technical Discussion</span>
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-white leading-relaxed">
                  "{currentQuestionText}"
                </h3>
              </div>

              {/* Quick Audio Controls for Question */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleRepeatQuestion}
                  title="Repeat question out loud"
                  className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
                >
                  <RotateCcw className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Action Bar: Done Speaking / Next */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
              <span className="text-[11px] text-zinc-400">
                {isAiSpeaking ? (
                  <span className="text-emerald-400 font-mono flex items-center gap-1.5">
                    <Volume2 className="size-3 animate-pulse" />
                    Alex Morgan is speaking...
                  </span>
                ) : (
                  <span>Take your time to structure your thoughts and explain your reasoning.</span>
                )}
              </span>

              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSkipQuestion}
                  variant="outline"
                  className="text-xs font-medium border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded px-2.5 py-1 h-7 cursor-pointer"
                >
                  Skip Topic
                </Button>
                <Button
                  onClick={handleFinishAnswer}
                  className="bg-white hover:bg-zinc-200 text-black font-semibold text-xs rounded px-3 py-1 h-7 flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <CheckCircle2 className="size-3 text-black" />
                  <span>Finished My Answer</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Dual Participant Video Stage */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0">
            
            {/* Participant 1: Alex Morgan (Interviewer) */}
            <div className={`relative rounded render-card flex flex-col items-center justify-center p-6 ${
              isAiSpeaking ? "border-emerald-500/50" : "border-zinc-800"
            }`}>
              {/* Interviewer Persona Avatar & Audio Aura */}
              <div className="relative flex flex-col items-center">
                <div className={`relative size-20 rounded bg-zinc-900 border ${
                  isAiSpeaking ? "border-emerald-400" : "border-zinc-700"
                } flex items-center justify-center text-white font-mono font-bold text-xl transition-all duration-300`}>
                  AM
                  {isAiSpeaking && (
                    <span className="absolute inset-0 rounded border border-emerald-400 animate-ping opacity-30" />
                  )}
                </div>

                {/* Speech Indicator */}
                <div className="flex items-center gap-1 mt-3 h-4">
                  <div className={`w-1 bg-emerald-400 rounded-full transition-all duration-200 ${isAiSpeaking ? "h-4 animate-pulse" : "h-1 opacity-40"}`} />
                  <div className={`w-1 bg-emerald-400 rounded-full transition-all duration-200 ${isAiSpeaking ? "h-2.5 animate-pulse delay-75" : "h-1 opacity-40"}`} />
                  <div className={`w-1 bg-emerald-400 rounded-full transition-all duration-200 ${isAiSpeaking ? "h-5 animate-pulse delay-150" : "h-1 opacity-40"}`} />
                  <div className={`w-1 bg-emerald-400 rounded-full transition-all duration-200 ${isAiSpeaking ? "h-3 animate-pulse delay-100" : "h-1 opacity-40"}`} />
                  <div className={`w-1 bg-emerald-400 rounded-full transition-all duration-200 ${isAiSpeaking ? "h-1.5 animate-pulse delay-200" : "h-1 opacity-40"}`} />
                </div>
              </div>

              {/* Persona Tag */}
              <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/80 backdrop-blur px-2.5 py-1 rounded border border-zinc-800">
                <span className={`size-1.5 rounded-full ${isAiSpeaking ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"}`} />
                <span className="text-[11px] font-semibold text-white">Alex Morgan</span>
                <span className="text-[10px] text-zinc-500 font-mono">• Lead Proctor</span>
              </div>

              {/* Status Pill */}
              <div className="absolute top-3 right-3 bg-black/80 backdrop-blur px-2.5 py-0.5 rounded border border-zinc-800 text-[10px] font-mono text-zinc-400">
                {isAiSpeaking ? "Speaking question..." : userMicLevel > 0.05 ? "Listening to response..." : "Standby"}
              </div>
            </div>

            {/* Participant 2: Candidate (Your Live Camera) */}
            <div className="relative rounded render-card overflow-hidden bg-black flex items-center justify-center">
              {isCameraOff ? (
                <div className="flex flex-col items-center justify-center gap-2 text-zinc-600">
                  <User className="size-10 opacity-50" />
                  <span className="text-xs font-mono">Camera Disabled</span>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              )}

              {/* Candidate Tag & Mic */}
              <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-black/80 backdrop-blur px-2.5 py-1 rounded border border-zinc-800">
                <span className="text-[11px] font-semibold text-white">You</span>
                <div className="flex items-center gap-0.5 h-2.5">
                  <div className="w-0.5 bg-emerald-400 rounded-full transition-all" style={{ height: `${Math.max(2, userMicLevel * 12)}px` }} />
                  <div className="w-0.5 bg-emerald-400 rounded-full transition-all" style={{ height: `${Math.max(2, userMicLevel * 16)}px` }} />
                  <div className="w-0.5 bg-emerald-400 rounded-full transition-all" style={{ height: `${Math.max(2, userMicLevel * 10)}px` }} />
                </div>
              </div>

              {/* Toggles */}
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                <button
                  onClick={toggleMute}
                  className={`size-7 rounded flex items-center justify-center border transition-colors cursor-pointer ${
                    isMicMuted ? "bg-red-500/20 border-red-500/50 text-red-400" : "bg-black/80 border-zinc-800 text-zinc-300 hover:bg-zinc-900"
                  }`}
                  title={isMicMuted ? "Unmute microphone" : "Mute microphone"}
                >
                  {isMicMuted ? <MicOff className="size-3" /> : <Mic className="size-3" />}
                </button>
                <button
                  onClick={toggleCamera}
                  className={`size-7 rounded flex items-center justify-center border transition-colors cursor-pointer ${
                    isCameraOff ? "bg-red-500/20 border-red-500/50 text-red-400" : "bg-black/80 border-zinc-800 text-zinc-300 hover:bg-zinc-900"
                  }`}
                  title={isCameraOff ? "Turn on camera" : "Turn off camera"}
                >
                  {isCameraOff ? <VideoOff className="size-3" /> : <Video className="size-3" />}
                </button>
              </div>

            </div>

          </div>

          {/* Answer Input Bar */}
          <div className="render-card p-2 flex items-center gap-2 shrink-0">
            <input
              type="text"
              placeholder="Type your response or supplementary bullet points... (Press Enter to submit)"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && inputText.trim()) {
                  handleFinishAnswer();
                }
              }}
              className="flex-1 bg-transparent px-3 py-1 text-xs text-white placeholder:text-zinc-600 focus:outline-none"
            />
            <Button
              onClick={handleFinishAnswer}
              disabled={!inputText.trim()}
              className="bg-white hover:bg-zinc-200 disabled:opacity-30 text-black text-xs font-semibold px-3 py-1 h-7 rounded flex items-center gap-1.5 cursor-pointer"
            >
              <Send className="size-3 text-black" />
              <span>Send</span>
            </Button>
          </div>

        </div>

        {/* Right: Collapsible Live Transcript & Notes */}
        {showTranscript && (
          <div className="w-full lg:w-80 h-72 lg:h-full render-card flex flex-col overflow-hidden shrink-0">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
              <div className="flex items-center gap-2">
                <FileText className="size-3.5 text-zinc-400" />
                <h4 className="text-xs font-mono font-semibold text-white uppercase tracking-wider">Session Log</h4>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">{dialogue.length} entries</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {dialogue.length === 0 ? (
                <div className="text-center text-zinc-600 text-xs py-10 font-mono">
                  Dialogue transcript will stream here as you speak.
                </div>
              ) : (
                dialogue.map((msg, idx) => {
                  const isAssistant = msg.sender === "Assistant";
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col gap-1 p-2.5 rounded text-xs leading-relaxed border ${
                        isAssistant
                          ? "bg-zinc-900/60 border-zinc-800 text-zinc-200"
                          : "bg-black border-zinc-800/80 text-zinc-300 ml-3"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono font-semibold">
                        <span className={isAssistant ? "text-emerald-400" : "text-zinc-400"}>
                          {isAssistant ? "Alex Morgan" : "You"}
                        </span>
                        <span className="text-zinc-600 font-normal">{msg.time || ""}</span>
                      </div>
                      <p className="mt-0.5 text-zinc-300">{msg.text}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
