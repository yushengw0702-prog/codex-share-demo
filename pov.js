const canvas = document.querySelector("#povCanvas");
const ctx = canvas.getContext("2d");

const sourceInput = document.querySelector("#sourceInput");
const resultInput = document.querySelector("#resultInput");
const sourceName = document.querySelector("#sourceName");
const resultName = document.querySelector("#resultName");
const durationRange = document.querySelector("#durationRange");
const durationValue = document.querySelector("#durationValue");
const holdRange = document.querySelector("#holdRange");
const holdValue = document.querySelector("#holdValue");
const timelineNote = document.querySelector("#timelineNote");
const fitMode = document.querySelector("#fitMode");
const playButton = document.querySelector("#playButton");
const exportButton = document.querySelector("#exportButton");
const downloadLink = document.querySelector("#downloadLink");
const statusLine = document.querySelector("#statusLine");
const modeButtons = [...document.querySelectorAll(".mode-button")];

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const FPS = 30;
const INTRO_HOLD = 1.1;

const state = {
  source: null,
  result: null,
  duration: Number(durationRange.value),
  finalHold: Number(holdRange.value),
  fit: fitMode.value,
  mode: "loop",
  playing: false,
  exporting: false,
  startTime: 0,
  elapsed: 0,
  onComplete: null,
};

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t) {
  return t * t * t;
}

function roundedRectPath(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fillRoundRect(x, y, w, h, r, color) {
  roundedRectPath(x, y, w, h, r);
  ctx.fillStyle = color;
  ctx.fill();
}

function strokeRoundRect(x, y, w, h, r, color, width = 1) {
  roundedRectPath(x, y, w, h, r);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawText(text, x, y, options = {}) {
  const {
    size = 24,
    weight = 700,
    color = "#17201d",
    align = "left",
    baseline = "alphabetic",
  } = options;
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px Inter, ui-sans-serif, system-ui, -apple-system, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
}

function setStatus(message) {
  statusLine.textContent = message;
}

function createImageMedia(url, name, objectUrl = false) {
  const image = new Image();
  const media = {
    kind: "image",
    element: image,
    name,
    ready: false,
    error: false,
    objectUrl,
  };

  image.onload = () => {
    media.ready = true;
    media.width = image.naturalWidth;
    media.height = image.naturalHeight;
    setStatus("默认素材已载入。");
  };
  image.onerror = () => {
    media.error = true;
    setStatus(`${name} 无法载入。`);
  };
  image.src = url;
  return media;
}

function createVideoMedia(url, name, objectUrl = false) {
  const video = document.createElement("video");
  const media = {
    kind: "video",
    element: video,
    name,
    ready: false,
    error: false,
    objectUrl,
  };

  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";

  video.addEventListener("loadedmetadata", () => {
    media.width = video.videoWidth;
    media.height = video.videoHeight;
  });
  video.addEventListener("loadeddata", () => {
    media.ready = true;
    media.width = video.videoWidth;
    media.height = video.videoHeight;
    setStatus("默认素材已载入。");
  });
  video.addEventListener("error", () => {
    media.error = true;
    setStatus(`${name} 无法解码，可换成 mp4 / webm 或图片再试。`);
  });

  video.src = url;
  video.load();
  return media;
}

function createMediaFromFile(file, slot) {
  const objectUrl = URL.createObjectURL(file);
  const previous = state[slot];
  const isVideo = file.type.startsWith("video/") || /\.(mov|mp4|webm|m4v)$/i.test(file.name);

  if (previous?.objectUrl) {
    URL.revokeObjectURL(previous.element.src);
  }

  return isVideo
    ? createVideoMedia(objectUrl, file.name, true)
    : createImageMedia(objectUrl, file.name, true);
}

function isRenderable(media) {
  if (!media || media.error || !media.ready) return false;
  if (media.kind === "video") {
    return media.element.videoWidth > 0 && media.element.videoHeight > 0;
  }
  return media.element.naturalWidth > 0 && media.element.naturalHeight > 0;
}

function getMediaSize(media) {
  if (media.kind === "video") {
    return {
      w: media.element.videoWidth || media.width || 16,
      h: media.element.videoHeight || media.height || 9,
    };
  }
  return {
    w: media.element.naturalWidth || media.width || 16,
    h: media.element.naturalHeight || media.height || 9,
  };
}

function drawPlaceholder(rect, label) {
  ctx.save();
  roundedRectPath(rect.x, rect.y, rect.w, rect.h, rect.r || 0);
  ctx.clip();
  ctx.fillStyle = "#1d2723";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 2;
  for (let x = rect.x - rect.h; x < rect.x + rect.w + rect.h; x += 44) {
    ctx.beginPath();
    ctx.moveTo(x, rect.y + rect.h);
    ctx.lineTo(x + rect.h, rect.y);
    ctx.stroke();
  }
  drawText("素材载入中", rect.x + rect.w / 2, rect.y + rect.h / 2 - 8, {
    size: Math.max(16, rect.h * 0.08),
    weight: 840,
    color: "#fffdf7",
    align: "center",
    baseline: "middle",
  });
  drawText(label || "", rect.x + rect.w / 2, rect.y + rect.h / 2 + 28, {
    size: Math.max(12, rect.h * 0.045),
    weight: 650,
    color: "rgba(255, 253, 247, 0.62)",
    align: "center",
    baseline: "middle",
  });
  ctx.restore();
}

function drawMedia(media, rect, options = {}) {
  const {
    fit = state.fit,
    alpha = 1,
    filter = "none",
    background = "#f6f0e6",
    radius = rect.r || 0,
  } = options;

  if (!isRenderable(media)) {
    drawPlaceholder({ ...rect, r: radius }, media?.name || "");
    return;
  }

  const { w: mediaW, h: mediaH } = getMediaSize(media);
  const scale = fit === "cover"
    ? Math.max(rect.w / mediaW, rect.h / mediaH)
    : Math.min(rect.w / mediaW, rect.h / mediaH);
  const drawW = mediaW * scale;
  const drawH = mediaH * scale;
  const drawX = rect.x + (rect.w - drawW) / 2;
  const drawY = rect.y + (rect.h - drawH) / 2;

  ctx.save();
  roundedRectPath(rect.x, rect.y, rect.w, rect.h, radius);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = background;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.filter = filter;
  try {
    ctx.drawImage(media.element, drawX, drawY, drawW, drawH);
  } catch (error) {
    media.error = true;
    drawPlaceholder({ ...rect, r: radius }, media.name);
  }
  ctx.restore();
}

function drawQuadPath(points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
}

function drawMediaInTrapezoid(media, points, options = {}) {
  const {
    fit = "contain",
    background = "#fffdf7",
    alpha = 1,
    filter = "none",
    inset = 0,
    strips = 120,
  } = options;

  const topLeft = points[0];
  const topRight = points[1];
  const bottomRight = points[2];
  const bottomLeft = points[3];
  const topY = topLeft.y + inset;
  const bottomY = bottomLeft.y - inset;
  const height = bottomY - topY;
  if (height <= 1) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  drawQuadPath(points);
  ctx.clip();
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  if (!isRenderable(media)) {
    const minX = Math.min(...points.map((point) => point.x));
    const maxX = Math.max(...points.map((point) => point.x));
    drawPlaceholder({
      x: minX + inset,
      y: topY,
      w: maxX - minX - inset * 2,
      h: height,
      r: 4,
    }, media?.name || "");
    ctx.restore();
    return;
  }

  const { w: mediaW, h: mediaH } = getMediaSize(media);
  const maxTopW = Math.abs(topRight.x - topLeft.x) - inset * 2;
  const maxBottomW = Math.abs(bottomRight.x - bottomLeft.x) - inset * 2;
  const maxW = Math.max(maxTopW, maxBottomW);
  const scale = fit === "cover"
    ? Math.max(maxW / mediaW, height / mediaH)
    : Math.min(maxW / mediaW, height / mediaH);
  const fittedW = mediaW * scale;
  const fittedH = mediaH * scale;
  const sourceX = Math.max(0, (mediaW - maxW / scale) / 2);
  const sourceW = Math.min(mediaW, maxW / scale);
  const sourceY = Math.max(0, (mediaH - height / scale) / 2);
  const sourceH = Math.min(mediaH, height / scale);
  const visibleHeight = Math.min(height, fittedH);
  const yOffset = (height - visibleHeight) / 2;

  ctx.filter = filter;
  for (let i = 0; i < strips; i += 1) {
    const v0 = i / strips;
    const v1 = (i + 1) / strips;
    const mid = (v0 + v1) / 2;
    const leftX = lerp(topLeft.x, bottomLeft.x, mid) + inset;
    const rightX = lerp(topRight.x, bottomRight.x, mid) - inset;
    const rowY0 = topY + yOffset + visibleHeight * v0;
    const rowY1 = topY + yOffset + visibleHeight * v1 + 0.8;
    const rowW = Math.max(1, rightX - leftX);
    const drawW = Math.min(rowW, fittedW);
    const drawX = leftX + (rowW - drawW) / 2;
    const sy = sourceY + sourceH * v0;
    const sh = Math.max(1, sourceH / strips);
    try {
      ctx.drawImage(media.element, sourceX, sy, sourceW, sh, drawX, rowY0, drawW, rowY1 - rowY0);
    } catch (error) {
      media.error = true;
      break;
    }
  }
  ctx.restore();
}

function getTimeline() {
  const total = state.duration;
  const finalHold = Math.min(state.finalHold, total - INTRO_HOLD - 2.5);
  const stableHold = Math.max(2, finalHold);
  const lift = Math.max(2.5, total - INTRO_HOLD - stableHold);
  return {
    total,
    intro: INTRO_HOLD,
    lift,
    finalHold: stableHold,
    liftStart: INTRO_HOLD,
    finalStart: INTRO_HOLD + lift,
  };
}

function syncTimelineControls() {
  const timeline = getTimeline();
  durationValue.textContent = `${state.duration.toFixed(1)}s`;
  holdValue.textContent = `${timeline.finalHold.toFixed(1)}s`;
  holdRange.value = timeline.finalHold.toFixed(1);
  timelineNote.textContent = `俯视停留 ${timeline.intro.toFixed(1)}s，抬镜 ${timeline.lift.toFixed(1)}s，电视前停留 ${timeline.finalHold.toFixed(1)}s。`;
}

function drawEnvironment(cameraT) {
  const t = easeInOutCubic(cameraT);
  const lift = easeOutCubic(clamp((t - 0.10) / 0.90));
  const horizon = lerp(-260, 185, lift);

  const wall = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizon));
  wall.addColorStop(0, "#eee8dc");
  wall.addColorStop(1, "#d9d0c2");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, WIDTH, Math.max(0, horizon));

  const table = ctx.createLinearGradient(0, Math.max(0, horizon), 0, HEIGHT);
  table.addColorStop(0, "#e5dccd");
  table.addColorStop(0.58, "#f7f1e7");
  table.addColorStop(1, "#d8cdbd");
  ctx.fillStyle = table;
  ctx.fillRect(0, Math.max(0, horizon), WIDTH, HEIGHT);

  ctx.save();
  ctx.globalAlpha = 0.15 + t * 0.08;
  ctx.strokeStyle = "#bba994";
  ctx.lineWidth = 1;
  for (let x = -180; x <= WIDTH + 180; x += 74) {
    ctx.beginPath();
    ctx.moveTo(lerp(x, WIDTH / 2 + (x - WIDTH / 2) * 0.35, t), horizon);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  for (let y = horizon + 70; y <= HEIGHT + 120; y += 68) {
    const depth = clamp((y - horizon) / Math.max(1, HEIGHT - horizon));
    ctx.beginPath();
    ctx.moveTo(0, y + depth * depth * 38);
    ctx.lineTo(WIDTH, y + depth * depth * 38);
    ctx.stroke();
  }
  ctx.restore();

  if (horizon > 0) {
    ctx.fillStyle = "rgba(75, 58, 41, 0.12)";
    ctx.fillRect(0, horizon - 2, WIDTH, 4);
  }
}

function drawPaper(cameraT) {
  const t = easeInOutCubic(cameraT);

  const topY = lerp(40, 578, t);
  const bottomY = lerp(686, 812, t);
  const topW = lerp(1088, 330, t);
  const bottomW = lerp(1088, 690, t);
  const drift = lerp(0, -14, t);
  const points = [
    { x: WIDTH / 2 - topW / 2 + drift, y: topY },
    { x: WIDTH / 2 + topW / 2 + drift, y: topY },
    { x: WIDTH / 2 + bottomW / 2 - drift * 0.4, y: bottomY },
    { x: WIDTH / 2 - bottomW / 2 - drift * 0.4, y: bottomY },
  ];

  ctx.save();
  ctx.shadowColor = "rgba(23, 32, 29, 0.18)";
  ctx.shadowBlur = lerp(26, 10, t);
  ctx.shadowOffsetY = lerp(18, 6, t);
  drawQuadPath(points);
  ctx.fillStyle = "#fffdf7";
  ctx.fill();
  ctx.restore();

  const imageInset = lerp(20, 10, t);
  drawMediaInTrapezoid(state.source, points, {
    inset: imageInset,
    fit: "contain",
    background: "#fffdf7",
    filter: `saturate(${1 - t * 0.09}) brightness(${1 - t * 0.04})`,
    strips: 150,
  });

  ctx.save();
  drawQuadPath(points);
  ctx.strokeStyle = "rgba(23, 32, 29, 0.13)";
  ctx.lineWidth = lerp(2, 1, t);
  ctx.stroke();
  ctx.restore();
}

function drawGameCard(t) {
  const alpha = clamp((t - 0.50) / 0.26) * (1 - clamp((t - 0.86) / 0.14));
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha * 0.62;
  const x = WIDTH - 160;
  const y = 635;
  fillRoundRect(x, y, 132, 54, 8, "#d9c7a7");
  fillRoundRect(x + 14, y - 16, 72, 24, 6, "#f7e8b7");
  strokeRoundRect(x, y, 132, 54, 8, "rgba(23, 32, 29, 0.16)", 2);
  drawText("GAME", x + 66, y + 35, {
    size: 17,
    weight: 880,
    color: "rgba(23, 32, 29, 0.62)",
    align: "center",
    baseline: "middle",
  });
  ctx.restore();
}

function drawController(t) {
  const alpha = clamp((t - 0.54) / 0.26) * (1 - clamp((t - 0.84) / 0.16));
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha * 0.58;
  const x = -24;
  const y = 632;
  fillRoundRect(x, y, 178, 62, 26, "#26302b");
  fillRoundRect(x + 28, y + 23, 38, 14, 4, "#101613");
  fillRoundRect(x + 40, y + 11, 14, 38, 4, "#101613");
  ctx.fillStyle = "#f0745e";
  ctx.beginPath();
  ctx.arc(x + 126, y + 28, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#36bfa2";
  ctx.beginPath();
  ctx.arc(x + 148, y + 40, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawScreenContent(screenRect, cameraT) {
  const screenProgress = clamp((cameraT - 0.36) / 0.64);
  ctx.save();
  roundedRectPath(screenRect.x, screenRect.y, screenRect.w, screenRect.h, 16);
  ctx.clip();
  ctx.fillStyle = "#101613";
  ctx.fillRect(screenRect.x, screenRect.y, screenRect.w, screenRect.h);
  drawMedia(state.result, screenRect, {
    fit: "contain",
    background: "#101613",
    radius: 0,
    filter: `saturate(${0.96 + screenProgress * 0.12}) contrast(${1 + screenProgress * 0.04})`,
  });

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#ffffff";
  for (let y = screenRect.y; y < screenRect.y + screenRect.h; y += 5) {
    ctx.fillRect(screenRect.x, y, screenRect.w, 1);
  }

  const sheen = ctx.createLinearGradient(screenRect.x, screenRect.y, screenRect.x + screenRect.w, screenRect.y + screenRect.h);
  sheen.addColorStop(0, "rgba(255, 255, 255, 0.20)");
  sheen.addColorStop(0.32, "rgba(255, 255, 255, 0.04)");
  sheen.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.globalAlpha = 1;
  ctx.fillStyle = sheen;
  ctx.fillRect(screenRect.x, screenRect.y, screenRect.w, screenRect.h);
  ctx.restore();
}

function drawRetroTv(cameraT, stableT) {
  const appear = easeOutCubic(clamp((cameraT - 0.58) / 0.42));
  if (appear <= 0) return;

  const holdPush = easeOutCubic(stableT);
  const settle = Math.sin(stableT * Math.PI) * 0.008;
  const scale = lerp(0.18, 1.38, appear) + holdPush * 0.10 + settle;
  const bodyW = 860 * scale;
  const bodyH = 560 * scale;
  const x = WIDTH / 2 - bodyW / 2;
  const y = lerp(236, -44, appear) - holdPush * 32;
  const r = 34 * scale;

  ctx.save();
  ctx.globalAlpha = appear;
  ctx.shadowColor = "rgba(23, 32, 29, 0.28)";
  ctx.shadowBlur = 34 * scale;
  ctx.shadowOffsetY = 26 * scale;
  fillRoundRect(x, y, bodyW, bodyH, r, "#d8c9ad");
  ctx.shadowColor = "transparent";

  fillRoundRect(x + bodyW * 0.045, y + bodyH * 0.055, bodyW * 0.91, bodyH * 0.86, r * 0.75, "#f3e3c1");
  strokeRoundRect(x, y, bodyW, bodyH, r, "rgba(23, 32, 29, 0.20)", 2.5 * scale);

  const screenW = bodyW * 0.71;
  const screenH = screenW * 0.75;
  const screenRect = {
    x: x + bodyW * 0.05,
    y: y + bodyH * 0.12,
    w: screenW,
    h: screenH,
  };

  fillRoundRect(screenRect.x - 18 * scale, screenRect.y - 18 * scale, screenRect.w + 36 * scale, screenRect.h + 36 * scale, 28 * scale, "#28342f");
  drawScreenContent(screenRect, cameraT);
  strokeRoundRect(screenRect.x, screenRect.y, screenRect.w, screenRect.h, 16 * scale, "rgba(255, 255, 255, 0.18)", 2 * scale);

  const panelX = x + bodyW * 0.81;
  fillRoundRect(panelX, y + bodyH * 0.15, bodyW * 0.16, bodyH * 0.66, 18 * scale, "rgba(255, 253, 247, 0.48)");
  ["#17201d", "#f0745e", "#36bfa2"].forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(panelX + bodyW * 0.08, y + bodyH * (0.27 + index * 0.16), bodyW * 0.025, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.strokeStyle = "rgba(23, 32, 29, 0.20)";
  ctx.lineWidth = 2 * scale;
  for (let i = 0; i < 4; i += 1) {
    const lineY = y + bodyH * (0.58 + i * 0.045);
    ctx.beginPath();
    ctx.moveTo(panelX + bodyW * 0.035, lineY);
    ctx.lineTo(panelX + bodyW * 0.125, lineY);
    ctx.stroke();
  }

  fillRoundRect(x + bodyW * 0.18, y + bodyH * 0.91, bodyW * 0.18, bodyH * 0.08, 8 * scale, "#8c6d4d");
  fillRoundRect(x + bodyW * 0.62, y + bodyH * 0.91, bodyW * 0.18, bodyH * 0.08, 8 * scale, "#8c6d4d");
  ctx.restore();
}

function drawVignette(cameraT) {
  const gradient = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.34, WIDTH / 2, HEIGHT / 2, WIDTH * 0.65);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, `rgba(0, 0, 0, ${0.13 + cameraT * 0.04})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}

function drawFilmGrain(elapsed) {
  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.fillStyle = "#17201d";
  const seed = Math.floor(elapsed * 12);
  for (let i = 0; i < 90; i += 1) {
    const x = (i * 97 + seed * 37) % WIDTH;
    const y = (i * 53 + seed * 71) % HEIGHT;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  ctx.restore();
}

function drawFrame(elapsed) {
  const timeline = getTimeline();
  let cameraT = 0;
  let stableT = 0;

  if (elapsed >= timeline.liftStart) {
    cameraT = clamp((elapsed - timeline.liftStart) / timeline.lift);
  }
  if (elapsed >= timeline.finalStart) {
    stableT = clamp((elapsed - timeline.finalStart) / timeline.finalHold);
  }

  drawEnvironment(cameraT);
  drawPaper(cameraT);
  drawRetroTv(cameraT, stableT);
  drawGameCard(cameraT);
  drawController(cameraT);
  drawVignette(cameraT);
  drawFilmGrain(elapsed);
}

function render(now = performance.now()) {
  if (state.playing) {
    state.elapsed = (now - state.startTime) / 1000;
    const timeline = getTimeline();

    if (state.elapsed >= timeline.total) {
      if (state.mode === "loop" && !state.exporting) {
        restartPlaybackCycle(now);
      } else {
        finishPlayback();
      }
    }
  }

  drawFrame(state.elapsed);
  requestAnimationFrame(render);
}

function setPlayButtonState(isPlaying) {
  const icon = playButton.querySelector(".icon");
  const label = playButton.querySelector("span:last-child");
  if (icon) icon.textContent = isPlaying ? "■" : "▶";
  if (label) label.textContent = isPlaying ? "停止" : "播放";
}

async function seekVideoToStart(media) {
  if (media?.kind !== "video" || media.error) return;
  const video = media.element;
  video.loop = true;
  try {
    if (Number.isFinite(video.duration) && video.duration > 0) {
      video.currentTime = 0;
    }
  } catch (error) {
    media.error = true;
    setStatus(`${media.name} 无法重置到开头。`);
  }
}

async function playVideo(media) {
  if (media?.kind !== "video" || media.error) return;
  try {
    await media.element.play();
  } catch (error) {
    media.error = true;
    setStatus(`${media.name} 无法自动播放。`);
  }
}

async function prepareVideos() {
  await Promise.all([seekVideoToStart(state.source), seekVideoToStart(state.result)]);
  await Promise.all([playVideo(state.source), playVideo(state.result)]);
}

function pauseVideos() {
  [state.source, state.result].forEach((media) => {
    if (media?.kind === "video") {
      media.element.pause();
    }
  });
}

async function startPlayback({ allowLoop = true } = {}) {
  downloadLink.hidden = true;
  await prepareVideos();
  state.elapsed = 0;
  state.startTime = performance.now();
  state.playing = true;
  state.exporting = !allowLoop;
  setPlayButtonState(true);
  setStatus(`${allowLoop && state.mode === "loop" ? "正在循环播放" : "正在播放"} ${state.duration.toFixed(1)}s 横屏转场。`);

  return new Promise((resolve) => {
    state.onComplete = resolve;
  });
}

function restartPlaybackCycle(now) {
  state.elapsed = 0;
  state.startTime = now;
  prepareVideos();
  setStatus(`正在循环播放 ${state.duration.toFixed(1)}s 横屏转场。`);
}

function finishPlayback(message = "横屏转场播放完成。") {
  const timeline = getTimeline();
  state.elapsed = timeline.total;
  state.playing = false;
  state.exporting = false;
  pauseVideos();
  setPlayButtonState(false);
  const complete = state.onComplete;
  state.onComplete = null;
  setStatus(message);
  if (complete) complete();
}

function stopPlayback(message = "已停止播放。") {
  state.playing = false;
  state.exporting = false;
  pauseVideos();
  setPlayButtonState(false);
  const complete = state.onComplete;
  state.onComplete = null;
  setStatus(message);
  if (complete) complete();
}

function getSupportedMimeType() {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

async function exportVideo() {
  if (!canvas.captureStream || !window.MediaRecorder) {
    setStatus("当前浏览器不支持直接导出视频。");
    return;
  }

  if (state.playing) {
    stopPlayback("准备导出。");
  }

  playButton.disabled = true;
  exportButton.disabled = true;
  downloadLink.hidden = true;
  setStatus("正在生成横屏 WebM。");

  try {
    const stream = canvas.captureStream(FPS);
    const mimeType = getSupportedMimeType();
    const recorderOptions = { videoBitsPerSecond: 9_000_000 };
    if (mimeType) recorderOptions.mimeType = mimeType;
    const recorder = new MediaRecorder(stream, recorderOptions);
    const chunks = [];

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) chunks.push(event.data);
    });

    const stopped = new Promise((resolve) => {
      recorder.addEventListener("stop", resolve, { once: true });
    });

    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 120));
    await startPlayback({ allowLoop: false });
    recorder.stop();
    await stopped;

    const blob = new Blob(chunks, { type: mimeType || "video/webm" });
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = "pov-one-take-landscape.webm";
    downloadLink.hidden = false;
    setStatus("横屏 WebM 已生成。");
  } catch (error) {
    stopPlayback("导出失败，请再试一次。");
  } finally {
    playButton.disabled = false;
    exportButton.disabled = false;
    setPlayButtonState(false);
  }
}

function setMode(mode) {
  state.mode = mode;
  modeButtons.forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-checked", String(active));
  });
  setStatus(`完整横屏转场将${mode === "loop" ? "循环播放" : "播完停在电视屏幕前"}。`);
}

sourceInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (!file) return;
  state.source = createMediaFromFile(file, "source");
  sourceName.textContent = file.name;
  state.elapsed = 0;
  setStatus("涂鸦原图已替换。");
});

resultInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (!file) return;
  state.result = createMediaFromFile(file, "result");
  resultName.textContent = file.name;
  state.elapsed = 0;
  setStatus("游戏成品已替换。");
});

durationRange.addEventListener("input", () => {
  state.duration = Number(durationRange.value);
  syncTimelineControls();
});

holdRange.addEventListener("input", () => {
  state.finalHold = Number(holdRange.value);
  syncTimelineControls();
});

fitMode.addEventListener("change", () => {
  state.fit = fitMode.value;
  setStatus(`素材适配：${fitMode.selectedOptions[0].textContent}。`);
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

playButton.addEventListener("click", async () => {
  if (state.playing) {
    stopPlayback();
    return;
  }
  await startPlayback({ allowLoop: true });
});

exportButton.addEventListener("click", exportVideo);

function initDefaults() {
  state.source = createImageMedia(encodeURI("视频素材2/测试1-原图.png"), "测试1-原图.png");
  state.result = createVideoMedia(encodeURI("视频素材2/测试1-成品.mov"), "测试1-成品.mov");
  syncTimelineControls();
}

initDefaults();
requestAnimationFrame(render);
