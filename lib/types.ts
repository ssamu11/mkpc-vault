export type Group = {
  game_group_id?: string | null;
  id: string;
  name: string;
  normalized_name: string;
  status: string;
  roster_configured: boolean;
};
export type Idol = {
  game_idol_id?: string | null;
  id: string;
  stage_name: string;
  normalized_name: string;
  gender: string;
  active: boolean;
};
export type Membership = {
  id: string;
  group_id: string;
  idol_id: string;
  membership_status: "current" | "former";
};
export type Pack = {
  game_pack_id?: string | null;
  catalog_status?: string;
  catalog_size?: number | null;
  exclusive?: boolean;
  id: string;
  name: string;
  pack_type: string;
  pack_number: number | null;
  release_date: string | null;
  status: string;
  notes: string | null;
};
export type Rarity = {
  id: string;
  label: string;
  numeric_value: number | null;
  game_key?: string | null;
  sort_order: number;
  active: boolean;
};
export type Card = {
  updated_at?: string;
  game_card_id?: string | null;
  image_asset_id?: string | null;
  catalog_status?: string;
  premium_tier?: string | null;
  id: string;
  pack_id: string;
  rarity_id: string;
  slot: string | null;
  card_name: string | null;
  group_id: string | null;
  pic_status: string | null;
  source_url: string | null;
  notes: string | null;
};
export type CardIdol = { card_id: string; idol_id: string };
export type PackRarity = {
  pack_id: string;
  rarity_id: string;
  display_name: string;
  card_count: number;
  female_count: number;
  male_count: number;
  weight: number;
  total_weight: number;
};
export type ImportLog = {
  id: string;
  filename: string;
  imported_at: string;
  rows_processed: number;
  rows_created: number;
  rows_skipped: number;
  warnings: string[];
};
export type Catalog = {
  groups: Group[];
  idols: Idol[];
  group_memberships: Membership[];
  packs: Pack[];
  rarities: Rarity[];
  cards: Card[];
  card_idols: CardIdol[];
  import_history: ImportLog[];
  settings: { include_unreleased: boolean };
  pack_rarities?: PackRarity[];
};
export const emptyCatalog: Catalog = {
  groups: [],
  idols: [],
  group_memberships: [],
  packs: [],
  rarities: [],
  cards: [],
  card_idols: [],
  import_history: [],
  settings: { include_unreleased: false },
};
export type ImportRow = {
  game_pack_id?: string;
  pack_name?: string;
  game_idol_id?: string;
  game_group_id?: string;
  game_card_id?: string;
  image_asset_id?: string;
  sheet: string;
  row: number;
  slot: string;
  rarity: string;
  gender: string;
  idol: string;
  group: string;
  pic_status: string;
  source_url: string;
  notes: string;
  membership_status?: string;
};
export type PlanRow = ImportRow & {
  issues: string[];
  warnings: string[];
  duplicate: boolean;
  existingIdol: string | null;
  newGroup: boolean;
  newIdol: boolean;
  rarityValue: number | null;
  rarityId?: string;
};
