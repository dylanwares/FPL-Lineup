/** Written by scripts/build-bootstrap.ts; served by /api/version. */
export interface Manifest {
  hash: string;
  /** Public path of the content-hashed bootstrap file. */
  url: string;
  season: string;
  currentGw: number | null;
  nextGw: number | null;
  /** Epoch seconds. */
  generatedAt: number;
}
