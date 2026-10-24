import * as THREE from "three";

/**
 * The landing page's arcade: white lime-plaster arches in the manner of Ghardaia's M'zab arcades, with the
 * library's stacks in the bays between them. Units are metres; the aisle runs from z = 0 toward -z.
 */
export const AISLE = {
  /** Distance between two arches, and how far the camera walks per landing section. */
  spacing: 7,
  arches: 8,
  /** Half the width of the aisle, wall to wall. */
  halfWidth: 4,
  height: 8.2,
  /** The arch opening: half its width and the height where the round head springs. */
  openHalf: 2.5,
  spring: 2.7,
  wall: 0.9,
  /** Where the stacks stand: the line of the books and shelves, and the back panel behind them. */
  stackX: 3.26,
  stackBack: 3.46,
  /** Eye level, and how far in front of an arch the camera stops so the arch frames the section's plaque. */
  eye: 1.9,
  standOff: 5.5,
  sections: 5,
};

/** The catalogue's cover colours are mixed with these, so the shelves read as the library's own. */
export const SHELF_PALETTE = ["#0E6B3C", "#0A5230", "#7A2E1F", "#1E3A5F", "#B8975A", "#E7F2EB", "#3B4A42", "#8C2F39", "#2F5D50", "#D9CBA3"];

/** A small deterministic noise, so the hand-made irregularities are the same on every visit. */
function hash(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

const smooth = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * One arch wall, drawn as a single outline (no hole) so the opening can reach the floor. No two arches are
 * alike: each head is a little wider or flatter, the plaster swells and dips in long waves, and the edges are
 * rounded thick. The outer edge runs well past the aisle so the first arch reads as a facade. Vertex colours
 * darken the foot of the wall, where it meets the floor.
 */
export function archGeometry(seed: number) {
  const { height: h, spring } = AISLE;
  const w = 10;
  const o = AISLE.openHalf + (hash(seed, 1, 1) - 0.5) * 0.14;
  const rise = o * (0.9 + hash(seed, 2, 2) * 0.14);
  const shape = new THREE.Shape();
  shape.moveTo(-w, 0);
  shape.lineTo(-o, 0);
  shape.lineTo(-o, spring);
  shape.absellipse(0, spring, o, rise, Math.PI, 0, true, 0);
  shape.lineTo(o, 0);
  shape.lineTo(w, 0);
  shape.lineTo(w, h + 2);
  shape.lineTo(-w, h + 2);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: AISLE.wall,
    curveSegments: 48,
    bevelEnabled: true,
    bevelSize: 0.17,
    bevelThickness: 0.17,
    bevelSegments: 6,
  });
  geometry.translate(0, 0, -AISLE.wall / 2);
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // Long, soft waves rather than grain: a wall plastered by hand, not a wall that is rough.
    const wave = Math.sin(x * 1.7 + seed * 3.1) * Math.sin(y * 1.1 + seed) * 0.045 + Math.sin(y * 3.3 + x * 0.6 + seed) * 0.018;
    pos.setXYZ(i, x + wave * 0.6, y, z + wave);
    const shade = 0.8 + 0.2 * smooth(0, 1.4, y);
    colors.set([shade, shade, shade * 0.99], i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** The barrel vault over one bay: the inside of a half cylinder lying along the aisle. */
export function vaultGeometry() {
  const length = AISLE.spacing - AISLE.wall;
  const geometry = new THREE.CylinderGeometry(AISLE.halfWidth, AISLE.halfWidth, length, 48, 1, true, -Math.PI / 2, Math.PI);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  draw(ctx);
  return new THREE.CanvasTexture(canvas);
}

/** A plaster bump map drawn once: broad trowel sweeps and soft blotches, repeated only a little. */
export function plasterTexture() {
  const size = 512;
  const texture = canvasTexture(size, size, (ctx) => {
    ctx.fillStyle = "#808080";
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 260; i++) {
      const x = hash(i, 1, 2) * size, y = hash(i, 3, 4) * size;
      const r = 20 + hash(i, 5, 6) * 70;
      const shade = Math.round(96 + hash(i, 7, 8) * 64);
      ctx.fillStyle = `rgba(${shade},${shade},${shade},0.16)`;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 1.9, r, hash(i, 9, 1) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 1400; i++) {
      const shade = Math.round(100 + hash(i, 11, 3) * 56);
      ctx.fillStyle = `rgba(${shade},${shade},${shade},0.22)`;
      ctx.fillRect(hash(i, 12, 5) * size, hash(i, 13, 7) * size, 2, 2);
    }
  });
  if (!texture) return null;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.4, 1.4);
  return texture;
}

/**
 * The floor's colour across the aisle: pale stone, darker in the shadow under the stacks and along the
 * walls, the contact shading a real floor has where things stand on it.
 */
export function floorTexture() {
  const texture = canvasTexture(512, 8, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 512, 0);
    const span = AISLE.halfWidth + 2;
    const at = (x: number) => (x + span) / (span * 2);
    const dark = "#9EA59F", stone = "#ECEDE8";
    for (const side of [-1, 1]) {
      const a = at(side * AISLE.stackBack), b = at(side * (AISLE.stackX - 0.45));
      g.addColorStop(Math.min(a, b), side < 0 ? dark : stone);
      g.addColorStop(Math.max(a, b), side < 0 ? stone : dark);
    }
    g.addColorStop(0, dark);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 8);
  });
  if (texture) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** How long one repeat of the runner's pattern is along the aisle, in metres. */
export const RUNNER_REPEAT = 2.4;

/**
 * The runner down the aisle, woven like a Ghardaia carpet: a deep green field, gold border lines with a band
 * of small triangles inside them, and a row of lozenge medallions down the middle. One tile is the runner's
 * full width and RUNNER_REPEAT long; it repeats along the aisle.
 */
export function runnerTexture() {
  const w = 256, h = 410;
  const texture = canvasTexture(w, h, (ctx) => {
    const gold = "#C9A867", cream = "#E9E2CC", dark = "#0A5230";
    ctx.fillStyle = "#0E6B3C";
    ctx.fillRect(0, 0, w, h);

    // The borders: a dark edge, a gold line, a band of teeth, a second gold line.
    for (const side of [0, 1]) {
      const x = (v: number) => (side === 0 ? v : w - v);
      ctx.fillStyle = dark;
      ctx.fillRect(Math.min(x(0), x(16)), 0, 16, h);
      ctx.fillStyle = gold;
      ctx.fillRect(Math.min(x(19), x(23)), 0, 4, h);
      ctx.fillRect(Math.min(x(44), x(46)), 0, 2, h);
      ctx.fillStyle = cream;
      const tooth = h / 12;
      for (let i = 0; i < 12; i++) {
        const y = i * tooth;
        ctx.beginPath();
        ctx.moveTo(x(27), y);
        ctx.lineTo(x(40), y + tooth / 2);
        ctx.lineTo(x(27), y + tooth);
        ctx.closePath();
        ctx.fill();
      }
    }

    // The field: one large lozenge per repeat, with a smaller one inside it, and a half lozenge at each end
    // so the pattern runs on without a seam.
    const cx = w / 2;
    const lozenge = (cy: number, rx: number, ry: number) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy - ry);
      ctx.lineTo(cx + rx, cy);
      ctx.lineTo(cx, cy + ry);
      ctx.lineTo(cx - rx, cy);
      ctx.closePath();
    };
    for (const cy of [0, h / 2, h]) {
      const big = cy === h / 2;
      lozenge(cy, big ? 66 : 40, big ? 120 : 72);
      ctx.strokeStyle = gold;
      ctx.lineWidth = 4;
      ctx.stroke();
      lozenge(cy, big ? 40 : 22, big ? 72 : 40);
      ctx.fillStyle = dark;
      ctx.fill();
      ctx.strokeStyle = cream;
      ctx.lineWidth = 2;
      ctx.stroke();
      lozenge(cy, big ? 12 : 7, big ? 22 : 13);
      ctx.fillStyle = gold;
      ctx.fill();
    }
  });
  if (!texture) return null;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/** The spine of a cloth-bound book: head and tail bands and a title block, lighter than the cloth they sit on. */
export function spineTexture() {
  const texture = canvasTexture(16, 128, (ctx) => {
    ctx.fillStyle = "#C9C9C9";
    ctx.fillRect(0, 0, 16, 128);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 9, 16, 3);
    ctx.fillRect(0, 15, 16, 1);
    ctx.fillRect(0, 112, 16, 1);
    ctx.fillRect(0, 116, 16, 3);
    ctx.fillStyle = "#F2E7C9";
    ctx.fillRect(3, 26, 10, 22);
  });
  if (texture) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A brass label plate for the end of a stack, lettered with one of the catalogue's subjects. */
export function labelTexture(name: string) {
  const texture = canvasTexture(640, 308, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 308);
    g.addColorStop(0, "#DCC48E");
    g.addColorStop(1, "#B08E50");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 640, 308);
    ctx.strokeStyle = "rgba(60,40,10,0.55)";
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 14, 612, 280);
    ctx.fillStyle = "#1E1A10";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = "rtl";
    // Two lines at most; long subject names are set smaller.
    const words = name.split(/\s+/);
    const lines: string[] = [];
    let size = 84;
    ctx.font = `700 ${size}px "Noto Naskh Arabic", "Source Serif 4", serif`;
    for (const word of words) {
      const last = lines[lines.length - 1];
      if (last && ctx.measureText(`${last} ${word}`).width < 570) lines[lines.length - 1] = `${last} ${word}`;
      else lines.push(word);
    }
    if (lines.length > 2) {
      size = 60;
      ctx.font = `700 ${size}px "Noto Naskh Arabic", "Source Serif 4", serif`;
    }
    const shown = lines.slice(0, 3);
    shown.forEach((line, i) => ctx.fillText(line, 320, 158 + (i - (shown.length - 1) / 2) * size * 1.2, 590));
  });
  if (texture) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export type BookInstance = {
  position: [number, number, number]; scale: [number, number, number]; tilt: number; color: string;
  /** Lightness offset, so two books of one colour are still two books (faded cloth, a newer binding). */
  shade: number;
};

/**
 * The books on both sides of every bay: five shelves, filled spine by spine with real cover colours, the odd
 * gap and the odd book leaning on its neighbour.
 */
export function shelfBooks(colors: string[]): BookInstance[] {
  const books: BookInstance[] = [];
  const palette = colors.length ? [...colors, ...SHELF_PALETTE] : SHELF_PALETTE;
  const bayLength = AISLE.spacing - AISLE.wall - 0.7;
  let n = 0;
  for (let bay = 0; bay < AISLE.arches - 1; bay++) {
    const zStart = -bay * AISLE.spacing - AISLE.wall / 2 - 0.35;
    for (const side of [-1, 1]) {
      for (let row = 0; row < 5; row++) {
        const y = 0.3 + row * 0.68;
        let z = zStart;
        while (z > zStart - bayLength) {
          n++;
          const width = 0.035 + hash(n, row, side) * 0.055;
          if (hash(n, 2, bay) < 0.025) { z -= 0.18; continue; }
          const height = 0.36 + hash(n, 4, row) * 0.2;
          const lean = hash(n, 6, side) < 0.03 ? 0.18 * side : 0;
          books.push({
            position: [side * AISLE.stackX, y + height / 2, z - width / 2],
            scale: [0.3, height, width],
            tilt: lean,
            color: palette[Math.floor(hash(n, 8, bay) * palette.length)],
            shade: (hash(n, 9, row) - 0.5) * 0.12,
          });
          z -= width + 0.004;
        }
      }
    }
  }
  return books;
}

/**
 * Where the camera stands for a scroll progress between 0 and 1: one stop per landing section, each the
 * stand-off distance in front of that section's arch, so the arch frames the plaque.
 */
export function cameraZ(progress: number) {
  return AISLE.standOff - progress * AISLE.spacing * (AISLE.sections - 1);
}
