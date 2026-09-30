import type { Catalog, Card } from "./types";
import { tierKeys, rebirthLayout, premiumLayout } from "./pocapop";
import { groupNameKey, type Popularity } from "./planner-curation";
export type PlannerCandidate = {
  idol: Catalog["idols"][number];
  group: Catalog["groups"][number] | undefined;
  key: string;
  identity: string;
  appearances: Card[];
  rebirth: Card[];
  gap: number;
  released: number;
  pending: number;
  popularity: Popularity;
  source: "local" | "reference" | "custom";
  reference_artist_id?: string;
  reference_group_id?: string;
  source_url?: string;
};
export type PlannerRow = {
  slot: string;
  rarity_id: string;
  idol_id: string;
  gender: string;
  locked: boolean;
  image_asset_id: string;
  reason: string;
};
export type PlannerOptions = {
  kind: "Rebirth" | "Premium";
  mode: "balanced" | "coverage" | "variety";
  groupLimit: number;
  cooldown: number;
  seed: number;
  excluded: string[];
  newPercent?: number;
};
export function plannerPool(data: Catalog): PlannerCandidate[] {
  const ordered = data.packs
    .filter((p) => p.pack_type === "Rebirth")
    .sort((a, b) => (a.pack_number || 0) - (b.pack_number || 0));
  const packRank = new Map(ordered.map((p, i) => [p.id, i]));
  return data.idols
    .filter(
      (i) =>
        i.active &&
        ["female", "male"].includes(i.gender) &&
        !i.game_idol_id?.endsWith("-GROUP"),
    )
    .map((idol) => {
      const appearances = data.card_idols
        .filter((x) => x.idol_id === idol.id)
        .map((x) => data.cards.find((c) => c.id === x.card_id))
        .filter(
          (c): c is Card =>
            c !== undefined &&
            data.packs.find((p) => p.id === c.pack_id)?.status !== "archived",
        );
      const membership = data.group_memberships.find(
        (m) => m.idol_id === idol.id && m.membership_status === "current",
      );
      const group = data.groups.find((g) => g.id === membership?.group_id);
      const rebirth = appearances.filter((c) => packRank.has(c.pack_id));
      const last = rebirth.reduce(
        (n, c) => Math.max(n, packRank.get(c.pack_id)!),
        -1,
      );
      const gap = last < 0 ? ordered.length + 1 : ordered.length - 1 - last;
      return {
        idol,
        group,
        key: group && !["solo", "soloist"].includes(groupNameKey(group.name)) ? group.id : `solo:${idol.id}`,
        appearances,
        rebirth,
        gap,
        identity: `local:${idol.id}`,
        released: appearances.filter((c) => data.packs.find((p) => p.id === c.pack_id)?.status === "released").length,
        pending: appearances.filter((c) => ["planning", "draft", "ready"].includes(data.packs.find((p) => p.id === c.pack_id)?.status || "")).length,
        popularity: "nugu" as const,
        source: "local" as const,
      };
    });
}
function noise(id: string, seed: number) {
  let h = 2166136261 ^ seed;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}
export function generatePlan(
  data: Catalog,
  options: PlannerOptions,
  previous: PlannerRow[] = [],
  candidates?: PlannerCandidate[],
): PlannerRow[] {
  const counts = options.kind === "Premium" ? premiumLayout : rebirthLayout;
  const pool = (candidates ?? plannerPool(data)).filter(
    (x) => !options.excluded.includes(x.idol.id),
  );
  const slots: PlannerRow[] = [];
  let slot = 0;
  // High tiers are allocated first; otherwise common slots consume every fresh candidate.
  for (const index of [5, 4, 3, 2, 1, 0]) {
    if (!counts[index]) continue;
    const rarity = data.rarities.find(
      (r) => r.game_key === tierKeys[index] && r.active,
    );
    if (!rarity) throw Error(`Missing active tier ${tierKeys[index]}.`);
    for (const gender of ["female", "male"])
      for (let n = 0; n < counts[index] / 2; n++)
        slots.push({
          slot: String(++slot),
          rarity_id: rarity.id,
          idol_id: "",
          gender,
          locked: false,
          image_asset_id: "",
          reason: "",
        });
  }
  const used = new Set<string>(),
    groups = new Map<string, number>();
  for (const row of slots) {
    const locked = previous.find((p) => p.slot === row.slot && p.locked);
    if (!locked) continue;
    const candidate = pool.find((x) => x.idol.id === locked.idol_id);
    if (
      !candidate ||
      candidate.idol.gender !== row.gender ||
      locked.rarity_id !== row.rarity_id ||
      used.has(candidate?.identity || locked.idol_id)
    )
      throw Error(
        "A locked slot conflicts with the current pack layout or exclusions.",
      );
    if (candidate.gap < options.cooldown)
      throw Error(
        "A locked artist conflicts with the current cooldown. Unlock the slot or reduce cooldown.",
      );
    Object.assign(row, locked);
    used.add(candidate.identity);
    groups.set(candidate.key, (groups.get(candidate.key) || 0) + 1);
  }
  if ([...groups.values()].some((n) => n > options.groupLimit))
    throw Error("Locked slots exceed the group limit.");
  const gapLimit = Math.max(0, options.cooldown);
  const freshTarget = Math.ceil((slots.length / 2) * Math.max(0, Math.min(100, options.newPercent ?? 0)) / 100);
  for (const gender of ["female", "male"]) {
    const lockedOld = slots.filter((r) => r.gender === gender && r.idol_id && pool.find((p) => p.idol.id === r.idol_id)?.released).length;
    if (slots.length / 2 - lockedOld < freshTarget)
      throw Error("Locked returning artists exceed the new-artist target. Unlock slots or lower the new-artist share.");
    const capacity = new Map<string, number>();
    for (const c of pool.filter((p) => p.idol.gender === gender && !p.released && p.gap >= gapLimit))
      capacity.set(c.key, Math.min(options.groupLimit, (capacity.get(c.key) || 0) + 1));
    if ([...capacity.values()].reduce((a, b) => a + b, 0) < freshTarget)
      throw Error(`Not enough new ${gender} artists for the requested new-artist share. Lower the share or increase the group limit.`);
  }
  for (const row of slots) {
    if (row.idol_id) continue;
    const rarity = data.rarities.find((r) => r.id === row.rarity_id)!;
    const freshPicked = slots.filter((r) => r.gender === row.gender && r.idol_id && !pool.find((p) => p.idol.id === r.idol_id)?.released).length;
    const remaining = slots.filter((r) => r.gender === row.gender && !r.idol_id).length;
    const mustPickFresh = freshTarget - freshPicked >= remaining;
    const eligible = pool.filter(
      (x) =>
        x.idol.gender === row.gender &&
        !used.has(x.identity) &&
        (groups.get(x.key) || 0) < options.groupLimit &&
        x.gap >= gapLimit &&
        (!mustPickFresh || !x.released),
    );
    if (!eligible.length)
      throw Error(
        `No eligible ${row.gender} artist for ${rarity.label}. Reduce cooldown/group limit or remove exclusions.`,
      );
    const score = (x: (typeof pool)[number]) => {
      const sameTier = x.appearances.filter(
        (c) => c.rarity_id === row.rarity_id,
      ).length;
      const spread =
        (groups.get(x.key) || 0) * (options.mode === "variety" ? 36 : 16);
      const exposure =
        x.appearances.length * (options.mode === "coverage" ? 22 : 9);
      const ranks = { headliner: 3, established: 2, rising: 1, nugu: 0 };
      const targetRank = rarity.game_key === "Mythic" ? 3 : rarity.game_key === "Legendary" ? 2 : rarity.game_key === "Epic" ? 1 : rarity.game_key === "Rare" ? 1 : [0, 1, 2][Number(row.slot) % 3];
      const fit = 64 - Math.abs(ranks[x.popularity] - targetRank) * 24;
      return (
        100 -
        exposure -
        spread -
        sameTier * 12 +
        Math.min(x.gap, 8) * 5 +
        (options.newPercent === undefined ? 0 : fit + (!x.released && freshPicked < freshTarget ? 48 : x.released && freshPicked >= freshTarget ? 80 : 0) - x.pending * 30) +
        noise(x.idol.id, options.seed + Number(row.slot)) * 14
      );
    };
    eligible.sort(
      (a, b) => score(b) - score(a) || a.idol.id.localeCompare(b.idol.id),
    );
    const picked = eligible[0];
    row.idol_id = picked.idol.id;
    row.reason =
      picked.released === 0
        ? picked.pending ? "Not released / already in a draft" : "New to PocaPop"
        : picked.rebirth.length === 0 && options.kind === "Rebirth"
          ? "First Rebirth appearance"
          : picked.gap >= 2 && picked.rebirth.length > 0
            ? `${picked.gap} Rebirth packs since last appearance`
            : `${picked.appearances.length} catalog appearances`;
    used.add(picked.identity);
    groups.set(picked.key, (groups.get(picked.key) || 0) + 1);
  }
  return slots;
}
