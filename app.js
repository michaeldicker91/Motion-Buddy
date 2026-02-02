// If you see this title change, you KNOW the new file loaded
document.title = "Mochi ✅ Loaded";

const c = document.getElementById("c");
const ctx = c.getContext("2d");

function resize() {
  c.width = innerWidth * devicePixelRatio;
  c.height = innerHeight * devicePixelRatio;
}
resize();
addEventListener("resize", resize);

// ---------- State ----------
let t = 0;
let mood = "idle";
let moodTimer = 0;

let blink = 0;
let blinkTimer = 2 + Math.random() * 2;

// ---------- Mood control ----------
function setMood(m, time = 1.2) {
  mood = m;
  moodTimer = time;
}

addEventListener("touchstart", () => {
  setMood("happy", 0.8);
});

// ---------- Motion (car reactions) ----------
const btn = document.getElementById("motionBtn");

btn?.addEventListener("click", async () => {
  if (typeof DeviceMotionEvent.requestPermission === "function") {
    await DeviceMotionEvent.requestPermission();
  }
});

let lastShock = 0;

addEventListener("devicemotion", e => {
  const a = e.accelerationIncludingGravity;
  if (!a) return;

  const bump = Math.abs(a.z);

  const now = performance.now();

  if (bump > 20 && now - lastShock > 1000) {
    lastShock = now;
    setMood("shock", 0.8);
  }
});

// ---------- Drawing helpers ----------
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function drawFace() {
  const w = c.width;
  const h = c.height;

  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;

  const eyeW = w * 0.14;
  const eyeH = h * 0.10 * (1 - blink);

  const left = cx - w * 0.18;
  const right = cx + w * 0.18;

  ctx.fillStyle = "white";

  // eyes
  roundRect(left - eyeW/2, cy - eyeH/2, eyeW, eyeH, eyeH/2);
  roundRect(right - eyeW/2, cy - eyeH/2, eyeW, eyeH, eyeH/2);

  // mouth
  ctx.strokeStyle = "white";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";

  ctx.beginPath();

  const mouthY = cy + h * 0.18;

  if (mood === "happy") {
    ctx.quadraticCurveTo(cx, mouthY - 60, cx + 120, mouthY);
    ctx.moveTo(cx - 120, mouthY);
    ctx.quadraticCurveTo(cx, mouthY - 60, cx + 120, mouthY);
  }
  else if (mood === "shock") {
    ctx.arc(cx, mouthY, 30, 0, Math.PI * 2);
  }
  else {
    ctx.moveTo(cx - 120, mouthY);
    ctx.lineTo(cx + 120, mouthY);
  }

  ctx.stroke();
}

// ---------- Loop ----------
let last = performance.now();

function loop(now) {
  const dt = (now - last) / 1000;
  last = now;

  t += dt;

  // blink
  blinkTimer -= dt;
  if (blinkTimer < 0) {
    blink = 1;
    setTimeout(() => blink = 0, 120);
    blinkTimer = 2 + Math.random() * 3;
  }

  // mood timeout
  if (moodTimer > 0) {
    moodTimer -= dt;
    if (moodTimer <= 0) mood = "idle";
  }

  drawFace();
  requestAnimationFrame(loop);
}

loop(last);
