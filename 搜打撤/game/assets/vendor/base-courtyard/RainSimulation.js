/* MIT Copyright (c) 2026 Ruben Vieira. Source: rubenvieira/rain-simulator @ 2f3390cd4ccb4e898856dea4ddb8c6d635a90553.
 * TypeScript types removed with the existing project esbuild; no upstream scripts executed. See rain-LICENSE.txt and SOURCE.md. */
class SimplexNoise {
  grad3 = [
    [1, 1, 0],
    [-1, 1, 0],
    [1, -1, 0],
    [-1, -1, 0],
    [1, 0, 1],
    [-1, 0, 1],
    [1, 0, -1],
    [-1, 0, -1],
    [0, 1, 1],
    [0, -1, 1],
    [0, 1, -1],
    [0, -1, -1]
  ];
  p = [];
  perm = [];
  constructor(seed = Math.random()) {
    let state = Math.floor(seed * 4294967296) >>> 0;
    for (let i = 0; i < 256; i++) this.p[i] = i;
    for (let i = 255; i > 0; i--) {
      state = Math.imul(state, 1664525) + 1013904223 >>> 0;
      const j = state % (i + 1);
      [this.p[i], this.p[j]] = [this.p[j], this.p[i]];
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
    }
  }
  noise2D(x, y) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const dot = (g, x3, y3) => g[0] * x3 + g[1] * y3;
    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * dot(this.grad3[this.perm[ii + this.perm[jj]] % 12], x0, y0);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * dot(this.grad3[this.perm[ii + i1 + this.perm[jj + j1]] % 12], x1, y1);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * dot(this.grad3[this.perm[ii + 1 + this.perm[jj + 1]] % 12], x2, y2);
    }
    return 70 * (n0 + n1 + n2);
  }
}
class RivuletMap {
  data;
  // wetness strength
  dirX;
  // average flow direction X
  dirY;
  // average flow direction Y
  cols;
  rows;
  cellSize;
  constructor(width, height, cellSize = 8) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    const len = this.cols * this.rows;
    this.data = new Float32Array(len);
    this.dirX = new Float32Array(len);
    this.dirY = new Float32Array(len);
  }
  resize(width, height) {
    const newCols = Math.ceil(width / this.cellSize);
    const newRows = Math.ceil(height / this.cellSize);
    if (newCols !== this.cols || newRows !== this.rows) {
      this.cols = newCols;
      this.rows = newRows;
      const len = newCols * newRows;
      this.data = new Float32Array(len);
      this.dirX = new Float32Array(len);
      this.dirY = new Float32Array(len);
    }
  }
  deposit(x, y, strength, flowDirX, flowDirY) {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    const idx = row * this.cols + col;
    this.data[idx] = Math.min(1, this.data[idx] + strength);
    this.dirX[idx] = this.dirX[idx] * 0.8 + flowDirX * 0.2;
    this.dirY[idx] = this.dirY[idx] * 0.8 + flowDirY * 0.2;
  }
  query(x, y, radius) {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    const r = Math.ceil(radius / this.cellSize);
    let totalForceX = 0;
    let totalForceY = 0;
    let totalStrength = 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const c = col + dx;
        const rr = row + dy;
        if (c < 0 || c >= this.cols || rr < 0 || rr >= this.rows) continue;
        const idx = rr * this.cols + c;
        const s = this.data[idx];
        if (s < 0.01) continue;
        const wx = c * this.cellSize + this.cellSize / 2 - x;
        const wy = rr * this.cellSize + this.cellSize / 2 - y;
        const dist = Math.sqrt(wx * wx + wy * wy) + 0.1;
        const weight = s / dist;
        totalForceX += wx / dist * weight;
        totalForceY += wy / dist * weight;
        totalStrength += s;
      }
    }
    return { forceX: totalForceX, forceY: totalForceY, strength: totalStrength };
  }
  // Get raw data for rendering
  getData() {
    return this.data;
  }
  decay(deltaTime) {
    const factor = 1 - 3e-4 * deltaTime;
    for (let i = 0; i < this.data.length; i++) {
      this.data[i] *= factor;
      if (this.data[i] < 5e-3) this.data[i] = 0;
    }
  }
  clear() {
    this.data.fill(0);
    this.dirX.fill(0);
    this.dirY.fill(0);
  }
}
class TrailBead {
  x;
  y;
  vx;
  vy;
  radius;
  opacity;
  age;
  maxAge;
  constructor(x, y, radius, persistence) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = radius;
    this.opacity = 0.6;
    this.age = 0;
    this.maxAge = 500 + persistence * 50;
  }
  update(deltaTime, rivuletMap, enableAttraction) {
    this.age += deltaTime;
    this.opacity = Math.max(0, 0.6 * (1 - this.age / this.maxAge));
    const dt = deltaTime / 16.67;
    this.vy += 2e-3 * dt;
    if (enableAttraction && rivuletMap) {
      const q = rivuletMap.query(this.x, this.y, 16);
      if (q.strength > 0.1) {
        this.vx += q.forceX * 5e-4 * dt;
        this.vy += q.forceY * 3e-4 * dt;
      }
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.98;
    this.vy *= 0.98;
    this.radius *= 0.9995;
    return this.age < this.maxAge && this.radius > 0.5;
  }
}
class Droplet {
  x;
  y;
  vx;
  vy;
  mass;
  baseRadius;
  // Shape deformation
  stretchX = 1;
  stretchY = 1;
  // Damped oscillation from merges
  oscillationAmplitude = 0;
  oscillationPhase = 0;
  // Energy-based surface tension
  isStuck;
  stickForce;
  stickEnergy = 0;
  stickThreshold;
  contactAngle;
  // Visual properties
  opacity = 0;
  // Trail generation
  lastTrailX;
  lastTrailY;
  distanceSinceTrail = 0;
  // Merge tracking for directional splash
  lastMergeAngle = 0;
  lastMergeEnergy = 0;
  constructor(x, y, mass, settings) {
    this.x = x;
    this.y = y;
    this.mass = mass;
    this.baseRadius = this.calculateRadius(mass);
    const windRad = settings.windAngle * Math.PI / 180;
    const windInfluence = settings.windSpeed / 100;
    this.vx = Math.sin(windRad) * windInfluence * 0.5;
    this.vy = 0.1;
    this.stickForce = 0.3 + settings.surfaceTension / 10 * 0.7;
    this.stickThreshold = this.stickForce * (1 + 1 / (mass * 0.2 + 1));
    this.contactAngle = 40 + Math.random() * 30;
    this.isStuck = mass < 15 || Math.random() < this.stickForce * 0.5;
    this.lastTrailX = x;
    this.lastTrailY = y;
  }
  calculateRadius(mass) {
    return Math.pow(mass, 0.4) * 2.5;
  }
  get radius() {
    return this.baseRadius * Math.max(this.stretchX, this.stretchY);
  }
  update(deltaTime, settings, windNoise, canvasHeight, createTrailBead, rivuletMap, enableRivuletAttraction) {
    const dt = deltaTime / 16.67;
    if (this.opacity < 1) {
      this.opacity = Math.min(1, this.opacity + 0.1 * dt);
    }
    if (this.oscillationAmplitude > 1e-3) {
      this.oscillationPhase += dt * 0.5;
      this.oscillationAmplitude *= Math.pow(0.92, dt);
      const osc = Math.sin(this.oscillationPhase * 8) * this.oscillationAmplitude;
      this.stretchX = 1 + osc;
      this.stretchY = 1 - osc;
    }
    const gravity = 0.015 * (settings.gravity / 5) * this.mass * 0.1;
    const windRad = settings.windAngle * Math.PI / 180;
    const windStrength = settings.windSpeed / 100 * (0.7 + windNoise * 0.6);
    const windForceX = Math.sin(windRad) * windStrength * 0.02;
    const windForceY = Math.cos(windRad) * windStrength * 5e-3;
    const totalVelocity = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const resistanceForce = this.stickForce * 0.1 / (this.mass * 0.1 + 1);
    if (this.isStuck) {
      const appliedForce = gravity + Math.abs(windForceY) + Math.abs(windForceX);
      this.stickEnergy += appliedForce * dt;
      this.stickEnergy -= this.stickThreshold * 0.02 * dt;
      this.stickEnergy = Math.max(0, this.stickEnergy);
      if (this.stickEnergy > this.stickThreshold) {
        this.isStuck = false;
        this.stickEnergy = 0;
      } else {
        this.x += (Math.random() - 0.5) * 0.1 * dt;
        this.y += gravity * 0.1 * dt;
        return this.y < canvasHeight + this.radius;
      }
    }
    this.vy += (gravity - resistanceForce * this.vy) * dt;
    this.vx += (windForceX - resistanceForce * this.vx) * dt;
    if (enableRivuletAttraction && rivuletMap) {
      const q = rivuletMap.query(this.x, this.y, this.baseRadius * 2);
      if (q.strength > 0.1) {
        this.vx += q.forceX * 1e-3 * dt;
        this.vy += q.forceY * 5e-4 * dt;
      }
    }
    this.vx += (Math.random() - 0.5) * 0.02 * dt;
    if (totalVelocity < 0.3 && Math.random() < 0.01 * this.stickForce) {
      this.isStuck = true;
      this.stickThreshold *= 0.7;
      this.stickThreshold = Math.max(0.05, this.stickThreshold);
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (rivuletMap && totalVelocity > 0.2) {
      const norm = totalVelocity + 0.01;
      rivuletMap.deposit(
        this.x,
        this.y,
        Math.min(0.15, totalVelocity * 0.03),
        this.vx / norm,
        this.vy / norm
      );
    }
    if (this.oscillationAmplitude <= 1e-3) {
      const speed2 = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      const targetStretchY = 1 + Math.min(speed2 * 0.3, 0.5);
      const targetStretchX = 1 / Math.sqrt(targetStretchY);
      this.stretchY += (targetStretchY - this.stretchY) * 0.1 * dt;
      this.stretchX += (targetStretchX - this.stretchX) * 0.1 * dt;
    }
    const distMoved = Math.sqrt(
      Math.pow(this.x - this.lastTrailX, 2) + Math.pow(this.y - this.lastTrailY, 2)
    );
    this.distanceSinceTrail += distMoved;
    this.lastTrailX = this.x;
    this.lastTrailY = this.y;
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const trailInterval = Math.max(5, 20 - speed * 5);
    if (this.distanceSinceTrail > trailInterval && speed > 0.5 && this.mass > 8) {
      const trailRadius = this.baseRadius * (0.15 + Math.random() * 0.2);
      const trailX = this.x + (Math.random() - 0.5) * this.baseRadius * 0.3;
      const trailY = this.y - this.baseRadius * this.stretchY * 0.5;
      createTrailBead(trailX, trailY, trailRadius);
      this.mass = Math.max(5, this.mass - trailRadius * 0.5);
      this.baseRadius = this.calculateRadius(this.mass);
      this.distanceSinceTrail = 0;
    }
    return this.y < canvasHeight + this.radius * 2;
  }
  collidesWith(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = (this.radius + other.radius) * 0.7;
    return dist < minDist;
  }
  merge(other) {
    const totalMass = this.mass + other.mass;
    const relVx = this.vx - other.vx;
    const relVy = this.vy - other.vy;
    const relSpeed = Math.sqrt(relVx * relVx + relVy * relVy);
    const massRatio = Math.min(this.mass, other.mass) / Math.max(this.mass, other.mass);
    this.lastMergeEnergy = relSpeed * massRatio + totalMass / 50;
    this.lastMergeAngle = Math.atan2(other.y - this.y, other.x - this.x);
    this.x = (this.x * this.mass + other.x * other.mass) / totalMass;
    this.y = (this.y * this.mass + other.y * other.mass) / totalMass;
    this.vx = (this.vx * this.mass + other.vx * other.mass) / totalMass;
    this.vy = (this.vy * this.mass + other.vy * other.mass) / totalMass;
    this.mass = totalMass;
    this.baseRadius = this.calculateRadius(this.mass);
    if (other.vy > 0.2 || this.mass > 20) {
      this.isStuck = false;
    }
    this.oscillationAmplitude = Math.min(0.3, this.lastMergeEnergy * 0.08);
    this.oscillationPhase = 0;
  }
  absorbBead(bead) {
    const beadMass = bead.radius * 0.5;
    this.mass += beadMass;
    this.baseRadius = this.calculateRadius(this.mass);
  }
}
class RainSimulation {
  droplets = [];
  trailBeads = [];
  noise;
  gustNoise;
  time = 0;
  canvasWidth = 0;
  canvasHeight = 0;
  maxDroplets = 500;
  rivuletMap;
  enableRivuletAttraction;
  rivuletCellSize;
  // Gust intensity modulation
  intensityMod = 1;
  constructor(maxDroplets = 500, rivuletCellSize = 8, enableRivuletAttraction = true) {
    this.noise = new SimplexNoise();
    this.gustNoise = new SimplexNoise(Math.random());
    this.maxDroplets = maxDroplets;
    this.rivuletCellSize = rivuletCellSize;
    this.enableRivuletAttraction = enableRivuletAttraction;
    this.rivuletMap = new RivuletMap(1, 1, rivuletCellSize);
  }
  resize(width, height) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.rivuletMap.resize(width, height);
  }
  getDroplets() {
    return this.droplets;
  }
  getTrailBeads() {
    return this.trailBeads;
  }
  spawnDroplet(settings) {
    const windRad = settings.windAngle * Math.PI / 180;
    const windOffset = Math.sin(windRad) * (settings.windSpeed / 100) * 100;
    const x = Math.random() * this.canvasWidth - windOffset;
    const y = -10 - Math.random() * 50;
    const massBase = 5 + settings.dropletSize * 2;
    const mass = massBase + Math.pow(Math.random(), 3) * massBase * 4;
    this.droplets.push(new Droplet(x, y, mass, settings));
  }
  createTrailBead = (x, y, radius) => {
    this.trailBeads.push(new TrailBead(x, y, radius, 50));
  };
  update(deltaTime, settings) {
    this.time += deltaTime * 1e-3;
    const gustiness = (settings.gustiness ?? 50) / 100;
    if (gustiness > 0) {
      const n1 = this.gustNoise.noise2D(this.time * 0.03, 0);
      const n2 = this.gustNoise.noise2D(this.time * 0.2, 5);
      this.intensityMod = 0.3 + 0.7 * ((n1 * 0.7 + n2 * 0.3) * gustiness * 0.5 + 0.5);
    } else {
      this.intensityMod = 1;
    }
    const spawnRate = settings.intensity / 100 * 0.3 * this.intensityMod;
    const spawnCount = Math.floor(spawnRate * (deltaTime / 16.67));
    for (let i = 0; i < spawnCount + (Math.random() < spawnRate ? 1 : 0); i++) {
      if (this.droplets.length < this.maxDroplets) {
        this.spawnDroplet(settings);
      }
    }
    const windNoise = this.noise.noise2D(this.time * 0.5, 0);
    this.rivuletMap.decay(deltaTime);
    for (let i = this.trailBeads.length - 1; i >= 0; i--) {
      if (!this.trailBeads[i].update(deltaTime, this.rivuletMap, this.enableRivuletAttraction)) {
        this.trailBeads.splice(i, 1);
      }
    }
    for (let i = this.trailBeads.length - 1; i >= 0; i--) {
      const a = this.trailBeads[i];
      for (let j = i - 1; j >= 0; j--) {
        const b = this.trailBeads[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < a.radius + b.radius) {
          const totalArea = a.radius * a.radius + b.radius * b.radius;
          a.radius = Math.sqrt(totalArea);
          a.x = (a.x + b.x) / 2;
          a.y = (a.y + b.y) / 2;
          a.vx = (a.vx + b.vx) / 2;
          a.vy = (a.vy + b.vy) / 2;
          this.trailBeads.splice(j, 1);
          i--;
          break;
        }
      }
    }
    for (let i = this.droplets.length - 1; i >= 0; i--) {
      const droplet = this.droplets[i];
      if (!droplet.update(deltaTime, settings, windNoise, this.canvasHeight, this.createTrailBead, this.rivuletMap, this.enableRivuletAttraction)) {
        this.droplets.splice(i, 1);
        continue;
      }
      for (let j = this.trailBeads.length - 1; j >= 0; j--) {
        const bead = this.trailBeads[j];
        const dx = droplet.x - bead.x;
        const dy = droplet.y - bead.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < droplet.radius + bead.radius) {
          droplet.absorbBead(bead);
          this.trailBeads.splice(j, 1);
        }
      }
      for (let j = i - 1; j >= 0; j--) {
        const other = this.droplets[j];
        if (droplet.collidesWith(other)) {
          if (droplet.mass > other.mass) {
            droplet.merge(other);
            this.droplets.splice(j, 1);
            i--;
          } else {
            other.merge(droplet);
            this.droplets.splice(i, 1);
          }
          break;
        }
      }
    }
  }
  reset() {
    this.droplets = [];
    this.trailBeads = [];
    this.time = 0;
    this.rivuletMap.clear();
  }
  populate(settings) {
    const count = Math.floor(settings.intensity / 100 * 50);
    for (let i = 0; i < count; i++) {
      const x = Math.random() * this.canvasWidth;
      const y = Math.random() * this.canvasHeight;
      const massBase = 5 + settings.dropletSize * 2;
      const mass = massBase + Math.pow(Math.random(), 2) * massBase * 2;
      const droplet = new Droplet(x, y, mass, settings);
      droplet.opacity = 1;
      droplet.isStuck = Math.random() < 0.7;
      this.droplets.push(droplet);
    }
  }
}
var stdin_default = RainSimulation;
export {
  Droplet,
  RainSimulation,
  RivuletMap,
  SimplexNoise,
  TrailBead,
  stdin_default as default
};
