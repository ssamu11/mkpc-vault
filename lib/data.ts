import { supabase } from "./supabase";
import { emptyCatalog, type Catalog } from "./types";
export async function readCatalog(): Promise<Catalog> {
  const db = await supabase();
  const result: Catalog = structuredClone(emptyCatalog);
  const tables = [
    "groups",
    "idols",
    "group_memberships",
    "packs",
    "rarities",
    "cards",
    "card_idols",
    "import_history",
  ] as const;
  // Supabase returns at most 1,000 records by default. Page every relation.
  await Promise.all(
    tables.map(async (table) => {
      const rows: unknown[] = [];
      for (let start = 0; ; start += 1000) {
        let query = db
          .from(table)
          .select("*")
          .order(table === "card_idols" ? "card_id" : "id");
        if (table === "card_idols") query = query.order("idol_id");
        const { data, error } = await query.range(start, start + 999);
        if (error) throw Error(error.message);
        rows.push(...data);
        if (data.length < 1000) break;
      }
      Object.assign(result, { [table]: rows });
    }),
  );
  const { data, error } = await db
    .from("settings")
    .select("include_unreleased")
    .single();
  if (error) throw Error(error.message);
  result.settings = data;
  return result;
}
