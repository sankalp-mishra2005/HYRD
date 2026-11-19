
export const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.VITE_BACKEND_URL ||
  (typeof window !== "undefined" && (window as any).__BACKEND_URL__) ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
    ? `${window.location.protocol}//${window.location.hostname.replace("frontend", "backend")}${window.location.port ? `:${window.location.port}` : ""}`
    : "http://localhost:3001");
