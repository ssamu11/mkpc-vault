export type Group = {
  id: string;
  name: string;
  normalized_name: string;
  status: string;
  roster_configured: boolean;
};
export type Idol = {
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
  numeric_value: number;
  sort_order: number;
  active: boolean;
};
export type Card = {
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
};
