const STORAGE_KEY = "love_checkin_v1";

const $ = (sel) => document.querySelector(sel);

const CONFIG = {
  targetName: "Yejo",
  anniversaryDate: "2024-08-27",
  appointment: {
    month: 8,
    day: 27,
    title: "约会 💍",
    start: "19:00",
    end: "21:00",
    note: "8 月 27 号的约会",
  },
  loveQuotes: [
    "今天也请继续偏爱我一点点。",
    "你一按下去，今天就变甜了。",
    "喜欢被认真记录，本身就很浪漫。",
    "又多爱了一点，今天也算圆满。",
  ],
  emoQuotes: [
    "碎碎的心情也被记录了，抱一下再说。",
    "嘴上说不爱，页面都替你灰了一下。",
  ],
  motion: {
    toastDuration: 2000,
    noLoveHoldMs: 1200,
    noLoveWarnMs: 800,
    orbitSpeed: 0.014,
    ambientCount: 22,
    burstCountMin: 10,
    burstCountMax: 15,
    rainCount: 26,
  },
  cloud: {
    supabaseUrl: "",
    supabaseAnonKey: "",
    table: "checkin_state",
  },
  ...(window.LOVE_CHECKIN_CONFIG || {}),
};

const MOTION = { ...CONFIG.motion };
const APPT_DATE = `${new Date().getFullYear()}-${String(CONFIG.appointment.month).padStart(2, "0")}-${String(CONFIG.appointment.day).padStart(2, "0")}`;
const CLOUD_CFG = CONFIG.cloud || {
  supabaseUrl: CONFIG.supabaseUrl || "",
  supabaseAnonKey: CONFIG.supabaseAnonKey || "",
  table: CONFIG.table || "checkin_state",
};

const listEl = $("#list");
const emptyEl = $("#empty");
const toastEl = $("#toast");
const todayBadgeEl = $("#todayBadge");
const ambientEl = $("#ambient");
const burstLayerEl = $("#burstLayer");
const rainLayerEl = $("#rainLayer");
const calTitleEl = $("#calTitle");
const calGridEl = $("#calGrid");
const dayPopoverEl = $("#dayPopover");
const dayPopoverTitleEl = $("#dayPopoverTitle");
const dayPopoverBodyEl = $("#dayPopoverBody");
const monthCountEl = $("#monthCount");
const streakCountEl = $("#streakCount");
const loveDaysCountEl = $("#loveDaysCount");
const prevMonthBtn = $("#prevMonthBtn");
const nextMonthBtn = $("#nextMonthBtn");
const icsBtn = $("#icsBtn");
const exportBtn = $("#exportBtn");
const clearBtn = $("#clearBtn");
const copyLinkBtn = $("#copyLinkBtn");
const shareLinkEl = $("#shareLink");

const loveBtn = $("#loveBtn");
const loveLabelEl = $("#loveLabel");
const loveSubEl = $("#loveSub");
const loveCountEl = $("#loveCount");
const orbitStageEl = $("#orbitStage");
const noLoveOrbitEl = $("#noLoveOrbit");
const noLoveBtn = $("#noLoveBtn");
const noLoveEmojiEl = $("#noLoveEmoji");
const noLoveTextEl = $("#noLoveText");
const holdRingEl = $("#holdRing");
const holdHintEl = $("#holdHint");

const confirmModalEl = $("#confirmModal");
const confirmTitleEl = $("#confirmTitle");
const confirmTextEl = $("#confirmText");
const confirmCancelBtn = $("#confirmCancelBtn");
const confirmOkBtn = $("#confirmOkBtn");

let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth();
let toastTimer = null;
let confirmResolver = null;

let orbitAngle = -Math.PI / 4;
let orbitRadius = 118;
let orbitRaf = null;
let orbitPaused = false;
let noLoveScale = 1;
let noLoveVariantIndex = 0;
let holdStartedAt = 0;
let holdRaf = null;
let holdCompleted = false;
let dayPopoverTimer = null;

const noLoveVariants = [
  { emoji: "💔", text: "不爱", bg: "linear-gradient(180deg, rgba(255,255,255,.68), rgba(240,238,244,.44))", color: "#7e7886" },
  { emoji: "🌫", text: "冷静", bg: "linear-gradient(180deg, rgba(248,248,249,.76), rgba(233,232,237,.44))", color: "#8d8796" },
  { emoji: "🥀", text: "别闹", bg: "linear-gradient(180deg, rgba(244,241,245,.76), rgba(235,232,237,.44))", color: "#8b7f90" },
  { emoji: "☁", text: "摇头", bg: "linear-gradient(180deg, rgba(245,245,247,.76), rgba(235,234,240,.44))", color: "#868396" },
];

const CLOUD = {
  enabled: Boolean(CLOUD_CFG.supabaseUrl && CLOUD_CFG.supabaseAnonKey),
  url: CLOUD_CFG.supabaseUrl || "",
  key: CLOUD_CFG.supabaseAnonKey || "",
  table: CLOUD_CFG.table || "checkin_state",
  code: null,
  saveTimer: null,
};

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function fmtDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fmtTime(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function dayKey(date) {
  return fmtDate(date);
}

function monthLabel(y, m) {
  return `${y} 年 ${String(m + 1).padStart(2, "0")} 月`;
}

function mondayIndex(jsDay) {
  return (jsDay + 6) % 7;
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function loadLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLogs(logs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  scheduleCloudSave();
}

function addLog(answer) {
  const now = new Date();
  const logs = loadLogs();
  logs.unshift({
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: now.toISOString(),
    date: fmtDate(now),
    time: fmtTime(now),
    answer,
  });
  saveLogs(logs);
  return logs;
}

function buildStats(logs) {
  const map = new Map();
  for (const item of logs) {
    if (!map.has(item.date)) {
      map.set(item.date, {
        date: item.date,
        total: 0,
        love: 0,
        noLove: 0,
        firstTime: item.time,
        lastTime: item.time,
      });
    }
    const stat = map.get(item.date);
    stat.total += 1;
    if (item.answer === "love") stat.love += 1;
    if (item.answer === "no_love") stat.noLove += 1;
    if (item.time < stat.firstTime) stat.firstTime = item.time;
    if (item.time > stat.lastTime) stat.lastTime = item.time;
  }
  return map;
}

function getTodayLoveCount(logs) {
  const today = fmtDate(new Date());
  return logs.filter((item) => item.date === today && item.answer === "love").length;
}

function getCurrentLoveStreak(statsMap) {
  let streak = 0;
  let cursor = new Date();
  while (true) {
    const stat = statsMap.get(dayKey(cursor));
    if (stat?.love) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function getMonthOverview(statsMap, year, month) {
  let checkinDays = 0;
  for (const stat of statsMap.values()) {
    const date = new Date(`${stat.date}T00:00:00`);
    if (date.getFullYear() === year && date.getMonth() === month) checkinDays += 1;
  }
  return {
    checkinDays,
    streak: getCurrentLoveStreak(statsMap),
  };
}

function getLoveLinkSet(statsMap) {
  const loveDates = [...statsMap.values()]
    .filter((stat) => stat.love > 0)
    .map((stat) => stat.date)
    .sort();

  const links = new Set();
  let run = [];

  for (let i = 0; i < loveDates.length; i++) {
    const current = new Date(`${loveDates[i]}T00:00:00`);
    const prev = i > 0 ? new Date(`${loveDates[i - 1]}T00:00:00`) : null;
    const isContinuous = prev && (current - prev) / 86400000 === 1;

    if (!isContinuous) run = [loveDates[i]];
    else run.push(loveDates[i]);

    if (run.length >= 3) {
      for (let j = 0; j < run.length - 1; j++) links.add(run[j]);
    }
  }

  return links;
}

function updateAnniversaryCounter() {
  if (!loveDaysCountEl) return;
  const start = new Date(`${CONFIG.anniversaryDate}T00:00:00`);
  const now = new Date();
  const days = Math.max(1, Math.floor((now - start) / 86400000) + 1);
  const from = Number(loveDaysCountEl.dataset.value || 0);
  const duration = 900;
  const startTime = performance.now();

  function tick(time) {
    const progress = clamp((time - startTime) / duration, 0, 1);
    const value = Math.round(from + (days - from) * (1 - Math.pow(1 - progress, 3)));
    loveDaysCountEl.textContent = value;
    loveDaysCountEl.dataset.value = String(value);
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function toast(message, duration = MOTION.toastDuration) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.remove("show");
  void toastEl.offsetWidth;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), duration);
}

function showDayPopover(title, body) {
  if (!dayPopoverEl) return;
  dayPopoverTitleEl.textContent = title;
  dayPopoverBodyEl.innerHTML = body;
  dayPopoverEl.hidden = false;
  clearTimeout(dayPopoverTimer);
  dayPopoverTimer = setTimeout(() => {
    dayPopoverEl.hidden = true;
  }, 2400);
}

function hideDayPopover() {
  if (dayPopoverEl) dayPopoverEl.hidden = true;
}

function applyNoLoveVariant() {
  const variant = noLoveVariants[noLoveVariantIndex % noLoveVariants.length];
  noLoveEmojiEl.textContent = variant.emoji;
  noLoveTextEl.textContent = variant.text;
  noLoveBtn.style.background = variant.bg;
  noLoveBtn.style.color = variant.color;
}

function updateOrbitRadius() {
  const rect = orbitStageEl.getBoundingClientRect();
  orbitRadius = Math.max(106, Math.min(rect.width, rect.height) * 0.39);
}

function placeNoLoveAtAngle(angle) {
  const rect = orbitStageEl.getBoundingClientRect();
  const cx = rect.width / 2;
  const cy = rect.height / 2;
  const x = cx + Math.cos(angle) * orbitRadius;
  const y = cy + Math.sin(angle) * orbitRadius;
  noLoveOrbitEl.style.left = `${x}px`;
  noLoveOrbitEl.style.top = `${y}px`;
  noLoveBtn.style.transform = `translate(-50%, -50%) scale(${noLoveScale.toFixed(2)}) rotate(${Math.sin(angle) * 12}deg)`;
}

function moveNoLove(reason = "dodge") {
  noLoveVariantIndex += 1;
  noLoveScale = Math.max(0.72, noLoveScale * 0.95);
  orbitAngle += rand(Math.PI / 3, Math.PI / 1.5);
  applyNoLoveVariant();
  placeNoLoveAtAngle(orbitAngle);
  if (reason === "dodge") toast("“不爱”又绕开了，它真的不太想被点到。", 1500);
}

function orbitLoop() {
  if (!orbitPaused) {
    orbitAngle += MOTION.orbitSpeed;
    placeNoLoveAtAngle(orbitAngle);
  }
  orbitRaf = requestAnimationFrame(orbitLoop);
}

function startOrbit() {
  cancelAnimationFrame(orbitRaf);
  orbitPaused = false;
  orbitLoop();
}

function resetHold(resetHint = true) {
  cancelAnimationFrame(holdRaf);
  holdStartedAt = 0;
  holdCompleted = false;
  orbitPaused = false;
  holdRingEl.style.setProperty("--progress", "0");
  holdRingEl.classList.remove("show", "warn");
  noLoveBtn.classList.remove("warn");
  if (resetHint) holdHintEl.textContent = `长按 ${(MOTION.noLoveHoldMs / 1000).toFixed(1)} 秒，才会认真说出“不爱”`;
}

function holdFrame(time) {
  if (!holdStartedAt) return;
  const elapsed = time - holdStartedAt;
  const progress = clamp(elapsed / MOTION.noLoveHoldMs, 0, 1);
  holdRingEl.style.setProperty("--progress", progress.toFixed(3));
  holdRingEl.classList.add("show");

  if (elapsed >= MOTION.noLoveWarnMs) {
    holdRingEl.classList.add("warn");
    noLoveBtn.classList.add("warn");
    holdHintEl.textContent = "再坚持一下，它已经开始心虚了…";
  }

  if (progress >= 1 && !holdCompleted) {
    holdCompleted = true;
    const logs = addLog("no_love");
    render(logs);
    toast(pick(CONFIG.emoQuotes), MOTION.toastDuration);
    showDayPopover("今天的不爱被记下来了", "日历上会出现灰色碎心图标，和粉色爱心区分开。");
    resetHold(false);
    return;
  }

  holdRaf = requestAnimationFrame(holdFrame);
}

function startHold() {
  resetHold(false);
  orbitPaused = true;
  holdStartedAt = performance.now();
  holdHintEl.textContent = "正在认真长按…松手就会立刻取消";
  holdRaf = requestAnimationFrame(holdFrame);
}

function createBurst(rect) {
  if (!burstLayerEl) return;
  const count = Math.round(rand(MOTION.burstCountMin, MOTION.burstCountMax));
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const glyphs = ["❤", "♥", "✨", "✦", "❣"];

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.className = "burstPiece";
    piece.textContent = pick(glyphs);
    piece.style.setProperty("--x", `${cx}px`);
    piece.style.setProperty("--y", `${cy}px`);
    piece.style.setProperty("--size", `${rand(12, 26)}px`);
    piece.style.setProperty("--opacity", rand(0.45, 0.95).toFixed(2));
    piece.style.setProperty("--duration", `${rand(650, 1100)}ms`);
    piece.style.setProperty("--dx", `${rand(-120, 120)}px`);
    piece.style.setProperty("--dy", `${rand(-130, 110)}px`);
    piece.style.setProperty("--rotate", `${rand(-80, 80)}deg`);
    burstLayerEl.appendChild(piece);
    piece.addEventListener("animationend", () => piece.remove(), { once: true });
  }
}

function createLoveRain() {
  if (!rainLayerEl) return;
  for (let i = 0; i < MOTION.rainCount; i++) {
    const piece = document.createElement("span");
    piece.className = "rainPiece";
    piece.textContent = pick(["❤", "♥", "✨", "✦"]);
    piece.style.setProperty("--x", `${rand(4, 96)}vw`);
    piece.style.setProperty("--size", `${rand(12, 20)}px`);
    piece.style.setProperty("--opacity", rand(0.28, 0.75).toFixed(2));
    piece.style.setProperty("--duration", `${rand(1400, 2400)}ms`);
    piece.style.setProperty("--drift", `${rand(-70, 70)}px`);
    rainLayerEl.appendChild(piece);
    piece.addEventListener("animationend", () => piece.remove(), { once: true });
  }
}

function hotPulse() {
  document.body.classList.add("hot");
  setTimeout(() => document.body.classList.remove("hot"), 520);
}

function tinyPopSound() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 620;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.start(t);
    osc.stop(t + 0.15);
    osc.onended = () => ctx.close?.();
  } catch {}
}

function renderLoveButton(logs) {
  const todayLove = getTodayLoveCount(logs);
  const totalLove = logs.filter((item) => item.answer === "love").length;
  const baseScale = clamp(1 + totalLove * 0.006, 1, 1.18);
  loveBtn.dataset.baseScale = baseScale.toFixed(3);
  loveBtn.style.setProperty("--love-scale", baseScale.toFixed(3));
  loveBtn.classList.toggle("soft", todayLove > 0);

  if (todayLove > 0) {
    loveLabelEl.textContent = `今日已爱 ×${todayLove}`;
    loveSubEl.textContent = `今天已经认真表达了 ${todayLove} 次喜欢，还可以继续追加。`;
  } else {
    loveLabelEl.textContent = `爱${CONFIG.targetName}`;
    loveSubEl.textContent = "点一下，今天就更爱一点。";
  }
  loveCountEl.textContent = `累计 ${totalLove} 次`;
}

function renderTodayBadge(logs, statsMap) {
  const today = fmtDate(new Date());
  const stat = statsMap.get(today);
  if (!stat) {
    todayBadgeEl.textContent = "今天：还没打卡";
    return;
  }
  if (stat.love > 0 && stat.noLove > 0) {
    todayBadgeEl.textContent = `今天：爱 ${stat.love} 次，也偷偷犹豫了 ${stat.noLove} 次`;
  } else if (stat.love > 0) {
    todayBadgeEl.textContent = `今天：已经爱了 ${stat.love} 次`;
  } else {
    todayBadgeEl.textContent = `今天：记录了一次不爱`;
  }
}

function getDayMood(stat) {
  if (stat.love > 0 && stat.noLove === 0) return { emoji: "💗", text: "今天很甜" };
  if (stat.love > 0 && stat.noLove > 0) return { emoji: "🌤", text: "今天有点摇摆，但还是爱" };
  return { emoji: "灰色碎心", text: "今天嘴硬了一下" };
}

function getDaySummary(stat, items) {
  const latest = items[0];
  if (stat.love > 0 && stat.noLove === 0) {
    return latest.answer === "love"
      ? `这一天最后留下的是一份喜欢，收尾时间在 ${stat.lastTime}。`
      : `这一天整体很甜，最早从 ${stat.firstTime} 开始心动。`;
  }
  if (stat.love > 0 && stat.noLove > 0) {
    return `这一天既有喜欢，也有小别扭，最后的情绪停在 ${stat.lastTime}。`;
  }
  return `这一天只有一次“不爱”记录，页面替你轻轻灰了一下。`;
}

function renderLogs(logs) {
  listEl.innerHTML = "";
  if (!logs.length) {
    emptyEl.style.display = "block";
    return;
  }
  emptyEl.style.display = "none";

  const grouped = new Map();
  for (const item of logs) {
    if (!grouped.has(item.date)) grouped.set(item.date, []);
    grouped.get(item.date).push(item);
  }

  [...grouped.entries()].slice(0, 6).forEach(([date, items], index) => {
    const stat = {
      total: items.length,
      love: items.filter((x) => x.answer === "love").length,
      noLove: items.filter((x) => x.answer === "no_love").length,
      firstTime: items[items.length - 1].time,
      lastTime: items[0].time,
    };
    const latest = items[0];
    const tagClass = latest.answer === "love" ? "love" : "no";
    const tagText = latest.answer === "love" ? "爱" : "不爱";
    const mood = getDayMood(stat);
    const summary = getDaySummary(stat, items);

    const li = document.createElement("li");
    li.className = `item${index === 0 ? " latest" : ""}`;
    li.innerHTML = `
      <div class="meta">
        <div class="ans">${date} <span class="tag ${tagClass}">${tagText}</span></div>
        <div class="miniMood">${mood.emoji} ${mood.text}</div>
        <div class="time">最早 ${stat.firstTime} · 最后 ${stat.lastTime}</div>
        <div class="miniNote">${summary}</div>
      </div>
      <button class="del" type="button" title="删除当天记录">删除</button>
    `;

    li.querySelector(".del").addEventListener("click", () => {
      const next = loadLogs().filter((x) => x.date !== date);
      saveLogs(next);
      render(next);
      toast("这一天的记录已经删除了");
    });

    listEl.appendChild(li);
  });
}

function renderCalendar(statsMap) {
  calTitleEl.textContent = monthLabel(viewYear, viewMonth);
  calGridEl.innerHTML = "";

  const overview = getMonthOverview(statsMap, viewYear, viewMonth);
  monthCountEl.textContent = overview.checkinDays;
  streakCountEl.textContent = overview.streak;

  const streakLinks = getLoveLinkSet(statsMap);
  const firstDay = new Date(viewYear, viewMonth, 1);
  const startOffset = mondayIndex(firstDay.getDay());
  const gridStart = new Date(viewYear, viewMonth, 1 - startOffset);
  const todayKey = fmtDate(new Date());

  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(gridStart);
    cellDate.setDate(gridStart.getDate() + i);
    const key = fmtDate(cellDate);
    const stat = statsMap.get(key);
    const inMonth = cellDate.getMonth() === viewMonth;
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day";
    if (!inMonth) cell.classList.add("outside");
    if (key === todayKey) cell.classList.add("today");
    if (stat?.love) cell.classList.add("has-love");
    else if (stat?.noLove) cell.classList.add("has-no");

    const nextDate = new Date(cellDate);
    nextDate.setDate(cellDate.getDate() + 1);
    const nextKey = fmtDate(nextDate);
    if (streakLinks.has(key) && inMonth && nextDate.getMonth() === viewMonth) cell.classList.add("streak-next");

    let icon = "";
    let count = "";
    if (stat?.love) {
      icon = `<span class="icon love">❤</span>`;
      count = `<span class="count">${stat.love} 次</span>`;
    } else if (stat?.noLove) {
      icon = `<span class="icon no">💔</span>`;
    }

    const appointment = key === APPT_DATE ? `<span class="appointment" title="${CONFIG.appointment.title}">💍</span>` : "";
    cell.innerHTML = `<span class="num">${cellDate.getDate()}</span>${icon}${count}${appointment}`;

    cell.addEventListener("click", () => {
      if (stat) {
        showDayPopover(
          `${key} 的记录`,
          `打卡次数：${stat.total}<br>爱：${stat.love} 次，不爱：${stat.noLove} 次<br>首次打卡：${stat.firstTime}`
        );
      } else if (key === APPT_DATE) {
        showDayPopover(`${key} · 约会提醒`, `今天是约会日，记得把喜欢打包带上。`);
      } else {
        showDayPopover(`${key}`, "这一天还没有留下记录。");
      }
    });

    calGridEl.appendChild(cell);
  }
}

function render(logs = loadLogs()) {
  const statsMap = buildStats(logs);
  renderLoveButton(logs);
  renderTodayBadge(logs, statsMap);
  renderLogs(logs);
  renderCalendar(statsMap);
}

function animateMonthChange(delta) {
  calGridEl.classList.add("switching");
  hideDayPopover();
  setTimeout(() => {
    viewMonth += delta;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear -= 1;
    }
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear += 1;
    }
    render();
    calGridEl.classList.remove("switching");
  }, 140);
}

function icsEscape(str) {
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function icsDate(ymd) {
  return ymd.replaceAll("-", "");
}

function makeAllDayEvent({ uid, dateYmd, summary, description }) {
  const dt = icsDate(dateYmd);
  const [y, m, d] = dateYmd.split("-").map(Number);
  const end = fmtDate(new Date(y, m - 1, d + 1));
  const stamp = new Date().toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
  return [
    "BEGIN:VEVENT",
    `UID:${icsEscape(uid)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dt}`,
    `DTEND;VALUE=DATE:${icsDate(end)}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(description || "")}`,
    "END:VEVENT",
  ].join("\r\n");
}

function makeTimedEvent({ uid, ymd, startHHMM, endHHMM, summary, description }) {
  const stamp = new Date().toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
  return [
    "BEGIN:VEVENT",
    `UID:${icsEscape(uid)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${icsDate(ymd)}T${startHHMM.replace(":", "")}00`,
    `DTEND:${icsDate(ymd)}T${endHHMM.replace(":", "")}00`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(description || "")}`,
    "END:VEVENT",
  ].join("\r\n");
}

function buildICS() {
  const logs = loadLogs();
  const byDate = new Map();
  for (const item of logs) {
    if (!byDate.has(item.date)) byDate.set(item.date, []);
    byDate.get(item.date).push(item);
  }

  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Love Checkin//CN", "CALSCALE:GREGORIAN"];

  for (const [date, arr] of byDate.entries()) {
    const love = arr.filter((x) => x.answer === "love").length;
    const noLove = arr.filter((x) => x.answer === "no_love").length;
    lines.push(
      makeAllDayEvent({
        uid: `love-checkin-${date}@local`,
        dateYmd: date,
        summary: `今天你爱我吗：爱 ${love} 次 / 不爱 ${noLove} 次`,
        description: arr
          .slice()
          .reverse()
          .map((x) => `${x.time} - ${x.answer === "love" ? "爱" : "不爱"}`)
          .join("\n"),
      })
    );
  }

  lines.push(
    makeTimedEvent({
      uid: `love-checkin-appointment-${APPT_DATE}@local`,
      ymd: APPT_DATE,
      startHHMM: CONFIG.appointment.start,
      endHHMM: CONFIG.appointment.end,
      summary: CONFIG.appointment.title,
      description: CONFIG.appointment.note,
    })
  );

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

async function copyShareLink() {
  const url = getShareUrl();
  if (!url) return toast("链接生成失败");
  try {
    await navigator.clipboard.writeText(url);
    toast("链接已经复制好了");
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = url;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    toast("链接已经复制好了");
  }
}

function getOrCreateCode() {
  const url = new URL(window.location.href);
  let code = url.searchParams.get("code") || "";
  if (!code) {
    code = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    url.searchParams.set("code", code);
    history.replaceState(null, "", url.toString());
  }
  return code;
}

function getShareUrl() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("code", CLOUD.code || getOrCreateCode());
    return url.toString();
  } catch {
    return "";
  }
}

function updateShareLinkUI() {
  const mode = CLOUD.enabled ? "云同步已开启" : "云同步未开启（当前只保存在本地）";
  const url = getShareUrl();
  shareLinkEl.textContent = `${mode}${url ? ` · 你的专属链接：${url}` : ""}`;
}

function sbHeaders() {
  return {
    apikey: CLOUD.key,
    Authorization: `Bearer ${CLOUD.key}`,
    "Content-Type": "application/json",
  };
}

async function cloudLoad() {
  if (!CLOUD.enabled) return null;
  const endpoint = `${CLOUD.url}/rest/v1/${encodeURIComponent(CLOUD.table)}?code=eq.${encodeURIComponent(CLOUD.code)}&select=state`;
  const res = await fetch(endpoint, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`cloud load failed: ${res.status}`);
  const json = await res.json();
  return json?.[0]?.state ?? null;
}

async function cloudSaveState(logs) {
  if (!CLOUD.enabled) return;
  const endpoint = `${CLOUD.url}/rest/v1/${encodeURIComponent(CLOUD.table)}?on_conflict=code`;
  const body = { code: CLOUD.code, state: logs, updated_at: new Date().toISOString() };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { ...sbHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`cloud save failed: ${res.status}`);
}

function scheduleCloudSave() {
  if (!CLOUD.enabled) return;
  clearTimeout(CLOUD.saveTimer);
  CLOUD.saveTimer = setTimeout(async () => {
    try {
      await cloudSaveState(loadLogs());
      updateShareLinkUI();
    } catch {}
  }, 420);
}

function initAmbient() {
  if (!ambientEl) return;
  ambientEl.innerHTML = "";
  const glyphs = ["❤", "♥", "✦", "✨", "❥"];
  for (let i = 0; i < MOTION.ambientCount; i++) {
    const piece = document.createElement("span");
    piece.className = "ambientPiece";
    piece.textContent = pick(glyphs);
    piece.style.setProperty("--x", `${rand(0, 100)}vw`);
    piece.style.setProperty("--size", `${rand(12, 28)}px`);
    piece.style.setProperty("--opacity", rand(0.12, 0.36).toFixed(2));
    piece.style.setProperty("--blur", `${rand(0, 1.2).toFixed(2)}px`);
    piece.style.setProperty("--duration", `${rand(16, 30)}s`);
    piece.style.setProperty("--delay", `${rand(-24, 0)}s`);
    piece.style.setProperty("--drift", `${rand(-80, 80)}px`);
    ambientEl.appendChild(piece);
  }
}

function pulseLoveButton() {
  const baseScale = Number(loveBtn.dataset.baseScale || "1");
  loveBtn.style.setProperty("--love-scale", (baseScale + 0.05).toFixed(3));
  setTimeout(() => loveBtn.style.setProperty("--love-scale", (baseScale + 0.02).toFixed(3)), 90);
  setTimeout(() => loveBtn.style.setProperty("--love-scale", baseScale.toFixed(3)), 220);
}

async function confirmAction(title, text) {
  confirmTitleEl.textContent = title;
  confirmTextEl.textContent = text;
  confirmModalEl.hidden = false;
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function resolveConfirm(value) {
  confirmModalEl.hidden = true;
  if (confirmResolver) confirmResolver(value);
  confirmResolver = null;
}

function handleLoveClick() {
  const logs = addLog("love");
  render(logs);
  createBurst(loveBtn.getBoundingClientRect());
  createLoveRain();
  hotPulse();
  pulseLoveButton();
  tinyPopSound();

  const todayLove = getTodayLoveCount(logs);
  if (todayLove > 0 && todayLove % 7 === 0) toast(pick(CONFIG.loveQuotes));
  else toast(`今天的喜欢已经记下来了，第 ${todayLove} 次也很认真。`);
}

function initEvents() {
  loveBtn.addEventListener("click", handleLoveClick);

  noLoveBtn.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    startHold();
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((name) => {
    noLoveBtn.addEventListener(name, () => {
      if (!holdCompleted && holdStartedAt) toast("松手了，这次不算，说不爱还是有点难。", 1500);
      resetHold();
    });
  });
  noLoveBtn.addEventListener("pointerenter", () => {
    if (!holdStartedAt) moveNoLove("dodge");
  });

  orbitStageEl.addEventListener("pointermove", (event) => {
    if (holdStartedAt) return;
    const rect = noLoveOrbitEl.getBoundingClientRect();
    const dx = Math.abs(event.clientX - (rect.left + rect.width / 2));
    const dy = Math.abs(event.clientY - (rect.top + rect.height / 2));
    if (dx < 44 && dy < 44) moveNoLove("dodge");
  });

  prevMonthBtn.addEventListener("click", () => animateMonthChange(-1));
  nextMonthBtn.addEventListener("click", () => animateMonthChange(1));

  exportBtn.addEventListener("click", () => {
    const logs = loadLogs();
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `今天你爱我吗_打卡记录_${fmtDate(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast("记录已经导出好了");
  });

  icsBtn.addEventListener("click", () => {
    const blob = new Blob([buildICS()], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `今天你爱我吗_日历_${fmtDate(new Date())}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast("日历文件已经导出好了");
  });

  copyLinkBtn.addEventListener("click", copyShareLink);

  clearBtn.addEventListener("click", async () => {
    const first = await confirmAction("确认清空记录", "这会删掉当前设备上的全部打卡内容。");
    if (!first) return;
    const second = await confirmAction("再确认一次", "真的要把所有记录、日历状态和次数都清空吗？");
    if (!second) return;
    saveLogs([]);
    render([]);
    toast("已经清空，页面回到最初的样子了");
  });

  confirmCancelBtn.addEventListener("click", () => resolveConfirm(false));
  confirmOkBtn.addEventListener("click", () => resolveConfirm(true));
  confirmModalEl.addEventListener("click", (event) => {
    if (event.target === confirmModalEl) resolveConfirm(false);
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".day")) hideDayPopover();
  });

  window.addEventListener("resize", () => {
    updateOrbitRadius();
    placeNoLoveAtAngle(orbitAngle);
  });
}

async function boot() {
  updateAnniversaryCounter();
  initAmbient();
  applyNoLoveVariant();
  updateOrbitRadius();
  placeNoLoveAtAngle(orbitAngle);
  startOrbit();

  CLOUD.code = getOrCreateCode();
  updateShareLinkUI();

  if (CLOUD.enabled) {
    try {
      const cloudState = await cloudLoad();
      if (Array.isArray(cloudState)) saveLogs(cloudState);
      else await cloudSaveState(loadLogs());
    } catch {
      toast("云同步暂时不可用，已先使用本地记录。");
    }
  }

  initEvents();
  render();
}

boot();
