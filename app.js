const c = document.getElementById('c');
const ctx = c.getContext('2d');

function resize(){
  c.width = innerWidth * devicePixelRatio;
  c.height = innerHeight * devicePixelRatio;
}
resize();
addEventListener('resize', resize);

let t = 0;

function draw(){
  t += 0.05;

  const w = c.width;
  const h = c.height;

  ctx.fillStyle = "black";
  ctx.fillRect(0,0,w,h);

  const eyeW = w * 0.12;
  const eyeH = h * (0.05 + Math.sin(t)*0.01);

  const y = h*0.5;

  ctx.fillStyle = "white";
  round(w*0.35-eyeW/2, y-eyeH/2, eyeW, eyeH);
  round(w*0.65-eyeW/2, y-eyeH/2, eyeW, eyeH);

  requestAnimationFrame(draw);
}

function round(x,y,w,h){
  ctx.beginPath();
  ctx.roundRect(x,y,w,h,h/2);
  ctx.fill();
}

draw();
