import React from "react";

interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode; fallback?: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);

    // Auto-recover from Vite stale chunk 404s after new modules are built
    const isChunkError =
      error?.message?.includes("Failed to fetch dynamically imported module") ||
      error?.message?.includes("error loading dynamically imported module");

    if (isChunkError && !sessionStorage.getItem("chunk_retry")) {
      sessionStorage.setItem("chunk_retry", "1");
      window.location.reload();
      return;
    }
  }

  componentDidMount() {
    sessionStorage.removeItem("chunk_retry");
  }

  render() {
    if (this.state.hasError) {
      const isChunkError =
        this.state.error?.message?.includes("Failed to fetch dynamically imported module") ||
        this.state.error?.message?.includes("error loading dynamically imported module");

      return this.props.fallback || (
        <div className="min-h-[40vh] flex flex-col items-center justify-center p-8 text-center bg-rose-50/40 border border-rose-200/80 rounded-3xl m-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mb-3 shadow-sm border border-rose-300">
            <span className="text-xl font-bold font-heading">!</span>
          </div>
          <h3 className="text-base sm:text-lg text-slate-900 font-bold font-heading tracking-tight">
            {isChunkError ? "Application Module Updated" : "An Unexpected Exception Occurred"}
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 font-info mt-1.5 max-w-md leading-relaxed">
            {isChunkError ? "A new update was deployed. Please refresh your browser to load the latest release." : "The interface encountered a runtime issue in this module."}
          </p>
          {this.state.error?.message && !isChunkError && (
            <pre className="mt-3 p-3 rounded-xl bg-white border border-rose-200 text-[11px] text-rose-900 font-error max-w-lg overflow-x-auto text-left shadow-2xs">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => {
              if (isChunkError) {
                window.location.reload();
              } else {
                this.setState({ hasError: false });
              }
            }}
            className="mt-4 px-5 py-2.5 text-xs bg-gradient-to-br from-emerald-950 to-teal-900 text-white rounded-2xl font-bold font-heading shadow-md hover:brightness-110 active:scale-95 transition-all"
          >
            {isChunkError ? "Refresh Page" : "Retry Section"}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
