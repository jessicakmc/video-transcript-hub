import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Video Speed Reader" },
      { name: "description", content: "Sign in to Video Speed Reader to start transcribing." },
      { property: "og:title", content: "Sign in — Video Speed Reader" },
      { property: "og:description", content: "Sign in to Video Speed Reader to start transcribing." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
  }, [navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/app" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { display_name: displayName },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("確認信已寄出", {
            description: "Check your email to confirm your account, then sign in.",
          });
          setMode("signin");
        } else {
          navigate({ to: "/app" });
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google 登入失敗", { description: result.error.message });
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/app" });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-4 font-sans text-ink">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-chrome/15 to-transparent" />
      <div className="pointer-events-none absolute -top-20 -right-40 size-[420px] rounded-full bg-gradient-to-br from-blush/20 via-peach-light/20 to-transparent blur-3xl" />

      <div className="relative w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-3">
          <div className="relative grid size-9 place-items-center overflow-hidden rounded-[12px] bg-gradient-to-b from-chrome to-chrome-deep ring-1 ring-chrome-deep/40">
            <span className="spool absolute inset-0 opacity-40" />
            <span className="gloss absolute inset-0" />
            <span className="relative font-display text-lg font-semibold leading-none text-primary-foreground">
              V
            </span>
          </div>
          <span className="font-display text-[15px] font-semibold tracking-tight">
            Video Speed Reader
          </span>
        </Link>

        <div className="rounded-[20px] bg-gradient-to-b from-white to-paper p-6 shadow-[0_20px_60px_-30px_rgba(201,125,106,0.3)] ring-1 ring-ink/10">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-[10px] bg-ink/[0.04] p-1 text-sm font-medium">
            <button
              onClick={() => setMode("signin")}
              className={`rounded-[8px] py-1.5 transition-colors ${
                mode === "signin" ? "bg-white text-chrome-deep shadow-sm ring-1 ring-ink/10" : "text-ink/55"
              }`}
            >
              登入 Sign in
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`rounded-[8px] py-1.5 transition-colors ${
                mode === "signup" ? "bg-white text-chrome-deep shadow-sm ring-1 ring-ink/10" : "text-ink/55"
              }`}
            >
              註冊 Sign up
            </button>
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            {mode === "signup" && (
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="顯示名稱 / Display name"
                className="w-full rounded-[10px] border border-input bg-white px-3 py-2 text-sm outline-none placeholder:text-ink/40 focus:ring-2 focus:ring-chrome-deep/40"
              />
            )}
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-[10px] border border-input bg-white px-3 py-2 text-sm outline-none placeholder:text-ink/40 focus:ring-2 focus:ring-chrome-deep/40"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密碼 / Password"
              className="w-full rounded-[10px] border border-input bg-white px-3 py-2 text-sm outline-none placeholder:text-ink/40 focus:ring-2 focus:ring-chrome-deep/40"
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-chrome w-full py-2.5 text-sm font-medium ring-1 ring-chrome-deep/40 transition-shadow disabled:opacity-60"
            >
              {loading ? "…" : mode === "signin" ? "Sign in / 登入" : "建立帳號 / Create account"}
            </button>
          </form>

          {mode === "signin" && (
            <div className="mt-3 text-center">
              <Link to="/reset-password" className="text-xs text-ink/50 hover:text-chrome-deep">
                忘記密碼？ Forgot password
              </Link>
            </div>
          )}

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-ink/10" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/40">or</span>
            <span className="h-px flex-1 bg-ink/10" />
          </div>

          <button
            onClick={handleGoogle}
            className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-input bg-white py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
              />
            </svg>
            使用 Google 登入 / Continue with Google
          </button>
        </div>

        <p className="mt-6 text-center font-mono text-[11px] text-ink/40">
          03:00 average turn time · spooled, not scrolled
        </p>
      </div>
    </div>
  );
}
