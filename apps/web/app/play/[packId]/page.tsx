import { GameShell } from "../../../src/components/GameShell";

export default function PlayPage({ params }: { params: { packId: string } }) {
  return <GameShell packId={params.packId} />;
}
