const STORAGE_KEY = "love_checkin_v1";

const $ = (sel) => document.querySelector(sel);
const listEl = $("#list");
const emptyEl = $("#empty");
const toastEl = $("#toast");
const todayBadge = $("#todayBadge");
const floatiesEl = $("#floaties");
const flamesEl = $("#flames");
const fxEl = $("#fx");
const calTitleEl = $("#calTitle");
const calGridEl = $("#calGrid");
const prevMonthBtn = $("#prevMonthBtn");
const nextMonthBtn = $("#nextMonthBtn");
const icsBtn = $("#icsBtn");

const loveBtn = $("#loveBtn");
const loveLabelEl = $("#loveLabel");
const noLoveBtn = $("#noLoveBtn");
const noLoveStage = $("#noLoveStage");
const holdHint = $("#holdHint");
const exportBtn = $("#exportBtn");
const clearBtn = $("#clearBtn");
const copyLinkBtn = $("#copyLinkBtn");
const shareLinkEl = $("#shareLink");

const APPT_YEAR = new Date().getFullYear();
const APPT_DATE = `${APPT_YEAR}-08-27`;

// ===== 云同步（可选：Supabase）=====
const CFG = window.LOVE_CHECKIN_CONFIG || {};
const CLOUD = {
  enabled: Boolean(CFG.supabaseUrl && CFG.supabaseAnonKey),
  url: CFG.supabaseUrl || "",
  key: CFG.supabaseAnonKey || "",
  table: CFG.table || "checkin_state",
  code: null,
  saveTimer: null,
};

function getOrCreateCode() {
  const u = new URL(window.location.href);
  let code = u.searchParams.get("code") || "";
  if (!code) {
    code = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    u.searchParams.set("code", code);
    history.replaceState(null, "", u.toString());
  }
  return code;
}

function getShareUrl() {
  try {
    const u = new URL(window.location.href);
    u.searchParams.set("code", CLOUD.code || getOrCreateCode());
    return u.toString();
  } catch {
    return "";
  }
}

async function copyShareLink() {
  const url = getShareUrl();
  if (!url) return toast("链接生成失败");
  try {
    await navigator.clipboard.writeText(url);
    toast("已复制专属链接");
  } catch {
    // 兜底：选中复制
    const ta = document.createElement("textarea");
    ta.value = url;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    toast("已复制专属链接");
  }
}

function updateShareLinkUI() {
  if (!shareLinkEl) return;
  const url = getShareUrl();
  const mode = CLOUD.enabled ? "云同步：已开启" : "云同步：未开启（仅本地）";
  shareLinkEl.textContent = url ? `${mode} · 你的链接：${url}` : mode;
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
  const qs = `${CLOUD.url}/rest/v1/${encodeURIComponent(CLOUD.table)}?code=eq.${encodeURIComponent(CLOUD.code)}&select=state`;
  const res = await fetch(qs, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`cloud load failed: ${res.status}`);
  const data = await res.json();
  return data?.[0]?.state ?? null;
}

async function cloudSaveState(logs) {
  if (!CLOUD.enabled) return;
  const endpoint = `${CLOUD.url}/rest/v1/${encodeURIComponent(CLOUD.table)}?on_conflict=code`;
  const body = {
    code: CLOUD.code,
    state: logs,
    updated_at: new Date().toISOString(),
  };
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
    } catch {
      // 静默失败即可：离线/网络问题不影响本地使用
    }
  }, 500);
}

// ===== 日历（月视图，记录日期打红勾） =====
let viewYear = new Date().getFullYear();
let viewMonth = new Date().getMonth(); // 0-11

function ymLabel(y, m) {
  return `${y} 年 ${String(m + 1).padStart(2, "0")} 月`;
}

function daysInMonth(y, m) {
  return new Date(y, m + 1, 0).getDate();
}

function mondayFirstIndex(jsDay) {
  // JS: 0=周日...6=周六 -> 转成周一为 0 ... 周日为 6
  return (jsDay + 6) % 7;
}

function dateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function renderCalendar() {
  if (!calTitleEl || !calGridEl) return;
  calTitleEl.textContent = ymLabel(viewYear, viewMonth);
  calGridEl.innerHTML = "";

  const logs = loadLogs();
  const statByDate = new Map();
  for (const x of logs) {
    if (!statByDate.has(x.date)) statByDate.set(x.date, { total: 0, love: 0 });
    const s = statByDate.get(x.date);
    s.total += 1;
    if (x.answer === "love") s.love += 1;
  }

  const first = new Date(viewYear, viewMonth, 1);
  const firstIdx = mondayFirstIndex(first.getDay());
  const total = daysInMonth(viewYear, viewMonth);

  // 补齐开头空格（上月）
  for (let i = 0; i < firstIdx; i++) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day dim";
    cell.tabIndex = -1;
    calGridEl.appendChild(cell);
  }

  const todayKey = fmtDate(new Date());
  for (let d = 1; d <= total; d++) {
    const key = dateKey(viewYear, viewMonth, d);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day" + (key === todayKey ? " today" : "");
    const stat = statByDate.get(key);
    let mark = "";
    if (stat) {
      // 进化：有记录但没点“爱” -> ✔；点过“爱” -> 爱；点很多次“爱” -> 火热的爱心
      if (stat.love >= 6) {
        mark = `<span class="mark hot" title="火热的爱心">🔥❤</span>`;
      } else if (stat.love >= 2) {
        mark = `<span class="mark love" title="爱">爱</span>`;
      } else if (stat.love >= 1) {
        mark = `<span class="mark love" title="爱">❤</span>`;
      } else {
        mark = `<span class="mark check" title="有记录">✔</span>`;
      }
    }
    const ring = key === APPT_DATE ? `<span class="ring" title="今天有约会">💍</span>` : "";
    cell.innerHTML = `<span class="num">${d}</span>${mark}${ring}`;

    if (stat) {
      cell.addEventListener("click", () => {
        const dayLogs = loadLogs().filter((x) => x.date === key);
        const loveCount = dayLogs.filter((x) => x.answer === "love").length;
        const noCount = dayLogs.filter((x) => x.answer !== "love").length;
        const extra = key === APPT_DATE ? "（今天有约会💍）" : "";
        toast(`${key}：爱 ${loveCount} 次，不爱 ${noCount} 次${extra}`);
      });
    } else {
      cell.addEventListener("click", () => {
        const extra = key === APPT_DATE ? "（今天有约会💍）" : "";
        toast(`${key}：没有记录${extra}`);
      });
    }
    calGridEl.appendChild(cell);
  }
}

if (prevMonthBtn) {
  prevMonthBtn.addEventListener("click", () => {
    viewMonth -= 1;
    if (viewMonth < 0) {
      viewMonth = 11;
      viewYear -= 1;
    }
    renderCalendar();
  });
}
if (nextMonthBtn) {
  nextMonthBtn.addEventListener("click", () => {
    viewMonth += 1;
    if (viewMonth > 11) {
      viewMonth = 0;
      viewYear += 1;
    }
    renderCalendar();
  });
}

// ===== 导出到日历（ICS）=====
function icsEscape(s) {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function ymdToICSAllDay(ymd) {
  // ymd: YYYY-MM-DD -> YYYYMMDD
  return ymd.replaceAll("-", "");
}

function makeAllDayEvent({ uid, dateYmd, summary, description }) {
  const dt = ymdToICSAllDay(dateYmd);
  // all-day: DTEND 为次日
  const [y, m, d] = dateYmd.split("-").map((x) => Number(x));
  const next = fmtDate(new Date(y, m - 1, d + 1));
  const dtEnd = ymdToICSAllDay(next);

  const stamp = new Date()
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z"); // YYYYMMDDTHHMMSSZ

  return [
    "BEGIN:VEVENT",
    `UID:${icsEscape(uid)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${dt}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(description || "")}`,
    "END:VEVENT",
  ].join("\r\n");
}

function makeTimedEventLocal({ uid, ymd, startHHMM, endHHMM, summary, description }) {
  // 浮动时间（不写时区），大多数日历会按本地时区解析
  const dt = ymdToICSAllDay(ymd);
  const s = startHHMM.replace(":", "") + "00";
  const e = endHHMM.replace(":", "") + "00";
  const stamp = new Date()
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z");
  return [
    "BEGIN:VEVENT",
    `UID:${icsEscape(uid)}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${dt}T${s}`,
    `DTEND:${dt}T${e}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(description || "")}`,
    "END:VEVENT",
  ].join("\r\n");
}

function buildICS() {
  const logs = loadLogs();
  const lines = [];

  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//Love Checkin//CN");
  lines.push("CALSCALE:GREGORIAN");

  // 打卡记录：按“日期”汇总成一天一个事件（避免同一天多条太吵）
  const byDate = new Map();
  for (const x of logs) {
    if (!byDate.has(x.date)) byDate.set(x.date, []);
    byDate.get(x.date).push(x);
  }
  for (const [date, arr] of byDate.entries()) {
    const loveCount = arr.filter((x) => x.answer === "love").length;
    const noCount = arr.length - loveCount;
    const summary = `今天你爱我吗：爱 ${loveCount} 次 / 不爱 ${noCount} 次`;
    const desc = arr
      .slice()
      .reverse()
      .map((x) => `${x.time} - ${x.answer === "love" ? "爱" : "不爱"}`)
      .join("\n");
    lines.push(
      makeAllDayEvent({
        uid: `love-checkin-${date}@local`,
        dateYmd: date,
        summary,
        description: desc,
      })
    );
  }

  // 8 月 27 号约会（默认今年）
  lines.push(
    makeTimedEventLocal({
      uid: `love-checkin-date-${APPT_DATE}@local`,
      ymd: APPT_DATE,
      startHHMM: "19:00",
      endHHMM: "21:00",
      summary: "约会 💍",
      description: "8 月 27 号的约会（可在日历里改时间/地点）",
    })
  );

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

if (icsBtn) {
  icsBtn.addEventListener("click", () => {
    const ics = buildICS();
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `今天你爱我吗_日历_${fmtDate(new Date())}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("已导出：打开 .ics 导入到日历即可。");
  });
}

function initFloaties() {
  if (!floatiesEl) return;
  const icons = ["🐱", "🐶", "🍃", "🍋", "🐾", "😺"];
  const count = 30;

  floatiesEl.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.className = "floater";
    el.textContent = icons[Math.floor(Math.random() * icons.length)];

    const x = `${Math.random() * 100}vw`;
    const s = `${16 + Math.random() * 26}px`;
    const o = (0.07 + Math.random() * 0.16).toFixed(2);
    const b = `${(Math.random() * 1.2).toFixed(2)}px`;
    const d = `${12 + Math.random() * 18}s`;
    const delay = `${(-Math.random() * 18).toFixed(2)}s`;
    const dx = `${(-40 + Math.random() * 80).toFixed(0)}px`;
    const r = `${(-28 + Math.random() * 56).toFixed(0)}deg`;

    el.style.setProperty("--x", x);
    el.style.setProperty("--s", s);
    el.style.setProperty("--o", o);
    el.style.setProperty("--b", b);
    el.style.setProperty("--d", d);
    el.style.setProperty("--delay", delay);
    el.style.setProperty("--dx", dx);
    el.style.setProperty("--r", r);

    floatiesEl.appendChild(el);
  }
}

function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtTime(d) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
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
    id: crypto.randomUUID?.() ?? String(Date.now() + Math.random()),
    ts: now.toISOString(),
    date: fmtDate(now),
    time: fmtTime(now),
    answer,
  });
  saveLogs(logs);
  render();
}

let toastTimer = null;
function toast(msg) {
  toastEl.textContent = msg;
  // 让每次反馈都更柔和：先淡出再淡入，避免“突兀一块”直接弹出
  toastEl.classList.remove("show");
  // 触发重排，确保过渡能重新播放
  void toastEl.offsetWidth;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1600);
}

function getTodayAnswer(logs) {
  const today = fmtDate(new Date());
  return logs.find((x) => x.date === today) ?? null;
}

function render() {
  const logs = loadLogs();
  const today = getTodayAnswer(logs);
  renderFlames(logs);
  updateLoveLabel(logs);

  todayBadge.textContent = today
    ? `今天：${today.answer === "love" ? "爱" : "不爱"}（已打卡）`
    : "今天：还没打卡";

  listEl.innerHTML = "";
  if (!logs.length) {
    emptyEl.style.display = "block";
    renderCalendar();
    return;
  }
  emptyEl.style.display = "none";

  for (const item of logs) {
    const li = document.createElement("li");
    li.className = "item";
    const tagClass = item.answer === "love" ? "love" : "no";
    const tagText = item.answer === "love" ? "爱" : "不爱";

    li.innerHTML = `
      <div class="meta">
        <div class="ans">今天你爱我吗 <span class="tag ${tagClass}">${tagText}</span></div>
        <div class="time">${item.date} ${item.time}</div>
      </div>
      <button class="del" type="button" title="删除这条">删除</button>
    `;

    li.querySelector(".del").addEventListener("click", () => {
      const next = loadLogs().filter((x) => x.id !== item.id);
      saveLogs(next);
      render();
    });

    listEl.appendChild(li);
  }
  renderCalendar();
}

function updateLoveLabel(logs) {
  if (!loveLabelEl) return;
  const todayKey = fmtDate(new Date());
  const todayLove = (logs || []).filter((x) => x.date === todayKey && x.answer === "love").length;
  let label = "爱Yejo";
  if (todayLove >= 6) label = "永远爱Yejo";
  else if (todayLove >= 3) label = "超级爱Yejo";
  else if (todayLove >= 1) label = "好爱Yejo";
  loveLabelEl.textContent = label;
}

// ===== 火焰：爱记录越多，越多火焰燃起 =====
function renderFlames(logs) {
  if (!flamesEl) return;
  const loveCount = (logs || []).filter((x) => x.answer === "love").length;
  const count = Math.min(58, loveCount + flameBoost);

  flamesEl.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.className = "flame";

    const x = `${(2 + Math.random() * 96).toFixed(2)}%`;
    const w = `${14 + Math.random() * 18}px`;
    const h = `${26 + Math.random() * 42}px`;
    const oBase = 0.10 + Math.random() * 0.20;
    const o = Math.min(0.38, oBase + Math.min(0.18, flameBoost * 0.008)).toFixed(2);
    const b = `${(Math.random() * 1.4).toFixed(2)}px`;
    const r = `${(-10 + Math.random() * 20).toFixed(0)}deg`;
    const d = `${(1.6 + Math.random() * 1.8).toFixed(2)}s`;
    const delay = `${(-Math.random() * 2.5).toFixed(2)}s`;
    const lift = `${(-Math.random() * 22).toFixed(0)}px`;

    el.style.setProperty("--x", x);
    el.style.setProperty("--w", w);
    el.style.setProperty("--h", h);
    el.style.setProperty("--o", o);
    el.style.setProperty("--b", b);
    el.style.setProperty("--r", r);
    el.style.setProperty("--d", d);
    el.style.setProperty("--delay", delay);
    el.style.setProperty("--lift", lift);

    flamesEl.appendChild(el);
  }
}

let flameBoost = 0;
let flameBoostTimer = null;
function boostFlames(amount = 10) {
  flameBoost = Math.min(40, flameBoost + amount);
  clearTimeout(flameBoostTimer);
  // 逐步回落，让“火热”有余韵
  flameBoostTimer = setTimeout(() => {
    flameBoost = 0;
    render();
  }, 900);
}

let hotTimer = null;
function hotPulse() {
  document.body.classList.add("hot");
  clearTimeout(hotTimer);
  hotTimer = setTimeout(() => document.body.classList.remove("hot"), 520);
}

function celebrateLove() {
  if (!fxEl) return;
  const rect = loveBtn.getBoundingClientRect();
  const cx = rect.left + rect.width * 0.62;
  const cy = rect.top + rect.height * 0.50;

  const glyphs = ["🔥", "♥", "✨", "💖", "🔥", "✨"];
  const count = 18;

  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.className = "spark";
    el.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];

    const x = `${(cx + (-18 + Math.random() * 36)).toFixed(1)}px`;
    const y = `${(cy + (-10 + Math.random() * 22)).toFixed(1)}px`;
    const s = `${14 + Math.random() * 18}px`;
    const o = (0.30 + Math.random() * 0.35).toFixed(2);
    const r = `${(-25 + Math.random() * 50).toFixed(0)}deg`;
    const d = `${(520 + Math.random() * 420).toFixed(0)}ms`;
    const dx = `${(-120 + Math.random() * 240).toFixed(0)}px`;
    const dy = `${(-160 + Math.random() * 120).toFixed(0)}px`;

    el.style.setProperty("--x", x);
    el.style.setProperty("--y", y);
    el.style.setProperty("--s", s);
    el.style.setProperty("--o", o);
    el.style.setProperty("--r", r);
    el.style.setProperty("--d", d);
    el.style.setProperty("--dx", dx);
    el.style.setProperty("--dy", dy);

    fxEl.appendChild(el);
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }
}

function tinyPopSound() {
  // 不依赖音频文件的小“啪”一下（可能被浏览器设置静音/拦截也没关系）
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.value = 640;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ctx.destination);
    const t = ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    o.start(t);
    o.stop(t + 0.12);
    o.onended = () => ctx.close?.();
  } catch {
    // 忽略
  }
}

// 打卡：爱
loveBtn.addEventListener("click", () => {
  boostFlames(12);
  addLog("love");
  // addLog 会触发 render()，render 会更新按钮文案；这里取“下一档”的文案做即时反馈
  const logs = loadLogs();
  const todayKey = fmtDate(new Date());
  const todayLove = logs.filter((x) => x.date === todayKey && x.answer === "love").length;
  const label =
    todayLove >= 6 ? "永远爱Yejo" : todayLove >= 3 ? "超级爱Yejo" : todayLove >= 1 ? "好爱Yejo" : "爱Yejo";
  toast(`记录好了：${label}`);
  pulseHeart(loveBtn);
  celebrateLove();
  hotPulse();
  tinyPopSound();
});

function pulseHeart(btn) {
  btn.style.transform = "translateY(1px) scale(1.06)";
  setTimeout(() => (btn.style.transform = "translateY(0) scale(1.02)"), 90);
  setTimeout(() => (btn.style.transform = ""), 220);
}

// “不爱”难点到：会躲 + 需要长按才会生效（但不是完全不可能）
let holdStart = null;
let holdTimer = null;
let unlocked = false;
const HOLD_MS = 1200;
let dodgeCount = 0;
let noLoveScale = 1;
const noLoveVariants = [
  { icon: "🙈", text: "不爱", bg: "linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.02))", border: "rgba(255,255,255,.12)" },
  { icon: "🐾", text: "不爱", bg: "linear-gradient(180deg, rgba(255,77,125,.10), rgba(255,255,255,.02))", border: "rgba(255,77,125,.22)" },
  { icon: "🍋", text: "酸了", bg: "linear-gradient(180deg, rgba(255,234,130,.14), rgba(255,255,255,.02))", border: "rgba(255,234,130,.22)" },
  { icon: "🍃", text: "摇头", bg: "linear-gradient(180deg, rgba(130,255,190,.12), rgba(255,255,255,.02))", border: "rgba(130,255,190,.22)" },
  { icon: "🐱", text: "不爱", bg: "linear-gradient(180deg, rgba(130,190,255,.12), rgba(255,255,255,.02))", border: "rgba(130,190,255,.22)" },
];

function stageRect() {
  return noLoveStage.getBoundingClientRect();
}

function applyNoLoveStyle() {
  const v = noLoveVariants[dodgeCount % noLoveVariants.length];
  const rot = (-12 + Math.random() * 24).toFixed(0);
  noLoveBtn.innerHTML = `<span class="miniIcon">${v.icon}</span>${v.text}`;
  noLoveBtn.style.background = v.bg;
  noLoveBtn.style.borderColor = v.border;
  noLoveBtn.style.transform = `scale(${noLoveScale.toFixed(2)}) rotate(${rot}deg)`;
  noLoveBtn.style.filter = `saturate(${(0.85 + Math.random() * 0.4).toFixed(2)})`;
}

function moveNoLove(reason) {
  const r = stageRect();
  const btnR = noLoveBtn.getBoundingClientRect();
  const pad = 10;

  const maxX = Math.max(pad, r.width - btnR.width - pad);
  const maxY = Math.max(pad, r.height - btnR.height - pad);

  const x = pad + Math.random() * (maxX - pad);
  const y = pad + Math.random() * (maxY - pad);
  noLoveBtn.style.left = `${x}px`;
  noLoveBtn.style.top = `${y}px`;

  if (reason === "dodge") {
    dodgeCount += 1;
    // 越跑越小（有下限，别完全消失）
    noLoveScale = Math.max(0.55, noLoveScale * 0.92);
    applyNoLoveStyle();
    toast("想选「不爱」？它有点害羞。");
  }
}

function resetHold() {
  unlocked = false;
  holdStart = null;
  clearTimeout(holdTimer);
  holdTimer = null;
  holdHint.textContent = `长按 ${HOLD_MS / 1000} 秒才算数`;
}

function startHold() {
  resetHold();
  holdStart = Date.now();
  holdHint.textContent = "别急…再坚持一下";
  holdTimer = setTimeout(() => {
    unlocked = true;
    holdHint.textContent = "可以了，现在松手/点击就算数";
    toast("好吧…你真的很坚持。");
  }, HOLD_MS);
}

function maybeDodge() {
  // 95% 概率躲开，留 5% 的“人品”窗口
  const allow = Math.random() < 0.05;
  if (!allow) moveNoLove("dodge");
  return allow;
}

// 鼠标/触摸靠近就躲
noLoveStage.addEventListener("pointermove", (e) => {
  const r = noLoveBtn.getBoundingClientRect();
  const dx = Math.abs(e.clientX - (r.left + r.width / 2));
  const dy = Math.abs(e.clientY - (r.top + r.height / 2));
  if (dx < 60 && dy < 40) maybeDodge();
});

noLoveBtn.addEventListener("pointerenter", () => {
  maybeDodge();
});

noLoveBtn.addEventListener("pointerdown", (e) => {
  // 如果没有“允许窗口”，立刻躲开；有窗口才允许进入长按逻辑
  const ok = maybeDodge();
  if (!ok) {
    e.preventDefault();
    resetHold();
    return;
  }
  startHold();
});

noLoveBtn.addEventListener("pointerup", () => {
  if (!holdStart) return;
  if (unlocked) {
    addLog("no_love");
    toast("记录好了：今天你不爱我。");
  } else {
    toast("还差一点点，再长按一会。");
  }
  resetHold();
});

noLoveBtn.addEventListener("click", (e) => {
  // 防止“误点”，一律交给 pointerup 的判定
  e.preventDefault();
});

// 导出 & 清空
exportBtn.addEventListener("click", () => {
  const logs = loadLogs();
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `今天你爱我吗_打卡记录_${fmtDate(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("已导出。");
});

clearBtn.addEventListener("click", () => {
  const ok = confirm("确定要清空全部记录吗？（无法恢复）");
  if (!ok) return;
  saveLogs([]);
  render();
  toast("已清空。");
});

if (copyLinkBtn) {
  copyLinkBtn.addEventListener("click", copyShareLink);
}

async function boot() {
  // 生成/读取专属 code（用于同一网址跨设备共享）
  CLOUD.code = getOrCreateCode();
  updateShareLinkUI();

  // 云同步：先拉取云端存档覆盖本地（本地为空时体验更好）
  if (CLOUD.enabled) {
    try {
      const cloudState = await cloudLoad();
      if (Array.isArray(cloudState)) {
        saveLogs(cloudState);
      } else {
        // 云端还没有存档：把本地先写上去
        await cloudSaveState(loadLogs());
      }
      updateShareLinkUI();
    } catch {
      // 网络/配置问题：回退本地
      toast("云同步暂不可用，已使用本地记录");
    }
  }

  // 初始化：给“不爱”一个初始位置
  initFloaties();
  applyNoLoveStyle();
  moveNoLove();
  render();
}

boot();
