const c = document.getElementById("c");
const ctx = c.getContext("2d");

function resize() {
  c.width = Math.floor(innerWidth * devicePixelRatio);
  c.height = Math.floor(innerHeight * devicePixelRatio);
}
addEventListener("resize", resize);
resize();

// ---------- Tiny helpers ----------
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(t) { return t * t * (3 - 2 * t); }

function roundRectPath(x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawMouthArc(cx, cy, w, h, curvature /* -1..+1 */) {
  // curvature: + = smile, - = frown
  const leftX = cx - w / 2;
  const rightX = cx + w / 2;
  const midY = cy;

  // Control point pulls up/down
  const ctrlY = cy - curvature * h;

  ctx.beginPath();
  ctx.moveTo(leftX, midY);
  ctx.quadraticCurveTo(cx, ctrlY, rightX, midY);
  ctx.stroke();
}

// ---------- Face state ----------
let mood = "idle"; // idle, happy, sleepy, angry, shock
let moodTimer = 0;

function setMood(next, seconds = 1.2) {
  mood = next;
  moodTimer = seconds;
}

function cycleMood() {
  const order = ["idle", "happy", "sleepy", "angry", "shock"];
  const idx = order.indexOf(mood);
  setMood(order[(idx + 1) % order.length], 9999); // manual lock
}

let t = 0;

// Blink logic
let blink = 0;           // 0=open .. 1=closed
let blinkPhase = 0;      // 0=not blinking, else progress
let nextBlinkIn = 1.8;

function triggerBlink() {
  if (blinkPhase === 0) blinkPhase = 0.0001;
}

// Motion sensing
let motionEnabled = false;
let axF = 0, ayF = 0, azF = 0;
function lp(prev, next, alpha) { return prev + alpha * (next - prev); }
let lastShock = 0;
let lastAngry = 0;

// ---------- UI ----------
addEventListener("touchstart", (e) => {
  // Quick happy burst on tap, unless user has manually locked with cycle
  if (moodTimer < 10) setMood("happy", 0.8);
}, { passive: true });

addEventListener("dblclick", (e) => {
  e.preventDefault();
  cycleMood();
}, { passive: false });

// Motion permission button
const motionBtn = document.getElementById("motionBtn");
motionBtn?.addEventListener("click", async () => {
  try {
    if (typeof DeviceMotionEvent !== "undefined" &&
        typeof DeviceMotionEvent.requestPermission === "function") {
      const res = await DeviceMotionEvent.requestPermission();
      if (res !== "granted") throw new Error("Permission not granted");
    }
    motionEnabled = true;
    motionBtn.style.display = "none";
  } catch (e) {
    alert("Could not enable motion sensors.\n" + e.message);
  }
});

// Listen to device motion (works best on iOS via HTTPS + user gesture)
addEventListener("devicemotion", (ev) => {
  if (!motionEnabled) return;
  const a = ev.accelerationIncludingGravity;
  if (!a) return;

  const ax = a.x || 0;
  const ay = a.y || 0;
  const az = a.z || 0;

  axF = lp(axF, ax, 0.12);
  ayF = lp(ayF, ay, 0.12);
  azF = lp(azF, az, 0.12);

  const now = performance.now();

  // Detect “bump” as a sudden change in z
  const bump = Math.abs(az - azF);
  // Detect “turn/brake” as sustained lateral or forward/back magnitude
  const turn = Math.abs(axF);
  const accel = Math.abs(ayF);

  // Thresholds to tune after a short drive (mount/orientation matters)
  if (bump > 2.3 && now - lastShock > 1200) {
    lastShock = now;
    setMood("shock", 0.9);
    triggerBlink();
  }
  if ((turn > 2.0 || accel > 2.2) && now - lastAngry > 1400) {
    lastAngry = now;
    setMood("angry", 1.0);
  }
}, { passive: true });

// ---------- Main update/render ----------
function update(dt) {
  t += dt;

  // Mood timer (unless manually locked)
  if (moodTimer < 9000) {
    moodTimer = Math.max(0, moodTimer - dt);
    if (moodTimer === 0) mood = "idle";
  }

  // Blink schedule
  nextBlinkIn -= dt;
  if (nextBlinkIn <= 0) {
    triggerBlink();
    nextBlinkIn = 1.6 + Math.random() * 2.2;
  }

  // Blink animation
  if (blinkPhase > 0) {
    // blinkPhase grows 0..1 quickly then ends
    blinkPhase += dt * 10; // speed
    const p = clamp(blinkPhase, 0, 1);
    // Close then open (ease)
    const close = p < 0.5 ? smoothstep(p * 2) : smoothstep((1 - p) * 2);
    blink = close;
    if (blinkPhase >= 1) {
      blinkPhase = 0;
      blink = 0;
    }
  } else {
    blink = 0;
  }
}

function render() {
  const w = c.width, h = c.height;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);

  // Face layout (a virtual “OLED” rectangle region)
  const faceW = Math.min(w, h * 1.2);
  const faceH = faceW * 0.62; // 128x64 vibe
  const cx = w / 2;
  const cy = h / 2;

  // Cute subtle bob
  const bob = Math.sin(t * 1.2) * faceH * 0.01;

  // Eye baseline positions
  const eyeY = cy - faceH * 0.08 + bob;
  const leftEyeX  = cx - faceW * 0.18;
  const rightEyeX = cx + faceW * 0.18;

  // Eye size changes by mood
  let eyeW = faceW * 0.14;
  let eyeH = faceH * 0.12;

  // Pupils / expression tweaks
  let smileCurv = 0.0;   // + smile, - frown
  let mouthOpen = 0.0;   // 0..1
  let browTilt = 0.0;    // - angry, + surprised
  let squint = 0.0;      // 0..1

  switch (mood) {
    case "idle":
      smileCurv = 0.25;
      squint = 0.05;
      break;
    case "happy":
      smileCurv = 0.9;
      squint = 0.25;
      break;
    case "sleepy":
      smileCurv = 0.15;
      squint = 0.55;
      break;
    case "angry":
      smileCurv = -0.35;
      browTilt = -0.55;
      squint = 0.25;
      break;
    case "shock":
      smileCurv = 0.0;
      mouthOpen = 1.0;
      browTilt = 0.75;
      squint = 0.0;
      break;
  }

  // Apply blink + squint to eye height
  const lid = clamp(blink + squint, 0, 0.92);
  const eyeHNow = Math.max(faceH * 0.02, eyeH * (1 - lid));

  // Slight “alive” pulse
  const pulse = 1 + Math.sin(t * 2.2) * 0.02;
  eyeW *= pulse;

  ctx.fillStyle = "#fff";

  // Eyes
  const r = eyeH * 0.6;
  roundRectPath(leftEyeX - eyeW / 2, eyeY - eyeHNow / 2, eyeW, eyeHNow, r);
  ctx.fill();
  roundRectPath(rightEyeX - eyeW / 2, eyeY - eyeHNow / 2, eyeW, eyeHNow, r);
  ctx.fill();

  // Brows (simple angled lines) for angry/shock
  if (Math.abs(browTilt) > 0.05) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = Math.max(2, faceH * 0.02);
    ctx.lineCap = "round";

    const by = eyeY - faceH * 0.10;
    const bw = eyeW * 0.9;

    function brow(x, tilt) {
      ctx.beginPath();
      ctx.moveTo(x - bw * 0.55, by - tilt * faceH * 0.03);
      ctx.lineTo(x + bw * 0.55, by + tilt * faceH * 0.03);
      ctx.stroke();
    }
    brow(leftEyeX, browTilt);
    brow(rightEyeX, -browTilt);
  }

  // Mouth
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = Math.max(3, faceH * 0.03);
  ctx.lineCap = "round";

  const mouthY = cy + faceH * 0.18 + bob;
  const mouthW = faceW * 0.26;
  const mouthH = faceH * 0.18;

  if (mouthOpen > 0.2) {
    // Surprise "O"
    const mw = mouthW * 0.45;
    const mh = mouthH * 0.65;
    roundRectPath(cx - mw / 2, mouthY - mh / 2, mw, mh, Math.min(mw, mh) * 0.45);
    ctx.stroke();
  } else {
    drawMouthArc(cx, mouthY, mouthW, mouthH, smileCurv);
  }

  // Tiny cheek dots when happy
  if (mood === "happy") {
    ctx.fillStyle = "#fff";
    const dotR = Math.max(2, faceH * 0.012);
    const dy = faceH * 0.04;
    ctx.beginPath();
    ctx.arc(leftEyeX - eyeW * 0.9, mouthY - dy, dotR, 0, Math.PI * 2);
    ctx.arc(rightEyeX + eyeW * 0.9, mouthY - dy, dotR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Small hint text (optional): remove if you want pure face
  // ctx.fillStyle = "rgba(255,255,255,0.35)";
  // ctx.font = `${Math.floor(faceH*0.08)}px -apple-system, system-ui`;
  // ctx.textAlign = "center";
  // ctx.fillText("tap = happy • double-tap = cycle", cx, cy + faceH*0.45);
}

// Loop
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
