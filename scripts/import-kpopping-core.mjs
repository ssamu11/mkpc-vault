import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import process from "node:process";
import Database from "better-sqlite3";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();

const SQLITE_PATH = path.join(
  ROOT,
  "data",
  "kpopping-data-2026-09.sqlite"
);

const ENV_PATH = path.join(ROOT, ".env.local");

const BATCH_SIZE = 200;

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(".env.local not found.");
  }

  const result = {};

  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) continue;

    const index = line.indexOf("=");

    if (index === -1) continue;

    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function nullable(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return value;
}

async function upsertInBatches(
  supabase,
  table,
  rows,
  conflictColumn
) {
  let completed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const { error } = await supabase
      .from(table)
      .upsert(batch, {
        onConflict: conflictColumn,
      });

    if (error) {
      throw new Error(
        `${table} batch ${i}-${i + batch.length - 1}: ${error.message}`
      );
    }

    completed += batch.length;

    process.stdout.write(
      `\r${table}: ${completed}/${rows.length}`
    );
  }

  process.stdout.write("\n");
}

async function main() {
  console.log("\nBias Vault — Kpopping Core Importer\n");

  if (!fs.existsSync(SQLITE_PATH)) {
    throw new Error(
      `SQLite file not found:\n${SQLITE_PATH}`
    );
  }

  const env = loadEnv(ENV_PATH);

  const supabaseUrl =
    env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase URL/key not found in .env.local"
    );
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(
    "Use the same admin account you use to log into Bias Vault.\n"
  );

  const email = (
    await rl.question("Admin email: ")
  ).trim();

  const password =
    await rl.question("Admin password: ");

  rl.close();

  const supabase = createClient(
    supabaseUrl,
    supabaseKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  console.log("\nSigning in...");

  const {
    data: authData,
    error: authError,
  } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    throw new Error(
      `Login failed: ${authError?.message ?? "Unknown error"}`
    );
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();

  if (profileError) {
    throw new Error(
      `Could not read admin profile: ${profileError.message}`
    );
  }

  if (profile?.role !== "admin") {
    throw new Error(
      "This Bias Vault account is not an admin."
    );
  }

  console.log("Admin authenticated.");
  console.log("\nOpening Kpopping SQLite...");

  const db = new Database(SQLITE_PATH, {
    readonly: true,
    fileMustExist: true,
  });

  db.pragma("query_only = ON");

  const tables = new Set(
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table'"
      )
      .all()
      .map((row) => row.name)
  );

  const requiredTables = [
    "groups",
    "artists",
    "memberships",
    "snapshot_manifest",
  ];

  for (const table of requiredTables) {
    if (!tables.has(table)) {
      throw new Error(
        `Required Kpopping table missing: ${table}`
      );
    }
  }

  const snapshot =
    db
      .prepare(
        "SELECT * FROM snapshot_manifest LIMIT 1"
      )
      .get();

  if (!snapshot) {
    throw new Error(
      "Kpopping snapshot_manifest is empty."
    );
  }

  const releaseId =
    snapshot.release_id ?? "2026-09";

  const dataAsOf =
    snapshot.snapshot_at ??
    snapshot.data_as_of ??
    snapshot.package_data_as_of ??
    null;

  console.log(`Release: ${releaseId}`);
  console.log(
    `Data as of: ${dataAsOf ?? "unknown"}`
  );

  const sourceGroups =
    db.prepare("SELECT * FROM groups").all();

  const sourceArtists =
    db.prepare("SELECT * FROM artists").all();

  const sourceMemberships =
    db.prepare("SELECT * FROM memberships").all();

  console.log("\nKpopping Core rows:");
  console.log(`Groups: ${sourceGroups.length}`);
  console.log(`Artists: ${sourceArtists.length}`);
  console.log(
    `Memberships: ${sourceMemberships.length}`
  );

  const now = new Date().toISOString();

  /*
   * Insert release first because the reference tables
   * have a foreign key to kpopping_releases.
   */

  const {
    error: releaseError,
  } = await supabase
    .from("kpopping_releases")
    .upsert(
      {
        release_id: releaseId,
        data_as_of: dataAsOf,
        imported_at: now,
        manifest: snapshot,
        active: true,
      },
      {
        onConflict: "release_id",
      }
    );

  if (releaseError) {
    throw new Error(
      `Release import failed: ${releaseError.message}`
    );
  }

  const {
    error: oldReleaseError,
  } = await supabase
    .from("kpopping_releases")
    .update({
      active: false,
    })
    .neq("release_id", releaseId);

  if (oldReleaseError) {
    throw new Error(
      `Could not deactivate older release: ${oldReleaseError.message}`
    );
  }

  /*
   * IMPORTANT:
   * Do NOT send normalized_name.
   * Supabase generates it automatically using norm(name).
   */

  const groups = sourceGroups.map((group) => ({
    kpopping_group_id:
      group.group_id,

    slug:
      group.slug,

    name:
      group.name,

    native_name:
      nullable(group.native_name),

    parent_group_id:
      nullable(group.parent_group_id),

    is_subunit:
      group.is_subunit === null ||
      group.is_subunit === undefined
        ? null
        : Boolean(group.is_subunit),

    group_type:
      nullable(group.group_type),

    entity_type:
      nullable(group.entity_type),

    debut_date:
      nullable(group.debut_date),

    disband_date:
      nullable(group.disband_date),

    status:
      nullable(group.status),

    kpopping_url:
      nullable(group.kpopping_url),

    release_id:
      releaseId,

    raw_data:
      group,

    updated_at:
      now,
  }));

  /*
   * Same rule here:
   * normalized_name is generated by Supabase.
   */

  const artists = sourceArtists.map((artist) => ({
    kpopping_artist_id:
      artist.artist_id,

    slug:
      artist.slug,

    stage_name:
      artist.stage_name,

    native_name:
      nullable(artist.native_name),

    status:
      nullable(artist.status),

    kpopping_url:
      nullable(artist.kpopping_url),

    release_id:
      releaseId,

    raw_data:
      artist,

    updated_at:
      now,
  }));

  const memberships =
    sourceMemberships.map((membership) => ({
      kpopping_membership_id:
        membership.membership_id,

      kpopping_group_id:
        membership.group_id,

      kpopping_artist_id:
        membership.artist_id,

      role:
        nullable(membership.role),

      position:
        nullable(membership.position),

      join_date:
        nullable(membership.join_date),

      leave_date:
        nullable(membership.leave_date),

      release_id:
        releaseId,

      raw_data:
        membership,

      updated_at:
        now,
    }));

  console.log("\nUploading groups...");

  await upsertInBatches(
    supabase,
    "kpopping_groups",
    groups,
    "kpopping_group_id"
  );

  console.log("\nUploading artists...");

  await upsertInBatches(
    supabase,
    "kpopping_artists",
    artists,
    "kpopping_artist_id"
  );

  console.log("\nUploading memberships...");

  await upsertInBatches(
    supabase,
    "kpopping_memberships",
    memberships,
    "kpopping_membership_id"
  );

  console.log("\nVerifying Supabase...");

  const finalCounts = {};

  for (const table of [
    "kpopping_groups",
    "kpopping_artists",
    "kpopping_memberships",
  ]) {
    const {
      count,
      error,
    } = await supabase
      .from(table)
      .select("*", {
        count: "exact",
        head: true,
      });

    if (error) {
      throw new Error(
        `${table} verification failed: ${error.message}`
      );
    }

    finalCounts[table] = count;
  }

  console.log("\n==============================");
  console.log("IMPORT COMPLETE");
  console.log("==============================");

  console.log(
    `Groups:      ${finalCounts.kpopping_groups}`
  );

  console.log(
    `Artists:     ${finalCounts.kpopping_artists}`
  );

  console.log(
    `Memberships: ${finalCounts.kpopping_memberships}`
  );

  /*
   * Sanity check:
   * verify that known groups are present.
   */

  const {
    data: tripleS,
    error: tripleSError,
  } = await supabase
    .from("kpopping_groups")
    .select(
      "kpopping_group_id,name,status,debut_date"
    )
    .ilike("name", "tripleS")
    .limit(5);

  if (tripleSError) {
    console.warn(
      "tripleS sanity check failed:",
      tripleSError.message
    );
  }

  const {
    data: tuide,
    error: tuideError,
  } = await supabase
    .from("kpopping_groups")
    .select(
      "kpopping_group_id,name,status,debut_date"
    )
    .ilike("name", "TUIDE")
    .limit(5);

  if (tuideError) {
    console.warn(
      "TUIDE sanity check failed:",
      tuideError.message
    );
  }

  console.log("\nSanity check:");

  console.log(
    "tripleS:",
    tripleS ?? []
  );

  console.log(
    "TUIDE:",
    tuide ?? []
  );

  db.close();

  await supabase.auth.signOut();

  console.log(
    "\n✅ Kpopping Core is now synced to Bias Vault."
  );
}

main().catch((error) => {
  console.error("\n❌ IMPORT FAILED\n");

  console.error(
    error instanceof Error
      ? error.message
      : error
  );

  process.exitCode = 1;
});