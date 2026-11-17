/**
 * BUH Telegram webhook — trả lời lệnh tức thì trên Cloudflare Workers.
 *
 * Cách dùng:
 *   1. Tạo Worker mới trên Cloudflare, dán toàn bộ file này vào.
 *   2. Settings -> Variables and Secrets -> thêm biến BOT_TOKEN = token bot Telegram.
 *   3. Deploy, rồi đăng ký webhook:
 *      https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<worker>.workers.dev/webhook
 *
 * Khi người dùng gửi lệnh, bot nhắn ngay "Đang truy thông tin..." rồi trả kết quả.
 */

const HOME = "https://online.hub.edu.vn/";
const GRID_TARGET = "ctl00$ContentPlaceHolder1$ctl00$ctl00$ctl00$ctl00$grvNewsgroup";
const ITEM_RE = /title="Messages\.aspx\?ID=(\d+)"[^>]*>(.*?)<\/a>[\s\S]*?<span[^>]*class="inputdate"[^>]*>(\d{1,2}\/\d{1,2}\/\d{4})<\/span>/g;
const MAX_PAGES = 8;
const VN_OFFSET = 7 * 3600 * 1000;

const HELP = [
  "🤖 Bot thông báo ĐH Ngân Hàng",
  "Các lệnh:",
  "/full7d — thông báo 7 ngày gần nhất",
  "/full30d — thông báo 30 ngày gần nhất",
  "/find <từ khoá> — tìm từ khoá trong 30 ngày",
  "/help — xem hướng dẫn",
].join("\n");

function log(...args) {
  console.log(...args);
}

async function fetchHTML(url, formData) {
  const headers = { "User-Agent": "Mozilla/5.0 (TelegramBot)" };
  let opts = { headers };
  if (formData) {
    opts.method = "POST";
    opts.headers["Content-Type"] = "application/x-www-form-urlencoded";
    opts.body = new URLSearchParams(formData).toString();
  }
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error("HTTP " + res.status);
  return await res.text();
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)));
}

function getHiddenFields(html) {
  const fields = {};
  for (const name of ["__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION"]) {
    const m = html.match(new RegExp('name="' + name + '"[^>]*value="([^"]*)"', "i"));
    if (m) fields[name] = decodeEntities(m[1]);
  }
  return fields;
}

function parseDate(s) {
  const p = s.trim().split("/");
  if (p.length !== 3) return null;
  const d = new Date(Date.UTC(+p[2], +p[1] - 1, +p[0]));
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(d) {
  return ("0" + d.getUTCDate()).slice(-2) + "/" +
         ("0" + (d.getUTCMonth() + 1)).slice(-2) + "/" +
         d.getUTCFullYear();
}

function vnToday() {
  const now = new Date(Date.now() + VN_OFFSET);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function parseItems(html) {
  const items = [];
  ITEM_RE.lastIndex = 0;
  let m;
  while ((m = ITEM_RE.exec(html)) !== null) {
    const title = m[2].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const dt = parseDate(m[3]);
    if (title && dt) {
      items.push({ id: m[1], title: title, date: fmtDate(dt), dateDt: dt });
    }
  }
  return items;
}

async function collectRecent(days) {
  const cutoff = vnToday();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);

  let html = await fetchHTML(HOME);
  let items = parseItems(html);
  let fields = getHiddenFields(html);

  let page = 1;
  while (items.length && page < MAX_PAGES) {
    const oldest = items[items.length - 1].dateDt;
    if (oldest < cutoff) break;
    page += 1;
    try {
      html = await fetchHTML(HOME, Object.assign({}, fields, {
        __EVENTTARGET: GRID_TARGET,
        __EVENTARGUMENT: "Page$" + page,
      }));
    } catch (e) {
      log("page fetch error", e);
      break;
    }
    fields = getHiddenFields(html);
    const pageItems = parseItems(html);
    if (!pageItems.length) break;
    items = items.concat(pageItems);
  }
  return items.filter((it) => it.dateDt >= cutoff);
}

function formatList(header, items) {
  if (!items.length) {
    return [header + "\n\nKhông có thông báo nào trong khoảng thời gian này."];
  }
  const lines = [header + " (" + items.length + " tin)"];
  items.forEach((it, i) => {
    let t = it.title;
    if (t.length > 90) t = t.slice(0, 87) + "...";
    lines.push("");
    lines.push((i + 1) + ". 📅 " + it.date + " — " + t);
    lines.push("   🔗 https://online.hub.edu.vn/Messages.aspx?id=" + it.id);
  });

  const chunks = [];
  let cur = "";
  for (const line of lines) {
    if (cur && cur.length + line.length + 1 > 3800) {
      chunks.push(cur);
      cur = line;
    } else {
      cur = cur ? cur + "\n" + line : line;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

async function sendMessage(env, chatId, text) {
  const url = "https://api.telegram.org/bot" + env.BOT_TOKEN + "/sendMessage";
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text }),
  });
  if (!res.ok) log("sendMessage error", res.status, await res.text());
}

async function processUpdate(update, env) {
  const msg = update.message;
  if (!msg || !msg.text) return;
  const chatId = msg.chat && msg.chat.id;
  const text = (msg.text || "").trim();
  if (!chatId) return;

  if (text === "/start" || text === "/help") {
    await sendMessage(env, chatId, HELP);
    return;
  }

  let days = null;
  let keyword = null;
  let kwRaw = null;

  if (text.startsWith("/full7d")) {
    days = 7;
  } else if (text.startsWith("/full30d")) {
    days = 30;
  } else if (text.startsWith("/find")) {
    days = 30;
    kwRaw = text.slice(5).trim();
    keyword = kwRaw.toLowerCase();
    if (!keyword) {
      await sendMessage(env, chatId, "Hãy nhập từ khoá, ví dụ:\n/find học bổng");
      return;
    }
  } else {
    await sendMessage(env, chatId, "Không hiểu lệnh. Gõ /help để xem các lệnh.");
    return;
  }

  // Phản hồi ngay lập tức, không bắt người dùng chờ trong im lặng
  await sendMessage(env, chatId, "⏳ Đang truy thông tin từ online.hub.edu.vn, vui lòng chờ giây lát...");

  try {
    const items = await collectRecent(days);
    let replies;
    if (keyword) {
      const found = items.filter((it) => it.title.toLowerCase().includes(keyword));
      replies = formatList('🔎 TÌM "' + kwRaw + '" TRONG 30 NGÀY', found);
    } else if (days === 7) {
      replies = formatList("📋 THÔNG BÁO 7 NGÀY GẦN NHẤT", items);
    } else {
      replies = formatList("📋 THÔNG BÁO 30 NGÀY GẦN NHẤT", items);
    }
    for (const r of replies) {
      await sendMessage(env, chatId, r);
    }
  } catch (e) {
    log("process error", e);
    await sendMessage(env, chatId, "❌ Có lỗi khi truy thông tin, thử lại sau nhé.");
  }
}

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
    if (url.pathname === "/" && request.method === "GET") {
      return new Response("BUH Telegram webhook is running", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return new Response("Not found", { status: 404 });
  },
};

export { parseItems, collectRecent, formatList };
