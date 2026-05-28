import Link from "next/link";
import type { WorldPackSummary } from "@aigame/pack";
import { resolveStoryVisuals } from "./packVisuals";

export function PackOverview({ packs }: { packs: WorldPackSummary[] }) {
  return (
    <main className="story-library">
      <header className="story-library__header">
        <div>
          <p className="eyebrow">本地故事</p>
          <h1>故事库</h1>
        </div>
        <p>{packs.length} 个可游玩的世界</p>
      </header>

      {packs.length === 0 ? (
        <section className="empty-panel" aria-label="暂无故事">
          <h2>还没有可用故事</h2>
          <p>把有效的故事包放进 packs 目录后，这里会自动出现入口。</p>
        </section>
      ) : (
        <section className="story-grid" aria-label="故事列表">
          {packs.map((pack) => {
            const visuals = resolveStoryVisuals(pack);
            return (
              <Link key={pack.id} className="story-card" href={`/play/${pack.id}`} style={visuals.cssVars} aria-label={`${pack.title}，开始阅读`}>
                <div className="story-card__cover" style={visuals.coverStyle} data-has-cover={visuals.hasCoverImage}>
                  <span>{pack.subtitle}</span>
                </div>
                <div className="story-card__body">
                  <p className="story-card__meta">{pack.subtitle} · v{pack.version}</p>
                  <h2>{pack.title}</h2>
                  <p>{pack.introduction}</p>
                  <strong>开始阅读</strong>
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </main>
  );
}
