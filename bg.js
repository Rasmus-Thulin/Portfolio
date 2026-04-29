// Liquid morphing blobs tuned to match the original template look.

const canvas = document.getElementById("bgCanvas");
const ctx = canvas.getContext("2d");
const blobLayer = document.createElement("canvas");
const blobCtx = blobLayer.getContext("2d");

const PHYSICS = {
  spring: 0.00034,
  repel: 0.095,
  roam: 0.00016,
  home: 0.00026,
  bound: 0.0018,
  drag: 0.985,
  maxSpeed: 0.58,
  mergeRange: 1.45,
  interactRange: 2.2,
};

let W = 0;
let H = 0;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
  blobLayer.width = W;
  blobLayer.height = H;
}
window.addEventListener("resize", resize, { passive: true });
resize();

// ── Blob configuration (mirrors old .blob-a/.blob-b/.blob-c) ─────────────────

const BLOBS = [
  {
    x: -0.10, y: 0.18,
    r: 0.36,
    color: [255, 214, 87],
    alpha: 0.36,
    vx: 0.035, vy: 0.02,
    pts: 7, speed: 0.0012, morph: 0.12,
  },
  {
    x: 0.92, y: 0.41,
    r: 0.26,
    color: [255, 102, 179],
    alpha: 0.36,
    vx: -0.03, vy: 0.015,
    pts: 7, speed: 0.00135, morph: 0.11,
  },
  {
    x: 0.70, y: 0.90,
    r: 0.18,
    color: [72, 149, 239],
    alpha: 0.36,
    vx: -0.02, vy: -0.012,
    pts: 6, speed: 0.0011, morph: 0.1,
  },
  {
    x: 0.30, y: 0.28,
    r: 0.16,
    color: [119, 221, 119],
    alpha: 0.34,
    vx: 0.018, vy: -0.014,
    pts: 6, speed: 0.00128, morph: 0.1,
  },
  {
    x: 0.58, y: 0.62,
    r: 0.14,
    color: [168, 120, 255],
    alpha: 0.32,
    vx: -0.016, vy: 0.01,
    pts: 6, speed: 0.00122, morph: 0.095,
  },
  {
    x: 0.08, y: 0.78,
    r: 0.13,
    color: [97, 219, 251],
    alpha: 0.31,
    vx: 0.014, vy: -0.009,
    pts: 5, speed: 0.00118, morph: 0.09,
  },
];

// Initialise per-blob state from config.
const blobs = BLOBS.map((cfg) => {
  const pts = [];
  for (let i = 0; i < cfg.pts; i++) {
    pts.push({
      dAngle:  Math.sin((i + 1) * 1.77) * 0.14,
      dRadius: cfg.morph * (0.7 + ((i % 3) * 0.15)),
      speed:   cfg.speed * (0.9 + ((i % 2) * 0.12)),
      phase:   i * 1.03,
    });
  }
  return {
    x: cfg.x * W,
    y: cfg.y * H,
    homeX: cfg.x,
    homeY: cfg.y,
    baseR: Math.min(W, H) * cfg.r,
    color: cfg.color,
    alpha: cfg.alpha,
    vx: cfg.vx,
    vy: cfg.vy,
    ax: 0,
    ay: 0,
    morphPhase: Math.random() * Math.PI * 2,
    mergeEnergy: 0,
    pts,
    numPts: cfg.pts,
  };
});

// ── Draw helpers ──────────────────────────────────────────────────────────────

function drawBlob(targetCtx, blob, t) {
  const { x, y, baseR, color, alpha, numPts, pts } = blob;
  const vertices = [];
  const pulsate = 1 + 0.09 * Math.sin(t * 0.0012 + blob.morphPhase);
  const reactiveMorph = 1 + blob.mergeEnergy * 0.22;
  const reactiveRadius = baseR * pulsate * reactiveMorph;

  for (let i = 0; i < numPts; i++) {
    const p = pts[i];
    const base = (i / numPts) * Math.PI * 2;
    const angle  = base  + p.dAngle  * Math.sin(t * p.speed + p.phase);
    const radius = reactiveRadius * (1 + p.dRadius * Math.sin(t * p.speed * 1.25 + p.phase));
    vertices.push({ x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius });
  }

  targetCtx.beginPath();
  for (let i = 0; i < numPts; i++) {
    const curr = vertices[i];
    const next = vertices[(i + 1) % numPts];
    const mx   = (curr.x + next.x) / 2;
    const my   = (curr.y + next.y) / 2;
    if (i === 0) {
      targetCtx.moveTo(mx, my);
    } else {
      targetCtx.quadraticCurveTo(curr.x, curr.y, mx, my);
    }
  }
  // close with last → first midpoint
  const last  = vertices[numPts - 1];
  const first = vertices[0];
  targetCtx.quadraticCurveTo(last.x, last.y, (last.x + first.x) / 2, (last.y + first.y) / 2);
  targetCtx.closePath();

  const [r, g, b] = color;
  const grad = targetCtx.createRadialGradient(x, y, 0, x, y, baseR * 1.2);
  const mergedAlpha = alpha * (1 + blob.mergeEnergy * 0.16);
  grad.addColorStop(0,   `rgba(${r},${g},${b},${mergedAlpha})`);
  grad.addColorStop(0.68, `rgba(${r},${g},${b},${mergedAlpha * 0.8})`);
  grad.addColorStop(1,   `rgba(${r},${g},${b},0)`);

  targetCtx.fillStyle = grad;
  targetCtx.fill();
}

// ── Update (soft bounce at edges) ─────────────────────────────────────────────

function updateBlobs(t) {
  const mergeLevels = new Array(blobs.length).fill(0);

  for (let i = 0; i < blobs.length; i++) {
    const b = blobs[i];
    b.ax = 0;
    b.ay = 0;

    // Roaming target makes each blob drift through "space" instead of orbiting one fixed cluster.
    const tx = W * (b.homeX + 0.16 * Math.sin(t * 0.00009 + i * 1.37));
    const ty = H * (b.homeY + 0.14 * Math.cos(t * 0.00011 + i * 1.91));
    b.ax += (tx - b.x) * PHYSICS.roam;
    b.ay += (ty - b.y) * PHYSICS.roam;

    const hx = W * b.homeX;
    const hy = H * b.homeY;
    b.ax += (hx - b.x) * PHYSICS.home;
    b.ay += (hy - b.y) * PHYSICS.home;
  }

  // Pairwise spring attraction so blobs drift toward each other and fuse naturally.
  for (let i = 0; i < blobs.length; i++) {
    for (let j = i + 1; j < blobs.length; j++) {
      const a = blobs[i];
      const b = blobs[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const nx = dx / dist;
      const ny = dy / dist;
      const interactDist = (a.baseR + b.baseR) * PHYSICS.interactRange;
      if (dist > interactDist) continue;

      const target = (a.baseR + b.baseR) * 1.05;
      const springForce = (dist - target) * PHYSICS.spring;

      a.ax += nx * springForce;
      a.ay += ny * springForce;
      b.ax -= nx * springForce;
      b.ay -= ny * springForce;

      // Close-range repulsion keeps blobs fluid and prevents one giant locked clump.
      if (dist < target * 0.78) {
        const repelForce = ((target * 0.78 - dist) / target) * PHYSICS.repel;
        a.ax -= nx * repelForce;
        a.ay -= ny * repelForce;
        b.ax += nx * repelForce;
        b.ay += ny * repelForce;
      }

      const mergeSignal = Math.max(0, 1 - dist / ((a.baseR + b.baseR) * PHYSICS.mergeRange));
      mergeLevels[i] += mergeSignal;
      mergeLevels[j] += mergeSignal;
    }
  }

  for (let i = 0; i < blobs.length; i++) {
    const blob = blobs[i];

    blob.vx = (blob.vx + blob.ax) * PHYSICS.drag;
    blob.vy = (blob.vy + blob.ay) * PHYSICS.drag;

    const speed = Math.hypot(blob.vx, blob.vy);
    if (speed > PHYSICS.maxSpeed) {
      const s = PHYSICS.maxSpeed / speed;
      blob.vx *= s;
      blob.vy *= s;
    }

    blob.x += blob.vx;
    blob.y += blob.vy;

    const pad = blob.baseR * 0.42;
    if (blob.x < -pad) blob.ax += (-pad - blob.x) * PHYSICS.bound;
    if (blob.x > W + pad) blob.ax -= (blob.x - (W + pad)) * PHYSICS.bound;
    if (blob.y < -pad) blob.ay += (-pad - blob.y) * PHYSICS.bound;
    if (blob.y > H + pad) blob.ay -= (blob.y - (H + pad)) * PHYSICS.bound;

    // Resize base radius on window resize
    blob.baseR = Math.min(W, H) * BLOBS[i].r;
    blob.mergeEnergy = blob.mergeEnergy * 0.86 + Math.min(1, mergeLevels[i]) * 0.24;
  }
}

// ── Scroll parallax (matches original CSS --offset logic) ────────────────────

let scrollY = 0;
window.addEventListener("scroll", () => { scrollY = window.scrollY; }, { passive: true });

// ── Main loop ─────────────────────────────────────────────────────────────────

function tick(t) {
  ctx.clearRect(0, 0, W, H);
  blobCtx.clearRect(0, 0, W, H);

  // Scroll-based parallax offset with the same original motion pattern repeated.
  const offsets = [
    scrollY * 0.05,
    scrollY * -0.04,
    scrollY * 0.03,
    scrollY * 0.02,
    scrollY * -0.015,
    scrollY * 0.01,
  ];

  blobCtx.save();
  blobCtx.globalCompositeOperation = "lighter";
  for (let i = 0; i < blobs.length; i++) {
    blobCtx.save();
    blobCtx.translate(0, offsets[i] || 0);
    drawBlob(blobCtx, blobs[i], t);
    blobCtx.restore();
  }
  blobCtx.restore();

  // Post-process layer for metaball-like merge: blur + contrast boosts the fusion.
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.filter = "blur(32px) contrast(165%) saturate(120%)";
  ctx.drawImage(blobLayer, 0, 0);
  ctx.restore();

  updateBlobs(t);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
