const canvas = document.querySelector("#previewCanvas");
const ctx = canvas.getContext("2d");

const sourceInput = document.querySelector("#sourceInput");
const resultInput = document.querySelector("#resultInput");
const sourceName = document.querySelector("#sourceName");
const resultName = document.querySelector("#resultName");
const totalDurationRange = document.querySelector("#totalDurationRange");
const totalDurationValue = document.querySelector("#totalDurationValue");
const durationRange = document.querySelector("#durationRange");
const durationValue = document.querySelector("#durationValue");
const timelineNote = document.querySelector("#timelineNote");
const fitMode = document.querySelector("#fitMode");
const playButton = document.querySelector("#playButton");
const exportButton = document.querySelector("#exportButton");
const downloadLink = document.querySelector("#downloadLink");
const statusLine = document.querySelector("#statusLine");
const effectButtons = [...document.querySelectorAll(".effect-button")];
const cameraButtons = [...document.querySelectorAll(".camera-button")];
const playModeButtons = [...document.querySelectorAll(".play-mode-button")];
const uiStyleButtons = [...document.querySelectorAll(".ui-style-button")];

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const MIN_HOLD = 0.55;
const MAX_TRANSITION_DURATION = 8.5;
const FPS = 30;
let stageRect = { x: 54, y: 226, w: 612, h: 548, r: 30 };

const state = {
  source: null,
  result: null,
  uiStyle: "sticker",
  effect: "light",
  cameraEffect: "none",
  totalDuration: Number(totalDurationRange.value),
  transitionDuration: Number(durationRange.value),
  videoMode: "loop",
  fit: fitMode.value,
  playing: false,
  loopTimeline: false,
  exporting: false,
  startTime: 0,
  progress: 0,
  overallProgress: 0,
  cameraProgress: 0,
  resultStarted: false,
  historyOpen: false,
  pageScroll: 0,
  targetScroll: 0,
  hitAreas: {},
  needsRender: true,
  onComplete: null,
};

const ideaStickerFiles = [
  "贴纸素材/拿着剑，可以飞行。.png",
  "贴纸素材/砸到小怪两下，小怪就死亡。.png",
  "贴纸素材/小怪有枪还有盾牌。.png",
  "贴纸素材/通往另一个传送门 .png",
  "贴纸素材/我可以拿到这个奖状.png",
];

const ideaStickers = ideaStickerFiles.map((file, index) => createStickerAsset(file, index));

const stickerShapes = [
  { x: 0.16, y: 0.18, rx: 126, ry: 92, delay: 0.00, rot: -0.16 },
  { x: 0.50, y: 0.22, rx: 150, ry: 100, delay: 0.08, rot: 0.08 },
  { x: 0.82, y: 0.20, rx: 124, ry: 96, delay: 0.16, rot: 0.14 },
  { x: 0.23, y: 0.56, rx: 146, ry: 112, delay: 0.14, rot: 0.12 },
  { x: 0.59, y: 0.56, rx: 178, ry: 122, delay: 0.22, rot: -0.08 },
  { x: 0.86, y: 0.64, rx: 122, ry: 104, delay: 0.28, rot: -0.14 },
  { x: 0.40, y: 0.88, rx: 156, ry: 92, delay: 0.30, rot: 0.06 },
  { x: 0.74, y: 0.88, rx: 148, ry: 98, delay: 0.36, rot: -0.10 },
];

const sparklePoints = Array.from({ length: 42 }, (_, index) => {
  const col = index % 7;
  const row = Math.floor(index / 7);
  const jitterX = ((index * 37) % 19) / 19 * 0.08;
  const jitterY = ((index * 53) % 17) / 17 * 0.08;
  const x = (col + 0.28 + jitterX) / 7;
  const y = (row + 0.32 + jitterY) / 6;
  const distance = Math.hypot(x - 0.5, y - 0.48);
  return {
    x,
    y,
    radius: 38 + ((index * 23) % 42),
    delay: clamp(distance * 0.62 + ((index * 11) % 13) / 13 * 0.18, 0, 0.72),
    spin: (index % 2 ? 1 : -1) * (0.2 + (index % 5) * 0.08),
  };
});

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
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
    maxWidth,
  } = options;

  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", ui-sans-serif, system-ui, -apple-system, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (typeof maxWidth === "number") {
    ctx.fillText(text, x, y, maxWidth);
  } else {
    ctx.fillText(text, x, y);
  }
}

function wrapText(text, x, y, maxWidth, lineHeight, options = {}) {
  const chars = [...text];
  let line = "";
  let cursorY = y;

  ctx.font = `${options.weight || 700} ${options.size || 24}px "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", ui-sans-serif, system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = options.color || "#17201d";
  ctx.textAlign = options.align || "left";
  ctx.textBaseline = "top";

  chars.forEach((char, index) => {
    const testLine = line + char;
    const isLast = index === chars.length - 1;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = char;
      cursorY += lineHeight;
    } else {
      line = testLine;
    }
    if (isLast && line) {
      ctx.fillText(line, x, cursorY);
    }
  });
}

function createStickerAsset(file, index) {
  const image = new Image();
  const text = file
    .replace(/^贴纸素材\//, "")
    .replace(/\.[^.]+$/, "")
    .trim();
  const sticker = {
    image,
    text,
    ready: false,
    index,
  };
  image.onload = () => {
    sticker.ready = true;
    markRender();
  };
  image.src = encodeURI(file);
  return sticker;
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
    setStatus("素材已载入。");
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
  video.loop = state.videoMode === "loop";
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
    setStatus("素材已载入。");
  });
  video.addEventListener("error", () => {
    media.error = true;
    setStatus(`${name} 无法解码，可换成 mp4 或图片再试。`);
  });

  video.src = url;
  video.load();
  return media;
}

function createMediaFromFile(file, slot) {
  const objectUrl = URL.createObjectURL(file);
  const isVideo = file.type.startsWith("video/") || /\.(mov|mp4|webm|m4v)$/i.test(file.name);
  const previous = state[slot];

  if (previous?.objectUrl) {
    URL.revokeObjectURL(previous.element.src);
  }

  return isVideo
    ? createVideoMedia(objectUrl, file.name, true)
    : createImageMedia(objectUrl, file.name, true);
}

function setStatus(message) {
  statusLine.textContent = message;
  markRender();
}

function markRender() {
  state.needsRender = true;
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
    return { w: media.element.videoWidth || media.width || 16, h: media.element.videoHeight || media.height || 9 };
  }
  return { w: media.element.naturalWidth || media.width || 16, h: media.element.naturalHeight || media.height || 9 };
}

function drawPlaceholder(rect, label) {
  ctx.save();
  roundedRectPath(rect.x, rect.y, rect.w, rect.h, rect.r);
  ctx.clip();
  ctx.fillStyle = "#26332d";
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
  ctx.lineWidth = 2;
  for (let x = rect.x - rect.h; x < rect.x + rect.w + rect.h; x += 42) {
    ctx.beginPath();
    ctx.moveTo(x, rect.y + rect.h);
    ctx.lineTo(x + rect.h, rect.y);
    ctx.stroke();
  }

  fillRoundRect(rect.x + rect.w / 2 - 82, rect.y + rect.h / 2 - 82, 164, 164, 28, "rgba(255, 255, 255, 0.10)");
  drawText("素材载入中", rect.x + rect.w / 2, rect.y + rect.h / 2 - 5, {
    size: 28,
    weight: 850,
    color: "#fffdf7",
    align: "center",
    baseline: "middle",
  });
  drawText(label || "", rect.x + rect.w / 2, rect.y + rect.h / 2 + 38, {
    size: 18,
    weight: 650,
    color: "rgba(255, 253, 247, 0.68)",
    align: "center",
    baseline: "middle",
    maxWidth: rect.w - 80,
  });
  ctx.restore();
}

function drawMedia(media, rect, options = {}) {
  const {
    alpha = 1,
    filter = "none",
    fit = state.fit,
    scale: extraScale = 1,
    offsetX = 0,
    offsetY = 0,
    background = "#17201d",
  } = options;

  if (!isRenderable(media)) {
    drawPlaceholder(rect, media?.name || "");
    return;
  }

  const { w: mediaW, h: mediaH } = getMediaSize(media);
  const scale = fit === "cover"
    ? Math.max(rect.w / mediaW, rect.h / mediaH)
    : Math.min(rect.w / mediaW, rect.h / mediaH);
  const drawW = mediaW * scale * extraScale;
  const drawH = mediaH * scale * extraScale;
  const drawX = rect.x + (rect.w - drawW) / 2 + offsetX;
  const drawY = rect.y + (rect.h - drawH) / 2 + offsetY;

  ctx.save();
  roundedRectPath(rect.x, rect.y, rect.w, rect.h, rect.r);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = background;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.filter = filter;

  try {
    ctx.drawImage(media.element, drawX, drawY, drawW, drawH);
  } catch (error) {
    media.error = true;
    setStatus(`${media.name} 暂时不能绘制到动画里。`);
    drawPlaceholder(rect, media.name);
  }

  ctx.restore();
}

function getCameraTransform(progress) {
  const t = clamp(progress);
  const smooth = easeInOutCubic(t);
  const out = easeOutCubic(t);

  if (state.cameraEffect === "push") {
    return { scale: 1 + out * 0.07, offsetY: -8 * out };
  }

  if (state.cameraEffect === "settle") {
    const settle = clamp(easeOutBack(t), 0, 1.12);
    return { scale: 1 + settle * 0.06, offsetY: -6 * settle };
  }

  if (state.cameraEffect === "slow") {
    return { scale: 1 + t * 0.12, offsetY: -10 * t };
  }

  if (state.cameraEffect === "pan") {
    return {
      scale: 1.045,
      offsetX: (smooth - 0.5) * 26,
      offsetY: -4 * smooth,
    };
  }

  if (state.cameraEffect === "breathe") {
    const pulse = Math.sin(t * Math.PI);
    return { scale: 1 + pulse * 0.035, offsetY: -4 * pulse };
  }

  return { scale: 1, offsetX: 0, offsetY: 0 };
}

function drawResultMedia(options = {}) {
  drawMedia(state.result, stageRect, {
    ...getCameraTransform(state.cameraProgress),
    ...options,
  });
}

function drawShareChrome(progress) {
  state.pageScroll += (state.targetScroll - state.pageScroll) * 0.16;
  state.hitAreas = {};

  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  fillRoundRect(0, 0, WIDTH, HEIGHT, 78, "#ffffff");
  drawIphoneStatusBar();
  drawMiniProgramBar();

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 132, WIDTH, HEIGHT - 132);
  ctx.clip();
  ctx.translate(0, -state.pageScroll);
  drawLandingContent(progress);
  ctx.restore();
}

function drawIphoneStatusBar() {
  drawText("14:50", 50, 43, { size: 24, weight: 800, color: "#141414", baseline: "middle" });
  fillRoundRect(WIDTH / 2 - 88, 16, 176, 34, 18, "#20201e");

  ctx.strokeStyle = "#171713";
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(610 + i * 8, 44);
    ctx.lineTo(610 + i * 8, 36 - i * 3);
    ctx.stroke();
  }
  strokeRoundRect(657, 32, 28, 14, 5, "#171713", 2);
  fillRoundRect(662, 35, 17, 8, 4, "#171713");
}

function drawMiniProgramBar() {
  ctx.save();
  ctx.globalAlpha = 0.98;
  fillRoundRect(0, 56, WIDTH, 76, 0, "#ffffff");
  ctx.restore();
  drawText("‹", 50, 94, { size: 46, weight: 330, color: "#151513", align: "center", baseline: "middle" });
  drawText("朵朵的游戏", WIDTH / 2, 94, { size: 28, weight: 760, color: "#191919", align: "center", baseline: "middle" });
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.08)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  fillRoundRect(574, 68, 100, 46, 23, "#ffffff");
  ctx.restore();
  strokeRoundRect(574, 68, 100, 46, 23, "#e1ded8", 1.5);
  drawText("⋯", 608, 90, { size: 27, weight: 600, color: "#5d5b56", align: "center", baseline: "middle" });
  ctx.strokeStyle = "#e1ded8";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(634, 78);
  ctx.lineTo(634, 104);
  ctx.stroke();
  drawText("○", 652, 91, { size: 21, weight: 560, color: "#6b6862", align: "center", baseline: "middle" });
}

function drawLandingContent(progress) {
  if (state.uiStyle === "poster") {
    drawPosterLandingContent(progress);
    return;
  }

  drawNotebookBackground(132, state.historyOpen ? 5120 : 1480);
  drawCreatorHeader(158);
  drawGameCard(40, 282, 640, 790, progress);
  drawActionButtons(42, 1118);
  if (state.historyOpen) {
    drawHistorySection(1398);
  }
}

function drawNotebookBackground(y, h) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, y, WIDTH, h);

  ctx.save();
  ctx.globalAlpha = 0.34;
  ctx.strokeStyle = "#d8dde1";
  ctx.lineWidth = 1;
  for (let x = 20; x < WIDTH; x += 42) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.stroke();
  }
  for (let py = y + 10; py < y + h; py += 42) {
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(WIDTH, py);
    ctx.stroke();
  }
  ctx.restore();

  const wash = ctx.createLinearGradient(0, y, WIDTH, y + 520);
  wash.addColorStop(0, "rgba(142, 235, 220, 0.24)");
  wash.addColorStop(0.48, "rgba(255, 248, 210, 0.32)");
  wash.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, y, WIDTH, 560);
}

function drawPosterLandingContent(progress) {
  drawPosterBackground(132, state.historyOpen ? 4450 : 1510);
  drawPosterHero(42, 164, 636, 884, progress);
  drawPosterActions(42, 1122);
  if (state.historyOpen) {
    drawPosterHistory(42, 1410);
  }
}

function drawPosterBackground(y, h) {
  const bg = ctx.createLinearGradient(0, y, WIDTH, y + h);
  bg.addColorStop(0, "#f4fbff");
  bg.addColorStop(0.38, "#eef5ff");
  bg.addColorStop(0.72, "#fff0f8");
  bg.addColorStop(1, "#f7fbff");
  ctx.fillStyle = bg;
  ctx.fillRect(0, y, WIDTH, h);

  ctx.save();
  ctx.globalAlpha = 0.26;
  ctx.strokeStyle = "#dce8ff";
  ctx.lineWidth = 1;
  for (let x = 28; x < WIDTH; x += 46) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h);
    ctx.stroke();
  }
  for (let py = y + 18; py < y + h; py += 46) {
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(WIDTH, py);
    ctx.stroke();
  }
  ctx.restore();

  const blueGlow = ctx.createRadialGradient(590, y + 70, 20, 590, y + 70, 270);
  blueGlow.addColorStop(0, "rgba(93, 132, 255, 0.22)");
  blueGlow.addColorStop(1, "rgba(93, 132, 255, 0)");
  ctx.fillStyle = blueGlow;
  ctx.fillRect(340, y, 380, 360);

  const pinkGlow = ctx.createRadialGradient(130, y + 620, 30, 130, y + 620, 360);
  pinkGlow.addColorStop(0, "rgba(255, 82, 164, 0.18)");
  pinkGlow.addColorStop(1, "rgba(255, 82, 164, 0)");
  ctx.fillStyle = pinkGlow;
  ctx.fillRect(0, y + 330, 420, 560);
}

function drawPosterHero(x, y, w, h, progress) {
  drawText("奇咔", x, y + 28, { size: 31, weight: 940, color: "#111111" });
  drawText("火山大冒险 · 已有 86 人接受挑战", x + 188, y + 28, {
    size: 21,
    weight: 620,
    color: "#a3a9b5",
    baseline: "alphabetic",
  });

  ctx.save();
  ctx.shadowColor = "rgba(70, 108, 170, 0.13)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 16;
  fillRoundRect(x, y + 70, w, h - 70, 44, "#ffffff");
  ctx.restore();

  drawPosterStamp(x + w - 184, y + 92, 150);

  fillRoundRect(x + 38, y + 112, 62, 62, 31, "#fff1e9");
  drawText("朵", x + 69, y + 145, { size: 30, weight: 920, color: "#ef623f", align: "center", baseline: "middle" });
  drawText("朵朵 邀请你挑战", x + 118, y + 150, { size: 24, weight: 820, color: "#626b7c", baseline: "middle" });
  drawText("朵朵画了一关", x + 38, y + 232, { size: 46, weight: 940, color: "#3578ff" });
  drawText("邀请你来挑战", x + 38, y + 292, { size: 46, weight: 940, color: "#3578ff" });
  drawText("从一张画纸，到一张会动的游戏卡", x + 42, y + 344, { size: 22, weight: 660, color: "#6c7790" });

  drawPosterStat("接受挑战", "86人", x + 42, y + 410, 0.86);
  drawPosterStat("通过率", "47%", x + 42, y + 474, 0.47);
  drawPosterStat("创作时长", "26分钟", x + 42, y + 538, 0.72);

  const videoRect = { x: x + 48, y: y + 604, w: w - 96, h: 306, r: 28 };
  ctx.save();
  ctx.shadowColor = "rgba(42, 84, 168, 0.16)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;
  fillRoundRect(videoRect.x - 6, videoRect.y - 6, videoRect.w + 12, videoRect.h + 12, 32, "#e8f1ff");
  ctx.restore();
  fillRoundRect(videoRect.x - 1, videoRect.y - 1, videoRect.w + 2, videoRect.h + 2, 29, "#ffffff");

  const oldStageRect = stageRect;
  stageRect = videoRect;
  drawTransition(progress);
  stageRect = oldStageRect;

  drawOutlinedSticker(ideaStickers[0], x + w - 146, y + 408, 112, 0.08);
  drawOutlinedSticker(ideaStickers[4], x + w - 224, y + 520, 86, -0.08);

  drawText("火山大冒险", x + 46, y + h - 46, { size: 32, weight: 940, color: "#1d2636", baseline: "middle" });
  fillRoundRect(x + w - 170, y + h - 78, 128, 44, 22, "#7f7bff");
  drawText("V2 已发布", x + w - 106, y + h - 55, { size: 18, weight: 860, color: "#ffffff", align: "center", baseline: "middle" });
}

function drawPosterStamp(cx, cy, size) {
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#78b6ff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx + size / 2, cy + size / 2, size / 2, 0, Math.PI * 2);
  ctx.stroke();
  drawText("QIKA GAME CARD", cx + size / 2, cy + 28, {
    size: 13,
    weight: 900,
    color: "#78b6ff",
    align: "center",
    baseline: "middle",
  });
  drawText("朵", cx + size / 2, cy + size / 2 + 8, {
    size: 58,
    weight: 920,
    color: "#78b6ff",
    align: "center",
    baseline: "middle",
  });
  ctx.restore();
}

function drawPosterStat(label, value, x, y, amount) {
  drawText(label, x, y, { size: 23, weight: 680, color: "#8a93a4" });
  fillRoundRect(x, y + 22, 170, 13, 7, "#dfe9ff");
  const bar = ctx.createLinearGradient(x, y, x + 170, y);
  bar.addColorStop(0, "#5d8dff");
  bar.addColorStop(1, "#9a8cff");
  fillRoundRect(x, y + 22, 170 * amount, 13, 7, bar);
  drawText(value, x + 190, y + 29, { size: 20, weight: 720, color: "#9eabd0", baseline: "middle" });
}

function drawPosterActions(x, y) {
  const primary = ctx.createLinearGradient(x, y, x + 636, y);
  primary.addColorStop(0, "#4d87ff");
  primary.addColorStop(1, "#8d72ff");
  ctx.save();
  ctx.shadowColor = "rgba(77, 135, 255, 0.24)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 10;
  fillRoundRect(x, y, 636, 82, 41, primary);
  ctx.restore();
  drawText("开始挑战", x + 318, y + 43, { size: 29, weight: 900, color: "#ffffff", align: "center", baseline: "middle" });

  const by = y + 108;
  fillRoundRect(x, by, 636, 74, 37, "rgba(255, 255, 255, 0.82)");
  strokeRoundRect(x, by, 636, 74, 37, "rgba(119, 153, 220, 0.28)", 1.5);
  drawText(state.historyOpen ? "收起创作历程  ▲" : "查看创作历程  ↓", x + 318, by + 39, {
    size: 25,
    weight: 780,
    color: "#3567d6",
    align: "center",
    baseline: "middle",
  });
  state.hitAreas.historyToggle = { x, y: by - state.pageScroll, w: 636, h: 74 };
}

function drawPosterHistory(x, y) {
  drawText("创作历程", x, y, { size: 44, weight: 940, color: "#3578ff" });
  drawText("她怎么把一个想法变成一关游戏", x, y + 46, { size: 21, weight: 640, color: "#6c7790" });

  drawPosterPath(x, y + 106);
  drawPosterStepCard(x, y + 248, 300, 370, "Step1", "从画纸出发", "#ff4fa3");
  drawPosterStepCard(x + 336, y + 248, 300, 370, "Step2", "朵朵的奇思妙想", "#ff4fa3");
  drawPosterVoiceCard(x + 356, y + 422, 244, 84, "完整介绍", "00:31");
  drawPosterStepCard(x, y + 656, 636, 460, "Step3", "试玩后开始改造", "#ff4fa3");
  drawPosterIdeaWall(x + 30, y + 800);
  drawPosterPublishCard(x, y + 1160, 636, 570);
}

function drawPosterPath(x, y) {
  fillRoundRect(x, y, 174, 82, 24, "#ffffff");
  strokeRoundRect(x, y, 174, 82, 24, "#ff4fa3", 4);
  drawText("画画", x + 87, y + 33, { size: 22, weight: 920, color: "#111111", align: "center", baseline: "middle" });
  drawText("原始素材", x + 87, y + 61, { size: 16, weight: 720, color: "#7a7f88", align: "center", baseline: "middle" });
  drawPosterArrow(x + 180, y + 42, x + 244, y + 42);
  fillRoundRect(x + 252, y, 174, 82, 24, "#ffffff");
  strokeRoundRect(x + 252, y, 174, 82, 24, "#ff4fa3", 4);
  drawText("生成", x + 339, y + 33, { size: 22, weight: 920, color: "#111111", align: "center", baseline: "middle" });
  drawText("游戏成品", x + 339, y + 61, { size: 16, weight: 720, color: "#7a7f88", align: "center", baseline: "middle" });
  drawPosterArrow(x + 432, y + 42, x + 496, y + 42);
  fillRoundRect(x + 504, y, 132, 82, 24, "#ffffff");
  strokeRoundRect(x + 504, y, 132, 82, 24, "#ff4fa3", 4);
  drawText("分享", x + 570, y + 43, { size: 22, weight: 920, color: "#111111", align: "center", baseline: "middle" });
}

function drawPosterArrow(x1, y1, x2, y2) {
  ctx.save();
  ctx.strokeStyle = "#ff4fa3";
  ctx.lineWidth = 4;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo((x1 + x2) / 2, y1 - 24, x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawPosterStepCard(x, y, w, h, step, title, accent) {
  ctx.save();
  ctx.shadowColor = "rgba(255, 79, 163, 0.10)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;
  fillRoundRect(x, y, w, h, 34, "#ffffff");
  ctx.restore();
  fillRoundRect(x + 24, y + 26, 116, 44, 4, accent);
  drawText(step, x + 82, y + 51, { size: 25, weight: 940, color: "#ffffff", align: "center", baseline: "middle" });
  drawText(title, x + 34, y + 118, { size: 30, weight: 940, color: "#111111" });
  if (title === "从画纸出发") {
    drawMedia(state.source, { x: x + 34, y: y + 156, w: w - 68, h: 150, r: 22 }, { fit: "contain", background: "#fff7fb" });
    drawText("拿起画纸，构建世界", x + 34, y + 332, { size: 20, weight: 720, color: "#6f7480" });
  } else if (title === "朵朵的奇思妙想") {
    drawText("完整语音介绍", x + 34, y + 160, { size: 21, weight: 760, color: "#ff4fa3" });
    drawText("一个想法冒出来，这关就开始不一样了。", x + 34, y + 198, { size: 20, weight: 700, color: "#333333", maxWidth: w - 68 });
    drawOutlinedSticker(ideaStickers[3], x + w - 122, y + 242, 92, 0.1);
  } else if (title === "试玩后开始改造") {
    drawText("调整了", x + 34, y + 160, { size: 21, weight: 760, color: "#ff4fa3" });
    drawText("喷火机关、小怪", x + 34, y + 198, { size: 22, weight: 860, color: "#111111" });
    drawText("玩了一遍之后，朵朵开始像关卡设计师一样重新摆布局。", x + 34, y + 248, {
      size: 20,
      weight: 700,
      color: "#333333",
      maxWidth: w - 68,
    });
  }
}

function drawPosterVoiceCard(x, y, w, h, title, duration) {
  fillRoundRect(x, y, w, h, 24, "#fff3fa");
  fillRoundRect(x + 18, y + 18, 48, 48, 24, "#ff4fa3");
  drawPlayGlyph(x + 33, y + 25, "#ffffff");
  drawText(title, x + 82, y + 34, { size: 19, weight: 840, color: "#111111" });
  drawText(duration, x + w - 24, y + 48, { size: 17, weight: 700, color: "#9a8f9a", align: "right", baseline: "middle" });
}

function drawPosterIdeaWall(x, y) {
  ideaStickers.forEach((idea, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const sx = x + col * 182 + (row % 2) * 28;
    const sy = y + row * 144;
    drawOutlinedSticker(idea, sx, sy, 88 + (index % 2) * 18, index % 2 ? 0.1 : -0.1);
    wrapText(idea.text, sx + 58, sy + 116, 142, 21, {
      size: 17,
      weight: 760,
      color: "#333333",
      align: "center",
    });
  });
}

function drawPosterPublishCard(x, y, w, h) {
  const bg = ctx.createLinearGradient(x, y, x + w, y + h);
  bg.addColorStop(0, "#ffffff");
  bg.addColorStop(1, "#eef5ff");
  ctx.save();
  ctx.shadowColor = "rgba(77, 135, 255, 0.14)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 12;
  fillRoundRect(x, y, w, h, 36, bg);
  ctx.restore();
  drawText("最终游戏卡", x + 34, y + 58, { size: 32, weight: 940, color: "#3578ff" });
  drawText("火山大冒险已经准备好迎接挑战", x + 34, y + 96, { size: 20, weight: 650, color: "#6c7790" });
  drawMedia(state.result, { x: x + 34, y: y + 132, w: w - 68, h: 318, r: 26 }, { fit: "cover", background: "#ffffff" });
  fillRoundRect(x + 34, y + h - 84, w - 68, 54, 27, "#3578ff");
  drawText("进入挑战", x + w / 2, y + h - 56, { size: 23, weight: 900, color: "#ffffff", align: "center", baseline: "middle" });
}

function drawCreatorHeader(y) {
  drawText("朵朵画了一关", 42, y + 22, { size: 41, weight: 920, color: "#181818" });
  drawText("邀请你来挑战", 42, y + 72, { size: 41, weight: 920, color: "#181818" });
  drawText("从一张画纸，到一张会动的游戏卡", 44, y + 114, { size: 21, weight: 620, color: "#5c6564" });

  ctx.save();
  ctx.shadowColor = "rgba(47, 72, 68, 0.14)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 12;
  fillRoundRect(542, y + 12, 106, 106, 53, "#ffffff");
  ctx.restore();
  fillRoundRect(556, y + 26, 78, 78, 39, "#fff2e9");
  drawText("朵", 595, y + 68, { size: 38, weight: 920, color: "#ef623f", align: "center", baseline: "middle" });
  drawText("86人已玩", 590, y + 138, { size: 19, weight: 800, color: "#139b8e", align: "center", baseline: "middle" });
}

function drawGameCard(x, y, w, h, progress) {
  ctx.save();
  ctx.shadowColor = "rgba(92, 74, 145, 0.16)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 14;
  fillRoundRect(x, y, w, h, 44, "#cdb8ff");
  ctx.restore();

  fillRoundRect(x, y, w, h, 44, "#cdb8ff");
  fillRoundRect(x + 18, y + 18, w - 36, h - 36, 36, "#fcf8ff");
  strokeRoundRect(x + 18, y + 18, w - 36, h - 36, 36, "rgba(112, 84, 192, 0.18)", 1.5);

  fillRoundRect(x + 36, y + 34, 128, 46, 23, "#fff06b");
  drawText("皇冠关卡", x + 100, y + 58, { size: 20, weight: 900, color: "#342a12", align: "center", baseline: "middle" });

  ctx.save();
  ctx.translate(x + w - 212, y + 18);
  ctx.rotate(0.06);
  ctx.shadowColor = "rgba(60, 36, 16, 0.14)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 8;
  fillRoundRect(0, 0, 182, 58, 22, "#ffffff");
  ctx.restore();
  drawText("拍照解锁", x + w - 174, y + 49, { size: 22, weight: 900, color: "#5b3922", baseline: "middle" });
  drawText("LOOK", x + w - 52, y + 31, { size: 15, weight: 900, color: "#9a774f", align: "center", baseline: "middle" });

  const videoRect = { x: x + 42, y: y + 118, w: w - 84, h: 352, r: 28 };
  ctx.save();
  ctx.shadowColor = "rgba(44, 34, 70, 0.16)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 9;
  fillRoundRect(videoRect.x - 8, videoRect.y - 8, videoRect.w + 16, videoRect.h + 16, 32, "#ffffff");
  ctx.restore();
  fillRoundRect(videoRect.x - 4, videoRect.y - 4, videoRect.w + 8, videoRect.h + 8, 30, "#ffffff");

  const oldStageRect = stageRect;
  stageRect = videoRect;
  drawTransition(progress);
  stageRect = oldStageRect;

  drawOutlinedSticker(ideaStickers[0], x + 28, y + 438, 98, -0.16);
  drawOutlinedSticker(ideaStickers[1], x + w - 118, y + 430, 106, 0.16);
  drawOutlinedSticker(ideaStickers[4], x + 274, y + 466, 82, 0.08);

  drawText("火山大冒险", x + 48, y + h - 112, { size: 40, weight: 940, color: "#161616", baseline: "middle" });
  fillRoundRect(x + w - 174, y + h - 140, 124, 44, 22, "#2fc7a4");
  drawText("V2 已发布", x + w - 112, y + h - 117, { size: 18, weight: 860, color: "#ffffff", align: "center", baseline: "middle" });

  drawText("已有 ", x + 50, y + h - 58, { size: 22, weight: 620, color: "#6d6d6d" });
  drawText("86", x + 98, y + h - 58, { size: 24, weight: 920, color: "#ff5a37" });
  drawText(" 人接受挑战  ·  通过率 ", x + 132, y + h - 58, { size: 22, weight: 620, color: "#6d6d6d" });
  drawText("47%", x + 386, y + h - 58, { size: 24, weight: 920, color: "#ff5a37" });
}

function drawCardDecorations(x, y, w, h) {
  ctx.save();
  ctx.globalAlpha = 0.92;
  fillRoundRect(x + 62, y + 512, 100, 34, 17, "#e8f5ff");
  drawText("原创关卡", x + 112, y + 530, { size: 17, weight: 760, color: "#2b78a7", align: "center", baseline: "middle" });
  fillRoundRect(x + 176, y + 512, 124, 34, 17, "#f2ecff");
  drawText("孩子配音", x + 238, y + 530, { size: 17, weight: 760, color: "#7252b8", align: "center", baseline: "middle" });
  fillRoundRect(x + 314, y + 512, 122, 34, 17, "#fff2d6");
  drawText("可试玩", x + 375, y + 530, { size: 17, weight: 760, color: "#a46a16", align: "center", baseline: "middle" });
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#e15e35";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x + 454, y + 532);
  ctx.bezierCurveTo(x + 500, y + 506, x + 548, y + 552, x + 596, y + 520);
  ctx.stroke();
  ctx.restore();
}

function drawActionButtons(x, y) {
  const buttonGradient = ctx.createLinearGradient(x, y, x + 636, y + 84);
  buttonGradient.addColorStop(0, "#ff8a57");
  buttonGradient.addColorStop(1, "#ff5d49");
  ctx.save();
  ctx.shadowColor = "rgba(255, 93, 73, 0.22)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 10;
  fillRoundRect(x, y, 636, 84, 42, buttonGradient);
  ctx.restore();
  drawText("开始挑战", x + 318, y + 44, { size: 29, weight: 900, color: "#ffffff", align: "center", baseline: "middle" });

  const by = y + 112;
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.08)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  fillRoundRect(x, by, 636, 76, 38, "#ffffff");
  ctx.restore();
  strokeRoundRect(x, by, 636, 76, 38, "#e4e6e8", 1.5);
  drawText(state.historyOpen ? "收起创作历程  ▲" : "查看创作历程  ↓", x + 318, by + 40, {
    size: 25,
    weight: 780,
    color: "#191919",
    align: "center",
    baseline: "middle",
  });
  state.hitAreas.historyToggle = { x, y: by - state.pageScroll, w: 636, h: 76 };
}

function drawHistorySection(y) {
  const top = y + 44;
  drawText("创作历程", 46, top, { size: 44, weight: 940, color: "#151515" });
  drawText("她怎么把一个想法变成一关游戏", 48, top + 42, { size: 21, weight: 620, color: "#687170" });
  drawHistoryTabs(46, top + 76);

  drawStoryPanel(40, top + 150, 640, 214, "#fff8ef");
  drawStoryLabel("01", "创作时长", 72, top + 198, "#ff7a55");
  drawTimeSummaryCard(84, top + 238, 556, 98);

  drawStoryPanel(40, top + 408, 640, 486, "#f7fbff");
  drawStoryLabel("02", "从画纸出发", 72, top + 458, "#56b6e8");
  drawPaperOriginCard(162, top + 498, 470, 350);

  drawStoryPanel(40, top + 938, 640, 1008, "#fffaf3");
  drawStoryLabel("03", "朵朵的奇思妙想", 72, top + 986, "#9b7cff");
  drawVoiceCard(80, top + 1038, "完整语音介绍", "00:31");
  drawText("语音拆成几个小规则，贴纸就是她的想象。", 82, top + 1160, { size: 21, weight: 620, color: "#646b68" });
  drawIdeaStickerFlow(80, top + 1238);

  drawStoryPanel(40, top + 1990, 640, 470, "#f7fff9");
  drawStoryLabel("04", "试玩后开始改造", 72, top + 2038, "#2fc7a4");
  drawRevisionCard(80, top + 2090, 560, 142);
  drawText("玩了一遍之后，她开始像关卡设计师一样重新摆布局。", 82, top + 2282, { size: 22, weight: 620, color: "#636c6b", maxWidth: 560 });

  drawStoryPanel(40, top + 2502, 640, 360, "#fff8fb");
  drawStoryLabel("05", "开始升级！加点新变化", 72, top + 2550, "#ff7a9b");
  drawVoiceCard(80, top + 2604, "\"这个射击的频率不用这么高，降...\"", "0:09");
  drawVoiceCard(80, top + 2718, "\"喷火的频率不要太高，然后其他...\"", "0:09");

  drawText("游戏卡发布", 48, top + 2934, { size: 34, weight: 920, color: "#151515" });
  drawPublishCard(54, top + 2982, 612, 578);
}

function drawHistoryTabs(x, y) {
  fillRoundRect(x, y, 138, 42, 21, "#fff1e9");
  drawText("画纸", x + 69, y + 23, { size: 18, weight: 820, color: "#df5d35", align: "center", baseline: "middle" });
  fillRoundRect(x + 152, y, 138, 42, 21, "#eef8ff");
  drawText("语音", x + 221, y + 23, { size: 18, weight: 820, color: "#2b8bb9", align: "center", baseline: "middle" });
  fillRoundRect(x + 304, y, 138, 42, 21, "#f1edff");
  drawText("试玩", x + 373, y + 23, { size: 18, weight: 820, color: "#7659c9", align: "center", baseline: "middle" });
}

function drawStoryPanel(x, y, w, h, color) {
  ctx.save();
  ctx.shadowColor = "rgba(36, 34, 31, 0.07)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;
  fillRoundRect(x, y, w, h, 34, color);
  ctx.restore();
  strokeRoundRect(x, y, w, h, 34, "rgba(30, 30, 30, 0.05)", 1.2);
}

function drawStoryLabel(number, title, x, y, color) {
  fillRoundRect(x, y - 32, 54, 54, 19, color);
  drawText(number, x + 27, y - 4, { size: 20, weight: 900, color: "#ffffff", align: "center", baseline: "middle" });
  drawText(title, x + 72, y - 6, { size: 30, weight: 900, color: "#151515", baseline: "middle" });
}

function drawTimeSummaryCard(x, y, w, h) {
  ctx.save();
  ctx.shadowColor = "rgba(25, 25, 25, 0.06)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 8;
  fillRoundRect(x, y, w, h, 30, "#fff8f0");
  ctx.restore();

  if (h <= 110) {
    fillRoundRect(x + 20, y + 18, 60, 60, 20, "#ffffff");
    drawStopwatchIcon(x + 50, y + 49, "#ff633d", 0.78);
    drawText("用了 ", x + 98, y + 38, { size: 22, weight: 720, color: "#191919" });
    drawText("26分钟", x + 154, y + 38, { size: 27, weight: 940, color: "#ff5a37" });
    drawText("完成这个创作", x + 250, y + 38, { size: 22, weight: 720, color: "#191919" });
    drawText("从画画、讲玩法，到试玩修改，一张游戏卡慢慢长出来。", x + 98, y + 72, {
      size: 18,
      weight: 620,
      color: "#646b68",
      maxWidth: w - 122,
    });
    return;
  }

  fillRoundRect(x + 22, y + 25, 72, 72, 24, "#ffffff");
  drawStopwatchIcon(x + 58, y + 62, "#ff633d");
  drawText("用了 ", x + 112, y + 43, { size: 23, weight: 720, color: "#191919" });
  drawText("26分钟", x + 168, y + 43, { size: 28, weight: 940, color: "#ff5a37" });
  drawText("完成这个创作", x + 112, y + 75, { size: 23, weight: 720, color: "#191919" });
  wrapText("从画画、讲玩法，到试玩修改，一张游戏卡慢慢长出来。", x + 112, y + 100, w - 136, 24, {
    size: 19,
    weight: 620,
    color: "#646b68",
  });
}

function drawPaperOriginCard(x, y, w, h) {
  ctx.save();
  ctx.translate(x + 46, y);
  ctx.rotate(-0.025);
  ctx.shadowColor = "rgba(25, 25, 25, 0.12)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 14;
  fillRoundRect(0, 0, w - 92, 334, 34, "#ffffff");
  ctx.shadowBlur = 0;
  drawMedia(state.source, { x: 28, y: 28, w: w - 148, h: 246, r: 22 }, { fit: "contain", background: "#fffaf0" });
  fillRoundRect(38, 286, 142, 35, 18, "#e9f7ff");
  drawText("原始画纸", 109, 305, { size: 18, weight: 840, color: "#2577a6", align: "center", baseline: "middle" });
  ctx.restore();
  drawText("拿起画纸，构建自己想象的世界。", x + 54, y + 386, { size: 23, weight: 620, color: "#636c6b" });
}

function drawIdeaStickerFlow(x, y) {
  const sizes = [88, 112, 96, 124, 82];
  const nudges = [
    { sx: -8, sy: 2, tx: 116, ty: 6 },
    { sx: 482, sy: 8, tx: 34, ty: 12 },
    { sx: 4, sy: 20, tx: 142, ty: 22 },
    { sx: 452, sy: 8, tx: 34, ty: 18 },
    { sx: 8, sy: 16, tx: 140, ty: 20 },
  ];
  ideaStickers.forEach((idea, index) => {
    const rowY = y + index * 148;
    const left = index % 2 === 0;
    const size = sizes[index] || 96;
    const nudge = nudges[index] || nudges[0];
    const stickerX = x + nudge.sx;
    const stickerY = rowY + nudge.sy;
    const textX = x + nudge.tx;
    const textY = rowY + nudge.ty;
    drawOutlinedSticker(idea, stickerX, stickerY, size, left ? -0.11 : 0.11);
    drawCurvedArrow(left ? stickerX + size - 5 : stickerX + 10, stickerY + size * 0.48, left ? textX - 14 : textX + 362, textY + 39, left);
    drawIdeaTextCard(idea.text, textX, textY, left);
  });
}

function drawStickerBubble(idea, x, y, size) {
  drawOutlinedSticker(idea, x, y, size, 0);
}

function drawIdeaTextCard(text, x, y, left) {
  const w = 348;
  const h = 78;
  const color = left ? "#fff9ed" : "#f7fbff";
  ctx.save();
  ctx.shadowColor = "rgba(40, 40, 40, 0.07)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 8;
  fillRoundRect(x, y, w, h, 24, color);
  ctx.restore();
  strokeRoundRect(x, y, w, h, 24, left ? "#f5dcc0" : "#d8ebf8", 1.4);
  drawText(text, x + w / 2, y + h / 2, {
    size: 21,
    weight: 820,
    color: "#1f1f1f",
    align: "center",
    baseline: "middle",
    maxWidth: w - 34,
  });
}

function drawCurvedArrow(x1, y1, x2, y2, left) {
  ctx.save();
  ctx.strokeStyle = "#ef7650";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  const lift = left ? -34 : 34;
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo((x1 + x2) / 2, y1 + lift, x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.translate(x2, y2);
  ctx.rotate(left ? -0.2 : Math.PI + 0.2);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-12, -7);
  ctx.lineTo(-12, 7);
  ctx.closePath();
  ctx.fillStyle = "#ef7650";
  ctx.fill();
  ctx.restore();
}

function drawRevisionCard(x, y, w, h) {
  ctx.save();
  ctx.shadowColor = "rgba(25, 25, 25, 0.08)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 10;
  fillRoundRect(x, y, w, h, 30, "#ffffff");
  ctx.restore();
  drawText("调整了", x + 30, y + 46, { size: 22, weight: 720, color: "#636c6b" });
  fillRoundRect(x + 30, y + 76, 124, 44, 22, "#ffe2d7");
  drawText("喷火机关", x + 92, y + 99, { size: 18, weight: 820, color: "#d34e2e", align: "center", baseline: "middle" });
  fillRoundRect(x + 174, y + 76, 84, 44, 22, "#ffe2d7");
  drawText("小怪", x + 216, y + 99, { size: 18, weight: 820, color: "#d34e2e", align: "center", baseline: "middle" });
}

function drawOutlinedSticker(idea, x, y, size, rotation = 0) {
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.rotate(rotation);
  ctx.shadowColor = "rgba(20, 20, 20, 0.10)";
  ctx.shadowBlur = 9;
  ctx.shadowOffsetY = 4;

  if (!idea?.ready) {
    fillRoundRect(-size / 2 + 10, -size / 2 + 10, size - 20, size - 20, 22, "#fff7d8");
    drawText("贴", 0, 0, { size: 28, weight: 900, color: "#b47a22", align: "center", baseline: "middle" });
    ctx.restore();
    return;
  }

  const d = size;
  ctx.filter = "brightness(0) invert(1)";
  const offsets = [
    [-7, 0], [7, 0], [0, -7], [0, 7],
    [-5, -5], [5, -5], [-5, 5], [5, 5],
    [-3, 0], [3, 0], [0, -3], [0, 3],
  ];
  offsets.forEach(([ox, oy]) => {
    ctx.drawImage(idea.image, -d / 2 + ox, -d / 2 + oy, d, d);
  });
  ctx.filter = "none";
  ctx.drawImage(idea.image, -d / 2, -d / 2, d, d);
  ctx.restore();
}

function drawStopwatchIcon(cx, cy, color, scale = 1) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(0, 2, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(0, -27);
  ctx.moveTo(-8, -24);
  ctx.lineTo(8, -24);
  ctx.moveTo(0, 2);
  ctx.lineTo(0, -8);
  ctx.moveTo(0, 2);
  ctx.lineTo(8, 8);
  ctx.stroke();
  ctx.restore();
}

function drawStepDot(x, y, active, filled = false) {
  if (filled) {
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(x, y, 17, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = active ? "#111111" : "#d6dadc";
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = active ? "#111111" : "#d6dadc";
  ctx.beginPath();
  ctx.arc(x, y, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawVoiceCard(x, y, title, duration) {
  ctx.save();
  ctx.shadowColor = "rgba(25, 25, 25, 0.06)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;
  fillRoundRect(x, y, 570, 86, 28, "#ffffff");
  ctx.restore();
  fillRoundRect(x + 22, y + 16, 54, 54, 27, "#ff7a55");
  drawPlayGlyph(x + 40, y + 25, "#ffffff");
  drawText(title, x + 98, y + 34, { size: 22, weight: 820, color: "#191919" });
  ctx.strokeStyle = "#ffd0c1";
  ctx.lineWidth = 4;
  for (let i = 0; i < 16; i += 1) {
    const h = 8 + ((i * 13) % 24);
    ctx.beginPath();
    ctx.moveTo(x + 98 + i * 11, y + 62 - h / 2);
    ctx.lineTo(x + 98 + i * 11, y + 62 + h / 2);
    ctx.stroke();
  }
  drawText(duration, x + 534, y + 50, { size: 19, weight: 600, color: "#929292", align: "right", baseline: "middle" });
}

function drawPublishCard(x, y, w, h) {
  ctx.save();
  ctx.shadowColor = "rgba(92, 74, 145, 0.14)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 14;
  fillRoundRect(x, y, w, h, 36, "#cdb8ff");
  ctx.restore();
  fillRoundRect(x, y, w, h, 36, "#cdb8ff");
  fillRoundRect(x + 18, y + 18, w - 36, h - 36, 30, "#fcf8ff");
  fillRoundRect(x + 34, y + 34, 78, 36, 18, "#fff06b");
  drawText("V2", x + 73, y + 53, { size: 18, weight: 920, color: "#4b3b09", align: "center", baseline: "middle" });
  fillRoundRect(x + w - 164, y + 32, 120, 40, 20, "#2fc7a4");
  drawText("已发布", x + w - 104, y + 53, { size: 18, weight: 860, color: "#ffffff", align: "center", baseline: "middle" });
  drawText("朵朵的世界完成，", x + 40, y + 122, { size: 31, weight: 920, color: "#171717" });
  drawText("准备迎接挑战！", x + 40, y + 166, { size: 31, weight: 920, color: "#171717" });
  const previewRect = { x: x + 40, y: y + 224, w: w - 80, h: 308, r: 24 };
  ctx.save();
  ctx.shadowColor = "rgba(44, 34, 70, 0.12)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 8;
  fillRoundRect(previewRect.x - 6, previewRect.y - 6, previewRect.w + 12, previewRect.h + 12, 28, "#ffffff");
  ctx.restore();
  drawMedia(state.result, previewRect, { fit: "cover", background: "#fffaf0" });
  drawOutlinedSticker(ideaStickers[4], x + 46, y + 496, 82, -0.08);
  drawOutlinedSticker(ideaStickers[1], x + w - 124, y + 482, 96, 0.13);
}

function drawPlayGlyph(x, y, color) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + 36);
  ctx.lineTo(x + 31, y + 18);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawStageBase() {
  fillRoundRect(stageRect.x, stageRect.y, stageRect.w, stageRect.h, stageRect.r, "#17201d");
}

function drawLightTransition(p) {
  drawMedia(state.source, stageRect, {
    filter: `saturate(${1 - p * 0.18}) brightness(${1 - p * 0.05})`,
  });

  const revealX = stageRect.x + stageRect.w * clamp(p * 1.04 - 0.02);
  ctx.save();
  roundedRectPath(stageRect.x, stageRect.y, stageRect.w, stageRect.h, stageRect.r);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(stageRect.x, stageRect.y, Math.max(0, revealX - stageRect.x), stageRect.h);
  ctx.clip();
  drawMedia(state.result, stageRect, { filter: `saturate(${1 + p * 0.04})` });
  ctx.restore();

  if (p > 0.02 && p < 0.98) {
    ctx.save();
    roundedRectPath(stageRect.x, stageRect.y, stageRect.w, stageRect.h, stageRect.r);
    ctx.clip();
    const band = 64;
    const glow = ctx.createLinearGradient(revealX - band, 0, revealX + band, 0);
    glow.addColorStop(0, "rgba(255, 255, 255, 0)");
    glow.addColorStop(0.36, "rgba(245, 197, 66, 0.28)");
    glow.addColorStop(0.50, "rgba(255, 255, 255, 0.90)");
    glow.addColorStop(0.64, "rgba(54, 191, 162, 0.34)");
    glow.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(revealX - band, stageRect.y, band * 2, stageRect.h);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.86)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(revealX + Math.sin(p * 10) * 8, stageRect.y + 22);
    ctx.lineTo(revealX - Math.sin(p * 9) * 8, stageRect.y + stageRect.h - 22);
    ctx.stroke();
    ctx.restore();
  }
}

function drawStickerTransition(p) {
  drawMedia(state.source, stageRect, {
    filter: `saturate(${1 - p * 0.16}) brightness(${1 - p * 0.04})`,
  });

  ctx.save();
  roundedRectPath(stageRect.x, stageRect.y, stageRect.w, stageRect.h, stageRect.r);
  ctx.clip();
  ctx.beginPath();
  stickerShapes.forEach((shape) => {
    const local = clamp((p - shape.delay) / 0.55);
    if (local <= 0) return;
    const grow = clamp(easeOutBack(local), 0, 1.15);
    const cx = stageRect.x + stageRect.w * shape.x;
    const cy = stageRect.y + stageRect.h * shape.y;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(shape.rot);
    ctx.ellipse(0, 0, shape.rx * grow, shape.ry * grow, 0, 0, Math.PI * 2);
    ctx.restore();
  });
  ctx.clip();
  drawMedia(state.result, stageRect);
  ctx.restore();

  ctx.save();
  roundedRectPath(stageRect.x, stageRect.y, stageRect.w, stageRect.h, stageRect.r);
  ctx.clip();
  stickerShapes.forEach((shape) => {
    const local = clamp((p - shape.delay) / 0.55);
    if (local <= 0 || local >= 1) return;
    const grow = clamp(easeOutBack(local), 0, 1.1);
    const cx = stageRect.x + stageRect.w * shape.x;
    const cy = stageRect.y + stageRect.h * shape.y;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(shape.rot);
    ctx.strokeStyle = `rgba(255, 253, 247, ${0.72 * (1 - local)})`;
    ctx.lineWidth = 7;
    ctx.ellipse(0, 0, shape.rx * grow, shape.ry * grow, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
  ctx.restore();
}

function drawBrushTransition(p) {
  drawMedia(state.source, stageRect, {
    filter: `saturate(${1 - p * 0.22}) brightness(${1 - p * 0.06})`,
  });

  const threshold = stageRect.x + stageRect.w * (p * 1.08 - 0.04);

  ctx.save();
  roundedRectPath(stageRect.x, stageRect.y, stageRect.w, stageRect.h, stageRect.r);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(stageRect.x, stageRect.y);
  for (let y = stageRect.y; y <= stageRect.y + stageRect.h; y += 12) {
    const wave = Math.sin(y * 0.032 + p * 4) * 18 + Math.sin(y * 0.071) * 8;
    ctx.lineTo(threshold + wave, y);
  }
  ctx.lineTo(stageRect.x, stageRect.y + stageRect.h);
  ctx.closePath();
  ctx.clip();
  drawMedia(state.result, stageRect);
  ctx.restore();

  if (p > 0.02 && p < 0.98) {
    ctx.save();
    roundedRectPath(stageRect.x, stageRect.y, stageRect.w, stageRect.h, stageRect.r);
    ctx.clip();
    ctx.strokeStyle = "rgba(23, 32, 29, 0.34)";
    ctx.lineWidth = 16;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let y = stageRect.y + 20; y <= stageRect.y + stageRect.h - 20; y += 28) {
      const wave = Math.sin(y * 0.032 + p * 4) * 18 + Math.sin(y * 0.071) * 8;
      if (y === stageRect.y + 20) ctx.moveTo(threshold + wave, y);
      else ctx.lineTo(threshold + wave, y);
    }
    ctx.stroke();

    ctx.strokeStyle = "rgba(245, 197, 66, 0.82)";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.restore();
  }
}

function drawTilesTransition(p) {
  drawMedia(state.source, stageRect, {
    filter: `saturate(${1 - p * 0.2}) brightness(${1 - p * 0.05})`,
  });

  if (p > 0.94) {
    drawMedia(state.result, stageRect);
    return;
  }

  const cols = 12;
  const rows = 10;
  const cellW = stageRect.w / cols;
  const cellH = stageRect.h / rows;
  const centerX = (cols - 1) / 2;
  const centerY = (rows - 1) / 2;
  const maxDist = Math.hypot(centerX, centerY);

  ctx.save();
  roundedRectPath(stageRect.x, stageRect.y, stageRect.w, stageRect.h, stageRect.r);
  ctx.clip();

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const dist = Math.hypot(col - centerX, row - centerY) / maxDist;
      const jitter = ((row * 17 + col * 29) % 19) / 19 * 0.18;
      const threshold = dist * 0.52 + jitter;
      const local = clamp((p - threshold) / 0.34);
      if (local <= 0) continue;

      const x = stageRect.x + col * cellW;
      const y = stageRect.y + row * cellH;
      const inset = (1 - easeOutCubic(local)) * Math.min(cellW, cellH) * 0.20;

      ctx.save();
      ctx.globalAlpha = easeOutCubic(local);
      ctx.beginPath();
      ctx.rect(x + inset, y + inset, cellW - inset * 2 + 0.5, cellH - inset * 2 + 0.5);
      ctx.clip();
      drawMedia(state.result, stageRect);
      ctx.restore();

      if (local < 1) {
        ctx.save();
        ctx.globalAlpha = (1 - local) * 0.42;
        ctx.fillStyle = "#fffdf7";
        ctx.fillRect(x + inset, y + inset, cellW - inset * 2, cellH - inset * 2);
        ctx.restore();
      }
    }
  }

  ctx.restore();
}

function drawFocusTransition(p) {
  drawMedia(state.source, stageRect, {
    alpha: 1 - p * 0.48,
    filter: `blur(${p * 3.6}px) saturate(${1 - p * 0.18}) brightness(${1 - p * 0.05})`,
    scale: 1 + p * 0.08,
  });

  const radius = Math.hypot(stageRect.w, stageRect.h) * easeOutCubic(p);
  const cx = stageRect.x + stageRect.w * (0.52 + Math.sin(p * Math.PI) * 0.03);
  const cy = stageRect.y + stageRect.h * 0.52;

  ctx.save();
  roundedRectPath(stageRect.x, stageRect.y, stageRect.w, stageRect.h, stageRect.r);
  ctx.clip();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  drawMedia(state.result, stageRect, {
    scale: 1.12 - p * 0.12,
    filter: `saturate(${1 + p * 0.06})`,
  });
  ctx.restore();

  if (p > 0.03 && p < 0.98) {
    ctx.save();
    roundedRectPath(stageRect.x, stageRect.y, stageRect.w, stageRect.h, stageRect.r);
    ctx.clip();
    ctx.strokeStyle = `rgba(255, 253, 247, ${0.8 * (1 - p)})`;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(54, 191, 162, ${0.48 * (1 - p)})`;
    ctx.lineWidth = 28;
    ctx.stroke();
    ctx.restore();
  }
}

function drawPageTransition(p) {
  drawMedia(state.source, stageRect, {
    filter: `saturate(${1 - p * 0.12}) brightness(${1 - p * 0.06})`,
  });

  const revealX = stageRect.x + stageRect.w * easeInOutCubic(p);
  ctx.save();
  roundedRectPath(stageRect.x, stageRect.y, stageRect.w, stageRect.h, stageRect.r);
  ctx.clip();
  ctx.beginPath();
  ctx.rect(stageRect.x, stageRect.y, Math.max(0, revealX - stageRect.x), stageRect.h);
  ctx.clip();
  drawMedia(state.result, stageRect);
  ctx.restore();

  if (p > 0.02 && p < 0.99) {
    ctx.save();
    roundedRectPath(stageRect.x, stageRect.y, stageRect.w, stageRect.h, stageRect.r);
    ctx.clip();
    const foldWidth = 78;
    const fold = ctx.createLinearGradient(revealX - foldWidth, 0, revealX + 8, 0);
    fold.addColorStop(0, "rgba(255, 253, 247, 0)");
    fold.addColorStop(0.42, "rgba(255, 253, 247, 0.82)");
    fold.addColorStop(0.72, "rgba(217, 226, 221, 0.42)");
    fold.addColorStop(1, "rgba(23, 32, 29, 0.18)");
    ctx.fillStyle = fold;
    ctx.beginPath();
    ctx.moveTo(revealX - foldWidth, stageRect.y);
    ctx.quadraticCurveTo(revealX + 14, stageRect.y + stageRect.h * 0.18, revealX - 8, stageRect.y + stageRect.h);
    ctx.lineTo(revealX + 18, stageRect.y + stageRect.h);
    ctx.lineTo(revealX + 18, stageRect.y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(23, 32, 29, 0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(revealX + 5, stageRect.y + 12);
    ctx.quadraticCurveTo(revealX - 10, stageRect.y + stageRect.h * 0.52, revealX + 4, stageRect.y + stageRect.h - 12);
    ctx.stroke();
    ctx.restore();
  }
}

function drawStar(cx, cy, outerRadius, innerRadius, rotation, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const radius = point % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + point * Math.PI / 5;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (point === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function drawSparkleTransition(p) {
  drawMedia(state.source, stageRect, {
    filter: `saturate(${1 - p * 0.18}) brightness(${1 - p * 0.04})`,
  });

  ctx.save();
  roundedRectPath(stageRect.x, stageRect.y, stageRect.w, stageRect.h, stageRect.r);
  ctx.clip();
  ctx.beginPath();
  sparklePoints.forEach((point) => {
    const local = clamp((p - point.delay) / 0.42);
    if (local <= 0) return;
    const cx = stageRect.x + stageRect.w * point.x;
    const cy = stageRect.y + stageRect.h * point.y;
    ctx.moveTo(cx + point.radius * easeOutCubic(local), cy);
    ctx.arc(cx, cy, point.radius * easeOutCubic(local), 0, Math.PI * 2);
  });
  ctx.clip();
  drawMedia(state.result, stageRect);
  ctx.restore();

  ctx.save();
  roundedRectPath(stageRect.x, stageRect.y, stageRect.w, stageRect.h, stageRect.r);
  ctx.clip();
  sparklePoints.forEach((point, index) => {
    const local = clamp((p - point.delay) / 0.42);
    if (local <= 0 || local >= 1) return;
    const cx = stageRect.x + stageRect.w * point.x;
    const cy = stageRect.y + stageRect.h * point.y;
    const opacity = Math.sin(local * Math.PI) * 0.72;
    const size = 7 + (index % 4) * 2;
    drawStar(cx, cy, size, size * 0.42, point.spin + p * 1.8, `rgba(245, 197, 66, ${opacity})`);
  });
  ctx.restore();
}

function drawOutlineTransition(p) {
  drawMedia(state.source, stageRect, {
    filter: `saturate(${1 - p * 0.16}) brightness(${1 - p * 0.05})`,
  });

  const eased = easeInOutCubic(p);
  const insetX = stageRect.w * 0.5 * (1 - eased);
  const insetY = stageRect.h * 0.5 * (1 - eased);
  const revealRect = {
    x: stageRect.x + insetX,
    y: stageRect.y + insetY,
    w: stageRect.w - insetX * 2,
    h: stageRect.h - insetY * 2,
    r: Math.max(18, stageRect.r * eased),
  };

  if (revealRect.w > 1 && revealRect.h > 1) {
    ctx.save();
    roundedRectPath(revealRect.x, revealRect.y, revealRect.w, revealRect.h, revealRect.r);
    ctx.clip();
    drawMedia(state.result, stageRect, { scale: 1.04 - p * 0.04 });
    ctx.restore();

    ctx.save();
    ctx.shadowColor = "rgba(54, 191, 162, 0.52)";
    ctx.shadowBlur = 18;
    strokeRoundRect(revealRect.x, revealRect.y, revealRect.w, revealRect.h, revealRect.r, "rgba(255, 253, 247, 0.94)", 6);
    ctx.shadowBlur = 0;
    strokeRoundRect(revealRect.x + 5, revealRect.y + 5, revealRect.w - 10, revealRect.h - 10, Math.max(12, revealRect.r - 5), "rgba(54, 191, 162, 0.58)", 3);
    ctx.restore();
  }
}

function drawTransition(progress) {
  drawStageBase();
  const p = easeInOutCubic(clamp(progress));

  if (p <= 0.001) {
    drawMedia(state.source, stageRect);
  } else if (p >= 0.999) {
    drawResultMedia();
  } else if (state.effect === "sticker") {
    drawStickerTransition(p);
  } else if (state.effect === "brush") {
    drawBrushTransition(p);
  } else if (state.effect === "tiles") {
    drawTilesTransition(p);
  } else if (state.effect === "focus") {
    drawFocusTransition(p);
  } else if (state.effect === "page") {
    drawPageTransition(p);
  } else if (state.effect === "sparkle") {
    drawSparkleTransition(p);
  } else if (state.effect === "outline") {
    drawOutlineTransition(p);
  } else {
    drawLightTransition(p);
  }

  strokeRoundRect(stageRect.x, stageRect.y, stageRect.w, stageRect.h, stageRect.r, "rgba(23, 32, 29, 0.13)", 2);
}

function getTimeline() {
  const total = Math.max(Number(totalDurationRange.min), state.totalDuration);
  const maxTransition = Math.max(1.2, Math.min(MAX_TRANSITION_DURATION, total - MIN_HOLD * 2));
  const transitionDuration = clamp(state.transitionDuration, Number(durationRange.min), maxTransition);
  const holdBudget = Math.max(MIN_HOLD * 2, total - transitionDuration);
  const intro = clamp(holdBudget * 0.38, MIN_HOLD, holdBudget - MIN_HOLD);
  const outro = Math.max(MIN_HOLD, holdBudget - intro);

  return {
    total,
    intro,
    outro,
    transitionDuration,
    transitionStart: intro,
    transitionEnd: intro + transitionDuration,
  };
}

function syncTimingControls() {
  const timeline = getTimeline();
  const maxTransition = Math.max(1.2, Math.min(MAX_TRANSITION_DURATION, state.totalDuration - MIN_HOLD * 2));
  durationRange.max = maxTransition.toFixed(1);
  state.transitionDuration = timeline.transitionDuration;
  totalDurationRange.value = state.totalDuration.toFixed(1);
  durationRange.value = state.transitionDuration.toFixed(1);
  totalDurationValue.textContent = `${state.totalDuration.toFixed(1)}s`;
  durationValue.textContent = `${state.transitionDuration.toFixed(1)}s`;
  timelineNote.textContent = `原始停留 ${timeline.intro.toFixed(1)}s，转场 ${timeline.transitionDuration.toFixed(1)}s，成果停留 ${timeline.outro.toFixed(1)}s。`;
  markRender();
}

function render(now = performance.now()) {
  const scrollAnimating = Math.abs(state.targetScroll - state.pageScroll) > 0.5;

  if (state.playing) {
    const elapsed = (now - state.startTime) / 1000;
    const timeline = getTimeline();

    state.overallProgress = clamp(elapsed / timeline.total);

    if (!state.resultStarted && elapsed >= timeline.transitionStart) {
      state.resultStarted = true;
      playVideoFromStart(state.result);
    }

    if (elapsed < timeline.transitionStart) {
      state.progress = 0;
      state.cameraProgress = 0;
    } else if (elapsed < timeline.transitionEnd) {
      state.progress = (elapsed - timeline.transitionStart) / timeline.transitionDuration;
      state.cameraProgress = 0;
    } else {
      state.progress = 1;
      state.cameraProgress = clamp((elapsed - timeline.transitionEnd) / timeline.outro);
    }

    if (elapsed >= timeline.total) {
      if (shouldLoopTimeline()) {
        restartTimelineCycle(now);
      } else {
        finishPlayback();
      }
    }
  }

  if (state.playing || state.exporting || scrollAnimating || state.needsRender) {
    drawShareChrome(state.progress);
    state.needsRender = false;
    if (!state.playing && Math.abs(state.targetScroll - state.pageScroll) <= 0.5) {
      state.pageScroll = state.targetScroll;
    }
  }

  requestAnimationFrame(render);
}

function shouldLoopTimeline() {
  return state.playing && !state.exporting && state.videoMode === "loop";
}

function restartTimelineCycle(now) {
  state.progress = 0;
  state.overallProgress = 0;
  state.cameraProgress = 0;
  state.resultStarted = false;
  state.startTime = now;
  prepareVideosForPlayback();
  setStatus(`正在循环播放 ${state.totalDuration.toFixed(1)}s 转场。`);
}

function finishPlayback(message = "转场播放完成。") {
  state.progress = 1;
  state.overallProgress = 1;
  state.cameraProgress = 1;
  state.playing = false;
  state.loopTimeline = false;
  pauseVideos();
  setPlayButtonState(false);
  const complete = state.onComplete;
  state.onComplete = null;
  setStatus(message);
  if (complete) complete();
}

function stopPlayback(message = "已停止播放。") {
  state.playing = false;
  state.loopTimeline = false;
  pauseVideos();
  setPlayButtonState(false);
  const complete = state.onComplete;
  state.onComplete = null;
  setStatus(message);
  if (complete) complete();
}

function applyVideoMode() {
  [state.source, state.result].forEach((media) => {
    if (media?.kind === "video") {
      media.element.loop = state.videoMode === "loop";
    }
  });
}

async function seekVideoToStart(media) {
  if (media?.kind !== "video" || media.error) return;
  const video = media.element;
  video.loop = state.videoMode === "loop";

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

async function playVideoFromStart(media) {
  await seekVideoToStart(media);
  await playVideo(media);
}

async function prepareVideosForPlayback() {
  applyVideoMode();
  await Promise.all([seekVideoToStart(state.source), seekVideoToStart(state.result)]);
  if (state.result?.kind === "video") {
    state.result.element.pause();
  }
  await playVideo(state.source);
}

function pauseVideos() {
  [state.source, state.result].forEach((media) => {
    if (media?.kind === "video") {
      media.element.pause();
    }
  });
}

function setPlayButtonState(isPlaying) {
  const icon = playButton.querySelector(".icon");
  const label = playButton.querySelector("span:last-child");
  if (icon) icon.textContent = isPlaying ? "■" : "▶";
  if (label) label.textContent = isPlaying ? "停止" : "播放";
}

async function playAnimation({ allowLoop = true } = {}) {
  downloadLink.hidden = true;
  await prepareVideosForPlayback();
  state.progress = 0;
  state.overallProgress = 0;
  state.cameraProgress = 0;
  state.resultStarted = false;
  state.loopTimeline = allowLoop && state.videoMode === "loop";
  state.startTime = performance.now();
  state.playing = true;
  setPlayButtonState(true);
  setStatus(`${state.loopTimeline ? "正在循环播放" : "正在播放"} ${state.totalDuration.toFixed(1)}s 转场。`);

  return new Promise((resolve) => {
    state.onComplete = resolve;
  });
}

function getSupportedMimeType() {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

async function exportAnimation() {
  if (!canvas.captureStream || !window.MediaRecorder) {
    setStatus("当前浏览器不支持直接导出视频。");
    return;
  }

  if (state.playing) {
    stopPlayback("准备导出。");
  }

  playButton.disabled = true;
  exportButton.disabled = true;
  state.exporting = true;
  downloadLink.hidden = true;
  setStatus("正在生成 WebM。");

  try {
    const stream = canvas.captureStream(FPS);
    const mimeType = getSupportedMimeType();
    const recorderOptions = { videoBitsPerSecond: 8_000_000 };
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
    await playAnimation({ allowLoop: false });
    recorder.stop();
    await stopped;

    const blob = new Blob(chunks, { type: mimeType || "video/webm" });
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = `share-transition-${state.effect}-${state.cameraEffect}.webm`;
    downloadLink.hidden = false;
    setStatus("WebM 已生成。");
  } catch (error) {
    stopPlayback("导出失败，请再试一次。");
  } finally {
    state.exporting = false;
    playButton.disabled = false;
    exportButton.disabled = false;
    setPlayButtonState(false);
  }
}

function setEffect(effect) {
  state.effect = effect;
  state.progress = 0;
  state.overallProgress = 0;
  state.cameraProgress = 0;
  markRender();
  effectButtons.forEach((button) => {
    const active = button.dataset.effect === effect;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-checked", String(active));
  });
  setStatus(`已选择：${document.querySelector(`[data-effect="${effect}"]`).textContent}。`);
}

function setUiStyle(uiStyle) {
  state.uiStyle = uiStyle;
  state.historyOpen = false;
  state.pageScroll = 0;
  state.targetScroll = 0;
  markRender();
  uiStyleButtons.forEach((button) => {
    const active = button.dataset.uiStyle === uiStyle;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-checked", String(active));
  });
  const label = document.querySelector(`[data-ui-style="${uiStyle}"]`)?.textContent || "当前风格";
  setStatus(`UI 风格：${label}。`);
}

function setCameraEffect(cameraEffect) {
  state.cameraEffect = cameraEffect;
  markRender();
  cameraButtons.forEach((button) => {
    const active = button.dataset.camera === cameraEffect;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-checked", String(active));
  });
  setStatus(`镜头效果：${document.querySelector(`[data-camera="${cameraEffect}"]`).textContent}。`);
}

function setVideoMode(videoMode) {
  state.videoMode = videoMode;
  state.loopTimeline = state.playing && !state.exporting && videoMode === "loop";
  markRender();
  applyVideoMode();
  playModeButtons.forEach((button) => {
    const active = button.dataset.videoMode === videoMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-checked", String(active));
  });
  setStatus(`完整转场将${videoMode === "loop" ? "循环播放" : "播完停在成果画面"}。`);
}

sourceInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (!file) return;
  state.source = createMediaFromFile(file, "source");
  sourceName.textContent = file.name;
  state.progress = 0;
  state.overallProgress = 0;
  state.cameraProgress = 0;
  markRender();
  applyVideoMode();
  setStatus("原始素材已替换。");
});

resultInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (!file) return;
  state.result = createMediaFromFile(file, "result");
  resultName.textContent = file.name;
  state.progress = 0;
  state.overallProgress = 0;
  state.cameraProgress = 0;
  markRender();
  applyVideoMode();
  setStatus("成果素材已替换。");
});

effectButtons.forEach((button) => {
  button.addEventListener("click", () => setEffect(button.dataset.effect));
});

cameraButtons.forEach((button) => {
  button.addEventListener("click", () => setCameraEffect(button.dataset.camera));
});

playModeButtons.forEach((button) => {
  button.addEventListener("click", () => setVideoMode(button.dataset.videoMode));
});

uiStyleButtons.forEach((button) => {
  button.addEventListener("click", () => setUiStyle(button.dataset.uiStyle));
});

totalDurationRange.addEventListener("input", () => {
  state.totalDuration = Number(totalDurationRange.value);
  syncTimingControls();
  markRender();
});

durationRange.addEventListener("input", () => {
  state.transitionDuration = Number(durationRange.value);
  syncTimingControls();
  markRender();
});

fitMode.addEventListener("change", () => {
  state.fit = fitMode.value;
  setStatus(`素材适配：${fitMode.selectedOptions[0].textContent}。`);
});

playButton.addEventListener("click", async () => {
  if (state.playing) {
    stopPlayback();
    return;
  }

  await playAnimation({ allowLoop: true });
});

exportButton.addEventListener("click", exportAnimation);

function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (canvas.width / rect.width),
    y: (event.clientY - rect.top) * (canvas.height / rect.height),
  };
}

function setHistoryOpen(open) {
  state.historyOpen = open;
  state.targetScroll = open ? 1015 : 0;
  markRender();
  setStatus(open ? "已展开创作历程，可在左侧预览中滚动查看。" : "已收起创作历程。");
}

canvas.addEventListener("click", (event) => {
  const point = getCanvasPoint(event);
  const area = state.hitAreas.historyToggle;
  if (
    area &&
    point.x >= area.x &&
    point.x <= area.x + area.w &&
    point.y >= area.y &&
    point.y <= area.y + area.h
  ) {
    setHistoryOpen(!state.historyOpen);
  }
});

canvas.addEventListener("wheel", (event) => {
  if (!state.historyOpen) return;
  event.preventDefault();
  const maxScroll = state.uiStyle === "poster" ? 2840 : 3720;
  state.targetScroll = clamp(state.targetScroll + event.deltaY * 1.15, 0, maxScroll);
  markRender();
}, { passive: false });

function initDefaults() {
  state.source = createImageMedia(encodeURI("视频素材1/image (42).png"), "image (42).png");
  state.result = createVideoMedia(encodeURI("视频素材1/录屏2026-06-17 11.14.29.mov"), "录屏2026-06-17 11.14.29.mov");
  syncTimingControls();
  applyVideoMode();
}

initDefaults();
requestAnimationFrame(render);
