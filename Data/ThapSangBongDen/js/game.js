"use strict";

// Lấy các phần tử giao diện dùng để vẽ game, báo trạng thái và làm lại màn chơi.
const canvas = document.querySelector("#game-canvas");
const ctx = canvas.getContext("2d");
const statusLabel = document.querySelector("#game-status");
const titleLabel = document.querySelector("#game-title");
const instructionLabel = document.querySelector("#game-instruction");
const hintCountdown = document.querySelector("#hint-countdown");
const restartButton = document.querySelector("#restart-button");
const muteButton = document.querySelector("#mute-button");
const muteIcon = document.querySelector("#mute-icon");

let isMuted = false;

// Các thông số cố định của thao tác kéo: vùng nắm đầu dây, vùng nối đúng,
// khoảng cách giữ dây khỏi mép màn hình và thời gian chờ trước khi hiện gợi ý.
const GAMEPLAY = {
  pickRadius: 38,
  connectionRadius: 42,
  snapRadius: 70,        // Bán kính hút dây (snap) vào đích khi gần
  edgePadding: 25,
  hintDelay: 6000,
};

// Màu sắc và vị trí lấp lánh trang trí dây, đường dẫn gợi ý và bóng đèn.
const VISUALS = {
  wire: { body: "#bd3834", highlight: "#ff7568", tip: "#a92e2a", tipHighlight: "#ff9889" },
  hint: { color: "#ff9e34", hand: "#f5ae45", handOutline: "#9b5c19" },
  sparkles: [[610, 177], [766, 186], [575, 272], [800, 278], [690, 127], [751, 330]],
};

// Dữ liệu hình ảnh/tọa độ được tải từ JSON; trạng thái thay đổi khi chơi lưu riêng tại đây.
let gameData;
let pinImage;
let bulbImage;
let audioContext;
let state;

// ─── Hệ thống Particle ───────────────────────────────────────────────────────
let particles = [];

function spawnParticles(x, y, count, colors, speedMult = 1) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (2 + Math.random() * 5) * speedMult;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 0.018 + Math.random() * 0.022,
      radius: 3 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      gravity: 0.12,
    });
  }
}

function spawnElectricSparks(x, y) {
  const colors = ["#fff7a0", "#ffe040", "#ffcc00", "#ffffff", "#80eeff"];
  spawnParticles(x, y, 18, colors, 1.8);
}

function spawnCelebrationBurst(x, y) {
  const colors = ["#ff4444", "#ff9900", "#ffee00", "#44ff77", "#44aaff", "#aa44ff", "#ff44cc"];
  spawnParticles(x, y, 40, colors, 1.4);
}

function spawnMissParticles(x, y) {
  const colors = ["#ff6666", "#cc4444", "#ffaa88"];
  spawnParticles(x, y, 10, colors, 0.8);
}

function updateParticles() {
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.vx *= 0.97;
    p.life -= p.decay;
    p.radius *= 0.98;
  });
}

function drawParticles() {
  ctx.save();
  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, p.radius), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.restore();
}

// ─── Hệ thống rung màn hình ─────────────────────────────────────────────────
let shakeState = { intensity: 0, duration: 0, startTime: 0 };

function triggerShake(intensity = 5, duration = 300) {
  shakeState = { intensity, duration, startTime: performance.now() };
}

function getShakeOffset(time) {
  const elapsed = time - shakeState.startTime;
  if (elapsed > shakeState.duration) return { x: 0, y: 0 };
  const factor = 1 - elapsed / shakeState.duration;
  return {
    x: (Math.random() - 0.5) * shakeState.intensity * factor * 2,
    y: (Math.random() - 0.5) * shakeState.intensity * factor * 2,
  };
}

// ─── Hệ thống tia sét điện trên dây ─────────────────────────────────────────
function drawElectricArc(x1, y1, x2, y2, intensity = 0.5) {
  const segments = 8;
  const dx = (x2 - x1) / segments;
  const dy = (y2 - y1) / segments;
  ctx.save();
  ctx.strokeStyle = `rgba(120, 220, 255, ${intensity})`;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = "#80eeff";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  for (let i = 1; i < segments; i++) {
    const jitter = (Math.random() - 0.5) * 12 * intensity;
    ctx.lineTo(x1 + dx * i + jitter, y1 + dy * i + jitter);
  }
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

// ─── Tải ảnh ────────────────────────────────────────────────────────────────
function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Không tải được hình: ${source}`));
    image.src = source;
  });
}

// ─── Vẽ Pin ─────────────────────────────────────────────────────────────────
function drawPin() {
  const pin = gameData.objects.pin;
  ctx.drawImage(pinImage, pin.x, pin.y, pin.width, pin.height);

  // Hiệu ứng phát sáng tại cực dương khi đang kéo dây
  if (state && state.dragging) {
    const pt = pin.positiveTerminal;
    const pulse = 0.5 + Math.sin(performance.now() / 80) * 0.3;
    ctx.save();
    ctx.shadowColor = "#ffee44";
    ctx.shadowBlur = 18 * pulse;
    ctx.fillStyle = `rgba(255, 230, 60, ${0.25 * pulse})`;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ─── Vẽ Bóng Đèn ─────────────────────────────────────────────────────────────
function drawBulb(time) {
  const bulb  = gameData.objects.bulb;
  const isLit = state && state.lit;

  // Tâm phần bầu thủy tinh tròn của đèn (ước lượng từ toạ độ ảnh)
  const gx = bulb.socket.x;        // ≈ 678  – tâm ngang
  const gy = bulb.y + bulb.width * 0.25;  // ≈ 230  – tâm đứng (khoảng 47% chiều cao)
  const gr = bulb.width * 0.5;    // ≈ 109  – bán kính bầu

  // ── KHI ĐÈN BẬT: hào quang hậu cảnh ──────────────────────────────────
  if (isLit) {
    ctx.save();
    const pulse = 0.45 + Math.sin(time / 115) * 0.07;

    // Quầng sáng ngoài lớn – tròn, fade tự nhiên
    const halo = ctx.createRadialGradient(gx, gy, gr * 0.2, gx, gy, gr * 2.1);
    halo.addColorStop(0,   `rgba(255, 240, 100, ${0.75 * pulse})`);
    halo.addColorStop(0.35,`rgba(255, 195, 30,  ${0.45 * pulse})`);
    halo.addColorStop(0.7, `rgba(255, 140, 0,   ${0.18 * pulse})`);
    halo.addColorStop(1,   'rgba(255, 100, 0, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(gx, gy, gr * 2.1, 0, Math.PI * 2);
    ctx.fill();

    // Vệt sáng chiếu xuống bàn – ellipse tròn dài
    const floorGlow = ctx.createRadialGradient(gx, 475, 8, gx, 475, 160);
    floorGlow.addColorStop(0, `rgba(255, 220, 80,  ${0.40 * pulse})`);
    floorGlow.addColorStop(0.5,`rgba(255, 180, 0, ${0.18 * pulse})`);
    floorGlow.addColorStop(1, 'rgba(255, 140, 0, 0)');
    ctx.fillStyle = floorGlow;
    ctx.beginPath();
    ctx.ellipse(gx, 482, 155, 48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── VẼ ẢNH BÓNG ĐÈN ──────────────────────────────────────────────────
  ctx.save();
  ctx.drawImage(bulbImage, bulb.x, bulb.y, bulb.width, bulb.height);

  if (isLit) {
    // Tint vàng – dùng arc tròn + source-atop → overlay bám đúng bầu đèn tròn
    const tint = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    tint.addColorStop(0,    'rgba(255, 245, 80, 0.85)');
    tint.addColorStop(0.45, 'rgba(255, 210, 40, 0.65)');
    tint.addColorStop(0.80, 'rgba(255, 170, 10, 0.30)');
    tint.addColorStop(1,    'rgba(255, 130, 0, 0.00)');
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = tint;
    // Vẽ hình tròn khớp bầu đèn – KHÔNG fillRect
    ctx.beginPath();
    ctx.arc(gx, gy, gr * 1.05, 0, Math.PI * 2);
    ctx.fill();

  } else {
    // Lớp tối khi đèn TẮT – ellipse tròn bám bầu đèn, fade ra rìa
    const dark = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr * 1.05);
    dark.addColorStop(0,   'rgba(8, 8, 28, 0.60)');
    dark.addColorStop(0.65,'rgba(8, 8, 28, 0.55)');
    dark.addColorStop(1,   'rgba(8, 8, 28, 0.20)');
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = dark;
    // Hình tròn – mềm mại, không vuông
    ctx.beginPath();
    ctx.arc(gx, gy, gr * 1.1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  // ── Filament + nhân sáng khi đèn BẬT ─────────────────────────────────
  if (isLit) {
    const pulse2 = 0.78 + Math.sin(time / 80) * 0.17;
    ctx.save();
    // Quầng filament lớn
    ctx.globalAlpha = pulse2 * 0.9;
    ctx.fillStyle   = '#fffce0';
    ctx.shadowColor = '#fff59d';
    ctx.shadowBlur  = 45;
    ctx.beginPath();
    ctx.arc(gx, gy, 22, 0, Math.PI * 2);
    ctx.fill();
    // Nhân trắng giữa
    ctx.globalAlpha = 1;
    ctx.fillStyle   = '#ffffff';
    ctx.shadowColor = '#ffe082';
    ctx.shadowBlur  = 18;
    ctx.beginPath();
    ctx.arc(gx, gy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}


// ─── Vẽ vùng đích chuôi đèn ──────────────────────────────────────────────
function drawSocketTarget(time) {
  if (state && state.lit) return;
  const socket = gameData.objects.bulb.socket;

  // Mức độ gần đích (0–1)
  let proximity = 0;
  if (state && state.dragging) {
    const dist = Math.hypot(state.wireEnd.x - socket.x, state.wireEnd.y - socket.y);
    proximity = Math.max(0, 1 - dist / GAMEPLAY.snapRadius);
  }

  ctx.save();

  // Màu và bán kính thay đổi theo proximity
  const baseRadius = GAMEPLAY.connectionRadius;  // 42
  const ringR = baseRadius + proximity * 8;
  const glowColor = proximity > 0.2 ? '#22ff88' : '#4fc3f7';
  const alpha = 0.6 + proximity * 0.3;

  // Vòng ngoài bờ khi đang gần (hút vào)
  if (proximity > 0.2) {
    ctx.strokeStyle = `rgba(34, 255, 136, ${proximity * 0.35})`;
    ctx.lineWidth = 8;
    ctx.setLineDash([]);
    ctx.shadowColor = '#22ff88';
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(socket.x, socket.y, ringR + 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Vòng nét đứt chính
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.setLineDash([7, 5]);
  ctx.lineDashOffset = -(time / 30) % 12;
  ctx.globalAlpha = alpha;
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 8 + proximity * 12;
  ctx.beginPath();
  ctx.arc(socket.x, socket.y, ringR, 0, Math.PI * 2);
  ctx.stroke();

  // Nhãn nhỏ "chạm vào đây" khi chưa kéo
  if (!state.dragging && proximity === 0) {
    const labelPulse = 0.55 + (Math.sin(time / 600) + 1) * 0.22;
    ctx.globalAlpha = labelPulse;
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#4fc3f7';
    ctx.font = "800 13px 'Baloo 2','Segoe UI',sans-serif";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('Chạm vào đây!', socket.x, socket.y + ringR + 6);
  }

  ctx.restore();
}


// ─── Vẽ dây dẫn ──────────────────────────────────────────────────────────────
function drawWire(time = performance.now()) {
  const start = gameData.objects.pin.positiveTerminal;
  const end = state.wireEnd;
  const isLit = state && state.lit;
  const isDragging = state && state.dragging;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Bóng đổ dưới dây
  ctx.strokeStyle = "rgba(0,0,0,0.10)";
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.moveTo(start.x + 3, start.y + 4);
  ctx.bezierCurveTo(313, 168, 368, 256, end.x + 3, end.y + 4);
  ctx.stroke();

  // Thân dây – phát sáng khi đang kéo hoặc đã nối
  const wireGlow = isLit ? 18 : (isDragging ? 8 : 0);
  if (wireGlow > 0) {
    ctx.shadowColor = isLit ? "#ffcc22" : "#ff7055";
    ctx.shadowBlur = wireGlow;
  }
  ctx.strokeStyle = VISUALS.wire.body;
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.bezierCurveTo(310, 164, 365, 252, end.x, end.y);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = VISUALS.wire.highlight;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y - 2);
  ctx.bezierCurveTo(310, 162, 365, 250, end.x, end.y);
  ctx.stroke();

  // Đường tia điện chạy trên dây khi đang kéo
  if (isDragging && time % 120 < 80) {
    const t = (time % 700) / 700;
    const arcPt = pointOnCurve(start, { x: 310, y: 164 }, { x: 365, y: 252 }, end, t);
    const arcPt2 = pointOnCurve(start, { x: 310, y: 164 }, { x: 365, y: 252 }, end, Math.min(1, t + 0.15));
    drawElectricArc(arcPt.x, arcPt.y, arcPt2.x, arcPt2.y, 0.7);
  }

  // Đầu dây (tip)
  const tipGlow = isDragging || isLit;
  if (tipGlow) {
    ctx.shadowColor = "#ff8866";
    ctx.shadowBlur = 16;
  }
  ctx.fillStyle = VISUALS.wire.tip;
  ctx.beginPath();
  ctx.arc(end.x, end.y, 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = VISUALS.wire.tipHighlight;
  ctx.beginPath();
  ctx.arc(end.x - 4, end.y - 5, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─── Bézier helper ───────────────────────────────────────────────────────────
function pointOnCurve(start, control1, control2, end, progress) {
  const reverse = 1 - progress;
  return {
    x: reverse ** 3 * start.x
      + 3 * reverse ** 2 * progress * control1.x
      + 3 * reverse * progress ** 2 * control2.x
      + progress ** 3 * end.x,
    y: reverse ** 3 * start.y
      + 3 * reverse ** 2 * progress * control1.y
      + 3 * reverse * progress ** 2 * control2.y
      + progress ** 3 * end.y,
  };
}

// ─── Gợi ý bàn tay ───────────────────────────────────────────────────────────
function drawGuide(time) {
  if (state.lit || state.dragging || time - state.lastAction < GAMEPLAY.hintDelay) return;
  const start = gameData.objects.pin.positiveTerminal;
  const socket = gameData.objects.bulb.socket;
  const pulse = 0.45 + (Math.sin(time / 180) + 1) * 0.24;
  const progress = (time % 1450) / 1450;

  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = VISUALS.hint.color;
  ctx.lineWidth = 7;
  ctx.setLineDash([13, 12]);
  ctx.shadowColor = VISUALS.hint.color;
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(start.x + 8, start.y + 4);
  ctx.bezierCurveTo(365, 188, 550, 282, socket.x, socket.y);
  ctx.stroke();
  ctx.setLineDash([]);

  const guideStart = { x: start.x + 8, y: start.y + 4 };
  const guidePoint = pointOnCurve(
    guideStart,
    { x: 365, y: 188 },
    { x: 550, y: 282 },
    socket,
    progress,
  );
  const handRotation = -0.45;
  const fingerTip = { x: 3, y: -25 };
  const rotatedTipX = Math.cos(handRotation) * fingerTip.x - Math.sin(handRotation) * fingerTip.y;
  const rotatedTipY = Math.sin(handRotation) * fingerTip.x + Math.cos(handRotation) * fingerTip.y;
  ctx.translate(guidePoint.x - rotatedTipX, guidePoint.y - rotatedTipY);
  ctx.rotate(handRotation);
  ctx.fillStyle = VISUALS.hint.hand;
  ctx.strokeStyle = VISUALS.hint.handOutline;
  ctx.lineWidth = 3;
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.roundRect(-9, -2, 21, 27, 9);
  ctx.roundRect(-12, -19, 10, 29, 6);
  ctx.roundRect(-2, -25, 10, 31, 6);
  ctx.roundRect(8, -13, 9, 24, 5);
  ctx.roundRect(-15, 4, 10, 16, 5);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ─── Hiệu ứng pháo hoa kỷ niệm ──────────────────────────────────────────────
function drawCelebration(time) {
  if (!state.lit) return;

  // Ngôi sao lấp lánh truyền thống
  VISUALS.sparkles.forEach(([x, y], index) => {
    const phase = ((time - state.litAt) / 210 + index * 0.17) % 1;
    const radius = 5 + phase * 9;
    ctx.save();
    ctx.globalAlpha = 1 - phase;
    ctx.fillStyle = index % 2 === 0 ? "#ffbb20" : "#ff6ef7";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    for (let point = 0; point < 8; point++) {
      const angle = point * Math.PI / 4;
      const pointRadius = point % 2 ? radius * 0.35 : radius;
      const px = x + Math.cos(angle) * pointRadius;
      const py = y + Math.sin(angle) * pointRadius;
      if (point === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  ctx.globalAlpha = 1;

  // Banner "Giỏi lắm!" sau khi nối thành công
  const elapsed = time - state.litAt;
  if (elapsed < 3000) {
    const bannerAlpha = elapsed < 300 ? elapsed / 300 : (elapsed > 2500 ? 1 - (elapsed - 2500) / 500 : 1);
    const scaleAnim = elapsed < 300 ? 0.7 + (elapsed / 300) * 0.3 : 1;
    ctx.save();
    ctx.globalAlpha = bannerAlpha;
    ctx.translate(480, 90);
    ctx.scale(scaleAnim, scaleAnim);

    // Hộp banner
    ctx.shadowColor = "#ff9900";
    ctx.shadowBlur = 30;
    ctx.fillStyle = "rgba(255, 140, 0, 0.92)";
    ctx.beginPath();
    ctx.roundRect(-130, -30, 260, 60, 16);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 34px 'Baloo 2','Segoe UI',sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("⚡ Giỏi lắm! ⚡", 0, 0);
    ctx.restore();
  }
}


// ─── Vẽ nền phòng thí nghiệm ─────────────────────────────────────────────
function drawBackground(time) {
  const W = canvas.width, H = canvas.height;
  const isLit = state && state.lit;

  // 1. Gradient bầu trời tím-xanh
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.72);
  if (isLit) {
    // Khi đèn sáng: nền ấm áp hơn
    const pulse = 0.5 + Math.sin(time / 130) * 0.05;
    sky.addColorStop(0,   `rgba(45, 20, 90, ${0.97 + pulse * 0.02})`);
    sky.addColorStop(0.5,  'rgba(20, 12, 55, 0.97)');
    sky.addColorStop(1,    'rgba(10, 20, 50, 0.97)');
  } else {
    sky.addColorStop(0,   '#1e1050');
    sky.addColorStop(0.6, '#111830');
    sky.addColorStop(1,   '#0a1428');
  }
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // 2. Lưới mạch điện mờ trang trí (phía sau bên phải)
  ctx.save();
  ctx.globalAlpha = isLit ? 0.10 : 0.055;
  ctx.strokeStyle = isLit ? '#ffe14d' : '#4fc3f7';
  ctx.lineWidth = 1;
  const gridStep = 40;
  // Đường ngang
  for (let y = gridStep; y < H - 60; y += gridStep) {
    ctx.beginPath();
    ctx.moveTo(W * 0.48, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // Đường dọc
  for (let x = W * 0.5; x < W; x += gridStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H - 60);
    ctx.stroke();
  }
  // Chấm tròn tại các giao điểm
  ctx.fillStyle = isLit ? '#ffe14d' : '#4fc3f7';
  for (let y = gridStep; y < H - 60; y += gridStep) {
    for (let x = W * 0.5; x < W; x += gridStep) {
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  // 3. Bàn gỗ (dải ngang phía dưới)
  const deskY = H - 68;
  const deskGrad = ctx.createLinearGradient(0, deskY, 0, H);
  deskGrad.addColorStop(0, '#2a1a0a');
  deskGrad.addColorStop(0.15, '#3d2510');
  deskGrad.addColorStop(1, '#1a0d04');
  ctx.fillStyle = deskGrad;
  ctx.fillRect(0, deskY, W, 68);

  // Cạnh bàn sáng (highlight)
  const edgeGrad = ctx.createLinearGradient(0, deskY, 0, deskY + 4);
  edgeGrad.addColorStop(0, 'rgba(200,140,60,0.55)');
  edgeGrad.addColorStop(1, 'rgba(200,140,60,0)');
  ctx.fillStyle = edgeGrad;
  ctx.fillRect(0, deskY, W, 4);

  // Vân gỗ nhẹ
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = '#c8783c';
  ctx.lineWidth = 1;
  for (let gx = 0; gx < W; gx += 60) {
    ctx.beginPath();
    ctx.moveTo(gx, deskY);
    ctx.lineTo(gx + 20, H);
    ctx.stroke();
  }
  ctx.restore();

  // Bóng in trên bàn khi đèn sáng
  if (isLit) {
    const pulse2 = 0.4 + Math.sin(time / 120) * 0.06;
    const shadowGlow = ctx.createRadialGradient(678, deskY, 5, 678, deskY, 180);
    shadowGlow.addColorStop(0, `rgba(255,220,60,${0.28 * pulse2})`);
    shadowGlow.addColorStop(1, 'rgba(255,180,0,0)');
    ctx.fillStyle = shadowGlow;
    ctx.fillRect(500, deskY - 10, 360, 78);
  }

  // 4. Tiêu đề mini góc trái trên canvas
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#9fa8da';
  ctx.font = "800 12px 'Baloo 2','Segoe UI',sans-serif";
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('⚡ THÍ NGHIỆM MẠCH ĐIỆN', 14, 14);
  ctx.restore();
}

// ─── Vẽ toàn bộ frame ─────────────────────────────────────────────────────
function draw(time = performance.now()) {
  const shake = getShakeOffset(time);
  ctx.save();
  if (shake.x !== 0 || shake.y !== 0) {
    ctx.translate(shake.x, shake.y);
  }
  ctx.clearRect(-20, -20, canvas.width + 40, canvas.height + 40);
  drawBackground(time);   // ← nền phòng thí nghiệm
  drawPin();
  drawBulb(time);
  drawSocketTarget(time);
  drawWire(time);
  drawGuide(time);
  drawParticles();
  drawCelebration(time);
  ctx.restore();
  updateParticles();
}


// ─── Cập nhật đồng hồ đếm ngược gợi ý ────────────────────────────────────
function updateHintCountdown(time) {
  if (state.lit) {
    hintCountdown.textContent = "✓ Hoàn tất";
    hintCountdown.classList.remove("is-active");
    return;
  }
  if (state.dragging) {
    hintCountdown.textContent = "⚡ Đang nối";
    hintCountdown.classList.remove("is-active");
    return;
  }
  const remaining = Math.max(0, Math.ceil((GAMEPLAY.hintDelay - (time - state.lastAction)) / 1000));
  if (remaining === 0) {
    hintCountdown.textContent = "✦ Đang gợi ý";
    hintCountdown.classList.add("is-active");
  } else {
    hintCountdown.textContent = `◷ Chờ (${remaining}s)`;
    hintCountdown.classList.remove("is-active");
  }
}

// ─── Chuyển tọa độ màn hình → Canvas ────────────────────────────────────
function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height,
  };
}

// ─── Sự kiện kéo dây ────────────────────────────────────────────────────
function beginDrag(event) {
  if (state.lit) return;
  const point = canvasPoint(event);
  if (Math.hypot(point.x - state.wireEnd.x, point.y - state.wireEnd.y) > GAMEPLAY.pickRadius) return;
  state.dragging = true;
  state.lastAction = performance.now();
  canvas.setPointerCapture(event.pointerId);
  playPickup();
}

function moveDrag(event) {
  if (!state.dragging) return;
  const point = canvasPoint(event);
  const padding = GAMEPLAY.edgePadding;
  const socket = gameData.objects.bulb.socket;
  const dist = Math.hypot(point.x - socket.x, point.y - socket.y);

  // Hiệu ứng hút (snap): kéo nhẹ về phía socket khi gần
  if (dist < GAMEPLAY.snapRadius && dist > GAMEPLAY.connectionRadius) {
    const snapStrength = (1 - dist / GAMEPLAY.snapRadius) * 0.35;
    state.wireEnd.x = point.x + (socket.x - point.x) * snapStrength;
    state.wireEnd.y = point.y + (socket.y - point.y) * snapStrength;
  } else {
    state.wireEnd.x = Math.max(padding, Math.min(canvas.width - padding, point.x));
    state.wireEnd.y = Math.max(padding, Math.min(canvas.height - padding, point.y));
  }

  // Nối mạch ngay khi đầu dây chạm vùng chuôi đèn
  if (dist < GAMEPLAY.connectionRadius) {
    completeCircuit(event.pointerId);
  }
}

// ─── Hoàn tất mạch ────────────────────────────────────────────────────────
function completeCircuit(pointerId) {
  const socket = gameData.objects.bulb.socket;
  state.wireEnd = { ...socket };
  state.dragging = false;
  state.lit = true;
  state.litAt = performance.now();

  const msg = "Giỏi lắm! Pin làm bóng đèn sáng lên rồi!";
  instructionLabel.textContent = msg;
  if (statusLabel) statusLabel.textContent = msg;

  if (pointerId !== undefined && canvas.hasPointerCapture(pointerId)) {
    canvas.releasePointerCapture(pointerId);
  }

  // Bắn particle tại vị trí socket
  spawnElectricSparks(socket.x, socket.y);
  spawnCelebrationBurst(socket.x, socket.y - 80);

  // Kích hoạt CSS class để UI phản ứng
  const gamePanel = document.querySelector(".game-panel");
  const assistantPanel = document.querySelector(".assistant-panel");
  if (gamePanel) gamePanel.classList.add("lit");
  if (assistantPanel) assistantPanel.classList.add("is-success");

  playSuccess();
  speakPraise();
}

// ─── Thả dây trượt mất ────────────────────────────────────────────────────
function finishDrag() {
  if (!state.dragging) return;
  state.dragging = false;
  const prev = { ...state.wireEnd };
  state.wireEnd = { ...gameData.objects.wireEndStart };
  state.lastAction = performance.now();

  const msg = "Thử lại nhé! Kéo đầu dây tới phần chuôi đèn.";
  instructionLabel.textContent = msg;
  if (statusLabel) statusLabel.textContent = msg;

  spawnMissParticles(prev.x, prev.y);
  triggerShake(4, 250);
  playMiss();
}

// ─── Làm lại game ────────────────────────────────────────────────────────
function restartGame() {
  if (!state) return;
  state.wireEnd = { ...gameData.objects.wireEndStart };
  state.dragging = false;
  state.lit = false;
  state.lastAction = performance.now();
  state.litAt = 0;
  particles = [];
  const gamePanel = document.querySelector(".game-panel");
  const assistantPanel = document.querySelector(".assistant-panel");
  if (gamePanel) gamePanel.classList.remove("lit");
  if (assistantPanel) assistantPanel.classList.remove("is-success");
  const msg = gameData.Text;
  instructionLabel.textContent = msg;
  if (statusLabel) statusLabel.textContent = "Giữ đầu dây đỏ rồi kéo sang chuôi đèn.";
  if (SFX.khen) {
    SFX.khen.pause();
    SFX.khen.currentTime = 0;
  }
  
  // Mặc định bật lại âm thanh khi reset
  if (isMuted) {
    isMuted = false;
    if (muteIcon) muteIcon.textContent = "🔊";
  }

  playRestart();
}

// ─── Âm thanh từ file ─────────────────────────────────────────────────────
// Các Audio object được preload trong initialize().
// Để đổi file: chỉ sửa đường dẫn trong SFX bên dưới.
const SFX = {
  drag:    new Audio('./assets/audio/drag.m4a'),   // bắt đầu kéo dây
  drop:    new Audio('./assets/audio/drop.m4a'),   // thả dây trượt mất
  ting:    new Audio('./assets/audio/Ting.m4a'),   // nối thành công
  click:   new Audio('./assets/audio/click.m4a'),  // nhấn làm lại
  khen:    new Audio('./assets/audio/khen.mp3'),   // đọc lời khen
};

// Preload toàn bộ file âm thanh (gọi trong initialize)
function preloadAudio() {
  Object.values(SFX).forEach(audio => {
    audio.preload = 'auto';
    audio.load();
  });
}

// Phát một âm thanh – reset về đầu nếu đang chạy dở
function playAudio(audio) {
  if (isMuted) return;
  try {
    // Chỉ reset currentTime nếu audio đã load metadata để tránh InvalidStateError
    if (audio.readyState > 0) {
      audio.currentTime = 0;
    }
  } catch (e) {
    // Bỏ qua lỗi currentTime
  }
  
  try {
    audio.play().catch(e => {
      console.warn("Audio play bị chặn:", e);
    });
  } catch (e) {}
}

// Bật/tắt âm thanh
function toggleMute() {
  isMuted = !isMuted;
  if (muteIcon) muteIcon.textContent = isMuted ? "🔇" : "🔊";
  
  // Dừng các âm thanh đang phát dở (đặc biệt là âm thanh dài như tiếng khen)
  if (isMuted) {
    Object.values(SFX).forEach(audio => {
      audio.pause();
    });
  }
}

function playPickup()  { playAudio(SFX.drag);  }
function playMiss()    { playAudio(SFX.drop);  }
function playSuccess() { playAudio(SFX.ting);  }
function playRestart() { playAudio(SFX.click); }

// Phát lời khen
function speakPraise() {
  playAudio(SFX.khen);
}

// ─── Vòng lặp animation ───────────────────────────────────────────────────
function frame(time) {
  draw(time);
  updateHintCountdown(time);
  requestAnimationFrame(frame);
}

// ─── Khởi tạo game ────────────────────────────────────────────────────────
async function initialize() {
  try {
    const response = await fetch("./data/data.json");
    if (!response.ok) throw new Error(`Không tải được data/data.json (${response.status})`);
    gameData = await response.json();
    [pinImage, bulbImage] = await Promise.all([
      loadImage(gameData.objects.pin.src),
      loadImage(gameData.objects.bulb.src),
    ]);
    preloadAudio();
    document.title = gameData.type;
    titleLabel.textContent = gameData.type;
    instructionLabel.textContent = gameData.Text;
    state = {
      wireEnd: { ...gameData.objects.wireEndStart },
      dragging: false,
      lit: false,
      lastAction: performance.now(),
      litAt: 0,
    };
    canvas.addEventListener("pointerdown", beginDrag);
    canvas.addEventListener("pointermove", moveDrag);
    canvas.addEventListener("pointerup", finishDrag);
    canvas.addEventListener("pointercancel", finishDrag);
    restartButton.addEventListener("click", restartGame);
    if (muteButton) muteButton.addEventListener("click", toggleMute);
    requestAnimationFrame(frame);
  } catch (error) {
    console.error(error);
    const msg = "Không tải được game. Hãy chạy qua máy chủ cục bộ.";
    instructionLabel.textContent = msg;
    if (statusLabel) statusLabel.textContent = msg;
  }
}

initialize();
