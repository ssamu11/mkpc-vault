import type { Card, Catalog, PackRarity } from "./types";

export const finishes = ["Normal", "Holo", "Shiny", "Glitter"];
export const mutations = ["Blossom", "Aurora", "Starlit", "Sunbeam", "Dewdrop"];
export const tierKeys = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"];
export const rebirthLayout = [18, 12, 8, 6, 2, 2];
export const premiumLayout = [0, 0, 10, 8, 4, 2];
export function formatPercent(value: number) {
  return `${Number(value.toFixed(6))}%`;
}
export function tierOdds(tier: PackRarity) {
  return tier.total_weight > 0 ? tier.weight / tier.total_weight * 100 : null;
}
export function cardOdds(card: Card, data: Catalog) {
  const tier = data.pack_rarities?.find(t => t.pack_id === card.pack_id && t.rarity_id === card.rarity_id);
  const total = tier ? tierOdds(tier) : null;
  return total !== null && tier && tier.card_count > 0 ? total / tier.card_count : null;
}
export function cardTier(card: Card, data: Catalog) {
  return card.premium_tier || data.pack_rarities?.find(t => t.pack_id === card.pack_id && t.rarity_id === card.rarity_id)?.display_name || data.rarities.find(r => r.id === card.rarity_id)?.label || "Unknown";
}
