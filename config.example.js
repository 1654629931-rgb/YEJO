// 把本文件复制为 config.js，然后填入你的配置。
// 说明：
// 1) 如果不填（保持空），应用会只用本地存储，不会跨设备同步
// 2) 如果你想手机/电脑共用同一份记录，推荐用 Supabase 做一个超轻量的“云存档”
//
// Supabase 最小配置：
// - supabaseUrl: 形如 https://xxxx.supabase.co
// - supabaseAnonKey: 项目设置里 public anon key
//
// 数据表（建议）：
// - 表名：checkin_state
// - 字段：code (text, primary key), state (jsonb), updated_at (timestamptz, default now())
//
// 重要：为了免登录使用，你需要为这个表设置允许匿名读写（或者关闭 RLS）。
// 安全建议：把你的专属链接里的 code 设成足够随机，链接不要乱发。

window.LOVE_CHECKIN_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  table: "checkin_state",
};

