/**
 * HUB News (Zalo Bot) — Cloudflare Workers Zalo Bot Platform Webhook & 5-Minute Auto-Push
 * Hỗ trợ chat 1-1 & thêm vào Nhóm chat Zalo (bot.zapps.me / bot-api.zaloplatforms.com).
 * Dùng chung snapshot 7 cổng HUB từ SUBSCRIBERS_KV (cache:hub_snapshot_v1).
 */

const BOT_BRAND = "HUB News";
const AUTHOR_NAME = "Huynh Viet";
const AUTHOR_FB_URL = "https://www.facebook.com/profile.php?id=61591547874181";
const ZALO_API_BASE = "https://bot-api.zaloplatforms.com";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const VN_OFFSET = 7 * 3600 * 1000;
const LINE = "────────────";
const ZALO_MAX_LEN = 1880;
const LIST_LIMIT = 8;
const DETAIL_CACHE_TTL_SEC = 600;
const SNAPSHOT_MAX_AGE_MS = 15 * 60 * 1000;
const FETCH_CONCURRENCY = 4;

const ONLINE_HOME = "https://online.hub.edu.vn/";
const ONLINE_ALT = "https://online.hub.edu.vn/Default.aspx";

const SOURCES = [
  { key: "online",      code: "onl", name: "Online HUB",              short: "Online HUB",     emoji: "🏛️", type: "asp_grid",     url: ONLINE_HOME,                                base: "https://online.hub.edu.vn",      section: "",                priority: 1 },
  { key: "ktdbcl",      code: "kt",  name: "Phòng Khảo thí & ĐBCL",   short: "Khảo thí & ĐBCL", emoji: "📝", type: "dnn_notif",    url: "https://phongktdbcl.hub.edu.vn/thong-bao", base: "https://phongktdbcl.hub.edu.vn", section: "thong-bao",       priority: 2 },
  { key: "daotao",      code: "dt",  name: "Phòng Đào tạo",           short: "Phòng Đào tạo",  emoji: "🎓", type: "dnn_notif",    url: "https://phongdaotao.hub.edu.vn/thong-bao", base: "https://phongdaotao.hub.edu.vn", section: "thong-bao",       priority: 3 },
  { key: "daotao_news", code: "dtn", name: "Đào tạo · Tin & Thực tập", short: "Đào tạo (Tin)", emoji: "📰", type: "dnn_pdt_home", url: "https://phongdaotao.hub.edu.vn/",          base: "https://phongdaotao.hub.edu.vn", section: "tin-tuc-su-kien", priority: 4 },
  { key: "scc",         code: "scc", name: "Trung tâm SV (SCC)",      short: "Trung tâm SV",   emoji: "🤝", type: "dnn_news",     url: "https://scc.hub.edu.vn/thong-bao",         base: "https://scc.hub.edu.vn",         section: "thong-bao",       priority: 5 },
  { key: "hub",         code: "hub", name: "Cổng Chính HUB",          short: "Cổng Chính HUB", emoji: "🏫", type: "dnn_notif",    url: "https://hub.edu.vn/thong-bao",             base: "https://hub.edu.vn",             section: "thong-bao",       priority: 6 },
  { key: "ketoan",      code: "ktc", name: "Tài chính - Kế toán",     short: "Tài chính - KT", emoji: "💰", type: "dnn_notif",    url: "https://phongketoan.hub.edu.vn/thong-bao", base: "https://phongketoan.hub.edu.vn", section: "thong-bao",       priority: 7 },
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
  scholar: { icon: "🏆", label: "Học bổng",             tag: "#HocBong" },
  grad:    { icon: "🎓", label: "Tốt nghiệp & Thực tập", tag: "#TotNghiep" },
  reg:     { icon: "📋", label: "Đào tạo & Học phần",   tag: "#DaoTao" },
  student: { icon: "🤝", label: "Sinh viên & Sự kiện",  tag: "#SinhVien" },
  urgent:  { icon: "🚨", label: "Khẩn & Lưu ý",         tag: "#KhanCap" },
  general: { icon: "📌", label: "Thông báo HUB",        tag: "#ThongBaoHUB" },
};

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

const ONL_LINK_RE = /^(\d+)"[^>]*>([\s\S]*?)<\/a>/;
const ONL_DATE_RE = /class="inputdate"[^>]*>(\d{1,2}\/\d{1,2}\/\d{4})</;
const DNN_NOTIF_DAY_RE = /<span class="day">(\d{1,2})<\/span>\s*<span class="month-year">(\d{1,2})\.(\d{4})<\/span>/;
const DNN_NEWS_DATE_RE = /<p class="news-date">(\d{1,2}\/\d{1,2}\/\d{4})<\/p>/;
const DNN_LINK_RE = /<h3 class="news-title">\s*<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/;

const URGENT_KWS = ["huy hoc phan", "canh bao", "han cuoi", "khan", "bo sung", "vi pham", "vang thi", "kiem do", "tam ngung", "lua dao", "bat buoc", "thoi hoc"];
const EXAM_KWS = ["lich thi", "phuc khao", "vang thi", "xoa diem", "diem i", "exam.hub", "quy che thi", "danh gia nang luc", "thi ket thuc", "khao thi", "bang diem"];
const TUITION_KWS = ["hoc phi", "mien, giam", "mien giam", "cong no", "le phi", "ho tro chi phi", "tro cap xa hoi", "thu phi"];
const SCHOLAR_KWS = ["hoc bong", "khen thuong", "sinh vien 5 tot", "tuyen duong", "cuoc thi", "giai thuong", "finhack"];
const GRAD_KWS = ["tot nghiep", "thuc tap", "khoa luan", "do an", "phat bang", "in bang", "trao bang", "chuan dau ra", "van bang"];
const REG_KWS = ["dang ky", "hoc phan", "huy hoc phan", "thoi khoa bieu", "ke hoach", "tin chi", "hoc ghep", "gia han", "canh bao hoc vu", "thoi hoc", "cam nang", "ren luyen"];
const STUDENT_KWS = ["ngoai tru", "the sinh vien", "tham quan", "kien tap", "huy dong", "toa dam", "hoi thao", "tuyen dung", "viec lam", "doan", "tu van", "thu moi"];

function log(...args) {
  console.log("[ZALO]", ...args);
}

// ---------------------------------------------------------------- Text & Time Helpers

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
  return decodeEntities(s.includes("<") ? s.replace(TAG_RE, " ") : s).replace(WS_RE, " ").trim();
}

function escapeHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function stripAccents(s) {
  return String(s || "").replace(/đ/g, "d").replace(/Đ/g, "D").normalize("NFD").replace(ACCENT_RE, "");
}

function normalizeTitleKey(title, preNorm = "") {
  return (preNorm || stripAccents(title).toLowerCase()).replace(TITLE_PREFIX_RE, "").replace(NON_ALNUM_RE, " ").trim();
}

function parseDate(s) {
  const m = String(s || "").trim().match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(d) {
  return String(d.getUTCDate()).padStart(2, "0") + "/" + String(d.getUTCMonth() + 1).padStart(2, "0") + "/" + d.getUTCFullYear();
}

function vnToday() {
  const now = new Date(Date.now() + VN_OFFSET);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function vnNowLabel() {
  const now = new Date(Date.now() + VN_OFFSET);
  return `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")} · ${fmtDate(now)}`;
}

function hasAny(str, kws) {
  for (let i = 0; i < kws.length; i++) if (str.includes(kws[i])) return true;
  return false;
}

function isUrgentTitle(title, preNorm = "") {
  return hasAny(preNorm || stripAccents(title).toLowerCase(), URGENT_KWS);
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

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------- HTTP, Pool & Cache

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

async function fetchHTML(url, timeoutMs = 6000, retries = 1, cookie = "") {
  const headers = {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
  };
  if (cookie) headers["Cookie"] = cookie;
  let lastErr = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const targetUrl = attempt > 1 && url === ONLINE_HOME ? ONLINE_ALT : url;
      const res = await fetch(targetUrl, { headers, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) {
        try { if (res.body) await res.body.cancel(); } catch (_) {}
        throw new Error("HTTP " + res.status);
      }
      const text = await res.text();
      return { html: text, url: res.url };
    } catch (e) {
      clearTimeout(timer);
      lastErr = e && e.name === "AbortError" ? new Error(`Timeout ${timeoutMs}ms`) : e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 250 * attempt));
    }
  }
  throw lastErr;
}

async function getEdgeCache(key) {
  try {
    if (typeof caches !== "undefined" && caches.default) {
      const hit = await caches.default.match(new Request("https://zalo-cache.internal/" + encodeURIComponent(key)));
      if (hit) return await hit.json();
    }
  } catch (_) {}
  return null;
}

async function putEdgeCache(key, data, ttlSec) {
  try {
    if (typeof caches !== "undefined" && caches.default) {
      await caches.default.put(
        new Request("https://zalo-cache.internal/" + encodeURIComponent(key)),
        new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${ttlSec}` },
        })
      );
    }
  } catch (_) {}
}

// ---------------------------------------------------------------- Fast 7-Portal Parsers & Shared Snapshot

function extractDnnId(href) {
  const m = String(href || "").match(/-(\d+)\.html/);
  return m ? m[1] : String(Math.abs(href.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0)));
}

function parseOnlineItems(html) {
  const firstIdx = html.indexOf('title="Messages.aspx?ID=');
  if (firstIdx < 0) return [];
  const lastIdx = html.lastIndexOf('title="Messages.aspx?ID=');
  const parts = html.slice(firstIdx, Math.min(html.length, lastIdx + 1600)).split('title="Messages.aspx?ID=');
  const items = [];
  const seen = new Set();
  for (let i = 1; i < parts.length; i++) {
    const lm = ONL_LINK_RE.exec(parts[i]);
    if (!lm) continue;
    const dm = ONL_DATE_RE.exec(parts[i]);
    if (!dm) continue;
    const id = lm[1];
    if (seen.has(id)) continue;
    const title = cleanText(lm[2]);
    const dt = parseDate(dm[1]);
    if (title && dt) {
      seen.add(id);
      items.push({ id, source: "online", code: "onl", title, date: fmtDate(dt), ts: dt.getTime(), url: `https://online.hub.edu.vn/Messages.aspx?id=${id}` });
    }
  }
  return items;
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
    const dm = DNN_NOTIF_DAY_RE.exec(parts[i]);
    const lm = dm ? DNN_LINK_RE.exec(parts[i]) : null;
    if (!lm) continue;
    let href = decodeEntities(lm[1]).trim();
    if (href.startsWith("/")) href = src.base + href;
    const id = extractDnnId(href);
    if (seen.has(id)) continue;
    const title = cleanText(lm[2]);
    const dt = parseDate(`${dm[1].padStart(2, "0")}/${dm[2].padStart(2, "0")}/${dm[3]}`);
    if (title && dt) {
      seen.add(id);
      items.push({ id, source: src.key, code: src.code, title, date: fmtDate(dt), ts: dt.getTime(), url: href });
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
    const dm = DNN_NEWS_DATE_RE.exec(parts[i]);
    const lm = dm ? DNN_LINK_RE.exec(parts[i]) : null;
    if (!lm) continue;
    let href = decodeEntities(lm[1]).trim();
    if (href.startsWith("/")) href = src.base + href;
    const id = extractDnnId(href);
    if (seen.has(id)) continue;
    const title = cleanText(lm[2]);
    const dt = parseDate(dm[1]);
    if (title && dt) {
      seen.add(id);
      const code = src.key === "daotao_news" && href.includes("/xet-tot-nghiep/") ? "dtt" : src.code;
      items.push({ id, source: src.key, code, title, date: fmtDate(dt), ts: dt.getTime(), url: href });
    }
  }
  return items;
}

async function fetchSourceLive(src) {
  const t0 = Date.now();
  const isOnline = src.key === "online";
  try {
    const { html } = await fetchHTML(src.url, isOnline ? 7500 : 5500, isOnline ? 2 : 1);
    const items = src.type === "asp_grid" ? parseOnlineItems(html) : (src.type === "dnn_notif" ? parseDnnNotif(html, src) : parseDnnNews(html, src));
    items.sort((a, b) => b.ts - a.ts);
    return { key: src.key, ok: true, fallback: false, ms: Date.now() - t0, items, latestDate: items[0] ? items[0].date : "—", error: "" };
  } catch (e) {
    return { key: src.key, ok: false, fallback: false, ms: Date.now() - t0, items: [], latestDate: "—", error: String(e.message || e) };
  }
}

async function getHubData(env, forceLive = false) {
  if (!forceLive) {
    const edge = await getEdgeCache("shared_hub_snap");
    if (edge && edge.bySource) return edge;
    if (env && env.SUBSCRIBERS_KV) {
      const snap = await env.SUBSCRIBERS_KV.get("cache:hub_snapshot_v1", { type: "json" }).catch(() => null);
      if (snap && snap.bySource && snap.savedAt && (Date.now() - snap.savedAt) <= SNAPSHOT_MAX_AGE_MS && Object.keys(snap.bySource).length >= 5) {
        await putEdgeCache("shared_hub_snap", snap, 45);
        return snap;
      }
    }
  }

  // Fallback tải trực tiếp 7 cổng (giới hạn 4 kết nối song song)
  const list = await runPool(SOURCES, FETCH_CONCURRENCY, fetchSourceLive);
  const bySource = {};
  const health = [];
  for (const r of list) {
    bySource[r.key] = r.items;
    health.push({ key: r.key, ok: r.ok, fallback: false, ms: r.ms, count: r.items.length, latestDate: r.latestDate, error: r.error });
  }
  const data = { savedAt: Date.now(), fetchedAt: vnNowLabel(), bySource, health };
  await putEdgeCache("shared_hub_snap", data, 45);
  return data;
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
          if (it.ts > ex.ts) { ex.ts = it.ts; ex.date = it.date; }
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
    return (SOURCE_BY_KEY[a.source]?.priority ?? 99) - (SOURCE_BY_KEY[b.source]?.priority ?? 99);
  });
  return out;
}

async function fetchArticleDetail(code, id, bypassCache = false) {
  const ckey = `zdetail_${code}_${id}`;
  if (!bypassCache) {
    const hit = await getEdgeCache(ckey);
    if (hit) return hit;
  }
  const route = DETAIL_ROUTES[code];
  if (!route) throw new Error("Mã nguồn không hợp lệ");
  const src = SOURCE_BY_KEY[route.source];
  let detail;

  if (code === "onl") {
    const msgUrl = `https://online.hub.edu.vn/Messages.aspx?id=${id}`;
    const c1 = new AbortController();
    const t1 = setTimeout(() => c1.abort(), 6500);
    let r1;
    try {
      r1 = await fetch(msgUrl, {
        redirect: "manual",
        signal: c1.signal,
        headers: { "User-Agent": UA, "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8", "Accept-Encoding": "gzip, deflate, br" },
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
      dHtml = (await fetchHTML(nextUrl, 6500, 1, cookie)).html;
    } else {
      dHtml = await r1.text();
    }
    const mSub = dHtml.match(/id="[^"]*lblMessageSubject"[^>]*>([\s\S]*?)<\/span>/i);
    const mDate = dHtml.match(/id="[^"]*lblDate"[^>]*>([\s\S]*?)<\/span>/i);
    const mSender = dHtml.match(/id="[^"]*lblSenderName"[^>]*>([\s\S]*?)<\/span>/i);
    const mBody = dHtml.match(/id="[^"]*lblMessageBody"[^>]*>([\s\S]*?)<\/span>/i);
    const bodyHtml = mBody ? mBody[1] : "";
    const pdfs = [];
    const extraLinks = [];
    const linkRe = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let lm;
    while ((lm = linkRe.exec(bodyHtml)) !== null) {
      let href = decodeEntities(lm[1]).trim();
      if (!href || href.startsWith("javascript:") || href.startsWith("#")) continue;
      if (href.startsWith("/")) href = "https://online.hub.edu.vn" + href;
      if (/\.(?:pdf|docx?|xlsx?|zip|rar)(?:\?|$)/i.test(href)) {
        if (!pdfs.includes(href)) pdfs.push(href);
      } else if (/^https?:\/\//i.test(href) && !extraLinks.includes(href)) {
        extraLinks.push(href);
      }
    }
    const title = mSub ? cleanText(mSub[1]) : `Thông báo #${id}`;
    const bodyText = cleanText(bodyHtml);
    detail = {
      source: "online", sourceName: src.name, sourceEmoji: src.emoji,
      title, date: mDate ? cleanText(mDate[1]) : "—", sender: mSender ? cleanText(mSender[1]) : "",
      url: msgUrl, bodyText, deadline: extractDeadline(title + " " + bodyText), pdfs, downloads: [], extraLinks,
    };
  } else {
    const shortUrl = `${route.base}/${route.section}/x-${id}.html`;
    const { html } = await fetchHTML(shortUrl, 6500, 1);
    const mCanon = html.match(/<link[^>]+rel=['"]canonical['"][^>]+href=['"]([^'"]+)['"]/i) || html.match(/<meta[^>]+property=['"]og:url['"][^>]+content=['"]([^'"]+)['"]/i);
    const mTitle = html.match(/<h1[^>]*class="[^"]*news-detail-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<meta[^>]+property=['"]og:title['"][^>]+content=['"]([^'"]+)['"]/i);
    const mPub = html.match(/article:published_time['"][^>]+content=['"](\d{4})-(\d{2})-(\d{2})/i);
    const fcMatch = html.match(/<div class="full-content">([\s\S]*?)<div class="(?:attach|news-tags|social|share|box-new-notification)/i);
    const bodyHtml = fcMatch ? fcMatch[1] : "";

    const pdfs = [];
    let pm;
    const pdfRe = /(https?:\/\/[^\s"'<>]+\.(?:pdf|docx?|xlsx?|zip|rar))/gi;
    while ((pm = pdfRe.exec(bodyHtml)) !== null) {
      const u = decodeEntities(pm[1]);
      if (!pdfs.includes(u)) pdfs.push(u);
    }
    const downloads = [];
    let dm;
    const dlRe = /download\(["']([^"']+)["']\)/g;
    while ((dm = dlRe.exec(html)) !== null) {
      const u = `${route.base}/taifiledinhkem/tai-file-${dm[1]}`;
      if (!downloads.includes(u)) downloads.push(u);
    }
    const cleaned = bodyHtml
      .replace(/<div class="attach"[\s\S]*$/i, "")
      .replace(/<table[^>]*filedinhkem_table[\s\S]*?<\/table>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n");
    const bodyText = decodeEntities(cleaned.replace(TAG_RE, " "))
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n+/g, "\n")
      .replace(/\bFile đính kèm\b[\s\S]*$/i, "")
      .trim();
    const title = mTitle ? cleanText(mTitle[1]) : `Thông báo #${id}`;
    detail = {
      source: route.source, sourceName: src.name, sourceEmoji: src.emoji,
      title, date: mPub ? `${mPub[3]}/${mPub[2]}/${mPub[1]}` : "—", sender: "",
      url: mCanon ? decodeEntities(mCanon[1]).trim() : shortUrl,
      bodyText, deadline: extractDeadline(title + " " + bodyText), pdfs, downloads, extraLinks: [],
    };
  }
  await putEdgeCache(ckey, detail, DETAIL_CACHE_TTL_SEC);
  return detail;
}

// ---------------------------------------------------------------- Zalo Bot Platform API

async function zaloApi(env, method, payload = {}) {
  if (!env || !env.ZALO_BOT_TOKEN) return { ok: false, description: "Missing ZALO_BOT_TOKEN" };
  const url = `${ZALO_API_BASE}/bot${env.ZALO_BOT_TOKEN}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }));
  if (!res.ok || data.ok === false) {
    log("zaloApi error", method, res.status, data.description || data.message || JSON.stringify(data).slice(0, 160));
  }
  return data;
}

function splitZaloChunks(text, maxLen = ZALO_MAX_LEN) {
  const s = String(text || "").trim();
  if (s.length <= maxLen) return [s];
  const chunks = [];
  let cur = "";
  for (const line of s.split("\n")) {
    if (cur && cur.length + line.length + 1 > maxLen) {
      chunks.push(cur.trim());
      cur = line.length > maxLen ? line.slice(0, maxLen - 3) + "..." : line;
    } else {
      cur = cur ? cur + "\n" + line : line;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

function htmlToPlainZalo(html) {
  return decodeEntities(String(html || "").replace(/<\/?(?:b|strong|code|u|s|a)[^>]*>/gi, ""));
}

async function sendZaloMsg(env, chatId, text, useHtml = true) {
  const chunks = splitZaloChunks(text);
  let lastRes = { ok: false };
  for (const chunk of chunks) {
    const payload = { chat_id: String(chatId), text: chunk };
    if (useHtml) payload.parse_mode = "html";
    let r = await zaloApi(env, "sendMessage", payload);
    // Nếu Zalo từ chối HTML parse_mode -> tự động gửi lại bằng plain text gọn đẹp
    if (useHtml && (!r || r.ok === false)) {
      const desc = String((r && (r.description || r.message)) || "").toLowerCase();
      if (!desc.includes("block") && !desc.includes("not found") && !desc.includes("removed")) {
        r = await zaloApi(env, "sendMessage", { chat_id: String(chatId), text: htmlToPlainZalo(chunk) });
      }
    }
    lastRes = r;
  }
  return lastRes;
}

async function sendZaloTyping(env, chatId) {
  try {
    await zaloApi(env, "sendChatAction", { chat_id: String(chatId), action: "typing" });
  } catch (_) {}
}

async function getZaloWebhookSecret(env) {
  if (env && env.ZALO_WEBHOOK_SECRET && String(env.ZALO_WEBHOOK_SECRET).trim().length >= 8) {
    return String(env.ZALO_WEBHOOK_SECRET).trim();
  }
  if (env && env.ZALO_BOT_TOKEN) {
    return (await sha256Hex(`${env.ZALO_BOT_TOKEN}:zalo_wh`)).slice(0, 48);
  }
  return "";
}

// ---------------------------------------------------------------- Zalo Subscribers, Groups & Admin (KV)

async function trackZaloChat(env, { chatId, chatType = "PRIVATE", title = "", senderName = "" }, forceActivate = false) {
  if (!env || !env.SUBSCRIBERS_KV || !chatId) return null;
  const id = String(chatId);
  const key = `zu:${id}`;
  const type = String(chatType || "PRIVATE").toUpperCase().includes("GROUP") ? "GROUP" : "PRIVATE";
  const label = title || (type === "GROUP" ? `Nhóm ${id.slice(0, 8)}` : (senderName || `User ${id.slice(0, 8)}`));
  const nowIso = new Date().toISOString();

  try {
    const existing = await env.SUBSCRIBERS_KV.get(key, { type: "json" }).catch(() => null);
    if (existing) {
      const ageMs = existing.lastSeen ? Date.now() - Date.parse(existing.lastSeen) : 9e9;
      const needsUpdate = forceActivate || existing.blocked || existing.chatType !== type || (label && existing.name !== label && type === "PRIVATE") || ageMs > 6 * 3600 * 1000;
      if (!needsUpdate) return existing;
      const updated = {
        ...existing,
        chatType: type,
        name: title || existing.name || label,
        subscribed: forceActivate ? true : (existing.blocked ? true : existing.subscribed !== false),
        blocked: false,
        lastSeen: nowIso,
      };
      await env.SUBSCRIBERS_KV.put(key, JSON.stringify(updated));
      return updated;
    }
    const created = { id, chatType: type, name: label, subscribed: true, blocked: false, joinedAt: nowIso, lastSeen: nowIso };
    await env.SUBSCRIBERS_KV.put(key, JSON.stringify(created));
    return created;
  } catch (e) {
    log("trackZaloChat error", e);
    return null;
  }
}

async function setZaloSubscription(env, chatId, subscribed, blocked = false) {
  if (!env || !env.SUBSCRIBERS_KV) return null;
  const key = `zu:${chatId}`;
  const existing = (await env.SUBSCRIBERS_KV.get(key, { type: "json" }).catch(() => null)) || {
    id: String(chatId), chatType: "PRIVATE", name: `Chat ${String(chatId).slice(0, 8)}`, joinedAt: new Date().toISOString(),
  };
  const updated = { ...existing, subscribed: Boolean(subscribed), blocked: Boolean(blocked), lastSeen: new Date().toISOString() };
  await env.SUBSCRIBERS_KV.put(key, JSON.stringify(updated));
  return updated;
}

async function listZaloChats(env) {
  if (!env || !env.SUBSCRIBERS_KV) return [];
  const keys = [];
  let cursor = undefined;
  for (let g = 0; g < 20; g++) {
    const res = await env.SUBSCRIBERS_KV.list({ prefix: "zu:", cursor });
    for (const k of (res.keys || [])) keys.push(k.name);
    if (res.list_complete || !res.cursor) break;
    cursor = res.cursor;
  }
  const chats = [];
  for (let i = 0; i < keys.length; i += 25) {
    const batch = await Promise.all(keys.slice(i, i + 25).map((k) => env.SUBSCRIBERS_KV.get(k, { type: "json" }).catch(() => null)));
    for (const c of batch) if (c && c.id) chats.push(c);
  }
  chats.sort((a, b) => String(b.joinedAt || "").localeCompare(String(a.joinedAt || "")));
  return chats;
}

async function getZaloAdmins(env) {
  const set = new Set(String((env && env.ZALO_ADMIN_IDS) || "").split(",").map((s) => s.trim()).filter(Boolean));
  if (env && env.SUBSCRIBERS_KV) {
    const stored = await env.SUBSCRIBERS_KV.get("zalo:admins", { type: "json" }).catch(() => null);
    if (Array.isArray(stored)) stored.forEach((id) => set.add(String(id)));
  }
  return Array.from(set);
}

async function isZaloAdmin(env, userId) {
  if (!userId) return false;
  return (await getZaloAdmins(env)).includes(String(userId));
}

async function claimZaloAdmin(env, userId, pin) {
  if (!env || !env.SUBSCRIBERS_KV || !env.ZALO_ADMIN_PIN) return { ok: false };
  const existing = await env.SUBSCRIBERS_KV.get("zalo:admins", { type: "json" }).catch(() => null);
  if (Array.isArray(existing) && existing.length > 0) return { ok: false };
  if (String(pin || "").trim() !== String(env.ZALO_ADMIN_PIN).trim()) return { ok: false };
  await env.SUBSCRIBERS_KV.put("zalo:admins", JSON.stringify([String(userId)]));
  return { ok: true };
}

async function saveChatListRef(env, chatId, items) {
  if (!env || !env.SUBSCRIBERS_KV || !items || !items.length) return;
  const slim = items.slice(0, LIST_LIMIT).map((it) => ({ code: it.code, id: it.id, source: it.source, title: it.title, date: it.date, url: it.url }));
  await env.SUBSCRIBERS_KV.put(`zlist:${chatId}`, JSON.stringify(slim), { expirationTtl: 1800 }).catch(() => {});
}

async function loadChatListRef(env, chatId) {
  if (!env || !env.SUBSCRIBERS_KV) return [];
  const data = await env.SUBSCRIBERS_KV.get(`zlist:${chatId}`, { type: "json" }).catch(() => null);
  return Array.isArray(data) ? data : [];
}

// ---------------------------------------------------------------- Minimalist Zalo Formatters (Zero Italics)

function buildZaloMenu(isGroup = false) {
  const prefix = isGroup ? "@HUB News " : "";
  return [
    `<b>${BOT_BRAND}</b>`,
    LINE,
    `🟢 Trực tuyến · ${vnNowLabel()}`,
    `Tác giả: ${AUTHOR_NAME}`,
    "",
    "<b>Lệnh nhanh</b>",
    `• ${prefix}/latest — Tất cả cổng HUB (Mới nhất)`,
    `• ${prefix}/online — Online HUB (#1)`,
    `• ${prefix}/7d · /30d — Theo thời gian`,
    `• ${prefix}/thi · /daotao · /scc · /hocphi · /hocbong`,
    `• ${prefix}/digest — Tổng hợp theo chủ đề`,
    `• ${prefix}/portals — Link nhanh Các Cổng HUB`,
    `• ${prefix}/status — Trạng thái 7 cổng HUB`,
    `• ${prefix}/find &lt;từ khoá&gt; — Tìm kiếm không dấu`,
    `• ${prefix}/bat · /tat — Bật/Tắt thông báo tự động`,
    "",
    isGroup
      ? "Trong nhóm: @HUB News kèm lệnh hoặc trả lời tin của Bot. Nhắn số 1–8 sau danh sách để đọc nhanh & lấy PDF."
      : "Mẹo: Nhắn trực tiếp từ khoá bất kỳ để tìm kiếm, hoặc nhắn số 1–8 sau danh sách để đọc chi tiết & lấy PDF.",
  ].join("\n");
}

function buildZaloWelcomeGroup() {
  return [
    `<b>${BOT_BRAND} đã tham gia nhóm</b>`,
    LINE,
    "🔔 Nhóm đã được bật tự động nhận thông báo mới từ 7 cổng chính thức HUB (5 phút/lần).",
    "",
    "• Gõ @HUB News /latest để xem tin mới nhất",
    "• Gõ @HUB News /menu để xem toàn bộ lệnh",
    "• Gõ @HUB News /tat nếu muốn tắt thông báo tự động",
  ].join("\n");
}

function buildZaloList(title, items) {
  const slice = items.slice(0, LIST_LIMIT);
  const lines = [
    `<b>${escapeHtml(title)}</b>`,
    `${items.length} tin · ${vnNowLabel()}`,
    LINE,
  ];
  if (!slice.length) {
    lines.push("Chưa có thông báo phù hợp.");
    return lines.join("\n");
  }
  slice.forEach((it, idx) => {
    const src = SOURCE_BY_KEY[it.source] || { short: it.source };
    const norm = stripAccents(it.title).toLowerCase();
    const cat = classifyItem(it.title, it.source, norm);
    const icon = isUrgentTitle(it.title, norm) ? "🚨" : cat.icon;
    const shortTitle = it.title.length > 96 ? it.title.slice(0, 93) + "..." : it.title;
    lines.push("");
    lines.push(`<b>${idx + 1}.</b> ${icon} ${escapeHtml(shortTitle)}`);
    lines.push(`${src.short} · ${it.date}`);
    lines.push(it.url);
  });
  lines.push("", "Nhắn số 1–" + slice.length + " (hoặc /doc 1) để đọc nội dung & lấy link PDF.");
  return lines.join("\n");
}

function buildZaloDetail(detail) {
  const norm = stripAccents(detail.title).toLowerCase();
  const cat = classifyItem(detail.title, detail.source, norm);
  const icon = isUrgentTitle(detail.title, norm) ? "🚨" : cat.icon;
  const lines = [
    `${icon} <b>${escapeHtml(detail.title)}</b>`,
    cat.tag,
    LINE,
    `Nguồn: ${detail.sourceEmoji} ${escapeHtml(detail.sourceName)}`,
    `Ngày: ${escapeHtml(detail.date)}`,
  ];
  if (detail.sender) lines.push(`Đơn vị: ${escapeHtml(detail.sender)}`);
  if (detail.deadline) lines.push(`Hạn: <b>${escapeHtml(detail.deadline)}</b>`);

  if (detail.bodyText && detail.bodyText.length > 20) {
    const trimmed = detail.bodyText.length > 900 ? detail.bodyText.slice(0, 897) + "..." : detail.bodyText;
    lines.push("", escapeHtml(trimmed));
  }
  if (detail.pdfs.length) {
    lines.push("", "<b>Tệp PDF đính kèm:</b>");
    detail.pdfs.slice(0, 4).forEach((u, i) => lines.push(`${i + 1}. ${u}`));
  }
  if (detail.downloads.length) {
    lines.push("", "<b>Tệp tải về:</b>");
    detail.downloads.slice(0, 3).forEach((u, i) => lines.push(`${i + 1}. ${u}`));
  }
  if (detail.extraLinks && detail.extraLinks.length) {
    lines.push("", "<b>Liên kết chi tiết:</b>");
    detail.extraLinks.slice(0, 2).forEach((u) => lines.push(u));
  }
  lines.push("", `Bài gốc: ${detail.url}`);
  return lines.join("\n");
}

function buildZaloPushCard(item, extraSources = [], detail = null) {
  const norm = stripAccents(item.title).toLowerCase();
  const cat = classifyItem(item.title, item.source, norm);
  const urgent = isUrgentTitle(item.title, norm);
  const src = SOURCE_BY_KEY[item.source] || { emoji: "🏛️", name: item.source, short: item.source };
  const headIcon = urgent ? "🚨" : cat.icon;

  const srcNames = [`${src.emoji} ${src.name}`];
  for (const es of extraSources) {
    const cfg = SOURCE_BY_KEY[es];
    if (cfg && es !== item.source) srcNames.push(`${cfg.emoji} ${cfg.short}`);
  }

  const lines = [
    `${headIcon} <b>${escapeHtml(item.title)}</b>`,
    `<b>TIN MỚI</b> · ${cat.tag}${urgent ? " · <b>LƯU Ý</b>" : ""}`,
    LINE,
    `Nguồn: ${escapeHtml(srcNames.join(" · "))}`,
    `Ngày: ${escapeHtml(item.date)}`,
  ];
  if (detail && detail.sender) lines.push(`Đơn vị: ${escapeHtml(detail.sender)}`);
  if (detail && detail.deadline) lines.push(`Hạn: <b>${escapeHtml(detail.deadline)}</b>`);

  const bodyText = (detail && detail.bodyText) || "";
  if (bodyText.length > 30 && !bodyText.toLowerCase().startsWith("sinh viên xem") && !bodyText.toLowerCase().startsWith("sv xem chi tiết")) {
    const preview = bodyText.length > 220 ? bodyText.slice(0, 217) + "..." : bodyText;
    lines.push("", escapeHtml(preview));
  }
  if (detail && detail.pdfs && detail.pdfs.length) {
    lines.push("", `PDF: ${detail.pdfs[0]}`);
  } else if (detail && detail.downloads && detail.downloads.length) {
    lines.push("", `Tệp đính kèm: ${detail.downloads[0]}`);
  }
  lines.push(`Xem bài viết: ${item.url}`);
  return lines.join("\n");
}

function buildZaloPortals() {
  return [
    "<b>Các Cổng HUB & Tiện ích</b>",
    LINE,
    "🏛️ Online HUB (#1): https://online.hub.edu.vn/",
    "📝 Phòng Khảo thí: https://phongktdbcl.hub.edu.vn/thong-bao",
    "🎓 Phòng Đào tạo: https://phongdaotao.hub.edu.vn/thong-bao",
    "🤝 Trung tâm SV (SCC): https://scc.hub.edu.vn/thong-bao",
    "🏫 Cổng Chính HUB: https://hub.edu.vn/thong-bao",
    "💰 Tài chính - Kế toán: https://phongketoan.hub.edu.vn/thong-bao",
    "",
    "📚 LMS HUB: https://lms.hub.edu.vn/",
    "📋 Đăng ký tín chỉ: https://dangkytinchi.hub.edu.vn/",
    "🎓 eStudent: https://estudent.hub.edu.vn/",
    "📖 Thư viện: https://library.hub.edu.vn/",
  ].join("\n");
}

function buildZaloDigest(items, days = 7) {
  const buckets = { exam: [], tuition: [], scholar: [], grad: [], reg: [], student: [] };
  for (const it of items) {
    const k = classifyItem(it.title, it.source).key;
    if (buckets[k]) buckets[k].push(it);
  }
  const lines = [`<b>Tổng hợp ${days} ngày · HUB</b>`, `${items.length} thông báo · ${vnNowLabel()}`, LINE];
  const secs = [
    ["exam", "📝 Lịch thi & Khảo thí"],
    ["tuition", "💰 Học phí & Tài chính"],
    ["scholar", "🏆 Học bổng"],
    ["grad", "🎓 Tốt nghiệp & Thực tập"],
    ["reg", "📋 Đào tạo & Học phần"],
    ["student", "🤝 Sinh viên"],
  ];
  let any = false;
  for (const [k, label] of secs) {
    const list = buckets[k];
    if (!list.length) continue;
    any = true;
    lines.push("", `<b>${label}</b> (${list.length})`);
    list.slice(0, 3).forEach((it) => {
      const t = it.title.length > 72 ? it.title.slice(0, 69) + "..." : it.title;
      lines.push(`• ${it.date.slice(0, 5)} · ${escapeHtml(t)}`);
    });
  }
  if (!any) lines.push("Chưa có thông báo mới trong giai đoạn này.");
  return lines.join("\n");
}

function buildZaloStatus(data) {
  const okCount = (data.health || []).filter((h) => h.ok).length;
  const total = (data.health || []).reduce((s, h) => s + (h.count || 0), 0);
  const lines = [
    "<b>Trạng thái 7 cổng HUB</b>",
    `${data.fetchedAt || vnNowLabel()} · ${okCount}/${SOURCES.length} cổng · ${total} tin`,
    LINE,
  ];
  for (const h of (data.health || [])) {
    const src = SOURCE_BY_KEY[h.key];
    if (!src) continue;
    const dot = h.ok ? (h.fallback ? "🟡" : "🟢") : "🔴";
    const info = h.ok ? `${h.count} tin · ${h.latestDate} · ${h.ms}ms` : h.error.slice(0, 30);
    lines.push(`${dot} <b>${src.short}</b> · ${escapeHtml(info)}`);
  }
  return lines.join("\n");
}

function buildZaloBroadcast(bodyText, urgent = false) {
  return [
    urgent ? "🚨 <b>THÔNG BÁO KHẨN</b>" : "📣 <b>THÔNG BÁO TỪ QUẢN TRỊ VIÊN</b>",
    LINE,
    escapeHtml(bodyText),
    "",
    `${vnNowLabel()} · Admin ${AUTHOR_NAME}`,
  ].join("\n");
}

// ---------------------------------------------------------------- Webhook Normalizer & Command Router

function normalizeZaloEvent(payload) {
  if (!payload || typeof payload !== "object") return null;
  const root = payload.result && typeof payload.result === "object" ? payload.result : payload;
  const eventName = String(root.event_name || payload.event_name || "").trim();
  const msg = root.message || payload.message || {};
  const chat = msg.chat || root.chat || {};
  const from = msg.from || root.from || payload.sender || {};
  const recipient = payload.recipient || {};

  const chatId = chat.id || recipient.id || from.id || "";
  if (!chatId) return null;

  const rawType = String(chat.chat_type || chat.type || (eventName.includes("group") ? "GROUP" : "PRIVATE")).toUpperCase();
  const chatType = rawType.includes("GROUP") ? "GROUP" : "PRIVATE";

  return {
    eventName,
    chatId: String(chatId),
    chatType,
    chatTitle: String(chat.title || chat.name || "").trim(),
    senderId: String(from.id || chatId),
    senderName: String(from.display_name || from.name || "").trim(),
    isBot: Boolean(from.is_bot),
    text: String(msg.text || "").trim(),
    photoUrl: String(msg.photo_url || (msg.photo && msg.photo.url) || "").trim(),
  };
}

function stripGroupMention(text) {
  let s = String(text || "").trim();
  // Gỡ các dạng @HUB News, @HUBNews, @BotName ở đầu câu trong nhóm Zalo
  s = s.replace(/^@(?:hub\s+news|hubnews|hub\s+monitor|bot)\b[:,]?\s*/i, "");
  // Nếu vẫn bắt đầu bằng @<tên_bot_tùy_chỉnh> kèm theo dấu /lệnh hoặc số 1..8
  s = s.replace(/^@[^\s/]+(?:\s+[^\s/]+)?\s+(?=[/\d])/, "");
  return s.trim();
}

async function processZaloUpdate(payload, env) {
  const ev = normalizeZaloEvent(payload);
  if (!ev || ev.isBot) return;

  const isGroup = ev.chatType === "GROUP";
  await trackZaloChat(env, { chatId: ev.chatId, chatType: ev.chatType, title: ev.chatTitle, senderName: ev.senderName }, false);

  // Sự kiện Bot vừa được thêm vào nhóm Zalo
  const evLower = ev.eventName.toLowerCase();
  if (evLower.includes("join") || evLower.includes("bot_added") || evLower.includes("add_bot") || evLower.includes("member_added")) {
    await trackZaloChat(env, { chatId: ev.chatId, chatType: "GROUP", title: ev.chatTitle, senderName: ev.senderName }, true);
    await sendZaloMsg(env, ev.chatId, buildZaloWelcomeGroup());
    return;
  }

  const cleaned = isGroup ? stripGroupMention(ev.text) : ev.text.trim();
  if (!cleaned) {
    if (isGroup && ev.text.startsWith("@")) {
      await sendZaloMsg(env, ev.chatId, buildZaloMenu(true));
    }
    return;
  }

  const firstToken = cleaned.split(/\s+/)[0].toLowerCase();
  const restArg = cleaned.slice(firstToken.length).trim();

  // 1) Đọc nhanh bài viết & PDF khi gõ số 1..8 hoặc /doc <số>
  let readIdx = null;
  if (/^[1-8]$/.test(cleaned)) {
    readIdx = parseInt(cleaned, 10);
  } else if ((firstToken === "/doc" || firstToken === "/xem" || firstToken === "doc") && /^\d+$/.test(restArg)) {
    readIdx = parseInt(restArg, 10);
  }
  if (readIdx !== null && readIdx >= 1 && readIdx <= LIST_LIMIT) {
    const listRef = await loadChatListRef(env, ev.chatId);
    const chosen = listRef[readIdx - 1];
    if (!chosen) {
      await sendZaloMsg(env, ev.chatId, "Danh sách đã hết hạn hoặc chưa có. Gõ /latest để xem tin mới rồi nhắn số 1–8.");
      return;
    }
    await sendZaloTyping(env, ev.chatId);
    try {
      const detail = await fetchArticleDetail(chosen.code, chosen.id, false);
      await sendZaloMsg(env, ev.chatId, buildZaloDetail(detail));
    } catch (e) {
      await sendZaloMsg(env, ev.chatId, `Không trích xuất được chi tiết lúc này.\nXem trực tiếp: ${chosen.url}`);
    }
    return;
  }

  // 2) Quản trị viên Zalo (/admin, /groups, /bc, /bc!, /scan)
  if (firstToken === "/admin") {
    if (restArg && !(await isZaloAdmin(env, ev.senderId))) {
      const claim = await claimZaloAdmin(env, ev.senderId, restArg);
      if (claim.ok) {
        await sendZaloMsg(env, ev.chatId, `✅ <b>Đã xác thực Quản trị viên ${BOT_BRAND} (Zalo).</b>\nGõ /admin để xem thống kê, /bc &lt;nội dung&gt; để phát sóng tới mọi người & nhóm.`);
        return;
      }
      await sendZaloMsg(env, ev.chatId, "⛔ Mã PIN không đúng hoặc Admin đã được thiết lập.");
      return;
    }
    if (!(await isZaloAdmin(env, ev.senderId))) {
      await sendZaloMsg(env, ev.chatId, "⛔ Bạn không có quyền Quản trị viên.");
      return;
    }
    const chats = await listZaloChats(env);
    const groups = chats.filter((c) => c.chatType === "GROUP");
    const privs = chats.filter((c) => c.chatType !== "GROUP");
    const active = chats.filter((c) => c.subscribed !== false && !c.blocked).length;
    const lastPush = env.SUBSCRIBERS_KV ? await env.SUBSCRIBERS_KV.get("zalo:last_scan", { type: "json" }).catch(() => null) : null;
    await sendZaloMsg(env, ev.chatId, [
      `<b>Quản trị · ${BOT_BRAND} (Zalo)</b>`,
      LINE,
      `👥 Tổng kênh: <b>${chats.length}</b> (${groups.length} nhóm · ${privs.length} cá nhân)`,
      `🔔 Đang bật nhận tin: <b>${active}</b>`,
      lastPush ? `⚡ Đồng bộ gần nhất: ${lastPush.at} (đẩy ${lastPush.pushedNotices} tin)` : "⚡ Đồng bộ tự động: 5 phút/lần",
      "",
      "Lệnh: /bc &lt;nội dung&gt; · /bc! &lt;khẩn&gt; · /groups · /scan",
    ].join("\n"));
    return;
  }

  if (firstToken === "/groups" || firstToken === "/users") {
    if (!(await isZaloAdmin(env, ev.senderId))) {
      await sendZaloMsg(env, ev.chatId, "⛔ Chỉ dành cho Quản trị viên.");
      return;
    }
    const chats = await listZaloChats(env);
    const lines = [`<b>Danh sách Nhóm & Người dùng Zalo (${chats.length})</b>`, LINE];
    chats.slice(0, 20).forEach((c, i) => {
      const icon = c.chatType === "GROUP" ? "👥" : "👤";
      const st = c.blocked ? "🚫" : (c.subscribed === false ? "🔕" : "🔔");
      lines.push(`${i + 1}. ${icon} ${st} ${escapeHtml(c.name)} (${c.id.slice(0, 12)})`);
    });
    if (!chats.length) lines.push("Chưa có nhóm hoặc người dùng nào.");
    await sendZaloMsg(env, ev.chatId, lines.join("\n"));
    return;
  }

  if (firstToken === "/bc" || firstToken === "/bc!" || firstToken === "/broadcast") {
    if (!(await isZaloAdmin(env, ev.senderId))) {
      await sendZaloMsg(env, ev.chatId, "⛔ Chỉ Quản trị viên mới có quyền phát sóng.");
      return;
    }
    if (!restArg) {
      await sendZaloMsg(env, ev.chatId, "Cú pháp: /bc &lt;nội dung&gt; hoặc /bc! &lt;nội dung khẩn&gt;");
      return;
    }
    const urgent = firstToken === "/bc!";
    const chats = await listZaloChats(env);
    const targets = chats.filter((c) => c.subscribed !== false && !c.blocked);
    const textOut = buildZaloBroadcast(restArg, urgent);
    let sent = 0, failed = 0;
    for (let i = 0; i < targets.length; i += 10) {
      await Promise.all(targets.slice(i, i + 10).map(async (c) => {
        const r = await sendZaloMsg(env, c.id, textOut);
        if (r && r.ok !== false) sent++;
        else failed++;
      }));
    }
    await sendZaloMsg(env, ev.chatId, `✅ <b>Đã phát sóng Zalo</b>\n${LINE}\nThành công: <b>${sent}/${targets.length}</b> kênh · Lỗi: ${failed}`);
    return;
  }

  if (firstToken === "/scan") {
    if (!(await isZaloAdmin(env, ev.senderId))) {
      await sendZaloMsg(env, ev.chatId, "⛔ Chỉ dành cho Quản trị viên.");
      return;
    }
    await sendZaloTyping(env, ev.chatId);
    const r = await runZaloAutoPushCron(env, true);
    await sendZaloMsg(env, ev.chatId, `✅ <b>Đồng bộ Zalo hoàn tất</b>\n${LINE}\nTin mới đẩy: <b>${r.pushedNotices}</b> (${r.totalDelivered} lượt gửi)`);
    return;
  }

  // 3) Lệnh tĩnh & cài đặt thông báo từng chat/nhóm
  if (firstToken === "/start" || firstToken === "/menu" || firstToken === "menu" || firstToken === "/help" || firstToken === "help") {
    await trackZaloChat(env, { chatId: ev.chatId, chatType: ev.chatType, title: ev.chatTitle, senderName: ev.senderName }, true);
    await sendZaloMsg(env, ev.chatId, buildZaloMenu(isGroup));
    return;
  }
  if (firstToken === "/portals" || firstToken === "/links" || firstToken === "/cong") {
    await sendZaloMsg(env, ev.chatId, buildZaloPortals());
    return;
  }
  if (firstToken === "/author" || firstToken === "/about") {
    await sendZaloMsg(env, ev.chatId, `<b>Tác giả</b>\n${LINE}\n👤 <b>${AUTHOR_NAME}</b>\n🤖 ${BOT_BRAND} · Tự động cập nhật thông báo HUB 24/7\nFacebook: ${AUTHOR_FB_URL}`);
    return;
  }
  if (firstToken === "/id") {
    await sendZaloMsg(env, ev.chatId, `<b>Thông tin phiên chat</b>\n${LINE}\nLoại: ${isGroup ? "👥 Nhóm (GROUP)" : "👤 Cá nhân (PRIVATE)"}\nChat ID: ${ev.chatId}\nUser ID: ${ev.senderId}`);
    return;
  }
  if (firstToken === "/bat" || (firstToken === "/notify" && /^(on|bat|bật|1)$/i.test(restArg))) {
    await setZaloSubscription(env, ev.chatId, true, false);
    await sendZaloMsg(env, ev.chatId, `🔔 <b>Đã bật</b> nhận thông báo tự động cho ${isGroup ? "nhóm này" : "bạn"}.`);
    return;
  }
  if (firstToken === "/tat" || (firstToken === "/notify" && /^(off|tat|tắt|0)$/i.test(restArg))) {
    await setZaloSubscription(env, ev.chatId, false, false);
    await sendZaloMsg(env, ev.chatId, `🔕 <b>Đã tắt</b> nhận thông báo tự động cho ${isGroup ? "nhóm này" : "bạn"}. Gõ /bat để bật lại.`);
    return;
  }
  if (firstToken === "/notify") {
    const cur = env.SUBSCRIBERS_KV ? await env.SUBSCRIBERS_KV.get(`zu:${ev.chatId}`, { type: "json" }).catch(() => null) : null;
    const isOn = !cur || cur.subscribed !== false;
    await sendZaloMsg(env, ev.chatId, `<b>Thông báo tự động</b>\n${LINE}\nTrạng thái: ${isOn ? "🟢 Đang bật" : "🔕 Đang tắt"}\nGõ /bat để bật hoặc /tat để tắt.`);
    return;
  }

  // 4) Lệnh đọc dữ liệu 7 cổng HUB (đọc trực tiếp từ Shared KV Snapshot < 30ms!)
  const forceLive = firstToken === "/status" || firstToken === "/update" || firstToken === "/capnhat";
  if (forceLive) await sendZaloTyping(env, ev.chatId);
  const data = await getHubData(env, forceLive);

  if (firstToken === "/status") {
    await sendZaloMsg(env, ev.chatId, buildZaloStatus(data));
    return;
  }
  if (firstToken === "/digest" || firstToken === "/tonghop") {
    const days = restArg === "30" ? 30 : 7;
    const items = mergeAndDedupe(data.bySource, days);
    await sendZaloMsg(env, ev.chatId, buildZaloDigest(items, days));
    return;
  }

  let title = "";
  let items = [];
  if (firstToken === "/latest" || firstToken === "/moi" || firstToken === "/update" || firstToken === "/capnhat") {
    title = "🔥 Tất cả cổng HUB · Mới nhất";
    items = mergeAndDedupe(data.bySource, null);
  } else if (firstToken === "/online") {
    title = "🏛️ Online HUB (#1)";
    items = data.bySource.online || [];
  } else if (firstToken === "/7d" || firstToken === "/full7d") {
    title = "📅 Thông báo 7 ngày · HUB";
    items = mergeAndDedupe(data.bySource, 7);
  } else if (firstToken === "/30d" || firstToken === "/full30d") {
    title = "🗓️ Thông báo 30 ngày · HUB";
    items = mergeAndDedupe(data.bySource, 30);
  } else if (firstToken === "/thi") {
    title = "📝 Lịch thi & Khảo thí";
    items = mergeAndDedupe(data.bySource, null).filter((it) => classifyItem(it.title, it.source).key === "exam");
  } else if (firstToken === "/daotao") {
    title = "🎓 Phòng Đào tạo";
    items = mergeAndDedupe({ daotao: data.bySource.daotao || [], daotao_news: data.bySource.daotao_news || [] }, null);
  } else if (firstToken === "/scc") {
    title = "🤝 Trung tâm SV (SCC)";
    items = data.bySource.scc || [];
  } else if (firstToken === "/hocphi") {
    title = "💰 Học phí & Tài chính";
    items = mergeAndDedupe(data.bySource, null).filter((it) => classifyItem(it.title, it.source).key === "tuition");
  } else if (firstToken === "/hocbong") {
    title = "🏆 Học bổng";
    items = mergeAndDedupe(data.bySource, null).filter((it) => classifyItem(it.title, it.source).key === "scholar");
  } else {
    const kw = firstToken === "/find" || firstToken === "/tim" ? restArg : cleaned;
    if (!kw) {
      await sendZaloMsg(env, ev.chatId, "🔎 Nhập từ khoá cần tìm (không cần dấu), VD: /find hoc bong");
      return;
    }
    const kwNorm = stripAccents(kw).toLowerCase();
    title = `🔎 Tìm "${kw}"`;
    items = mergeAndDedupe(data.bySource, null).filter((it) => stripAccents(it.title).toLowerCase().includes(kwNorm));
  }

  await saveChatListRef(env, ev.chatId, items);
  await sendZaloMsg(env, ev.chatId, buildZaloList(title, items));
}

// ---------------------------------------------------------------- 5-Minute Auto-Push Cron (Reads Shared KV Snapshot!)

async function runZaloAutoPushCron(env, forceLive = false) {
  if (!env || !env.ZALO_BOT_TOKEN || !env.SUBSCRIBERS_KV) {
    return { ok: false, reason: "Missing ZALO_BOT_TOKEN or SUBSCRIBERS_KV", pushedNotices: 0, totalDelivered: 0 };
  }

  const data = await getHubData(env, forceLive);
  const bySource = data.bySource || {};

  const prevState = (await env.SUBSCRIBERS_KV.get("zalo:seen_v1", { type: "json" }).catch(() => null)) || { sources: {}, seenTitles: {} };
  const sourcesState = prevState.sources || {};
  const seenTitles = prevState.seenTitles || {};
  const todayIso = new Date(Date.now() + VN_OFFSET).toISOString().slice(0, 10);
  const cutoffIso = new Date(Date.now() + VN_OFFSET - 21 * 86400 * 1000).toISOString().slice(0, 10);

  let stateChanged = false;
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
      // Lần đầu ghi mốc âm thầm để không spam tin cũ vào nhóm Zalo
      sourcesState[skey] = Object.fromEntries(items.map((it) => [it.id, it.date]));
      for (const it of items) {
        const fp = normalizeTitleKey(it.title);
        if (fp && !seenTitles[fp]) seenTitles[fp] = { source: skey, at: todayIso };
      }
      stateChanged = true;
      continue;
    }
    for (const it of items) {
      if (!srcSeen[it.id]) candidates.push(it);
    }
  }

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
    const chats = await listZaloChats(env);
    const targets = chats.filter((c) => c.subscribed !== false && !c.blocked);

    for (const entry of toNotify.reverse().slice(0, 5)) {
      const it = entry.item;
      let detail = null;
      try {
        detail = await fetchArticleDetail(it.code, it.id, false);
      } catch (_) {}
      const cardText = buildZaloPushCard(it, entry.extraSources, detail);

      let sentThis = 0;
      for (let i = 0; i < targets.length; i += 10) {
        await Promise.all(targets.slice(i, i + 10).map(async (c) => {
          const r = await sendZaloMsg(env, c.id, cardText);
          if (r && r.ok !== false) {
            sentThis += 1;
          } else {
            const desc = String((r && (r.description || r.message)) || "").toLowerCase();
            if (desc.includes("blocked") || desc.includes("removed") || desc.includes("kicked") || desc.includes("not found")) {
              await setZaloSubscription(env, c.id, false, true);
            }
          }
        }));
      }

      if (sentThis > 0 || targets.length === 0) {
        for (const [sk, sid, sdate] of entry.allRefs) sourcesState[sk][sid] = sdate;
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
        entries.sort((a, b) => (parseDate(b[1])?.getTime() || 0) - (parseDate(a[1])?.getTime() || 0));
        sourcesState[sk] = Object.fromEntries(entries.slice(0, 120));
      }
    }
    await env.SUBSCRIBERS_KV.put("zalo:seen_v1", JSON.stringify({ sources: sourcesState, seenTitles }));
  }

  if (pushedNotices > 0 || forceLive) {
    await env.SUBSCRIBERS_KV.put("zalo:last_scan", JSON.stringify({ ts: Date.now(), at: vnNowLabel(), pushedNotices, totalDelivered }));
  }

  return { ok: true, pushedNotices, totalDelivered };
}

// ---------------------------------------------------------------- Setup & Worker Entrypoint

async function handleZaloSetup(request, env) {
  const url = new URL(request.url);
  if (env.SETUP_SECRET && url.searchParams.get("key") !== env.SETUP_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!env.ZALO_BOT_TOKEN) {
    return new Response(
      JSON.stringify({
        status: "MISSING_ZALO_BOT_TOKEN",
        next_step: "Thêm secret ZALO_BOT_TOKEN (lấy từ Zalo Bot Creator: bot.zapps.me) vào Cloudflare Worker hub-news-zalo rồi mở lại /setup.",
      }, null, 2),
      { status: 500, headers: { "Content-Type": "application/json; charset=utf-8" } }
    );
  }
  const webhookUrl = `${url.origin}/webhook`;
  const secretToken = await getZaloWebhookSecret(env);
  const [me, hook] = await Promise.all([
    zaloApi(env, "getMe", {}),
    zaloApi(env, "setWebhook", { url: webhookUrl, secret_token: secretToken }),
  ]);
  return new Response(
    JSON.stringify({
      status: me && me.ok !== false && hook && hook.ok !== false ? "ALL_OK" : "CHECK_RESPONSE",
      bot_brand: BOT_BRAND,
      webhook_url: webhookUrl,
      getMe: me,
      setWebhook: hook,
      group_guide: "Mở Zalo Bot Creator (bot.zapps.me) -> chọn Bot -> Mời Bot vào nhóm -> gửi link vào nhóm Zalo -> Trưởng nhóm bấm Xác nhận.",
    }, null, 2),
    { headers: { "Content-Type": "application/json; charset=utf-8" } }
  );
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/webhook" && request.method === "POST") {
      const expectedSecret = await getZaloWebhookSecret(env);
      const providedSecret = (request.headers.get("x-bot-api-secret-token") || "").trim();
      if (expectedSecret && providedSecret !== expectedSecret) {
        return new Response("Forbidden", { status: 403 });
      }
      try {
        const payload = await request.json();
        ctx.waitUntil(processZaloUpdate(payload, env).catch((e) => log("processZaloUpdate error", e)));
      } catch (e) {
        log("webhook json error", e);
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/setup" && request.method === "GET") {
      return await handleZaloSetup(request, env);
    }

    if (url.pathname === "/" && request.method === "GET") {
      const configured = Boolean(env && env.ZALO_BOT_TOKEN);
      return new Response(
        `${BOT_BRAND} (Zalo Bot) — ${configured ? "Running" : "Waiting for ZALO_BOT_TOKEN"}\n` +
        "Supports 1-1 chat & Zalo Groups (bot.zapps.me / bot-api.zaloplatforms.com).\n" +
        "Open /setup after setting ZALO_BOT_TOKEN to register Webhook automatically.",
        { headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runZaloAutoPushCron(env, false).catch((e) => log("scheduled cron error", e)));
  },
};

export {
  SOURCES,
  normalizeZaloEvent,
  stripGroupMention,
  splitZaloChunks,
  buildZaloMenu,
  buildZaloWelcomeGroup,
  buildZaloList,
  buildZaloDetail,
  buildZaloPushCard,
  buildZaloPortals,
  buildZaloDigest,
  buildZaloStatus,
  runZaloAutoPushCron,
  getZaloWebhookSecret,
};
