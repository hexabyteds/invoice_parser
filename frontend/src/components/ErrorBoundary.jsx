import React from "react";
import { AlertTriangle } from "lucide-react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Unhandled React application error:", error);
    console.error("Component stack:", errorInfo.componentStack);

    // Later you can send this to Sentry / LogRocket / your own API.
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center shadow-2xl">

            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-400">
              <AlertTriangle size={30} />
            </div>

            <h1 className="text-2xl font-bold font-display tracking-tight">
              Something went wrong
            </h1>

            <p className="mt-3 text-slate-400">
              An unexpected error occurred while loading this page.
              Your data is safe. Please try again.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <pre className="mt-6 max-h-40 overflow-auto rounded-lg bg-slate-950 p-4 text-left text-xs text-red-400">
                {this.state.error.toString()}
              </pre>
            )}

            <div className="mt-6 flex justify-center gap-3">

              <button
                type="button"
                onClick={this.handleReload}
                className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 font-semibold transition hover:from-indigo-500 hover:to-violet-500"
              >
                Reload Page
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="rounded-xl border border-slate-700 px-5 py-3 font-semibold transition hover:bg-slate-800"
              >
                Go Home
              </button>

            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;