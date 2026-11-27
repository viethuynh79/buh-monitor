/**
 * HUB News — Cloudflare Workers Telegram Bot & 5-Minute Auto-Push Cron
 * 7 official portals of Ho Chi Minh University of Banking (HUB), Online HUB Priority #1.
 */

const BOT_BRAND = "HUB News";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const VN_OFFSET = 7 * 3600 * 1000;
const PAGE_SIZE = 5;
const CACHE_TTL_SEC = 60;
const ONLINE_CACHE_TTL_SEC = 45;
const DETAIL_CACHE_TTL_SEC = 600;
const SUBSCRIBERS_CACHE_TTL_SEC = 60;
const SNAPSHOT_WRITE_INTERVAL_MS = 10 * 60 * 1000;
const SNAPSHOT_SWR_MAX_AGE_MS = 15 * 60 * 1000;
const SNAPSHOT_BG_REFRESH_MS = 3 * 60 * 1000;
const FETCH_CONCURRENCY = 4;
const LINE = "────────────";

const ONLINE_HOME = "https://online.hub.edu.vn/";
const ONLINE_ALT = "https://online.hub.edu.vn/Default.aspx";
const ONLINE_GRID_TARGET = "ctl00$ContentPlaceHolder1$ctl00$ctl00$ctl00$ctl00$grvNewsgroup";

const HTML_ENTITIES = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  acirc: "â", Acirc: "Â", ecirc: "ê", Ecirc: "Ê", ocirc: "ô", Ocirc: "Ô",
  aacute: "á", Aacute: "Á", agrave: "à", Agrave: "À",
  eacute: "é", Eacute: "É", egrave: "è", Egrave: "È",
  iacute: "í", Iacute: "Í", igrave: "ì", Igrave: "Ì",
  oacute: "ó", Oacute: "Ó", ograve: "ò", Ograve: "Ò",
  uacute: "ú", Uacute: "Ú", ugrave: "ù", Ugrave: "Ù",
};
const ENTITY_RE = /&(?:#(\d+)|#x([0-9a-f]+)|([a-zA-Z]+));/g;
const TAG_RE = /<[^>]+>/g;
const WS_RE = /\s+/g;
const ACCENT_RE = /[\u0300-\u036f]/g;
const TITLE_PREFIX_RE = /^(?:thong\s+bao|tb)\s*(?:so\s+\S+\s*)?(?:ngay\s+\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\s*)?(?:v\/v|ve\s+viec)?\s*/;
const NON_ALNUM_RE = /[^a-z0-9]+/g;
const DEADLINE_RE = /(?:hạn\s+cuối|trước\s+ngày|đến\s+hết\s+ngày|chậm\s+nhất|hạn\s+nộp|thời\s+hạn|từ\s+ngày\s+\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\s+đến(?:\s+hết)?\s+ngày)[^.\n;]{0,65}?(?<!\d)\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?(?!\d)/i;

const AUTHOR_NAME = "Huynh Viet";
const AUTHOR_FB_URL = "https://www.facebook.com/profile.php?id=61591547874181";

const SOURCES = [
  {
    key: "online",
    code: "onl",
    name: "Online HUB",
    short: "Online HUB",
    emoji: "🏛️",
    type: "asp_grid",
    url: ONLINE_HOME,
    base: "https://online.hub.edu.vn",
    section: "",
    priority: 1,
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
    priority: 2,
  },
  {
    key: "daotao",
    code: "dt",
    name: "Phòng Đào tạo",
    short: "Phòng Đào tạo",
    emoji: "🎓",
    type: "dnn_notif",
    url: "https://phongdaotao.hub.edu.vn/thong-bao",
    base: "https://phongdaotao.hub.edu.vn",
    section: "thong-bao",
    priority: 3,
  },
  {
    key: "daotao_news",
    code: "dtn",
    name: "Đào tạo · Tin & Thực tập",
    short: "Đào tạo (Tin)",
    emoji: "📰",
    type: "dnn_pdt_home",
    url: "https://phongdaotao.hub.edu.vn/",
    base: "https://phongdaotao.hub.edu.vn",
    section: "tin-tuc-su-kien",
    priority: 4,
  },
  {
    key: "scc",
    code: "scc",
    name: "Trung tâm SV (SCC)",
    short: "Trung tâm SV",
    emoji: "🤝",
    type: "dnn_news",
    url: "https://scc.hub.edu.vn/thong-bao",
    base: "https://scc.hub.edu.vn",
    section: "thong-bao",
    priority: 5,
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
    priority: 6,
  },
  {
    key: "ketoan",
    code: "ktc",
    name: "Tài chính - Kế toán",
    short: "Tài chính - KT",
    emoji: "💰",
    type: "dnn_notif",
    url: "https://phongketoan.hub.edu.vn/thong-bao",
    base: "https://phongketoan.hub.edu.vn",
    section: "thong-bao",
    priority: 7,
  },
];

const SOURCE_BY_KEY = Object.fromEntries(SOURCES.map((s) => [s.key, s]));

const DETAIL_ROUTES = {
  onl: { source: "online",      base: "https://online.hub.edu.vn",      section: "" },
  kt:  { source: "ktdbcl",      base: "https://phongktdbcl.hub.edu.vn", section: "thong-bao" },
  dt:  { source: "daotao",      base: "https://phongdaotao.hub.edu.vn", section: "thong-bao" },
  dtn: { source: "daotao_news", base: "https://phongdaotao.hub.edu.vn", section: "tin-tuc-su-kien" },
  dtt: { source: "daotao_news", base: "https://phongdaotao.hub.edu.vn", section: "xet-tot-nghiep" },
  scc: { source: "scc",         base: "https://scc.hub.edu.vn",         section: "thong-bao" },
  hub: { source: "hub",         base: "https://hub.edu.vn",             section: "thong-bao" },
  ktc: { source: "ketoan",      base: "https://phongketoan.hub.edu.vn", section: "thong-bao" },
};

const TOPICS = {
  exam:    { icon: "📝", label: "Lịch thi & Khảo thí",  tag: "#LichThi" },
  tuition: { icon: "💰", label: "Học phí & Tài chính",  tag: "#HocPhi" },
  scholar: { icon: "🏆", label: "Học bổng & Giải thưởng", tag: "#HocBong" },
  grad:    { icon: "🎓", label: "Tốt nghiệp & Thực tập", tag: "#TotNghiep" },
  reg:     { icon: "📋", label: "Đào tạo & Học phần",   tag: "#DaoTao" },
  student: { icon: "🤝", label: "Sinh viên & Sự kiện",  tag: "#SinhVien" },
  urgent:  { icon: "🚨", label: "Khẩn & Lưu ý",         tag: "#KhanCap" },
  general: { icon: "📌", label: "Thông báo HUB",        tag: "#ThongBaoHUB" },
};

const BOT_COMMANDS = [
  { command: "menu",    description: "Bảng điều khiển chính" },
  { command: "latest",  description: "Tin mới nhất (7 cổng HUB)" },
  { command: "online",  description: "Online HUB (HUB Portal)" },
  { command: "full7d",  description: "Thông báo 7 ngày gần nhất" },
  { command: "full30d", description: "Thông báo 30 ngày gần nhất" },
  { command: "find",    description: "Tìm kiếm không dấu" },
  { command: "thi",     description: "Lịch thi & Khảo thí" },
  { command: "daotao",  description: "Phòng Đào tạo" },
  { command: "scc",     description: "Trung tâm Sinh viên (SCC)" },
  { command: "hocphi",  description: "Học phí & Tài chính" },
  { command: "hocbong", description: "Học bổng & Khen thưởng" },
  { command: "digest",  description: "Tổng hợp theo chủ đề" },
  { command: "portals", description: "Tiện ích sinh viên HUB" },
  { command: "status",  description: "Trạng thái 7 cổng HUB" },
  { command: "notify",  description: "Bật / Tắt thông báo tự động" },
  { command: "clear",   description: "Dọn lịch sử trò chuyện" },
  { command: "author",  description: "Thông tin tác giả" },
  { command: "help",    description: "Hướng dẫn nhanh" },
];

const QUICK_SEARCH_CHIPS = [
  { label: "📝 lịch thi",    kw: "lich thi" },
  { label: "🏆 học bổng",    kw: "hoc bong" },
  { label: "💰 học phí",     kw: "hoc phi" },
  { label: "🎓 tốt nghiệp",  kw: "tot nghiep" },
  { label: "💼 thực tập",    kw: "thuc tap" },
  { label: "🏠 ngoại trú",   kw: "ngoai tru" },
  { label: "🔎 phúc khảo",   kw: "phuc khao" },
  { label: "📋 đăng ký",     kw: "dang ky" },
  { label: "🇬🇧 tiếng Anh",  kw: "tieng anh" },
];

function log(...args) {
  console.log(...args);
}

// ---------------------------------------------------------------- Text & Helpers

function decodeEntities(s) {
  const str = String(s || "");
  if (!str.includes("&")) return str;
  return str.replace(ENTITY_RE, (m, dec, hex, named) => {
    if (dec) return String.fromCodePoint(+dec);
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    const v = HTML_ENTITIES[named] ?? HTML_ENTITIES[named.toLowerCase()];
    return v !== undefined ? v : m;
  });
}

function cleanText(raw) {
  const s = String(raw || "");
  const noTags = s.includes("<") ? s.replace(TAG_RE, " ") : s;
  return decodeEntities(noTags).replace(WS_RE, " ").trim();
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
    .replace(ACCENT_RE, "");
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

function normalizeTitleKey(title, preNorm = "") {
  let s = preNorm || stripAccents(title).toLowerCase();
  s = s.replace(TITLE_PREFIX_RE, "");
  return s.replace(NON_ALNUM_RE, " ").trim();
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

function vnTimeOnly() {
  const now = new Date(Date.now() + VN_OFFSET);
  return `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
}

const URGENT_KWS = [
  "huy hoc phan", "canh bao", "han cuoi", "khan", "bo sung",
  "vi pham", "vang thi", "kiem do", "tam ngung", "lua dao",
  "bat buoc", "thoi hoc",
];
const EXAM_KWS = [
  "lich thi", "phuc khao", "vang thi", "xoa diem", "diem i",
  "exam.hub", "quy che thi", "danh gia nang luc", "thi ket thuc",
  "khao thi", "bang diem",
];
const TUITION_KWS = [
  "hoc phi", "mien, giam", "mien giam", "cong no", "le phi",
  "ho tro chi phi", "tro cap xa hoi", "thu phi",
];
const SCHOLAR_KWS = [
  "hoc bong", "khen thuong", "sinh vien 5 tot", "tuyen duong",
  "cuoc thi", "giai thuong", "finhack",
];
const GRAD_KWS = [
  "tot nghiep", "thuc tap", "khoa luan", "do an", "phat bang",
  "in bang", "trao bang", "chuan dau ra", "van bang",
];
const REG_KWS = [
  "dang ky", "hoc phan", "huy hoc phan", "thoi khoa bieu",
  "ke hoach", "tin chi", "hoc ghep", "gia han", "canh bao hoc vu",
  "thoi hoc", "cam nang", "ren luyen",
];
const STUDENT_KWS = [
  "ngoai tru", "the sinh vien", "tham quan", "kien tap", "huy dong",
  "toa dam", "hoi thao", "tuyen dung", "viec lam", "doan", "tu van", "thu moi",
];

function hasAny(str, kws) {
  for (let i = 0; i < kws.length; i++) {
    if (str.includes(kws[i])) return true;
  }
  return false;
}

function isUrgentTitle(title, preNorm = "") {
  const s = preNorm || stripAccents(title).toLowerCase();
  return hasAny(s, URGENT_KWS);
}

function classifyItem(title, sourceKey = "", preNorm = "") {
  if (sourceKey === "ktdbcl") return { key: "exam", ...TOPICS.exam };
  if (sourceKey === "ketoan") return { key: "tuition", ...TOPICS.tuition };
  const s = preNorm || stripAccents(title).toLowerCase();
  if (hasAny(s, EXAM_KWS)) return { key: "exam", ...TOPICS.exam };
  if (hasAny(s, TUITION_KWS)) return { key: "tuition", ...TOPICS.tuition };
  if (hasAny(s, SCHOLAR_KWS)) return { key: "scholar", ...TOPICS.scholar };
  if (hasAny(s, GRAD_KWS)) return { key: "grad", ...TOPICS.grad };
  if (hasAny(s, REG_KWS)) return { key: "reg", ...TOPICS.reg };
  if (sourceKey === "scc" || hasAny(s, STUDENT_KWS)) return { key: "student", ...TOPICS.student };
  return { key: "general", ...TOPICS.general };
}

function extractDeadline(text) {
  if (!text) return "";
  const m = text.match(DEADLINE_RE);
  return m ? m[0].replace(WS_RE, " ").trim().slice(0, 95) : "";
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
      return clean.length > 30 ? clean.slice(0, 27) + "..." : clean;
    }
  } catch (_) {}
  return `Tài liệu #${idx + 1}`;
}

// ---------------------------------------------------------------- HTTP & Edge Cache

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIdx = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

async function fetchHTML(url, formData = null, cookie = "", timeoutMs = 6000, retries = 1) {
  const headers = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
  };
  if (cookie) headers["Cookie"] = cookie;
  const baseOpts = { headers };
  if (formData) {
    baseOpts.method = "POST";
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    baseOpts.body = new URLSearchParams(formData).toString();
  }

  let lastErr = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const targetUrl = (attempt > 1 && url === ONLINE_HOME && !formData) ? ONLINE_ALT : url;
      const res = await fetch(targetUrl, { ...baseOpts, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        try { if (res.body) await res.body.cancel(); } catch (_) {}
        throw new Error("HTTP " + res.status);
      }
      const sc = res.headers.get("set-cookie") || "";
      const sess = sc ? sc.split(";")[0].trim() : "";
      const text = await res.text();
      return { html: text, cookie: sess, url: res.url };
    } catch (e) {
      clearTimeout(timer);
      lastErr = e && e.name === "AbortError" ? new Error(`Timeout ${timeoutMs}ms`) : e;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 250 * attempt));
      }
    }
  }
  throw lastErr;
}

async function deleteEdgeCache(cacheKey) {
  try {
    if (typeof caches !== "undefined" && caches.default) {
      const fakeUrl = new Request("https://hub-cache.internal/" + encodeURIComponent(cacheKey));
      await caches.default.delete(fakeUrl);
    }
  } catch (_) {}
}

async function cachedJson(cacheKey, fetcher, bypassCache = false, ttlSec = CACHE_TTL_SEC) {
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
          "Cache-Control": `public, max-age=${ttlSec}`,
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

const ONL_LINK_RE = /^(\d+)"[^>]*>([\s\S]*?)<\/a>/;
const ONL_DATE_RE = /class="inputdate"[^>]*>(\d{1,2}\/\d{1,2}\/\d{4})</;
const DNN_NOTIF_DAY_RE = /<span class="day">(\d{1,2})<\/span>\s*<span class="month-year">(\d{1,2})\.(\d{4})<\/span>/;
const DNN_NEWS_DATE_RE = /<p class="news-date">(\d{1,2}\/\d{1,2}\/\d{4})<\/p>/;
const DNN_LINK_RE = /<h3 class="news-title">\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/;

function parseOnlineItems(html) {
  const firstIdx = html.indexOf('title="Messages.aspx?ID=');
  if (firstIdx < 0) return [];
  const lastIdx = html.lastIndexOf('title="Messages.aspx?ID=');
  const chunk = html.slice(firstIdx, Math.min(html.length, lastIdx + 1600));
  const parts = chunk.split('title="Messages.aspx?ID=');
  const items = [];
  const seen = new Set();
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    const lm = ONL_LINK_RE.exec(seg);
    if (!lm) continue;
    const dm = ONL_DATE_RE.exec(seg);
    if (!dm) continue;
    const id = lm[1];
    if (seen.has(id)) continue;
    const title = cleanText(lm[2]);
    const dt = parseDate(dm[1]);
    if (title && dt) {
      seen.add(id);
      items.push({
        id,
        source: "online",
        code: "onl",
        title,
        date: fmtDate(dt),
        ts: dt.getTime(),
        url: `https://online.hub.edu.vn/Messages.aspx?id=${id}`,
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
  let chunk = html;
  const start = html.indexOf('<div class="notification-list mt-8">');
  if (start >= 0) {
    const end = html.indexOf("</section>", start);
    chunk = end > start ? html.slice(start, end) : html.slice(start);
  }
  const parts = chunk.split('<div class="notification-item">');
  const items = [];
  const seen = new Set();
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    const dm = DNN_NOTIF_DAY_RE.exec(seg);
    if (!dm) continue;
    const lm = DNN_LINK_RE.exec(seg);
    if (!lm) continue;
    let href = decodeEntities(lm[1]).trim();
    if (href.startsWith("/")) href = src.base + href;
    const id = extractDnnId(href);
    if (seen.has(id)) continue;
    const title = cleanText(lm[2]);
    const dt = parseDate(`${dm[1].padStart(2, "0")}/${dm[2].padStart(2, "0")}/${dm[3]}`);
    if (title && dt) {
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
    const start = html.indexOf('<div class="news-list mt-8">');
    if (start >= 0) {
      const end = html.indexOf("</section>", start);
      chunk = end > start ? html.slice(start, end) : html.slice(start);
    }
  }
  const parts = chunk.split('<div class="news-item">');
  const items = [];
  const seen = new Set();
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    const dm = DNN_NEWS_DATE_RE.exec(seg);
    if (!dm) continue;
    const lm = DNN_LINK_RE.exec(seg);
    if (!lm) continue;
    let href = decodeEntities(lm[1]).trim();
    if (href.startsWith("/")) href = src.base + href;
    const id = extractDnnId(href);
    if (seen.has(id)) continue;
    const title = cleanText(lm[2]);
    const dt = parseDate(dm[1]);
    if (title && dt) {
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

async function putEdgeCache(cacheKey, data, ttlSec) {
  try {
    if (typeof caches !== "undefined" && caches.default) {
      const fakeUrl = new Request("https://hub-cache.internal/" + encodeURIComponent(cacheKey));
      await caches.default.put(
        fakeUrl,
        new Response(JSON.stringify(data), {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": `public, max-age=${ttlSec}`,
          },
        })
      );
    }
  } catch (_) {}
}

async function getEdgeCache(cacheKey) {
  try {
    if (typeof caches !== "undefined" && caches.default) {
      const fakeUrl = new Request("https://hub-cache.internal/" + encodeURIComponent(cacheKey));
      const hit = await caches.default.match(fakeUrl);
      if (hit) return await hit.json();
    }
  } catch (_) {}
  return null;
}

async function loadHubSnapshot(env) {
  if (!env || !env.SUBSCRIBERS_KV) return null;
  const edgeSnap = await getEdgeCache("kv_hub_snapshot_v1");
  if (edgeSnap && edgeSnap.bySource) return edgeSnap;
  try {
    const snap = await env.SUBSCRIBERS_KV.get("cache:hub_snapshot_v1", { type: "json" });
    if (snap && snap.bySource) {
      await putEdgeCache("kv_hub_snapshot_v1", snap, 45);
      return snap;
    }
    // Tương thích ngược với cache:online_lkg cũ nếu cron mới chưa chạy nhịp đầu
    const legacy = await env.SUBSCRIBERS_KV.get("cache:online_lkg", { type: "json" }).catch(() => null);
    if (legacy && Array.isArray(legacy.items) && legacy.items.length) {
      return { savedAt: legacy.savedAt || 0, fetchedAt: vnNowLabel(), bySource: { online: legacy.items }, health: [] };
    }
  } catch (_) {}
  return null;
}

async function isSnapshotWarm(env) {
  const snap = await loadHubSnapshot(env);
  if (!snap || !snap.savedAt) return false;
  const age = Date.now() - snap.savedAt;
  return age <= SNAPSHOT_SWR_MAX_AGE_MS && Object.keys(snap.bySource || {}).length >= 5;
}

function snapshotFingerprint(bySource) {
  return SOURCES.map((s) => {
    const arr = (bySource && bySource[s.key]) || [];
    return `${s.key}:${arr.slice(0, 5).map((x) => x.id).join(",")}`;
  }).join("|");
}

async function saveHubSnapshot(env, freshBySource, freshHealth, forceWrite = false) {
  if (!env || !env.SUBSCRIBERS_KV) return;
  try {
    const prev = await env.SUBSCRIBERS_KV.get("cache:hub_snapshot_v1", { type: "json" }).catch(() => null);
    const mergedBySource = {};
    const mergedHealth = [];
    const prevHealthMap = new Map(((prev && prev.health) || []).map((h) => [h.key, h]));

    for (const s of SOURCES) {
      const freshItems = (freshBySource && freshBySource[s.key]) || [];
      const freshH = (freshHealth || []).find((h) => h.key === s.key);
      if (freshItems.length > 0) {
        mergedBySource[s.key] = freshItems.slice(0, 22);
        mergedHealth.push(freshH || {
          key: s.key,
          ok: true,
          fallback: false,
          ms: 0,
          count: freshItems.length,
          latestDate: freshItems[0].date,
          error: "",
        });
      } else if (prev && prev.bySource && Array.isArray(prev.bySource[s.key]) && prev.bySource[s.key].length) {
        // Giữ nguyên dữ liệu LKG của từng cổng khi cổng đó tạm chậm/timeout
        mergedBySource[s.key] = prev.bySource[s.key];
        const ph = prevHealthMap.get(s.key);
        mergedHealth.push({
          key: s.key,
          ok: true,
          fallback: true,
          ms: freshH ? freshH.ms : 0,
          count: prev.bySource[s.key].length,
          latestDate: prev.bySource[s.key][0].date || (ph && ph.latestDate) || "—",
          error: "Bản đệm nhanh",
        });
      } else {
        mergedBySource[s.key] = [];
        mergedHealth.push(freshH || { key: s.key, ok: false, fallback: false, ms: 0, count: 0, latestDate: "—", error: "Chưa có dữ liệu" });
      }
    }

    const prevFp = prev ? snapshotFingerprint(prev.bySource) : "";
    const curFp = snapshotFingerprint(mergedBySource);
    const ageMs = prev && prev.savedAt ? Date.now() - prev.savedAt : 9e9;
    const snap = {
      savedAt: Date.now(),
      fetchedAt: vnNowLabel(),
      bySource: mergedBySource,
      health: mergedHealth,
    };

    await putEdgeCache("kv_hub_snapshot_v1", snap, 45);
    // Chỉ ghi KV khi có tin mới đổi ID, ép ghi, hoặc quá 10 phút (~144 lượt ghi/ngày, <15% hạn mức miễn phí)
    if (forceWrite || prevFp !== curFp || ageMs >= SNAPSHOT_WRITE_INTERVAL_MS) {
      await env.SUBSCRIBERS_KV.put("cache:hub_snapshot_v1", JSON.stringify(snap));
    }
  } catch (e) {
    log("saveHubSnapshot error", e);
  }
}

async function fetchSource(src, onlinePages = 1, env = null, cronMode = false) {
  const t0 = Date.now();
  const isOnline = src.key === "online";
  const timeoutMs = isOnline ? (cronMode ? 9000 : 4500) : (cronMode ? 6500 : 5000);
  const retries = isOnline ? 2 : (cronMode ? 2 : 1);
  try {
    const first = await fetchHTML(src.url, null, "", timeoutMs, retries);
    let items = [];
    if (src.type === "asp_grid") {
      items = parseOnlineItems(first.html);
      // Bỏ qua giải mã __VIEWSTATE 50KB khi chỉ cần 1 trang (tiết kiệm mạnh CPU Worker!)
      if (onlinePages > 1 && items.length) {
        let fields = getHiddenFields(first.html);
        for (let p = 2; p <= onlinePages; p++) {
          try {
            const next = await fetchHTML(
              ONLINE_HOME,
              Object.assign({}, fields, {
                __EVENTTARGET: ONLINE_GRID_TARGET,
                __EVENTARGUMENT: "Page$" + p,
              }),
              first.cookie,
              5000,
              1
            );
            fields = getHiddenFields(next.html);
            const pItems = parseOnlineItems(next.html);
            if (!pItems.length) break;
            items = items.concat(pItems);
          } catch (_) {
            break;
          }
        }
      }
    } else if (src.type === "dnn_notif") {
      items = parseDnnNotif(first.html, src);
    } else {
      items = parseDnnNews(first.html, src);
    }
    items.sort((a, b) => b.ts - a.ts);
    return { key: src.key, ok: true, ms: Date.now() - t0, items, fallback: false };
  } catch (e) {
    if (env) {
      const snap = await loadHubSnapshot(env);
      const lkg = snap && snap.bySource && snap.bySource[src.key];
      if (Array.isArray(lkg) && lkg.length) {
        return {
          key: src.key,
          ok: true,
          fallback: true,
          ms: Date.now() - t0,
          error: "Bản đệm nhanh",
          items: lkg,
        };
      }
    }
    return { key: src.key, ok: false, fallback: false, ms: Date.now() - t0, error: String(e.message || e), items: [] };
  }
}

async function refreshAllLive(onlinePages, env) {
  const resList = await runPool(SOURCES, FETCH_CONCURRENCY, (s) =>
    fetchSource(s, s.key === "online" ? onlinePages : 1, env, false)
  );
  const bySource = {};
  const health = [];
  for (const r of resList) {
    bySource[r.key] = r.items;
    health.push({
      key: r.key,
      ok: r.ok,
      fallback: Boolean(r.fallback),
      ms: r.ms,
      count: r.items.length,
      latestDate: r.items[0] ? r.items[0].date : "—",
      error: r.error || "",
    });
  }
  const result = { bySource, health, fetchedAt: vnNowLabel() };
  if (onlinePages === 1 && env) {
    const freshLive = {};
    for (const r of resList) {
      if (r.ok && !r.fallback && r.items.length) freshLive[r.key] = r.items;
    }
    if (Object.keys(freshLive).length > 0) {
      await saveHubSnapshot(env, freshLive, health, false);
    }
  }
  return result;
}

async function fetchAllSources(onlinePages = 1, bypassCache = false, env = null, ctx = null) {
  const key = `all_sources_v4_p${onlinePages}`;

  // 1) Tầng nhanh nhất: Edge Cache -> Unified 7-Portal KV Snapshot (<50ms cho toàn bộ lệnh!)
  if (!bypassCache) {
    const edgeHit = await getEdgeCache(key);
    if (edgeHit && edgeHit.bySource) return edgeHit;

    if (onlinePages === 1 && env) {
      const snap = await loadHubSnapshot(env);
      const age = snap && snap.savedAt ? Date.now() - snap.savedAt : 9e9;
      if (snap && age <= SNAPSHOT_SWR_MAX_AGE_MS && Object.keys(snap.bySource || {}).length >= 5) {
        if (age >= SNAPSHOT_BG_REFRESH_MS && ctx && typeof ctx.waitUntil === "function") {
          ctx.waitUntil(
            refreshAllLive(1, env)
              .then((fresh) => putEdgeCache(key, fresh, CACHE_TTL_SEC))
              .catch(() => {})
          );
        }
        return { bySource: snap.bySource, health: snap.health || [], fetchedAt: snap.fetchedAt || vnNowLabel() };
      }
    }
  }

  // 2) Tải trực tiếp với concurrency giới hạn 4 kết nối
  const data = await refreshAllLive(onlinePages, env);
  await putEdgeCache(key, data, CACHE_TTL_SEC);
  return data;
}

async function fetchSingleSourceCached(sourceKey, onlinePages = 1, bypassCache = false, env = null, ctx = null) {
  const src = SOURCE_BY_KEY[sourceKey];
  if (!src) return [];
  const key = `src_v4_${sourceKey}_p${onlinePages}`;
  const ttl = sourceKey === "online" ? ONLINE_CACHE_TTL_SEC : CACHE_TTL_SEC;

  if (onlinePages === 1 && !bypassCache) {
    const edgeHit = await getEdgeCache(key);
    if (edgeHit && edgeHit.length) return edgeHit;
    const snap = await loadHubSnapshot(env);
    const age = snap && snap.savedAt ? Date.now() - snap.savedAt : 9e9;
    const snapItems = snap && snap.bySource && snap.bySource[sourceKey];
    if (Array.isArray(snapItems) && snapItems.length && age <= SNAPSHOT_SWR_MAX_AGE_MS) {
      if (age >= SNAPSHOT_BG_REFRESH_MS && ctx && typeof ctx.waitUntil === "function") {
        ctx.waitUntil(
          fetchSource(src, 1, env, false)
            .then(async (r) => {
              if (r.ok && !r.fallback && r.items.length) {
                await putEdgeCache(key, r.items, ttl);
                await saveHubSnapshot(env, { [sourceKey]: r.items }, [{
                  key: sourceKey, ok: true, fallback: false, ms: r.ms,
                  count: r.items.length, latestDate: r.items[0].date, error: "",
                }], false);
              }
            })
            .catch(() => {})
        );
      }
      return snapItems;
    }
  }

  const r = await fetchSource(src, onlinePages, env, false);
  const sorted = r.items.sort((a, b) => b.ts - a.ts);
  if (sorted.length) {
    await putEdgeCache(key, sorted, ttl);
    if (onlinePages === 1 && !r.fallback && env) {
      await saveHubSnapshot(env, { [sourceKey]: sorted }, [{
        key: sourceKey, ok: true, fallback: false, ms: r.ms,
        count: sorted.length, latestDate: sorted[0].date, error: "",
      }], false);
    }
  }
  return sorted;
}

function mergeAndDedupe(bySource, days = null) {
  let cutoffTs = null;
  if (days !== null) {
    const c = vnToday();
    c.setUTCDate(c.getUTCDate() - days);
    cutoffTs = c.getTime();
  }
  const orderedKeys = [...SOURCES].sort((a, b) => a.priority - b.priority).map((s) => s.key);
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

async function fetchArticleDetailUncached(code, id) {
  const route = DETAIL_ROUTES[code];
  if (!route) throw new Error("Mã nguồn không hợp lệ");
  const src = SOURCE_BY_KEY[route.source];

  if (code === "onl") {
    const msgUrl = `https://online.hub.edu.vn/Messages.aspx?id=${id}`;
    const c1 = new AbortController();
    const t1 = setTimeout(() => c1.abort(), 6000);
    let r1;
    try {
      r1 = await fetch(msgUrl, {
        redirect: "manual",
        signal: c1.signal,
        headers: {
          "User-Agent": UA,
          "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
        },
      });
    } finally {
      clearTimeout(t1);
    }
    const sc = r1.headers.get("set-cookie") || "";
    const cookie = sc ? sc.split(";")[0].trim() : "";
    let dHtml = "";
    if (r1.status >= 300 && r1.status < 400) {
      try { if (r1.body) await r1.body.cancel(); } catch (_) {}
      const loc = r1.headers.get("location") || ONLINE_HOME;
      const nextUrl = loc.startsWith("http") ? loc : new URL(loc, ONLINE_HOME).href;
      const r2 = await fetchHTML(nextUrl, null, cookie, 6500, 1);
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
  const bodyText = decodeEntities(cleanedHtml.replace(/<[^>]+>/g, " "))
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
    extraLinks: [],
  };
}

async function fetchArticleDetail(code, id, bypassCache = false) {
  return await cachedJson(
    `detail_v3_${code}_${id}`,
    () => fetchArticleDetailUncached(code, id),
    bypassCache,
    DETAIL_CACHE_TTL_SEC
  );
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
      await deleteEdgeCache("subscribers_list_v1");
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
    await deleteEdgeCache("subscribers_list_v1");
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
    await deleteEdgeCache("subscribers_list_v1");
    return updated;
  } catch (e) {
    log("setUserSubscription error", e);
    return null;
  }
}

async function listAllSubscribers(env, bypassCache = false) {
  if (!env || !env.SUBSCRIBERS_KV) return [];
  return await cachedJson(
    "subscribers_list_v1",
    async () => {
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
    },
    bypassCache,
    SUBSCRIBERS_CACHE_TTL_SEC
  );
}

function formatBroadcastPayload(bodyText, urgent = false) {
  const header = urgent
    ? "🚨 <b>THÔNG BÁO KHẨN</b>"
    : "📣 <b>THÔNG BÁO TỪ QUẢN TRỊ VIÊN</b>";
  return [
    header,
    LINE,
    escapeHtml(bodyText),
    "",
    `<code>${vnNowLabel()}</code> · Admin ${AUTHOR_NAME}`,
  ].join("\n");
}

async function executeBroadcast(env, draft) {
  const users = await listAllSubscribers(env);
  const targets = users.filter((u) => u.subscribed !== false && !u.blocked);
  const formatted = formatBroadcastPayload(draft.text || "", Boolean(draft.urgent));
  const markup = {
    inline_keyboard: [[
      { text: "📌 Menu", callback_data: "m:home" },
      { text: "🔕 Tắt TB", callback_data: "user:notify_off" },
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
  const users = await listAllSubscribers(env, true);
  const active = users.filter((u) => u.subscribed !== false && !u.blocked).length;
  const muted = users.length - active;
  const lastScan = env.SUBSCRIBERS_KV
    ? await env.SUBSCRIBERS_KV.get("state:last_scan", { type: "json" }).catch(() => null)
    : null;
  const scanMs = lastScan && lastScan.ms ? ` · ${lastScan.ms}ms` : "";
  const scanLine = lastScan
    ? `⚡ Tự động 5p: ${lastScan.okCount}/${lastScan.totalSources} cổng (<code>${lastScan.at}</code>${scanMs})`
    : "⚡ Tự động 5p: Cloudflare Cron";

  const textLines = [
    `<b>Quản trị · ${BOT_BRAND}</b>`,
    LINE,
    `👤 ${AUTHOR_NAME} · <code>${escapeHtml(adminId)}</code>`,
    `👥 Người dùng: <b>${users.length}</b> (🔔 ${active} · 🔕 ${muted})`,
    scanLine,
  ];
  if (lastScan && Array.isArray(lastScan.failed) && lastScan.failed.length) {
    textLines.push(`⚠️ Chậm/Lỗi: <code>${escapeHtml(lastScan.failed.slice(0, 3).join(", "))}</code>`);
  }
  textLines.push("", "Lệnh nhanh: <code>/bc nội dung</code> · <code>/bc! gửi ngay</code>");
  const text = textLines.join("\n");

  const markup = {
    inline_keyboard: [
      [{ text: `📢 Phát thông báo (${active})`, callback_data: "adm:bc_ask" }],
      [
        { text: "🚨 Báo khẩn", callback_data: "adm:bc_urgent_ask" },
        { text: "🔄 Quét ngay", callback_data: "adm:scan_now" },
      ],
      [
        { text: `👥 Người dùng (${users.length})`, callback_data: "adm:users:1" },
        { text: "🧪 Test Admin", callback_data: "adm:test_self" },
      ],
      [
        { text: "🔄 Làm mới", callback_data: "adm:home" },
        { text: "⬅️ Menu", callback_data: "m:home" },
      ],
    ],
  };
  return { text, markup };
}

// ---------------------------------------------------------------- Real-time 5-Minute Auto-Scanner (Cloudflare Cron)

function buildAutoPushCard(item, extraSources = [], detail = null) {
  const norm = stripAccents(item.title).toLowerCase();
  const cat = classifyItem(item.title, item.source, norm);
  const urgent = isUrgentTitle(item.title, norm);
  const src = SOURCE_BY_KEY[item.source] || { emoji: "🏛️", name: item.source, short: item.source };
  const headIcon = urgent ? "🚨" : cat.icon;

  const badges = ["<b>TIN MỚI</b>", `<code>${cat.tag}</code>`];
  if (urgent) badges.push("<b>LƯU Ý</b>");

  const srcNames = [`${src.emoji} ${src.name}`];
  for (const es of (extraSources || [])) {
    const cfg = SOURCE_BY_KEY[es];
    if (cfg && es !== item.source) srcNames.push(`${cfg.emoji} ${cfg.short}`);
  }

  const lines = [
    `${headIcon} <b>${escapeHtml(item.title)}</b>`,
    badges.join(" · "),
    LINE,
    `Nguồn: ${escapeHtml(srcNames.join(" · "))}`,
    `Ngày: <code>${escapeHtml(item.date)}</code>`,
  ];

  const pdfs = (detail && detail.pdfs) || [];
  const downloads = (detail && detail.downloads) || [];
  const extraLinks = (detail && detail.extraLinks) || [];
  if (detail && detail.sender) lines.push(`Đơn vị: ${escapeHtml(detail.sender)}`);
  if (detail && detail.deadline) lines.push(`Hạn: <b>${escapeHtml(detail.deadline)}</b>`);

  const attParts = [];
  if (pdfs.length) attParts.push(`${pdfs.length} PDF`);
  if (downloads.length) attParts.push(`${downloads.length} tệp`);
  if (attParts.length) lines.push(`Đính kèm: ${attParts.join(" · ")}`);

  const bodyText = (detail && detail.bodyText) || "";
  if (bodyText.length > 30 && !bodyText.toLowerCase().startsWith("sinh viên xem") && !bodyText.toLowerCase().startsWith("sv xem chi tiết")) {
    const preview = bodyText.length > 170 ? bodyText.slice(0, 167) + "..." : bodyText;
    lines.push("", escapeHtml(preview));
  }

  const kb = [];
  const cbView = `v:${item.code}:${item.id}`;
  if (new TextEncoder().encode(cbView).length <= 64) {
    kb.push([{
      text: (pdfs.length || downloads.length) ? "📄 Xem chi tiết & PDF" : "📄 Đọc nhanh",
      callback_data: cbView,
    }]);
  }
  const row2 = [];
  if (pdfs.length) {
    row2.push({ text: "📥 Mở PDF", url: pdfs[0] });
  } else if (downloads.length) {
    row2.push({ text: "📦 Tải tệp", url: downloads[0] });
  } else if (extraLinks.length) {
    row2.push({ text: "🔗 Chi tiết", url: extraLinks[0].url });
  } else {
    row2.push({ text: `${src.emoji} ${src.short}`, callback_data: `src:${item.source}:1` });
  }
  row2.push({ text: "🌐 Mở web", url: item.url });
  kb.push(row2);

  kb.push([
    item.source === "online"
      ? { text: "🔥 Tất cả cổng", callback_data: "list:all:latest:1" }
      : { text: "🏛️ Online HUB", callback_data: "src:online:1" },
    { text: "📌 Menu", callback_data: "m:home" },
  ]);
  return { text: lines.join("\n"), markup: { inline_keyboard: kb } };
}

async function runAutoMonitorCron(env, forceRecordScan = false) {
  if (!env || !env.BOT_TOKEN || !env.SUBSCRIBERS_KV) {
    return { ok: false, reason: "Missing BOT_TOKEN or SUBSCRIBERS_KV" };
  }

  const t0 = Date.now();
  // Giới hạn tối đa 4 kết nối song song (tránh vượt ngưỡng 6 socket của Cloudflare Workers & tránh nghẽn WAF trường)
  const resList = await runPool(SOURCES, FETCH_CONCURRENCY, (s) => fetchSource(s, 1, null, true));

  const bySource = {};
  const health = [];
  const failed = [];
  let okCount = 0;
  let onlineOk = false;
  for (const r of resList) {
    bySource[r.key] = r.items;
    health.push({
      key: r.key,
      ok: r.ok,
      fallback: false,
      ms: r.ms,
      count: r.items.length,
      latestDate: r.items[0] ? r.items[0].date : "—",
      error: r.error || "",
    });
    if (r.ok && r.items.length > 0) {
      okCount += 1;
      if (r.key === "online") onlineOk = true;
    } else {
      failed.push(`${r.key}:${String(r.error || "empty").slice(0, 18)}`);
    }
  }

  if (okCount > 0) {
    await saveHubSnapshot(env, bySource, health, forceRecordScan);
  }

  const prevState = (await env.SUBSCRIBERS_KV.get("state:seen_v1", { type: "json" }).catch(() => null)) || {
    sources: {},
    seenTitles: {},
  };
  const sourcesState = prevState.sources || {};
  const seenTitles = prevState.seenTitles || {};
  const todayIso = new Date(Date.now() + VN_OFFSET).toISOString().slice(0, 10);

  // Dọn cổng đã gỡ bỏ và seenTitles quá 21 ngày
  let stateChanged = false;
  const activeKeys = new Set(SOURCES.map((s) => s.key));
  for (const sk of Object.keys(sourcesState)) {
    if (!activeKeys.has(sk)) {
      delete sourcesState[sk];
      stateChanged = true;
    }
  }
  const cutoffIso = new Date(Date.now() + VN_OFFSET - 21 * 86400 * 1000).toISOString().slice(0, 10);
  for (const fp of Object.keys(seenTitles)) {
    if (!seenTitles[fp] || String(seenTitles[fp].at || "") < cutoffIso) {
      delete seenTitles[fp];
      stateChanged = true;
    }
  }

  const orderedKeys = [...SOURCES].sort((a, b) => a.priority - b.priority).map((s) => s.key);
  const candidates = [];

  for (const skey of orderedKeys) {
    const items = bySource[skey] || [];
    if (!items.length) continue;
    const srcSeen = sourcesState[skey];
    if (!srcSeen || Object.keys(srcSeen).length === 0) {
      sourcesState[skey] = Object.fromEntries(items.map((it) => [it.id, it.date]));
      for (const it of items) {
        const fp = normalizeTitleKey(it.title);
        if (fp && !seenTitles[fp]) seenTitles[fp] = { source: skey, at: todayIso };
      }
      stateChanged = true;
      continue;
    }
    for (const it of items) {
      if (!srcSeen[it.id]) {
        candidates.push(it);
      }
    }
  }

  // Khử trùng chéo cổng (Online HUB #1 ưu tiên giữ làm tin chính)
  const batchByFp = new Map();
  const toNotify = [];
  for (const it of candidates) {
    const fp = normalizeTitleKey(it.title);
    if (fp && seenTitles[fp]) {
      sourcesState[it.source][it.id] = it.date;
      stateChanged = true;
      continue;
    }
    if (fp && batchByFp.has(fp)) {
      const primary = batchByFp.get(fp);
      primary.extraSources.push(it.source);
      primary.allRefs.push([it.source, it.id, it.date]);
      continue;
    }
    const entry = { item: it, fp, extraSources: [], allRefs: [[it.source, it.id, it.date]] };
    if (fp) batchByFp.set(fp, entry);
    toNotify.push(entry);
  }

  let pushedNotices = 0;
  let totalDelivered = 0;
  if (toNotify.length > 0) {
    const users = await listAllSubscribers(env);
    const adminIds = await getAdminIds(env);
    const targetSet = new Set(
      users.filter((u) => u.subscribed !== false && !u.blocked).map((u) => String(u.id))
    );
    adminIds.forEach((id) => targetSet.add(String(id)));
    const targets = Array.from(targetSet);

    for (const entry of toNotify.reverse().slice(0, 5)) {
      const it = entry.item;
      let detail = null;
      try {
        detail = await fetchArticleDetail(it.code, it.id, true);
      } catch (_) {}
      const card = buildAutoPushCard(it, entry.extraSources, detail);

      let sentThis = 0;
      for (let i = 0; i < targets.length; i += 20) {
        const chunk = targets.slice(i, i + 20);
        await Promise.all(
          chunk.map(async (cid) => {
            const r = await sendMsg(env, cid, card.text, card.markup);
            if (r && r.ok) {
              sentThis += 1;
            } else {
              const desc = String((r && r.description) || "").toLowerCase();
              if (desc.includes("blocked") || desc.includes("deactivated") || desc.includes("kicked")) {
                await setUserSubscription(env, cid, false, true);
              }
            }
          })
        );
      }
      if (sentThis > 0 || targets.length === 0) {
        for (const [sk, sid, sdate] of entry.allRefs) {
          sourcesState[sk][sid] = sdate;
        }
        if (entry.fp) seenTitles[entry.fp] = { source: it.source, at: todayIso };
        pushedNotices += 1;
        totalDelivered += sentThis;
        stateChanged = true;
      }
    }
  }

  if (stateChanged) {
    for (const sk of Object.keys(sourcesState)) {
      const entries = Object.entries(sourcesState[sk]);
      if (entries.length > 120) {
        entries.sort((a, b) => {
          const da = parseDate(a[1]);
          const db = parseDate(b[1]);
          return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
        });
        sourcesState[sk] = Object.fromEntries(entries.slice(0, 120));
      }
    }
    await env.SUBSCRIBERS_KV.put("state:seen_v1", JSON.stringify({ sources: sourcesState, seenTitles }));
  }

  const scanMs = Date.now() - t0;
  const prevScan = await env.SUBSCRIBERS_KV.get("state:last_scan", { type: "json" }).catch(() => null);
  const scanAgeMs = prevScan && prevScan.ts ? Date.now() - prevScan.ts : 9e9;
  const healthChanged = !prevScan || prevScan.okCount !== okCount || prevScan.onlineOk !== onlineOk;
  if (forceRecordScan || pushedNotices > 0 || healthChanged || scanAgeMs > 30 * 60 * 1000) {
    await env.SUBSCRIBERS_KV.put(
      "state:last_scan",
      JSON.stringify({
        ts: Date.now(),
        at: vnNowLabel(),
        ms: scanMs,
        okCount,
        totalSources: SOURCES.length,
        onlineOk,
        pushedNotices,
        failed: failed.slice(0, 4),
      })
    );
  }

  return { ok: true, ms: scanMs, okCount, totalSources: SOURCES.length, onlineOk, pushedNotices, totalDelivered, failed };
}

async function adminUsersView(env, page = 1) {
  const users = await listAllSubscribers(env);
  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(users.length / perPage));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const slice = users.slice((safePage - 1) * perPage, safePage * perPage);

  const lines = [
    "<b>Người dùng Bot</b>",
    `Trang ${safePage}/${totalPages} · ${users.length} tài khoản`,
    LINE,
  ];

  if (!slice.length) {
    lines.push("\nChưa có người dùng.");
  } else {
    slice.forEach((u, idx) => {
      const n = (safePage - 1) * perPage + idx + 1;
      const st = u.blocked ? "🚫" : (u.subscribed === false ? "🔕" : "🔔");
      const uname = u.username ? ` @${escapeHtml(u.username)}` : "";
      const joined = u.joinedAt ? String(u.joinedAt).slice(0, 10) : "—";
      lines.push(`<b>${n}.</b> ${st} <b>${escapeHtml(u.name)}</b>${uname}`);
      lines.push(`   <code>${escapeHtml(u.id)}</code> · ${joined}`);
    });
  }

  const kb = [];
  if (totalPages > 1) {
    const nav = [];
    if (safePage > 1) nav.push({ text: "‹ Trước", callback_data: `adm:users:${safePage - 1}` });
    nav.push({ text: `${safePage}/${totalPages}`, callback_data: "noop" });
    if (safePage < totalPages) nav.push({ text: "Sau ›", callback_data: `adm:users:${safePage + 1}` });
    kb.push(nav);
  }
  kb.push([
    { text: "🔄 Làm mới", callback_data: `adm:users:${safePage}` },
    { text: "⬅️ Admin", callback_data: "adm:home" },
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
    "<b>Thông báo tự động</b>",
    LINE,
    `Trạng thái: ${sub ? "🟢 <b>Đang bật</b>" : "🔕 <b>Đang tắt</b>"}`,
  ].join("\n");

  const markup = {
    inline_keyboard: [
      [
        sub
          ? { text: "🔕 Tắt thông báo", callback_data: "user:notify_off" }
          : { text: "🔔 Bật thông báo", callback_data: "user:notify_on" },
      ],
      [{ text: "⬅️ Menu", callback_data: "m:home" }],
    ],
  };
  return { text, markup };
}

async function clearChatHistory(env, chatId, upToMsgId, count = 100) {
  const safeCount = Math.min(Math.max(10, count || 100), 300);
  const startId = Math.max(1, upToMsgId - safeCount + 1);
  // Telegram deleteMessages bắt buộc message_ids tăng dần nghiêm ngặt
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
    if (r && r.ok) anyOk = true;
  }
  if (!anyOk) {
    const fallbackStart = Math.max(1, upToMsgId - 29);
    const jobs = [];
    for (let id = upToMsgId; id >= fallbackStart; id--) {
      jobs.push(tgApi(env, "deleteMessage", { chat_id: chatId, message_id: id }));
    }
    await Promise.all(jobs);
  }
}

// ---------------------------------------------------------------- Minimalist Views & Keyboards

function mainMenuView() {
  const text = [
    `<b>${BOT_BRAND}</b>`,
    LINE,
    `🟢 Trực tuyến · <code>${vnNowLabel()}</code>`,
    `Tác giả: <a href="${AUTHOR_FB_URL}">${AUTHOR_NAME}</a>`,
  ].join("\n");

  const markup = {
    inline_keyboard: [
      [{ text: "🔥 Tất cả cổng · Mới nhất", callback_data: "list:all:latest:1" }],
      [
        { text: "🏛️ Online HUB (#1)", callback_data: "src:online:1" },
        { text: "🏢 Các Cổng HUB", callback_data: "m:portals" },
      ],
      [
        { text: "📅 7 ngày", callback_data: "list:all:7:1" },
        { text: "🗓️ 30 ngày", callback_data: "list:all:30:1" },
      ],
      [
        { text: "🏷️ Chủ đề", callback_data: "m:topics" },
        { text: "🔎 Tìm kiếm", callback_data: "m:search" },
      ],
      [
        { text: "📰 Tổng hợp", callback_data: "digest:7" },
        { text: "🔗 Tiện ích", callback_data: "m:links" },
      ],
      [
        { text: "📊 Trạng thái", callback_data: "status" },
        { text: "👤 Tác giả", callback_data: "m:author" },
      ],
      [
        { text: "❓ Trợ giúp", callback_data: "m:help" },
        { text: "🧹 Dọn chat", callback_data: "clear:ask" },
      ],
    ],
  };
  return { text, markup };
}

function authorView() {
  const text = [
    "<b>Tác giả</b>",
    LINE,
    `👤 <b>${AUTHOR_NAME}</b>`,
    `🤖 ${BOT_BRAND} · Tự động cập nhật thông báo HUB 24/7`,
  ].join("\n");

  const markup = {
    inline_keyboard: [
      [{ text: `📘 Facebook · ${AUTHOR_NAME}`, url: AUTHOR_FB_URL }],
      [{ text: "⬅️ Menu", callback_data: "m:home" }],
    ],
  };
  return { text, markup };
}

function portalsMenuView() {
  const text = [
    "<b>Cổng thông tin HUB</b>",
    LINE,
    "7 nguồn chính thức · Tự động cập nhật 5 phút/lần",
  ].join("\n");

  const markup = {
    inline_keyboard: [
      [{ text: "🔥 Tất cả cổng HUB · Mới nhất", callback_data: "list:all:latest:1" }],
      [{ text: "🏛️ Online HUB · Ưu tiên #1", callback_data: "src:online:1" }],
      [
        { text: "📝 Khảo thí & ĐBCL", callback_data: "src:ktdbcl:1" },
        { text: "🎓 Phòng Đào tạo", callback_data: "src:daotao:1" },
      ],
      [
        { text: "📰 Đào tạo · Tin tức", callback_data: "src:daotao_news:1" },
        { text: "🤝 Trung tâm SV", callback_data: "src:scc:1" },
      ],
      [
        { text: "🏫 Cổng Chính HUB", callback_data: "src:hub:1" },
        { text: "💰 Tài chính - KT", callback_data: "src:ketoan:1" },
      ],
      [{ text: "⬅️ Menu", callback_data: "m:home" }],
    ],
  };
  return { text, markup };
}

function topicsMenuView() {
  const text = [
    "<b>Chủ đề thông báo</b>",
    LINE,
    "Chọn nhóm nội dung cần lọc",
  ].join("\n");

  const markup = {
    inline_keyboard: [
      [
        { text: "🚨 Khẩn & Lưu ý", callback_data: "tp:urgent:1" },
        { text: "📝 Lịch thi", callback_data: "tp:exam:1" },
      ],
      [
        { text: "💰 Học phí", callback_data: "tp:tuition:1" },
        { text: "🏆 Học bổng", callback_data: "tp:scholar:1" },
      ],
      [
        { text: "🎓 Tốt nghiệp", callback_data: "tp:grad:1" },
        { text: "📋 Đào tạo", callback_data: "tp:reg:1" },
      ],
      [
        { text: "🤝 Sinh viên", callback_data: "tp:student:1" },
        { text: "⬅️ Menu", callback_data: "m:home" },
      ],
    ],
  };
  return { text, markup };
}

function searchMenuView() {
  const text = [
    "<b>Tìm kiếm nhanh</b>",
    LINE,
    "Hỗ trợ không dấu · Nhắn trực tiếp từ khoá vào chat",
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
  rows.push([
    { text: "⌨️ Nhập từ khoá", callback_data: "m:search_ask" },
    { text: "⬅️ Menu", callback_data: "m:home" },
  ]);
  return { text, markup: { inline_keyboard: rows } };
}

function quickLinksView() {
  const text = [
    "<b>Tiện ích sinh viên HUB</b>",
    LINE,
    "Truy cập nhanh hệ thống học tập &amp; đào tạo",
  ].join("\n");

  const markup = {
    inline_keyboard: [
      [
        { text: "🏛️ Online HUB", url: "https://online.hub.edu.vn/" },
        { text: "📚 LMS HUB", url: "https://lms.hub.edu.vn/" },
      ],
      [
        { text: "📝 Đăng ký tín chỉ", url: "https://dangkytinchi.hub.edu.vn/" },
        { text: "🎓 eStudent", url: "https://estudent.hub.edu.vn/" },
      ],
      [
        { text: "📝 Phòng Khảo thí", url: "https://phongktdbcl.hub.edu.vn/thong-bao" },
        { text: "🎓 Phòng Đào tạo", url: "https://phongdaotao.hub.edu.vn/" },
      ],
      [
        { text: "🤝 Trung tâm SV", url: "https://scc.hub.edu.vn/thong-bao" },
        { text: "💰 Tài chính - KT", url: "https://phongketoan.hub.edu.vn/thong-bao" },
      ],
      [
        { text: "📖 Thư viện HUB", url: "https://library.hub.edu.vn/" },
        { text: "📜 Tra cứu văn bằng", url: "https://hub.edu.vn/tra-cuu-van-bang" },
      ],
      [{ text: "⬅️ Menu", callback_data: "m:home" }],
    ],
  };
  return { text, markup };
}

function helpView() {
  const text = [
    "<b>Hướng dẫn nhanh</b>",
    LINE,
    "• Tự động gửi tin mới từ 7 cổng HUB mỗi 5 phút",
    "• Nhắn trực tiếp từ khoá không dấu để tìm kiếm",
    "• Bấm số <b>1–5</b> dưới danh sách để đọc nhanh &amp; tải PDF",
    "",
    "<b>Lệnh nhanh</b>",
    "<code>/latest</code> · Tin mới toàn HUB",
    "<code>/online</code> · Online HUB (Portal)",
    "<code>/full7d</code> · <code>/full30d</code> · Theo thời gian",
    "<code>/thi</code> · <code>/daotao</code> · <code>/scc</code> · <code>/hocphi</code> · <code>/hocbong</code>",
    "<code>/digest</code> · <code>/status</code> · <code>/notify</code> · <code>/clear</code>",
  ].join("\n");

  const markup = {
    inline_keyboard: [
      [
        { text: "🔥 Tất cả cổng", callback_data: "list:all:latest:1" },
        { text: "⬅️ Menu", callback_data: "m:home" },
      ],
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
    `Trang ${safePage}/${totalPages} · ${total} tin · <code>${vnTimeOnly()}</code>`,
    LINE,
  ];

  if (!slice.length) {
    lines.push("\nChưa có thông báo phù hợp.");
  } else {
    slice.forEach((it, idx) => {
      const num = start + idx + 1;
      const src = SOURCE_BY_KEY[it.source] || { emoji: "📌", short: it.source };
      const norm = stripAccents(it.title).toLowerCase();
      const cat = classifyItem(it.title, it.source, norm);
      const icon = isUrgentTitle(it.title, norm) ? "🚨" : cat.icon;
      const shortTitle = it.title.length > 100 ? it.title.slice(0, 97) + "..." : it.title;
      const also = it.alsoIn && it.alsoIn.length ? ` · +${it.alsoIn.length}` : "";

      lines.push("");
      lines.push(`<b>${num}.</b> ${icon} <a href="${escapeHtml(it.url)}">${escapeHtml(shortTitle)}</a>`);
      lines.push(`   ${escapeHtml(src.short)} · <code>${escapeHtml(it.date)}</code>${also}`);
    });
  }

  const keyboard = [];

  if (slice.length) {
    const numRow = slice.map((it, idx) => {
      let cb = `v:${it.code}:${it.id}:${currentCb}`;
      if (new TextEncoder().encode(cb).length > 64) {
        cb = `v:${it.code}:${it.id}`;
      }
      return { text: `📄 ${start + idx + 1}`, callback_data: cb };
    });
    keyboard.push(numRow);
  }

  if (totalPages > 1) {
    const nav = [];
    if (safePage > 1) {
      nav.push({ text: "‹ Trước", callback_data: `${baseCbPrefix}:${safePage - 1}` });
    }
    nav.push({ text: `${safePage}/${totalPages}`, callback_data: "noop" });
    if (safePage < totalPages) {
      nav.push({ text: "Sau ›", callback_data: `${baseCbPrefix}:${safePage + 1}` });
    }
    keyboard.push(nav);
  }

  const actionRow = [];
  if (extra.webUrl) {
    actionRow.push({ text: "🌐 Web", url: extra.webUrl });
  }
  const refreshCb = `rf:${baseCbPrefix}:${safePage}`;
  if (new TextEncoder().encode(refreshCb).length <= 64) {
    actionRow.push({ text: "🔄 Mới", callback_data: refreshCb });
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
  const norm = stripAccents(detail.title).toLowerCase();
  const cat = classifyItem(detail.title, detail.source, norm);
  const urgent = isUrgentTitle(detail.title, norm);
  const icon = urgent ? "🚨" : cat.icon;

  const lines = [
    `${icon} <b>${escapeHtml(detail.title)}</b>`,
    `<code>${cat.tag}</code>${urgent ? " · <b>LƯU Ý</b>" : ""}`,
    LINE,
    `Nguồn: ${detail.sourceEmoji} ${escapeHtml(detail.sourceName)}`,
    `Ngày: <code>${escapeHtml(detail.date)}</code>`,
  ];

  if (detail.sender) lines.push(`Đơn vị: ${escapeHtml(detail.sender)}`);
  if (detail.deadline) lines.push(`Hạn: <b>${escapeHtml(detail.deadline)}</b>`);

  const totalAtt = detail.pdfs.length + detail.downloads.length;
  if (totalAtt > 0) lines.push(`Đính kèm: ${totalAtt} tệp`);

  if (detail.bodyText && detail.bodyText.length > 20) {
    const trimmed = detail.bodyText.length > 1400 ? detail.bodyText.slice(0, 1397) + "..." : detail.bodyText;
    lines.push("", escapeHtml(trimmed));
  } else if (totalAtt > 0) {
    lines.push("", "Nội dung đính kèm trong tệp bên dưới.");
  }

  const keyboard = [];
  detail.pdfs.slice(0, 5).forEach((pdfUrl, idx) => {
    const label = detail.pdfs.length === 1
      ? `📥 PDF · ${prettyFileName(pdfUrl, idx)}`
      : `📥 PDF ${idx + 1} · ${prettyFileName(pdfUrl, idx)}`;
    keyboard.push([{ text: label, url: pdfUrl }]);
  });

  detail.downloads.slice(0, 3).forEach((dlUrl, idx) => {
    keyboard.push([{ text: `📦 Tải tệp #${idx + 1}`, url: dlUrl }]);
  });

  (detail.extraLinks || []).slice(0, 3).forEach((lk, idx) => {
    const lbl = lk.label && !/^tại đây$/i.test(lk.label) ? lk.label : `Liên kết #${idx + 1}`;
    keyboard.push([{ text: `🔗 ${lbl}`, url: lk.url }]);
  });

  keyboard.push([
    { text: "🌐 Bài gốc", url: detail.webUrl },
    { text: `${detail.sourceEmoji} Xem cổng`, callback_data: `src:${detail.source}:1` },
  ]);

  const backRow = [];
  if (backCb && backCb !== "m:home") {
    backRow.push({ text: "⬅️ Quay lại", callback_data: backCb });
  }
  backRow.push({ text: "📌 Menu", callback_data: "m:home" });
  keyboard.push(backRow);

  return { text: lines.join("\n"), markup: { inline_keyboard: keyboard } };
}

function buildDigestView(allItems, days) {
  const buckets = {
    exam: [],
    tuition: [],
    scholar: [],
    grad: [],
    reg: [],
    student: [],
    general: [],
  };

  for (const it of allItems) {
    const cat = classifyItem(it.title, it.source);
    (buckets[cat.key] || buckets.general).push(it);
  }

  const lines = [
    `<b>Tổng hợp ${days} ngày</b>`,
    `<code>${vnNowLabel()}</code> · ${allItems.length} thông báo`,
    LINE,
  ];

  if (!allItems.length) {
    lines.push("\nChưa có thông báo mới.");
  } else {
    const sections = [
      { key: "exam",    head: "📝 <b>Lịch thi &amp; Khảo thí</b>" },
      { key: "tuition", head: "💰 <b>Học phí &amp; Tài chính</b>" },
      { key: "scholar", head: "🏆 <b>Học bổng</b>" },
      { key: "grad",    head: "🎓 <b>Tốt nghiệp &amp; Thực tập</b>" },
      { key: "reg",     head: "📋 <b>Đào tạo &amp; Học phần</b>" },
      { key: "student", head: "🤝 <b>Sinh viên</b>" },
    ];

    for (const sec of sections) {
      const list = buckets[sec.key];
      if (!list.length) continue;
      lines.push("", `${sec.head} (${list.length})`);
      list.slice(0, 3).forEach((it) => {
        const shortT = it.title.length > 76 ? it.title.slice(0, 73) + "..." : it.title;
        lines.push(`• <code>${it.date.slice(0, 5)}</code> <a href="${escapeHtml(it.url)}">${escapeHtml(shortT)}</a>`);
      });
    }
  }

  const markup = {
    inline_keyboard: [
      [
        { text: days === 7 ? "● 7 ngày" : "7 ngày", callback_data: "digest:7" },
        { text: days === 30 ? "● 30 ngày" : "30 ngày", callback_data: "digest:30" },
      ],
      [
        { text: "📋 Xem tất cả", callback_data: `list:all:${days}:1` },
        { text: "⬅️ Menu", callback_data: "m:home" },
      ],
    ],
  };
  return { text: lines.join("\n"), markup };
}

function buildStatusView(data) {
  const okCount = data.health.filter((h) => h.ok).length;
  const totalItems = data.health.reduce((s, h) => s + h.count, 0);
  const lines = [
    "<b>Trạng thái hệ thống</b>",
    `<code>${data.fetchedAt}</code> · ${okCount}/${data.health.length} cổng · ${totalItems} tin`,
    LINE,
  ];

  for (const h of data.health) {
    const src = SOURCE_BY_KEY[h.key];
    if (!src) continue;
    const dot = h.ok ? (h.fallback ? "🟡" : "🟢") : "🔴";
    const info = h.ok
      ? (h.fallback ? `${h.count} tin · đệm nhanh` : `${h.count} tin · <code>${h.latestDate}</code> · ${h.ms}ms`)
      : escapeHtml(h.error.slice(0, 32));
    lines.push(`${dot} <b>${escapeHtml(src.short)}</b> · ${info}`);
  }

  const markup = {
    inline_keyboard: [
      [
        { text: "🔄 Kiểm tra lại", callback_data: "rf:status" },
        { text: "🔥 Tất cả cổng", callback_data: "list:all:latest:1" },
      ],
      [{ text: "⬅️ Menu", callback_data: "m:home" }],
    ],
  };
  return { text: lines.join("\n"), markup };
}

// ---------------------------------------------------------------- Action Router

async function renderRoute(routeStr, bypassCache = false, env = null, ctx = null) {
  if (routeStr.startsWith("rf:")) {
    return await renderRoute(routeStr.slice(3), true, env, ctx);
  }

  if (routeStr === "m:home") return mainMenuView();
  if (routeStr === "m:portals") return portalsMenuView();
  if (routeStr === "m:topics") return topicsMenuView();
  if (routeStr === "m:search") return searchMenuView();
  if (routeStr === "m:links") return quickLinksView();
  if (routeStr === "m:author") return authorView();
  if (routeStr === "m:help") return helpView();

  if (routeStr === "status") {
    const data = await fetchAllSources(1, true, env, ctx);
    return buildStatusView(data);
  }

  if (routeStr.startsWith("digest:")) {
    const days = parseInt(routeStr.split(":")[1], 10) || 7;
    const data = await fetchAllSources(days >= 30 ? 3 : 1, bypassCache, env, ctx);
    const merged = mergeAndDedupe(data.bySource, days);
    return buildDigestView(merged, days);
  }

  if (routeStr.startsWith("list:all:")) {
    const parts = routeStr.split(":");
    const mode = parts[2];
    const page = parseInt(parts[3], 10) || 1;
    const onlinePages = mode === "30" ? 3 : 1;
    const data = await fetchAllSources(onlinePages, bypassCache, env, ctx);
    const days = mode === "latest" ? null : parseInt(mode, 10);
    let items = mergeAndDedupe(data.bySource, days);
    if (mode === "latest") items = items.slice(0, 30);
    const header =
      mode === "latest"
        ? "🔥 Tin mới nhất · HUB"
        : `📅 Thông báo ${days} ngày`;
    return buildPaginatedListView(header, items, page, `list:all:${mode}`);
  }

  if (routeStr.startsWith("src:")) {
    const parts = routeStr.split(":");
    const skey = parts[1];
    const page = parseInt(parts[2], 10) || 1;
    const src = SOURCE_BY_KEY[skey];
    if (!src) return mainMenuView();

    // Tối ưu tốc độ Online HUB: trang 1–2 chỉ tải 1 trang (10 tin, nhanh gấp 3–5 lần), trang 3+ mới mở rộng
    const onlinePagesNeeded = skey === "online" ? (page <= 2 ? 1 : 3) : 1;
    const items = await fetchSingleSourceCached(skey, onlinePagesNeeded, bypassCache, env, ctx);
    const siblingMap = {
      online: { cb: "src:online:3", label: "📚 Tải thêm tin cũ hơn (30 tin)" },
      daotao: { cb: "src:daotao_news:1", label: "📰 Đào tạo · Tin & Thực tập" },
      daotao_news: { cb: "src:daotao:1", label: "🎓 Phòng Đào tạo · Thông báo" },
    };
    const sibling = (skey === "online" && page >= 3) ? null : siblingMap[skey];
    return buildPaginatedListView(`${src.emoji} ${src.name}`, items, page, `src:${skey}`, {
      webUrl: src.url,
      siblingCb: sibling ? sibling.cb : "",
      siblingLabel: sibling ? sibling.label : "",
      backCb: "m:portals",
      backLabel: "⬅️ Chọn cổng khác",
    });
  }

  if (routeStr.startsWith("tp:")) {
    const parts = routeStr.split(":");
    const tpKey = parts[1];
    const page = parseInt(parts[2], 10) || 1;
    const tp = TOPICS[tpKey] || TOPICS.general;
    const data = await fetchAllSources(1, bypassCache, env, ctx);
    const all = mergeAndDedupe(data.bySource, null);
    const filtered = tpKey === "urgent"
      ? all.filter((it) => isUrgentTitle(it.title))
      : all.filter((it) => classifyItem(it.title, it.source).key === tpKey);
    return buildPaginatedListView(`${tp.icon} ${tp.label}`, filtered.slice(0, 40), page, `tp:${tpKey}`, {
      backCb: "m:topics",
      backLabel: "⬅️ Chủ đề khác",
    });
  }

  if (routeStr.startsWith("q:")) {
    const lastColon = routeStr.lastIndexOf(":");
    const kw = routeStr.slice(2, lastColon);
    const page = parseInt(routeStr.slice(lastColon + 1), 10) || 1;
    const data = await fetchAllSources(2, bypassCache, env, ctx);
    const all = mergeAndDedupe(data.bySource, null);
    const kwNorm = stripAccents(kw).toLowerCase().trim();
    const found = all.filter((it) => stripAccents(it.title).toLowerCase().includes(kwNorm));
    return buildPaginatedListView(`🔎 "${kw}"`, found.slice(0, 40), page, `q:${kw}`, {
      backCb: "m:search",
      backLabel: "⬅️ Tìm từ khoá khác",
    });
  }

  if (routeStr.startsWith("v:")) {
    const parts = routeStr.split(":");
    const code = parts[1];
    const id = parts[2];
    const backCb = parts.length > 3 ? parts.slice(3).join(":") : "m:home";
    const detail = await fetchArticleDetail(code, id, bypassCache);
    return buildDetailView(detail, backCb);
  }

  return mainMenuView();
}

// ---------------------------------------------------------------- Update Processors

async function handleMessage(msg, env, ctx = null) {
  const chatId = msg.chat && msg.chat.id;
  const fromId = (msg.from && msg.from.id) || chatId;
  const text = (msg.text || msg.caption || "").trim();
  const photoFileId = msg.photo && msg.photo.length ? msg.photo[msg.photo.length - 1].file_id : "";
  if (!chatId || (!text && !photoFileId)) return;

  const isPrivate = msg.chat.type === "private";
  const isCommand = text.startsWith("/");
  const cmd = isCommand ? text.split(/\s+/)[0].split("@")[0].toLowerCase() : "";
  const arg = isCommand ? text.slice(text.split(/\s+/)[0].length).trim() : text;

  await trackSubscriber(env, msg.chat, msg.from, cmd === "/start");

  // 1) Admin ForceReply broadcast draft
  const replyText = (msg.reply_to_message && msg.reply_to_message.text) || "";
  const isReplyBroadcast = replyText.includes("Soạn thông báo phát sóng");
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
        [{ text: `✅ Gửi ngay (${activeCount} người)`, callback_data: "adm:bc_send" }],
        [
          { text: "🧪 Thử riêng", callback_data: "adm:bc_preview" },
          { text: "❌ Huỷ", callback_data: "adm:bc_cancel" },
        ],
      ],
    };
    if (photoFileId) {
      await sendPhotoMsg(env, chatId, photoFileId, preview, confirmKb);
    } else {
      await sendMsg(env, chatId, `<b>Xem trước (${activeCount} người nhận)</b>\n\n` + preview, confirmKb);
    }
    return;
  }

  const isReplyToSearch = Boolean(replyText && replyText.includes("Nhập từ khoá"));
  if (!isCommand && !isPrivate && !isReplyToSearch) return;

  // 2) Admin commands
  if (cmd === "/admin") {
    if (arg && !(await isAdminUser(env, fromId))) {
      const claim = await claimAdminWithPin(env, fromId, arg);
      if (claim.ok) {
        const v = await adminHomeView(env, fromId);
        await sendMsg(env, chatId, "✅ <b>Đã xác thực Admin.</b>\n\n" + v.text, v.markup);
        return;
      }
      await sendMsg(env, chatId, "⛔ Mã xác thực không hợp lệ.");
      return;
    }
    if (!(await isAdminUser(env, fromId))) {
      await sendMsg(env, chatId, "⛔ Không có quyền truy cập.");
      return;
    }
    const v = await adminHomeView(env, fromId);
    await sendMsg(env, chatId, v.text, v.markup);
    return;
  }

  if (cmd === "/broadcast" || cmd === "/bc" || cmd === "/tb" || cmd === "/bc!") {
    if (!(await isAdminUser(env, fromId))) {
      await sendMsg(env, chatId, "⛔ Chỉ Admin có quyền phát thông báo.");
      return;
    }
    if (!arg && !photoFileId) {
      await sendMsg(
        env,
        chatId,
        "<b>Phát thông báo</b>\n" + LINE + "\n" +
        "• <code>/bc nội dung</code> — Xem trước rồi gửi\n" +
        "• <code>/bc! nội dung</code> — Gửi trực tiếp ngay\n" +
        "• Gửi ảnh kèm chú thích <code>/bc ...</code>"
      );
      return;
    }
    const draft = { text: arg, photoFileId, urgent: false, createdAt: Date.now() };
    if (cmd === "/bc!") {
      const waitMsg = await sendMsg(env, chatId, "⏳ Đang gửi thông báo...");
      const stat = await executeBroadcast(env, draft);
      const report = [
        "✅ <b>Đã phát sóng</b>",
        LINE,
        `Thành công: <b>${stat.sent}/${stat.total}</b> · Chặn: ${stat.blocked} · Lỗi: ${stat.failed}`,
        `<code>${vnNowLabel()}</code>`,
      ].join("\n");
      const mid = waitMsg && waitMsg.result && waitMsg.result.message_id;
      if (mid) {
        await editMsg(env, chatId, mid, report, { inline_keyboard: [[{ text: "⬅️ Admin", callback_data: "adm:home" }]] });
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
        [{ text: `✅ Gửi ngay (${activeCount} người)`, callback_data: "adm:bc_send" }],
        [
          { text: "🧪 Thử riêng", callback_data: "adm:bc_preview" },
          { text: "❌ Huỷ", callback_data: "adm:bc_cancel" },
        ],
      ],
    };
    if (photoFileId) {
      await sendPhotoMsg(env, chatId, photoFileId, preview, confirmKb);
    } else {
      await sendMsg(env, chatId, `<b>Xem trước (${activeCount} người nhận)</b>\n\n` + preview, confirmKb);
    }
    return;
  }

  if (cmd === "/testpush") {
    if (!(await isAdminUser(env, fromId))) {
      await sendMsg(env, chatId, "⛔ Chỉ dành cho Admin.");
      return;
    }
    const preview = formatBroadcastPayload(`Kiểm tra thông báo tức thì từ ${BOT_BRAND}.`, false);
    await sendMsg(env, chatId, preview, { inline_keyboard: [[{ text: "⬅️ Admin", callback_data: "adm:home" }]] });
    return;
  }

  // 3) User settings & static views
  if (cmd === "/notify") {
    const v = await userNotifyView(env, chatId);
    await sendMsg(env, chatId, v.text, v.markup);
    return;
  }
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
      "🧹 <b>Đã dọn lịch sử gần đây.</b>\n(Telegram giới hạn xoá tin trong 48 giờ)",
      {
        inline_keyboard: [[
          { text: "📌 Menu", callback_data: "m:home" },
          { text: "🗑️ Ẩn", callback_data: "del:self" },
        ]],
      }
    );
    return;
  }

  // 4) Live routes
  let route = null;
  let loadingText = "⏳ Đang tải...";

  if (cmd === "/online") {
    route = "src:online:1";
    loadingText = "🏛️ Đang tải Online HUB...";
  } else if (cmd === "/latest") {
    route = "list:all:latest:1";
    loadingText = "⚡ Đang tải tin mới nhất...";
  } else if (cmd === "/update") {
    route = "rf:list:all:latest:1";
    loadingText = "⚡ Đang cập nhật trực tiếp 7 cổng HUB...";
  } else if (cmd === "/full7d") {
    route = "list:all:7:1";
    loadingText = "📅 Đang tải tin 7 ngày...";
  } else if (cmd === "/full30d") {
    route = "list:all:30:1";
    loadingText = "🗓️ Đang tải tin 30 ngày...";
  } else if (cmd === "/thi") {
    route = "tp:exam:1";
    loadingText = "📝 Đang tải Lịch thi...";
  } else if (cmd === "/daotao") {
    route = "src:daotao:1";
    loadingText = "🎓 Đang tải Phòng Đào tạo...";
  } else if (cmd === "/scc") {
    route = "src:scc:1";
    loadingText = "🤝 Đang tải Trung tâm SV...";
  } else if (cmd === "/hocphi") {
    route = "tp:tuition:1";
    loadingText = "💰 Đang tải Học phí...";
  } else if (cmd === "/hocbong") {
    route = "tp:scholar:1";
    loadingText = "🏆 Đang tải Học bổng...";
  } else if (cmd === "/digest") {
    route = "digest:7";
    loadingText = "📰 Đang tổng hợp...";
  } else if (cmd === "/status") {
    route = "rf:status";
    loadingText = "📊 Đang kiểm tra 7 cổng HUB...";
  } else if (cmd === "/find" || !isCommand) {
    const kw = arg.trim();
    if (!kw) {
      const v = searchMenuView();
      await sendMsg(env, chatId, v.text, v.markup);
      return;
    }
    const safeKw = truncateUtf8(kw.replace(/:/g, " "), 36).trim();
    route = `q:${safeKw}:1`;
    loadingText = `🔎 Đang tìm "<b>${escapeHtml(safeKw)}</b>"...`;
  } else {
    const v = mainMenuView();
    await sendMsg(env, chatId, v.text, v.markup);
    return;
  }

  // Tuyến đọc nhanh qua Snapshot/Edge Cache gửi thẳng trong 1 lệnh Telegram (không nhấp nháy loading)
  const needsLoading = route.startsWith("rf:") || route === "list:all:30:1" || !(await isSnapshotWarm(env));
  let msgId = null;
  if (needsLoading) {
    const sent = await sendMsg(env, chatId, loadingText);
    msgId = sent && sent.result && sent.result.message_id;
  }

  try {
    const view = await renderRoute(route, false, env, ctx);
    if (msgId) {
      await editMsg(env, chatId, msgId, view.text, view.markup);
    } else {
      await sendMsg(env, chatId, view.text, view.markup);
    }
  } catch (e) {
    log("handleMessage route error", route, e);
    const errText = `⚠️ Không thể kết nối HUB: <code>${escapeHtml(e.message || e)}</code>`;
    const fallbackKb = { inline_keyboard: [[{ text: "📌 Menu", callback_data: "m:home" }]] };
    if (msgId) {
      await editMsg(env, chatId, msgId, errText, fallbackKb);
    } else {
      await sendMsg(env, chatId, errText, fallbackKb);
    }
  }
}

async function handleCallback(cb, env, ctx = null) {
  const data = cb.data || "";
  const msg = cb.message;
  const chatId = msg && msg.chat && msg.chat.id;
  const fromId = (cb.from && cb.from.id) || chatId;
  const messageId = msg && msg.message_id;

  if (msg && msg.chat) {
    await trackSubscriber(env, msg.chat, cb.from, false);
  }

  if (data === "noop") {
    await answerCb(env, cb.id);
    return;
  }

  if (data === "user:notify_on" || data === "user:notify_off") {
    const enable = data === "user:notify_on";
    await setUserSubscription(env, chatId, enable, false);
    await answerCb(env, cb.id, enable ? "Đã bật thông báo" : "Đã tắt thông báo");
    if (chatId && messageId) {
      const v = await userNotifyView(env, chatId);
      await editMsg(env, chatId, messageId, v.text, v.markup);
    }
    return;
  }

  // Admin callbacks
  if (data.startsWith("adm:")) {
    if (!(await isAdminUser(env, fromId))) {
      await answerCb(env, cb.id, "⛔ Chỉ dành cho Admin", true);
      return;
    }
    if (data === "adm:home") {
      await answerCb(env, cb.id);
      const v = await adminHomeView(env, fromId);
      await editMsg(env, chatId, messageId, v.text, v.markup);
      return;
    }
    if (data.startsWith("adm:users:")) {
      const page = parseInt(data.split(":")[2], 10) || 1;
      await answerCb(env, cb.id);
      const v = await adminUsersView(env, page);
      await editMsg(env, chatId, messageId, v.text, v.markup);
      return;
    }
    if (data === "adm:bc_ask" || data === "adm:bc_urgent_ask") {
      const isUrgent = data === "adm:bc_urgent_ask";
      await answerCb(env, cb.id);
      await sendMsg(
        env,
        chatId,
        (isUrgent ? "🚨 <b>Soạn thông báo phát sóng KHẨN</b>\n" : "📢 <b>Soạn thông báo phát sóng</b>\n") +
        "Trả lời tin này bằng văn bản hoặc ảnh kèm chú thích.",
        { force_reply: true, input_field_placeholder: "Nhập nội dung thông báo..." }
      );
      return;
    }
    if (data === "adm:bc_preview") {
      const draft = env.SUBSCRIBERS_KV ? await env.SUBSCRIBERS_KV.get(`draft:${fromId}`, { type: "json" }) : null;
      if (!draft) {
        await answerCb(env, cb.id, "Bản nháp đã hết hạn.", true);
        return;
      }
      await answerCb(env, cb.id, "Đang gửi thử...");
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
      await answerCb(env, cb.id, "Đã huỷ");
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
        await answerCb(env, cb.id, "Bản nháp đã hết hạn.", true);
        return;
      }
      await answerCb(env, cb.id, "Đang phát sóng...");
      if (env.SUBSCRIBERS_KV) await env.SUBSCRIBERS_KV.delete(`draft:${fromId}`);
      let statusMid = messageId;
      if (msg && msg.photo) {
        const sentWait = await sendMsg(env, chatId, "⏳ Đang gửi thông báo...");
        statusMid = sentWait && sentWait.result && sentWait.result.message_id;
      } else {
        await editMsg(env, chatId, messageId, "⏳ Đang gửi thông báo...");
      }
      const stat = await executeBroadcast(env, draft);
      const report = [
        "✅ <b>Đã phát sóng</b>",
        LINE,
        `Thành công: <b>${stat.sent}/${stat.total}</b> · Chặn: ${stat.blocked} · Lỗi: ${stat.failed}`,
        `<code>${vnNowLabel()}</code>`,
      ].join("\n");
      const doneKb = { inline_keyboard: [[{ text: "⬅️ Admin", callback_data: "adm:home" }]] };
      if (statusMid) {
        await editMsg(env, chatId, statusMid, report, doneKb);
      } else {
        await sendMsg(env, chatId, report, doneKb);
      }
      return;
    }
    if (data === "adm:test_self") {
      await answerCb(env, cb.id, "Đang gửi thử...");
      const preview = formatBroadcastPayload(`Kiểm tra thông báo tức thì từ ${BOT_BRAND}.`, false);
      await sendMsg(env, chatId, preview);
      return;
    }
    if (data === "adm:scan_now") {
      await answerCb(env, cb.id, "Đang quét 7 cổng HUB...");
      await editMsg(env, chatId, messageId, "⏳ Đang quét 7 cổng HUB (ưu tiên Online HUB #1)...");
      const res = await runAutoMonitorCron(env, true);
      const reportLines = [
        "✅ <b>Quét hoàn tất</b>",
        LINE,
        `Online HUB (#1): ${res.onlineOk ? "🟢 Trực tuyến" : "🟡 Tạm chậm"}`,
        `Phản hồi: <b>${res.okCount}/${res.totalSources}</b> cổng · <code>${res.ms || 0}ms</code>`,
        `Tin mới đẩy: <b>${res.pushedNotices}</b> (${res.totalDelivered} lượt gửi)`,
      ];
      if (res.failed && res.failed.length) {
        reportLines.push(`⚠️ Chậm/Lỗi: <code>${escapeHtml(res.failed.slice(0, 3).join(", "))}</code>`);
      }
      reportLines.push(`<code>${vnNowLabel()}</code>`);
      await editMsg(env, chatId, messageId, reportLines.join("\n"), {
        inline_keyboard: [[{ text: "⬅️ Admin", callback_data: "adm:home" }]],
      });
      return;
    }
    return;
  }

  if (data === "del:self") {
    await answerCb(env, cb.id);
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
        "<b>Dọn lịch sử chat</b>\n" + LINE + "\nChọn số tin gần nhất muốn xoá (trong 48 giờ):",
        {
          inline_keyboard: [
            [
              { text: "🧹 100 tin", callback_data: "clear:run:100" },
              { text: "🔥 300 tin", callback_data: "clear:run:300" },
            ],
            [{ text: "⬅️ Menu", callback_data: "m:home" }],
          ],
        }
      );
    }
    return;
  }

  if (data.startsWith("clear:run:")) {
    const count = parseInt(data.split(":")[2], 10) || 100;
    await answerCb(env, cb.id, "Đang dọn...");
    if (chatId && messageId) {
      await clearChatHistory(env, chatId, messageId, count);
      await sendMsg(
        env,
        chatId,
        "🧹 <b>Đã dọn lịch sử gần đây.</b>\n(Telegram giới hạn xoá tin trong 48 giờ)",
        {
          inline_keyboard: [[
            { text: "📌 Menu", callback_data: "m:home" },
            { text: "🗑️ Ẩn", callback_data: "del:self" },
          ]],
        }
      );
    }
    return;
  }

  if (data === "m:search_ask") {
    await answerCb(env, cb.id);
    if (chatId) {
      await sendMsg(
        env,
        chatId,
        "🔎 <b>Nhập từ khoá cần tìm</b> (không cần dấu):",
        { force_reply: true, input_field_placeholder: "VD: hoc bong, lich thi, hoc phi..." }
      );
    }
    return;
  }

  const toast =
    data.startsWith("v:") ? "Đang mở bài viết..."
    : data.startsWith("rf:") ? "Đang cập nhật..."
    : data === "status" ? "Đang kiểm tra 7 cổng..."
    : data.startsWith("m:") ? ""
    : "Đang tải...";
  await answerCb(env, cb.id, toast);

  if (!chatId || !messageId) return;

  try {
    const view = await renderRoute(data, false, env, ctx);
    await editMsg(env, chatId, messageId, view.text, view.markup);
  } catch (e) {
    log("handleCallback error", data, e);
    const errText = `⚠️ Không thể tải: <code>${escapeHtml(e.message || e)}</code>`;
    await editMsg(env, chatId, messageId, errText, {
      inline_keyboard: [
        [
          { text: "🔄 Thử lại", callback_data: data },
          { text: "📌 Menu", callback_data: "m:home" },
        ],
      ],
    });
  }
}

async function handleInlineQuery(iq, env, ctx = null) {
  const q = (iq.query || "").trim();
  try {
    const data = await fetchAllSources(1, false, env, ctx);
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
        LINE,
        `Nguồn: ${src.emoji} ${escapeHtml(src.name)}`,
        `Ngày: <code>${escapeHtml(it.date)}</code> · <code>${cat.tag}</code>`,
      ].join("\n");
      return {
        type: "article",
        id: `${it.code}_${it.id}`.slice(0, 60),
        title: `${cat.icon} ${it.title.slice(0, 90)}`,
        description: `${src.short} · ${it.date}`,
        input_message_content: {
          message_text: cardText,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        },
        reply_markup: {
          inline_keyboard: [[{ text: "🌐 Mở bài viết", url: it.url }]],
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

async function processUpdate(update, env, ctx = null) {
  if (update.callback_query) {
    await handleCallback(update.callback_query, env, ctx);
  } else if (update.message) {
    await handleMessage(update.message, env, ctx);
  } else if (update.inline_query) {
    await handleInlineQuery(update.inline_query, env, ctx);
  }
}

// ---------------------------------------------------------------- Auto-Setup Endpoint

async function handleSetup(request, env) {
  const url = new URL(request.url);
  if (env.SETUP_SECRET && url.searchParams.get("key") !== env.SETUP_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!env.BOT_TOKEN) {
    return new Response("Missing BOT_TOKEN", { status: 500 });
  }
  const webhookUrl = `${url.origin}/webhook`;
  const [rHook, rCmds, rMenu, rName] = await Promise.all([
    tgApi(env, "setWebhook", {
      url: webhookUrl,
      allowed_updates: ["message", "callback_query", "inline_query"],
      drop_pending_updates: false,
    }),
    tgApi(env, "setMyCommands", { commands: BOT_COMMANDS }),
    tgApi(env, "setChatMenuButton", { menu_button: { type: "commands" } }),
    tgApi(env, "setMyName", { name: BOT_BRAND }),
  ]);

  return new Response(
    JSON.stringify(
      {
        status: rHook.ok && rCmds.ok && rMenu.ok ? "ALL_OK" : "PARTIAL_ERROR",
        bot_name: BOT_BRAND,
        webhook_url: webhookUrl,
        setWebhook: rHook,
        setMyCommands: rCmds,
        setChatMenuButton: rMenu,
        setMyName: rName,
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
        ctx.waitUntil(processUpdate(update, env, ctx));
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
        `${BOT_BRAND} — Running (7 HUB portals, Online HUB #1, 5m Cron)\n` +
        "Open /setup to sync Webhook, Commands, Bot Name & Menu Button.",
        { headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }
    return new Response("Not found", { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      runAutoMonitorCron(env, false).catch((e) => log("scheduled cron error", e))
    );
  },
};

export {
  SOURCES,
  BOT_COMMANDS,
  parseOnlineItems,
  parseDnnNotif,
  parseDnnNews,
  fetchAllSources,
  mergeAndDedupe,
  fetchArticleDetail,
  classifyItem,
  runAutoMonitorCron,
  mainMenuView,
  portalsMenuView,
  topicsMenuView,
  searchMenuView,
  quickLinksView,
  authorView,
  helpView,
  buildAutoPushCard,
  buildPaginatedListView,
  buildDetailView,
  buildDigestView,
  buildStatusView,
  formatBroadcastPayload,
};
