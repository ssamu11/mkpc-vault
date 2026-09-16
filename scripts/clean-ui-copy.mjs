import fs from "node:fs";
import path from "node:path";

const file = path.join(
  process.cwd(),
  "components",
  "workspace.tsx",
);

if (!fs.existsSync(file)) {
  throw new Error(
    "components/workspace.tsx not found",
  );
}

let src = fs.readFileSync(
  file,
  "utf8",
);

const backup = path.join(
  process.cwd(),
  "components",
  "workspace.before-clean-ui.tsx",
);

if (!fs.existsSync(backup)) {
  fs.copyFileSync(
    file,
    backup,
  );
}

/*
 * =========================================================
 * BRAND
 * =========================================================
 */

src = src.replace(
  /<span className="brand-mark">[\s\S]*?<\/span>\s*<span>\s*bias<span className="brand-light">vault<\/span>\s*<small>MODERATOR WORKSPACE<\/small>\s*<\/span>/,
  `<span>
            <b>MKPC VAULT</b>
            <small>MODERATOR WORKSPACE</small>
          </span>`,
);

/*
 * Handle version where brand may already
 * have been partially edited.
 */

src = src.replaceAll(
  "BIAS VAULT",
  "MKPC VAULT",
);

src = src.replaceAll(
  "Bias Vault",
  "MKPC VAULT",
);

src = src.replaceAll(
  "biasvault",
  "MKPC VAULT",
);

/*
 * =========================================================
 * REMOVE SIDEBAR MARKETING BOX
 * =========================================================
 */

src = src.replace(
  /<div className="private-note">[\s\S]*?<\/div>\s*<div className="user">/,
  `<div className="user">`,
);

/*
 * =========================================================
 * SIMPLE PAGE TITLES
 * =========================================================
 */

const headlineRegex =
  /const headline = detail[\s\S]*?;\s*function recordActions/;

const headlineReplacement = `const headline = detail
    ? page === "Groups"
      ? group?.name
      : page === "Packs"
        ? pack?.name
        : page === "Idols"
          ? idol?.stage_name
          : page
    : page;

  const pageSubtitle =
    page === "Dashboard"
      ? "Catalog overview"
      : page === "Cards"
        ? "Card masterlist"
        : page === "Groups"
          ? "Group roster & coverage"
          : page === "Packs"
            ? "Pack management"
            : page === "Idols"
              ? "Artist catalog"
              : page === "Discovery"
                ? "Kpopping+ reference"
                : page === "Import"
                  ? "Import catalog data"
                  : page === "Export"
                    ? "Export catalog data"
                    : "Workspace settings";

  function recordActions`;

if (headlineRegex.test(src)) {
  src = src.replace(
    headlineRegex,
    headlineReplacement,
  );
} else {
  console.warn(
    "Could not automatically replace headline block.",
  );
}

/*
 * =========================================================
 * PAGE HEADING
 * =========================================================
 *
 * Remove eyebrow + long description.
 * Keep title + one simple subtitle only.
 */

src = src.replace(
  /<p className="eyebrow">[\s\S]*?<\/p>\s*<h1>\{headline\}<\/h1>\s*<p>[\s\S]*?<\/p>/,
  `<h1>{headline}</h1>
              {!detail && (
                <p>{pageSubtitle}</p>
              )}`,
);

/*
 * =========================================================
 * TOPBAR
 * =========================================================
 */

src = src.replace(
  /<span className="workspace-badge">[\s\S]*?<\/span>/,
  "",
);

/*
 * =========================================================
 * FOOTER
 * =========================================================
 */

src = src.replace(
  /<footer className="app-footer">[\s\S]*?<\/footer>/,
  `<footer className="app-footer">
          <span>MKPC VAULT</span>
          <span>MODERATOR WORKSPACE</span>
        </footer>`,
);

/*
 * =========================================================
 * EMPTY DASHBOARD COPY
 * =========================================================
 */

src = src.replaceAll(
  "YOUR CATALOG STARTS HERE",
  "EMPTY CATALOG",
);

src = src.replaceAll(
  "Give every card a place.",
  "No cards yet",
);

src = src.replace(
  /<p>\s*Upload your Rebirth workbook to build your masterlist\.\s*<br \/>\s*We’ll match artists and groups\. You review before anything\s*is saved\.\s*<\/p>/,
  `<p>Import a workbook to add cards.</p>`,
);

src = src.replaceAll(
  "YOUR NEXT CHAPTER",
  "MKPC",
);

/*
 * =========================================================
 * SAVE
 * =========================================================
 */

fs.writeFileSync(
  file,
  src,
  "utf8",
);

console.log("");
console.log(
  "✓ MKPC VAULT branding applied",
);
console.log(
  "✓ Decorative branding removed",
);
console.log(
  "✓ Marketing copy removed",
);
console.log(
  "✓ Page titles simplified",
);
console.log(
  "✓ Page subtitles simplified",
);
console.log(
  "✓ Footer simplified",
);
console.log("");
console.log(
  "Backup:",
);
console.log(
  "components/workspace.before-clean-ui.tsx",
);
console.log("");
console.log(
  "Restart dev server if necessary.",
);