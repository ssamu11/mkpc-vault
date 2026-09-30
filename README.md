# PocaPop Vault

Private moderator workspace for PocaPop: Next.js, TypeScript, Supabase Auth/PostgreSQL, and SheetJS. Roblox Studio is a read-only catalog source; this website does not modify game scripts.

## Current catalog

The September 30, 2026 snapshot comes from PocaPop! DEV, PlaceVersion 332, PlaceId 73547394013446. The exact exported definitions are in `data/pocapop-catalog.json`.

- 362 cards, 346 idol/act definitions, 128 groups, and 10 packs.
- RB01-RB07: 48 cards each; Common, Uncommon, Rare, Epic, Legendary, Mythic.
- HB01 Moonlit Hanbok: 24 cards; Petal/Rare, Silk/Epic, Royal/Legendary, Crown/Mythic.
- EX01 Community Exclusive and EX02 Chuseok Exclusive: one card each, without random-roll odds.
- Game IDs, image asset IDs, and catalog status are separate from website UUIDs, picture-selection status, and pack release status.
- Odds belong to a pack/tier, not to a global rarity. Individual base chance is tier chance divided by tier card count.
- Finish (Normal, Holo, Shiny, Glitter) and mutations (Blossom, Aurora, Starlit, Sunbeam, Dewdrop) describe owned instances, not additional base catalog cards.

This is a one-time import, not automatic live synchronization. The initial catalog import used `ready` while live availability was awaiting verification. On September 30, 2026 the moderator confirmed that all ten existing packs and all card images are live, and their website release status was changed to `released`. New generated/imported packs remain drafts until reviewed.

## Migration and recovery

`supabase/migrations/20260930041925_pocapop_catalog.sql` has been applied to the connected vault project. Do not run it again on that project: it replaces the active catalog.

Before replacement, the migration saved the previous 672 cards, 16 packs, 612 idols, 147 groups, relationships, reference links, planner profiles, settings, and import history in:

```text
vault_archive.catalog_snapshots
name = mkpc_before_pocapop_20260930
```

The archive is private and unavailable through browser roles. Auth users, staff profiles, and the Kpopping reference source were retained. Unambiguous curated reference links were remapped to the new game identities.

For a new database, apply the repository migrations in their established order; the PocaPop migration expects the existing catalog and reference schema. Take an external backup before any migration or manual recovery. Recovery must be performed by a database administrator; the application intentionally has no reset/restore button.

## Moderator workflow

Cards support search, pack/tier/gender/picture-status filters, sorting, pagination, editing, and filtered export. Photos are resolved from Roblox thumbnails through an authenticated same-origin endpoint, with a fallback for unavailable assets.

Pack Planner creates balanced, unique-idol drafts: 48 Rebirth cards or 24 Premium cards. Balanced, Coverage, and Variety strategies rank candidates using prior exposure, tier repetition, group diversity, and Rebirth recency. Group limits, exclusions, cooldown, locked slots, and individual rerolls are explicit controls. Impossible constraints produce an error instead of silently weakening the recipe. Saving revalidates pack code, active artists/rarities, slots, counts, gender balance, unique artists, and chosen image IDs in PostgreSQL.

Reference photos are historical previews, not automatically chosen artwork. Choose an Image Asset ID per slot before saving it as pack artwork. Draft cards have no invented game CardID. Excel export includes PackID, Pack Name, Slot, Rarity, Gender, Idol Name, Group Name, Idol ID, Group ID, Card ID, Image Asset ID, and Notes, compatible with the new importer.

Workbook import supports the current B4:K4 mapping layout, title rows, canonical tiers/Premium aliases, raw numeric image IDs, and blank template sheets. Rebirth 1 maps to RB01 / Adrenaline, not a duplicate pack called Rebirth 1. New packs require a name and complete 48/24-card composition. Existing pack updates match CardID or scoped artist identity, retain global game slots, preserve blank photos/notes, and skip unchanged cards. A changed artist lineup is blocked rather than silently replaced. Review Add/Update/Unchanged counts and approve before the transactional save. Concurrent edits invalidate the preview.

When Excel and the catalog use different names, Match artist explicitly selects the canonical identity and group in the preview. This is particularly relevant to ALPHA DRIVE ONE / ALD1 and the workbook's Reo / catalog Gaku entry. No automatic alias guessing or catalog rename is performed. The sample workbook itself is not modified or automatically imported.

The workbook and chosen-photo workflows use `20260930051725_pocapop_workbook_import.sql`. `20260930061038_pocapop_import_identity_fix.sql` repairs the existing solo resolver's PostgreSQL UUID aggregate. Both migrations preserve active catalog records and staff.

Group rosters and Discovery remain reference tools. Catalog membership alone does not prove a complete roster, and whole-group cards do not count as every individual member. Same stage names are resolved within group/solo identity rather than globally merged.

## Local development

Use Node.js 22 and npm:

```sh
npm ci
npm run dev
```

Configure `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Never expose a service-role key. The normal port is 3000; the current review server uses http://127.0.0.1:3100.

Password sign-in requires an existing Supabase Auth user and a staff profile. There is no demo bypass or public registration. Moderators manage catalog records; admins additionally manage rarity settings and team roles.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Tests include workbook parsing, exact IDs, identity matching, idempotent updates, optimistic concurrency, exports, catalog migration, archived-data preservation, pack odds, planner constraints/locks/exclusions, draft photos, transaction rollback, and role access using isolated PGlite. Browser checks cover desktop/mobile navigation, login controls, catalog images, and 48/24-card generation. Live RPC checks use rolled-back transactions. No test drafts are saved to the live catalog.

The database migrations are live. Push `main` to the existing GitHub repository to trigger its connected Vercel deployment, then verify the deployment result. Running a local build does not publish the frontend.
