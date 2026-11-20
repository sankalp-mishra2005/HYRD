
export function getBackendUrl(): string {
  // 1. Injected at runtime into index.html by the backend/SSR server
  if (typeof window !== "undefined" && (window as any).__BACKEND_URL__) {
    return (window as any).__BACKEND_URL__;
  }
  // 2. Safe check if process is defined (e.g. during SSR or build-time)
  if (typeof process !== "undefined" && process?.env) {
    if (process.env.BACKEND_URL) return process.env.BACKEND_URL;
    if (process.env.VITE_BACKEND_URL) return process.env.VITE_BACKEND_URL;
  }
  // 3. Railway dynamic hostname resolution (if frontend is on *.up.railway.app, backend is on corresponding service)
  if (
    typeof window !== "undefined" &&
    window.location &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    const host = window.location.hostname.replace("frontend", "backend");
    return `${window.location.protocol}//${host}${window.location.port ? `:${window.location.port}` : ""}`;
  }
  return "http://localhost:3001";
}

export const BACKEND_URL = getBackendUrl();

