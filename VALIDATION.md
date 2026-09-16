# Local validation

Validated on 16 September 2026.

- TypeScript check: passed.
- ESLint: passed with no warnings after configuration cleanup.
- Production Next.js build: passed.
- Automated tests: 21 passed (including nested PostgreSQL/RLS checks).

## Browser checks

Checked the actual workspace components using a temporary development-only fixture route. That route was removed before packaging; fixture data was never written to a user database.

- Dashboard renders representation scope, unknown rosters, and pack status independently.
- Masterlist search for Liz returns only the matching card.
- An unconfigured tripleS example shows unknown roster size, missing count, and coverage.
- Configured example roster filtering returns only its unrepresented current member.
- Bulk roster parsing matches two existing artists, proposes one new artist, and disables saving before confirmation.
- Rebirth workbook upload detects valid and invalid sheets, percentage formatting, exact duplicates, occupied slot warnings, and unknown rarity errors.
- Import confirmation stays disabled with invalid rows and becomes enabled after explicit exclusion and review acknowledgement.
- Mobile dashboard fits the viewport without page-level horizontal overflow.
- No application errors were reported by the browser during these checks.

## SQL and domain tests

The real migration was executed inside PGlite PostgreSQL. Only `pgcrypto` extension installation was omitted because PGlite provides UUID generation directly. A test-only `auth.users` table, `auth.uid()` function, and roles simulate Supabase's authentication database interface.

Verified anonymous denial, non-staff access denial, moderator restrictions on rarities/profile promotion, admin rarity configuration, transactional import rollback, case-insensitive matching with display capitalization preserved, duplicate reimports, legitimate repeated appearances, zero-card roster members, former memberships, multi-idol cards, and whole-group cards without fake artists.

Workbook/domain tests verify percentage cells and strings, source hyperlinks, title/header rows, CSV memberships, ambiguous stage names, unknown rarities, unsafe URLs, coverage scope, and XLSX export/reload integrity.

## Not yet verified

- Live Supabase password authentication and session refresh: needs an accessible connected project.
- Exact parsing of the real Rebirth workbook: the provided attachment was only the brief.
- Production data migration and live-game representation: require the actual workbook and moderator-confirmed pack states/rosters.
- Vercel deployment: no deployment account/project was configured.

The source is ready for those setup and acceptance steps; it is not presented as an already populated or deployed live service.
