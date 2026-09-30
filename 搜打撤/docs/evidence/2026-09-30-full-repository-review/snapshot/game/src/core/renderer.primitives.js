const TAU = Math.PI * 2;

function drawCover(ctx, image, width, height) {
  const mediaWidth = image.naturalWidth;
  const mediaHeight = image.naturalHeight;
  if (!image.complete || !mediaWidth) return;
  const scale = Math.max(width / mediaWidth, height / mediaHeight);
  const drawWidth = mediaWidth * scale;
  const drawHeight = mediaHeight * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
}

function hash2(x, y) {
  let value = (x * 374761393 + y * 668265263) >>> 0;
  value = ((value ^ (value >>> 13)) * 1274126177) >>> 0;
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

function shade(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((value >> 16) & 255) + 255 * amount)));
  const g = Math.max(0, Math.min(255, Math.round(((value >> 8) & 255) + 255 * amount)));
  const b = Math.max(0, Math.min(255, Math.round((value & 255) + 255 * amount)));
  return `rgb(${r},${g},${b})`;
}

function mixHex(a, b, ratio) {
  const left = parseInt(a.slice(1), 16);
  const right = parseInt(b.slice(1), 16);
  const channel = shift => Math.round(((left >> shift) & 255) + (((right >> shift) & 255) - ((left >> shift) & 255)) * ratio);
  return '#' + ((1 << 24) + (channel(16) << 16) + (channel(8) << 8) + channel(0)).toString(16).slice(1);
}

function font(camera, size) {
  return `bold ${size / camera.zoom}px "HarmonyOS Sans SC","HarmonyOS Sans","Noto Sans SC Sub","Microsoft YaHei",sans-serif`;
}

function circle(ctx, x, y, radius) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
}

function rrect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function fillStroke(ctx, fill, stroke, lineWidth) {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export { circle, drawCover, fillStroke, font, hash2, mixHex, rrect, shade };
