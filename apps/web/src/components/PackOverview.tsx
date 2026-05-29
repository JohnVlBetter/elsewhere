import Link from "next/link";
import { ArrowRight, BookOpen, Library, Sparkles } from "lucide-react";
import type { WorldPackSummary } from "@aigame/pack";
import { resolveStoryVisuals } from "./packVisuals";

export function PackOverview({ packs }: { packs: WorldPackSummary[] }) {
  const featured = packs[0];
  const featuredVisuals = featured ? resolveStoryVisuals(featured) : undefined;

  return (
    <main className="story-library min-h-screen bg-[var(--page-bg)] px-4 py-4 text-[var(--ink)] sm:px-6 lg:px-10">
      <div className="mx-auto grid w-full max-w-7xl gap-5">
        <header className="story-library__header flex flex-col gap-4 rounded-lg border border-[var(--line)] bg-white/[0.76] p-4 shadow-[0_18px_50px_rgba(39,34,28,0.08)] backdrop-blur md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="eyebrow mb-1 flex items-center gap-2 text-sm font-bold text-[var(--accent-strong)]">
              <Library className="h-4 w-4" aria-hidden="true" />
              本地故事
            </p>
            <h1 className="text-3xl font-bold leading-tight md:text-4xl">故事库</h1>
          </div>
          <p className="flex items-center gap-2 text-sm font-bold text-[var(--muted)]">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            {packs.length} 个可游玩的世界
          </p>
        </header>

        {featured && featuredVisuals ? (
          <section
            aria-label="精选故事"
            className="relative min-h-[280px] overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--story-bg)] bg-cover bg-center text-[var(--story-text)] shadow-[0_24px_70px_rgba(39,34,28,0.14)]"
            style={{ ...featuredVisuals.cssVars, ...featuredVisuals.bannerStyle }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.92),rgba(255,255,255,0.68),rgba(255,255,255,0.18))]" />
            <div className="relative grid min-h-[280px] content-end gap-4 p-5 sm:p-8 lg:w-3/5">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/70 bg-white/[0.78] px-3 py-1 text-sm font-bold text-[var(--accent-strong)]">
                <Sparkles className="h-4 w-4" aria-hidden="true" data-testid="library-hero-icon" />
                {featured.subtitle}
              </span>
              <div className="grid gap-2">
                <h2 className="text-3xl font-bold leading-tight sm:text-5xl">{featured.title}</h2>
                <p className="max-w-2xl text-base leading-7 text-[var(--ink)] sm:text-lg">{featured.introduction}</p>
              </div>
              <Link
                href={`/play/${featured.id}`}
                aria-label={`进入 ${featured.title}`}
                className="inline-flex w-fit items-center gap-2 rounded-md bg-[var(--accent-strong)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(47,80,104,0.24)] transition hover:bg-[var(--accent)]"
              >
                进入故事
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </section>
        ) : null}

        {packs.length === 0 ? (
          <section className="empty-panel grid gap-3 rounded-lg border border-[var(--line)] bg-white p-6 shadow-[0_14px_34px_rgba(39,34,28,0.07)]" aria-label="暂无故事">
            <BookOpen className="h-9 w-9 text-[var(--accent-strong)]" aria-hidden="true" data-testid="empty-library-icon" />
            <h2 className="text-xl font-bold">还没有可用故事</h2>
            <p className="text-[var(--muted)]">把有效的故事包放进 packs 目录后，这里会自动出现入口。</p>
          </section>
        ) : (
          <section className="story-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="故事列表">
            {packs.map((pack) => {
              const visuals = resolveStoryVisuals(pack);
              return (
                <Link
                  key={pack.id}
                  className="story-card group grid min-h-[390px] overflow-hidden rounded-lg border border-[var(--line)] bg-white text-[var(--ink)] shadow-[0_16px_40px_rgba(39,34,28,0.08)] transition hover:-translate-y-0.5 hover:border-[var(--story-accent)] hover:shadow-[0_22px_54px_rgba(39,34,28,0.14)]"
                  href={`/play/${pack.id}`}
                  style={visuals.cssVars}
                  aria-label={`${pack.title}，开始阅读`}
                  data-testid="story-card"
                >
                  <div className="story-card__cover relative min-h-[190px] overflow-hidden bg-[var(--surface-2)] bg-cover bg-center" style={visuals.coverStyle} data-has-cover={visuals.hasCoverImage} data-testid="story-cover-slot">
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(36,33,29,0.04),rgba(36,33,29,0.56))]" />
                    <span className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] rounded-full bg-white/[0.84] px-3 py-1 text-sm font-bold text-[var(--accent-strong)]">{pack.subtitle}</span>
                  </div>
                  <div className="story-card__body grid content-start gap-3 p-4">
                    <p className="story-card__meta text-sm font-semibold text-[var(--muted)]">{pack.subtitle} · v{pack.version}</p>
                    <h2 className="text-2xl font-bold leading-snug">{pack.title}</h2>
                    <p className="line-clamp-3 leading-7 text-[var(--muted)]">{pack.introduction}</p>
                    <strong className="mt-auto inline-flex items-center gap-2 text-sm text-[var(--story-accent)]">
                      开始阅读
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                    </strong>
                  </div>
                </Link>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
