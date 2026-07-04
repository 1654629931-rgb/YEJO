window.LOVE_CHECKIN_CONFIG = {
  targetName: "Yejo",
  anniversaryDate: "2025-08-27",
  appointment: {
    month: 8,
    day: 27,
    title: "相爱纪念日 💍",
    start: "19:00",
    end: "21:00",
    note: "你们在 2025 年 8 月 27 日相爱，这一天值得一直被记得。",
  },
  loveQuotes: [
    "今天也请继续偏爱我一点点。",
    "你一按下去，今天就变甜了。",
    "喜欢被认真记录，本身就很浪漫。",
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
};
