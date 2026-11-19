/* Neon Coast Cover Studio — cover rendering engine.
   Draws the multi-panel poster, gradient-map colour grades, halftone
   title block, grain and vignette onto any canvas, at any size. */

const COVER_GRADES = {
  "sunset": {
    label: "Sunset",
    accent: "#ffb347",
    stops: [[0, [26, 11, 46]], [0.35, [123, 45, 139]], [0.6, [232, 83, 63]], [0.8, [255, 179, 71]], [1, [255, 243, 196]]]
  },
  "neon": {
    label: "Neon",
    accent: "#7df9ff",
    stops: [[0, [5, 5, 16]], [0.3, [13, 43, 107]], [0.55, [181, 55, 242]], [0.8, [255, 46, 136]], [1, [125, 249, 255]]]
  },
  "vice": {
    label: "Vice",
    accent: "#ff006e",
    stops: [[0, [11, 16, 53]], [0.35, [131, 56, 236]], [0.6, [255, 0, 110]], [0.85, [255, 190, 11]], [1, [255, 255, 255]]]
  },
  "heat": {
    label: "Heat",
    accent: "#f97316",
    stops: [[0, [18, 2, 2]], [0.4, [127, 29, 29]], [0.65, [220, 38, 38]], [0.85, [249, 115, 22]], [1, [253, 230, 138]]]
  },
  "teal-gold": {
    label: "Teal & gold",
    accent: "#fbbf24",
    stops: [[0, [2, 24, 27]], [0.35, [15, 118, 110]], [0.6, [217, 119, 6]], [0.85, [251, 191, 36]], [1, [254, 243, 199]]]
  },
  "noir": {
    label: "Noir",
    accent: "#e5e5e5",
    stops: [[0, [0, 0, 0]], [0.25, [38, 38, 44]], [0.5, [110, 110, 118]], [0.75, [190, 190, 198]], [1, [255, 255, 255]]]
  },
  "candy": {
    label: "Candy",
    accent: "#f472b6",
    stops: [[0, [30, 27, 75]], [0.35, [219, 39, 119]], [0.6, [244, 114, 182]], [0.85, [253, 230, 138]], [1, [255, 255, 255]]]
  }
};

const COVER_LAYOUTS = ["grid4", "grid6", "grid9", "hero", "full", "tilted"];

function layoutPanelCount(layout) {
  if (layout === "grid4") return 4;
  if (layout === "grid6") return 6;
  if (layout === "grid9") return 9;
  if (layout === "hero") return 4;
  if (layout === "full") return 1;
  if (layout === "tilted") return 3;
  return 4;
}

/* Geometry of the panels inside the photo area. Title band height is
   returned too so the caller can place the caption. */
function coverGeometry(layout, W, H) {
  const titleH = layout === "full" ? 0 : Math.round(H * (H > W ? 0.13 : 0.17));
  const area = { x: 0, y: 0, w: W, h: H - titleH };
  const g = Math.max(4, Math.round(W * 0.012));
  const panels = [];
  const grid = (cols, rows) => {
    const cw = (area.w - g * (cols + 1)) / cols;
    const ch = (area.h - g * (rows + 1)) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        panels.push({ x: area.x + g + c * (cw + g), y: area.y + g + r * (ch + g), w: cw, h: ch, rot: 0 });
      }
    }
  };
  if (layout === "grid4") grid(2, 2);
  else if (layout === "grid6") grid(3, 2);
  else if (layout === "grid9") grid(3, 3);
  else if (layout === "hero") {
    const heroW = Math.round(area.w * 0.62);
    panels.push({ x: area.x + g, y: area.y + g, w: heroW - g, h: area.h - 2 * g, rot: 0 });
    const sideX = area.x + heroW + g;
    const sideW = area.w - heroW - 2 * g;
    const sh = (area.h - 4 * g) / 3;
    for (let i = 0; i < 3; i++) {
      panels.push({ x: sideX, y: area.y + g + i * (sh + g), w: sideW, h: sh, rot: 0 });
    }
  } else if (layout === "full") {
    panels.push({ x: 0, y: 0, w: W, h: H, rot: 0 });
  } else if (layout === "tilted") {
    const pw = W * 0.58;
    const ph = area.h * 0.56;
    panels.push({ x: W * 0.06, y: area.h * 0.05, w: pw, h: ph, rot: -0.11 });
    panels.push({ x: W * 0.36, y: area.h * 0.24, w: pw, h: ph, rot: 0.07 });
    panels.push({ x: W * 0.10, y: area.h * 0.44, w: pw * 0.9, h: ph * 0.86, rot: -0.04 });
  }
  return { titleH, panels };
}

function buildGradeLut(gradeName) {
  const grade = COVER_GRADES[gradeName] || COVER_GRADES.sunset;
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = grade.stops[0];
    let b = grade.stops[grade.stops.length - 1];
    for (let s = 0; s < grade.stops.length - 1; s++) {
      if (t >= grade.stops[s][0] && t <= grade.stops[s + 1][0]) { a = grade.stops[s]; b = grade.stops[s + 1]; break; }
    }
    const span = (b[0] - a[0]) || 1;
    const f = Math.min(1, Math.max(0, (t - a[0]) / span));
    for (let ch = 0; ch < 3; ch++) {
      lut[i * 3 + ch] = Math.round(a[1][ch] + (b[1][ch] - a[1][ch]) * f);
    }
  }
  return lut;
}

function applyGradeToRegion(ctx, x, y, w, h, gradeName, mix) {
  if (w <= 0 || h <= 0) return;
  const lut = buildGradeLut(gradeName);
  const img = ctx.getImageData(x, y, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]);
    const li = lum * 3;
    d[i] = Math.round(lut[li] * mix + d[i] * (1 - mix));
    d[i + 1] = Math.round(lut[li + 1] * mix + d[i + 1] * (1 - mix));
    d[i + 2] = Math.round(lut[li + 2] * mix + d[i + 2] * (1 - mix));
  }
  ctx.putImageData(img, x, y);
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawPanelPhoto(ctx, img, rect, panel, frame) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rect.rot || 0);
  ctx.translate(-cx, -cy);
  if (frame) {
    const pad = Math.max(6, rect.w * 0.025);
    ctx.fillStyle = "#fdf8ef";
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = Math.max(8, rect.w * 0.03);
    ctx.shadowOffsetY = Math.max(4, rect.w * 0.01);
    ctx.fillRect(rect.x - pad, rect.y - pad, rect.w + pad * 2, rect.h + pad * 2);
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  }
  roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, Math.max(2, rect.w * 0.012));
  ctx.clip();
  const base = Math.max(rect.w / img.naturalWidth, rect.h / img.naturalHeight);
  const scale = base * (panel.zoom || 1);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = cx - dw / 2 + (panel.ox || 0) * rect.w;
  const dy = cy - dh / 2 + (panel.oy || 0) * rect.h;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function drawStar(ctx, cx, cy, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

let grainTile = null;
function makeGrainTile() {
  if (grainTile) return grainTile;
  const c = document.createElement("canvas");
  c.width = 160; c.height = 160;
  const g = c.getContext("2d");
  const img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  grainTile = c;
  return c;
}

function drawTitleBlock(ctx, W, H, titleH, state, grade) {
  const y0 = H - titleH;
  const band = ctx.createLinearGradient(0, y0, 0, H);
  band.addColorStop(0, "#160522");
  band.addColorStop(1, "#2b0a33");
  ctx.fillStyle = band;
  ctx.fillRect(0, y0, W, titleH);
  // Halftone dot field fading across the band.
  const step = Math.max(10, Math.round(W / 78));
  ctx.fillStyle = grade.accent;
  for (let yy = y0 + step * 0.7; yy < H - step * 0.3; yy += step) {
    for (let xx = step * 0.6; xx < W; xx += step) {
      const fade = 1 - xx / W;
      const r = Math.max(0.6, step * 0.22 * fade + Math.sin(xx * 0.01 + yy * 0.02) * 0.8);
      ctx.globalAlpha = 0.16 + 0.3 * fade;
      ctx.beginPath();
      ctx.arc(xx, yy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // Accent rule above the band.
  ctx.fillStyle = grade.accent;
  ctx.fillRect(0, y0, W, Math.max(3, H * 0.004));
  // Title: Anton, white with a hard outline, fitted to the band.
  const title = (state.title || "").toUpperCase();
  let size = titleH * 0.52;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const fitTitle = () => {
    ctx.font = size + "px Anton, sans-serif";
    try { ctx.letterSpacing = Math.round(size * 0.04) + "px"; } catch (e) { /* older canvas */ }
    return ctx.measureText(title).width;
  };
  while (size > titleH * 0.2 && fitTitle() > W * 0.84) size -= 2;
  fitTitle();
  const tx = W * 0.045;
  const ty = y0 + titleH * (state.subtitle ? 0.36 : 0.52);
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#12041c";
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.strokeText(title, tx, ty);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(title, tx, ty);
  try { ctx.letterSpacing = "0px"; } catch (e) { /* older canvas */ }
  // Subtitle in Pacifico, accent colour.
  if (state.subtitle) {
    const subSize = Math.max(12, titleH * 0.26);
    ctx.font = subSize + "px Pacifico, cursive";
    ctx.fillStyle = grade.accent;
    ctx.fillText(state.subtitle, tx, y0 + titleH * 0.78);
  }
  // Five-star heat meter, top right of the band.
  if (state.stars) {
    const sr = Math.max(7, titleH * 0.11);
    const gap = sr * 2.4;
    const total = gap * 4;
    let sx = W - W * 0.045 - total;
    const sy = y0 + titleH * 0.26;
    for (let i = 0; i < 5; i++) {
      drawStar(ctx, sx + sr, sy, sr, "#ffc93c");
      sx += gap;
    }
  }
}

function drawRibbonBadge(ctx, W, H, grade) {
  const text = "ORIGINAL COVER  •  EST. 2026";
  const size = Math.max(11, Math.round(W * 0.016));
  ctx.save();
  ctx.translate(W * 0.02, H * 0.055);
  ctx.rotate(-0.06);
  ctx.font = size + "px 'Bebas Neue', sans-serif";
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = grade.accent;
  ctx.fillRect(0, 0, tw + size * 1.6, size * 1.9);
  ctx.fillStyle = "#160522";
  ctx.textBaseline = "middle";
  ctx.fillText(text, size * 0.8, size * 0.98);
  ctx.restore();
}

/* Render the whole cover onto ctx (already sized W x H).
   photos: array of { img } (HTMLImageElement, loaded).
   opts: { selected: panel index or -1, forExport: bool } */
function renderCover(ctx, W, H, state, photos, opts) {
  opts = opts || {};
  const grade = COVER_GRADES[state.grade] || COVER_GRADES.sunset;
  const geo = coverGeometry(state.layout, W, H);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#0d0714";
  ctx.fillRect(0, 0, W, H);

  // Photo layer: panels first, grade second.
  const layer = document.createElement("canvas");
  layer.width = W; layer.height = H;
  const lctx = layer.getContext("2d", { willReadFrequently: true });
  lctx.fillStyle = "#1a0b26";
  lctx.fillRect(0, 0, W, H);
  const panels = state.panels || [];
  geo.panels.forEach((rect, i) => {
    const panel = panels[i] || { photo: 0, ox: 0, oy: 0, zoom: 1 };
    const photo = photos[panel.photo] || photos[0];
    if (photo && photo.img && photo.img.naturalWidth > 0) {
      drawPanelPhoto(lctx, photo.img, rect, panel, state.layout === "tilted");
    } else {
      lctx.fillStyle = "#241133";
      lctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
  });
  const gradeH = state.layout === "full" ? H : H - geo.titleH;
  applyGradeToRegion(lctx, 0, 0, W, gradeH, state.grade, 0.82);
  ctx.drawImage(layer, 0, 0);

  // Title block (full-bleed gets a scrim + caption over the photo).
  if (state.layout === "full") {
    const scrim = ctx.createLinearGradient(0, H * 0.62, 0, H);
    scrim.addColorStop(0, "rgba(10,3,18,0)");
    scrim.addColorStop(1, "rgba(10,3,18,0.88)");
    ctx.fillStyle = scrim;
    ctx.fillRect(0, H * 0.62, W, H * 0.38);
    const fakeState = Object.assign({}, state);
    const bandH = Math.round(H * 0.17);
    drawTitleBlock(ctx, W, H, bandH, fakeState, grade);
    // drawTitleBlock paints its own band background; clear it back to the
    // scrim by repainting the photo under the band is skipped — the band
    // itself is the poster's caption block, which reads fine over full-bleed.
  } else {
    drawTitleBlock(ctx, W, H, geo.titleH, state, grade);
  }

  if (state.badge) drawRibbonBadge(ctx, W, H, grade);

  if (state.grain) {
    const tile = makeGrainTile();
    const pat = ctx.createPattern(tile, "repeat");
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (state.vignette) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.38)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  // Editor-only selection outline.
  if (!opts.forExport && opts.selected >= 0 && geo.panels[opts.selected]) {
    const r = geo.panels[opts.selected];
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.rotate(r.rot || 0);
    ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
    ctx.strokeStyle = "#7df9ff";
    ctx.lineWidth = Math.max(3, W * 0.004);
    ctx.setLineDash([Math.max(8, W * 0.012), Math.max(6, W * 0.008)]);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }
  return geo;
}

/* Render to a fresh canvas at export size and return it. */
function exportCoverCanvas(state, photos, w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  renderCover(ctx, w, h, state, photos, { forExport: true });
  return c;
}
