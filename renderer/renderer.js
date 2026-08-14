const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');

const SEGMENTS = 18;
const BALL_RADIUS = 44;
const GRAB_PADDING = 10;
const GRAVITY = 650;
const SUBSTEPS = 8;
// XPBD compliance: bigger = stretchier string. Stable at any value.
const COMPLIANCE = 6e-5;
const ROPE_DAMPING = 0.55;
const BALL_INV_MASS = 0.45;
const MAX_STRETCH = 1.8;
const BOUNCE = 0.35;
const MAX_SPEED = 2400;

let width = 0;
let height = 0;
let anchor = { x: 0, y: 0 };
let ropeLength = 0;
let points = [];

const mouse = { x: -9999, y: -9999, inside: false };
let hovering = false;
let dragging = false;
let grabOffset = { x: 0, y: 0 };

function segmentLength() {
  return ropeLength / (SEGMENTS - 1);
}

function resetRope() {
  const seg = segmentLength();
  points = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const x = anchor.x;
    const y = anchor.y + i * seg;
    points.push({
      x,
      y,
      px: x,
      py: y,
      vx: 0,
      vy: 0,
      w: i === 0 ? 0 : i === SEGMENTS - 1 ? BALL_INV_MASS : 1
    });
  }
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  anchor = { x: width / 2, y: 0 };
  const desired = ropeLength || Math.min(height * 0.42, 480);
  ropeLength = clamp(desired, 120, height * 0.75);
  if (!points.length) {
    resetRope();
  } else {
    points[0].x = anchor.x;
    points[0].y = anchor.y;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function ball() {
  return points[points.length - 1];
}

function ropeSpan() {
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
  }
  return total || 1;
}

function setRopeLength(next) {
  ropeLength = clamp(next, 120, height * 0.75);
}

function solveSprings(h) {
  const alpha = COMPLIANCE / (h * h);
  const rest = segmentLength();
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const wSum = a.w + b.w;
    if (wSum === 0) continue;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy) || 1e-6;
    const lambda = -(dist - rest) / (wSum + alpha);
    const nx = (dx / dist) * lambda;
    const ny = (dy / dist) * lambda;

    a.x -= nx * a.w;
    a.y -= ny * a.w;
    b.x += nx * b.w;
    b.y += ny * b.w;
  }
}

function collide() {
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (p.w === 0) continue;
    const r = i === points.length - 1 ? BALL_RADIUS : 1;

    if (p.x < r) {
      p.x = r;
      p.vx = Math.abs(p.vx) * BOUNCE;
    } else if (p.x > width - r) {
      p.x = width - r;
      p.vx = -Math.abs(p.vx) * BOUNCE;
    }
    if (p.y > height - r) {
      p.y = height - r;
      p.vy = -Math.abs(p.vy) * BOUNCE;
      p.vx *= 0.92;
    } else if (p.y < -r) {
      p.y = -r;
      p.vy = Math.abs(p.vy) * BOUNCE;
    }

    const speed = Math.hypot(p.vx, p.vy);
    if (speed > MAX_SPEED) {
      p.vx = (p.vx / speed) * MAX_SPEED;
      p.vy = (p.vy / speed) * MAX_SPEED;
    }
  }
}

function substep(h) {
  const decay = Math.exp(-ROPE_DAMPING * h);

  for (const p of points) {
    p.px = p.x;
    p.py = p.y;
    if (p.w === 0) continue;
    p.vy += GRAVITY * h;
    p.x += p.vx * h;
    p.y += p.vy * h;
  }

  solveSprings(h);

  for (const p of points) {
    if (p.w === 0) continue;
    p.vx = ((p.x - p.px) / h) * decay;
    p.vy = ((p.y - p.py) / h) * decay;
  }

  collide();
}

function updateDrag(dt) {
  if (!dragging) return;
  const b = ball();

  let tx = mouse.x + grabOffset.x;
  let ty = mouse.y + grabOffset.y;
  const dx = tx - anchor.x;
  const dy = ty - anchor.y;
  const dist = Math.hypot(dx, dy) || 1e-6;
  const max = ropeLength * MAX_STRETCH;
  if (dist > max) {
    tx = anchor.x + (dx / dist) * max;
    ty = anchor.y + (dy / dist) * max;
  }

  const inv = 1 / Math.max(dt, 1 / 240);
  b.vx = (tx - b.x) * inv;
  b.vy = (ty - b.y) * inv;
  b.x = tx;
  b.y = ty;
}

function step(dt) {
  updateDrag(dt);
  const h = dt / SUBSTEPS;
  for (let i = 0; i < SUBSTEPS; i++) substep(h);
}

function updateInteractivity() {
  const b = ball();
  const grabRadius = BALL_RADIUS + GRAB_PADDING;
  hovering = mouse.inside && Math.hypot(mouse.x - b.x, mouse.y - b.y) <= grabRadius;

  window.overlay.reportBall({ x: b.x, y: b.y, r: grabRadius, holding: dragging });

  document.body.classList.toggle('hovering', hovering && !dragging);
  document.body.classList.toggle('dragging', dragging);
}

function draw() {
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const cx = (points[i].x + points[i + 1].x) / 2;
    const cy = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, cx, cy);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.strokeStyle = 'rgba(232, 236, 245, 0.92)';
  ctx.lineWidth = clamp(3 * (ropeLength / ropeSpan()), 1.1, 3.2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();

  // anchor nub
  ctx.save();
  ctx.fillStyle = 'rgba(60, 66, 80, 0.9)';
  ctx.beginPath();
  ctx.roundRect(anchor.x - 14, -8, 28, 16, 6);
  ctx.fill();
  ctx.restore();

  const b = ball();
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;

  const gradient = ctx.createRadialGradient(
    b.x - BALL_RADIUS * 0.35,
    b.y - BALL_RADIUS * 0.4,
    BALL_RADIUS * 0.15,
    b.x,
    b.y,
    BALL_RADIUS
  );
  gradient.addColorStop(0, hovering || dragging ? '#bdefff' : '#9fe4ff');
  gradient.addColorStop(0.55, '#3fb0e8');
  gradient.addColorStop(1, '#1f6fa8');

  ctx.beginPath();
  ctx.arc(b.x, b.y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(b.x - BALL_RADIUS * 0.3, b.y - BALL_RADIUS * 0.35, BALL_RADIUS * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.fill();
}

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 1 / 45);
  lastTime = now;
  step(dt);
  updateInteractivity();
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener('resize', resize);

// Cursor position is pushed from the main process; DOM mouse events only arrive while the window
// is interactive, which is exactly when the ball is already grabbed or hovered.
window.overlay.onCursor((cursor) => {
  mouse.x = cursor.x;
  mouse.y = cursor.y;
  mouse.inside = cursor.inside;
});

window.addEventListener('mousemove', (event) => {
  // A mouseup can be missed while the window flips back to click-through.
  if (dragging && event.buttons === 0) releaseBall();
});

window.addEventListener('mousedown', (event) => {
  if (event.button !== 0 || !hovering) return;
  const b = ball();
  grabOffset = { x: b.x - mouse.x, y: b.y - mouse.y };
  dragging = true;
  b.w = 0; // kinematic while held
  event.preventDefault();
});

function releaseBall() {
  if (!dragging) return;
  dragging = false;
  const b = ball();
  b.w = BALL_INV_MASS;
  const speed = Math.hypot(b.vx, b.vy);
  const max = MAX_SPEED * 0.5;
  if (speed > max) {
    b.vx = (b.vx / speed) * max;
    b.vy = (b.vy / speed) * max;
  }
}

window.addEventListener('mouseup', releaseBall);
window.addEventListener('blur', releaseBall);

window.addEventListener('wheel', (event) => {
  if (!hovering && !dragging) return;
  setRopeLength(ropeLength - Math.sign(event.deltaY) * 24);
  event.preventDefault();
}, { passive: false });

window.overlay.onCommand((command) => {
  if (command === 'reset') {
    dragging = false;
    resetRope();
  } else if (command === 'swing') {
    const b = ball();
    b.vx += 420;
    b.vy -= 120;
  } else if (command === 'longer') {
    setRopeLength(ropeLength + 60);
  } else if (command === 'shorter') {
    setRopeLength(ropeLength - 60);
  }
});

resize();
requestAnimationFrame(loop);
