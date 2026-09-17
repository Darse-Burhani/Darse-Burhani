import { useNavigate, useLocation } from "react-router-dom";

export function useRouter() {
  const navigate = useNavigate();
  return {
    push: (to: string) => navigate(to),
    replace: (to: string) => navigate(to, { replace: true }),
    back: () => navigate(-1),
    forward: () => navigate(1),
    prefetch: () => {},
    refresh: () => {},
  };
}

export function usePathname(): string {
  return useLocation().pathname;
}

export function useSearchParams(): URLSearchParams {
  const { search } = useLocation();
  return new URLSearchParams(search);
}

export function redirect(url: string): never {
  throw new Error(`redirect() is not supported in the SPA (target: ${url}). Use react-router navigation instead.`);
}
