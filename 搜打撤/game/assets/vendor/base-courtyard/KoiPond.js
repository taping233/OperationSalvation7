/* MIT Copyright (c) 2026 Rezaye Rabbi (RzX).
 * Adapted from rzrabbi/interactive-koi-pond @ d8e2b1527630dfb4cccf646c0d8266cd95e2bb4f.
 * Global wallpaper bridges, event listeners and animation loop removed; engine state is per canvas.
 * See koi-LICENSE.txt and SOURCE.md. */
export function createKoiPond(canvas) {
  const ctx = canvas.getContext('2d');
  const config = { fishCount: 9, waterHue: 195, fishSpeed: 1.2, enableCaustics: true, enableFeeding: true, shyFish: false, fishTheme: 0, fishSize: 1.05, rippleStrength: 1 };
  const FOOD_DETECT_RADIUS_SQ = 90000, EAT_RADIUS_SQ = 400, FEAR_RADIUS_SQ = 40000;
  let width = canvas.width, height = canvas.height;
  const kois = [], foods = [], ripples = [];
  let causticTime = 0;
  const mouse = { x: 0, y: 0, active: false };
function distanceSq(a, b) {
    let dx = a.x - b.x;
    let dy = a.y - b.y;
    return dx * dx + dy * dy;
}

const FISH_BASE_SIZES = [12, 14, 15, 14, 12, 9, 6, 4, 3, 2, 1, 1];

class Ripple {
    constructor(x, y, power) {
        this.x = x;
        this.y = y;
        this.radius = 1;
        this.power = power;
        this.maxRadius = power * 100;
        this.life = 1;
    }
    update(dt) {
        let dtMult = dt * 60;
        this.radius += 1 * this.power * dtMult;
        this.life -= 0.01 * dtMult;
    }
    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${this.life * 0.3})`;
        ctx.lineWidth = 2 * this.life;
        ctx.stroke();
    }
}

class Food {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 3;
        this.life = 1000;
    }
    update(dt) {
        let dtMult = dt * 60;
        this.life -= 1 * dtMult;
    }
    draw(ctx) {
        ctx.shadowBlur = 5;
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#f4a460';
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Koi {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 1;
        this.vy = (Math.random() - 0.5) * 1;
        this.baseSpeed = 0.4 + Math.random() * 0.4;
        this.maxForce = 0.03;
        
        this.updateColorTheme();
        this.spotColor = Math.random() > 0.5 ? '#222' : '#fff'; 
        
        this.segments = [];
        this.numSegments = 12;
        for (let i = 0; i < this.numSegments; i++) {
            this.segments.push({ x: this.x, y: this.y });
        }
        this.angle = Math.atan2(this.vy, this.vx);
        this.swimCycle = Math.random() * Math.PI * 2;
        this.fedTimer = 0;
    }

    updateColorTheme() {
        let colors;
        if (config.fishTheme === 0) {
            colors = ['#d87546', '#e8e5d9', '#c5a96c', '#b85245'];
        } else if (config.fishTheme === 1) {
            colors = ['#00ffcc', '#ff00ff', '#ccff00', '#00ccff'];
        } else {
            colors = ['#ffffff', '#cccccc', '#999999', '#666666'];
        }
        this.color = colors[Math.floor(Math.random() * colors.length)];
    }

    update(dt) {
        let dtMult = dt * 60;
        if (this.fedTimer > 0) this.fedTimer -= dtMult;

        let target = null;
        let minDistSq = Infinity;
        for (let i = 0; i < foods.length; i++) {
            let dSq = distanceSq(this, foods[i]);
            if (dSq < minDistSq) {
                minDistSq = dSq;
                target = foods[i];
            }
        }

        let ax = 0, ay = 0;
        let effectiveBaseSpeed = this.baseSpeed * config.fishSpeed;
        let avoidForceApplied = false;

        if (target && minDistSq < FOOD_DETECT_RADIUS_SQ) {
            let truedirX = target.x - this.x;
            let truedirY = target.y - this.y;
            let dirLen = Math.sqrt(truedirX * truedirX + truedirY * truedirY);
            if (dirLen > 0) {
                let desiredX = (truedirX / dirLen) * effectiveBaseSpeed * 2;
                let desiredY = (truedirY / dirLen) * effectiveBaseSpeed * 2;
                
                ax = (desiredX - this.vx) * this.maxForce * 2;
                ay = (desiredY - this.vy) * this.maxForce * 2;
            }
            
            if (minDistSq < EAT_RADIUS_SQ) {
                foods.splice(foods.indexOf(target), 1);
                ripples.push(new Ripple(this.x, this.y, 0.8 * config.rippleStrength));
                this.fedTimer = 180;
            }
        } else {
            if (this.fedTimer <= 0 && config.shyFish && mouse.active) {
                let dMouseSq = distanceSq(this, mouse);
                if (dMouseSq < FEAR_RADIUS_SQ) {
                    let avoidX = this.x - mouse.x;
                    let avoidY = this.y - mouse.y;
                    let avoidLen = Math.sqrt(avoidX * avoidX + avoidY * avoidY);
                    
                    if (avoidLen > 0) {
                        let desiredX = (avoidX / avoidLen) * effectiveBaseSpeed * 2.5;
                        let desiredY = (avoidY / avoidLen) * effectiveBaseSpeed * 2.5;
                        
                        ax = (desiredX - this.vx) * this.maxForce * 3;
                        ay = (desiredY - this.vy) * this.maxForce * 3;
                        avoidForceApplied = true;
                    }
                }
            }
            
            if (!avoidForceApplied) {
                let wanderAngle = (Math.random() - 0.5) * 0.5 * dtMult;
                let curAngle = Math.atan2(this.vy, this.vx) + wanderAngle;
                
                this.vx = Math.cos(curAngle) * effectiveBaseSpeed;
                this.vy = Math.sin(curAngle) * effectiveBaseSpeed;
            }
        }

        let margin = 100;
        let turn = 0.1;
        
        if (target && minDistSq < FOOD_DETECT_RADIUS_SQ) {
            margin = 0;
        }

        if (this.x < margin) ax += turn;
        if (this.x > width - margin) ax -= turn;
        if (this.y < margin) ay += turn;
        if (this.y > height - margin) ay -= turn;

        // Hard boundary push for extreme resizes
        if (this.x < -150) this.x = -150;
        if (this.x > width + 150) this.x = width + 150;
        if (this.y < -150) this.y = -150;
        if (this.y > height + 150) this.y = height + 150;

        this.vx += ax * dtMult;
        this.vy += ay * dtMult;

        let speedSquared = this.vx * this.vx + this.vy * this.vy;
        let cSpeed = Math.sqrt(speedSquared);
        
        let currentMax = effectiveBaseSpeed;
        if (target && minDistSq < FOOD_DETECT_RADIUS_SQ) {
            currentMax = effectiveBaseSpeed * 2;
        } else if (avoidForceApplied) {
            currentMax = effectiveBaseSpeed * 2.5;
        }
        
        if (cSpeed > currentMax) {
            this.vx = (this.vx / cSpeed) * currentMax;
            this.vy = (this.vy / cSpeed) * currentMax;
        }

        this.x += this.vx * dtMult;
        this.y += this.vy * dtMult;
        
        this.swimCycle += cSpeed * 0.1 * dtMult;
        let wiggle = Math.sin(this.swimCycle) * 0.2;

        this.angle = Math.atan2(this.vy, this.vx) + wiggle;

        this.segments[0].x = this.x;
        this.segments[0].y = this.y;
        
        let currentSpacing = 5 * config.fishSize;
        for (let i = 1; i < this.numSegments; i++) {
            let prev = this.segments[i - 1];
            let curr = this.segments[i];
            
            let dx = prev.x - curr.x;
            let dy = prev.y - curr.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist > 0) {
                curr.x = prev.x - (dx / dist) * currentSpacing;
                curr.y = prev.y - (dy / dist) * currentSpacing;
            }
        }
    }

    draw(ctx) {
        ctx.shadowBlur = 15 * config.fishSize;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowOffsetX = 10 * config.fishSize;
        ctx.shadowOffsetY = 15 * config.fishSize;
        
        ctx.beginPath();
        let mid = this.segments[3];
        let dX = this.segments[3].x - this.segments[4].x;
        let dY = this.segments[3].y - this.segments[4].y;
        let a = Math.atan2(dY, dX);
        
        let s30 = 30 * config.fishSize;
        let s15 = 15 * config.fishSize;

        ctx.fillStyle = `rgba(255, 255, 255, 0.5)`;
        ctx.moveTo(mid.x, mid.y);
        ctx.lineTo(mid.x + Math.cos(a + 1.5) * s30, mid.y + Math.sin(a + 1.5) * s30);
        ctx.lineTo(mid.x + Math.cos(a + 2.5) * s15, mid.y + Math.sin(a + 2.5) * s15);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(mid.x, mid.y);
        ctx.lineTo(mid.x + Math.cos(a - 1.5) * s30, mid.y + Math.sin(a - 1.5) * s30);
        ctx.lineTo(mid.x + Math.cos(a - 2.5) * s15, mid.y + Math.sin(a - 2.5) * s15);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        for (let i = 0; i < this.numSegments - 1; i++) {
            let s1 = this.segments[i];
            let s2 = this.segments[i + 1];
            
            ctx.beginPath();
            ctx.moveTo(s1.x, s1.y);
            ctx.lineTo(s2.x, s2.y);
            ctx.lineWidth = FISH_BASE_SIZES[i] * config.fishSize * 2;
            
            ctx.strokeStyle = (i === 4 || i === 7) ? this.spotColor : this.color;
            
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(this.segments[0].x, this.segments[0].y, FISH_BASE_SIZES[0] * config.fishSize * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();

        let tailIdx = this.numSegments - 1;
        let t1 = this.segments[tailIdx];
        let t2 = this.segments[tailIdx - 1];
        let tAngle = Math.atan2(t1.y - t2.y, t1.x - t2.x);
        
        let t15 = 15 * config.fishSize;
        let t5 = 5 * config.fishSize;

        ctx.beginPath();
        ctx.moveTo(t1.x, t1.y);
        ctx.lineTo(t1.x + Math.cos(tAngle + 0.5) * t15, t1.y + Math.sin(tAngle + 0.5) * t15);
        ctx.lineTo(t1.x + Math.cos(tAngle + Math.PI) * t5, t1.y + Math.sin(tAngle + Math.PI) * t5);
        ctx.lineTo(t1.x + Math.cos(tAngle - 0.5) * t15, t1.y + Math.sin(tAngle - 0.5) * t15);
        ctx.fillStyle = `rgba(255, 255, 255, 0.7)`;
        ctx.fill();
    }
}

function syncKois() {
    while (kois.length < config.fishCount) {
        kois.push(new Koi());
    }
    while (kois.length > config.fishCount) {
        kois.pop();
    }
}

syncKois();

function drawCaustics(dt) {
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    causticTime += dt * 0.3 * config.fishSpeed;
    let time = causticTime;
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        let lx = (Math.sin(time + i) * 200) + width / 2;
        let ly = (Math.cos(time - i) * 200) + height / 2;
        ctx.arc(lx, ly, 400 + Math.sin(time)*100, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
}


  const alignBodies = () => kois.forEach(fish => fish.segments.forEach((segment, i) => {
    segment.x = fish.x - Math.cos(fish.angle) * i * 5 * config.fishSize;
    segment.y = fish.y - Math.sin(fish.angle) * i * 5 * config.fishSize;
  }));
  alignBodies();
  return {
    resize(w, h) { width = w; height = h; kois.forEach(fish => { fish.x = Math.min(Math.max(fish.x, 80), Math.max(80, w - 80)); fish.y = Math.min(Math.max(fish.y, 80), Math.max(80, h - 80)); }); alignBodies(); },
    tap(x, y) { if (foods.length >= 24) foods.shift(); if (ripples.length >= 24) ripples.shift(); foods.push(new Food(x, y)); ripples.push(new Ripple(x, y, 1.5)); },
    reset() { kois.length = foods.length = ripples.length = 0; syncKois(); alignBodies(); },
    render(dt = 0, animate = true) {
      ctx.clearRect(0, 0, width, height); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (config.enableCaustics) drawCaustics(animate ? dt : 0);
      for (let i = foods.length - 1; i >= 0; i--) { if (animate) foods[i].update(dt); foods[i].draw(ctx); if (foods[i].life <= 0) foods.splice(i, 1); }
      for (const fish of kois) { if (animate) fish.update(dt); fish.draw(ctx); }
      for (let i = ripples.length - 1; i >= 0; i--) { if (animate) ripples[i].update(dt); ripples[i].draw(ctx); if (ripples[i].life <= 0) ripples.splice(i, 1); }
    },
    dispose() { kois.length = foods.length = ripples.length = 0; ctx.clearRect(0, 0, width, height); }
  };
}
