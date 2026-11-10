import React from "react";

interface State {
  hasError: boolean;
  error?: Error;
}

function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const msg =
    typeof err === "string"
      ? err
      : (err as any)?.message || String(err);
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("error loading dynamically imported module") ||
    msg.includes("Failed to load module script") ||
    msg.includes("Expected a JavaScript-or-Wasm module script") ||
    msg.includes("Strict MIME type checking") ||
    msg.includes("MIME type of \"text/html\"") ||
    msg.includes("ChunkLoadError") ||
    msg.includes("Loading chunk")
  );
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode; fallback?: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(rawError: unknown): State {
    const error =
      rawError instanceof Error
        ? rawError
        : new Error(
            typeof rawError === "object" && rawError !== null
              ? JSON.stringify(rawError)
              : String(rawError || "Unknown runtime exception")
          );
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);

    // Auto-recover from Vite stale chunk 404s after new modules are built
    if (isChunkLoadError(error)) {
      const lastRetry = sessionStorage.getItem("chunk_retry_timestamp");
      const now = Date.now();
      if (!lastRetry || now - Number(lastRetry) > 10000) {
        sessionStorage.setItem("chunk_retry_timestamp", String(now));
        window.location.reload();
      }
    }
  }

  componentDidMount() {
    sessionStorage.removeItem("chunk_retry");
  }

  render() {
    if (this.state.hasError) {
      const isChunk = isChunkLoadError(this.state.error);

      return this.props.fallback || (
        <div className="min-h-[40vh] flex flex-col items-center justify-center p-8 text-center bg-rose-50/40 border border-rose-200/80 rounded-3xl m-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mb-3 shadow-sm border border-rose-300">
            <span className="text-xl font-bold font-heading">!</span>
          </div>
          <h3 className="text-base sm:text-lg text-slate-900 font-bold font-heading tracking-tight">
            {isChunk ? "Application Module Updated" : "An Unexpected Exception Occurred"}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 font-info mt-1.5 max-w-md leading-relaxed">
            {isChunk
              ? "A new update was deployed to Darse Burhani. Please reload to initialize the latest modules."
              : "The interface encountered a runtime issue in this module."}
          </p>
          {this.state.error && !isChunk && (
            <pre className="mt-3 p-3 rounded-xl bg-white border border-rose-200 text-[11px] text-rose-900 font-error max-w-lg overflow-x-auto text-left shadow-2xs">
              {String(this.state.error.message || this.state.error)}
            </pre>
          )}
          <button
            onClick={() => {
              if (isChunk) {
                sessionStorage.removeItem("chunk_retry_timestamp");
                window.location.reload();
              } else {
                this.setState({ hasError: false, error: undefined });
              }
            }}
            className="mt-4 px-5 py-2.5 text-xs bg-gradient-to-br from-emerald-950 to-teal-900 text-white rounded-2xl font-bold font-heading shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            {isChunk ? "Reload Portal" : "Retry Section"}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
