import { supabase } from "./supabase";
import { readCatalog } from "./data";
import { discoveryPool, type ReferenceRoster } from "./planner-discovery";

export async function readPlannerPool() {
  const db = await supabase();
  async function all(table: string, columns: string, order: string) {
    const rows: unknown[] = [];
    for (let start = 0; ; start += 1000) {
      const { data, error } = await db.from(table).select(columns).order(order).range(start, start + 999);
      if (error) throw Error(`${table}: ${error.message}`);
      rows.push(...data);
      if (data.length < 1000) return rows;
    }
  }
  const [catalog, artists, groups, memberships, artistLinks, groupLinks, aliases] = await Promise.all([
    readCatalog(),
    all("kpopping_artists", "kpopping_artist_id,stage_name,normalized_name,status,kpopping_url", "kpopping_artist_id"),
    all("kpopping_groups", "kpopping_group_id,name,group_type,entity_type,status,is_subunit", "kpopping_group_id"),
    all("kpopping_memberships", "kpopping_membership_id,kpopping_artist_id,kpopping_group_id,role,leave_date", "kpopping_membership_id"),
    all("idol_kpopping_links", "idol_id,kpopping_artist_id,confirmed", "idol_id"),
    all("group_kpopping_links", "group_id,kpopping_group_id,confirmed", "group_id"),
    all("kpopping_artist_aliases", "kpopping_artist_id,normalized_alias", "id"),
  ]);
  return { catalog, pool: discoveryPool(catalog, { artists, groups, memberships, artistLinks, groupLinks, aliases } as ReferenceRoster) };
}
