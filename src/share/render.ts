import { drawLineup, HEIGHT, WIDTH, type ShareScene, type ShareStyle, type ShareToken } from "./draw";

/** A token as the planner describes it: a photo is still just a player code. */
export type SceneToken = Omit<ShareToken, "photo"> & { photoCode?: number };
export type SceneInput = Omit<ShareScene, "rows" | "bench"> & { rows: SceneToken[][]; bench: SceneToken[] };

const PHOTO_TIMEOUT_MS = 4000;

/** A player's photo through our proxy (so the canvas stays exportable), or null to draw the kit. */
function loadPhoto(code: number): Promise<HTMLImageElement | null> {
  const img = new Image();
  img.src = `/api/photo/${code}`;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), PHOTO_TIMEOUT_MS));
  return Promise.race([
    img.decode().then(
      () => img,
      () => null,
    ),
    timeout,
  ]);
}

/** The app's fonts and FDR colours, read from the page so the image matches it. */
async function pageStyle(): Promise<ShareStyle> {
  const css = getComputedStyle(document.documentElement);
  const sans = css.getPropertyValue("--font-inter").trim() || "system-ui, sans-serif";
  const display = css.getPropertyValue("--font-unbounded").trim() || "'Arial Black', sans-serif";
  await Promise.all([
    document.fonts.load(`600 22px ${sans}`),
    document.fonts.load(`500 22px ${sans}`),
    document.fonts.load(`700 50px ${display}`),
  ]).catch(() => {});
  const fdr = [1, 2, 3, 4, 5].map(
    (d) =>
      [css.getPropertyValue(`--fdr-${d}`).trim(), css.getPropertyValue(`--fdr-${d}-fg`).trim()] as [
        string,
        string,
      ],
  );
  return { sans, display, fdr };
}

/** Draws the lineup and returns it as a PNG. */
export async function renderShareImage(input: SceneInput): Promise<Blob> {
  const codes = [...input.rows.flat(), ...input.bench].flatMap((t) => (t.photoCode ? [t.photoCode] : []));
  const [style, photos] = await Promise.all([
    pageStyle(),
    Promise.all(codes.map(async (code) => [code, await loadPhoto(code)] as const)).then((e) => new Map(e)),
  ]);
  const withPhoto = ({ photoCode, ...t }: SceneToken): ShareToken => ({
    ...t,
    photo: photoCode ? photos.get(photoCode) : undefined,
  });

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't available.");
  drawLineup(
    ctx,
    { ...input, rows: input.rows.map((r) => r.map(withPhoto)), bench: input.bench.map(withPhoto) },
    style,
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't encode the image."))),
      "image/png",
    ),
  );
}
