import { PackOverview } from "../src/components/PackOverview";
import { listAvailablePacks } from "../src/server/packRegistry";

export default async function Page() {
  const packs = await listAvailablePacks();
  return <PackOverview packs={packs} />;
}
