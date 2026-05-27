import { GameShell } from "../../../src/components/GameShell";

export default async function PlayPage({ params }: { params: Promise<{ packId: string }> }) {
  const { packId } = await params;
  return <GameShell packId={packId} />;
}
