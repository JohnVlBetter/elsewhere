import MiniSearch from "minisearch";

export interface PackChunk {
  id: string;
  text: string;
}

export interface PackIndex {
  search: MiniSearch<PackChunk>;
}

export function buildPackIndex(chunks: PackChunk[]): PackIndex {
  const search = new MiniSearch<PackChunk>({
    fields: ["text"],
    storeFields: ["id", "text"]
  });
  search.addAll(chunks);
  return { search };
}

export function searchPackIndex(index: PackIndex, query: string, limit: number): PackChunk[] {
  return index.search.search(query, { prefix: true, fuzzy: 0.2 }).slice(0, limit).map((result) => ({
    id: String(result.id),
    text: String(result.text)
  }));
}
