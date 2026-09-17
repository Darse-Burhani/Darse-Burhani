import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl: string | null;
}

export interface Session {
  user: SessionUser;
  expires?: string;
}

export interface SessionStatus {
  data: Session | null;
  status: "loading" | "authenticated" | "unauthenticated";
  update: (data?: Session) => Promise<Session | null>;
}

const SessionContext = createContext<SessionStatus>({
  data: null,
  status: "loading",
  update: async () => null,
});

let refreshHandler: (() => Promise<Session | null>) | null = null;

// Backend is (re)starting alongside the Vite dev server; the proxy can briefly
// return 5xx before it is ready. Retry with backoff so the user isn't flickered
// to "logged out" (and the console isn't flooded with 500 errors) on startup.
// The cold compile of the Express backend (Prisma + all route modules under
// vite-node) can take 30-60s on first boot, so the window covers ~1 minute.
const SESSION_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 32000];

// `undefined` means the backend was unreachable after all retries (still
// starting / mid-restart) — callers should keep the "loading" state rather
// than treating the user as signed out.
type SessionResult = Session | null | undefined;

let sessionInFlight: Promise<SessionResult> | null = null;

async function fetchSession(): Promise<SessionResult> {
  // React StrictMode double-mounts, and getSession/signOut can race the provider's
  // initial load — share a single attempt so we don't hammer the endpoint.
  if (!sessionInFlight) {
    sessionInFlight = fetchSessionOnce().finally(() => {
      sessionInFlight = null;
    });
  }
  return sessionInFlight;
}

async function fetchSessionOnce(): Promise<SessionResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= SESSION_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        const data = json?.data ?? json;
        if (data?.user) return { user: data.user };
        return null;
      }
      // 4xx/401 means genuinely not signed in — no point retrying.
      if (res.status < 500) return null;
      lastError = new Error(`session request failed with status ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < SESSION_RETRY_DELAYS_MS.length) {
      await new Promise((resolve) => setTimeout(resolve, SESSION_RETRY_DELAYS_MS[attempt]));
    }
  }
  if (lastError) console.warn("[session] backend unreachable after retries:", lastError);
  return undefined;
}

export function SessionProvider({
  children,
}: {
  children: React.ReactNode;
  session?: Session | null;
  refetchInterval?: number;
  refetchOnWindowFocus?: boolean;
}) {
  const [data, setData] = useState<Session | null>(null);
  const [status, setStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (): Promise<Session | null> => {
    const session = await fetchSession();
    if (session === undefined) {
      // Backend is (re)starting and unreachable. Stay in "loading" so the user
      // isn't flickered to "logged out", and try again after the backoff window.
      setStatus("loading");
      if (!retryTimer.current) {
        retryTimer.current = setTimeout(() => {
          retryTimer.current = null;
          load();
        }, SESSION_RETRY_DELAYS_MS[SESSION_RETRY_DELAYS_MS.length - 1]);
      }
      return null;
    }
    setData(session);
    setStatus(session ? "authenticated" : "unauthenticated");
    return session;
  }, []);

  useEffect(() => {
    load();
    refreshHandler = load;
    return () => {
      refreshHandler = null;
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
    };
  }, [load]);

  const update = useCallback(async (next?: Session) => {
    if (next) {
      setData(next);
      setStatus("authenticated");
      return next;
    }
    return load();
  }, [load]);

  return (
    <SessionContext.Provider value={{ data, status, update }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionStatus {
  return useContext(SessionContext);
}

export interface SignInResponse {
  error?: string;
  status?: number;
  ok?: boolean;
  url?: string;
  /** True when the API itself failed (5xx or unreachable) after retries. */
  serverError?: boolean;
}

// The login endpoint can briefly return 5xx while the backend is (re)compiling
// or (re)connecting — same window the session retry handles above. Retry a few
// times with backoff so a mid-restart login doesn't hard-fail. A 4xx/401 is a
// genuine auth failure and is returned immediately.
// Aligns with the cold compile of the Express backend (see session retry above)
// — a login clicked during that window should succeed once it's ready.
const LOGIN_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000];

export async function signIn(
  provider: string,
  options?: {
    email?: string;
    password?: string;
    portalRole?: string;
    redirect?: boolean;
    callbackUrl?: string;
  },
): Promise<SignInResponse | undefined> {
  let lastStatus: number | undefined;
  for (let attempt = 0; attempt <= LOGIN_RETRY_DELAYS_MS.length; attempt++) {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: options?.email,
          password: options?.password,
          portalRole: options?.portalRole,
        }),
      });

      if (res.ok) {
        const json = await res.json().catch(() => null);
        // A 2xx with an unparseable body (e.g. a proxy error page) isn't a
        // valid login response — treat it like a server hiccup and retry.
        if (!json) {
          lastStatus = res.status;
        } else if (json.success) {
          if (refreshHandler) await refreshHandler();
          if (options?.redirect) {
            window.location.href = options.callbackUrl || "/";
          }
          return { ok: true, status: res.status, url: options?.callbackUrl };
        } else {
          return { error: json?.error || "Invalid credentials", status: res.status, ok: false };
        }
      }

      // 4xx/401 means the credentials were rejected — no point retrying.
      if (res.status < 500) {
        const json = await res.json().catch(() => null);
        return { error: json?.error || "Invalid credentials", status: res.status, ok: false };
      }

      lastStatus = res.status;
    } catch {
      // Network error / backend unreachable — fall through and retry.
    }
    if (attempt < LOGIN_RETRY_DELAYS_MS.length) {
      await new Promise((resolve) => setTimeout(resolve, LOGIN_RETRY_DELAYS_MS[attempt]));
    }
  }
  // Backend was unreachable or kept returning 5xx on every attempt.
  return {
    error: "Server is starting up. Please try again.",
    status: lastStatus,
    ok: false,
    serverError: true,
  };
}

export async function signOut(options?: { callbackUrl?: string; redirect?: boolean }): Promise<void> {
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
  } catch {
    // ignore network errors on logout
  }
  if (refreshHandler) await refreshHandler();
  if (typeof window !== "undefined") {
    const url = options?.callbackUrl || "/login";
    window.location.href = url;
  }
}

export async function getSession(): Promise<Session | null> {
  return (await fetchSession()) ?? null;
}

export { SessionContext };
