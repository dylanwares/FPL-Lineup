import type { Kit } from "@/config/kits";
import { KIT_SHAPES } from "@/components/Kit";
import { PENALTY_SPOT, PITCH_LINES } from "@/components/pitch/Pitch";
import type { TokenMetric } from "@/components/pitch/PlayerToken";

/*
 * The share image: the lineup drawn straight onto a 1080×1350 (4:5) canvas,
 * always in the dark night-stadium look. It reuses the on-screen kit and pitch
 * geometry, so the picture matches the planner.
 */

export const WIDTH = 1080;
export const HEIGHT = 1350;

export interface ShareToken {
  name: string;
  kit: Kit;
  goalkeeper?: boolean;
  metrics: TokenMetric[];
  blank?: boolean;
  captain?: "C" | "V";
  flag?: "doubt" | "injured";
  empty?: boolean;
  /** Photo view: the loaded photo (the kit is drawn when it's missing). */
  photo?: HTMLImageElement | null;
}

export interface ShareScene {
  teamName: string;
  gw: number;
  /** The chip played that gameweek, by name, or null. */
  chip: string | null;
  /** The XI, one array per formation row (goalkeeper first). */
  rows: ShareToken[][];
  bench: ShareToken[];
}

export interface ShareStyle {
  /** CSS font-family lists for the body and display faces. */
  sans: string;
  display: string;
  /** [background, text] per FPL difficulty 1–5. */
  fdr: [string, string][];
}

// Dark-theme tokens from globals.css (the image never follows the light theme).
const BG = "#0a0710";
const FG = "#f2f0f7";
const MUTED = "#a09bb5";
const MINT = "#2ee6a6";
const MAGENTA = "#f0447f";
const VIOLET = "#8b7cf6";
const DOUBT = "#f5c04a";
const INJURED = "#f0506a";
const PITCH_TOP = "#0b3d27";
const PITCH_BOTTOM = "#06281a";
const PITCH_LINE = "rgb(150 255 210 / 0.34)";
const NEUTRAL: [string, string] = ["rgb(255 255 255 / 0.12)", "rgb(255 255 255 / 0.7)"];

const M = 40; // page margin
const PITCH = { x: M, y: 180, w: WIDTH - 2 * M, h: HEIGHT - 180 - 70 };
const BOARD_H = 64;
const BENCH_H = 270;
const TOKEN_W = 150;
const KIT = 104;
const NAME_H = 36;
const PILL_H = 32;
const TOKEN_H = KIT + NAME_H + PILL_H;

export function drawLineup(ctx: CanvasRenderingContext2D, scene: ShareScene, style: ShareStyle) {
  const font = (weight: number, size: number, face: "sans" | "display" = "sans") =>
    `${weight} ${size}px ${style[face]}`;

  drawBackground(ctx);
  drawHeader(ctx, scene, font);

  const { x, y, w, h } = PITCH;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 36);
  ctx.clip();
  drawPitch(ctx);
  drawAdBoard(ctx, font);

  // The XI fills the field above the bench, four rows spaced evenly.
  const top = y + BOARD_H + 18;
  const benchY = y + h - BENCH_H;
  const slot = (benchY - 12 - top) / scene.rows.length;
  scene.rows.forEach((row, i) => drawRow(ctx, row, top + i * slot + (slot - TOKEN_H) / 2, style, font));

  drawBench(ctx, scene.bench, benchY, style, font);
  ctx.restore();

  // A hairline rim round the pitch card.
  ctx.beginPath();
  ctx.roundRect(x + 0.5, y + 0.5, w - 1, h - 1, 36);
  ctx.strokeStyle = "rgb(255 255 255 / 0.08)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.font = font(500, 22);
  ctx.fillStyle = MUTED;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Plan yours at fpllineup.com", WIDTH / 2, HEIGHT - 35);
}

type FontFn = (weight: number, size: number, face?: "sans" | "display") => string;

function drawBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const glow = (cx: number, cy: number, r: number, colour: string) => {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, colour);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  };
  glow(0, 0, 900, "rgb(46 230 166 / 0.09)");
  glow(WIDTH * 0.6, HEIGHT * 0.45, 800, "rgb(139 124 246 / 0.08)");
  glow(WIDTH, HEIGHT, 900, "rgb(240 68 127 / 0.07)");
}

function drawHeader(ctx: CanvasRenderingContext2D, scene: ShareScene, font: FontFn) {
  let right = WIDTH - M - 8;
  if (scene.chip) {
    // The chip as a tinted magenta pill, right-aligned with the team name.
    const label = scene.chip.toUpperCase();
    ctx.font = font(700, 21);
    setSpacing(ctx, "2px");
    const pw = ctx.measureText(label).width + 44;
    const px = right - pw;
    ctx.beginPath();
    ctx.roundRect(px, 92, pw, 50, 25);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = MAGENTA;
    ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = MAGENTA;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ff7aa8";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, px + pw / 2, 118);
    setSpacing(ctx, "0px");
    right = px - 24;
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = font(700, 50, "display");
  ctx.fillStyle = FG;
  ctx.fillText(fit(ctx, scene.teamName, right - (M + 8)), M + 8, 104);

  ctx.font = font(600, 24);
  setSpacing(ctx, "6px");
  ctx.fillStyle = MUTED;
  ctx.fillText(`GAMEWEEK ${scene.gw}`, M + 10, 146);
  setSpacing(ctx, "0px");
}

function drawPitch(ctx: CanvasRenderingContext2D) {
  const { x, y, w, h } = PITCH;
  const field = y + BOARD_H;

  const base = ctx.createLinearGradient(0, y, 0, y + h);
  base.addColorStop(0, PITCH_TOP);
  base.addColorStop(1, PITCH_BOTTOM);
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);

  // Mowing stripes, 34px on screen → 85px here.
  ctx.fillStyle = "rgb(255 255 255 / 0.025)";
  for (let sy = field; sy < y + h; sy += 170) ctx.fillRect(x, sy, w, 85);

  // Floodlights from the top corners, and a vignette.
  for (const cx of [x, x + w]) {
    const g = ctx.createRadialGradient(cx, field, 0, cx, field, w * 0.7);
    g.addColorStop(0, "rgb(210 255 235 / 0.1)");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  }
  const v = ctx.createRadialGradient(x + w / 2, y + h * 0.4, w * 0.35, x + w / 2, y + h * 0.4, w * 0.9);
  v.addColorStop(0, "transparent");
  v.addColorStop(1, "rgb(0 0 0 / 0.45)");
  ctx.fillStyle = v;
  ctx.fillRect(x, y, w, h);

  // Markings: the screen's 400-wide half pitch, scaled to the card's width.
  const scale = w / 400;
  ctx.save();
  ctx.translate(x, field);
  ctx.scale(scale, scale);
  ctx.strokeStyle = PITCH_LINE;
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgb(46 230 166 / 0.3)";
  ctx.shadowBlur = 6;
  for (const d of PITCH_LINES) ctx.stroke(new Path2D(d));
  ctx.beginPath();
  ctx.arc(PENALTY_SPOT.x, PENALTY_SPOT.y, PENALTY_SPOT.r, 0, Math.PI * 2);
  ctx.fillStyle = PITCH_LINE;
  ctx.fill();
  ctx.restore();
}

function drawAdBoard(ctx: CanvasRenderingContext2D, font: FontFn) {
  const { x, y, w } = PITCH;
  ctx.fillStyle = "rgb(8 4 16 / 0.85)";
  ctx.fillRect(x, y, w, BOARD_H);
  ctx.fillStyle = "rgb(255 255 255 / 0.04)";
  for (let sy = y; sy < y + BOARD_H; sy += 3) ctx.fillRect(x, sy, w, 1);
  ctx.fillStyle = "rgb(255 255 255 / 0.08)";
  ctx.fillRect(x, y + BOARD_H - 1, w, 1);

  const parts: [string, string][] = [
    ["FPL LINEUP", MINT],
    ["◆", "rgb(255 255 255 / 0.2)"],
    ["FPLLINEUP.COM", "rgb(255 255 255 / 0.55)"],
    ["◆", "rgb(255 255 255 / 0.2)"],
    ["FPL LINEUP", MINT],
  ];
  const gap = 30;
  ctx.font = font(700, 20, "display");
  setSpacing(ctx, "5px");
  const widths = parts.map(([t]) => ctx.measureText(t).width);
  let tx = x + (w - widths.reduce((a, b) => a + b, 0) - gap * (parts.length - 1)) / 2;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  parts.forEach(([text, colour], i) => {
    ctx.fillStyle = colour;
    ctx.fillText(text, tx, y + BOARD_H / 2 + 1);
    tx += widths[i] + gap;
  });
  setSpacing(ctx, "0px");
}

/** Players spread evenly across the card, as the pitch rows do on screen. */
function drawRow(
  ctx: CanvasRenderingContext2D,
  row: ShareToken[],
  top: number,
  style: ShareStyle,
  font: FontFn,
) {
  const gap = (PITCH.w - row.length * TOKEN_W) / (row.length + 1);
  row.forEach((t, i) => drawToken(ctx, t, PITCH.x + gap + i * (TOKEN_W + gap), top, style, font));
}

function drawBench(
  ctx: CanvasRenderingContext2D,
  bench: ShareToken[],
  top: number,
  style: ShareStyle,
  font: FontFn,
) {
  const { x, w } = PITCH;
  ctx.fillStyle = "rgb(6 4 12 / 0.55)";
  ctx.fillRect(x, top, w, BENCH_H);
  ctx.fillStyle = "rgb(255 255 255 / 0.08)";
  ctx.fillRect(x, top, w, 1);

  ctx.font = font(600, 18);
  setSpacing(ctx, "4px");
  ctx.fillStyle = MUTED;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("BENCH", x + 28, top + 30);
  setSpacing(ctx, "0px");

  const gap = (w - bench.length * TOKEN_W) / (bench.length + 1);
  bench.forEach((t, i) => {
    const tx = x + gap + i * (TOKEN_W + gap);
    // Priority label above each sub: GK, then 1–3.
    const label = i === 0 ? "GK" : String(i);
    ctx.font = font(700, 16);
    const lw = Math.max(30, ctx.measureText(label).width + 16);
    ctx.beginPath();
    ctx.roundRect(tx + TOKEN_W / 2 - lw / 2, top + 46, lw, 26, 13);
    ctx.fillStyle = "rgb(255 255 255 / 0.08)";
    ctx.fill();
    ctx.fillStyle = MUTED;
    ctx.textAlign = "center";
    ctx.fillText(label, tx + TOKEN_W / 2, top + 60);
    drawToken(ctx, t, tx, top + 82, style, font);
  });
}

function drawToken(
  ctx: CanvasRenderingContext2D,
  t: ShareToken,
  x: number,
  y: number,
  style: ShareStyle,
  font: FontFn,
) {
  const cx = x + TOKEN_W / 2;
  const kitX = cx - KIT / 2;
  ctx.save();
  if (t.blank && !t.empty) {
    ctx.globalAlpha = 0.45;
    if ("filter" in ctx) ctx.filter = "grayscale(1)";
  }

  // Contact shadow: a squashed radial fade under the shirt.
  ctx.save();
  ctx.translate(cx, y + KIT - 4);
  ctx.scale(1, 0.22);
  const shadow = ctx.createRadialGradient(0, 0, 0, 0, 0, 56);
  shadow.addColorStop(0, "rgb(0 0 0 / 0.6)");
  shadow.addColorStop(1, "transparent");
  ctx.fillStyle = shadow;
  ctx.fillRect(-60, -60, 120, 120);
  ctx.restore();

  if (t.empty) {
    ctx.beginPath();
    ctx.arc(cx, y + KIT / 2 + 4, 46, 0, Math.PI * 2);
    ctx.fillStyle = "rgb(0 0 0 / 0.2)";
    ctx.fill();
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgb(255 255 255 / 0.5)";
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(cx - 14, y + KIT / 2 + 4);
    ctx.lineTo(cx + 14, y + KIT / 2 + 4);
    ctx.moveTo(cx, y + KIT / 2 - 10);
    ctx.lineTo(cx, y + KIT / 2 + 18);
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgb(255 255 255 / 0.8)";
    ctx.stroke();
  } else if (t.photo) {
    // Photos are portrait: bottom-aligned on the kit's box, a little taller.
    const h = KIT + 16;
    const w = (t.photo.naturalWidth / t.photo.naturalHeight) * h;
    ctx.drawImage(t.photo, cx - w / 2, y + KIT - h, w, h);
  } else {
    drawKit(ctx, t.kit, !!t.goalkeeper, kitX, y, KIT);
  }

  if (t.captain) drawArmband(ctx, t.captain, kitX - 2, y + 16, font);
  if (t.flag) drawFlag(ctx, t.flag, kitX + KIT + 2, y + 16);

  // Name pill.
  const nameY = y + KIT - 2;
  ctx.beginPath();
  ctx.roundRect(x, nameY, TOKEN_W, NAME_H, [10, 10, 0, 0]);
  ctx.fillStyle = t.flag ? DOUBT : "rgb(8 5 16 / 0.85)";
  ctx.fill();
  ctx.strokeStyle = "rgb(255 255 255 / 0.1)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.font = font(600, 22);
  ctx.fillStyle = t.flag ? "#1a1200" : "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(fit(ctx, t.name, TOKEN_W - 14), cx, nameY + NAME_H / 2 + 1);

  // Metric pill(s): split evenly in a double gameweek, a dash in a blank.
  const pillY = nameY + NAME_H;
  const metrics = t.metrics.length ? t.metrics : [{ label: "—", difficulty: null }];
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, pillY, TOKEN_W, PILL_H, [0, 0, 10, 10]);
  ctx.clip();
  const segW = TOKEN_W / metrics.length;
  metrics.forEach((m, i) => {
    const [bg, fg] = m.difficulty == null ? NEUTRAL : style.fdr[Math.min(5, Math.max(1, m.difficulty)) - 1];
    ctx.fillStyle = bg;
    ctx.fillRect(x + i * segW, pillY, segW, PILL_H);
    if (i > 0) {
      ctx.fillStyle = "rgb(0 0 0 / 0.25)";
      ctx.fillRect(x + i * segW, pillY, 1.5, PILL_H);
    }
    ctx.font = font(600, metrics.length > 1 ? 18 : 20);
    ctx.fillStyle = fg;
    ctx.fillText(fit(ctx, m.label, segW - 10), x + i * segW + segW / 2, pillY + PILL_H / 2 + 1);
  });
  ctx.restore();
  ctx.restore();
}

function drawKit(
  ctx: CanvasRenderingContext2D,
  kit: Kit,
  goalkeeper: boolean,
  x: number,
  y: number,
  size: number,
) {
  const style = goalkeeper ? "plain" : kit.style;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 64, size / 64);
  const body = new Path2D(KIT_SHAPES.body);
  ctx.fillStyle = goalkeeper ? kit.gk : kit.primary;
  ctx.fill(body);
  ctx.fillStyle = kit.secondary;
  if (style === "sleeves") for (const d of KIT_SHAPES.sleeves) ctx.fill(new Path2D(d));
  if (style === "stripes" || style === "hoops") {
    for (const [rx, ry, rw, rh] of KIT_SHAPES[style]) ctx.fillRect(rx, ry, rw, rh);
  }
  for (const [d, fill, opacity] of KIT_SHAPES.shading) {
    ctx.save();
    ctx.globalAlpha *= opacity;
    ctx.fillStyle = fill;
    ctx.fill(new Path2D(d));
    ctx.restore();
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = goalkeeper ? "#111" : kit.secondary;
  ctx.stroke(new Path2D(KIT_SHAPES.collar));
  ctx.lineWidth = 1.25;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgb(0 0 0 / 0.35)";
  ctx.stroke(body);
  ctx.restore();
}

function drawArmband(ctx: CanvasRenderingContext2D, role: "C" | "V", cx: number, cy: number, font: FontFn) {
  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, Math.PI * 2);
  ctx.fillStyle = role === "C" ? MAGENTA : "rgb(20 10 35 / 0.92)";
  ctx.fill();
  ctx.lineWidth = role === "C" ? 2 : 3;
  ctx.strokeStyle = role === "C" ? "rgb(255 255 255 / 0.4)" : VIOLET;
  ctx.stroke();
  ctx.font = font(700, 19, "display");
  ctx.fillStyle = role === "C" ? "#ffffff" : "#c4b5fd";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(role, cx, cy + 1);
}

function drawFlag(ctx: CanvasRenderingContext2D, flag: "doubt" | "injured", cx: number, cy: number) {
  ctx.save();
  ctx.translate(cx - 18, cy - 16);
  ctx.scale(1.8, 1.8);
  ctx.fillStyle = flag === "doubt" ? DOUBT : INJURED;
  ctx.strokeStyle = "rgb(0 0 0 / 0.6)";
  ctx.lineJoin = "round";
  const tri = new Path2D("M10 1.2 19 16.8H1Z");
  ctx.fill(tri);
  ctx.stroke(tri);
  ctx.strokeStyle = "#140a14";
  ctx.lineWidth = 1.9;
  ctx.lineCap = "round";
  ctx.stroke(new Path2D("M10 6.5v4.8"));
  ctx.beginPath();
  ctx.arc(10, 14, 1.05, 0, Math.PI * 2);
  ctx.fillStyle = "#140a14";
  ctx.fill();
  ctx.restore();
}

/** Text shortened with an ellipsis to fit `max` px in the current font. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

/** Letter spacing where the browser supports it on canvas (it's decoration, so skipped otherwise). */
function setSpacing(ctx: CanvasRenderingContext2D, value: string) {
  if ("letterSpacing" in ctx)
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = value;
}
