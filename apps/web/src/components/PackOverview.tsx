import Link from "next/link";
import type { WorldPackSummary } from "@aigame/pack";

export function PackOverview({ packs }: { packs: WorldPackSummary[] }) {
  return (
    <main className="story-overview">
      <header className="story-overview__header">
        <p className="eyebrow">本地故事</p>
        <h1>选择案件</h1>
      </header>
      <section className="story-grid" aria-label="案件列表">
        {packs.map((pack) => (
          <Link key={pack.id} className="story-card" href={`/play/${pack.id}`}>
            <span>{pack.subtitle} · {pack.version}</span>
            <h2>{pack.title}</h2>
            <p>{pack.introduction}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
