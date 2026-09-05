import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Video Speed Reader — 上傳影片，三分鐘內拿到逐字稿" },
      {
        name: "description",
        content:
          "Upload your video, get a clean transcript in three minutes. Built for content creators, educators, and engineers who repurpose long-form video.",
      },
      { property: "og:title", content: "Video Speed Reader — 上傳影片，三分鐘內拿到逐字稿" },
      {
        property: "og:description",
        content: "Upload your video, get a clean transcript in three minutes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

const WAVEFORM_BARS = [30, 55, 78, 48, 90, 62, 84, 100, 70, 40, 22, 14];
const BAR_TONES = [
  "bg-chrome/40",
  "bg-chrome/50",
  "bg-chrome/60",
  "bg-chrome-deep/50",
  "bg-chrome/80",
  "bg-blush/60",
  "bg-blush/80",
  "bg-chrome-deep",
  "bg-chrome/80",
  "bg-chrome/70",
  "bg-chrome/50",
  "bg-chrome/30",
];

function LogoMark({ size = "size-9", text = "text-lg" }: { size?: string; text?: string }) {
  return (
    <div
      className={`relative grid ${size} place-items-center overflow-hidden rounded-[12px] bg-gradient-to-b from-chrome to-chrome-deep ring-1 ring-chrome-deep/40`}
    >
      <span className="spool absolute inset-0 opacity-40" />
      <span className="gloss absolute inset-0" />
      <span className={`relative font-display ${text} font-semibold leading-none text-primary-foreground`}>
        V
      </span>
    </div>
  );
}

function SignInCta() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") setSignedIn(true);
      if (event === "SIGNED_OUT") setSignedIn(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <Link
      to={signedIn ? "/app" : "/auth"}
      className="btn-chrome py-2 pr-3 pl-2 text-sm font-medium leading-none ring-1 ring-chrome-deep/30 transition-shadow"
    >
      {signedIn ? "開啟工作台 / Open app" : "Sign in / 登入"}
    </Link>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-paper font-sans text-ink antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-ink/10 bg-paper/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div className="leading-none">
              <span className="block font-display text-[15px] font-semibold tracking-tight">
                Video Speed Reader
              </span>
              <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.2em] text-ink/45">
                Video · Transcript Engine
              </span>
            </div>
          </div>
          <nav className="hidden items-center gap-8 text-sm font-medium text-ink/70 md:flex">
            <a href="#how" className="transition-colors hover:text-chrome-deep">
              How it works
            </a>
            <a href="#cases" className="transition-colors hover:text-chrome-deep">
              Use cases
            </a>
            <a href="#pricing" className="transition-colors hover:text-chrome-deep">
              Pricing
            </a>
          </nav>
          <SignInCta />
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-chrome/15 to-transparent" />
        <div className="pointer-events-none absolute -top-20 -right-40 size-[420px] rounded-full bg-gradient-to-br from-blush/20 via-peach-light/20 to-transparent blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 py-16 lg:py-24">
          <div className="max-w-[46ch]">
            <span className="inline-flex items-center gap-2 rounded-full bg-chrome-deep/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-chrome-deep ring-1 ring-chrome-deep/20">
              <span className="size-1.5 rounded-full bg-blush" /> 03:00 average turn time
            </span>
            <h1 className="mt-6 max-w-[24ch] font-display text-[34px] leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl xl:text-6xl">
              上傳影片，<span className="text-chrome-deep">三分鐘內</span>拿到逐字稿。
            </h1>
            <p className="mt-5 max-w-[52ch] text-base text-pretty text-ink/65 sm:text-lg">
              Upload your video, get a clean transcript in three minutes.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/auth"
                className="btn-chrome py-2 pr-3 pl-2 text-sm font-medium leading-none ring-1 ring-chrome-deep/40 transition-shadow"
              >
                Sign in / 登入
              </Link>
              <a
                href="#how"
                className="text-sm font-medium text-ink/70 transition-colors hover:text-chrome-deep"
              >
                See how it spools →
              </a>
            </div>
          </div>

          {/* Waveform device */}
          <div className="mt-14 overflow-hidden rounded-[20px] bg-gradient-to-b from-white to-paper shadow-[0_20px_60px_-30px_rgba(201,125,106,0.3)] ring-1 ring-ink/10">
            <div className="flex items-center justify-between border-b border-ink/10 bg-white/60 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-blush/70" />
                <span className="size-3 rounded-full bg-peach-light/70" />
                <span className="size-3 rounded-full bg-chrome-deep/70" />
                <span className="ml-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink/45">
                  spool_0042.mp4
                </span>
              </div>
              <span className="font-mono text-[11px] text-chrome-deep">12:04 → 00:00</span>
            </div>

            <div className="grid md:grid-cols-2">
              <div className="border-b border-ink/10 bg-gradient-to-br from-peach-light/20 to-transparent p-6 md:border-r md:border-b-0">
                <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-ink/45">
                  Audio waveform
                </p>
                <div className="flex h-28 items-end gap-[3px]">
                  {WAVEFORM_BARS.map((h, i) => (
                    <span
                      key={i}
                      className={`w-1.5 rounded-t ${BAR_TONES[i]}`}
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <span className="h-1 flex-1 overflow-hidden rounded-full bg-ink/10">
                    <span className="block h-full w-3/4 rounded-full bg-gradient-to-r from-chrome to-chrome-deep" />
                  </span>
                  <span className="font-mono text-[11px] text-ink/50">75%</span>
                </div>
              </div>
              <div className="bg-white/50 p-6">
                <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.16em] text-ink/45">
                  Extracted transcript
                </p>
                <div className="space-y-3 text-sm leading-relaxed">
                  <p className="text-ink/80">
                    <span className="mr-2 font-mono text-[11px] text-chrome-deep">00:00</span>
                    歡迎各位觀看本集，我們來拆解這個架構。
                  </p>
                  <p className="text-ink/80">
                    <span className="mr-2 font-mono text-[11px] text-chrome-deep">00:14</span>
                    The first thing to understand is the data path.
                  </p>
                  <p className="text-ink/80">
                    <span className="mr-2 font-mono text-[11px] text-chrome-deep">00:31</span>
                    所以我們把整個流程拆成三個子系統。
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-ink/10 bg-white/40">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <h2 className="max-w-[36ch] font-display text-3xl font-semibold tracking-tight text-balance">
            三分鐘，三步走。<span className="text-ink/40">Three minutes, three steps.</span>
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <div className="rounded-[14px] bg-paper p-6 ring-1 ring-ink/10">
              <span className="font-display text-5xl leading-none font-semibold text-chrome/30">01</span>
              <h3 className="mt-4 font-display text-lg font-semibold">上傳影片 / Upload</h3>
              <p className="mt-2 text-sm text-pretty text-ink/60">
                拖入 MP4、MOV 或音檔，引擎自動抓取音軌與音質。
              </p>
            </div>
            <div className="rounded-[14px] bg-paper p-6 ring-1 ring-ink/10">
              <span className="font-display text-5xl leading-none font-semibold text-peach-light/50">02</span>
              <h3 className="mt-4 font-display text-lg font-semibold">快速掃描 / Spool</h3>
              <p className="mt-2 text-sm text-pretty text-ink/60">
                模型以多倍速掃描波形，逐字對齊時間軸。
              </p>
            </div>
            <div className="rounded-[14px] bg-paper p-6 ring-1 ring-ink/10">
              <span className="font-display text-5xl leading-none font-semibold text-blush/30">03</span>
              <h3 className="mt-4 font-display text-lg font-semibold">逐字輸出 / Export</h3>
              <p className="mt-2 text-sm text-pretty text-ink/60">
                輸出乾淨逐字稿，可複製、可搜尋、可匯入筆記。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="cases" className="border-t border-ink/10">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <h2 className="max-w-[40ch] font-display text-3xl font-semibold tracking-tight text-balance">
            為長期錄影的人打造。
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="rounded-[14px] bg-gradient-to-b from-chrome/[0.08] to-transparent p-6 ring-1 ring-ink/10">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-chrome-deep">
                Content creators
              </p>
              <h3 className="mt-3 font-display text-lg font-semibold">創作者</h3>
              <p className="mt-2 text-sm text-pretty text-ink/60">
                把 40 分鐘的影片，變成可重用的部落格文章素材。
              </p>
            </div>
            <div className="rounded-[14px] bg-gradient-to-b from-peach-light/[0.15] to-transparent p-6 ring-1 ring-ink/10">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-chrome-deep">
                Educators
              </p>
              <h3 className="mt-3 font-display text-lg font-semibold">教育者</h3>
              <p className="mt-2 text-sm text-pretty text-ink/60">
                課程錄影轉成講義與字幕，學生可複習、可搜尋。
              </p>
            </div>
            <div className="rounded-[14px] bg-gradient-to-b from-blush/[0.08] to-transparent p-6 ring-1 ring-ink/10">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-chrome-deep">
                Engineers
              </p>
              <h3 className="mt-3 font-display text-lg font-semibold">工程師</h3>
              <p className="mt-2 text-sm text-pretty text-ink/60">
                技術錄影變成可索引的知識庫，隨時回查決策脈絡。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="pricing" className="border-t border-ink/10">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-chrome-deep to-chrome p-10 text-primary-foreground ring-1 ring-chrome-deep/40">
            <div className="gloss pointer-events-none absolute inset-x-0 top-0 h-1/2" />
            <div className="relative max-w-[40ch]">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary-foreground/60">
                Starter · Free
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                開始轉錄你的第一支影片。
              </h2>
              <p className="mt-3 text-pretty text-primary-foreground/70">
                每月 30 分鐘免費額度，無需信用卡。Start transcribing today.
              </p>
              <Link
                to="/auth"
                className="mt-7 inline-block rounded-[10px] bg-white px-3 py-2 text-sm font-medium leading-none text-chrome-deep shadow-[0_3px_0_rgba(0,0,0,0.15)] transition-shadow hover:shadow-[0_4px_0_rgba(0,0,0,0.2)]"
              >
                Sign in / 登入
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink/10 bg-white/40">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
          <div className="flex items-center gap-2 text-sm font-medium">
            <LogoMark size="size-6" text="text-xs" />
            Video Speed Reader
          </div>
          <div className="flex items-center gap-6 text-sm text-ink/55">
            <a href="#how" className="transition-colors hover:text-chrome-deep">
              How it works
            </a>
            <a href="#cases" className="transition-colors hover:text-chrome-deep">
              Use cases
            </a>
            <a href="#pricing" className="transition-colors hover:text-chrome-deep">
              Pricing
            </a>
            <span className="font-mono text-[11px] text-ink/40">© 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
