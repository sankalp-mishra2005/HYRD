import { BACKEND_URL } from "@/lib/config";
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import {
    Loader2,
    PhoneOff,
    Mic,
    Sparkles,
    AlertTriangle,
    Camera,
    CameraOff,
    Eye,
    EyeOff,
    Code2,
    Clock,
    CheckCircle,
    ArrowRight
} from "lucide-react";
import { Button } from "./ui/button";
import { VoiceOrb } from "./VoiceOrb";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import Editor from "@monaco-editor/react";
import axios from "axios";
import { toast } from "sonner";

type Status = "connecting" | "live" | "ending";

export interface SuspiciousEvent {
    type: "looking_away" | "no_face" | "multiple_faces" | "tab_switch" | "fullscreen_exit";
    message: string;
    timestamp: string;
}

interface DialogueMessage {
    sender: "Assistant" | "User";
    text: string;
}

// ─── Proctoring constants ─────────────────────────────────────────────────────
const YAW_THRESHOLD = 0.28;   // horizontal gaze limit (radians-ish)
const PITCH_THRESHOLD = 0.28; // vertical gaze limit
const NO_FACE_DELAY_MS = 3000; // warn after 3s of no face
const ALERT_COOLDOWN_MS = 5000; // minimum gap between same-type alerts

export function Interview() {
    const { interviewId } = useParams();
    const navigate = useNavigate();

    // Custom prep phase
    const [phase, setPhase] = useState<"voice" | "coding">("voice");
    const [interviewMeta, setInterviewMeta] = useState<any>(null);

    const [status, setStatus] = useState<Status>("connecting");
    const [aiLevel, setAiLevel] = useState(0);
    const [userLevel, setUserLevel] = useState(0);
    const [dialogue, setDialogue] = useState<DialogueMessage[]>([]);
    const [suspiciousEvents, setSuspiciousEvents] = useState<SuspiciousEvent[]>([]);
    const [activeAlert, setActiveAlert] = useState<string | null>(null);
    const [cameraEnabled, setCameraEnabled] = useState(false);
    const [cameraError, setCameraError] = useState(false);

    // Live Metrics Dashboard State
    const [liveMetrics, setLiveMetrics] = useState({
        communication: 5,
        technical: 5,
        confidence: 5,
        problemSolving: 5,
        systemDesign: 5
    });

    // Monaco Editor Coding State
    const [codingChallenge, setCodingChallenge] = useState<any>(null);
    const [codingCode, setCodingCode] = useState("");
    const [codingTimeLeft, setCodingTimeLeft] = useState(900); // 15 mins
    const [submittingCode, setSubmittingCode] = useState(false);
    const [submissionResult, setSubmissionResult] = useState<any>(null);

    // WebSocket and Audio Refs
    const wsRef = useRef<WebSocket | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);

    // Playback scheduling refs
    const nextPlaybackTimeRef = useRef<number>(0);
    const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

    // Camera / proctoring refs
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const cameraStreamRef = useRef<MediaStream | null>(null);
    const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
    const rafRef = useRef<number | null>(null);
    const noFaceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastAlertTimeRef = useRef<Record<string, number>>({});

    // Load interview configurations initially
    useEffect(() => {
        axios.get(`${BACKEND_URL}/api/v1/result/${interviewId}`)
            .then((res) => {
                setInterviewMeta(res.data);
            })
            .catch((err) => console.error("Error loading interview metadata:", err));
    }, [interviewId]);

    // Timer logic for coding round
    useEffect(() => {
        if (phase !== "coding") return;
        const tid = setInterval(() => {
            setCodingTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(tid);
                    onSubmitCode();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(tid);
    }, [phase]);

    // Format remaining time (MM:SS)
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    };

    // ── Proctoring helpers ──────────────────────────────────────────────────
    const recordSuspiciousEvent = useCallback((event: SuspiciousEvent) => {
        const now = Date.now();
        const last = lastAlertTimeRef.current[event.type] ?? 0;
        if (now - last < ALERT_COOLDOWN_MS) return; // rate-limit same type
        lastAlertTimeRef.current[event.type] = now;

        setSuspiciousEvents((prev) => [...prev, event]);
        setActiveAlert(event.message);
        setTimeout(() => setActiveAlert(null), 3500);
    }, []);

    const flagLookingAway = useCallback(() => {
        recordSuspiciousEvent({
            type: "looking_away",
            message: "⚠️ Please face the camera",
            timestamp: new Date().toISOString(),
        });
    }, [recordSuspiciousEvent]);

    const flagNoFace = useCallback(() => {
        recordSuspiciousEvent({
            type: "no_face",
            message: "⚠️ No face detected – please stay in frame",
            timestamp: new Date().toISOString(),
        });
    }, [recordSuspiciousEvent]);

    const flagMultipleFaces = useCallback(() => {
        recordSuspiciousEvent({
            type: "multiple_faces",
            message: "🚨 Multiple faces detected",
            timestamp: new Date().toISOString(),
        });
    }, [recordSuspiciousEvent]);

    // ── Gaze analysis per frame ─────────────────────────────────────────────
    const analyzeFrame = useCallback(() => {
        const lm = faceLandmarkerRef.current;
        const video = videoRef.current;
        if (!lm || !video || video.readyState < 2) {
            rafRef.current = requestAnimationFrame(analyzeFrame);
            return;
        }

        const results = lm.detectForVideo(video, performance.now());
        const faces = results.faceLandmarks;

        if (!faces || faces.length === 0) {
            // Start no-face timer
            if (!noFaceTimerRef.current) {
                noFaceTimerRef.current = setTimeout(() => {
                    flagNoFace();
                    noFaceTimerRef.current = null;
                }, NO_FACE_DELAY_MS);
            }
        } else {
            // Clear no-face timer
            if (noFaceTimerRef.current) {
                clearTimeout(noFaceTimerRef.current);
                noFaceTimerRef.current = null;
            }

            if (faces.length > 1) {
                flagMultipleFaces();
            } else {
                // Estimate gaze direction using nose tip vs. face midpoint
                const landmarks = faces[0];
                if (landmarks) {
                    const noseTip = landmarks[1];   // nose tip
                    const leftEye = landmarks[33];  // outer left eye
                    const rightEye = landmarks[263]; // outer right eye
                    const foreheadTop = landmarks[10];
                    const chin = landmarks[152];

                    if (noseTip && leftEye && rightEye && foreheadTop && chin) {
                        const eyeMidX = (leftEye.x + rightEye.x) / 2;
                        const eyeMidY = (leftEye.y + rightEye.y) / 2;
                        const faceHeight = Math.abs(chin.y - foreheadTop.y);

                        const yaw = (noseTip.x - eyeMidX) / Math.max(faceHeight, 0.001);
                        const pitch = (noseTip.y - eyeMidY) / Math.max(faceHeight, 0.001);

                        if (Math.abs(yaw) > YAW_THRESHOLD || Math.abs(pitch) > PITCH_THRESHOLD) {
                            flagLookingAway();
                        }
                    }
                }
            }
        }

        rafRef.current = requestAnimationFrame(analyzeFrame);
    }, [flagLookingAway, flagNoFace, flagMultipleFaces]);

    // ── Start camera + MediaPipe ────────────────────────────────────────────
    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 320, height: 240, facingMode: "user" },
            });
            cameraStreamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setCameraEnabled(true);

            // Load MediaPipe FaceLandmarker (WASM, no server needed)
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
            );
            const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath:
                        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
                    delegate: "GPU",
                },
                runningMode: "VIDEO",
                numFaces: 3,
            });
            faceLandmarkerRef.current = faceLandmarker;
            rafRef.current = requestAnimationFrame(analyzeFrame);
        } catch (err) {
            console.error("Camera access failed:", err);
            setCameraError(true);
        }
    }, [analyzeFrame]);

    // ── Tab / fullscreen proctoring ─────────────────────────────────────────
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                recordSuspiciousEvent({
                    type: "tab_switch",
                    message: "⚠️ Tab switch detected",
                    timestamp: new Date().toISOString(),
                });
            }
        };
        const handleFullscreenChange = () => {
            if (!document.fullscreenElement && status === "live") {
                recordSuspiciousEvent({
                    type: "fullscreen_exit",
                    message: "⚠️ Fullscreen exited",
                    timestamp: new Date().toISOString(),
                });
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
        };
    }, [status, recordSuspiciousEvent]);

    // ── Main session setup ──────────────────────────────────────────────────
    useEffect(() => {
        let isCancelled = false;

        const startSession = async () => {
            try {
                // 1. Initialize AudioContext (suspended by browser until user gesture)
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                audioContextRef.current = audioContext;
                nextPlaybackTimeRef.current = audioContext.currentTime;

                // 2. Request microphone
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        channelCount: 1,
                        echoCancellation: true,
                        noiseSuppression: true,
                    },
                });

                if (isCancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
                micStreamRef.current = stream;

                // 3. Connect WebSocket to backend relay
                const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
                const host = BACKEND_URL.replace(/^https?:\/\//, "");
                const wsUrl = `${protocol}//${host}/api/v1/session/live/${interviewId}`;
                const ws = new WebSocket(wsUrl);
                wsRef.current = ws;

                // 4. Handle messages from backend
                ws.onmessage = async (event) => {
                    try {
                        const json = JSON.parse(event.data);

                        // Capture live dashboard metrics pushed from backend
                        if (json.type === "metrics_update" && json.metrics) {
                            setLiveMetrics(json.metrics);
                            return;
                        }

                        // Interruption / barge-in
                        if (json.serverContent?.interrupted) {
                            stopPlayback();
                            setAiLevel(0);
                            return;
                        }

                        // AI audio response
                        if (json.serverContent?.modelTurn?.parts) {
                            for (const part of json.serverContent.modelTurn.parts) {
                                if (part.inlineData?.mimeType?.startsWith("audio/pcm") && part.inlineData?.data) {
                                    // Resume audio context if suspended (browser autoplay policy)
                                    if (audioContextRef.current?.state === "suspended") {
                                        await audioContextRef.current.resume();
                                    }
                                    const audioData = base64ToArrayBuffer(part.inlineData.data);
                                    const int16Samples = new Int16Array(audioData);
                                    const float32Samples = convertInt16ToFloat32(int16Samples);
                                    schedulePlayback(float32Samples);
                                }
                                // Also handle legacy format
                                if (part.mimeType?.startsWith("audio/pcm") && part.data) {
                                    if (audioContextRef.current?.state === "suspended") {
                                        await audioContextRef.current.resume();
                                    }
                                    const audioData = base64ToArrayBuffer(part.data);
                                    const int16Samples = new Int16Array(audioData);
                                    const float32Samples = convertInt16ToFloat32(int16Samples);
                                    schedulePlayback(float32Samples);
                                }
                            }
                        }

                        // AI text transcript
                        if (json.serverContent?.modelTurn?.parts) {
                            let partText = "";
                            for (const part of json.serverContent.modelTurn.parts) {
                                if (part.text) partText += part.text;
                            }
                            if (partText) {
                                setDialogue((prev) => {
                                    const last = prev[prev.length - 1];
                                    if (last && last.sender === "Assistant") {
                                        return [...prev.slice(0, -1), { sender: "Assistant", text: last.text + partText }];
                                    }
                                    return [...prev, { sender: "Assistant", text: partText }];
                                });
                            }
                        }

                        // User transcript
                        if (json.serverContent?.userTurn?.parts) {
                            let partText = "";
                            for (const part of json.serverContent.userTurn.parts) {
                                if (part.text) partText += part.text;
                            }
                            if (partText) {
                                setDialogue((prev) => {
                                    const last = prev[prev.length - 1];
                                    if (last && last.sender === "User") {
                                        return [...prev.slice(0, -1), { sender: "User", text: last.text + partText }];
                                    }
                                    return [...prev, { sender: "User", text: partText }];
                                });
                            }
                        }
                    } catch (err) {
                        console.error("Error processing WebSocket message:", err);
                    }
                };

                ws.onopen = async () => {
                    try {
                        console.log("WebSocket connected");
                        // Resume AudioContext immediately on user-triggered open
                        if (audioContextRef.current?.state === "suspended") {
                            await audioContextRef.current.resume();
                        }
                        setStatus("live");

                        // Start sending microphone PCM chunks
                        const source = audioContext.createMediaStreamSource(stream);
                        const scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (e) => {
                            if (ws.readyState !== WebSocket.OPEN) return;
                            const inputData = e.inputBuffer.getChannelData(0);

                            // User volume level for orb
                            let sum = 0;
                            for (let i = 0; i < inputData.length; i++) sum += Math.abs(inputData[i]);
                            const rms = sum / inputData.length;
                            setUserLevel(Math.min(1, rms * 4.5));

                            // Downsample to 16 kHz PCM
                            const resampled = resample(inputData, e.inputBuffer.sampleRate, 16000);
                            const int16Data = convertFloat32ToInt16(resampled);
                            const base64Pcm = arrayBufferToBase64(int16Data.buffer);

                            ws.send(JSON.stringify({
                                realtimeInput: {
                                    mediaChunks: [{ mimeType: "audio/pcm", data: base64Pcm }],
                                },
                            }));
                        };

                        source.connect(scriptProcessor);
                        scriptProcessor.connect(audioContext.destination);
                    } catch (err) {
                        console.error("Error during WebSocket session initialization:", err);
                    }
                };

                ws.onclose = () => console.log("WebSocket closed");

            } catch (err) {
                console.error("Failed to start session:", err);
            }
        };

        startSession();

        // Start camera separately (doesn't block interview start)
        startCamera();

        return () => {
            isCancelled = true;
            cleanup();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [interviewId]);

    // ── Audio utility functions ─────────────────────────────────────────────
    function resample(input: Float32Array, inRate: number, outRate: number): Float32Array {
        if (inRate === outRate) return input;
        const ratio = inRate / outRate;
        const newLength = Math.round(input.length / ratio);
        const result = new Float32Array(newLength);
        let offsetResult = 0, offsetInput = 0;
        while (offsetResult < result.length) {
            const nextOffset = Math.round((offsetResult + 1) * ratio);
            let accum = 0, count = 0;
            for (let i = offsetInput; i < nextOffset && i < input.length; i++) { accum += input[i]; count++; }
            result[offsetResult] = count > 0 ? accum / count : 0;
            offsetResult++;
            offsetInput = nextOffset;
        }
        return result;
    }

    function convertFloat32ToInt16(buffer: Float32Array): Int16Array {
        const buf = new Int16Array(buffer.length);
        for (let i = 0; i < buffer.length; i++) {
            const s = Math.max(-1, Math.min(1, buffer[i]));
            buf[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        return buf;
    }

    function arrayBufferToBase64(buffer: ArrayBuffer): string {
        let binary = "";
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        return window.btoa(binary);
    }

    function base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binaryString = window.atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        return bytes.buffer;
    }

    function convertInt16ToFloat32(buffer: Int16Array): Float32Array {
        const buf = new Float32Array(buffer.length);
        for (let i = 0; i < buffer.length; i++) buf[i] = buffer[i] / (buffer[i] < 0 ? 0x8000 : 0x7fff);
        return buf;
    }

    function schedulePlayback(float32Samples: Float32Array) {
        const audioCtx = audioContextRef.current;
        if (!audioCtx) return;

        let sum = 0;
        for (let i = 0; i < float32Samples.length; i++) sum += Math.abs(float32Samples[i]);
        setAiLevel(Math.min(1, (sum / float32Samples.length) * 5.0));

        const audioBuffer = audioCtx.createBuffer(1, float32Samples.length, 24000);
        audioBuffer.copyToChannel(float32Samples, 0);

        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);

        const startTime = Math.max(nextPlaybackTimeRef.current, audioCtx.currentTime);
        source.start(startTime);
        nextPlaybackTimeRef.current = startTime + audioBuffer.duration;
        activeSourcesRef.current.push(source);

        source.onended = () => {
            activeSourcesRef.current = activeSourcesRef.current.filter((s) => s !== source);
            if (activeSourcesRef.current.length === 0) setAiLevel(0);
        };
    }

    // Dynamic submit code to Compiler Observer
    async function onSubmitCode() {
        if (!codingChallenge) return;
        setSubmittingCode(true);
        try {
            const res = await axios.post(`${BACKEND_URL}/api/v1/coding/submit`, {
                interviewId,
                challengeId: codingChallenge.id,
                submittedCode: codingCode
            });
            setSubmissionResult(res.data);
            toast.success("Code evaluated by Gemini Observer!");
            setTimeout(() => {
                navigate(`/result/${interviewId}`);
            }, 3000);
        } catch (error) {
            console.error("Failed to submit code:", error);
            toast.error("Evaluation failed. Loading results...");
            navigate(`/result/${interviewId}`);
        } finally {
            setSubmittingCode(false);
        }
    }

    function stopPlayback() {
        activeSourcesRef.current.forEach((src) => { try { src.stop(); } catch (_) {} });
        activeSourcesRef.current = [];
        nextPlaybackTimeRef.current = audioContextRef.current?.currentTime ?? 0;
    }

    function cleanup() {
        stopPlayback();
        scriptProcessorRef.current?.disconnect();
        micStreamRef.current?.getTracks().forEach((t) => t.stop());
        wsRef.current?.close();
        audioContextRef.current?.close().catch(() => {});
        // Camera cleanup
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (noFaceTimerRef.current) clearTimeout(noFaceTimerRef.current);
        cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
        faceLandmarkerRef.current?.close();
    }

    function endInterview() {
        setStatus("ending");
        // Save suspicious events to sessionStorage for result page
        sessionStorage.setItem(`suspicious_events_${interviewId}`, JSON.stringify(suspiciousEvents));
        cleanup();

        // Check if round needs coding challenge transition
        const requiresCoding =
            interviewMeta?.interviewType === "Technical Interview" ||
            interviewMeta?.interviewType === "DSA Interview" ||
            interviewMeta?.interviewType === "System Design" ||
            interviewMeta?.interviewType === "Machine Learning";

        if (requiresCoding) {
            setPhase("coding");
            toast.info("Entering Phase 2: Monaco Coding Challenge...");
            axios.get(`${BACKEND_URL}/api/v1/coding/challenge/${interviewId}`)
                .then((res) => {
                    setCodingChallenge(res.data);
                    setCodingCode(res.data.starterCode || "function solution() {\n  // Write code here\n}");
                })
                .catch((err) => {
                    console.error("Failed to fetch coding challenge:", err);
                    navigate(`/result/${interviewId}`);
                });
        } else {
            navigate(`/result/${interviewId}`);
        }
    }

    const aiSpeaking = aiLevel > 0.04;
    const userSpeaking = userLevel > 0.04 && !aiSpeaking;

    // --- RENDER CODING ROUND LAYOUT ---
    if (phase === "coding") {
        return (
            <main className="flex h-screen w-screen flex-col overflow-hidden bg-slate-950 text-slate-50">
                {/* Header */}
                <header className="flex items-center justify-between px-6 py-4 border-b border-slate-900 bg-slate-950/40 backdrop-blur-md">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <Code2 className="size-4 text-sky-400" />
                        <span>Phase 2: Monaco Coding Assessment</span>
                    </div>

                    <div className="flex items-center gap-4">
                        {codingChallenge && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                                <span className="text-slate-500 uppercase font-bold text-[9px]">Difficulty:</span>
                                <span className="text-sky-400 font-bold">{codingChallenge.difficulty}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/40 px-3 py-1 rounded-full border border-amber-800/40">
                            <Clock className="size-3.5" />
                            <span className="font-mono font-bold">{formatTime(codingTimeLeft)}</span>
                        </div>
                    </div>
                </header>

                <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
                    {/* Left Panel: Description */}
                    <div className="w-full md:w-[450px] border-r border-slate-900 bg-slate-955/20 flex flex-col h-[300px] md:h-full overflow-y-auto p-6 space-y-4">
                        {codingChallenge ? (
                            <>
                                <h1 className="text-xl font-bold tracking-tight text-white border-b border-slate-900 pb-3">{codingChallenge.title}</h1>
                                <div className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap font-sans">
                                    {codingChallenge.description}
                                </div>
                            </>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full gap-2">
                              <Loader2 className="size-6 animate-spin text-sky-400" />
                              <span className="text-xs text-slate-500">Generating target code challenge...</span>
                          </div>
                        )}
                    </div>

                    {/* Right Panel: Editor */}
                    <div className="flex-1 flex flex-col h-full bg-slate-950">
                        <div className="flex-1 relative border-b border-slate-900">
                            <Editor
                                height="100%"
                                defaultLanguage="javascript"
                                theme="vs-dark"
                                value={codingCode}
                                onChange={(val) => setCodingCode(val || "")}
                                options={{
                                    fontSize: 13,
                                    minimap: { enabled: false },
                                    automaticLayout: true,
                                    scrollBeyondLastLine: false,
                                    fontFamily: "Fira Code, Menlo, Monaco, Consolas, monospace",
                                }}
                            />
                        </div>

                        {/* Submission footer */}
                        <div className="p-4 bg-slate-950/80 flex items-center justify-between">
                            <div className="text-[10px] text-slate-500 font-semibold max-w-sm">
                                Standard JS execution environment. Evaluation checks time/space complexity and correctness metrics.
                            </div>
                            <Button
                                disabled={submittingCode || !codingChallenge}
                                onClick={onSubmitCode}
                                className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold px-6 py-5 rounded-xl cursor-pointer shadow-lg shadow-sky-500/10 flex items-center gap-2"
                            >
                                {submittingCode ? (
                                    <>
                                        <Loader2 className="size-4 animate-spin" />
                                        Running Observer Diagnostics...
                                    </>
                                ) : (
                                    <>
                                        Submit Code Solution
                                        <ArrowRight className="size-4" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </main>
        );
    }

    // --- RENDER VOICE ROUND LAYOUT ---
    return (
        <main className="flex h-screen w-screen flex-col overflow-hidden bg-slate-955 text-slate-50">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-slate-900/60 bg-slate-950/40 backdrop-blur-md">
                <div className="flex items-center gap-2 text-sm font-semibold">
                    <span className="relative flex size-2.5">
                        <span className={status === "live" ? "absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" : "hidden"} />
                        <span className={"relative inline-flex size-2.5 rounded-full " + (status === "live" ? "bg-sky-400" : "bg-amber-400")} />
                    </span>
                    {status === "connecting" ? "Initializing Session…" : status === "ending" ? "Finalizing Evaluation…" : "Interview Live"}
                </div>

                <div className="flex items-center gap-3">
                    {suspiciousEvents.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-955/40 px-3 py-1 rounded-full border border-amber-800/40">
                            <AlertTriangle className="size-3" />
                            {suspiciousEvents.length} alert{suspiciousEvents.length !== 1 ? "s" : ""}
                        </div>
                    )}
                    {interviewMeta && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-450 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full uppercase">
                            {interviewMeta.interviewType} • {interviewMeta.difficulty}
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                        <Sparkles className="size-3 text-sky-400" />
                        Adaptive Mode
                    </div>
                </div>
            </header>

            {/* Suspicious Activity Alert Banner */}
            {activeAlert && (
                <div className="flex items-center gap-2 px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-300 text-sm font-medium animate-pulse">
                    <AlertTriangle className="size-4 shrink-0" />
                    {activeAlert}
                </div>
            )}

            {/* Content Body */}
            <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">

                {/* Left Side: Voice Orbs + Camera */}
                <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950/80 relative">

                    {/* Camera feed – picture-in-picture style */}
                    <div className="absolute top-4 right-4 w-44 h-32 rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-900 shadow-2xl shadow-black/60 group">
                        <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-cover scale-x-[-1]" /* mirror */
                        />
                        {/* Overlay states */}
                        {!cameraEnabled && !cameraError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-900/80">
                                <Loader2 className="size-5 animate-spin text-slate-400" />
                                <span className="text-[10px] text-slate-500">Camera loading…</span>
                            </div>
                        )}
                        {cameraError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-900/80">
                                <CameraOff className="size-5 text-slate-500" />
                                <span className="text-[10px] text-slate-500">No camera</span>
                            </div>
                        )}
                        {/* Live indicator */}
                        {cameraEnabled && (
                            <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/50 px-1.5 py-0.5 rounded-full">
                                <span className="size-1.5 rounded-full bg-red-500 animate-pulse" />
                                <span className="text-[9px] text-white font-semibold">LIVE</span>
                            </div>
                        )}
                        {/* Proctoring eye icon */}
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {cameraEnabled
                                ? <Eye className="size-3.5 text-emerald-400" />
                                : <EyeOff className="size-3.5 text-slate-500" />
                            }
                        </div>
                    </div>

                    <div className="relative flex flex-col items-center gap-8">
                        <div className="flex flex-col sm:flex-row items-center gap-12">
                            <VoiceOrb
                                level={aiLevel}
                                speaking={aiSpeaking}
                                label="AI Recruiter"
                                sublabel="Gemini Live"
                                icon={Sparkles}
                                accent="violet"
                            />
                            <VoiceOrb
                                level={userSpeaking ? userLevel : 0}
                                speaking={userSpeaking}
                                label="You"
                                sublabel="Candidate"
                                icon={Mic}
                                accent="emerald"
                            />
                        </div>

                        <div className="text-center">
                            <h2 className="text-lg font-medium text-slate-200">
                                {aiSpeaking ? "AI is speaking" : userSpeaking ? "Listening to you" : "Speak when ready"}
                            </h2>
                            <p className="text-xs text-slate-550 mt-1">
                                Interrupt / barge-in at any time to clarify or correct the AI
                            </p>
                        </div>
                    </div>

                    <div className="mt-12">
                        <Button
                            onClick={endInterview}
                            variant="destructive"
                            size="lg"
                            className="gap-2.5 px-6 py-6 font-bold shadow-lg shadow-red-500/10 cursor-pointer rounded-xl hover:bg-red-600 transition-all"
                        >
                            <PhoneOff className="size-4" />
                            End Interview
                        </Button>
                    </div>
                </div>

                {/* Right Side: Transcript + Alerts + Live Metric Tracker */}
                <div className="w-full md:w-[400px] border-t md:border-t-0 md:border-l border-slate-900/60 bg-slate-950/20 flex flex-col h-[300px] md:h-full overflow-hidden">

                    {/* Live Metric Dashboard */}
                    <div className="p-5 border-b border-slate-900/60 bg-slate-900/30 space-y-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                            <Sparkles className="size-3 text-sky-450" />
                            Live Metrics Tracker
                        </span>
                        <div className="space-y-2">
                            {[
                                { label: "Communication", key: "communication", color: "bg-violet-500" },
                                { label: "Technical Skill", key: "technical", color: "bg-sky-500" },
                                { label: "Confidence", key: "confidence", color: "bg-amber-500" },
                                { label: "Problem Solving", key: "problemSolving", color: "bg-emerald-500" },
                                { label: "System Design", key: "systemDesign", color: "bg-rose-500" },
                            ].map((item) => {
                                const val = (liveMetrics as any)[item.key] || 5;
                                return (
                                    <div key={item.key} className="space-y-1">
                                        <div className="flex items-center justify-between text-[10px] font-bold">
                                            <span className="text-slate-450">{item.label}</span>
                                            <span className="text-slate-200">{val} / 10</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800/40">
                                            <div
                                                className={`h-full ${item.color} rounded-full transition-all duration-500`}
                                                style={{ width: `${val * 10}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Transcript panel */}
                    <div className="px-5 py-3 border-b border-slate-900/60 bg-slate-900/10 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Live Dialogue Feed</span>
                        {status === "connecting" && <Loader2 className="size-3.5 animate-spin text-sky-400" />}
                    </div>

                    <div className="flex-1 p-5 overflow-y-auto space-y-4 flex flex-col-reverse">
                        <div className="space-y-4">
                            {dialogue.length === 0 ? (
                                <div className="text-center text-slate-550 text-xs py-8">
                                    The interview feed will populate once the AI starts speaking.
                                </div>
                            ) : (
                                dialogue.map((msg, i) => (
                                    <div
                                        key={i}
                                        className={`flex flex-col gap-1.5 p-3.5 rounded-xl border text-sm max-w-[85%] transition-all ${
                                            msg.sender === "Assistant"
                                                ? "bg-slate-900/40 border-slate-800/80 mr-auto text-slate-200"
                                                : "bg-sky-955/10 border-sky-900/20 ml-auto text-sky-100"
                                        }`}
                                    >
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                            {msg.sender === "Assistant" ? "AI Interviewer" : "You"}
                                        </span>
                                        <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Proctoring events log */}
                    {suspiciousEvents.length > 0 && (
                        <div className="border-t border-amber-900/30 bg-amber-955/10 p-4">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-2 flex items-center gap-1">
                                <AlertTriangle className="size-3" />
                                Proctoring Alerts
                            </p>
                            <div className="space-y-1.5 max-h-28 overflow-y-auto">
                                {suspiciousEvents.slice(-5).map((ev, i) => (
                                    <div key={i} className="flex items-start gap-2 text-[11px] text-amber-300/80">
                                        <span className="shrink-0 text-amber-500/60">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                                        <span>{ev.message}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}

export default Interview;
