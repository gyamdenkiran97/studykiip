/**
 * Original generated product imagery.
 *
 * Demo catalogues need pictures, and using real product photography would mean
 * using someone else's copyrighted work. Instead every demo image is drawn here
 * from scratch: a deterministic studio composition (ground, shadow, silhouette,
 * grain) derived from the product slug, so a product always looks the same and
 * no two products look identical.
 *
 * Production media is uploaded through the admin panel and stored in object
 * storage; nothing in this file runs on a production product.
 */

export type Archetype =
  | "garment"
  | "outerwear"
  | "bottle"
  | "jar"
  | "device"
  | "laptop"
  | "headphones"
  | "speaker"
  | "watch"
  | "shoe"
  | "bag"
  | "chair"
  | "sofa"
  | "lamp"
  | "vase"
  | "mug"
  | "ball"
  | "bottle-sport"
  | "blocks"
  | "book"
  | "pen"
  | "tyre"
  | "generic";

export type Palette = { ground: string; groundEdge: string; body: string; bodyShade: string; accent: string };

export const PALETTES: Record<string, Palette> = {
  sand: { ground: "#EFE7DA", groundEdge: "#E2D6C4", body: "#C8A882", bodyShade: "#A98862", accent: "#7E5A3C" },
  clay: { ground: "#F0E3DE", groundEdge: "#E4D0C8", body: "#B5654A", bodyShade: "#8E4A33", accent: "#5E2E1E" },
  slate: { ground: "#E6E8E9", groundEdge: "#D4D8DA", body: "#4A5257", bodyShade: "#333A3E", accent: "#20262A" },
  forest: { ground: "#E3EAE5", groundEdge: "#CFDBD3", body: "#2F5548", bodyShade: "#203B32", accent: "#14261F" },
  blush: { ground: "#F3E7E6", groundEdge: "#E8D3D2", body: "#D3A199", bodyShade: "#B67F76", accent: "#7E4C45" },
  oat: { ground: "#EFEBE1", groundEdge: "#E1DACB", body: "#D8CDB8", bodyShade: "#BFB194", accent: "#7A6E56" },
  ink: { ground: "#E4E2DE", groundEdge: "#D2CFC9", body: "#2A2724", bodyShade: "#191714", accent: "#0E0D0B" },
  amber: { ground: "#F2EADA", groundEdge: "#E6D9BE", body: "#C79539", bodyShade: "#A5761F", accent: "#6B4A10" },
  olive: { ground: "#EAEADD", groundEdge: "#DBDBC6", body: "#7C8351", bodyShade: "#5E663A", accent: "#3A4022" },
  stone: { ground: "#EAE8E4", groundEdge: "#DAD7D1", body: "#9A958C", bodyShade: "#7C776E", accent: "#4E4A44" },
};

/**
 * Re-tint a palette around a colourway swatch, keeping the studio ground from
 * the product's own palette so a range still reads as one family.
 */
function tintPalette(base: Palette, hex: string): Palette {
  const body = normaliseHex(hex);
  return {
    ground: base.ground,
    groundEdge: base.groundEdge,
    body,
    bodyShade: shiftLightness(body, -0.18),
    accent: shiftLightness(body, -0.34),
  };
}

function normaliseHex(hex: string): string {
  const value = hex.trim().replace("#", "");
  if (value.length === 3) {
    return `#${value[0]}${value[0]}${value[1]}${value[1]}${value[2]}${value[2]}`;
  }
  return `#${value.slice(0, 6).padEnd(6, "0")}`;
}

/** Move a colour towards black (negative) or white (positive). */
function shiftLightness(hex: string, amount: number): string {
  const value = normaliseHex(hex).slice(1);
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  const shifted = channels.map((channel) => {
    const target = amount < 0 ? 0 : 255;
    const next = Math.round(channel + (target - channel) * Math.abs(amount));
    return Math.max(0, Math.min(255, next));
  });
  return `#${shifted.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/** Deterministic 32-bit hash so a slug always produces the same picture. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };
}

function silhouette(archetype: Archetype, p: Palette, random: () => number): string {
  const body = p.body;
  const shade = p.bodyShade;
  const accent = p.accent;

  switch (archetype) {
    case "garment":
      return `
        <path d="M300 250 L380 215 Q400 260 440 275 L415 335 L392 322 L392 560 Q400 585 375 585 L225 585 Q200 585 208 560 L208 322 L185 335 L160 275 Q200 260 220 215 L300 250 Z" fill="${body}"/>
        <path d="M300 250 L380 215 Q400 260 440 275 L415 335 L392 322 L392 560 Q400 585 375 585 L300 585 Z" fill="${shade}" opacity="0.35"/>
        <path d="M262 228 Q300 268 338 228" fill="none" stroke="${accent}" stroke-width="5" opacity="0.5"/>`;
    case "outerwear":
      return `
        <path d="M300 235 L395 205 Q425 250 455 270 L430 350 L408 338 L408 600 L192 600 L192 338 L170 350 L145 270 Q175 250 205 205 L300 235 Z" fill="${body}"/>
        <path d="M300 235 L300 600 L408 600 L408 338 L430 350 L455 270 Q425 250 395 205 Z" fill="${shade}" opacity="0.3"/>
        <rect x="292" y="250" width="16" height="350" fill="${accent}" opacity="0.35"/>
        <circle cx="300" cy="330" r="7" fill="${accent}" opacity="0.6"/>
        <circle cx="300" cy="420" r="7" fill="${accent}" opacity="0.6"/>`;
    case "bottle":
      return `
        <rect x="272" y="170" width="56" height="70" rx="6" fill="${shade}"/>
        <path d="M262 236 Q300 254 338 236 L352 300 Q360 340 360 400 L360 560 Q360 596 326 596 L274 596 Q240 596 240 560 L240 400 Q240 340 248 300 Z" fill="${body}"/>
        <path d="M300 245 L300 596 L326 596 Q360 596 360 560 L360 400 Q360 340 352 300 L338 236 Q320 248 300 245 Z" fill="${shade}" opacity="0.35"/>
        <rect x="264" y="150" width="72" height="34" rx="8" fill="${accent}"/>
        <rect x="258" y="400" width="84" height="96" rx="4" fill="#FBF9F5" opacity="0.85"/>`;
    case "jar":
      return `
        <rect x="236" y="250" width="128" height="40" rx="10" fill="${accent}"/>
        <path d="M244 288 L356 288 Q372 288 372 312 L372 520 Q372 560 330 560 L270 560 Q228 560 228 520 L228 312 Q228 288 244 288 Z" fill="${body}"/>
        <path d="M300 288 L356 288 Q372 288 372 312 L372 520 Q372 560 330 560 L300 560 Z" fill="${shade}" opacity="0.32"/>
        <rect x="252" y="370" width="96" height="70" rx="3" fill="#FBF9F5" opacity="0.8"/>`;
    case "device":
      return `
        <rect x="205" y="160" width="190" height="400" rx="26" fill="${shade}"/>
        <rect x="216" y="172" width="168" height="376" rx="20" fill="${body}"/>
        <rect x="232" y="196" width="136" height="300" rx="4" fill="${p.ground}" opacity="0.75"/>
        <rect x="272" y="176" width="56" height="9" rx="4" fill="${accent}"/>
        <circle cx="300" cy="524" r="14" fill="${accent}" opacity="0.7"/>`;
    case "laptop":
      return `
        <path d="M180 220 L420 220 L420 430 L180 430 Z" fill="${shade}"/>
        <rect x="192" y="232" width="216" height="186" fill="${p.ground}" opacity="0.8"/>
        <path d="M140 430 L460 430 L486 486 Q490 498 476 498 L124 498 Q110 498 114 486 Z" fill="${body}"/>
        <rect x="250" y="452" width="100" height="8" rx="4" fill="${accent}" opacity="0.6"/>`;
    case "headphones":
      return `
        <path d="M172 400 L172 300 Q172 168 300 168 Q428 168 428 300 L428 400" fill="none" stroke="${body}" stroke-width="34" stroke-linecap="round"/>
        <path d="M300 168 Q428 168 428 300 L428 400" fill="none" stroke="${shade}" stroke-width="34" stroke-linecap="round" opacity="0.5"/>
        <rect x="136" y="366" width="76" height="140" rx="34" fill="${shade}"/>
        <rect x="388" y="366" width="76" height="140" rx="34" fill="${body}"/>
        <rect x="150" y="386" width="48" height="100" rx="24" fill="${accent}" opacity="0.5"/>`;
    case "speaker":
      return `
        <rect x="216" y="190" width="168" height="380" rx="20" fill="${body}"/>
        <rect x="300" y="190" width="84" height="380" rx="20" fill="${shade}" opacity="0.3"/>
        <circle cx="300" cy="300" r="52" fill="${accent}" opacity="0.75"/>
        <circle cx="300" cy="300" r="22" fill="${p.ground}" opacity="0.6"/>
        <circle cx="300" cy="460" r="34" fill="${accent}" opacity="0.5"/>`;
    case "watch":
      return `
        <rect x="266" y="150" width="68" height="160" rx="18" fill="${shade}"/>
        <rect x="266" y="450" width="68" height="160" rx="18" fill="${shade}"/>
        <rect x="216" y="276" width="168" height="208" rx="44" fill="${body}"/>
        <rect x="236" y="296" width="128" height="168" rx="32" fill="${p.ground}" opacity="0.85"/>
        <rect x="384" y="340" width="16" height="36" rx="6" fill="${accent}"/>`;
    case "shoe":
      // Side profile: heel counter, ankle collar, toe box, midsole, outsole.
      return `
        <path d="M120 474 Q116 420 168 404 Q212 390 244 358 Q272 330 306 320 L306 268 Q306 250 328 250 L356 250 Q376 250 376 270 L376 334 Q410 350 438 384 Q468 418 470 456 L470 474 Z" fill="${body}"/>
        <path d="M306 320 L306 474 L470 474 L470 456 Q468 418 438 384 Q410 350 376 334 L376 270 Q376 250 356 250 L328 250 Q306 250 306 268 Z" fill="${shade}" opacity="0.3"/>
        <path d="M128 466 L472 466 Q484 466 484 486 Q484 512 452 512 L152 512 Q124 512 124 488 Q124 466 128 466 Z" fill="${accent}"/>
        <path d="M124 490 L484 490 L484 496 Q484 512 452 512 L152 512 Q124 512 124 496 Z" fill="${shade}" opacity="0.45"/>
        <path d="M248 356 Q278 372 302 400" fill="none" stroke="${p.ground}" stroke-width="7" opacity="0.7"/>
        <path d="M274 332 Q304 348 328 378" fill="none" stroke="${p.ground}" stroke-width="7" opacity="0.7"/>
        <path d="M300 306 Q330 322 354 354" fill="none" stroke="${p.ground}" stroke-width="7" opacity="0.7"/>
        <path d="M126 448 Q156 432 186 430" fill="none" stroke="${accent}" stroke-width="6" opacity="0.45"/>`;
    case "bag":
      return `
        <path d="M228 268 Q228 176 300 176 Q372 176 372 268" fill="none" stroke="${accent}" stroke-width="16"/>
        <path d="M176 264 L424 264 L452 556 Q454 580 428 580 L172 580 Q146 580 148 556 Z" fill="${body}"/>
        <path d="M300 264 L424 264 L452 556 Q454 580 428 580 L300 580 Z" fill="${shade}" opacity="0.3"/>
        <rect x="264" y="330" width="72" height="44" rx="4" fill="${accent}" opacity="0.6"/>`;
    case "chair":
      return `
        <path d="M206 200 L394 200 Q410 200 408 220 L392 400 L208 400 L192 220 Q190 200 206 200 Z" fill="${body}"/>
        <path d="M300 200 L394 200 Q410 200 408 220 L392 400 L300 400 Z" fill="${shade}" opacity="0.3"/>
        <rect x="176" y="400" width="248" height="34" rx="8" fill="${accent}"/>
        <rect x="198" y="434" width="18" height="150" rx="6" fill="${shade}"/>
        <rect x="384" y="434" width="18" height="150" rx="6" fill="${shade}"/>
        <rect x="290" y="434" width="18" height="150" rx="6" fill="${shade}" opacity="0.6"/>`;
    case "sofa":
      return `
        <rect x="132" y="290" width="336" height="140" rx="22" fill="${body}"/>
        <rect x="132" y="290" width="336" height="60" rx="22" fill="${shade}" opacity="0.28"/>
        <rect x="112" y="330" width="56" height="150" rx="20" fill="${shade}"/>
        <rect x="432" y="330" width="56" height="150" rx="20" fill="${shade}"/>
        <rect x="168" y="400" width="264" height="80" rx="14" fill="${accent}" opacity="0.55"/>
        <rect x="160" y="480" width="16" height="50" fill="${accent}"/>
        <rect x="424" y="480" width="16" height="50" fill="${accent}"/>`;
    case "lamp":
      return `
        <path d="M228 176 L372 176 L412 316 L188 316 Z" fill="${body}"/>
        <path d="M300 176 L372 176 L412 316 L300 316 Z" fill="${shade}" opacity="0.3"/>
        <rect x="292" y="316" width="16" height="230" fill="${accent}"/>
        <ellipse cx="300" cy="556" rx="84" ry="16" fill="${shade}"/>\n        <ellipse cx="300" cy="550" rx="84" ry="16" fill="${body}"/>
        <ellipse cx="300" cy="330" rx="40" ry="10" fill="#FBF9F5" opacity="0.6"/>`;
    case "vase":
      return `
        <path d="M252 200 L348 200 Q356 260 386 330 Q412 396 386 470 Q360 544 300 544 Q240 544 214 470 Q188 396 214 330 Q244 260 252 200 Z" fill="${body}"/>
        <path d="M300 200 L348 200 Q356 260 386 330 Q412 396 386 470 Q360 544 300 544 Z" fill="${shade}" opacity="0.3"/>
        <ellipse cx="300" cy="200" rx="48" ry="12" fill="${accent}"/>`;
    case "mug":
      return `
        <path d="M400 320 Q460 320 460 380 Q460 440 400 440" fill="none" stroke="${shade}" stroke-width="26"/>
        <path d="M188 286 L400 286 L386 520 Q382 560 340 560 L248 560 Q206 560 202 520 Z" fill="${body}"/>
        <path d="M294 286 L400 286 L386 520 Q382 560 340 560 L294 560 Z" fill="${shade}" opacity="0.28"/>
        <ellipse cx="294" cy="286" rx="106" ry="20" fill="${accent}" opacity="0.7"/>`;
    case "ball":
      return `
        <circle cx="300" cy="378" r="166" fill="${body}"/>
        <path d="M300 212 A166 166 0 0 1 300 544 A210 210 0 0 0 300 212 Z" fill="${shade}" opacity="0.28"/>
        <path d="M148 320 Q300 380 452 320" fill="none" stroke="${accent}" stroke-width="9" opacity="0.65"/>
        <path d="M148 436 Q300 376 452 436" fill="none" stroke="${accent}" stroke-width="9" opacity="0.65"/>
        <path d="M300 212 L300 544" stroke="${accent}" stroke-width="9" opacity="0.35"/>`;
    case "bottle-sport":
      return `
        <rect x="268" y="150" width="64" height="52" rx="12" fill="${accent}"/>
        <path d="M246 202 L354 202 Q372 202 372 240 L372 540 Q372 584 328 584 L272 584 Q228 584 228 540 L228 240 Q228 202 246 202 Z" fill="${body}"/>
        <path d="M300 202 L354 202 Q372 202 372 240 L372 540 Q372 584 328 584 L300 584 Z" fill="${shade}" opacity="0.3"/>
        <rect x="228" y="330" width="144" height="24" fill="${accent}" opacity="0.6"/>
        <rect x="228" y="376" width="144" height="12" fill="${accent}" opacity="0.4"/>`;
    case "blocks":
      return `
        <rect x="186" y="404" width="150" height="150" rx="10" fill="${body}"/>
        <rect x="336" y="404" width="110" height="150" rx="10" fill="${shade}"/>
        <rect x="236" y="254" width="150" height="150" rx="10" fill="${accent}" opacity="0.8"/>
        <circle cx="311" cy="200" r="54" fill="${body}"/>`;
    case "book":
      return `
        <rect x="176" y="212" width="248" height="330" rx="6" fill="${shade}"/>
        <rect x="192" y="224" width="232" height="306" rx="4" fill="${body}"/>
        <rect x="176" y="212" width="30" height="330" rx="6" fill="${accent}"/>
        <rect x="236" y="290" width="140" height="10" rx="5" fill="${p.ground}" opacity="0.8"/>
        <rect x="236" y="320" width="100" height="10" rx="5" fill="${p.ground}" opacity="0.6"/>`;
    case "pen":
      return `
        <path d="M282 150 L318 150 L318 470 L300 520 L282 470 Z" fill="${body}"/>
        <path d="M300 150 L318 150 L318 470 L300 520 Z" fill="${shade}" opacity="0.35"/>
        <rect x="278" y="220" width="44" height="90" rx="6" fill="${accent}"/>
        <path d="M288 470 L312 470 L300 512 Z" fill="${accent}"/>`;
    case "tyre":
      return `
        <circle cx="300" cy="378" r="176" fill="${shade}"/>
        <circle cx="300" cy="378" r="104" fill="${body}"/>
        <circle cx="300" cy="378" r="46" fill="${accent}"/>
        ${Array.from({ length: 12 }, (_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          const x1 = 300 + Math.cos(angle) * 122;
          const y1 = 378 + Math.sin(angle) * 122;
          const x2 = 300 + Math.cos(angle) * 170;
          const y2 = 378 + Math.sin(angle) * 170;
          return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${p.ground}" stroke-width="10" opacity="0.35"/>`;
        }).join("")}`;
    default: {
      const skew = 40 + random() * 60;
      return `
        <rect x="198" y="236" width="204" height="300" rx="14" fill="${body}"/>
        <path d="M300 236 L402 236 L402 536 L300 536 Z" fill="${shade}" opacity="0.28"/>
        <rect x="232" y="${280 + skew}" width="136" height="16" rx="8" fill="${accent}" opacity="0.55"/>
        <circle cx="300" cy="${420 + skew / 2}" r="44" fill="${accent}" opacity="0.4"/>`;
    }
  }
}

/**
 * A 600×720 studio composition. No text, no logos, no external references.
 */
export function productImageSvg(options: {
  seed: string;
  archetype: Archetype;
  palette: keyof typeof PALETTES;
  variant?: number;
  /** A colourway swatch; the subject is re-tinted around it. */
  tintHex?: string;
}): string {
  const { seed, archetype, palette, variant = 0, tintHex } = options;
  const base = PALETTES[palette] ?? PALETTES.oat;
  const p = tintHex ? tintPalette(base, tintHex) : base;
  const random = rng(hash(`${seed}:${variant}`));
  const angle = -8 + random() * 16;
  const groundY = 560 + random() * 30;
  const glowX = 180 + random() * 240;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 720" width="600" height="720" role="img">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${p.ground}"/>
      <stop offset="1" stop-color="${p.groundEdge}"/>
    </linearGradient>
    <radialGradient id="glow" cx="${(glowX / 600).toFixed(3)}" cy="0.34" r="0.62">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="shadow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#1A1713" stop-opacity="0.26"/>
      <stop offset="1" stop-color="#1A1713" stop-opacity="0"/>
    </radialGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" seed="${hash(seed) % 100}"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.055"/></feComponentTransfer>
    </filter>
  </defs>

  <rect width="600" height="720" fill="url(#bg)"/>
  <rect width="600" height="720" fill="url(#glow)"/>
  <ellipse cx="300" cy="${groundY.toFixed(0)}" rx="210" ry="46" fill="url(#shadow)"/>
  <g transform="translate(300 380) rotate(${angle.toFixed(2)}) scale(1.16) translate(-300 -380)">
    ${silhouette(archetype, p, random)}
  </g>
  <rect width="600" height="720" filter="url(#grain)" opacity="0.6"/>
</svg>`;
}

/**
 * Wide editorial artwork for category, campaign and hero blocks.
 *
 * Four deterministic compositions in the Swiss-poster tradition — an arc, a
 * horizon, a column grid and a stack — chosen by hashing the seed. Shapes have
 * defined edges rather than soft blobs, so the artwork reads as designed rather
 * than as a gradient wash.
 */
export function editorialImageSvg(options: {
  seed: string;
  palette: keyof typeof PALETTES;
  width?: number;
  height?: number;
}): string {
  const { seed, palette, width = 1440, height = 900 } = options;
  const p = PALETTES[palette] ?? PALETTES.oat;
  const random = rng(hash(seed));
  const composition = hash(`${seed}:composition`) % 4;

  const w = width;
  const h = height;
  const body = p.body;
  const shade = p.bodyShade;
  const accent = p.accent;

  /** Evenly spaced hairlines; the texture that keeps flat colour from feeling empty. */
  const hatch = (x: number, y: number, hatchWidth: number, hatchHeight: number, gap: number, colour: string) => {
    const lines: string[] = [];
    for (let offset = 0; offset < hatchWidth; offset += gap) {
      lines.push(
        `<line x1="${(x + offset).toFixed(0)}" y1="${y.toFixed(0)}" x2="${(x + offset).toFixed(0)}" y2="${(y + hatchHeight).toFixed(0)}" stroke="${colour}" stroke-width="1.5" opacity="0.32"/>`,
      );
    }
    return lines.join("");
  };

  let art = "";

  if (composition === 0) {
    // Arc: a large quarter-circle anchored off one corner.
    const radius = h * (0.82 + random() * 0.3);
    const cx = w * (random() > 0.5 ? 0.72 : 0.28);
    art = `
      <rect x="0" y="${(h * 0.62).toFixed(0)}" width="${w}" height="${(h * 0.38).toFixed(0)}" fill="${shade}" opacity="0.18"/>
      <circle cx="${cx.toFixed(0)}" cy="${(h * 0.92).toFixed(0)}" r="${radius.toFixed(0)}" fill="${body}" opacity="0.5"/>
      <circle cx="${cx.toFixed(0)}" cy="${(h * 0.92).toFixed(0)}" r="${(radius * 0.58).toFixed(0)}" fill="${shade}" opacity="0.45"/>
      <circle cx="${cx.toFixed(0)}" cy="${(h * 0.92).toFixed(0)}" r="${(radius * 0.22).toFixed(0)}" fill="${accent}" opacity="0.55"/>
      ${hatch(w * 0.06, h * 0.12, w * 0.2, h * 0.3, 11, accent)}`;
  } else if (composition === 1) {
    // Horizon: banded ground with a disc sitting on the line.
    const horizon = h * (0.52 + random() * 0.14);
    const discX = w * (0.24 + random() * 0.5);
    const discR = h * 0.2;
    art = `
      <circle cx="${discX.toFixed(0)}" cy="${(horizon - discR * 0.72).toFixed(0)}" r="${discR.toFixed(0)}" fill="${accent}" opacity="0.6"/>
      <rect x="0" y="${horizon.toFixed(0)}" width="${w}" height="${(h - horizon).toFixed(0)}" fill="${body}" opacity="0.55"/>
      <rect x="0" y="${(horizon + (h - horizon) * 0.42).toFixed(0)}" width="${w}" height="${((h - horizon) * 0.58).toFixed(0)}" fill="${shade}" opacity="0.4"/>
      <line x1="0" y1="${horizon.toFixed(0)}" x2="${w}" y2="${horizon.toFixed(0)}" stroke="${accent}" stroke-width="2" opacity="0.4"/>
      ${hatch(w * 0.62, horizon + 20, w * 0.3, (h - horizon) * 0.34, 13, p.ground)}`;
  } else if (composition === 2) {
    // Columns: an uneven rhythm of vertical panels.
    const columns = 5 + (hash(seed) % 3);
    const columnWidth = w / columns;
    const bars = Array.from({ length: columns }, (_, index) => {
      const heightRatio = 0.28 + random() * 0.6;
      const top = h - h * heightRatio;
      const fill = [body, shade, accent][index % 3];
      return `<rect x="${(index * columnWidth).toFixed(0)}" y="${top.toFixed(0)}" width="${(columnWidth - 2).toFixed(0)}" height="${(h * heightRatio).toFixed(0)}" fill="${fill}" opacity="${(0.28 + (index % 3) * 0.14).toFixed(2)}"/>`;
    }).join("");
    art = `${bars}
      <circle cx="${(w * 0.5).toFixed(0)}" cy="${(h * 0.3).toFixed(0)}" r="${(h * 0.16).toFixed(0)}" fill="none" stroke="${accent}" stroke-width="2.5" opacity="0.45"/>`;
  } else {
    // Stack: overlapping rounded panels, offset like sheets of paper.
    const panels = Array.from({ length: 3 }, (_, index) => {
      const inset = 0.08 + index * 0.09;
      const fill = [body, shade, accent][index];
      return `<rect x="${(w * inset).toFixed(0)}" y="${(h * (inset + 0.04)).toFixed(0)}" width="${(w * (1 - inset * 2)).toFixed(0)}" height="${(h * (1 - inset * 1.7)).toFixed(0)}" rx="${(h * 0.02).toFixed(0)}" fill="${fill}" opacity="${(0.24 + index * 0.1).toFixed(2)}"/>`;
    }).join("");
    art = `${panels}
      ${hatch(w * 0.34, h * 0.36, w * 0.32, h * 0.26, 12, p.ground)}`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">
  <defs>
    <linearGradient id="eg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="${p.ground}"/>
      <stop offset="1" stop-color="${p.groundEdge}"/>
    </linearGradient>
    <filter id="grain2">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="${hash(seed) % 90}"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.05"/></feComponentTransfer>
    </filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#eg)"/>
  ${art}
  <rect width="${w}" height="${h}" filter="url(#grain2)" opacity="0.7"/>
</svg>`;
}
