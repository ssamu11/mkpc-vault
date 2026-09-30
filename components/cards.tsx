"use client";
import { useState } from "react";
import { Download, Plus, Pencil, Trash2, SlidersHorizontal } from "lucide-react";
import type { Catalog, Card } from "@/lib/types";
import { cardIdols, cardGroups, cardExport } from "@/lib/catalog";
import { cardOdds, cardTier, formatPercent } from "@/lib/pocapop";
import { Badge, DataTable, Select, download } from "./ui";
import CardPhoto from "./card-photo";

export default function Cards({ data, scope, edit, remove }: {
  data: Catalog; scope?: Card[]; edit: (c?: Card) => void; remove: (c: Card) => void;
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [show, setShow] = useState(false);
  const rows = (scope || data.cards).filter(c => {
    const pack = data.packs.find(p => p.id === c.pack_id);
    const idols = cardIdols(c, data), groups = cardGroups(c, data);
    return [c.game_card_id, c.image_asset_id, c.card_name, c.slot, pack?.name, pack?.game_pack_id, cardTier(c, data), ...idols.map(i => i.stage_name), ...groups.map(g => g.name)].join(" ").toLowerCase().includes(query.toLowerCase()) &&
      (!filters.pack || c.pack_id === filters.pack) &&
      (!filters.rarity || c.rarity_id === filters.rarity) &&
      (!filters.gender || idols.some(i => i.gender === filters.gender)) &&
      (!filters.status || pack?.status === filters.status);
  });
  return <section className="panel">
    <div className="table-toolbar">
      <input className="search" aria-label="Search cards" placeholder="Search CardID, idol, group, or pack" value={query} onChange={e => setQuery(e.target.value)} />
      <button onClick={() => setShow(!show)}><SlidersHorizontal size={16} /> Filters</button>
      <button onClick={() => download(cardExport(rows, data), "pocapop-cards")}><Download size={16} /> Export {rows.length}</button>
      <button className="primary" onClick={() => edit()}><Plus size={16} /> Add card</button>
    </div>
    {show && <div className="filters">
      {[
        { key: "pack", label: "Packs", options: data.packs.map(p => ({value:p.id,label:`${p.game_pack_id || "Draft"} / ${p.name}`})) },
        { key: "rarity", label: "Rarities", options: data.rarities.map(r => ({value:r.id,label:r.label})) },
        { key: "gender", label: "Genders", options: ["female","male","other","unknown"].map(value => ({value,label:value})) },
        { key: "status", label: "Pack statuses", options: ["draft","planning","ready","released","archived"].map(value => ({value,label:value})) },
      ].map(f => <Select key={f.key} label={f.label} value={filters[f.key] || ""} options={f.options} onChange={value => setFilters({...filters,[f.key]:value})} />)}
      <button onClick={() => {setFilters({});setQuery("");}}>Clear filters</button>
    </div>}
    <DataTable rows={rows} rowKey={c => c.id} columns={[
      { key:"photo",label:"Photo",render:c => <CardPhoto key={c.image_asset_id} assetId={c.image_asset_id} alt={c.card_name || "Photocard"} /> },
      { key:"idol",label:"Idol / act",sort:c => cardIdols(c,data).map(i=>i.stage_name).join(" "),render:c => <div><b>{cardIdols(c,data).map(i=>i.stage_name).join(" x ") || c.card_name || "Group card"}</b><small>{cardGroups(c,data).map(g=>g.name).join(" / ") || "Solo"}</small></div> },
      { key:"id",label:"CardID",sort:c=>c.game_card_id || "",render:c => <div><code className="catalog-code">{c.game_card_id || "Unassigned"}</code><small>{c.image_asset_id || "No ImageAssetId"}</small></div> },
      { key:"pack",label:"Pack",sort:c=>data.packs.find(p=>p.id===c.pack_id)?.name || "",render:c => {const p=data.packs.find(p=>p.id===c.pack_id);return <div>{p?.name}<small>{p?.game_pack_id} / {p?.exclusive ? "Exclusive" : p?.pack_type}</small></div>;} },
      { key:"tier",label:"Tier",sort:c=>data.rarities.find(r=>r.id===c.rarity_id)?.sort_order || 0,render:c => <div><Badge tone={"tier-"+data.rarities.find(r=>r.id===c.rarity_id)?.game_key?.toLowerCase()}>{cardTier(c,data)}</Badge>{c.premium_tier && <small>{data.rarities.find(r=>r.id===c.rarity_id)?.label}</small>}</div> },
      { key:"odds",label:"Base chance / card",sort:c=>cardOdds(c,data) ?? -1,render:c => {const v=cardOdds(c,data);return v===null ? (data.packs.find(p=>p.id===c.pack_id)?.exclusive ? "Exclusive grant" : "Not configured") : formatPercent(v);} },
      { key:"status",label:"Catalog status",render:c => <div>{c.catalog_status || "Draft"}<small>{c.pic_status}</small></div> },
      { key:"actions",label:"Actions",render:c => <div className="row-actions"><button className="icon-button" title="Edit card" aria-label="Edit card" onClick={()=>edit(c)}><Pencil size={16}/></button><button className="icon-button text-danger" title="Delete card" aria-label="Delete card" onClick={()=>remove(c)}><Trash2 size={16}/></button></div> },
    ]}/>
  </section>;
}
