import type { Catalog } from "./types";
import { plannerPool, type PlannerCandidate } from "./planner";
import { groupNameKey, groupIdentityKey, groupPopularity } from "./planner-curation";

export type ReferenceRoster = {
  artists: { kpopping_artist_id: string; stage_name: string; normalized_name: string; status: string; kpopping_url: string | null }[];
  groups: { kpopping_group_id: string; name: string; group_type: string; entity_type: string; status: string; is_subunit: boolean }[];
  memberships: { kpopping_membership_id: string; kpopping_artist_id: string; kpopping_group_id: string; role: string | null; leave_date: string | null }[];
  artistLinks: { idol_id: string; kpopping_artist_id: string; confirmed: boolean }[];
  groupLinks: { group_id: string; kpopping_group_id: string; confirmed: boolean }[];
  aliases: { kpopping_artist_id: string; normalized_alias: string }[];
};

export function discoveryPool(data: Catalog, ref: ReferenceRoster): PlannerCandidate[] {
  const local = plannerPool(data);
  const localById = new Map(local.map((p) => [p.idol.id, p]));
  const artistById = new Map(ref.artists.map((a) => [a.kpopping_artist_id, a]));
  const groupById = new Map(ref.groups.map((g) => [g.kpopping_group_id, g]));
  const groupLinks = new Map(ref.groupLinks.filter((l) => l.confirmed).map((l) => [l.kpopping_group_id, data.groups.find((g) => g.id === l.group_id)]));
  const localGroups = new Map(ref.groups.map((g) => [g.kpopping_group_id, groupLinks.get(g.kpopping_group_id) || data.groups.find((l) => groupIdentityKey(l.name) === groupIdentityKey(g.name))]));
  const scopes = new Map<string, Set<string>>();
  for (const m of ref.memberships) {
    const group = localGroups.get(m.kpopping_group_id);
    if (!group) continue;
    if (!scopes.has(m.kpopping_artist_id)) scopes.set(m.kpopping_artist_id, new Set());
    scopes.get(m.kpopping_artist_id)!.add(group.id);
  }
  const artistLinks = new Map<string, PlannerCandidate[]>();
  for (const link of ref.artistLinks.filter((l) => l.confirmed)) {
    const candidate = localById.get(link.idol_id);
    if (candidate) artistLinks.set(link.kpopping_artist_id, [...(artistLinks.get(link.kpopping_artist_id) || []), candidate]);
  }
  const result = new Map<string, PlannerCandidate>();
  const matched = new Set<string>();
  for (const m of [...ref.memberships].sort((a, b) => a.kpopping_group_id.localeCompare(b.kpopping_group_id))) {
    if (m.leave_date || (m.role && !["member", "idol", "artist"].includes(m.role))) continue;
    const artist = artistById.get(m.kpopping_artist_id), group = groupById.get(m.kpopping_group_id);
    if (!artist || !group || !["active", "hiatus"].includes(group.status) || group.entity_type !== "human") continue;
    const knownGroup = localGroups.get(group.kpopping_group_id);
    const popularity = groupPopularity(knownGroup?.name || group.name);
    const gender = group.group_type === "girl_group" ? "female" : group.group_type === "boy_group" ? "male" : null;
    if (!popularity || !gender) continue;
    const names = new Set([groupNameKey(artist.stage_name), ...ref.aliases.filter((a) => a.kpopping_artist_id === artist.kpopping_artist_id).map((a) => groupNameKey(a.normalized_alias))]);
    const linked = artistLinks.get(artist.kpopping_artist_id) || [];
    if (ref.artistLinks.some((l) => l.confirmed && l.kpopping_artist_id === artist.kpopping_artist_id && !localById.has(l.idol_id))) continue;
    const inScope = (p: PlannerCandidate) => data.group_memberships.some((gm) => gm.idol_id === p.idol.id && scopes.get(artist.kpopping_artist_id)?.has(gm.group_id));
    const exact = local.filter((p) => names.has(groupNameKey(p.idol.stage_name)) && inScope(p));
    const possibleAlias = local.some((p) => p.idol.gender === gender && (inScope(p) || !p.group || ["solo", "soloist"].includes(groupNameKey(p.group.name))) &&
      [...names].some((name) => name.endsWith(groupNameKey(p.idol.stage_name)) || groupNameKey(p.idol.stage_name).endsWith(name)));
    // Ambiguous matches are withheld, never generated as a second identity.
    if (!linked.length && (exact.length > 1 || (!exact.length && possibleAlias))) continue;
    const locals = linked.length ? linked : exact;
    locals.forEach((p) => matched.add(p.idol.id));
    const base = [...locals].sort((a, b) => b.released - a.released || a.idol.id.localeCompare(b.idol.id))[0];
    if (base && (!base.idol.active || base.idol.gender !== gender)) continue;
    const identity = `reference:${artist.kpopping_artist_id}`;
    if (result.has(identity)) continue;
    const appearances = [...new Map(locals.flatMap((p) => p.appearances).map((c) => [c.id, c])).values()];
    const released = appearances.filter((c) => data.packs.find((p) => p.id === c.pack_id)?.status === "released").length;
    const rebirth = [...new Map(locals.flatMap((p) => p.rebirth).map((c) => [c.id, c])).values()];
    result.set(identity, {
      idol: base?.idol || { id: identity, stage_name: artist.stage_name, normalized_name: artist.normalized_name, gender, active: true },
      group: base?.group || knownGroup || { id: `reference:${group.kpopping_group_id}`, name: group.name, normalized_name: groupNameKey(group.name), status: "active", roster_configured: false },
      key: base?.key || knownGroup?.id || `reference:${group.kpopping_group_id}`,
      identity, appearances, rebirth,
      gap: locals.length ? Math.min(...locals.map((p) => p.gap)) : data.packs.filter((p) => p.pack_type === "Rebirth").length + 1,
      released, pending: appearances.length - released, popularity,
      source: base ? "local" : "reference",
      reference_artist_id: artist.kpopping_artist_id,
      reference_group_id: group.kpopping_group_id,
      source_url: artist.kpopping_url || undefined,
    });
  }
  for (const p of local) {
    if (matched.has(p.idol.id)) continue;
    const linkedId = ref.artistLinks.find((l) => l.confirmed && l.idol_id === p.idol.id)?.kpopping_artist_id;
    const identity = linkedId ? `reference:${linkedId}` : p.identity;
    if (result.has(identity)) continue;
    const solo = !p.group || ["solo", "soloist"].includes(groupNameKey(p.group.name));
    const popularity = solo ? p.released ? "established" : null : groupPopularity(p.group!.name);
    if (popularity) result.set(identity, { ...p, popularity, identity, reference_artist_id: linkedId });
  }
  return [...result.values()].sort((a, b) => a.idol.stage_name.localeCompare(b.idol.stage_name));
}
