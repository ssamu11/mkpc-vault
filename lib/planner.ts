import type { Catalog, Card } from "./types";
import { tierKeys, rebirthLayout, premiumLayout } from "./pocapop";
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
};
export function plannerPool(data: Catalog) {
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
        key: group?.id || `solo:${idol.id}`,
        appearances,
        rebirth,
        gap,
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
): PlannerRow[] {
  const counts = options.kind === "Premium" ? premiumLayout : rebirthLayout;
  const pool = plannerPool(data).filter(
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
      used.has(locked.idol_id)
    )
      throw Error(
        "A locked slot conflicts with the current pack layout or exclusions.",
      );
    if (candidate.gap < options.cooldown)
      throw Error(
        "A locked artist conflicts with the current cooldown. Unlock the slot or reduce cooldown.",
      );
    Object.assign(row, locked);
    used.add(row.idol_id);
    groups.set(candidate.key, (groups.get(candidate.key) || 0) + 1);
  }
  if ([...groups.values()].some((n) => n > options.groupLimit))
    throw Error("Locked slots exceed the group limit.");
  const gapLimit = Math.max(0, options.cooldown);
  for (const row of slots) {
    if (row.idol_id) continue;
    const rarity = data.rarities.find((r) => r.id === row.rarity_id)!;
    const candidates = pool.filter(
      (x) =>
        x.idol.gender === row.gender &&
        !used.has(x.idol.id) &&
        (groups.get(x.key) || 0) < options.groupLimit &&
        x.gap >= gapLimit,
    );
    if (!candidates.length)
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
      return (
        100 -
        exposure -
        spread -
        sameTier * 12 +
        Math.min(x.gap, 8) * 5 +
        noise(x.idol.id, options.seed + Number(row.slot)) * 14
      );
    };
    candidates.sort(
      (a, b) => score(b) - score(a) || a.idol.id.localeCompare(b.idol.id),
    );
    const picked = candidates[0];
    row.idol_id = picked.idol.id;
    row.reason =
      picked.appearances.length === 0
        ? "First catalog appearance"
        : picked.rebirth.length === 0 && options.kind === "Rebirth"
          ? "First Rebirth appearance"
          : picked.gap >= 2 && picked.rebirth.length > 0
            ? `${picked.gap} Rebirth packs since last appearance`
            : `${picked.appearances.length} catalog appearances`;
    used.add(row.idol_id);
    groups.set(picked.key, (groups.get(picked.key) || 0) + 1);
  }
  return slots;
}
