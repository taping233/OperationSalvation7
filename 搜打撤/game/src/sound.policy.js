const SFX_COOLDOWN_MS = Object.freeze({ click: 28, hover: 55, scene: 110 });

function shouldPlaySfx(name, now, lastAt = new Map()) {
  const cooldown = SFX_COOLDOWN_MS[name] || 0;
  const previous = lastAt.get(name);
  if (cooldown && previous != null && now - previous < cooldown) return false;
  if (cooldown) lastAt.set(name, now);
  return true;
}

export { SFX_COOLDOWN_MS, shouldPlaySfx };
