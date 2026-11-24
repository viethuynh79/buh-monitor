/**
 * HUB Monitor Pro v2.0 — Cloudflare Workers Telegram Webhook (Phản hồi tức thì!)
 *
 * Hệ sinh thái Đại học Ngân hàng TP.HCM (HUB) + Không gian riêng Khoa HTTTQL (MIS):
 *   1. 💻 Khoa HTTTQL (MIS)        : khoahtttql.hub.edu.vn/thong-bao & Sự kiện hoạt động
 *   2. 📝 Phòng Khảo thí & ĐBCL    : phongktdbcl.hub.edu.vn/thong-bao
 *   3. 🎓 Phòng Quản lý Đào tạo    : phongdaotao.hub.edu.vn/thong-bao & Trang chủ (Tin tức / Thực tập)
 *   4. 🤝 Trung tâm SV & QHDN (SCC): scc.hub.edu.vn/thong-bao
 *   5. 🏫 Cổng Chính HUB           : hub.edu.vn/thong-bao
 *   6. 💰 Phòng Tài chính - Kế toán: phongketoan.hub.edu.vn/thong-bao
 *   7. 🏛️ Cổng Sinh viên Online    : online.hub.edu.vn
 *   8. 📘 Fanpage Khoa HTTTQL      : facebook.com/htttql.hub (kết nối nhanh + tuỳ chọn RSS)
 *
 * Tính năng nổi bật:
 *   - Giao diện nút bấm Inline Menu chuẩn App (giống ảnh mẫu, cập nhật tại chỗ không spam chat).
 *   - Đọc nhanh toàn văn bài viết + trích xuất nút tải PDF trực tiếp ngay trong Telegram!
 *   - Tìm kiếm tiếng Việt không dấu (nhắn thẳng từ khoá hoặc dùng /find hoặc chip 1 chạm).
 *   - Lọc theo cổng HUB, lọc theo chủ đề, Radar tin Khoa HTTTQL (MIS), Bản tin tổng hợp tuần.
 *   - Hỗ trợ Inline Mode (@viethubnews_bot <từ khoá>) để chia sẻ thông báo ngay trong nhóm lớp!
 *   - Endpoint /setup tự động cài Webhook + nút "Menu" xanh + danh sách 16 lệnh chỉ bằng 1 click!
 *
 * Cách triển khai nhanh:
 *   1. Dán toàn bộ file này vào Cloudflare Worker -> Deploy.
 *   2. Settings -> Variables and Secrets -> thêm BOT_TOKEN = token Telegram Bot.
 *      (Tuỳ chọn: thêm SETUP_SECRET để khoá /setup, hoặc FB_HTTTQL_RSS_URL cho RSS Fanpage)
 *   3. Mở trình duyệt vào: https://<ten-worker>.workers.dev/setup
 *      -> Tự động cài đặt Webhook + Nút Menu xanh + Danh sách lệnh!
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const VN_OFFSET = 7 * 3600 * 1000;
const PAGE_SIZE = 5;
const CACHE_TTL_SEC = 120;

const ONLINE_HOME = "https://online.hub.edu.vn/";
const ONLINE_GRID_TARGET = "ctl00$ContentPlaceHolder1$ctl00$ctl00$ctl00$ctl00$grvNewsgroup";
const ONLINE_ITEM_RE = /title="Messages\.aspx\?ID=(\d+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<span[^>]*class="inputdate"[^>]*>(\d{1,2}\/\d{1,2}\/\d{4})<\/span>/g;
const FB_HTTTQL_URL = "https://www.facebook.com/htttql.hub";
const AUTHOR_NAME = "Huynh Viet";
const AUTHOR_FB_URL = "https://www.facebook.com/profile.php?id=61591547874181";

const SOURCES = [
  {
    key: "htttql",
    code: "mis",
    name: "Khoa HTTTQL (MIS)",
    short: "Khoa HTTTQL",
    emoji: "💻",
    type: "dnn_notif",
    url: "https://khoahtttql.hub.edu.vn/thong-bao",
    base: "https://khoahtttql.hub.edu.vn",
    section: "thong-bao",
    priority: 1,
  },
  {
    key: "htttql_ev",
    code: "mise",
    name: "Khoa HTTTQL — Sự kiện",
    short: "Sự kiện MIS",
    emoji: "🚀",
    type: "dnn_news",
    url: "https://khoahtttql.hub.edu.vn/thong-bao-su-kien/su-kien-hoat-dong",
    base: "https://khoahtttql.hub.edu.vn",
    section: "thong-bao-su-kien/su-kien-hoat-dong",
    priority: 2,
  },
  {
    key: "ktdbcl",
    code: "kt",
    name: "Phòng Khảo thí & ĐBCL",
    short: "Khảo thí & ĐBCL",
    emoji: "📝",
    type: "dnn_notif",
    url: "https://phongktdbcl.hub.edu.vn/thong-bao",
    base: "https://phongktdbcl.hub.edu.vn",
    section: "thong-bao",
    priority: 3,
  },
  {
    key: "daotao",
    code: "dt",
    name: "Phòng Quản lý Đào tạo",
    short: "Phòng Đào tạo",
    emoji: "🎓",
    type: "dnn_notif",
    url: "https://phongdaotao.hub.edu.vn/thong-bao",
    base: "https://phongdaotao.hub.edu.vn",
    section: "thong-bao",
    priority: 4,
  },
  {
    key: "daotao_news",
    code: "dtn",
    name: "Đào tạo — Tin & Thực tập",
    short: "Đào tạo (Tin tức)",
    emoji: "📰",
    type: "dnn_pdt_home",
    url: "https://phongdaotao.hub.edu.vn/",
    base: "https://phongdaotao.hub.edu.vn",
    section: "tin-tuc-su-kien",
    priority: 5,
  },
  {
    key: "scc",
    code: "scc",
    name: "Trung tâm SV & QHDN (SCC)",
    short: "Trung tâm SV (SCC)",
    emoji: "🤝",
    type: "dnn_news",
    url: "https://scc.hub.edu.vn/thong-bao",
    base: "https://scc.hub.edu.vn",
    section: "thong-bao",
    priority: 6,
  },
  {
    key: "hub",
    code: "hub",
    name: "Cổng Chính HUB",
    short: "Cổng Chính HUB",
    emoji: "🏫",
    type: "dnn_notif",
    url: "https://hub.edu.vn/thong-bao",
    base: "https://hub.edu.vn",
    section: "thong-bao",
    priority: 7,
  },
  {
    key: "ketoan",
    code: "ktc",
    name: "Phòng Tài chính - Kế toán",
    short: "Tài chính - Kế toán",
    emoji: "💰",
    type: "dnn_notif",
    url: "https://phongketoan.hub.edu.vn/thong-bao",
    base: "https://phongketoan.hub.edu.vn",
    section: "thong-bao",
    priority: 8,
  },
  {
    key: "online",
    code: "onl",
    name: "Cổng Sinh viên Online",
    short: "Online HUB",
    emoji: "🏛️",
    type: "asp_grid",
    url: ONLINE_HOME,
    base: "https://online.hub.edu.vn",
    section: "",
    priority: 9,
  },
];

const SOURCE_BY_KEY = Object.fromEntries(SOURCES.map((s) => [s.key, s]));
const FB_SOURCE = {
  key: "fb_htttql",
  code: "fb",
  name: "Fanpage Khoa HTTTQL (FB)",
  short: "Fanpage MIS",
  emoji: "📘",
  type: "fb_feed",
  url: FB_HTTTQL_URL,
  base: "https://www.facebook.com",
  section: "",
  priority: 0,
};
SOURCE_BY_KEY.fb_htttql = FB_SOURCE;

// Ánh xạ mã ngắn -> cấu hình giải mã bài viết chi tiết (giữ callback_data < 64 bytes)
const DETAIL_ROUTES = {
  mis:  { source: "htttql",      base: "https://khoahtttql.hub.edu.vn",  section: "thong-bao" },
  mise: { source: "htttql_ev",   base: "https://khoahtttql.hub.edu.vn",  section: "thong-bao-su-kien/su-kien-hoat-dong" },
  kt:   { source: "ktdbcl",      base: "https://phongktdbcl.hub.edu.vn", section: "thong-bao" },
  dt:   { source: "daotao",      base: "https://phongdaotao.hub.edu.vn", section: "thong-bao" },
  dtn:  { source: "daotao_news", base: "https://phongdaotao.hub.edu.vn", section: "tin-tuc-su-kien" },
  dtt:  { source: "daotao_news", base: "https://phongdaotao.hub.edu.vn", section: "xet-tot-nghiep" },
  scc:  { source: "scc",         base: "https://scc.hub.edu.vn",         section: "thong-bao" },
  hub:  { source: "hub",         base: "https://hub.edu.vn",             section: "thong-bao" },
  ktc:  { source: "ketoan",      base: "https://phongketoan.hub.edu.vn", section: "thong-bao" },
  onl:  { source: "online",      base: "https://online.hub.edu.vn",      section: "" },
};

const TOPICS = {
  exam:    { icon: "📝", label: "Lịch thi & Khảo thí",     tag: "#LichThi" },
  tuition: { icon: "💰", label: "Học phí & Tài chính",     tag: "#HocPhi" },
  scholar: { icon: "🏆", label: "Học bổng & Giải thưởng",  tag: "#HocBong" },
  grad:    { icon: "🎓", label: "Tốt nghiệp & Thực tập",   tag: "#TotNghiep" },
  reg:     { icon: "📋", label: "Đào tạo & Học phần",      tag: "#DaoTao" },
  student: { icon: "🤝", label: "Sinh viên & Sự kiện",     tag: "#SinhVien" },
  urgent:  { icon: "🚨", label: "Tin khẩn & Cần lưu ý",    tag: "#KhanCap" },
  general: { icon: "📌", label: "Thông báo HUB",           tag: "#ThongBaoHUB" },
};

const BOT_COMMANDS = [
  { command: "menu",    description: "📌 Mở bảng điều khiển nút bấm (Full tính năng)" },
  { command: "latest",  description: "🔥 Thông báo mới nhất từ tất cả cổng HUB" },
  { command: "update",  description: "⚡ Kiểm tra nhanh tin mới nhất (real-time)" },
  { command: "full7d",  description: "📅 Tổng hợp thông báo 7 ngày gần nhất" },
  { command: "full30d", description: "🗓️ Tổng hợp thông báo 30 ngày gần nhất" },
  { command: "find",    description: "🔎 Tìm kiếm không dấu (VD: /find hoc bong)" },
  { command: "htttql",  description: "💻 Không gian Khoa HTTTQL (MIS) & Fanpage" },
  { command: "thi",     description: "📝 Lịch thi, phúc khảo & Phòng Khảo thí" },
  { command: "daotao",  description: "🎓 Phòng Đào tạo (Thông báo, Thực tập, Tốt nghiệp)" },
  { command: "scc",     description: "🤝 Trung tâm SV (Ngoại trú, Học bổng, Sự kiện)" },
  { command: "hocphi",  description: "💰 Học phí, miễn giảm & Phòng Kế toán" },
  { command: "hocbong", description: "🏆 Săn học bổng & khen thưởng toàn HUB" },
  { command: "digest",  description: "📰 Bản tin tổng hợp tuần theo chủ đề" },
  { command: "portals", description: "🔗 Mở nhanh LMS, ĐKTC, eStudent, Fanpage MIS" },
  { command: "status",  description: "📊 Kiểm tra trạng thái 7 cổng HUB (real-time)" },
  { command: "notify",  description: "🔔 Bật / Tắt nhận thông báo tự động" },
  { command: "clear",   description: "🧹 Xoá lịch sử trò chuyện gần đây" },
  { command: "author",  description: "👨‍💻 Thông tin tác giả Huynh Viet & Liên hệ" },
  { command: "help",    description: "❓ Hướng dẫn sử dụng Bot HUB Pro" },
];

const QUICK_SEARCH_CHIPS = [
  { label: "📝 lịch thi",    kw: "lich thi" },
  { label: "🏆 học bổng",    kw: "hoc bong" },
  { label: "💰 học phí",     kw: "hoc phi" },
  { label: "🎓 tốt nghiệp",  kw: "tot nghiep" },
  { label: "🏠 ngoại trú",   kw: "ngoai tru" },
  { label: "🔎 phúc khảo",   kw: "phuc khao" },
  { label: "📋 đăng ký",     kw: "dang ky" },
  { label: "💻 HTTTQL/MIS",  kw: "he thong thong tin" },
  { label: "🇬🇧 tiếng Anh",  kw: "tieng anh" },
];

function log(...args) {
  console.log(...args);
}

// ---------------------------------------------------------------- Text & Helpers

function decodeEntities(s) {
  return String(s || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&acirc;/g, "â").replace(/&Acirc;/g, "Â")
    .replace(/&ecirc;/g, "ê").replace(/&Ecirc;/g, "Ê")
    .replace(/&ocirc;/g, "ô").replace(/&Ocirc;/g, "Ô")
    .replace(/&aacute;/g, "á").replace(/&agrave;/g, "à")
    .replace(/&eacute;/g, "é").replace(/&egrave;/g, "è")
    .replace(/&iacute;/g, "í").replace(/&igrave;/g, "ì")
    .replace(/&oacute;/g, "ó").replace(/&ograve;/g, "ò")
    .replace(/&uacute;/g, "ú").replace(/&ugrave;/g, "ù")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

function cleanText(raw) {
  return decodeEntities(String(raw || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stripAccents(s) {
  return String(s || "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function truncateUtf8(str, maxBytes) {
  const enc = new TextEncoder();
  let out = "";
  let bytes = 0;
  for (const ch of String(str || "")) {
    const b = enc.encode(ch).length;
    if (bytes + b > maxBytes) break;
    out += ch;
    bytes += b;
  }
  return out;
}

function normalizeTitleKey(title) {
  let s = stripAccents(title).toLowerCase();
  s = s.replace(
    /^(?:thong\s+bao|tb)\s*(?:so\s+\S+\s*)?(?:ngay\s+\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\s*)?(?:v\/v|ve\s+viec)?\s*/,
    ""
  );
  return s.replace(/[^a-z0-9]+/g, " ").trim();
}

function parseDate(s) {
  const m = String(s || "").trim().match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(d) {
  return (
    String(d.getUTCDate()).padStart(2, "0") + "/" +
    String(d.getUTCMonth() + 1).padStart(2, "0") + "/" +
    d.getUTCFullYear()
  );
}

function vnToday() {
  const now = new Date(Date.now() + VN_OFFSET);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function vnNowLabel() {
  const now = new Date(Date.now() + VN_OFFSET);
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} · ${fmtDate(now)}`;
}

function isMisRelated(title, sourceKey = "") {
  if (sourceKey === "htttql" || sourceKey === "htttql_ev" || sourceKey === "fb_htttql") return true;
  const padded = " " + stripAccents(title).toLowerCase() + " ";
  const kws = [
    "he thong thong tin", "htttql", " mis ", "mis -", "- mis",
    "do an nganh", "cong nghe thong tin", "thuong mai dien tu",
    "tri tue nhan tao", "khoa hoc du lieu", "fintech", "chuyen doi so",
  ];
  return kws.some((k) => padded.includes(k));
}

function isUrgentTitle(title) {
  const s = stripAccents(title).toLowerCase();
  return [
    "huy hoc phan", "canh bao", "han cuoi", "khan", "bo sung",
    "vi pham", "vang thi", "kiem do", "tam ngung", "lua dao",
    "bat buoc", "thoi hoc",
  ].some((k) => s.includes(k));
}

function classifyItem(title, sourceKey = "") {
  const s = stripAccents(title).toLowerCase();
  if (sourceKey === "ktdbcl" || [
    "lich thi", "phuc khao", "vang thi", "xoa diem", "diem i",
    "exam.hub", "quy che thi", "danh gia nang luc", "thi ket thuc",
    "khao thi", "bang diem",
  ].some((k) => s.includes(k))) return { key: "exam", ...TOPICS.exam };

  if (sourceKey === "ketoan" || [
    "hoc phi", "mien, giam", "mien giam", "cong no", "le phi",
    "ho tro chi phi", "tro cap xa hoi", "thu phi",
  ].some((k) => s.includes(k))) return { key: "tuition", ...TOPICS.tuition };

  if ([
    "hoc bong", "khen thuong", "sinh vien 5 tot", "tuyen duong",
    "cuoc thi", "giai thuong", "finhack",
  ].some((k) => s.includes(k))) return { key: "scholar", ...TOPICS.scholar };

  if ([
    "tot nghiep", "thuc tap", "khoa luan", "do an", "phat bang",
    "in bang", "trao bang", "chuan dau ra", "van bang",
  ].some((k) => s.includes(k))) return { key: "grad", ...TOPICS.grad };

  if ([
    "dang ky", "hoc phan", "huy hoc phan", "thoi khoa bieu",
    "ke hoach", "tin chi", "hoc ghep", "gia han", "canh bao hoc vu",
    "thoi hoc", "cam nang", "ren luyen",
  ].some((k) => s.includes(k))) return { key: "reg", ...TOPICS.reg };

  if (sourceKey === "scc" || sourceKey === "htttql_ev" || [
    "ngoai tru", "the sinh vien", "tham quan", "kien tap", "huy dong",
    "toa dam", "hoi thao", "tuyen dung", "viec lam", "doan", "tu van", "thu moi",
  ].some((k) => s.includes(k))) return { key: "student", ...TOPICS.student };

  return { key: "general", ...TOPICS.general };
}

function extractDeadline(text) {
  if (!text) return "";
  const re = /(?:hạn\s+cuối|trước\s+ngày|đến\s+hết\s+ngày|chậm\s+nhất|hạn\s+nộp|thời\s+hạn|từ\s+ngày\s+\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\s+đến(?:\s+hết)?\s+ngày)[^.\n;]{0,65}?(?<!\d)\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?(?!\d)/i;
  const m = text.match(re);
  return m ? m[0].replace(/\s+/g, " ").trim().slice(0, 95) : "";
}

function prettyFileName(url, idx) {
  try {
    const raw = decodeURIComponent(url.split("/").pop() || "").split("?")[0];
    const clean = raw
      .replace(/^\d{10,}-?\d*[a-z]*-?/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (clean.length >= 5) {
      return clean.length > 34 ? clean.slice(0, 31) + "..." : clean;
    }
  } catch (_) {
    // ignore decode errors
  }
  return `Tài liệu #${idx + 1}`;
}

// ---------------------------------------------------------------- HTTP & Edge Cache

async function fetchHTML(url, formData = null, cookie = "") {
  const headers = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
  };
  if (cookie) headers["Cookie"] = cookie;
  const opts = { headers };
  if (formData) {
    opts.method = "POST";
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    opts.body = new URLSearchParams(formData).toString();
  }
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const sc = res.headers.get("set-cookie") || "";
  const sess = sc ? sc.split(";")[0].trim() : "";
  const text = await res.text();
  return { html: text, cookie: sess, url: res.url };
}

async function cachedJson(cacheKey, fetcher, bypassCache = false) {
  const fakeUrl = new Request("https://hub-cache.internal/" + encodeURIComponent(cacheKey));
  try {
    if (!bypassCache && typeof caches !== "undefined" && caches.default) {
      const hit = await caches.default.match(fakeUrl);
      if (hit) return await hit.json();
    }
  } catch (_) {}

  const data = await fetcher();

  try {
    if (typeof caches !== "undefined" && caches.default) {
      const resp = new Response(JSON.stringify(data), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `public, max-age=${CACHE_TTL_SEC}`,
        },
      });
      await caches.default.put(fakeUrl, resp);
    }
  } catch (_) {}
  return data;
}

// ---------------------------------------------------------------- Parsers

function getHiddenFields(html) {
  const fields = {};
  const re = /<input[^>]+type="hidden"[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const nm = tag.match(/name="([^"]+)"/i);
    const vm = tag.match(/value="([^"]*)"/i);
    if (nm) fields[nm[1]] = vm ? decodeEntities(vm[1]) : "";
  }
  return fields;
}

function parseOnlineItems(html) {
  const items = [];
  ONLINE_ITEM_RE.lastIndex = 0;
  let m;
  while ((m = ONLINE_ITEM_RE.exec(html)) !== null) {
    const title = cleanText(m[2]);
    const dt = parseDate(m[3]);
    if (title && dt) {
      items.push({
        id: m[1],
        source: "online",
        code: "onl",
        title,
        date: fmtDate(dt),
        ts: dt.getTime(),
        url: `https://online.hub.edu.vn/Messages.aspx?id=${m[1]}`,
      });
    }
  }
  return items;
}

function extractDnnId(href) {
  const m = String(href || "").match(/-(\d+)\.html/);
  return m ? m[1] : String(Math.abs(href.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0)));
}

function parseDnnNotif(html, src) {
  const mainMatch = html.match(/<div class="notification-list mt-8">([\s\S]*?)<\/section>/);
  const chunk = mainMatch ? mainMatch[1] : html;
  const re = /<div class="notification-item">[\s\S]*?<span class="day">(\d{1,2})<\/span>\s*<span class="month-year">(\d{1,2})\.(\d{4})<\/span>[\s\S]*?<h3 class="news-title">\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const items = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(chunk)) !== null) {
    const day = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    const yr = m[3];
    let href = decodeEntities(m[4]).trim();
    if (href.startsWith("/")) href = src.base + href;
    const title = cleanText(m[5]);
    const dt = parseDate(`${day}/${mo}/${yr}`);
    const id = extractDnnId(href);
    if (title && dt && !seen.has(id)) {
      seen.add(id);
      items.push({
        id,
        source: src.key,
        code: src.code,
        title,
        date: fmtDate(dt),
        ts: dt.getTime(),
        url: href,
      });
    }
  }
  return items;
}

function parseDnnNews(html, src) {
  let chunk = html;
  if (src.type !== "dnn_pdt_home") {
    const mainMatch = html.match(/<div class="news-list mt-8">([\s\S]*?)<\/section>/);
    if (mainMatch) chunk = mainMatch[1];
  }
  const re = /<div class="news-item">[\s\S]*?<p class="news-date">(\d{1,2}\/\d{1,2}\/\d{4})<\/p>\s*<h3 class="news-title">\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const items = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(chunk)) !== null) {
    const dt = parseDate(m[1]);
    let href = decodeEntities(m[2]).trim();
    if (href.startsWith("/")) href = src.base + href;
    const title = cleanText(m[3]);
    const id = extractDnnId(href);
    if (title && dt && !seen.has(id)) {
      seen.add(id);
      let code = src.code;
      if (src.key === "daotao_news" && href.includes("/xet-tot-nghiep/")) code = "dtt";
      items.push({
        id,
        source: src.key,
        code,
        title,
        date: fmtDate(dt),
        ts: dt.getTime(),
        url: href,
      });
    }
  }
  return items;
}

async function fetchSource(src, onlinePages = 1) {
  const t0 = Date.now();
  try {
    const first = await fetchHTML(src.url);
    let items = [];
    if (src.type === "asp_grid") {
      items = parseOnlineItems(first.html);
      let fields = getHiddenFields(first.html);
      for (let p = 2; p <= onlinePages && items.length; p++) {
        try {
          const next = await fetchHTML(
            ONLINE_HOME,
            Object.assign({}, fields, {
              __EVENTTARGET: ONLINE_GRID_TARGET,
              __EVENTARGUMENT: "Page$" + p,
            }),
            first.cookie
          );
          fields = getHiddenFields(next.html);
          const pItems = parseOnlineItems(next.html);
          if (!pItems.length) break;
          items = items.concat(pItems);
        } catch (_) {
          break;
        }
      }
    } else if (src.type === "dnn_notif") {
      items = parseDnnNotif(first.html, src);
    } else {
      items = parseDnnNews(first.html, src);
    }
    items.sort((a, b) => b.ts - a.ts);
    return { key: src.key, ok: true, ms: Date.now() - t0, items };
  } catch (e) {
    return { key: src.key, ok: false, ms: Date.now() - t0, error: String(e.message || e), items: [] };
  }
}

function parseFbFeedPayload(rawText) {
  const trimmed = String(rawText || "").trim();
  const items = [];
  const seen = new Set();
  const pushPost = (id, title, body, link, dateObj) => {
    const cleanT = cleanText(title || body || "").slice(0, 220);
    if (!cleanT) return;
    const d = dateObj && !isNaN(dateObj.getTime()) ? dateObj : vnToday();
    const vnD = new Date(d.getTime() + VN_OFFSET);
    const utcDay = new Date(Date.UTC(vnD.getUTCFullYear(), vnD.getUTCMonth(), vnD.getUTCDate()));
    const safeId = String(id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(-24) || extractDnnId(link + cleanT);
    if (seen.has(safeId)) return;
    seen.add(safeId);
    items.push({
      id: safeId,
      source: "fb_htttql",
      code: "fb",
      title: cleanT,
      fullText: cleanText(body || title || "").slice(0, 1400),
      date: fmtDate(utcDay),
      ts: utcDay.getTime(),
      url: link || FB_HTTTQL_URL,
    });
  };

  // JSON Feed (rss.app JSON / Meta Graph API JSON)
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const obj = JSON.parse(trimmed);
      const arr = Array.isArray(obj) ? obj : (obj.items || obj.data || []);
      for (const it of arr) {
        const msg = it.message || it.content_text || it.summary || it.description || it.title || "";
        const title = it.title || msg.split(/\r?\n/)[0] || msg;
        const link = it.permalink_url || it.url || it.link || FB_HTTTQL_URL;
        const dtStr = it.created_time || it.date_published || it.date_modified || it.pubDate || "";
        pushPost(it.id || link, title, msg, link, dtStr ? new Date(dtStr) : null);
      }
      return items.sort((a, b) => b.ts - a.ts);
    } catch (_) {}
  }

  // RSS 2.0 <item> or Atom <entry>
  const stripCdata = (s) => String(s || "").replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i, "$1").trim();
  const tagVal = (block, tag) => {
    const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    return m ? stripCdata(m[1]) : "";
  };

  const blocks = trimmed.match(/<(?:item|entry)\b[\s\S]*?<\/(?:item|entry)>/gi) || [];
  for (const b of blocks) {
    const title = tagVal(b, "title");
    const desc = tagVal(b, "content:encoded") || tagVal(b, "content") || tagVal(b, "description") || tagVal(b, "summary");
    let link = tagVal(b, "link");
    if (!link) {
      const lm = b.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (lm) link = decodeEntities(lm[1]);
    }
    const guid = tagVal(b, "guid") || tagVal(b, "id") || link;
    const pub = tagVal(b, "pubDate") || tagVal(b, "published") || tagVal(b, "updated");
    pushPost(guid, title || desc, desc || title, decodeEntities(link), pub ? new Date(pub) : null);
  }
  return items.sort((a, b) => b.ts - a.ts);
}

async function fetchFbSource(env) {
  const t0 = Date.now();
  const rssUrl = env && env.FB_HTTTQL_RSS_URL ? String(env.FB_HTTTQL_RSS_URL).trim() : "";
  const fbToken = env && env.FB_ACCESS_TOKEN ? String(env.FB_ACCESS_TOKEN).trim() : "";
  const fbPageId = env && env.FB_PAGE_ID ? String(env.FB_PAGE_ID).trim() : "htttql.hub";

  if (!rssUrl && !fbToken) {
    return { key: "fb_htttql", configured: false, ok: false, ms: 0, error: "Chưa kết nối nguồn RSS/Graph API", items: [] };
  }

  try {
    let raw = "";
    if (fbToken) {
      const apiUrl = `https://graph.facebook.com/v21.0/${encodeURIComponent(fbPageId)}/posts?fields=id,message,created_time,permalink_url&limit=20&access_token=${encodeURIComponent(fbToken)}`;
      const res = await fetch(apiUrl, { headers: { "User-Agent": UA } });
      if (!res.ok) throw new Error("Graph API HTTP " + res.status);
      raw = await res.text();
    } else {
      const res = await fetch(rssUrl, { headers: { "User-Agent": UA, "Accept": "application/rss+xml, application/atom+xml, application/json, application/xml, text/xml, */*" } });
      if (!res.ok) throw new Error("RSS HTTP " + res.status);
      raw = await res.text();
    }
    const items = parseFbFeedPayload(raw).slice(0, 25);
    return { key: "fb_htttql", configured: true, ok: true, ms: Date.now() - t0, items };
  } catch (e) {
    return { key: "fb_htttql", configured: true, ok: false, ms: Date.now() - t0, error: String(e.message || e), items: [] };
  }
}

async function fetchAllSources(onlinePages = 1, bypassCache = false, env = null) {
  const hasFb = Boolean(env && (env.FB_HTTTQL_RSS_URL || env.FB_ACCESS_TOKEN));
  const key = `all_sources_p${onlinePages}_fb${hasFb ? 1 : 0}`;
  return await cachedJson(
    key,
    async () => {
      const jobs = SOURCES.map((s) => fetchSource(s, s.key === "online" ? onlinePages : 1));
      if (hasFb) jobs.push(fetchFbSource(env));
      const resList = await Promise.all(jobs);
      const bySource = {};
      const health = [];
      for (const r of resList) {
        bySource[r.key] = r.items;
        health.push({
          key: r.key,
          ok: r.ok,
          ms: r.ms,
          count: r.items.length,
          latestDate: r.items[0] ? r.items[0].date : "—",
          error: r.error || "",
        });
      }
      return { bySource, health, hasFb, fetchedAt: vnNowLabel() };
    },
    bypassCache
  );
}

async function fetchSingleSourceCached(sourceKey, onlinePages = 3, bypassCache = false, env = null) {
  if (sourceKey === "fb_htttql") {
    return await cachedJson(
      "src_fb_htttql",
      async () => {
        const r = await fetchFbSource(env);
        return r.items;
      },
      bypassCache
    );
  }
  const src = SOURCE_BY_KEY[sourceKey];
  if (!src) return [];
  const key = `src_${sourceKey}_p${onlinePages}`;
  return await cachedJson(
    key,
    async () => {
      const r = await fetchSource(src, onlinePages);
      return r.items.sort((a, b) => b.ts - a.ts);
    },
    bypassCache
  );
}

function mergeAndDedupe(bySource, days = null) {
  let cutoffTs = null;
  if (days !== null) {
    const c = vnToday();
    c.setUTCDate(c.getUTCDate() - days);
    cutoffTs = c.getTime();
  }
  const orderedKeys = [...SOURCES].sort((a, b) => a.priority - b.priority).map((s) => s.key);
  if (bySource.fb_htttql && bySource.fb_htttql.length) {
    orderedKeys.unshift("fb_htttql");
  }
  const byFp = new Map();
  const out = [];

  const FOURTEEN_DAYS_MS = 14 * 86400 * 1000;
  for (const k of orderedKeys) {
    for (const it of (bySource[k] || [])) {
      if (cutoffTs !== null && it.ts < cutoffTs) continue;
      const fp = normalizeTitleKey(it.title);
      if (fp && byFp.has(fp)) {
        const ex = byFp.get(fp);
        if (ex.source !== k && Math.abs(it.ts - ex.ts) <= FOURTEEN_DAYS_MS) {
          if (!ex.alsoIn.includes(k)) ex.alsoIn.push(k);
          if (it.ts > ex.ts) {
            ex.ts = it.ts;
            ex.date = it.date;
          }
          continue;
        }
      }
      const copy = { ...it, alsoIn: [] };
      if (fp && !byFp.has(fp)) byFp.set(fp, copy);
      out.push(copy);
    }
  }
  out.sort((a, b) => {
    if (b.ts !== a.ts) return b.ts - a.ts;
    const pa = (SOURCE_BY_KEY[a.source] || { priority: 99 }).priority;
    const pb = (SOURCE_BY_KEY[b.source] || { priority: 99 }).priority;
    return pa - pb;
  });
  return out;
}

// ---------------------------------------------------------------- Instant Detail & PDF Reader

async function fetchArticleDetail(code, id, env = null) {
  if (code === "fb") {
    const posts = await fetchSingleSourceCached("fb_htttql", 1, false, env);
    const found = posts.find((p) => p.id === id);
    if (!found) throw new Error("Không tìm thấy bài viết Fanpage này.");
    return {
      source: "fb_htttql",
      sourceName: FB_SOURCE.name,
      sourceEmoji: FB_SOURCE.emoji,
      title: found.title,
      date: found.date,
      sender: "Fanpage Khoa HTTTQL — HUB",
      url: found.url,
      webUrl: found.url,
      bodyText: found.fullText || found.title,
      deadline: extractDeadline(found.fullText || found.title),
      pdfs: [],
      downloads: [],
    };
  }
  const route = DETAIL_ROUTES[code];
  if (!route) throw new Error("Mã nguồn không hợp lệ");
  const src = SOURCE_BY_KEY[route.source];

  if (code === "onl") {
    const msgUrl = `https://online.hub.edu.vn/Messages.aspx?id=${id}`;
    const r1 = await fetch(msgUrl, {
      redirect: "manual",
      headers: { "User-Agent": UA, "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8" },
    });
    const sc = r1.headers.get("set-cookie") || "";
    const cookie = sc ? sc.split(";")[0].trim() : "";
    let dHtml = "";
    if (r1.status >= 300 && r1.status < 400) {
      const loc = r1.headers.get("location") || ONLINE_HOME;
      const nextUrl = loc.startsWith("http") ? loc : new URL(loc, ONLINE_HOME).href;
      const r2 = await fetchHTML(nextUrl, null, cookie);
      dHtml = r2.html;
    } else {
      dHtml = await r1.text();
    }
    const mSub = dHtml.match(/id="[^"]*lblMessageSubject"[^>]*>([\s\S]*?)<\/span>/i);
    const mDate = dHtml.match(/id="[^"]*lblDate"[^>]*>([\s\S]*?)<\/span>/i);
    const mSender = dHtml.match(/id="[^"]*lblSenderName"[^>]*>([\s\S]*?)<\/span>/i);
    const mBody = dHtml.match(/id="[^"]*lblMessageBody"[^>]*>([\s\S]*?)<\/span>/i);

    const title = mSub ? cleanText(mSub[1]) : `Thông báo #${id}`;
    const date = mDate ? cleanText(mDate[1]) : "—";
    const sender = mSender ? cleanText(mSender[1]) : "";
    const bodyHtml = mBody ? mBody[1] : "";

    const pdfs = [];
    const extraLinks = [];
    const linkRe = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let lm;
    while ((lm = linkRe.exec(bodyHtml)) !== null) {
      let href = decodeEntities(lm[1]).trim();
      const label = cleanText(lm[2]) || "Xem chi tiết";
      if (!href || href.startsWith("javascript:") || href.startsWith("#")) continue;
      if (href.startsWith("/")) href = "https://online.hub.edu.vn" + href;
      if (/\.(?:pdf|docx?|xlsx?|zip|rar)(?:\?|$)/i.test(href)) {
        if (!pdfs.includes(href)) pdfs.push(href);
      } else if (/^https?:\/\//i.test(href) && !extraLinks.some((x) => x.url === href)) {
        extraLinks.push({ url: href, label: label.slice(0, 32) });
      }
    }
    const bodyText = cleanText(bodyHtml);
    return {
      source: "online",
      sourceName: src.name,
      sourceEmoji: src.emoji,
      title,
      date,
      sender,
      url: msgUrl,
      webUrl: msgUrl,
      bodyText,
      deadline: extractDeadline(title + " " + bodyText),
      pdfs,
      downloads: [],
      extraLinks,
    };
  }

  // DNN CMS portals (*.hub.edu.vn)
  const shortUrl = `${route.base}/${route.section}/x-${id}.html`;
  const resp = await fetchHTML(shortUrl);
  const html = resp.html;

  const mCanon = html.match(/<link[^>]+rel=['"]canonical['"][^>]+href=['"]([^'"]+)['"]/i) ||
                 html.match(/<meta[^>]+property=['"]og:url['"][^>]+content=['"]([^'"]+)['"]/i);
  const canonicalUrl = mCanon ? decodeEntities(mCanon[1]).trim() : shortUrl;

  const mTitle = html.match(/<h1[^>]*class="[^"]*news-detail-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
                 html.match(/<meta[^>]+property=['"]og:title['"][^>]+content=['"]([^'"]+)['"]/i);
  const title = mTitle ? cleanText(mTitle[1]) : `Thông báo #${id}`;

  let date = "—";
  const mPub = html.match(/article:published_time['"][^>]+content=['"](\d{4})-(\d{2})-(\d{2})/i);
  if (mPub) date = `${mPub[3]}/${mPub[2]}/${mPub[1]}`;

  const fcMatch = html.match(/<div class="full-content">([\s\S]*?)<div class="(?:attach|news-tags|social|share|box-new-notification)/i);
  const bodyHtml = fcMatch ? fcMatch[1] : "";

  const pdfs = [];
  const pdfRe = /(https?:\/\/[^\s"'<>]+\.(?:pdf|docx?|xlsx?|zip|rar))/gi;
  let pm;
  while ((pm = pdfRe.exec(bodyHtml)) !== null) {
    const u = decodeEntities(pm[1]);
    if (!pdfs.includes(u)) pdfs.push(u);
  }

  const downloads = [];
  const dlRe = /download\(["']([^"']+)["']\)/g;
  let dm;
  while ((dm = dlRe.exec(html)) !== null) {
    const u = `${route.base}/taifiledinhkem/tai-file-${dm[1]}`;
    if (!downloads.includes(u)) downloads.push(u);
  }

  const cleanedHtml = bodyHtml
    .replace(/<div class="attach"[\s\S]*$/i, "")
    .replace(/<table[^>]*filedinhkem_table[\s\S]*?<\/table>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n");
  let bodyText = decodeEntities(cleanedHtml.replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .replace(/\bFile đính kèm\b[\s\S]*$/i, "")
    .trim();

  return {
    source: route.source,
    sourceName: src.name,
    sourceEmoji: src.emoji,
    title,
    date,
    sender: "",
    url: canonicalUrl,
    webUrl: canonicalUrl,
    bodyText,
    deadline: extractDeadline(title + " " + bodyText),
    pdfs,
    downloads,
  };
}

// ---------------------------------------------------------------- Telegram API Wrappers

async function tgApi(env, method, payload) {
  const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({ ok: false, description: "Invalid JSON" }));
  if (!data.ok && !String(data.description || "").includes("message is not modified")) {
    log("tgApi error", method, data.description);
  }
  return data;
}

async function sendMsg(env, chatId, text, replyMarkup = null, extra = {}) {
  const payload = Object.assign(
    {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    },
    extra
  );
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return await tgApi(env, "sendMessage", payload);
}

async function editMsg(env, chatId, messageId, text, replyMarkup = null) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  const r = await tgApi(env, "editMessageText", payload);
  // Fallback nếu tin cũ quá hạn hoặc không sửa được -> gửi tin mới
  if (!r.ok && !String(r.description || "").includes("message is not modified")) {
    return await sendMsg(env, chatId, text, replyMarkup);
  }
  return r;
}

async function answerCb(env, callbackQueryId, text = "", showAlert = false) {
  return await tgApi(env, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: showAlert,
  });
}

async function sendPhotoMsg(env, chatId, photoFileId, caption, replyMarkup = null) {
  const payload = {
    chat_id: chatId,
    photo: photoFileId,
    caption: String(caption || "").slice(0, 1020),
    parse_mode: "HTML",
  };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return await tgApi(env, "sendPhoto", payload);
}

// ---------------------------------------------------------------- Subscribers & Admin (Cloudflare KV)

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getEnvAdminIds(env) {
  const raw = String((env && env.ADMIN_CHAT_ID) || "").trim();
  return raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

async function getAdminIds(env) {
  const set = new Set(getEnvAdminIds(env));
  if (env && env.SUBSCRIBERS_KV) {
    try {
      const stored = await env.SUBSCRIBERS_KV.get("cfg:admins", { type: "json" });
      if (Array.isArray(stored)) stored.forEach((id) => set.add(String(id)));
    } catch (_) {}
  }
  return Array.from(set);
}

async function isAdminUser(env, userId) {
  if (!userId) return false;
  const admins = await getAdminIds(env);
  return admins.includes(String(userId));
}

async function claimAdminWithPin(env, userId, pin) {
  if (!env || !env.SUBSCRIBERS_KV || !env.ADMIN_SETUP_PIN) return { ok: false, reason: "no_pin" };
  const existing = await env.SUBSCRIBERS_KV.get("cfg:admins", { type: "json" }).catch(() => null);
  if (Array.isArray(existing) && existing.length > 0) {
    return { ok: false, reason: "already_claimed" };
  }
  if (String(pin || "").trim() !== String(env.ADMIN_SETUP_PIN).trim()) {
    return { ok: false, reason: "wrong_pin" };
  }
  await env.SUBSCRIBERS_KV.put("cfg:admins", JSON.stringify([String(userId)]));
  return { ok: true };
}

async function trackSubscriber(env, chat, fromUser = null, forceActivate = false) {
  if (!env || !env.SUBSCRIBERS_KV || !chat || !chat.id) return null;
  const id = String(chat.id);
  const key = `u:${id}`;
  const nowIso = new Date().toISOString();
  const fullName =
    [chat.first_name || (fromUser && fromUser.first_name), chat.last_name || (fromUser && fromUser.last_name)]
      .filter(Boolean)
      .join(" ")
      .trim() || chat.title || `User ${id}`;
  const username = chat.username || (fromUser && fromUser.username) || "";

  try {
    const existing = await env.SUBSCRIBERS_KV.get(key, { type: "json" });
    if (existing) {
      const ageMs = existing.lastSeen ? Date.now() - Date.parse(existing.lastSeen) : 9e9;
      const needsUpdate =
        forceActivate ||
        existing.blocked ||
        existing.name !== fullName ||
        existing.username !== username ||
        ageMs > 6 * 3600 * 1000;
      if (!needsUpdate) return existing;
      const updated = {
        ...existing,
        name: fullName,
        username,
        type: chat.type || existing.type || "private",
        subscribed: forceActivate ? true : (existing.blocked ? true : existing.subscribed !== false),
        blocked: false,
        lastSeen: nowIso,
      };
      await env.SUBSCRIBERS_KV.put(key, JSON.stringify(updated));
      return updated;
    }
    const created = {
      id,
      type: chat.type || "private",
      name: fullName,
      username,
      subscribed: true,
      blocked: false,
      joinedAt: nowIso,
      lastSeen: nowIso,
    };
    await env.SUBSCRIBERS_KV.put(key, JSON.stringify(created));
    return created;
  } catch (e) {
    log("trackSubscriber error", e);
    return null;
  }
}

async function setUserSubscription(env, chatId, subscribed, blocked = false) {
  if (!env || !env.SUBSCRIBERS_KV) return null;
  const key = `u:${chatId}`;
  try {
    const existing = (await env.SUBSCRIBERS_KV.get(key, { type: "json" })) || {
      id: String(chatId),
      type: "private",
      name: `User ${chatId}`,
      username: "",
      joinedAt: new Date().toISOString(),
    };
    const updated = {
      ...existing,
      subscribed: Boolean(subscribed),
      blocked: Boolean(blocked),
      lastSeen: new Date().toISOString(),
    };
    await env.SUBSCRIBERS_KV.put(key, JSON.stringify(updated));
    return updated;
  } catch (e) {
    log("setUserSubscription error", e);
    return null;
  }
}

async function listAllSubscribers(env) {
  if (!env || !env.SUBSCRIBERS_KV) return [];
  const keys = [];
  let cursor = undefined;
  for (let guard = 0; guard < 20; guard++) {
    const res = await env.SUBSCRIBERS_KV.list({ prefix: "u:", cursor });
    for (const k of (res.keys || [])) keys.push(k.name);
    if (res.list_complete || !res.cursor) break;
    cursor = res.cursor;
  }
  const users = [];
  for (let i = 0; i < keys.length; i += 25) {
    const batch = await Promise.all(
      keys.slice(i, i + 25).map((k) => env.SUBSCRIBERS_KV.get(k, { type: "json" }).catch(() => null))
    );
    for (const u of batch) {
      if (u && u.id) users.push(u);
    }
  }
  users.sort((a, b) => String(b.joinedAt || "").localeCompare(String(a.joinedAt || "")));
  return users;
}

function formatBroadcastPayload(bodyText, urgent = false) {
  const header = urgent
    ? "🚨 <b>THÔNG BÁO KHẨN TỪ QUẢN TRỊ VIÊN</b>"
    : "📣 <b>THÔNG BÁO TỪ QUẢN TRỊ VIÊN — HUB MONITOR PRO</b>";
  return [
    header,
    "━━━━━━━━━━━━━━━━━━━━",
    escapeHtml(bodyText),
    "",
    `📅 <code>${vnNowLabel()}</code> · 👤 Admin ${AUTHOR_NAME}`,
  ].join("\n");
}

async function executeBroadcast(env, draft) {
  const users = await listAllSubscribers(env);
  const targets = users.filter((u) => u.subscribed !== false && !u.blocked);
  const formatted = formatBroadcastPayload(draft.text || "", Boolean(draft.urgent));
  const markup = {
    inline_keyboard: [[
      { text: "📌 Mở Menu HUB", callback_data: "m:home" },
      { text: "🔕 Tắt thông báo", callback_data: "user:notify_off" },
    ]],
  };

  let sent = 0;
  let blocked = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i += 20) {
    const batch = targets.slice(i, i + 20);
    await Promise.all(
      batch.map(async (u) => {
        const r = draft.photoFileId
          ? await sendPhotoMsg(env, u.id, draft.photoFileId, formatted, markup)
          : await sendMsg(env, u.id, formatted, markup);
        if (r && r.ok) {
          sent += 1;
        } else {
          const desc = String((r && r.description) || "").toLowerCase();
          if (desc.includes("blocked") || desc.includes("deactivated") || desc.includes("chat not found") || desc.includes("kicked")) {
            blocked += 1;
            await setUserSubscription(env, u.id, false, true);
          } else {
            failed += 1;
          }
        }
      })
    );
  }
  return { total: targets.length, sent, blocked, failed };
}

async function adminHomeView(env, adminId) {
  const users = await listAllSubscribers(env);
  const active = users.filter((u) => u.subscribed !== false && !u.blocked).length;
  const muted = users.length - active;

  const text = [
    "🛡️ <b>BẢNG QUẢN TRỊ ADMIN — HUB MONITOR PRO</b>",
    `👤 <b>Quản trị viên:</b> ${AUTHOR_NAME} (<code>${escapeHtml(adminId)}</code>)`,
    "━━━━━━━━━━━━━━━━━━━━",
    `👥 <b>Tổng người dùng đã /start:</b> <b>${users.length}</b>`,
    `🔔 <b>Đang bật nhận thông báo:</b> <b>${active}</b>`,
    `🔕 <b>Đã tắt TB / chặn bot:</b> <b>${muted}</b>`,
    `⏱ Cập nhật: ${vnNowLabel()}`,
    "",
    "💡 Mẹo nhanh: Gõ <code>/bc Nội dung...</code> (hoặc gửi ảnh kèm chú thích <code>/bc ...</code>) để tạo bản xem trước &amp; phát sóng ngay!",
  ].join("\n");

  const markup = {
    inline_keyboard: [
      [{ text: `📢 Gửi thông báo ngay cho TẤT CẢ (${active} người)`, callback_data: "adm:bc_ask" }],
      [
        { text: "🚨 Gửi thông báo KHẨN", callback_data: "adm:bc_urgent_ask" },
        { text: "🧪 Test gửi riêng Admin", callback_data: "adm:test_self" },
      ],
      [
        { text: `👥 Danh sách người dùng (${users.length})`, callback_data: "adm:users:1" },
        { text: "🔄 Làm mới thống kê", callback_data: "adm:home" },
      ],
      [{ text: "🏠 Quay lại Menu chính", callback_data: "m:home" }],
    ],
  };
  return { text, markup };
}

async function adminUsersView(env, page = 1) {
  const users = await listAllSubscribers(env);
  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(users.length / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const slice = users.slice((safePage - 1) * perPage, safePage * perPage);

  const lines = [
    "👥 <b>DANH SÁCH NGƯỜI DÙNG BOT</b>",
    `Trang ${safePage}/${totalPages} · Tổng ${users.length} người`,
    "━━━━━━━━━━━━━━━━━━━━",
  ];

  if (!slice.length) {
    lines.push("\nChưa có người dùng nào được ghi nhận.");
  } else {
    slice.forEach((u, idx) => {
      const n = (safePage - 1) * perPage + idx + 1;
      const st = u.blocked ? "🚫" : (u.subscribed === false ? "🔕" : "🔔");
      const uname = u.username ? ` (@${escapeHtml(u.username)})` : "";
      const joined = u.joinedAt ? String(u.joinedAt).slice(0, 10) : "—";
      lines.push(`<b>${n}.</b> ${st} <b>${escapeHtml(u.name)}</b>${uname}`);
      lines.push(`   └ ID: <code>${escapeHtml(u.id)}</code> · Tham gia: <code>${joined}</code>`);
    });
  }

  const kb = [];
  if (totalPages > 1) {
    const nav = [];
    if (safePage > 1) nav.push({ text: "⬅️ Trước", callback_data: `adm:users:${safePage - 1}` });
    nav.push({ text: `📄 ${safePage}/${totalPages}`, callback_data: "noop" });
    if (safePage < totalPages) nav.push({ text: "Sau ➡️", callback_data: `adm:users:${safePage + 1}` });
    kb.push(nav);
  }
  kb.push([
    { text: "🔄 Làm mới", callback_data: `adm:users:${safePage}` },
    { text: "🛡️ Quay lại Admin", callback_data: "adm:home" },
  ]);
  return { text: lines.join("\n"), markup: { inline_keyboard: kb } };
}

async function userNotifyView(env, chatId) {
  let sub = true;
  if (env && env.SUBSCRIBERS_KV) {
    const u = await env.SUBSCRIBERS_KV.get(`u:${chatId}`, { type: "json" }).catch(() => null);
    if (u && u.subscribed === false) sub = false;
  }
  const text = [
    "🔔 <b>CÀI ĐẶT NHẬN THÔNG BÁO TỰ ĐỘNG</b>",
    "━━━━━━━━━━━━━━━━━━━━",
    `Trạng thái hiện tại: ${sub ? "🟢 <b>ĐANG BẬT</b>" : "🔕 <b>ĐANG TẮT</b>"}`,
    "",
    sub
      ? "Bạn sẽ tự động nhận thông báo ngay khi các cổng trường HUB đăng tin mới hoặc khi Quản trị viên gửi thông báo quan trọng."
      : "Bạn đang tạm tắt thông báo tự động. Bấm nút bên dưới bất cứ lúc nào để bật lại!",
  ].join("\n");

  const markup = {
    inline_keyboard: [
      [
        sub
          ? { text: "🔕 Tắt thông báo tự động", callback_data: "user:notify_off" }
          : { text: "🔔 Bật lại thông báo tự động", callback_data: "user:notify_on" },
      ],
      [{ text: "📌 Quay lại Menu chính", callback_data: "m:home" }],
    ],
  };
  return { text, markup };
}

async function clearChatHistory(env, chatId, upToMsgId, count = 100) {
  const safeCount = Math.min(Math.max(10, count || 100), 300);
  const startId = Math.max(1, upToMsgId - safeCount + 1);
  // Telegram deleteMessages BẮT BUỘC danh sách message_ids phải tăng dần (strictly increasing)!
  const batches = [];
  for (let end = upToMsgId; end >= startId; end -= 100) {
    const beg = Math.max(startId, end - 99);
    const ids = [];
    for (let id = beg; id <= end; id++) ids.push(id);
    batches.push(ids);
  }
  let anyOk = false;
  for (const ids of batches) {
    const r = await tgApi(env, "deleteMessages", {
      chat_id: chatId,
      message_ids: ids,
    });
    if (r && r.ok) {
      anyOk = true;
    }
  }
  // Fallback xoá từng tin gần nhất nếu deleteMessages gặp lỗi ngoài ý muốn
  if (!anyOk) {
    const fallbackStart = Math.max(1, upToMsgId - 29);
    const jobs = [];
    for (let id = upToMsgId; id >= fallbackStart; id--) {
      jobs.push(tgApi(env, "deleteMessage", { chat_id: chatId, message_id: id }));
    }
    await Promise.all(jobs);
  }
}

// ---------------------------------------------------------------- Views & Keyboards

function mainMenuView() {
  const text = [
    "📌 <b>BẢNG ĐIỀU KHIỂN — HUB MONITOR PRO</b>",
    "🎓 Hệ sinh thái ĐH Ngân hàng TP.HCM · Khoa HTTTQL (MIS)",
    "━━━━━━━━━━━━━━━━━━━━",
    `🟢 <b>Trạng thái BOT:</b> Đang hoạt động · <code>${vnNowLabel()}</code>`,
    "⚡ <b>Tức thì:</b> Đọc nội dung &amp; tải PDF ngay trong Telegram",
    `👨‍💻 <b>Author:</b> <a href="${AUTHOR_FB_URL}">${AUTHOR_NAME}</a> (MIS · HUB)`,
    "",
    "👇 Vui lòng chọn menu bên dưới:",
  ].join("\n");

  const markup = {
    inline_keyboard: [
      [{ text: "🔥 Thông báo mới nhất (Tất cả cổng HUB)", callback_data: "list:all:latest:1" }],
      [
        { text: "📅 Tin 7 ngày", callback_data: "list:all:7:1" },
        { text: "🗓️ Tin 30 ngày", callback_data: "list:all:30:1" },
      ],
      [
        { text: "💻 Khoa HTTTQL (MIS)", callback_data: "m:mis" },
        { text: "📝 Lịch thi & ĐBCL", callback_data: "src:ktdbcl:1" },
      ],
      [
        { text: "🏢 Chọn cổng HUB (7)", callback_data: "m:portals" },
        { text: "🏷️ Lọc theo chủ đề", callback_data: "m:topics" },
      ],
      [
        { text: "🔎 Tìm kiếm nhanh", callback_data: "m:search" },
        { text: "📰 Bản tin tuần", callback_data: "digest:7" },
      ],
      [
        { text: "🔗 Cổng tiện ích SV", callback_data: "m:links" },
        { text: "📊 Trạng thái HUB", callback_data: "status" },
      ],
      [
        { text: "❓ Hướng dẫn", callback_data: "m:help" },
        { text: "👨‍💻 Tác giả", callback_data: "m:author" },
      ],
      [{ text: "🧹 Dọn sạch lịch sử trò chuyện (/clear)", callback_data: "clear:ask" }],
    ],
  };
  return { text, markup };
}

function authorView() {
  const text = [
    "👨‍💻 <b>THÔNG TIN TÁC GIẢ — HUB MONITOR PRO</b>",
    "━━━━━━━━━━━━━━━━━━━━",
    `👤 <b>Author:</b> <b>${AUTHOR_NAME}</b>`,
    "🎓 <b>Đơn vị:</b> Sinh viên Khoa <b>Hệ thống Thông tin Quản lý (HTTTQL / MIS)</b> — Trường ĐH Ngân hàng TP.HCM (HUB)",
    "🤖 <b>Dự án:</b> <b>HUB Monitor Pro v2.0</b> — Hệ thống tự động cập nhật &amp; tra cứu thông báo toàn trường HUB",
    "🛠️ <b>Hệ thống:</b> Telegram Bot API · Cloudflare Edge · Tự động 24/7",
    "",
    "💬 Cần góp ý tính năng mới, báo lỗi hoặc kết nối giao lưu, bấm nút Facebook bên dưới để liên hệ mình nhé!",
  ].join("\n");

  const markup = {
    inline_keyboard: [
      [{ text: `📘 Facebook Author — ${AUTHOR_NAME}`, url: AUTHOR_FB_URL }],
      [
        { text: "💻 Khoa HTTTQL (MIS)", callback_data: "m:mis" },
        { text: "📘 Fanpage Khoa MIS", url: FB_HTTTQL_URL },
      ],
      [{ text: "⬅️ Quay lại Menu chính", callback_data: "m:home" }],
    ],
  };
  return { text, markup };
}

function misHubView() {
  const text = [
    "💻 <b>KHOA HỆ THỐNG THÔNG TIN QUẢN LÝ (MIS — HUB)</b>",
    "━━━━━━━━━━━━━━━━━━━━",
    "🎯 <b>Không gian dành riêng cho sinh viên HTTTQL:</b>",
    "• 📘 Mở nhanh <b>bài viết mới nhất trên Fanpage Khoa HTTTQL</b>",
    "• 📢 Tự động theo dõi <b>Thông báo &amp; Sự kiện Website Khoa HTTTQL</b>",
    "• 🌟 <b>Radar MIS:</b> Gom mọi tin liên quan HTTTQL, CNTT, Đồ án, TMĐT, AI từ toàn trường HUB",
    "",
    "👇 Chọn mục bạn muốn xem:",
  ].join("\n");

  const markup = {
    inline_keyboard: [
      [{ text: "📘 Bài viết mới nhất Fanpage Khoa HTTTQL", url: FB_HTTTQL_URL }],
      [
        { text: "📢 Thông báo Web Khoa", callback_data: "src:htttql:1" },
        { text: "🚀 Sự kiện & Tọa đàm MIS", callback_data: "src:htttql_ev:1" },
      ],
      [{ text: "🌟 Radar tin MIS trên toàn trường HUB", callback_data: "mis:radar:1" }],
      [
        { text: "🌐 Website Khoa HTTTQL", url: "https://khoahtttql.hub.edu.vn/" },
        { text: "🎓 Sinh viên Khoa MIS", url: "https://khoahtttql.hub.edu.vn/sinh-vien" },
      ],
      [{ text: "⬅️ Quay lại Menu chính", callback_data: "m:home" }],
    ],
  };
  return { text, markup };
}

function portalsMenuView() {
  const text = [
    "🏢 <b>CHỌN CỔNG THÔNG TIN — HỆ SINH THÁI HUB</b>",
    "━━━━━━━━━━━━━━━━━━━━",
    "Tất cả các website chính thức của ĐH Ngân hàng TP.HCM đều được tích hợp &amp; theo dõi tự động mỗi 5 phút.",
    "",
    "👇 Chọn cổng bạn muốn xem riêng:",
  ].join("\n");

  const markup = {
    inline_keyboard: [
      [{ text: "🔥 Xem gộp TẤT CẢ các cổng HUB", callback_data: "list:all:latest:1" }],
      [
        { text: "📘 Fanpage Khoa MIS (FB)", url: FB_HTTTQL_URL },
        { text: "💻 Web Khoa HTTTQL", callback_data: "src:htttql:1" },
      ],
      [
        { text: "🚀 Sự kiện MIS", callback_data: "src:htttql_ev:1" },
        { text: "📝 Phòng Khảo thí & ĐBCL", callback_data: "src:ktdbcl:1" },
      ],
      [
        { text: "🎓 Phòng Đào tạo (TB)", callback_data: "src:daotao:1" },
        { text: "📰 Đào tạo (Tin & Thực tập)", callback_data: "src:daotao_news:1" },
      ],
      [
        { text: "🤝 Trung tâm SV (SCC)", callback_data: "src:scc:1" },
        { text: "🏫 Cổng Chính HUB", callback_data: "src:hub:1" },
      ],
      [
        { text: "💰 Tài chính - Kế toán", callback_data: "src:ketoan:1" },
        { text: "🏛️ Cổng SV Online", callback_data: "src:online:1" },
      ],
      [{ text: "⬅️ Quay lại Menu chính", callback_data: "m:home" }],
    ],
  };
  return { text, markup };
}

function topicsMenuView() {
  const text = [
    "🏷️ <b>LỌC THÔNG BÁO THEO CHỦ ĐỀ</b>",
    "━━━━━━━━━━━━━━━━━━━━",
    "Bot tự động phân loại thông báo từ toàn bộ 7 cổng HUB theo từng chuyên mục sinh viên hay tìm nhất.",
    "",
    "👇 Chọn chủ đề muốn lọc:",
  ].join("\n");

  const markup = {
    inline_keyboard: [
      [{ text: "🚨 Tin khẩn / Hủy HP / Cảnh báo / Chú ý", callback_data: "tp:urgent:1" }],
      [
        { text: "📝 Lịch thi & Khảo thí", callback_data: "tp:exam:1" },
        { text: "💰 Học phí & Miễn giảm", callback_data: "tp:tuition:1" },
      ],
      [
        { text: "🏆 Học bổng & Giải thưởng", callback_data: "tp:scholar:1" },
        { text: "🎓 Tốt nghiệp & Thực tập", callback_data: "tp:grad:1" },
      ],
      [
        { text: "📋 Đăng ký HP & Đào tạo", callback_data: "tp:reg:1" },
        { text: "🤝 Sinh viên & Sự kiện", callback_data: "tp:student:1" },
      ],
      [{ text: "🌟 Tin liên quan Khoa HTTTQL (MIS)", callback_data: "mis:radar:1" }],
      [{ text: "⬅️ Quay lại Menu chính", callback_data: "m:home" }],
    ],
  };
  return { text, markup };
}

function searchMenuView() {
  const text = [
    "🔎 <b>TÌM KIẾM THÔNG MINH TOÀN HỆ THỐNG HUB</b>",
    "━━━━━━━━━━━━━━━━━━━━",
    "✨ <b>Hỗ trợ tìm KHÔNG CẦN DẤU</b> (gõ <code>hoc bong</code> vẫn ra Học bổng!)",
    "💬 <b>Mẹo cực nhanh:</b> Bạn có thể <b>nhắn thẳng từ khoá</b> bất kỳ vào khung chat (không cần gõ <code>/find</code>) là bot tự tìm ngay!",
    "",
    "👇 Chọn nhanh từ khoá phổ biến hoặc nhập tự do:",
  ].join("\n");

  const rows = [];
  for (let i = 0; i < QUICK_SEARCH_CHIPS.length; i += 3) {
    rows.push(
      QUICK_SEARCH_CHIPS.slice(i, i + 3).map((c) => ({
        text: c.label,
        callback_data: `q:${c.kw}:1`,
      }))
    );
  }
  rows.push([{ text: "⌨️ Nhập từ khoá khác...", callback_data: "m:search_ask" }]);
  rows.push([{ text: "⬅️ Quay lại Menu chính", callback_data: "m:home" }]);
  return { text, markup: { inline_keyboard: rows } };
}

function quickLinksView() {
  const text = [
    "🔗 <b>CỔNG TIỆN ÍCH SINH VIÊN HUB</b>",
    "━━━━━━━━━━━━━━━━━━━━",
    "Truy cập 1 chạm tới toàn bộ hệ thống học tập, đào tạo &amp; khảo thí của ĐH Ngân hàng TP.HCM:",
  ].join("\n");

  const markup = {
    inline_keyboard: [
      [
        { text: "🏛️ Online HUB", url: "https://online.hub.edu.vn/" },
        { text: "📚 LMS Học trực tuyến", url: "https://lms.hub.edu.vn/" },
      ],
      [
        { text: "📝 Đăng ký tín chỉ", url: "https://dangkytinchi.hub.edu.vn/" },
        { text: "🎓 eStudent HUB", url: "https://estudent.hub.edu.vn/" },
      ],
      [
        { text: "💻 Web Khoa HTTTQL", url: "https://khoahtttql.hub.edu.vn/" },
        { text: "📘 Fanpage Khoa MIS", url: FB_HTTTQL_URL },
      ],
      [
        { text: "📝 Phòng Khảo thí", url: "https://phongktdbcl.hub.edu.vn/thong-bao" },
        { text: "🎓 Phòng Đào tạo", url: "https://phongdaotao.hub.edu.vn/" },
      ],
      [
        { text: "🤝 Trung tâm SV (SCC)", url: "https://scc.hub.edu.vn/thong-bao" },
        { text: "💰 Tài chính - Kế toán", url: "https://phongketoan.hub.edu.vn/thong-bao" },
      ],
      [
        { text: "📖 Thư viện HUB", url: "https://library.hub.edu.vn/" },
        { text: "📜 Tra cứu văn bằng", url: "https://hub.edu.vn/tra-cuu-van-bang" },
      ],
      [{ text: "⬅️ Quay lại Menu chính", callback_data: "m:home" }],
    ],
  };
  return { text, markup };
}

function helpView() {
  const text = [
    "❓ <b>HƯỚNG DẪN SỬ DỤNG — HUB MONITOR PRO</b>",
    "━━━━━━━━━━━━━━━━━━━━",
    "🔔 <b>1. Tự động báo tin mới (Auto-Push):</b>",
    "Bot chạy ngầm 24/7 (mỗi 5 phút) trên toàn bộ <b>7 cổng HUB + Khoa HTTTQL</b>. Hễ trường đăng bài mới, bot tự trích xuất PDF &amp; đẩy thẻ thông báo có nút bấm ngay lập tức!",
    "",
    "⌨️ <b>2. Các lệnh nhanh (bấm nút Menu màu xanh góc trái):</b>",
    "• <code>/menu</code> — Mở bảng điều khiển nút bấm",
    "• <code>/latest</code> hoặc <code>/update</code> — Tin mới nhất toàn HUB",
    "• <code>/full7d</code> · <code>/full30d</code> — Tổng hợp 7 / 30 ngày",
    "• <code>/htttql</code> — Không gian Khoa HTTTQL (MIS) &amp; Fanpage",
    "• <code>/thi</code> · <code>/daotao</code> · <code>/scc</code> · <code>/hocphi</code> · <code>/hocbong</code>",
    "• <code>/find &lt;từ khoá&gt;</code> — Tìm kiếm không dấu toàn HUB",
    "• <code>/digest</code> — Bản tin tổng hợp tuần theo chủ đề",
    "• <code>/portals</code> — Mở nhanh LMS, ĐKTC, eStudent...",
    "• <code>/status</code> — Kiểm tra tốc độ &amp; tình trạng 7 cổng HUB",
    "• <code>/notify</code> — Bật / Tắt nhận thông báo tự động",
    "• <code>/clear</code> — Xoá lịch sử trò chuyện gần đây (VD: <code>/clear 200</code>)",
    "• <code>/author</code> — Thông tin tác giả Huynh Viet &amp; liên hệ",
    "",
    "💡 <b>3. Mẹo dùng cực xịn:</b>",
    "• Nhắn thẳng từ khoá bất kỳ (VD: <code>lịch thi</code>) để tìm ngay!",
    "• Bấm các nút số <b>📖 1–5</b> dưới mỗi danh sách để đọc chi tiết &amp; tải PDF ngay trong Telegram!",
    "• Gõ <code>@viethubnews_bot lịch thi</code> trong bất kỳ nhóm lớp nào để chia sẻ thông báo chính thức (nếu đã bật Inline Mode trong BotFather).",
    "",
    `👨‍💻 Phát triển bởi <a href="${AUTHOR_FB_URL}">${AUTHOR_NAME}</a> · Sinh viên Khoa HTTTQL (MIS) — HUB`,
  ].join("\n");

  const markup = {
    inline_keyboard: [
      [
        { text: "🔥 Xem tin mới nhất", callback_data: "list:all:latest:1" },
        { text: "👨‍💻 Về tác giả", callback_data: "m:author" },
      ],
      [{ text: "⬅️ Quay lại Menu chính", callback_data: "m:home" }],
    ],
  };
  return { text, markup };
}

function buildPaginatedListView(title, items, page, baseCbPrefix, extra = {}) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const slice = items.slice(start, start + PAGE_SIZE);
  const currentCb = `${baseCbPrefix}:${safePage}`;

  const lines = [
    `<b>${escapeHtml(title)}</b>`,
    `Trang ${safePage}/${totalPages} · Tổng ${total} tin · ⏱ ${vnNowLabel()}`,
    "━━━━━━━━━━━━━━━━━━━━",
  ];

  if (!slice.length) {
    lines.push("");
    lines.push("📭 Không có thông báo nào phù hợp trong mục này.");
  } else {
    slice.forEach((it, idx) => {
      const num = start + idx + 1;
      const src = SOURCE_BY_KEY[it.source] || { emoji: "📌", short: it.source };
      const cat = classifyItem(it.title, it.source);
      const urgent = isUrgentTitle(it.title);
      const mis = isMisRelated(it.title, it.source);
      const icon = urgent ? "🚨" : cat.icon;
      const shortTitle = it.title.length > 105 ? it.title.slice(0, 102) + "..." : it.title;
      const tags = [];
      if (mis) tags.push("⭐ MIS");
      if (it.alsoIn && it.alsoIn.length) tags.push(`+${it.alsoIn.length} cổng`);
      const extraTag = tags.length ? ` · ${tags.join(" · ")}` : "";

      lines.push("");
      lines.push(`<b>${num}.</b> ${icon} <a href="${escapeHtml(it.url)}">${escapeHtml(shortTitle)}</a>`);
      lines.push(`   └ ${src.emoji} ${escapeHtml(src.short)} · 📅 <code>${escapeHtml(it.date)}</code>${extraTag}`);
    });
    lines.push("");
    lines.push("💡 Bấm nút số bên dưới để đọc nội dung &amp; tải PDF ngay trong chat!");
  }

  const keyboard = [];

  // Hàng 1: Thanh nút đọc nhanh 1..5
  if (slice.length) {
    const numRow = slice.map((it, idx) => {
      // Đóng gói mã quay lại nếu tổng độ dài <= 64 bytes
      let cb = `v:${it.code}:${it.id}:${currentCb}`;
      if (new TextEncoder().encode(cb).length > 64) {
        cb = `v:${it.code}:${it.id}`;
      }
      return { text: `📖 ${start + idx + 1}`, callback_data: cb };
    });
    keyboard.push(numRow);
  }

  // Hàng 2: Phân trang Trước / Trang / Sau
  if (totalPages > 1) {
    const nav = [];
    if (safePage > 1) {
      nav.push({ text: "⬅️ Trước", callback_data: `${baseCbPrefix}:${safePage - 1}` });
    }
    nav.push({ text: `📄 ${safePage}/${totalPages}`, callback_data: "noop" });
    if (safePage < totalPages) {
      nav.push({ text: "Sau ➡️", callback_data: `${baseCbPrefix}:${safePage + 1}` });
    }
    keyboard.push(nav);
  }

  // Hàng 3: Nút mở cổng gốc (nếu đang xem 1 cổng) + Làm mới + Menu
  const actionRow = [];
  if (extra.webUrl) {
    actionRow.push({ text: "🌐 Mở trang web", url: extra.webUrl });
  }
  const refreshCb = `rf:${baseCbPrefix}:${safePage}`;
  if (new TextEncoder().encode(refreshCb).length <= 64) {
    actionRow.push({ text: "🔄 Làm mới", callback_data: refreshCb });
  }
  actionRow.push({ text: "📌 Menu", callback_data: "m:home" });
  keyboard.push(actionRow);

  if (extra.siblingCb && extra.siblingLabel) {
    keyboard.push([{ text: extra.siblingLabel, callback_data: extra.siblingCb }]);
  }

  if (extra.backCb && extra.backLabel) {
    keyboard.push([{ text: extra.backLabel, callback_data: extra.backCb }]);
  }

  return { text: lines.join("\n"), markup: { inline_keyboard: keyboard } };
}

function buildDetailView(detail, backCb = "m:home") {
  const cat = classifyItem(detail.title, detail.source);
  const mis = isMisRelated(detail.title, detail.source);
  const urgent = isUrgentTitle(detail.title);
  const icon = urgent ? "🚨" : cat.icon;

  const lines = [
    `${icon} <b>${escapeHtml(detail.title)}</b>`,
    `<code>${cat.tag}</code>${mis ? " · ⭐ <b>KHOA HTTTQL</b>" : ""}${urgent ? " · ⚡ <b>CHÚ Ý</b>" : ""}`,
    "━━━━━━━━━━━━━━━━━━━━",
    `🏢 <b>Nguồn:</b> ${detail.sourceEmoji} ${escapeHtml(detail.sourceName)}`,
    `📅 <b>Ngày đăng:</b> <code>${escapeHtml(detail.date)}</code>`,
  ];

  if (detail.sender) {
    lines.push(`👤 <b>Đơn vị gửi:</b> ${escapeHtml(detail.sender)}`);
  }
  if (detail.deadline) {
    lines.push(`⏰ <b>Lưu ý hạn:</b> ${escapeHtml(detail.deadline)}`);
  }

  const totalAtt = detail.pdfs.length + detail.downloads.length;
  if (totalAtt > 0) {
    lines.push(`📎 <b>Tài liệu đính kèm:</b> ${totalAtt} tệp (bấm nút tải bên dưới)`);
  }

  if (detail.bodyText && detail.bodyText.length > 20) {
    const trimmed = detail.bodyText.length > 1400 ? detail.bodyText.slice(0, 1397) + "..." : detail.bodyText;
    lines.push("");
    lines.push("📄 <b>Nội dung trích xuất:</b>");
    lines.push(escapeHtml(trimmed));
  } else if (totalAtt > 0) {
    lines.push("");
    lines.push("📄 Thông báo này trình bày trực tiếp dưới dạng file PDF đính kèm — bấm nút màu xanh bên dưới để mở xem ngay!");
  }

  const keyboard = [];
  // Các nút tải trực tiếp từng file PDF (tối đa 5 file để gọn UI)
  detail.pdfs.slice(0, 5).forEach((pdfUrl, idx) => {
    const label = detail.pdfs.length === 1
      ? `📥 Mở / Tải PDF: ${prettyFileName(pdfUrl, idx)}`
      : `📥 PDF ${idx + 1}: ${prettyFileName(pdfUrl, idx)}`;
    keyboard.push([{ text: label, url: pdfUrl }]);
  });

  // Các nút tải tệp đính kèm /taifiledinhkem/
  detail.downloads.slice(0, 3).forEach((dlUrl, idx) => {
    keyboard.push([{ text: `📦 Tải tệp đính kèm #${idx + 1}`, url: dlUrl }]);
  });

  // Các link chi tiết đính kèm trong bài (VD: "Tại đây" -> scc.hub.edu.vn, Google Drive...)
  (detail.extraLinks || []).slice(0, 3).forEach((lk, idx) => {
    const lbl = lk.label && !/^tại đây$/i.test(lk.label) ? lk.label : `Xem chi tiết #${idx + 1}`;
    keyboard.push([{ text: `🔗 Mở liên kết: ${lbl}`, url: lk.url }]);
  });

  keyboard.push([
    { text: "🌐 Mở bài gốc trên web", url: detail.webUrl },
    { text: `${detail.sourceEmoji} Xem cổng này`, callback_data: `src:${detail.source}:1` },
  ]);

  const backRow = [];
  if (backCb && backCb !== "m:home") {
    backRow.push({ text: "⬅️ Quay lại danh sách", callback_data: backCb });
  }
  backRow.push({ text: "📌 Menu chính", callback_data: "m:home" });
  keyboard.push(backRow);

  return { text: lines.join("\n"), markup: { inline_keyboard: keyboard } };
}

function buildDigestView(allItems, days) {
  const buckets = {
    mis: [],
    exam: [],
    tuition: [],
    scholar: [],
    grad: [],
    reg: [],
    student: [],
    general: [],
  };

  for (const it of allItems) {
    if (isMisRelated(it.title, it.source)) buckets.mis.push(it);
    const cat = classifyItem(it.title, it.source);
    (buckets[cat.key] || buckets.general).push(it);
  }

  const lines = [
    `📰 <b>BẢN TIN TỔNG HỢP ${days} NGÀY — HUB MONITOR PRO</b>`,
    `Cập nhật: ${vnNowLabel()} · Tổng ${allItems.length} thông báo (đã gộp trùng)`,
    "━━━━━━━━━━━━━━━━━━━━",
  ];

  if (!allItems.length) {
    lines.push("\n📭 Không có thông báo mới nào trong khoảng thời gian này.");
  } else {
    const sections = [
      { key: "mis",     head: "💻 <b>Khoa HTTTQL (MIS) &amp; Liên quan</b>" },
      { key: "exam",    head: "📝 <b>Lịch thi &amp; Khảo thí</b>" },
      { key: "tuition", head: "💰 <b>Học phí &amp; Tài chính</b>" },
      { key: "scholar", head: "🏆 <b>Học bổng &amp; Giải thưởng</b>" },
      { key: "grad",    head: "🎓 <b>Tốt nghiệp &amp; Thực tập</b>" },
      { key: "reg",     head: "📋 <b>Đào tạo &amp; Học phần</b>" },
      { key: "student", head: "🤝 <b>Sinh viên &amp; Sự kiện</b>" },
    ];

    for (const sec of sections) {
      const list = buckets[sec.key];
      if (!list.length) continue;
      lines.push("");
      lines.push(`${sec.head} (${list.length} tin)`);
      list.slice(0, 3).forEach((it) => {
        const shortT = it.title.length > 78 ? it.title.slice(0, 75) + "..." : it.title;
        lines.push(`• <code>${it.date}</code> <a href="${escapeHtml(it.url)}">${escapeHtml(shortT)}</a>`);
      });
    }
  }

  const markup = {
    inline_keyboard: [
      [
        { text: days === 7 ? "✅ Bản tin 7 ngày" : "📅 Bản tin 7 ngày", callback_data: "digest:7" },
        { text: days === 30 ? "✅ Bản tin 30 ngày" : "🗓️ Bản tin 30 ngày", callback_data: "digest:30" },
      ],
      [
        { text: "🔥 Xem danh sách đầy đủ", callback_data: `list:all:${days}:1` },
        { text: "💻 Không gian MIS", callback_data: "m:mis" },
      ],
      [{ text: "⬅️ Quay lại Menu chính", callback_data: "m:home" }],
    ],
  };
  return { text: lines.join("\n"), markup };
}

function buildStatusView(data) {
  const okCount = data.health.filter((h) => h.ok).length;
  const totalItems = data.health.reduce((s, h) => s + h.count, 0);
  const lines = [
    "📊 <b>TRẠNG THÁI HỆ SINH THÁI HUB (REAL-TIME)</b>",
    `Kiểm tra lúc: ${data.fetchedAt}`,
    "━━━━━━━━━━━━━━━━━━━━",
    `🟢 <b>Hoạt động:</b> ${okCount}/${data.health.length} cổng · <b>${totalItems}</b> tin đã lập chỉ mục`,
    "",
  ];

  for (const h of data.health) {
    const src = SOURCE_BY_KEY[h.key];
    const dot = h.ok ? "🟢" : "🔴";
    const info = h.ok
      ? `${h.count} tin · mới nhất <code>${h.latestDate}</code> · ${h.ms}ms`
      : `Lỗi: ${escapeHtml(h.error.slice(0, 40))}`;
    lines.push(`${dot} ${src.emoji} <b>${escapeHtml(src.short)}</b>`);
    lines.push(`   └ ${info}`);
  }

  const markup = {
    inline_keyboard: [
      [
        { text: "🔄 Kiểm tra lại ngay", callback_data: "rf:status" },
        { text: "🔥 Tin mới nhất", callback_data: "list:all:latest:1" },
      ],
      [{ text: "⬅️ Quay lại Menu chính", callback_data: "m:home" }],
    ],
  };
  return { text: lines.join("\n"), markup };
}

// ---------------------------------------------------------------- Action Router (Shared by Commands & Callbacks)

async function renderRoute(routeStr, bypassCache = false, env = null) {
  // Handle explicit refresh prefix "rf:..."
  if (routeStr.startsWith("rf:")) {
    return await renderRoute(routeStr.slice(3), true, env);
  }

  if (routeStr === "m:home") return mainMenuView();
  if (routeStr === "m:mis") return misHubView();
  if (routeStr === "m:portals") return portalsMenuView();
  if (routeStr === "m:topics") return topicsMenuView();
  if (routeStr === "m:search") return searchMenuView();
  if (routeStr === "m:links") return quickLinksView();
  if (routeStr === "m:author") return authorView();
  if (routeStr === "m:help") return helpView();

  if (routeStr === "status") {
    const data = await fetchAllSources(1, bypassCache, env);
    return buildStatusView(data);
  }

  if (routeStr.startsWith("digest:")) {
    const days = parseInt(routeStr.split(":")[1], 10) || 7;
    const data = await fetchAllSources(days >= 30 ? 3 : 1, bypassCache, env);
    const merged = mergeAndDedupe(data.bySource, days);
    return buildDigestView(merged, days);
  }

  if (routeStr.startsWith("list:all:")) {
    const parts = routeStr.split(":");
    const mode = parts[2]; // latest | 7 | 30
    const page = parseInt(parts[3], 10) || 1;
    const onlinePages = mode === "30" ? 3 : 1;
    const data = await fetchAllSources(onlinePages, bypassCache, env);
    const days = mode === "latest" ? null : parseInt(mode, 10);
    let items = mergeAndDedupe(data.bySource, days);
    if (mode === "latest") items = items.slice(0, 30);
    const header =
      mode === "latest"
        ? "🔥 THÔNG BÁO MỚI NHẤT — TOÀN HUB"
        : `📅 THÔNG BÁO ${days} NGÀY GẦN NHẤT — TOÀN HUB`;
    return buildPaginatedListView(header, items, page, `list:all:${mode}`);
  }

  if (routeStr.startsWith("src:")) {
    const parts = routeStr.split(":");
    const skey = parts[1];
    const page = parseInt(parts[2], 10) || 1;
    const src = SOURCE_BY_KEY[skey];
    if (!src) return mainMenuView();

    if (skey === "fb_htttql" && !(env && (env.FB_HTTTQL_RSS_URL || env.FB_ACCESS_TOKEN))) {
      return {
        text: [
          "📘 <b>FANPAGE KHOA HỆ THỐNG THÔNG TIN QUẢN LÝ (MIS — HUB)</b>",
          "━━━━━━━━━━━━━━━━━━━━",
          "👇 Bấm nút bên dưới để xem bài viết mới nhất trực tiếp trên Fanpage Khoa:",
        ].join("\n"),
        markup: {
          inline_keyboard: [
            [{ text: "📘 Mở Fanpage Khoa HTTTQL", url: FB_HTTTQL_URL }],
            [
              { text: "📢 Thông báo Web Khoa", callback_data: "src:htttql:1" },
              { text: "⬅️ Không gian MIS", callback_data: "m:mis" },
            ],
            [{ text: "📌 Quay lại Menu chính", callback_data: "m:home" }],
          ],
        },
      };
    }

    const items = await fetchSingleSourceCached(skey, skey === "online" ? 3 : 1, bypassCache, env);
    const siblingMap = {
      daotao: { cb: "src:daotao_news:1", label: "📰 Xem Tin tức & Thực tập — Đào tạo" },
      daotao_news: { cb: "src:daotao:1", label: "🎓 Xem Thông báo — Phòng Đào tạo" },
      htttql: { cb: "src:htttql_ev:1", label: "🚀 Xem Sự kiện & Tọa đàm MIS" },
      htttql_ev: { cb: "src:htttql:1", label: "📢 Xem Thông báo Web Khoa HTTTQL" },
      fb_htttql: { cb: "src:htttql:1", label: "📢 Xem Thông báo Web Khoa HTTTQL" },
    };
    const sibling = siblingMap[skey];
    return buildPaginatedListView(`${src.emoji} ${src.name.toUpperCase()}`, items, page, `src:${skey}`, {
      webUrl: src.url,
      siblingCb: sibling ? sibling.cb : "",
      siblingLabel: sibling ? sibling.label : "",
      backCb: skey.startsWith("htttql") || skey === "fb_htttql" ? "m:mis" : "m:portals",
      backLabel: skey.startsWith("htttql") || skey === "fb_htttql" ? "⬅️ Không gian Khoa HTTTQL" : "⬅️ Chọn cổng HUB khác",
    });
  }

  if (routeStr.startsWith("tp:")) {
    const parts = routeStr.split(":");
    const tpKey = parts[1];
    const page = parseInt(parts[2], 10) || 1;
    const tp = TOPICS[tpKey] || TOPICS.general;
    const data = await fetchAllSources(2, bypassCache, env);
    const all = mergeAndDedupe(data.bySource, null);
    const filtered = tpKey === "urgent"
      ? all.filter((it) => isUrgentTitle(it.title))
      : all.filter((it) => classifyItem(it.title, it.source).key === tpKey);
    return buildPaginatedListView(`${tp.icon} CHỦ ĐỀ: ${tp.label.toUpperCase()}`, filtered.slice(0, 40), page, `tp:${tpKey}`, {
      backCb: "m:topics",
      backLabel: "⬅️ Chọn chủ đề khác",
    });
  }

  if (routeStr.startsWith("mis:radar:")) {
    const page = parseInt(routeStr.split(":")[2], 10) || 1;
    const data = await fetchAllSources(2, bypassCache, env);
    const all = mergeAndDedupe(data.bySource, null);
    const misItems = all.filter((it) => isMisRelated(it.title, it.source));
    return buildPaginatedListView("🌟 RADAR TIN KHOA HTTTQL (MIS) TOÀN HUB", misItems.slice(0, 40), page, "mis:radar", {
      webUrl: "https://khoahtttql.hub.edu.vn/thong-bao",
      backCb: "m:mis",
      backLabel: "⬅️ Không gian Khoa HTTTQL",
    });
  }

  if (routeStr.startsWith("q:")) {
    const lastColon = routeStr.lastIndexOf(":");
    const kw = routeStr.slice(2, lastColon);
    const page = parseInt(routeStr.slice(lastColon + 1), 10) || 1;
    const data = await fetchAllSources(3, bypassCache, env);
    const all = mergeAndDedupe(data.bySource, null);
    const kwNorm = stripAccents(kw).toLowerCase().trim();
    const found = all.filter((it) => stripAccents(it.title).toLowerCase().includes(kwNorm));
    return buildPaginatedListView(`🔎 TÌM "${kw}" TRÊN TOÀN HUB`, found.slice(0, 40), page, `q:${kw}`, {
      backCb: "m:search",
      backLabel: "⬅️ Tìm từ khoá khác",
    });
  }

  if (routeStr.startsWith("v:")) {
    const parts = routeStr.split(":");
    const code = parts[1];
    const id = parts[2];
    const backCb = parts.length > 3 ? parts.slice(3).join(":") : "m:home";
    const detail = await fetchArticleDetail(code, id, env);
    return buildDetailView(detail, backCb);
  }

  return mainMenuView();
}

// ---------------------------------------------------------------- Update Processors

async function handleMessage(msg, env) {
  const chatId = msg.chat && msg.chat.id;
  const fromId = (msg.from && msg.from.id) || chatId;
  const text = (msg.text || msg.caption || "").trim();
  const photoFileId = msg.photo && msg.photo.length ? msg.photo[msg.photo.length - 1].file_id : "";
  if (!chatId || (!text && !photoFileId)) return;

  const isPrivate = msg.chat.type === "private";
  const isCommand = text.startsWith("/");
  const cmd = isCommand ? text.split(/\s+/)[0].split("@")[0].toLowerCase() : "";
  const arg = isCommand ? text.slice(text.split(/\s+/)[0].length).trim() : text;

  // Tự động lưu người dùng vào Cloudflare KV để nhận thông báo tự động & Broadcast
  await trackSubscriber(env, msg.chat, msg.from, cmd === "/start");

  // 1) Kiểm tra nếu Admin đang trả lời ô ForceReply soạn thông báo Broadcast
  const replyText = (msg.reply_to_message && msg.reply_to_message.text) || "";
  const isReplyBroadcast = replyText.includes("SOẠN THÔNG BÁO PHÁT SÓNG");
  if (isReplyBroadcast && (await isAdminUser(env, fromId))) {
    const urgent = replyText.includes("KHẨN");
    const draft = { text, photoFileId, urgent, createdAt: Date.now() };
    if (env.SUBSCRIBERS_KV) {
      await env.SUBSCRIBERS_KV.put(`draft:${fromId}`, JSON.stringify(draft), { expirationTtl: 900 });
    }
    const users = await listAllSubscribers(env);
    const activeCount = users.filter((u) => u.subscribed !== false && !u.blocked).length;
    const preview = formatBroadcastPayload(text, urgent);
    const confirmKb = {
      inline_keyboard: [
        [{ text: `✅ XÁC NHẬN GỬI NGAY (${activeCount} người)`, callback_data: "adm:bc_send" }],
        [
          { text: "🧪 Gửi thử cho mình", callback_data: "adm:bc_preview" },
          { text: "❌ Huỷ bỏ", callback_data: "adm:bc_cancel" },
        ],
      ],
    };
    const headerNote = `👀 <b>XEM TRƯỚC THÔNG BÁO TRƯỚC KHI GỬI (${activeCount} người nhận):</b>\n\n`;
    if (photoFileId) {
      await sendPhotoMsg(env, chatId, photoFileId, preview, confirmKb);
    } else {
      await sendMsg(env, chatId, headerNote + preview, confirmKb);
    }
    return;
  }

  // Bỏ qua tin nhắn thường trong group chat (trừ khi reply prompt tìm kiếm của bot)
  const isReplyToSearch = Boolean(replyText && replyText.includes("Nhập từ khoá"));
  if (!isCommand && !isPrivate && !isReplyToSearch) return;

  // 2) Khu vực QUẢN TRỊ VIÊN (/admin, /broadcast, /bc, /tb, /bc!, /testpush)
  if (cmd === "/admin") {
    if (arg && !(await isAdminUser(env, fromId))) {
      const claim = await claimAdminWithPin(env, fromId, arg);
      if (claim.ok) {
        const v = await adminHomeView(env, fromId);
        await sendMsg(
          env,
          chatId,
          "✅ <b>Xác thực Quản trị viên thành công!</b> Tài khoản của bạn đã được khoá làm Admin vĩnh viễn.\n\n" + v.text,
          v.markup
        );
        return;
      }
      await sendMsg(env, chatId, "⛔ Mã xác thực không đúng hoặc Admin đã được thiết lập trước đó.");
      return;
    }
    if (!(await isAdminUser(env, fromId))) {
      await sendMsg(env, chatId, "⛔ Bạn không có quyền truy cập khu vực Quản trị viên.");
      return;
    }
    const v = await adminHomeView(env, fromId);
    await sendMsg(env, chatId, v.text, v.markup);
    return;
  }

  if (cmd === "/broadcast" || cmd === "/bc" || cmd === "/tb" || cmd === "/bc!") {
    if (!(await isAdminUser(env, fromId))) {
      await sendMsg(env, chatId, "⛔ Chỉ Quản trị viên mới có quyền gửi thông báo hàng loạt.");
      return;
    }
    if (!arg && !photoFileId) {
      await sendMsg(
        env,
        chatId,
        "📢 <b>Cách gửi thông báo cho tất cả người dùng:</b>\n" +
        "• <code>/bc Nội dung thông báo...</code> (xem trước rồi xác nhận)\n" +
        "• <code>/bc! Nội dung thông báo...</code> (gửi thẳng ngay lập tức!)\n" +
        "• Hoặc gửi <b>ảnh kèm chú thích</b> <code>/bc Nội dung...</code>\n" +
        "• Hoặc mở <code>/admin</code> để dùng giao diện nút bấm!"
      );
      return;
    }
    const draft = { text: arg, photoFileId, urgent: false, createdAt: Date.now() };
    if (cmd === "/bc!") {
      const waitMsg = await sendMsg(env, chatId, "⏳ Đang phát sóng thông báo tới tất cả người dùng...");
      const stat = await executeBroadcast(env, draft);
      const report = [
        "✅ <b>PHÁT SÓNG TRỰC TIẾP HOÀN TẤT!</b>",
        "━━━━━━━━━━━━━━━━━━━━",
        `📤 Đã gửi thành công: <b>${stat.sent}/${stat.total}</b> người`,
        `🚫 Đã chặn bot (tự gỡ): <b>${stat.blocked}</b> người`,
        `❌ Lỗi khác: <b>${stat.failed}</b> người`,
        `⏱ Hoàn tất lúc: <code>${vnNowLabel()}</code>`,
      ].join("\n");
      const mid = waitMsg && waitMsg.result && waitMsg.result.message_id;
      if (mid) {
        await editMsg(env, chatId, mid, report, { inline_keyboard: [[{ text: "🛡️ Mở bảng Admin", callback_data: "adm:home" }]] });
      } else {
        await sendMsg(env, chatId, report);
      }
      return;
    }

    if (env.SUBSCRIBERS_KV) {
      await env.SUBSCRIBERS_KV.put(`draft:${fromId}`, JSON.stringify(draft), { expirationTtl: 900 });
    }
    const users = await listAllSubscribers(env);
    const activeCount = users.filter((u) => u.subscribed !== false && !u.blocked).length;
    const preview = formatBroadcastPayload(arg, false);
    const confirmKb = {
      inline_keyboard: [
        [{ text: `✅ XÁC NHẬN GỬI NGAY (${activeCount} người)`, callback_data: "adm:bc_send" }],
        [
          { text: "🧪 Gửi thử cho mình", callback_data: "adm:bc_preview" },
          { text: "❌ Huỷ bỏ", callback_data: "adm:bc_cancel" },
        ],
      ],
    };
    if (photoFileId) {
      await sendPhotoMsg(env, chatId, photoFileId, preview, confirmKb);
    } else {
      await sendMsg(env, chatId, `👀 <b>XEM TRƯỚC (${activeCount} người sẽ nhận):</b>\n\n` + preview, confirmKb);
    }
    return;
  }

  if (cmd === "/testpush") {
    if (!(await isAdminUser(env, fromId))) {
      await sendMsg(env, chatId, "⛔ Lệnh này chỉ dành cho Quản trị viên.");
      return;
    }
    const preview = formatBroadcastPayload("Đây là thông báo kiểm tra tức thì từ bảng Quản trị viên HUB Monitor Pro! 🔔", false);
    await sendMsg(env, chatId, preview, { inline_keyboard: [[{ text: "🛡️ Về bảng Admin", callback_data: "adm:home" }]] });
    return;
  }

  // 3) Cài đặt nhận thông báo cho người dùng (/notify)
  if (cmd === "/notify") {
    const v = await userNotifyView(env, chatId);
    await sendMsg(env, chatId, v.text, v.markup);
    return;
  }

  // Các màn hình tĩnh trả lời tức thì <50ms
  if (cmd === "/start" || cmd === "/menu") {
    const v = mainMenuView();
    await sendMsg(env, chatId, v.text, v.markup);
    return;
  }
  if (cmd === "/help") {
    const v = helpView();
    await sendMsg(env, chatId, v.text, v.markup);
    return;
  }
  if (cmd === "/htttql" || cmd === "/mis" || cmd === "/khoa") {
    const v = misHubView();
    await sendMsg(env, chatId, v.text, v.markup);
    return;
  }
  if (cmd === "/portals" || cmd === "/links") {
    const v = quickLinksView();
    await sendMsg(env, chatId, v.text, v.markup);
    return;
  }
  if (cmd === "/author" || cmd === "/about") {
    const v = authorView();
    await sendMsg(env, chatId, v.text, v.markup);
    return;
  }
  if (cmd === "/clear") {
    const reqCount = parseInt(arg, 10) || 100;
    await clearChatHistory(env, chatId, msg.message_id, reqCount);
    await sendMsg(
      env,
      chatId,
      "🧹 <b>Đã dọn sạch lịch sử trò chuyện gần đây!</b>\n(Lưu ý: Telegram chỉ cho phép bot xoá tin nhắn trong vòng 48 giờ)",
      {
        inline_keyboard: [[
          { text: "📌 Mở Menu", callback_data: "m:home" },
          { text: "🗑️ Ẩn tin này", callback_data: "del:self" },
        ]],
      }
    );
    return;
  }

  // Xác định route cần tải dữ liệu live
  let route = null;
  let loadingText = "⏳ Đang quét dữ liệu từ hệ sinh thái HUB...";

  if (cmd === "/latest" || cmd === "/update") {
    route = "rf:list:all:latest:1";
    loadingText = "⚡ Đang lấy thông báo mới nhất từ tất cả 7 cổng HUB...";
  } else if (cmd === "/full7d") {
    route = "list:all:7:1";
    loadingText = "📅 Đang tổng hợp thông báo 7 ngày gần nhất...";
  } else if (cmd === "/full30d") {
    route = "list:all:30:1";
    loadingText = "🗓️ Đang tổng hợp thông báo 30 ngày gần nhất...";
  } else if (cmd === "/thi") {
    route = "tp:exam:1";
    loadingText = "📝 Đang tải lịch thi & thông báo khảo thí...";
  } else if (cmd === "/daotao") {
    route = "src:daotao:1";
    loadingText = "🎓 Đang tải thông báo Phòng Đào tạo...";
  } else if (cmd === "/scc") {
    route = "src:scc:1";
    loadingText = "🤝 Đang tải thông báo Trung tâm SV (SCC)...";
  } else if (cmd === "/hocphi") {
    route = "tp:tuition:1";
    loadingText = "💰 Đang lọc thông báo Học phí & Tài chính...";
  } else if (cmd === "/hocbong") {
    route = "tp:scholar:1";
    loadingText = "🏆 Đang săn tin Học bổng trên toàn HUB...";
  } else if (cmd === "/digest") {
    route = "digest:7";
    loadingText = "📰 Đang biên tập bản tin tổng hợp tuần...";
  } else if (cmd === "/status") {
    route = "rf:status";
    loadingText = "📊 Đang ping kiểm tra 7 cổng thông tin HUB...";
  } else if (cmd === "/find" || !isCommand) {
    const kw = arg.trim();
    if (!kw) {
      const v = searchMenuView();
      await sendMsg(env, chatId, v.text, v.markup);
      return;
    }
    const safeKw = truncateUtf8(kw.replace(/:/g, " "), 36).trim();
    route = `q:${safeKw}:1`;
    loadingText = `🔎 Đang tìm "<b>${escapeHtml(safeKw)}</b>" trên toàn bộ 7 cổng HUB...`;
  } else {
    const v = mainMenuView();
    await sendMsg(
      env,
      chatId,
      "🤔 Không nhận ra lệnh này. Mở nhanh bảng điều khiển cho bạn nhé:\n\n" + v.text,
      v.markup
    );
    return;
  }

  // Gửi tin nhắn loading rồi edit tại chỗ để chat siêu sạch đẹp!
  const sent = await sendMsg(env, chatId, loadingText);
  const msgId = sent && sent.result && sent.result.message_id;

  try {
    const view = await renderRoute(route, false, env);
    if (msgId) {
      await editMsg(env, chatId, msgId, view.text, view.markup);
    } else {
      await sendMsg(env, chatId, view.text, view.markup);
    }
  } catch (e) {
    log("handleMessage route error", route, e);
    const errText = `❌ Có lỗi khi truy cập hệ thống HUB: <code>${escapeHtml(e.message || e)}</code>\nVui lòng thử lại sau giây lát.`;
    const fallbackKb = { inline_keyboard: [[{ text: "📌 Mở Menu chính", callback_data: "m:home" }]] };
    if (msgId) {
      await editMsg(env, chatId, msgId, errText, fallbackKb);
    } else {
      await sendMsg(env, chatId, errText, fallbackKb);
    }
  }
}

async function handleCallback(cb, env) {
  const data = cb.data || "";
  const msg = cb.message;
  const chatId = msg && msg.chat && msg.chat.id;
  const fromId = (cb.from && cb.from.id) || chatId;
  const messageId = msg && msg.message_id;

  if (msg && msg.chat) {
    await trackSubscriber(env, msg.chat, cb.from, false);
  }

  if (data === "noop") {
    await answerCb(env, cb.id, "Dùng nút Trước / Sau để chuyển trang");
    return;
  }

  // User toggle auto-notifications
  if (data === "user:notify_on" || data === "user:notify_off") {
    const enable = data === "user:notify_on";
    await setUserSubscription(env, chatId, enable, false);
    await answerCb(env, cb.id, enable ? "🔔 Đã bật nhận thông báo!" : "🔕 Đã tắt nhận thông báo!");
    if (chatId && messageId) {
      const v = await userNotifyView(env, chatId);
      await editMsg(env, chatId, messageId, v.text, v.markup);
    }
    return;
  }

  // Admin Panel Callbacks (strictly protected!)
  if (data.startsWith("adm:")) {
    if (!(await isAdminUser(env, fromId))) {
      await answerCb(env, cb.id, "⛔ Chỉ Quản trị viên mới dùng được nút này!", true);
      return;
    }
    if (data === "adm:home") {
      await answerCb(env, cb.id, "🛡️ Đang tải bảng Admin...");
      const v = await adminHomeView(env, fromId);
      await editMsg(env, chatId, messageId, v.text, v.markup);
      return;
    }
    if (data.startsWith("adm:users:")) {
      const page = parseInt(data.split(":")[2], 10) || 1;
      await answerCb(env, cb.id, "👥 Đang tải danh sách...");
      const v = await adminUsersView(env, page);
      await editMsg(env, chatId, messageId, v.text, v.markup);
      return;
    }
    if (data === "adm:bc_ask" || data === "adm:bc_urgent_ask") {
      const isUrgent = data === "adm:bc_urgent_ask";
      await answerCb(env, cb.id, "Nhập nội dung thông báo...");
      await sendMsg(
        env,
        chatId,
        (isUrgent
          ? "🚨 <b>SOẠN THÔNG BÁO PHÁT SÓNG KHẨN</b>\n"
          : "📢 <b>SOẠN THÔNG BÁO PHÁT SÓNG CHO TẤT CẢ NGƯỜI DÙNG</b>\n") +
        "Hãy trả lời tin nhắn này bằng văn bản (hoặc gửi ảnh kèm chú thích). Bot sẽ cho bạn xem trước trước khi phát sóng!",
        { force_reply: true, input_field_placeholder: "Nhập nội dung thông báo gửi tới mọi người..." }
      );
      return;
    }
    if (data === "adm:bc_preview") {
      const draft = env.SUBSCRIBERS_KV ? await env.SUBSCRIBERS_KV.get(`draft:${fromId}`, { type: "json" }) : null;
      if (!draft) {
        await answerCb(env, cb.id, "Bản nháp đã hết hạn (15 phút), vui lòng soạn lại.", true);
        return;
      }
      await answerCb(env, cb.id, "🧪 Đang gửi thử cho bạn...");
      const formatted = formatBroadcastPayload(draft.text || "", Boolean(draft.urgent));
      if (draft.photoFileId) {
        await sendPhotoMsg(env, chatId, draft.photoFileId, formatted);
      } else {
        await sendMsg(env, chatId, formatted);
      }
      return;
    }
    if (data === "adm:bc_cancel") {
      if (env.SUBSCRIBERS_KV) await env.SUBSCRIBERS_KV.delete(`draft:${fromId}`);
      await answerCb(env, cb.id, "❌ Đã huỷ bản nháp.");
      const v = await adminHomeView(env, fromId);
      if (msg && msg.photo) {
        await tgApi(env, "deleteMessage", { chat_id: chatId, message_id: messageId });
        await sendMsg(env, chatId, v.text, v.markup);
      } else {
        await editMsg(env, chatId, messageId, v.text, v.markup);
      }
      return;
    }
    if (data === "adm:bc_send") {
      const draft = env.SUBSCRIBERS_KV ? await env.SUBSCRIBERS_KV.get(`draft:${fromId}`, { type: "json" }) : null;
      if (!draft) {
        await answerCb(env, cb.id, "Bản nháp đã hết hạn, vui lòng soạn lại.", true);
        return;
      }
      await answerCb(env, cb.id, "🚀 Đang phát sóng thông báo...");
      if (env.SUBSCRIBERS_KV) await env.SUBSCRIBERS_KV.delete(`draft:${fromId}`);
      let statusMid = messageId;
      if (msg && msg.photo) {
        const sentWait = await sendMsg(env, chatId, "⏳ <b>Đang gửi thông báo tới tất cả người dùng...</b>");
        statusMid = sentWait && sentWait.result && sentWait.result.message_id;
      } else {
        await editMsg(env, chatId, messageId, "⏳ <b>Đang gửi thông báo tới tất cả người dùng...</b>");
      }
      const stat = await executeBroadcast(env, draft);
      const report = [
        "✅ <b>PHÁT SÓNG THÔNG BÁO HOÀN TẤT!</b>",
        "━━━━━━━━━━━━━━━━━━━━",
        `📤 Đã gửi thành công: <b>${stat.sent}/${stat.total}</b> người`,
        `🚫 Đã chặn bot (tự gỡ): <b>${stat.blocked}</b> người`,
        `❌ Lỗi khác: <b>${stat.failed}</b> người`,
        `⏱ Hoàn tất lúc: <code>${vnNowLabel()}</code>`,
      ].join("\n");
      const doneKb = { inline_keyboard: [[{ text: "🛡️ Quay lại bảng Admin", callback_data: "adm:home" }]] };
      if (statusMid) {
        await editMsg(env, chatId, statusMid, report, doneKb);
      } else {
        await sendMsg(env, chatId, report, doneKb);
      }
      return;
    }
    if (data === "adm:test_self") {
      await answerCb(env, cb.id, "🧪 Đang gửi thông báo thử...");
      const preview = formatBroadcastPayload("Kiểm tra đẩy thông báo tức thì từ Quản trị viên HUB Monitor Pro! 🔔", false);
      await sendMsg(env, chatId, preview);
      return;
    }
    return;
  }

  if (data === "del:self") {
    await answerCb(env, cb.id, "Đã ẩn");
    if (chatId && messageId) {
      await tgApi(env, "deleteMessage", { chat_id: chatId, message_id: messageId });
    }
    return;
  }

  if (data === "clear:ask") {
    await answerCb(env, cb.id);
    if (chatId && messageId) {
      await editMsg(
        env,
        chatId,
        messageId,
        "🧹 <b>XÁC NHẬN DỌN LỊCH SỬ TRÒ CHUYỆN</b>\n━━━━━━━━━━━━━━━━━━━━\nBot sẽ xoá các tin nhắn gần đây (trong vòng 48 giờ theo quy định của Telegram).\n\nBạn muốn dọn bao nhiêu tin gần nhất?",
        {
          inline_keyboard: [
            [
              { text: "🧹 Xoá 100 tin gần nhất", callback_data: "clear:run:100" },
              { text: "🔥 Xoá tối đa (300 tin)", callback_data: "clear:run:300" },
            ],
            [{ text: "⬅️ Huỷ & Quay lại Menu", callback_data: "m:home" }],
          ],
        }
      );
    }
    return;
  }

  if (data.startsWith("clear:run:")) {
    const count = parseInt(data.split(":")[2], 10) || 100;
    await answerCb(env, cb.id, "🧹 Đang dọn sạch chat...");
    if (chatId && messageId) {
      await clearChatHistory(env, chatId, messageId, count);
      await sendMsg(
        env,
        chatId,
        "🧹 <b>Đã dọn sạch lịch sử trò chuyện gần đây!</b>\n(Lưu ý: Telegram chỉ cho phép bot xoá tin nhắn trong vòng 48 giờ)",
        {
          inline_keyboard: [[
            { text: "📌 Mở Menu", callback_data: "m:home" },
            { text: "🗑️ Ẩn tin này", callback_data: "del:self" },
          ]],
        }
      );
    }
    return;
  }

  if (data === "m:search_ask") {
    await answerCb(env, cb.id, "Nhập từ khoá cần tìm...");
    if (chatId) {
      await sendMsg(
        env,
        chatId,
        "🔎 <b>Nhập từ khoá bạn muốn tìm trên toàn hệ thống HUB</b>\n(Hỗ trợ không dấu, ví dụ: học bổng, lịch thi đợt 2, tốt nghiệp, MIS...)",
        { force_reply: true, input_field_placeholder: "VD: hoc bong, lich thi, ngoai tru..." }
      );
    }
    return;
  }

  // Toast phản hồi tức thì dưới 100ms khi bấm nút!
  const toast =
    data.startsWith("v:") ? "📄 Đang trích xuất nội dung & file PDF..."
    : data.startsWith("rf:") ? "🔄 Đang tải dữ liệu mới nhất..."
    : data === "status" ? "📊 Đang ping 7 cổng HUB..."
    : data.startsWith("m:") ? ""
    : "⏳ Đang tải...";
  await answerCb(env, cb.id, toast);

  if (!chatId || !messageId) return;

  try {
    const view = await renderRoute(data, false, env);
    await editMsg(env, chatId, messageId, view.text, view.markup);
  } catch (e) {
    log("handleCallback error", data, e);
    const errText = `❌ Không thể tải mục này lúc này: <code>${escapeHtml(e.message || e)}</code>`;
    await editMsg(env, chatId, messageId, errText, {
      inline_keyboard: [
        [{ text: "🔄 Thử lại", callback_data: data }],
        [{ text: "📌 Quay lại Menu chính", callback_data: "m:home" }],
      ],
    });
  }
}

async function handleInlineQuery(iq, env) {
  const q = (iq.query || "").trim();
  try {
    const data = await fetchAllSources(1, false, env);
    let items = mergeAndDedupe(data.bySource, null);
    if (q) {
      const qn = stripAccents(q).toLowerCase();
      items = items.filter((it) => stripAccents(it.title).toLowerCase().includes(qn));
    }
    const results = items.slice(0, 15).map((it) => {
      const src = SOURCE_BY_KEY[it.source] || { emoji: "📌", name: it.source, short: it.source };
      const cat = classifyItem(it.title, it.source);
      const cardText = [
        `${cat.icon} <b>${escapeHtml(it.title)}</b>`,
        `━━━━━━━━━━━━━━━━━━━━`,
        `🏢 <b>Nguồn:</b> ${src.emoji} ${escapeHtml(src.name)}`,
        `📅 <b>Ngày đăng:</b> <code>${escapeHtml(it.date)}</code>`,
        `🏷️ <code>${cat.tag}</code> · Chia sẻ qua HUB Monitor Pro`,
      ].join("\n");
      return {
        type: "article",
        id: `${it.code}_${it.id}`.slice(0, 60),
        title: `${cat.icon} ${it.title.slice(0, 90)}`,
        description: `${src.emoji} ${src.short} · 📅 ${it.date}`,
        input_message_content: {
          message_text: cardText,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        },
        reply_markup: {
          inline_keyboard: [[{ text: "🌐 Mở thông báo gốc", url: it.url }]],
        },
      };
    });

    await tgApi(env, "answerInlineQuery", {
      inline_query_id: iq.id,
      results,
      cache_time: 120,
      is_personal: false,
    });
  } catch (e) {
    log("inlineQuery error", e);
  }
}

async function processUpdate(update, env) {
  if (update.callback_query) {
    await handleCallback(update.callback_query, env);
  } else if (update.message) {
    await handleMessage(update.message, env);
  } else if (update.inline_query) {
    await handleInlineQuery(update.inline_query, env);
  }
}

// ---------------------------------------------------------------- Auto-Setup Endpoint

async function handleSetup(request, env) {
  const url = new URL(request.url);
  if (env.SETUP_SECRET && url.searchParams.get("key") !== env.SETUP_SECRET) {
    return new Response("Forbidden (sai key)", { status: 403 });
  }
  if (!env.BOT_TOKEN) {
    return new Response("Thiếu biến môi trường BOT_TOKEN trong Cloudflare Worker!", { status: 500 });
  }
  const webhookUrl = `${url.origin}/webhook`;
  const [rHook, rCmds, rMenu] = await Promise.all([
    tgApi(env, "setWebhook", {
      url: webhookUrl,
      allowed_updates: ["message", "callback_query", "inline_query"],
      drop_pending_updates: false,
    }),
    tgApi(env, "setMyCommands", { commands: BOT_COMMANDS }),
    tgApi(env, "setChatMenuButton", { menu_button: { type: "commands" } }),
  ]);

  return new Response(
    JSON.stringify(
      {
        status: rHook.ok && rCmds.ok && rMenu.ok ? "ALL_OK" : "PARTIAL_ERROR",
        webhook_url: webhookUrl,
        setWebhook: rHook,
        setMyCommands: rCmds,
        setChatMenuButton: rMenu,
      },
      null,
      2
    ),
    { headers: { "Content-Type": "application/json; charset=utf-8" } }
  );
}

// ---------------------------------------------------------------- Worker Entrypoint

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/webhook" && request.method === "POST") {
      try {
        const update = await request.json();
        ctx.waitUntil(processUpdate(update, env));
      } catch (e) {
        log("webhook parse error", e);
      }
      return new Response("OK");
    }
    if (url.pathname === "/setup" && request.method === "GET") {
      return await handleSetup(request, env);
    }
    if (url.pathname === "/api/subscribers" && request.method === "GET") {
      if (!env.BOT_TOKEN) return new Response("Missing token", { status: 500 });
      const expected = await sha256Hex(`${env.BOT_TOKEN}:subscribers`);
      const provided = (request.headers.get("X-Hub-Auth") || "").trim();
      if (!provided || provided !== expected) {
        return new Response("Unauthorized", { status: 401 });
      }
      const users = await listAllSubscribers(env);
      const activeIds = users.filter((u) => u.subscribed !== false && !u.blocked).map((u) => String(u.id));
      return new Response(
        JSON.stringify({ ok: true, count: activeIds.length, chat_ids: activeIds }),
        { headers: { "Content-Type": "application/json; charset=utf-8" } }
      );
    }
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(
        "HUB Monitor Pro v2.0 — Telegram Webhook is running (9 HUB feeds + Khoa HTTTQL MIS)\n" +
        "Open /setup to auto-register Webhook, Bot Commands & Blue Menu Button.",
        { headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }
    return new Response("Not found", { status: 404 });
  },
};

export {
  SOURCES,
  parseOnlineItems,
  parseDnnNotif,
  parseDnnNews,
  fetchAllSources,
  mergeAndDedupe,
  fetchArticleDetail,
  classifyItem,
  isMisRelated,
};
