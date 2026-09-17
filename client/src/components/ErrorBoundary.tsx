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
        <div className="min-h-[40vh] flex flex-col items-center justify-center p-6 text-center">
          <p className="text-sm text-red-600 font-medium">
            {isChunkError ? "A new update was deployed to the application." : "Something went wrong loading this section."}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {isChunkError ? "Please refresh your page to load the updated module." : this.state.error?.message}
          </p>
          <button
            onClick={() => {
              if (isChunkError) {
                window.location.reload();
              } else {
                this.setState({ hasError: false });
              }
            }}
            className="mt-3 px-4 py-2 text-sm bg-emerald-800 text-white rounded-xl font-semibold shadow-sm hover:bg-emerald-700 transition-colors"
          >
            {isChunkError ? "Refresh Page" : "Retry"}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
