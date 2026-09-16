# Bias Vault

An internal moderator workspace for a Roblox K-pop card game. This application replaces manual masterlists with a relational catalog. The authoritative initial source is the **Rebirth workbook**, not the old masterlist. No AI services are integrated.

## Delivered application

- Next.js App Router, TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL, and SheetJS.
- Protected moderator dashboard; cards, packs, groups, and idol management; admin settings and team role assignment.
- Many-to-many card → idol relationships, optional group cards, current/former memberships, and artists with zero cards.
- Workbook sheet detection, row validation, preview, selection/exclusion, duplicate warnings, confirmation, transactional imports, and import history.
- Full-roster paste editor and XLSX/CSV imports, independent of card imports.
- Case-insensitive card search, eight filters, sorting, pagination, and clean Excel exports.
- Responsive desktop-oriented UI, native accessible dialogs, deletion confirmation, and useful empty states.

## Current validation status

The supplied attachment contained the specification only. **The actual `kpop_card_pack_pic_mapping (1)(1).xlsx` was not supplied**, so its exact merged cells, formatting, and header variations have not been verified. Tests use representative workbooks matching the documented structure. No real card data was fabricated or seeded.

The source has been production-built and checked locally. Database behavior and RLS are tested using an isolated PostgreSQL-compatible PGlite database with a minimal Supabase-auth test shim. These tests validate the SQL policies and transactions; they do not replace a live Supabase Auth integration test. Connecting a real Supabase project, verifying sign-in/session refresh, importing the real workbook, and deploying to Vercel are still setup steps.

## Local setup

Use Node.js 22 LTS or newer and npm.

```sh
npm ci
```

Copy `.env.example` to `.env.local` and fill in:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY
```

These are the public browser-safe project credentials. **Never put a service-role key here.** The application does not need one. Environment files and build/dependency output are ignored by Git.

```sh
npm run dev
```

Open `http://127.0.0.1:3000`. With no environment configured, the application shows setup instructions rather than granting unauthenticated access. There is no shipped demo or authentication bypass.

## Supabase setup and migration

1. Create a Supabase project.
2. In its SQL editor, run `supabase/migrations/001_catalog.sql` once against the new database. The migration is versioned and intended to be applied once, not rerun. It creates the schema, indexes, constraints, configurable starting rarities, RLS policies, and transactional RPC functions.
3. In Authentication settings, disable public email sign-ups. Set your local Site URL and later your deployed HTTPS URL as appropriate for your Supabase project. This app uses password sign-in, with no public registration page.
4. Create the first user in Supabase Authentication. Use a strong password and securely give the user their credentials. Copy that user's UUID.
5. Bootstrap the first admin in the SQL editor:

```sql
insert into public.profiles (id, role)
values ('REPLACE_WITH_AUTH_USER_UUID', 'admin');
```

6. Sign in to Bias Vault with that user's email and password.
7. To add teammates, create their auth users in Supabase first. Then use **Settings → Team access** to assign their UUID the `moderator` or `admin` role. Existing roles can be updated there as well. Account removal/password resets are managed in Supabase Authentication. To revoke workspace access without deleting the auth user, delete their profile in the Supabase SQL editor.

Moderators can manage cards, packs, groups, idols, memberships, rosters, and imports. Admins can additionally change rarities, representation settings, and staff roles. Unauthenticated users cannot read catalog tables or call mutation functions; signed-in users without a staff profile have no catalog access. RLS applies even if someone directly calls the public Supabase API. All app writes also require server authentication and validation.

## Architecture

```text
app/page.tsx                  authenticated server load
app/login/                    password sign-in and sign-out actions
app/api/catalog/route.ts       authenticated write boundary
middleware.ts                 Supabase cookie/session refresh
components/workspace.tsx       moderator navigation and entity detail views
components/cards.tsx          searchable/filterable masterlist
components/importer.tsx       upload/paste → preview → confirmation
components/editors.tsx        entity/card/membership editors
lib/catalog.ts                normalization, matching, coverage, export rows
lib/workbook.ts               SheetJS workbook parsing and XLSX generation
lib/data.ts                   paginated reads of every database relation
supabase/migrations/          PostgreSQL schema, RLS, transaction functions
tests/                        workbook/domain and real SQL policy tests
```

Navigation is an in-workspace client view; details are not individually URL-addressable in this MVP. Data loads from Supabase on the protected server page, then local filtering makes moderator searches immediate. Successful writes refresh the server snapshot. Reads page through Supabase's 1,000-row default, avoiding silent catalog truncation. For significantly larger catalogs, move search/filter/pagination to indexed server queries. Concurrent editors should refresh before editing shared records; this MVP does not provide collaborative presence or conflict merging.

### Relational model

- `groups`: display/normalized names, lifecycle status, explicit `roster_configured`.
- `idols`: stage name, normalized name, gender, active flag. Stage names are intentionally **not globally unique**.
- `group_memberships`: group/idol relationship and current/former status.
- `packs`: extensible pack type, optional number/date, separate release status.
- `rarities`: configurable percentage, label, display order, active flag.
- `cards`: pack, rarity, slot, optional display name/group, picture status, source, notes.
- `card_idols`: many-to-many relationship. A duo remains one card with two links.
- `profiles`, `settings`, and `import_history`: role access, representation scope, lightweight history.

Foreign keys protect linked records from accidental deletion. Card deletion cascades only its idol links. An idol can remain in the catalog with zero cards. Group association on cards records the act at appearance time; fallback membership-derived grouping is used only if a card has no explicit group.

## Rebirth workbook import

1. Open **Import → Rebirth workbook** and choose the original workbook. No template rewrite is required for the described structure.
2. The parser examines the first 30 rows of each sheet for headers, so leading title rows are supported. Sheets without recognizable headers remain visible with a reason and are not selected automatically.
3. Select all valid sheets or just those you want. Pack names come from sheet names. `Rebirth 12` becomes type `Rebirth`, number `12`. Other types remain supported.
4. Review new groups, new idols, existing matches, duplicate warnings, invalid rows, and source row numbers. Exclude unwanted rows explicitly, or correct the workbook and upload again. Admins configure unknown/inactive rarities in Settings before retrying.
5. Confirm the review checkbox, then click **Confirm import**.
6. Check the new Cards masterlist. New packs are **draft**, even when picture status is Selected. Change a pack to Released only when that is correct for the live game.

Recognized columns include Slot, Rarity, Gender, Idol, Group / Act, Pic Status, Source / Pinterest URL, and Notes; common whitespace/slash/name aliases are included. Excel percentage-formatted numeric cells are converted to percentage units: numeric `0.05` with `0.00%` formatting becomes `5%`. An unformatted `0.05` is interpreted literally as **0.05%**, not guessed. Hyperlink targets are preserved. Gender aliases `F`/`M` normalize to female/male. Solo/Soloist and blank groups do not create fake groups. Blank rows and repeated standard header rows are skipped.

The parser does not silently fill down merged/blank rarity or group cells, guess ambiguous artists, or split Premium duo names. Such rows should be reviewed. Limits are 10 MB per upload, 200 sheets, 10,000 data rows per sheet and 10,000 rows per confirmed import. Select fewer sheets for larger workbooks. No formula evaluation is performed; cached spreadsheet values are used.

### Matching and duplicates

Whitespace and Unicode width are normalized for matching; display capitalization is retained. Groups and packs match by normalized name. Idols match by normalized stage name **within a known group membership**, or by solo status when no group is supplied. A stage name already used in a different context is blocked as ambiguous, not automatically merged.

To resolve a known artist: open their Idol detail and add the correct membership. For a genuinely different artist sharing a stage name: add a separate Idol, then assign that new idol to its group. The importer can then match the intended group-specific artist.

Exact duplicates within the file or already in the database are skipped. The same artist in different slots, packs, or rarities is valid. An occupied slot with a different card generates a warning. Duplicate rules treat a slot, pack, rarity, and complete idol association as the strong key; if you intentionally need two otherwise-identical cards, distinguish their slots or card modeling first.

Server-side preview validation is repeated at confirmation. The transaction rechecks duplicates and acquires a transaction advisory lock before resolving/creating artists and cards, so simultaneous imports cannot race to create duplicate identities. Any invalid SQL row rolls back the entire import. Imports never set `roster_configured=true`.

## Full roster configuration

Open a group and select **Configure full roster**. Paste one current member per line, parse, review, and confirm the complete roster. Existing current members are prefilled when editing. Matching reuses existing artists and creates zero-card artists as needed. Omitted members become **former**, preserving history and cards.

For multiple groups or explicit former members, use **Import → Full rosters** with XLSX, XLS, or CSV columns:

```csv
group,idol,gender,membership_status
tripleS,Seoyeon,female,current
tripleS,Hyerin,female,current
```

This example is only a format illustration, **not a full tripleS roster**. Supply the actual complete roster before confirming. Every included group is treated as a full roster replacement: do not upload only its missing members. Membership status accepts current/former, defaulting to current. At least one current member is required.

Coverage is unknown (`—`) until the roster is configured. Once configured, its denominator includes current members only; former members remain visible but do not count as missing. Card appearance scope defaults to Released packs. Admins may choose all statuses in Settings, which also includes archived packs. A whole-group card does not automatically mark every individual as represented. Picture statuses never determine release state.

## Excel export

- **Cards → Export** exports the complete filtered result set, not just the visible page.
- **Export → Complete masterlist** exports all cards.
- Pack/group details export their associated cards.
- Group details and Export provide rosters, missing members, and coverage.
- Unconfigured groups show unknown coverage and are excluded from missing-member exports.
- Multi-idol cards export as one row with `Name x Name`. Internal relationships stay relational.

Exports are generated locally with SheetJS. They retain text values as text, including strings beginning with `=`, rather than constructing spreadsheet formulas.

## Vercel deployment

1. Put this project in a private Git repository. Do not commit `.env.local`, dependency folders, or `.next`.
2. Import that repository into Vercel and choose the Next.js framework preset. If the project is inside another repository, set its root directory to this application directory.
3. Configure the same two public Supabase environment variables for the desired environments.
4. Use the normal `npm run build` build command. No custom output directory or static export is required.
5. Deploy, update Supabase's Site URL as appropriate, and verify the live sign-in and logout flows.
6. Confirm an unauthenticated browser cannot open the catalog and a signed-in user without a profile cannot access it. Import the real Rebirth workbook into your intended database only after reviewing the preview.

No external hosting account was connected or deployment performed during the local build. Supabase and Vercel have their own current free-tier quotas; the application requires no AI subscription or paid API. Confirm service limits in your accounts before deploying.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Tests cover workbook header/percentage/hyperlink parsing, CSV rosters, normalization, ambiguous names, duplicate protection, coverage scope, former members, exports, SQL schema execution, RLS enforcement, transactional rollback, repeated imports, configurable rarities, and multi-idol/group cards. PGlite is a development-only test dependency; production uses Supabase PostgreSQL. The test harness compiles TypeScript into a temporary ignored directory and removes it afterward.

Before importing production data, verify the actual workbook in preview, confirm pack release states, configure real full rosters, and check one known missing-member result against the game. The outdated masterlist is not needed.
"# mkpc-vault" 
"# mkpc-vault" 
