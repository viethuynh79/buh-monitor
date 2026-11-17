#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BUH Portal monitor — theo dõi "THÔNG BÁO MỚI" trên https://online.hub.edu.vn/
và gửi tin nhắn Telegram khi có thông báo mới.

Chạy định kỳ bằng GitHub Actions (máy tính tắt vẫn chạy).

Biến môi trường:
    TELEGRAM_BOT_TOKEN : token bot Telegram (từ @BotFather)
    TELEGRAM_CHAT_ID   : chat id nhận tin nhắn

Cách dùng thủ công:
    python monitor.py            # chạy bình thường
    python monitor.py --test     # gửi 1 tin nhắn kiểm tra qua Telegram
    python monitor.py --notify-first  # lần đầu cũng gửi tất cả tin hiện có
"""

import json
import os
import re
import sys
import time
import html as html_lib
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

# Regex tách từng tin trong lưới "THÔNG BÁO MỚI".
# Mỗi tin: <a ... title="Messages.aspx?ID=NNNN" ...>TIÊU ĐỀ</a> ...
#          [Ngày đăng:<span class="inputdate">dd/mm/yyyy</span>]
ITEM_RE = re.compile(
    r'title="Messages\.aspx\?ID=(\d+)"[^>]*>(.*?)</a>'
    r'.*?<span[^>]*class="inputdate"[^>]*>(\d{1,2}/\d{1,2}/\d{4})</span>',
    re.DOTALL,
)


def log(msg):
    print(msg, flush=True)


def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", "replace")


def clean_title(raw):
    # bỏ thẻ HTML nếu có, giải mã entity (&ecirc; -> ê, &amp; -> & ...)
    text = re.sub(r"<[^>]+>", "", raw)
    text = html_lib.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def parse_items(page_html):
    items = []
    for m in ITEM_RE.finditer(page_html):
        msg_id = m.group(1)
        title = clean_title(m.group(2))
        date = m.group(3).strip()
        if title:
            items.append({"id": msg_id, "title": title, "date": date})
    return items


def load_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8-sig") as f:
                data = json.load(f)
            if isinstance(data, dict) and isinstance(data.get("seen"), dict):
                return data
        except (ValueError, OSError):
            pass
    return {"seen": {}}


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
    # fallback: đọc config.json (không commit lên git)
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8-sig") as f:
                cfg = json.load(f)
            token = token or str(cfg.get("telegram_bot_token", "")).strip()
            chat_id = chat_id or str(cfg.get("telegram_chat_id", "")).strip()
        except (ValueError, OSError):
            pass
    return token, chat_id


def telegram_send(token, chat_id, text, retries=3):
    url = "https://api.telegram.org/bot{}/sendMessage".format(token)
    data = urllib.parse.urlencode({"chat_id": chat_id, "text": text}).encode("utf-8")
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, data=data, method="POST")
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = json.loads(resp.read().decode("utf-8", "replace"))
            if body.get("ok"):
                return True
            err = body.get("description", "unknown error")
            if body.get("error_code") == 429:
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


def notify_item(token, chat_id, item):
    text = (
        "\U0001F514 THÔNG BÁO MỚI — BUH\n"
        "\U0001F4CC {title}\n"
        "\U0001F4C5 {date}\n"
        "\U0001F517 https://online.hub.edu.vn/Messages.aspx?id={id}"
    ).format(title=item["title"], date=item["date"], id=item["id"])
    return telegram_send(token, chat_id, text)


def main():
    args = sys.argv[1:]
    do_test = "--test" in args
    notify_first = "--notify-first" in args

    token, chat_id = get_config()

    log("Lấy trang chủ {} ...".format(HOME_URL))
    page = fetch(HOME_URL)
    items = parse_items(page)
    log("Tìm thấy {} thông báo trên trang chủ.".format(len(items)))

    if not items:
        log("LỖI: không phân tích được thông báo nào (cấu trúc trang có thể đã đổi).")
        sys.exit(1)

    state = load_state()
    seen = state.get("seen", {})
    first_run = not seen

    if first_run:
        log("Lần chạy đầu tiên: ghi nhận {} tin làm mốc.".format(len(items)))
        # ghi mốc tất cả tin hiện có, không gửi spam
        for it in items:
            seen[it["id"]] = it["date"]
        state["seen"] = seen
        state["updated"] = time.strftime("%Y-%m-%d %H:%M:%S")
        save_state(state)

        if notify_first and token and chat_id:
            log("--notify-first: gửi tất cả tin hiện có ...")
            for it in reversed(items):  # tin cũ trước, tin mới sau
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

    # tìm tin mới (id chưa từng thấy)
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
                    # KHÔNG ghi vào seen nếu gửi thất bại -> lần sau thử lại
                    continue
                log("Đã gửi tin id={}: {}".format(it["id"], it["title"]))
            seen[it["id"]] = it["date"]

        # giữ state gọn: chỉ giữ 300 id gần nhất
        if len(seen) > 300:
            keep = sorted(seen, key=lambda k: seen.get(k) or "", reverse=True)[:300]
            seen = {k: seen[k] for k in keep if k in seen}
        state["seen"] = seen
        state["updated"] = time.strftime("%Y-%m-%d %H:%M:%S")
        save_state(state)
        log("Đã cập nhật state ({} id).".format(len(seen)))
    else:
        log("Không có tin mới.")

    if do_test and token and chat_id:
        latest = items[0]
        text = (
            "\u2705 Bot BUH đang chạy bình thường.\n"
            "Tin mới nhất hiện tại:\n"
            "\U0001F4CC {title}\n"
            "\U0001F4C5 {date}"
        ).format(title=latest["title"], date=latest["date"])
        telegram_send(token, chat_id, text)
        log("Đã gửi tin nhắn kiểm tra.")


if __name__ == "__main__":
    main()
