import { NextResponse } from "next/server";
import { supabase, configured } from "@/lib/supabase";
import { readCatalog } from "@/lib/data";
import { planImport, clean } from "@/lib/catalog";
import { hasValidOrigin } from "@/lib/request-origin";
import { previewPack, type PackMapping } from "@/lib/pack-import";
import type { ImportRow } from "@/lib/types";
import { readPlannerPool } from "@/lib/planner-data";
const fields: Record<string, string[]> = {
  groups: ["name", "status"],
  idols: ["stage_name", "gender", "active"],
  packs: [
    "game_pack_id",
    "catalog_status",
    "catalog_size",
    "exclusive",
    "name",
    "pack_type",
    "pack_number",
    "release_date",
    "status",
    "notes",
  ],
  rarities: ["label", "numeric_value", "game_key", "sort_order", "active"],
  settings: ["include_unreleased"],
  profiles: ["role"],
};
export async function POST(request: Request) {
  try {
    if (!configured())
      return NextResponse.json(
        { error: "Supabase is not configured." },
        { status: 503 },
      );
    if (!hasValidOrigin(request))
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    const db = await supabase();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const { data: profile } = await db
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!profile)
      return NextResponse.json(
        { error: "Moderator access required" },
        { status: 403 },
      );
    const body = await request.text();
    if (body.length > 8_000_000)
      throw Error("Request is too large. Import fewer rows.");
    const input = JSON.parse(body);
    if (input.action === "pocapop_import") {
      if (
        !Array.isArray(input.packs) ||
        !input.packs.length ||
        input.packs.length > 200
      )
        throw Error("Select valid pack sheets.");
      const catalog = await readCatalog();
      const prepared = input.packs.map(
        (p: { mapping: PackMapping; rows: ImportRow[] }) => {
          if (!p.mapping || !Array.isArray(p.rows) || p.rows.length > 48)
            throw Error("Invalid pack rows.");
          const mapping = {
            sheet: clean(p.mapping.sheet),
            code: clean(p.mapping.code),
            name: clean(p.mapping.name),
            type: p.mapping.type,
            selected: true,
          };
          if (!["Rebirth", "Premium"].includes(mapping.type))
            throw Error("Unsupported pack type.");
          const rows = p.rows.map(
            (r) =>
              ({
                ...Object.fromEntries(
                  [
                    "sheet",
                    "slot",
                    "rarity",
                    "gender",
                    "idol",
                    "group",
                    "notes",
                    "pic_status",
                    "source_url",
                    "game_pack_id",
                    "game_idol_id",
                    "game_group_id",
                    "game_card_id",
                    "image_asset_id",
                  ].map((k) => [k, clean(r[k as keyof ImportRow])]),
                ),
                row: Number(r.row),
              }) as ImportRow,
          );
          const preview = previewPack(mapping, rows, catalog);
          const errors = [
            ...preview.issues,
            ...preview.rows.flatMap((r) =>
              r.issues.map((e) => `Row ${r.row}: ${e}`),
            ),
          ];
          if (errors.length) throw Error(`${mapping.sheet}: ${errors[0]}`);
          for (let i = 0; i < preview.rows.length; i++) {
            const expected = (
              p.rows[i] as ImportRow & { expected_updated_at?: string | null }
            ).expected_updated_at;
            if (expected !== preview.rows[i].expected_updated_at)
              throw Error("Catalog changed. Reload the workbook preview.");
          }
          return {
            ...mapping,
            existing_id: preview.existing_id,
            rows: preview.rows,
          };
        },
      );
      const { data, error } = await db.rpc("import_pocapop_workbook", {
        payload: { filename: clean(input.filename), packs: prepared },
      });
      if (error) throw Error(error.message);
      return NextResponse.json(data);
    }
    if (input.action === "pocapop_draft") {
      if (!Array.isArray(input.values?.rows) || ![24, 48].includes(input.values.rows.length))
        throw Error("Invalid planned pack.");
      const { pool } = await readPlannerPool();
      const rows = input.values.rows.map((r: { idol_id: string; slot: string; rarity_id: string; image_asset_id?: string }) => {
        const candidate = pool.find((c) => c.idol.id === r.idol_id);
        if (!candidate) throw Error("Candidate is no longer in the curated roster. Reload the planner.");
        return {
          slot: r.slot, rarity_id: r.rarity_id, image_asset_id: r.image_asset_id || "",
          idol_id: candidate.source === "local" ? candidate.idol.id : "",
          ...(candidate.source === "reference" ? { new_artist: {
            kpopping_artist_id: candidate.reference_artist_id,
            kpopping_group_id: candidate.reference_group_id,
            stage_name: candidate.idol.stage_name,
            group_name: candidate.group?.name,
            gender: candidate.idol.gender,
          } } : {}),
        };
      });
      const { data, error } = await db.rpc("save_pocapop_discovery_draft", {
        payload: { ...input.values, rows },
      });
      if (error) throw Error(error.message);
      return NextResponse.json({ id: data });
    }
    if (input.action === "profile") {
      if (profile.role !== "admin")
        return NextResponse.json(
          { error: "Admin access required" },
          { status: 403 },
        );
      if (!["admin", "moderator"].includes(input.role))
        throw Error("Invalid role");
      if (input.id === user.id && input.role !== "admin")
        throw Error("Ask another admin to change your own admin role.");
      const { error } = await db
        .from("profiles")
        .upsert({ id: input.id, role: input.role });
      if (error)
        throw Error(
          "Create the user in Supabase Authentication first, then check their user ID.",
        );
      return NextResponse.json({ ok: true });
    }
    if (input.action === "membership") {
      if (!["current", "former"].includes(input.status))
        throw Error("Invalid membership status");
      const { error } = await db.from("group_memberships").upsert(
        {
          group_id: input.group_id,
          idol_id: input.idol_id,
          membership_status: input.status,
        },
        { onConflict: "group_id,idol_id" },
      );
      if (error) throw Error(error.message);
      return NextResponse.json({ ok: true });
    }
    if (input.action === "import") {
      if (
        !["cards", "roster"].includes(input.mode) ||
        !Array.isArray(input.rows) ||
        !input.rows.length ||
        input.rows.length > 10000
      )
        throw Error("Select between 1 and 10,000 valid rows.");
      const rows: ImportRow[] = input.rows.map((r: ImportRow) => {
        const out: Record<string, unknown> = {};
        for (const field of [
          "sheet",
          "slot",
          "rarity",
          "gender",
          "idol",
          "group",
          "pic_status",
          "source_url",
          "notes",
          "membership_status",
        ])
          out[field] = clean(r[field as keyof ImportRow]);
        out.row = Number(r.row);
        return out as ImportRow;
      });
      const plan = planImport(rows, await readCatalog(), input.mode);
      const invalid = plan.find((r) => r.issues.length);
      if (invalid)
        throw Error(`Row ${invalid.row}: ${invalid.issues.join(" ")}`);
      const good = plan.filter((r) => !r.duplicate);
      const warnings = [...new Set(plan.flatMap((r) => r.warnings))];
      const { data, error } = await db.rpc("commit_import", {
        payload: {
          mode: input.mode,
          filename: clean(input.filename) || "Roster editor",
          rows: good,
          processed: rows.length,
          skipped: rows.length - good.length,
          warnings,
        },
      });
      if (error) throw Error(error.message);
      return NextResponse.json(data);
    }
    if (input.action === "card") {
      const c = input.values;
      if (!c || !Array.isArray(c.idol_ids) || c.idol_ids.length > 100)
        throw Error("Invalid card members.");
      if (c.source_url) {
        let url: URL;
        try {
          url = new URL(c.source_url);
        } catch {
          throw Error("Invalid source URL.");
        }
        if (!["http:", "https:"].includes(url.protocol))
          throw Error("Source must use http or https.");
      }
      const { data, error } = await db.rpc("save_card", { payload: c });
      if (error) throw Error(error.message);
      return NextResponse.json({ id: data });
    }
    if (input.action === "delete") {
      if (
        !["cards", "packs", "groups", "idols", "rarities"].includes(input.table)
      )
        throw Error("Unsupported deletion");
      if (input.table === "rarities" && profile.role !== "admin")
        throw Error("Admin access required");
      if (input.table === "packs") {
        const { error } = await db.rpc("delete_draft_pack_cascade", {
          p_pack_id: input.id,
        });

        if (error) {
          throw Error(error.message);
        }

        return NextResponse.json({
          ok: true,
        });
      }

      const { error } = await db.from(input.table).delete().eq("id", input.id);
      if (error)
        throw Error(
          "This record could not be deleted. Remove its dependent records first.",
        );
      return NextResponse.json({ ok: true });
    }
    if (input.action === "save") {
      const allowed = fields[input.table];
      if (!allowed) throw Error("Unknown record type");
      if (
        ["rarities", "settings", "profiles"].includes(input.table) &&
        profile.role !== "admin"
      )
        throw Error("Admin access required");
      const values: Record<string, unknown> = {};
      for (const f of allowed)
        if (f in input.values)
          values[f] =
            typeof input.values[f] === "string"
              ? clean(input.values[f])
              : input.values[f];
      const query = input.id
        ? db.from(input.table).update(values).eq("id", input.id)
        : db.from(input.table).insert(values);
      const { error } = await query;
      if (error) throw Error(error.message);
      return NextResponse.json({ ok: true });
    }
    throw Error("Unknown action");
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 400 },
    );
  }
}
