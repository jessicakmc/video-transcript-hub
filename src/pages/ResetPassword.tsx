import { Link, useNavigate } from "react-router-dom";
import { useDocumentHead } from "@/lib/use-document-head";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const HEAD = {
    meta: [
      { title: "Reset password — Video Speed Reader" },
      { name: "description", content: "Reset your Video Speed Reader password." },
      { property: "og:title", content: "Reset password — Video Speed Reader" },
      { property: "og:description", content: "Reset your Video Speed Reader password." },
      { property: "og:type", content: "website" },
    ],
};

export default function ResetPasswordPage() {
  useDocumentHead(HEAD);
  const navigate = useNavigate();
  const [isRecovery, setIsRecovery] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Recovery links land here with type=recovery in the URL hash
    if (window.location.hash.includes("type=recovery")) setIsRecovery(true);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setIsRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("重設信已寄出", { description: "Check your email for the reset link." });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("密碼已更新", { description: "Your password has been updated." });
      navigate("/app");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-paper px-4 font-sans text-ink">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-chrome/15 to-transparent" />

      <div className="relative w-full max-w-sm">
        <div className="rounded-[20px] bg-gradient-to-b from-white to-paper p-6 shadow-[0_20px_60px_-30px_rgba(201,125,106,0.3)] ring-1 ring-ink/10">
          <h1 className="font-display text-lg font-semibold tracking-tight">
            {isRecovery ? "設定新密碼 / Set a new password" : "重設密碼 / Reset password"}
          </h1>
          <p className="mt-1 text-sm text-ink/55">
            {isRecovery
              ? "Enter a new password for your account."
              : "我們會寄一封重設連結到你的信箱。"}
          </p>

          {isRecovery ? (
            <form onSubmit={handleUpdate} className="mt-5 space-y-3">
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="新密碼 / New password"
                className="w-full rounded-[10px] border border-input bg-white px-3 py-2 text-sm outline-none placeholder:text-ink/40 focus:ring-2 focus:ring-chrome-deep/40"
              />
              <button
                type="submit"
                disabled={loading}
                className="btn-chrome w-full py-2.5 text-sm font-medium ring-1 ring-chrome-deep/40 transition-shadow disabled:opacity-60"
              >
                {loading ? "…" : "更新密碼 / Update password"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRequest} className="mt-5 space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-[10px] border border-input bg-white px-3 py-2 text-sm outline-none placeholder:text-ink/40 focus:ring-2 focus:ring-chrome-deep/40"
              />
              <button
                type="submit"
                disabled={loading}
                className="btn-chrome w-full py-2.5 text-sm font-medium ring-1 ring-chrome-deep/40 transition-shadow disabled:opacity-60"
              >
                {loading ? "…" : "寄出重設信 / Send reset link"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm">
          <Link to="/sign-in" className="text-ink/55 hover:text-chrome-deep">
            ← 返回登入 / Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
