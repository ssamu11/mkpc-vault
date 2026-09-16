import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const workspaceFile = path.join(
  root,
  "components",
  "workspace.tsx",
);

const cssCandidates = [
  path.join(root, "app", "globals.css"),
  path.join(root, "styles", "globals.css"),
];

const cssFile = cssCandidates.find((file) =>
  fs.existsSync(file),
);

if (!fs.existsSync(workspaceFile)) {
  throw new Error(
    "components/workspace.tsx not found",
  );
}

if (!cssFile) {
  throw new Error(
    "Could not find globals.css",
  );
}

/* -------------------------------------------------------
   BACKUP
------------------------------------------------------- */

const workspaceBackup = path.join(
  root,
  "components",
  "workspace.before-minimal-ui.tsx",
);

if (!fs.existsSync(workspaceBackup)) {
  fs.copyFileSync(
    workspaceFile,
    workspaceBackup,
  );
}

const cssBackup = `${cssFile}.before-minimal-ui`;

if (!fs.existsSync(cssBackup)) {
  fs.copyFileSync(
    cssFile,
    cssBackup,
  );
}

/* -------------------------------------------------------
   CLEAN WORKSPACE COPY
------------------------------------------------------- */

let workspace = fs.readFileSync(
  workspaceFile,
  "utf8",
);

/* Branding fallback */
workspace = workspace.replace(
  /bias<span className="brand-light">vault<\/span>/g,
  "<b>MKPC VAULT</b>",
);

workspace = workspace.replaceAll(
  "BIAS VAULT",
  "MKPC VAULT",
);

/* Remove decorative wording if any old copy remains */
const copyReplacements = [
  ["The big picture.", "Dashboard"],
  ["Your card masterlist.", "Cards"],
  ["Every group. Every member.", "Groups"],
  ["Inside every pack.", "Packs"],
  ["Meet your catalog.", "Idols"],
  ["From spreadsheet to catalog.", "Import"],
  ["Your data, ready to go.", "Export"],

  [
    "A clear view of your cards, packs, and the members still waiting for a spotlight.",
    "Catalog overview",
  ],
  [
    "The source of truth for every card in your game.",
    "Card masterlist",
  ],
  [
    "Known artists and complete rosters stay distinctly separate.",
    "Group roster & coverage",
  ],
  [
    "Track each pack from the first draft to release.",
    "Pack management",
  ],
  [
    "Registered artists, represented members, and their card history.",
    "Artist catalog",
  ],
  [
    "Import your Rebirth cards or configure complete group rosters.",
    "Import catalog data",
  ],
  [
    "Download clean Excel files from your current catalog.",
    "Export catalog data",
  ],
  [
    "Manage your catalog’s rules and access.",
    "Workspace settings",
  ],
];

for (const [oldText, newText] of copyReplacements) {
  workspace = workspace.replaceAll(
    oldText,
    newText,
  );
}

/* Clean button labels */
workspace = workspace.replaceAll(
  "↥ Import Rebirth workbook",
  "Import workbook",
);

workspace = workspace.replaceAll(
  "↓ Export pack",
  "Export pack",
);

workspace = workspace.replaceAll(
  "＋ Add ",
  "Add ",
);

workspace = workspace.replaceAll(
  " ↗",
  "",
);

/* Remove decorative Stat icons safely */
workspace = workspace.replace(
  /\s+icon="[^"]*"/g,
  "",
);

/* Make sign out readable instead of symbol-only */
workspace = workspace.replace(
  />\s*↪\s*<\/button>/g,
  ">Sign out</button>",
);

fs.writeFileSync(
  workspaceFile,
  workspace,
  "utf8",
);

/* -------------------------------------------------------
   MINIMAL VISUAL SYSTEM
------------------------------------------------------- */

let css = fs.readFileSync(
  cssFile,
  "utf8",
);

const START =
  "/* ===== MKPC MINIMAL UI START ===== */";

const END =
  "/* ===== MKPC MINIMAL UI END ===== */";

const oldBlock = new RegExp(
  `${START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
  "g",
);

css = css.replace(
  oldBlock,
  "",
);

const minimalCss = `
${START}

:root {
  --mkpc-bg: #f7f7f6;
  --mkpc-surface: #ffffff;
  --mkpc-text: #191918;
  --mkpc-muted: #777773;
  --mkpc-border: #e7e7e3;
  --mkpc-hover: #f2f2ef;
  --mkpc-active: #efedff;
  --mkpc-accent: #6558d9;
}

/* BASE */

html,
body {
  background: var(--mkpc-bg) !important;
  color: var(--mkpc-text);
}

body,
button,
input,
select,
textarea {
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif !important;
}

.app-shell {
  background: var(--mkpc-bg) !important;
}

/* SIDEBAR */

.sidebar {
  background: var(--mkpc-surface) !important;
  border-right: 1px solid var(--mkpc-border) !important;
  box-shadow: none !important;
}

.brand {
  padding-top: 4px;
  gap: 0 !important;
  color: var(--mkpc-text) !important;
  text-decoration: none !important;
}

.brand-mark {
  display: none !important;
}

.brand > span {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.brand b,
.brand > span {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.015em;
}

.brand small {
  color: #999995 !important;
  font-size: 9px !important;
  font-weight: 600 !important;
  letter-spacing: 0.11em !important;
}

.nav-label {
  color: #aaa9a4 !important;
  font-size: 9px !important;
  font-weight: 600 !important;
  letter-spacing: 0.1em !important;
}

/* remove nav unicode icons */

.sidebar nav button > span:first-child {
  display: none !important;
}

.sidebar nav button {
  min-height: 38px !important;
  padding: 8px 11px !important;
  border: 0 !important;
  border-radius: 8px !important;
  background: transparent !important;
  box-shadow: none !important;
  color: #666662 !important;
  font-size: 13px !important;
  font-weight: 500 !important;
  transition:
    background 120ms ease,
    color 120ms ease !important;
}

.sidebar nav button:hover {
  background: var(--mkpc-hover) !important;
  color: var(--mkpc-text) !important;
}

.sidebar nav button.active {
  background: var(--mkpc-active) !important;
  color: #5548bd !important;
  font-weight: 600 !important;
}

.sidebar nav button small {
  margin-left: auto;
  background: transparent !important;
  color: #aaa9a4 !important;
  font-size: 10px !important;
}

/* remove old marketing card */

.private-note {
  display: none !important;
}

/* USER */

.sidebar-bottom {
  border-top: 1px solid var(--mkpc-border) !important;
}

.user {
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
}

.user .avatar {
  background: #f0f0ed !important;
  color: #555550 !important;
  border: 1px solid var(--mkpc-border) !important;
}

.user b {
  font-size: 12px;
}

.user small {
  color: #999995 !important;
  text-transform: capitalize;
}

.user form button {
  width: auto !important;
  padding: 6px 8px !important;
  background: transparent !important;
  border: 0 !important;
  color: #999995 !important;
  font-size: 11px !important;
}

.user form button:hover {
  color: var(--mkpc-text) !important;
}

/* TOP BAR
   Desktop does not need breadcrumb because page title already exists.
*/

.topbar {
  display: none !important;
}

.workspace-badge,
.eyebrow {
  display: none !important;
}

/* CONTENT */

.content {
  width: 100%;
  max-width: 1480px;
  margin: 0 auto;
  padding: 38px 42px 56px !important;
}

.page-heading {
  margin-bottom: 28px !important;
  gap: 20px !important;
}

.page-heading h1 {
  margin: 0 !important;
  color: var(--mkpc-text) !important;
  font-size: 30px !important;
  font-weight: 650 !important;
  line-height: 1.15 !important;
  letter-spacing: -0.035em !important;
}

.page-heading p {
  max-width: none !important;
  margin: 7px 0 0 !important;
  color: var(--mkpc-muted) !important;
  font-size: 13px !important;
  line-height: 1.5 !important;
}

.back {
  margin-bottom: 13px !important;
  padding: 0 !important;
  background: transparent !important;
  border: 0 !important;
  color: var(--mkpc-muted) !important;
  font-size: 12px !important;
}

/* PANELS */

.panel,
.stat {
  background: var(--mkpc-surface) !important;
  border: 1px solid var(--mkpc-border) !important;
  border-radius: 12px !important;
  box-shadow: none !important;
}

.panel {
  overflow: hidden;
}

.stat {
  padding: 18px !important;
}

.stat > div > span:first-child {
  color: var(--mkpc-muted) !important;
  font-size: 11px !important;
  font-weight: 500 !important;
}

.stat strong {
  margin-top: 9px !important;
  color: var(--mkpc-text) !important;
  font-size: 28px !important;
  font-weight: 650 !important;
  letter-spacing: -0.035em !important;
}

.stat small {
  color: #999995 !important;
  font-size: 10px !important;
}

/* remove decorative dashboard glyphs */

.stat-icon,
.hero-glyph,
.card-art {
  display: none !important;
}

.getting-started {
  background: var(--mkpc-surface) !important;
  border: 1px solid var(--mkpc-border) !important;
  border-radius: 12px !important;
  box-shadow: none !important;
}

/* BUTTONS */

button {
  box-shadow: none !important;
}

.primary,
.dark-button {
  min-height: 36px !important;
  padding: 8px 13px !important;
  border: 1px solid #242422 !important;
  border-radius: 8px !important;
  background: #242422 !important;
  color: white !important;
  font-size: 12px !important;
  font-weight: 600 !important;
}

.primary:hover,
.dark-button:hover {
  background: #393936 !important;
}

/* INPUTS */

input,
select,
textarea {
  border: 1px solid var(--mkpc-border) !important;
  border-radius: 8px !important;
  background: var(--mkpc-surface) !important;
  box-shadow: none !important;
  color: var(--mkpc-text) !important;
}

input:focus,
select:focus,
textarea:focus {
  border-color: #aaa3e8 !important;
  outline: 3px solid #efedff !important;
}

/* TABLES */

table {
  background: var(--mkpc-surface);
}

th {
  background: #fafaf8 !important;
  color: #888883 !important;
  font-size: 10px !important;
  font-weight: 600 !important;
  letter-spacing: 0.025em;
}

td {
  color: #3c3c39;
  font-size: 12px;
}

th,
td {
  border-color: #eeeeeb !important;
}

tbody tr:hover {
  background: #fafaf8 !important;
}

/* TOOLBARS */

.table-toolbar,
.detail-toolbar,
.toolbar {
  box-shadow: none !important;
}

.text-link {
  color: #5147a8 !important;
  font-weight: 550 !important;
}

/* FOOTER */

.app-footer {
  display: none !important;
}

/* TOAST */

.toast {
  border: 1px solid var(--mkpc-border) !important;
  border-radius: 9px !important;
  background: #ffffff !important;
  box-shadow:
    0 8px 24px rgba(20, 20, 18, 0.07) !important;
  color: var(--mkpc-text) !important;
}

/* MOBILE */

@media (max-width: 900px) {
  .topbar {
    display: flex !important;
    min-height: 52px;
    padding: 0 18px !important;
    background: var(--mkpc-surface) !important;
    border-bottom: 1px solid var(--mkpc-border) !important;
    box-shadow: none !important;
  }

  .topbar > div > :not(.mobile-menu) {
    display: none !important;
  }

  .mobile-menu {
    display: inline-flex !important;
    background: transparent !important;
    border: 0 !important;
    font-size: 17px !important;
  }

  .content {
    padding: 26px 18px 40px !important;
  }

  .page-heading h1 {
    font-size: 26px !important;
  }
}

${END}
`;

css += `\n\n${minimalCss}\n`;

fs.writeFileSync(
  cssFile,
  css,
  "utf8",
);

console.log("");
console.log("MKPC minimal UI applied.");
console.log("");
console.log("Updated:");
console.log(" - components/workspace.tsx");
console.log(` - ${path.relative(root, cssFile)}`);
console.log("");
console.log("Backups created.");
console.log("");