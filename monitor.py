#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BUH Portal monitor — theo dõi "THÔNG BÁO MỚI" trên https://online.hub.edu.vn/

Chức năng:
  1. Gửi Telegram khi có thông báo/tin tức mới (kèm link chi tiết).
  2. Trả lời các lệnh Telegram:
       /full7d              -> danh sách thông báo 7 ngày gần nhất
       /full30d             -> danh sách thông báo 30 ngày gần nhất
       /find <từ khoá>      -> tìm từ khoá trong thông báo 30 ngày gần nhất
       /help | /start       -> hướng dẫn các lệnh

Chạy định kỳ bằng GitHub Actions (máy tính tắt vẫn chạy). Lệnh được xử lý sau
mỗi chu kỳ chạy (tối đa ~5 phút kể từ khi bạn gửi).

Biến môi trường:
    TELEGRAM_BOT_TOKEN : token bot Telegram (từ @BotFather)
    TELEGRAM_CHAT_ID   : chat id nhận thông báo

Cách dùng thủ công:
    python monitor.py            # chạy bình thường
    python monitor.py --test     # gửi 1 tin nhắn kiểm tra qua Telegram
    python monitor.py --notify-first  # lần đầu cũng gửi tất cả tin hiện có
"""

import datetime
import html as html_lib
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

HOME_URL = "https://online.hub.edu.vn/"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATE_FILE = os.path.join(BASE_DIR, "seen.json")
CONFIG_FILE = os.path.join(BASE_DIR, "config.json")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

# Múi giờ Việt Nam (không có DST)
VN_TZ = datetime.timezone(datetime.timedelta(hours=7))

# Regex tách từng tin trong lưới "THÔNG BÁO MỚI".
ITEM_RE = re.compile(
    r'title="Messages\.aspx\?ID=(\d+)"[^>]*>(.*?)</a>'
    r'.*?<span[^>]*class="inputdate"[^>]*>(\d{1,2}/\d{1,2}/\d{4})</span>',
    re.DOTALL,
)

# Event target của GridView "THÔNG BÁO MỚI" (để chuyển trang bằng postback)
GRID_TARGET = "ctl00$ContentPlaceHolder1$ctl00$ctl00$ctl00$ctl00$grvNewsgroup"

MAX_PAGES = 8          # tối đa ~80 tin, đủ xa hơn 30 ngày
TELEGRAM_CHUNK = 3800  # mỗi tin nhắn Telegram tối đa 4096 ký tự

HELP_TEXT = (
    "🤖 Bot thông báo ĐH Ngân Hàng\n"
    "Các lệnh:\n"
    "/full7d — thông báo 7 ngày gần nhất\n"
    "/full30d — thông báo 30 ngày gần nhất\n"
    "/find <từ khoá> — tìm từ khoá trong 30 ngày gần nhất\n"
    "/help — xem hướng dẫn"
)


def log(msg):
    print(msg, flush=True)


def fetch(url, data=None, timeout=30):
    """GET (data=None) hoặc POST (data là dict form)."""
    headers = {"User-Agent": USER_AGENT}
    body = None
    if data is not None:
        body = urllib.parse.urlencode(data).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=body, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", "replace")


def clean_title(raw):
    text = re.sub(r"<[^>]+>", "", raw)
    text = html_lib.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def parse_date(text):
    try:
        return datetime.datetime.strptime(text.strip(), "%d/%m/%Y").date()
    except ValueError:
        return None


def parse_items(page_html):
    items = []
    for m in ITEM_RE.finditer(page_html):
        msg_id = m.group(1)
        title = clean_title(m.group(2))
        date = parse_date(m.group(3))
        if title and date:
            items.append({"id": msg_id, "title": title,
                          "date": date.strftime("%d/%m/%Y"), "date_dt": date})
    return items


def get_hidden_fields(html_text):
    fields = {}
    for name in ["__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION"]:
        m = re.search(r'name="%s"[^>]*value="([^"]*)"' % name, html_text, re.I)
        if m:
            fields[name] = html_lib.unescape(m.group(1))
    return fields


def fetch_grid_page(fields, page_num):
    data = dict(fields)
    data["__EVENTTARGET"] = GRID_TARGET
    data["__EVENTARGUMENT"] = "Page$%d" % page_num
    return fetch(HOME_URL, data)


def collect_recent(days, first_html=None):
    """Thu thập thông báo trong `days` ngày gần nhất (trang 1..N)."""
    if first_html is None:
        first_html = fetch(HOME_URL)

    items = parse_items(first_html)
    fields = get_hidden_fields(first_html)

    today = datetime.datetime.now(VN_TZ).date()
    cutoff = today - datetime.timedelta(days=days)

    page = 1
    while items and page < MAX_PAGES:
        oldest = items[-1]["date_dt"]
        if oldest < cutoff:
            break  # đã quét qua khoảng thời gian cần tìm
        page += 1
        try:
            html = fetch_grid_page(fields, page)
        except Exception as e:  # noqa: BLE001
            log("Lỗi khi lấy trang {}: {}".format(page, e))
            break
        fields = get_hidden_fields(html)
        page_items = parse_items(html)
        if not page_items:
            break
        items.extend(page_items)

    # lọc đúng khoảng thời gian
    return [it for it in items if it["date_dt"] >= cutoff]


# ---------------------------------------------------------------- Telegram

def telegram_api(token, method, params):
    url = "https://api.telegram.org/bot{}/{}".format(token, method)
    return url, params


def telegram_send(token, chat_id, text, retries=3):
    url = "https://api.telegram.org/bot{}/sendMessage".format(token)
    body = urllib.parse.urlencode(
        {"chat_id": chat_id, "text": text}).encode("utf-8")
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, data=body, method="POST")
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8", "replace"))
            if data.get("ok"):
                return True
            err = data.get("description", "unknown error")
            if data.get("error_code") == 429:
                wait = 5 * attempt
                log("Telegram 429, thử lại sau {}s ...".format(wait))
                time.sleep(wait)
                continue
            log("Telegram lỗi: {}".format(err))
            return False
        except Exception as e:  # noqa: BLE001
            log("Lỗi gửi Telegram (lần {}): {}".format(attempt, e))
            if attempt < retries:
                time.sleep(5 * attempt)
    return False


def telegram_get_updates(token, offset):
    """Đọc tin nhắn người dùng gửi cho bot (non-blocking)."""
    params = urllib.parse.urlencode(
        {"offset": offset, "timeout": 0,
         "allowed_updates": urllib.parse.quote('["message"]')})
    url = "https://api.telegram.org/bot{}/getUpdates?{}".format(token, params)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8", "replace"))
        if data.get("ok"):
            return data.get("result", [])
        log("getUpdates lỗi: {}".format(data.get("description")))
    except Exception as e:  # noqa: BLE001
        log("Lỗi getUpdates: {}".format(e))
    return []


def chunk_lines(lines, limit=TELEGRAM_CHUNK):
    chunks = []
    cur = ""
    for line in lines:
        if cur and len(cur) + len(line) + 1 > limit:
            chunks.append(cur)
            cur = line
        else:
            cur = cur + "\n" + line if cur else line
    if cur:
        chunks.append(cur)
    return chunks


def format_announcement_list(header, items):
    if not items:
        return [header + "\n\nKhông có thông báo nào trong khoảng thời gian này."]
    lines = [header + " ({} tin)".format(len(items))]
    for i, it in enumerate(items, 1):
        title = it["title"]
        if len(title) > 90:
            title = title[:87] + "..."
        lines.append("")
        lines.append("{}. \U0001F4C5 {} — {}".format(i, it["date"], title))
        lines.append("   \U0001F517 https://online.hub.edu.vn/Messages.aspx?id={}"
                     .format(it["id"]))
    return chunk_lines(lines)


def build_reply(text, first_html):
    t = (text or "").strip()
    if t in ("/start", "/help"):
        return [HELP_TEXT]
    if t.startswith("/full7d"):
        items = collect_recent(7, first_html)
        return format_announcement_list(
            "\U0001F4CB THÔNG BÁO 7 NGÀY GẦN NHẤT", items)
    if t.startswith("/full30d"):
        items = collect_recent(30, first_html)
        return format_announcement_list(
            "\U0001F4CB THÔNG BÁO 30 NGÀY GẦN NHẤT", items)
    if t.startswith("/find"):
        kw = t[len("/find"):].strip()
        if not kw:
            return ["Hãy nhập từ khoá, ví dụ:\n/find học bổng"]
        items = collect_recent(30, first_html)
        kw_l = kw.lower()
        found = [it for it in items if kw_l in it["title"].lower()]
        return format_announcement_list(
            "\U0001F50E TÌM \"{}\" TRONG 30 NGÀY".format(kw), found)
    return ["Không hiểu lệnh. Gõ /help để xem các lệnh."]


# ---------------------------------------------------------------- Cấu hình / state

def load_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8-sig") as f:
                data = json.load(f)
            if isinstance(data, dict) and isinstance(data.get("seen"), dict):
                data.setdefault("telegram_offset", 0)
                return data
        except (ValueError, OSError):
            pass
    return {"seen": {}, "telegram_offset": 0}


def save_state(state):
    tmp = STATE_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    os.replace(tmp, STATE_FILE)


def get_config():
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    if token and chat_id:
        return token, chat_id
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8-sig") as f:
                cfg = json.load(f)
            token = token or str(cfg.get("telegram_bot_token", "")).strip()
            chat_id = chat_id or str(cfg.get("telegram_chat_id", "")).strip()
        except (ValueError, OSError):
            pass
    return token, chat_id


def notify_item(token, chat_id, item):
    text = (
        "\U0001F514 THÔNG BÁO MỚI — BUH\n"
        "\U0001F4CC {title}\n"
        "\U0001F4C5 {date}\n"
        "\U0001F517 https://online.hub.edu.vn/Messages.aspx?id={id}"
    ).format(title=item["title"], date=item["date"], id=item["id"])
    return telegram_send(token, chat_id, text)


# ---------------------------------------------------------------- Main

def handle_commands(token, state, first_html):
    offset = int(state.get("telegram_offset", 0) or 0)
    updates = telegram_get_updates(token, offset)
    if not updates:
        return
    max_id = offset
    for u in updates:
        uid = int(u.get("update_id", 0))
        max_id = max(max_id, uid)
        msg = u.get("message") or {}
        text = (msg.get("text") or "").strip()
        cid = msg.get("chat", {}).get("id")
        if not cid or not text.startswith("/"):
            continue
        log("Xử lý lệnh '{}' từ chat {}".format(text, cid))
        try:
            for reply in build_reply(text, first_html):
                telegram_send(token, cid, reply)
        except Exception as e:  # noqa: BLE001
            log("Lỗi xử lý lệnh '{}': {}".format(text, e))
            telegram_send(token, cid, "Có lỗi khi xử lý lệnh, thử lại sau nhé.")
    state["telegram_offset"] = max_id + 1


def main():
    args = sys.argv[1:]
    do_test = "--test" in args
    notify_first = "--notify-first" in args

    token, chat_id = get_config()
    state = load_state()

    log("Lấy trang chủ {} ...".format(HOME_URL))
    page1 = fetch(HOME_URL)
    items = parse_items(page1)
    log("Tìm thấy {} thông báo trên trang chủ.".format(len(items)))

    if not items:
        log("LỖI: không phân tích được thông báo nào (cấu trúc trang có thể đã đổi).")
        sys.exit(1)

    # 1) Trả lời các lệnh người dùng gửi cho bot
    if token:
        handle_commands(token, state, page1)

    seen = state.get("seen", {})
    first_run = not seen

    # 2) Thông báo tin mới
    if first_run:
        log("Lần chạy đầu tiên: ghi nhận {} tin làm mốc.".format(len(items)))
        for it in items:
            seen[it["id"]] = it["date"]
        state["seen"] = seen
        state["updated"] = time.strftime("%Y-%m-%d %H:%M:%S")
        save_state(state)

        if notify_first and token and chat_id:
            log("--notify-first: gửi tất cả tin hiện có ...")
            for it in reversed(items):
                notify_item(token, chat_id, it)
        if do_test and token and chat_id:
            latest = items[0]
            text = (
                "\u2705 Bot BUH đã hoạt động.\n"
                "Tin mới nhất hiện tại:\n"
                "\U0001F4CC {title}\n"
                "\U0001F4C5 {date}\n"
                "\U0001F517 https://online.hub.edu.vn/Messages.aspx?id={id}"
            ).format(title=latest["title"], date=latest["date"], id=latest["id"])
            telegram_send(token, chat_id, text)
            log("Đã gửi tin nhắn kiểm tra.")
        if not token or not chat_id:
            log("Chưa cấu hình TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID — chỉ ghi mốc, không gửi.")
        return

    new_items = [it for it in items if it["id"] not in seen]
    log("Tin mới phát hiện: {} (tổng {} tin trên trang).".format(len(new_items), len(items)))

    if new_items:
        can_send = bool(token and chat_id)
        if not can_send:
            log("Có tin mới nhưng chưa cấu hình Telegram — chỉ cập nhật mốc.")
        for it in new_items:
            if can_send:
                ok = notify_item(token, chat_id, it)
                if not ok:
                    log("Gửi thất bại cho id={}, sẽ thử lại lần chạy sau.".format(it["id"]))
                    continue
                log("Đã gửi tin id={}: {}".format(it["id"], it["title"]))
            seen[it["id"]] = it["date"]
    else:
        log("Không có tin mới.")

    # giữ state gọn: chỉ giữ 300 id gần nhất
    if len(seen) > 300:
        keep = sorted(seen, key=lambda k: seen.get(k) or "", reverse=True)[:300]
        seen = {k: seen[k] for k in keep if k in seen}
    state["seen"] = seen
    state["updated"] = time.strftime("%Y-%m-%d %H:%M:%S")
    save_state(state)

    if do_test and token and chat_id:
        latest = items[0]
        text = (
            "\u2705 Bot BUH đang chạy bình thường.\n"
            "Tin mới nhất hiện tại:\n"
            "\U0001F4CC {title}\n"
            "\U0001F4C5 {date}\n"
            "\U0001F517 https://online.hub.edu.vn/Messages.aspx?id={id}"
        ).format(title=latest["title"], date=latest["date"], id=latest["id"])
        telegram_send(token, chat_id, text)
        log("Đã gửi tin nhắn kiểm tra.")


if __name__ == "__main__":
    main()
