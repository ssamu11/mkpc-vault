export const popularityLevels = ["headliner", "established", "rising", "nugu"] as const;
export type Popularity = (typeof popularityLevels)[number];

export function groupNameKey(name: string) {
  return name.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}
export function groupIdentityKey(name: string) {
  const key = groupNameKey(name);
  return ({ txt: "tomorrowxtogether", ald1: "alphadriveone", gidle: "idle", snsd: "girlsgeneration" } as Record<string, string>)[key] || key;
}

// Editorial recipe presets, not live chart positions. Unreviewed groups are excluded.
const presets: Record<Popularity, string[]> = {
  headliner: ["BTS", "BLACKPINK", "TWICE", "SEVENTEEN", "EXO", "BIGBANG", "Girls' Generation", "SHINee", "Stray Kids", "TXT", "TOMORROW X TOGETHER", "ENHYPEN", "ATEEZ", "aespa", "IVE", "LE SSERAFIM", "NewJeans", "ITZY", "Red Velvet", "i-dle", "(G)I-DLE", "NCT", "NCT 127", "NCT DREAM", "RIIZE", "BABYMONSTER", "GOT7", "MAMAMOO"],
  established: ["2NE1", "2PM", "2AM", "Apink", "ASTRO", "BTOB", "DAY6", "MONSTA X", "THE BOYZ", "TREASURE", "ZEROBASEONE", "BOYNEXTDOOR", "TWS", "NMIXX", "STAYC", "KISS OF LIFE", "ILLIT", "FIFTY FIFTY", "Kep1er", "fromis_9", "OH MY GIRL", "Dreamcatcher", "VIVIZ", "KARA", "WJSN", "P1Harmony", "N.Flying", "ONEUS", "PENTAGON", "SF9", "CRAVITY", "WINNER", "iKON", "INFINITE", "Highlight", "SUPER JUNIOR", "TVXQ!", "B1A4", "VIXX", "Block B", "EXID", "Girl's Day", "Brown Eyed Girls", "f(x)", "T-ARA", "LOONA", "GFRIEND", "IZ*ONE", "I.O.I", "XG", "NiziU", "&TEAM", "JO1", "INI", "KATSEYE", "QWER", "LUCY", "The Rose", "FTISLAND", "CNBLUE", "Xdinary Heroes", "PLAVE"],
  rising: ["tripleS", "ARTMS", "Billlie", "H1-KEY", "EVERGLOW", "PURPLE KISS", "Weeekly", "WOOAH", "LIGHTSUM", "UNIS", "izna", "MEOVV", "Hearts2Hearts", "KiiiKiii", "CORTIS", "CLOSE YOUR EYES", "AHOF", "ALPHA DRIVE ONE", "ALD1", "ALPHA DRIVEONE", "KickFlip", "NEXZ", "NCT WISH", "EVNNE", "xikers", "EPEX", "TEMPEST", "TNX", "ONE PACT", "AB6IX", "CIX", "ONF", "A.C.E", "DRIPPIN", "WEi", "YOUNITE", "OMEGA X", "MCND", "RESCENE", "SAY MY NAME", "YOUNG POSSE", "BADVILLAIN", "8TURN", "82MAJOR", "CLASSy", "OnlyOneOf", "Golden Child", "VERIVERY", "The Wind", "ALLDAY PROJECT", "Loossemble", "CLC", "CHERRY BULLET", "ROCKET PUNCH", "NU'EST"],
  nugu: ["CSR", "AMPERS&ONE", "ALL(H)OURS", "ARRC", "POW", "IDID", "idntt", "ifeye", "KIIRAS", "aoen", "AND2BLE", "LNGSHOT", "MADEIN", "SANTOS BRAVOS", "VAYONN", "TUIDE", "FLARE U", "ICHILLIN'", "ILY:1", "Lapillus", "SECRET NUMBER", "BLACKSWAN", "CRAXY", "Candy Shop", "Geenius", "VVUP", "HITGS", "USPEER", "AtHeart", "Baby DONT Cry", "ODD YOUTH", "PRIMROSE", "Queenz Eye", "SATURDAY", "ALICE", "BEWAVE", "DKB", "E'LAST", "JUSTB", "BAE173", "FANTASY BOYS", "The KingDom", "GHOST9", "BLITZERS", "TRENDZ", "VANNER", "TIOT", "WHIB", "LUN8", "DXMON", "AIMERS", "ASC2NT", "n.SSign", "NouerA", "NOWZ", "NEWBEAT", "XLOV", "XODIAC", "NTX", "NINE.i", "WAKER", "HORI7ON", "ONE OR EIGHT", "DXTEEN", "Big Ocean", "Catch The Young", "Dragon Pony", "Rolling Quartz", "X:IN"],
};
const ratings = new Map(Object.entries(presets).flatMap(([rating, names]) => names.map((name) => [groupIdentityKey(name), rating as Popularity] as const)));
export function groupPopularity(name: string): Popularity | null {
  return ratings.get(groupIdentityKey(name)) ?? null;
}
