import { KITS } from "@/config/kits";
import type { PlayerTokenProps } from "@/components/pitch/PlayerToken";

// Team codes → kits (see src/config/kits.ts).
const ARS = KITS[3],
  LIV = KITS[14],
  MCI = KITS[43],
  CHE = KITS[8],
  BOU = KITS[91];
const NEW = KITS[4],
  AVL = KITS[7],
  BHA = KITS[36],
  MUN = KITS[1];

const fx = (label: string, difficulty: number) => [{ label, difficulty }];

/** A realistic 3-5-2 for the style-guide planner mock. Home opponents upper case, away lower. */
export const MOCK_XI: PlayerTokenProps[][] = [
  [{ name: "Raya", kit: ARS, goalkeeper: true, metrics: fx("BOU (H)", 2) }],
  [
    { name: "Gabriel", kit: ARS, metrics: fx("BOU (H)", 2) },
    { name: "Van Dijk", kit: LIV, metrics: fx("eve (a)", 3) },
    { name: "Gvardiol", kit: MCI, metrics: fx("ars (a)", 4) },
  ],
  [
    { name: "Saka", kit: ARS, metrics: fx("BOU (H)", 2) },
    { name: "Palmer", kit: CHE, metrics: fx("FUL (H)", 2), flag: "doubt" },
    { name: "Salah", kit: LIV, metrics: fx("eve (a)", 3), captain: "C" },
    { name: "Semenyo", kit: BOU, metrics: fx("ars (a)", 5) },
    {
      name: "Gordon",
      kit: NEW,
      metrics: [
        { label: "tot", difficulty: 4 },
        { label: "BHA", difficulty: 3 },
      ],
    },
  ],
  [
    { name: "Haaland", kit: MCI, metrics: fx("ars (a)", 4), captain: "V" },
    { name: "Watkins", kit: AVL, metrics: fx("NFO (H)", 2) },
  ],
];

export const MOCK_BENCH: PlayerTokenProps[] = [
  { name: "Verbruggen", kit: BHA, goalkeeper: true, metrics: fx("new (a)", 3) },
  { name: "Mbeumo", kit: MUN, metrics: fx("CHE (H)", 3), flag: "injured" },
  { name: "Hill", kit: BOU, metrics: [] },
  { name: "Mitoma", kit: BHA, metrics: fx("new (a)", 3) },
];
