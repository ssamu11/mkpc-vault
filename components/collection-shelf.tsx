"use client";
import { ArrowUpRight, Layers } from "lucide-react";
import type { Catalog } from "@/lib/types";
import CardPhoto from "./card-photo";
export default function CollectionShelf({
  data,
  open,
}: {
  data: Catalog;
  open: (id: string) => void;
}) {
  const packs = [...data.packs]
    .sort(
      (a, b) =>
        (a.pack_type === "Premium" ? -1 : 0) -
          (b.pack_type === "Premium" ? -1 : 0) ||
        (b.pack_number || 0) - (a.pack_number || 0),
    )
    .slice(0, 4);
  return (
    <section className="collection-band">
      <div className="section-title">
        <div>
          <h2>Pack library</h2>
        </div>
        <span className="library-count">
          <Layers size={16} />
          {data.packs.length} packs
        </span>
      </div>
      <div className="collection-grid">
        {packs.map((p, i) => (
          <button
            className={"pack-tile pack-color-" + i}
            key={p.id}
            onClick={() => open(p.id)}
          >
            <header>
              <code>{p.game_pack_id}</code>
              <ArrowUpRight size={18} />
            </header>
            <div className="pack-fan">
              {data.cards
                .filter((c) => c.pack_id === p.id && c.image_asset_id)
                .slice(0, 3)
                .map((c) => (
                  <CardPhoto
                    key={c.id}
                    assetId={c.image_asset_id}
                    alt={p.name}
                  />
                ))}
            </div>
            <footer>
              <div>
                <span>{p.exclusive ? "Exclusive" : p.pack_type}</span>
                <h3>{p.name}</h3>
              </div>
              <b>
                {data.cards.filter((c) => c.pack_id === p.id).length}
                <small>cards</small>
              </b>
            </footer>
          </button>
        ))}
      </div>
    </section>
  );
}
