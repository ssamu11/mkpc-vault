"use client";

import { useState } from "react";
import type { Catalog, Card } from "@/lib/types";
import {
  cardIdols,
  cardGroups,
  cardExport,
} from "@/lib/catalog";
import {
  Badge,
  DataTable,
  Select,
  download,
} from "./ui";

export default function Cards({
  data,
  scope,
  edit,
  remove,
}: {
  data: Catalog;
  scope?: Card[];
  edit: (c?: Card) => void;
  remove: (c: Card) => void;
}) {
  const [query, setQuery] =
    useState("");

  const [filters, setFilters] =
    useState<
      Record<string, string>
    >({});

  const [show, setShow] =
    useState(false);

  const all =
    scope || data.cards;

  function rarityFor(
    card: Card,
  ) {
    return data.rarities.find(
      (rarity) =>
        rarity.id ===
        card.rarity_id,
    );
  }

  function rarityPercentage(
    card: Card,
  ) {
    const rarity =
      rarityFor(card);

    if (!rarity) {
      return "";
    }

    const raw =
      String(
        rarity.numeric_value ??
          "",
      ).trim();

    if (!raw) {
      return "";
    }

    return raw.endsWith("%")
      ? raw
      : raw + "%";
  }

  function rarityDisplay(
    card: Card,
  ) {
    const rarity =
      rarityFor(card);

    if (!rarity) {
      return "Unknown";
    }

    return (
      rarity.label ||
      rarityPercentage(card) ||
      "Unknown"
    );
  }

  function packFor(
    card: Card,
  ) {
    return data.packs.find(
      (pack) =>
        pack.id ===
        card.pack_id,
    );
  }

  const rows = all.filter(
    (card) => {
      const pack =
        packFor(card);

      const idols =
        cardIdols(
          card,
          data,
        );

      const groups =
        cardGroups(
          card,
          data,
        );

      const rarity =
        rarityFor(card);

      const match = [
        pack?.name,
        pack?.pack_type,
        card.card_name,
        card.slot,
        rarity?.label,
        rarity?.numeric_value,
        rarityPercentage(card),
        ...idols.map(
          (idol) =>
            idol.stage_name,
        ),
        ...groups.map(
          (group) =>
            group.name,
        ),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(
          query.toLowerCase(),
        );

      if (!match) {
        return false;
      }

      return Object.entries(
        filters,
      ).every(
        ([key, value]) =>
          !value ||
          (key === "idol"
            ? idols.some(
                (idol) =>
                  idol.id ===
                  value,
              )
            : key === "group"
              ? groups.some(
                  (group) =>
                    group.id ===
                    value,
                )
              : key ===
                  "gender"
                ? idols.some(
                    (idol) =>
                      idol.gender ===
                      value,
                  )
                : key ===
                    "pack_type"
                  ? pack?.pack_type ===
                    value
                  : key ===
                      "pack_status"
                    ? pack?.status ===
                      value
                    : key ===
                        "pack"
                      ? card.pack_id ===
                        value
                      : key ===
                          "rarity"
                        ? card.rarity_id ===
                          value
                        : card.pic_status ===
                          value),
      );
    },
  );

  const opts = (
    items: {
      id: string;
      name: string;
    }[],
  ) =>
    items.map((item) => ({
      value: item.id,
      label: item.name,
    }));

  const unique = (
    values: string[],
  ) =>
    [
      ...new Set(values),
    ]
      .filter(Boolean)
      .sort()
      .map((value) => ({
        value,
        label: value,
      }));

  const rarityOptions =
    data.rarities.map(
      (rarity) => {
        const raw =
          String(
            rarity.numeric_value ??
              "",
          ).trim();

        const percent =
          raw &&
          !raw.endsWith("%")
            ? raw + "%"
            : raw;

        const label =
          rarity.label ||
          percent;

        return {
          value: rarity.id,

          label:
            percent &&
            label !== percent
              ? label +
                " · " +
                percent
              : label,
        };
      },
    );

  const defs = [
    {
      key: "idol",
      label: "Idols",

      options: opts(
        data.idols.map(
          (idol) => ({
            id: idol.id,
            name:
              idol.stage_name,
          }),
        ),
      ),
    },

    {
      key: "group",
      label: "Groups",
      options: opts(
        data.groups,
      ),
    },

    {
      key: "pack",
      label: "Packs",
      options: opts(
        data.packs,
      ),
    },

    {
      key: "pack_type",
      label: "Pack types",

      options: unique(
        data.packs.map(
          (pack) =>
            pack.pack_type,
        ),
      ),
    },

    {
      key: "rarity",
      label: "Rarities",
      options:
        rarityOptions,
    },

    {
      key: "gender",
      label: "Genders",

      options: unique([
        "female",
        "male",
        "other",
        "unknown",
      ]),
    },

    {
      key: "pic_status",
      label:
        "Picture statuses",

      options: unique(
        data.cards.map(
          (card) =>
            card.pic_status ||
            "",
        ),
      ),
    },

    {
      key: "pack_status",
      label:
        "Pack statuses",

      options: unique([
        "planning",
        "draft",
        "ready",
        "released",
        "archived",
      ]),
    },
  ];

  return (
    <section className="panel">
      <div className="table-toolbar">
        <input
          className="search"
          aria-label="Search cards"
          placeholder="Search idols, rarity, groups, or packs…"
          value={query}
          onChange={(event) =>
            setQuery(
              event.target
                .value,
            )
          }
        />

        <button
          onClick={() =>
            setShow(!show)
          }
        >
          ☷ Filters{" "}
          {Object.values(
            filters,
          ).filter(Boolean)
            .length || ""}
        </button>

        <button
          onClick={() =>
            download(
              cardExport(
                rows,
                data,
              ),
              "filtered-cards",
            )
          }
        >
          ↓ Export{" "}
          {rows.length}
        </button>

        <button
          className="primary"
          onClick={() =>
            edit()
          }
        >
          ＋ Add card
        </button>
      </div>

      {show && (
        <div className="filters">
          {defs.map(
            (filter) => (
              <Select
                key={
                  filter.key
                }
                label={
                  filter.label
                }
                value={
                  filters[
                    filter.key
                  ] || ""
                }
                options={
                  filter.options
                }
                onChange={(
                  value,
                ) =>
                  setFilters({
                    ...filters,

                    [filter.key]:
                      value,
                  })
                }
              />
            ),
          )}

          <button
            onClick={() => {
              setFilters({});
              setQuery("");
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      <DataTable
        rows={rows}
        rowKey={(card) =>
          card.id
        }
        columns={[
          {
            key: "idol",
            label:
              "Idol / idols",

            sort: (card) =>
              cardIdols(
                card,
                data,
              )
                .map(
                  (idol) =>
                    idol.stage_name,
                )
                .join(" "),

            render: (card) => (
              <div className="identity">
                <span className="avatar">
                  {(
                    cardIdols(
                      card,
                      data,
                    )[0]
                      ?.stage_name ||
                    card.card_name ||
                    "G"
                  ).slice(
                    0,
                    2,
                  )}
                </span>

                <span>
                  <b>
                    {cardIdols(
                      card,
                      data,
                    )
                      .map(
                        (idol) =>
                          idol.stage_name,
                      )
                      .join(
                        " × ",
                      ) ||
                      card.card_name ||
                      "Group card"}
                  </b>

                  <small>
                    {cardGroups(
                      card,
                      data,
                    )
                      .map(
                        (group) =>
                          group.name,
                      )
                      .join(
                        " / ",
                      ) ||
                      "Soloist"}
                  </small>
                </span>
              </div>
            ),
          },

          /*
           * Rarity deliberately appears
           * immediately after the idol.
           * It is core card identity.
           */

          {
            key: "rarity",
            label: "Rarity",

            sort: (card) =>
              Number(
                rarityFor(
                  card,
                )
                  ?.numeric_value ||
                  0,
              ),

            render: (card) => {
              const display =
                rarityDisplay(
                  card,
                );

              const percent =
                rarityPercentage(
                  card,
                );

              return (
                <div>
                  <Badge tone="violet">
                    {display}
                  </Badge>

                  {percent &&
                    percent !==
                      display && (
                      <small>
                        Drop rate{" "}
                        {percent}
                      </small>
                    )}
                </div>
              );
            },
          },

          {
            key: "pack",
            label: "Pack",

            sort: (card) =>
              packFor(card)
                ?.name || "",

            render: (card) => {
              const pack =
                packFor(card);

              return (
                <>
                  {pack?.name ||
                    "—"}

                  <small>
                    {pack?.pack_type ||
                      "Unknown"}{" "}
                    ·{" "}
                    {pack?.status ||
                      "unknown"}
                  </small>
                </>
              );
            },
          },

          {
            key: "slot",
            label: "Slot",

            sort: (card) =>
              card.slot ||
              "",

            render: (card) =>
              card.slot ||
              "—",
          },

          {
            key: "gender",
            label: "Gender",

            render: (card) =>
              [
                ...new Set(
                  cardIdols(
                    card,
                    data,
                  ).map(
                    (idol) =>
                      idol.gender,
                  ),
                ),
              ].join(" / ") ||
              "—",
          },

          {
            key: "pic",
            label:
              "Pic status",

            sort: (card) =>
              card.pic_status ||
              "",

            render: (card) => (
              <Badge
                tone={
                  card.pic_status?.toLowerCase() ===
                  "selected"
                    ? "green"
                    : "amber"
                }
              >
                {card.pic_status ||
                  "Not set"}
              </Badge>
            ),
          },

          {
            key: "source",
            label:
              "Source / notes",

            render: (card) => (
              <>
                {card.source_url &&
                /^https?:\/\//i.test(
                  card.source_url,
                ) ? (
                  <a
                    href={
                      card.source_url
                    }
                    target="_blank"
                    rel="noreferrer"
                  >
                    Source ↗
                  </a>
                ) : (
                  "—"
                )}

                {card.notes && (
                  <small
                    className="notes"
                    title={
                      card.notes
                    }
                  >
                    {card.notes}
                  </small>
                )}
              </>
            ),
          },

          {
            key: "actions",
            label: "Actions",

            render: (card) => (
              <div className="row-actions">
                <button
                  onClick={() =>
                    edit(card)
                  }
                >
                  Edit
                </button>

                <button
                  className="text-danger"
                  onClick={() =>
                    remove(card)
                  }
                >
                  Delete
                </button>
              </div>
            ),
          },
        ]}
      />
    </section>
  );
}
