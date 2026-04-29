// Liquid morphing blobs tuned to match the original template look.

const canvas = document.getElementById("bgCanvas");
const ctx = canvas.getContext("2d");

let W = 0;
let H = 0;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
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
    baseR: Math.min(W, H) * cfg.r,
    color: cfg.color,
    alpha: cfg.alpha,
    vx: cfg.vx,
    vy: cfg.vy,
    pts,
    numPts: cfg.pts,
  };
});

// ── Draw helpers ──────────────────────────────────────────────────────────────

function drawBlob(blob, t) {
  const { x, y, baseR, color, alpha, numPts, pts } = blob;
  const vertices = [];

  for (let i = 0; i < numPts; i++) {
    const p = pts[i];
    const base = (i / numPts) * Math.PI * 2;
    const angle  = base  + p.dAngle  * Math.sin(t * p.speed + p.phase);
    const radius = baseR * (1 + p.dRadius * Math.sin(t * p.speed * 1.25 + p.phase));
    vertices.push({ x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius });
  }

  ctx.beginPath();
  for (let i = 0; i < numPts; i++) {
    const curr = vertices[i];
    const next = vertices[(i + 1) % numPts];
    const mx   = (curr.x + next.x) / 2;
    const my   = (curr.y + next.y) / 2;
    if (i === 0) {
      ctx.moveTo(mx, my);
    } else {
      ctx.quadraticCurveTo(curr.x, curr.y, mx, my);
    }
  }
  // close with last → first midpoint
  const last  = vertices[numPts - 1];
  const first = vertices[0];
  ctx.quadraticCurveTo(last.x, last.y, (last.x + first.x) / 2, (last.y + first.y) / 2);
  ctx.closePath();

  const [r, g, b] = color;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, baseR * 1.6);
  grad.addColorStop(0,   `rgba(${r},${g},${b},${alpha * 0.95})`);
  grad.addColorStop(0.55, `rgba(${r},${g},${b},${alpha * 0.58})`);
  grad.addColorStop(1,   `rgba(${r},${g},${b},0)`);

  ctx.filter = "blur(42px)";
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.filter = "none";
}

// ── Update (soft bounce at edges) ─────────────────────────────────────────────

function updateBlobs() {
  for (let i = 0; i < blobs.length; i++) {
    const blob = blobs[i];
    blob.x += blob.vx;
    blob.y += blob.vy;

    const pad = blob.baseR * 0.5;
    if (blob.x < -pad)    { blob.x = W + pad; }
    if (blob.x > W + pad) { blob.x = -pad;    }
    if (blob.y < -pad)    { blob.y = H + pad; }
    if (blob.y > H + pad) { blob.y = -pad;    }

    // Resize base radius on window resize
    blob.baseR = Math.min(W, H) * BLOBS[i].r;
  }
}

// ── Scroll parallax (matches original CSS --offset logic) ────────────────────

let scrollY = 0;
window.addEventListener("scroll", () => { scrollY = window.scrollY; }, { passive: true });

// ── Main loop ─────────────────────────────────────────────────────────────────

function tick(t) {
  ctx.clearRect(0, 0, W, H);

  // Scroll-based parallax offset with the same original motion pattern repeated.
  const offsets = [
    scrollY * 0.05,
    scrollY * -0.04,
    scrollY * 0.03,
    scrollY * 0.02,
    scrollY * -0.015,
    scrollY * 0.01,
  ];

  ctx.save();
  for (let i = 0; i < blobs.length; i++) {
    ctx.save();
    ctx.translate(0, offsets[i] || 0);
    drawBlob(blobs[i], t);
    ctx.restore();
  }
  ctx.restore();

  updateBlobs();
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
