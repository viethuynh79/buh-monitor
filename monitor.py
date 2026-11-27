#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HUB Monitor — Hệ thống theo dõi 7 cổng thông tin chính thức ĐH Ngân hàng TP.HCM (HUB).
Ưu tiên #1: Cổng Sinh viên Online (https://online.hub.edu.vn/).

Cách dùng thủ công:
  python monitor.py               # Quét tất cả 7 cổng và gửi tin mới
  python monitor.py --test        # Gửi 1 thẻ kiểm tra mẫu về chat Admin
  python monitor.py --setup-bot   # Đăng ký nút Menu & danh sách lệnh Telegram
  python monitor.py --dry-run     # Chạy thử không gửi Telegram, không ghi seen.json
  python monitor.py --notify-first # Gửi cả tin hiện có nếu nguồn mới chạy lần đầu
"""

import concurrent.futures
import datetime
import gzip
import hashlib
import html as html_lib
import http.cookiejar
import json
import os
import re
import ssl
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import zlib

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATE_FILE = os.path.join(BASE_DIR, "seen.json")
CONFIG_FILE = os.path.join(BASE_DIR, "config.json")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

VN_TZ = datetime.timezone(datetime.timedelta(hours=7))
BOT_UI_VERSION = 5
LINE = "────────────"

ONLINE_HOME = "https://online.hub.edu.vn/"
ONLINE_ALT = "https://online.hub.edu.vn/Default.aspx"
ONLINE_GRID_TARGET = "ctl00$ContentPlaceHolder1$ctl00$ctl00$ctl00$ctl00$grvNewsgroup"
ONLINE_ITEM_RE = re.compile(
    r'title="Messages\.aspx\?ID=(\d+)"[^>]*>(.*?)</a>'
    r'.*?<span[^>]*class="inputdate"[^>]*>(\d{1,2}/\d{1,2}/\d{4})</span>',
    re.DOTALL,
)

AUTHOR_NAME = "Huynh Viet"
AUTHOR_FB_URL = "https://www.facebook.com/profile.php?id=61591547874181"

# 7 cổng HUB chính thức — Priority #1 = online.hub.edu.vn
SOURCES = [
    {
        "key": "online",
        "code": "onl",
        "name": "Online HUB",
        "short": "Online HUB",
        "emoji": "🏛️",
        "type": "asp_grid",
        "url": ONLINE_HOME,
        "base": "https://online.hub.edu.vn",
        "section": "",
        "priority": 1,
    },
    {
        "key": "ktdbcl",
        "code": "kt",
        "name": "Phòng Khảo thí & ĐBCL",
        "short": "Khảo thí & ĐBCL",
        "emoji": "📝",
        "type": "dnn_notif",
        "url": "https://phongktdbcl.hub.edu.vn/thong-bao",
        "base": "https://phongktdbcl.hub.edu.vn",
        "section": "thong-bao",
        "priority": 2,
    },
    {
        "key": "daotao",
        "code": "dt",
        "name": "Phòng Đào tạo",
        "short": "Phòng Đào tạo",
        "emoji": "🎓",
        "type": "dnn_notif",
        "url": "https://phongdaotao.hub.edu.vn/thong-bao",
        "base": "https://phongdaotao.hub.edu.vn",
        "section": "thong-bao",
        "priority": 3,
    },
    {
        "key": "daotao_news",
        "code": "dtn",
        "name": "Đào tạo · Tin & Thực tập",
        "short": "Đào tạo (Tin)",
        "emoji": "📰",
        "type": "dnn_pdt_home",
        "url": "https://phongdaotao.hub.edu.vn/",
        "base": "https://phongdaotao.hub.edu.vn",
        "section": "tin-tuc-su-kien",
        "priority": 4,
    },
    {
        "key": "scc",
        "code": "scc",
        "name": "Trung tâm SV (SCC)",
        "short": "Trung tâm SV",
        "emoji": "🤝",
        "type": "dnn_news",
        "url": "https://scc.hub.edu.vn/thong-bao",
        "base": "https://scc.hub.edu.vn",
        "section": "thong-bao",
        "priority": 5,
    },
    {
        "key": "hub",
        "code": "hub",
        "name": "Cổng Chính HUB",
        "short": "Cổng Chính HUB",
        "emoji": "🏫",
        "type": "dnn_notif",
        "url": "https://hub.edu.vn/thong-bao",
        "base": "https://hub.edu.vn",
        "section": "thong-bao",
        "priority": 6,
    },
    {
        "key": "ketoan",
        "code": "ktc",
        "name": "Tài chính - Kế toán",
        "short": "Tài chính - KT",
        "emoji": "💰",
        "type": "dnn_notif",
        "url": "https://phongketoan.hub.edu.vn/thong-bao",
        "base": "https://phongketoan.hub.edu.vn",
        "section": "thong-bao",
        "priority": 7,
    },
]

SOURCE_BY_KEY = {s["key"]: s for s in SOURCES}

BOT_COMMANDS = [
    {"command": "menu", "description": "Bảng điều khiển chính"},
    {"command": "online", "description": "Online HUB (Ưu tiên #1)"},
    {"command": "latest", "description": "Tin mới nhất (7 cổng HUB)"},
    {"command": "full7d", "description": "Thông báo 7 ngày gần nhất"},
    {"command": "full30d", "description": "Thông báo 30 ngày gần nhất"},
    {"command": "find", "description": "Tìm kiếm không dấu"},
    {"command": "thi", "description": "Lịch thi & Khảo thí"},
    {"command": "daotao", "description": "Phòng Đào tạo"},
    {"command": "scc", "description": "Trung tâm Sinh viên (SCC)"},
    {"command": "hocphi", "description": "Học phí & Tài chính"},
    {"command": "hocbong", "description": "Học bổng & Khen thưởng"},
    {"command": "digest", "description": "Tổng hợp theo chủ đề"},
    {"command": "portals", "description": "Tiện ích sinh viên HUB"},
    {"command": "status", "description": "Trạng thái 7 cổng HUB"},
    {"command": "notify", "description": "Bật / Tắt thông báo tự động"},
    {"command": "clear", "description": "Dọn lịch sử trò chuyện"},
    {"command": "author", "description": "Thông tin tác giả"},
    {"command": "help", "description": "Hướng dẫn nhanh"},
]

TELEGRAM_CHUNK = 3800


def log(msg):
    ts = datetime.datetime.now(VN_TZ).strftime("%H:%M:%S")
    print("[{}] {}".format(ts, msg), flush=True)


# ---------------------------------------------------------------- HTTP helpers

def _build_ssl_context():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


SSL_CTX = _build_ssl_context()


def _decode_body(raw_bytes, content_encoding):
    enc = (content_encoding or "").lower()
    if "gzip" in enc:
        try:
            raw_bytes = gzip.decompress(raw_bytes)
        except OSError:
            pass
    elif "deflate" in enc:
        try:
            raw_bytes = zlib.decompress(raw_bytes, -zlib.MAX_WBITS)
        except zlib.error:
            try:
                raw_bytes = zlib.decompress(raw_bytes)
            except zlib.error:
                pass
    return raw_bytes.decode("utf-8", "replace")


def fetch_http(url, data=None, cookie=None, timeout=18, retries=2):
    """GET/POST hỗ trợ gzip + retry nhanh (luân phiên / và /Default.aspx cho Online HUB)."""
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate",
    }
    if cookie:
        headers["Cookie"] = cookie
    body = None
    if data is not None:
        body = urllib.parse.urlencode(data).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"

    last_err = None
    for attempt in range(1, retries + 1):
        try:
            target = ONLINE_ALT if (attempt > 1 and url == ONLINE_HOME and data is None) else url
            req = urllib.request.Request(target, data=body, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as resp:
                raw = _decode_body(resp.read(), resp.headers.get("Content-Encoding", ""))
                sc = resp.headers.get("Set-Cookie", "")
                sess = sc.split(";")[0].strip() if sc else ""
                return raw, sess, resp.geturl()
        except Exception as e:  # noqa: BLE001
            last_err = e
            if attempt < retries:
                time.sleep(0.8 * attempt)
    raise last_err


# ---------------------------------------------------------------- Text & Classification

def clean_text(raw):
    text = re.sub(r"<[^>]+>", " ", raw or "")
    text = html_lib.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def escape_html(text):
    return html_lib.escape(str(text or ""), quote=False)


def strip_accents(text):
    s = (text or "").replace("đ", "d").replace("Đ", "D")
    s = unicodedata.normalize("NFD", s)
    return "".join(ch for ch in s if unicodedata.category(ch) != "Mn")


def normalize_title_key(title):
    s = strip_accents(title).lower()
    s = re.sub(r"^(?:thong\s+bao|tb)\s*(?:so\s+\S+\s*)?(?:ngay\s+\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\s*)?(?:v/v|ve\s+viec)?\s*", "", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def parse_date(text):
    text = (text or "").strip()
    for fmt in ("%d/%m/%Y", "%d.%m.%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def is_urgent_title(title):
    s = strip_accents(title).lower()
    urgent_kw = [
        "huy hoc phan", "canh bao", "han cuoi", "khan", "bo sung",
        "vi pham", "vang thi", "kiem do", "tam ngung", "lua dao",
        "bat buoc", "thoi hoc",
    ]
    return any(k in s for k in urgent_kw)


def classify_item(title, source_key=""):
    s = strip_accents(title).lower()
    if any(k in s for k in [
        "lich thi", "phuc khao", "vang thi", "xoa diem", "diem i",
        "exam.hub", "quy che thi", "danh gia nang luc", "thi ket thuc",
        "khao thi", "bang diem",
    ]) or source_key == "ktdbcl":
        return {"key": "exam", "icon": "📝", "label": "Lịch thi & Khảo thí", "tag": "#LichThi"}

    if any(k in s for k in [
        "hoc phi", "mien, giam", "mien giam", "cong no", "le phi",
        "ho tro chi phi", "tro cap xa hoi", "thu phi",
    ]) or source_key == "ketoan":
        return {"key": "tuition", "icon": "💰", "label": "Học phí & Tài chính", "tag": "#HocPhi"}

    if any(k in s for k in [
        "hoc bong", "khen thuong", "sinh vien 5 tot", "tuyen duong",
        "cuoc thi", "giai thuong", "finhack",
    ]):
        return {"key": "scholar", "icon": "🏆", "label": "Học bổng & Giải thưởng", "tag": "#HocBong"}

    if any(k in s for k in [
        "tot nghiep", "thuc tap", "khoa luan", "do an", "phat bang",
        "in bang", "trao bang", "chuan dau ra", "van bang",
    ]):
        return {"key": "grad", "icon": "🎓", "label": "Tốt nghiệp & Thực tập", "tag": "#TotNghiep"}

    if any(k in s for k in [
        "dang ky", "hoc phan", "huy hoc phan", "thoi khoa bieu",
        "ke hoach", "tin chi", "hoc ghep", "gia han", "canh bao hoc vu",
        "thoi hoc", "cam nang", "ren luyen",
    ]):
        return {"key": "reg", "icon": "📋", "label": "Đào tạo & Học phần", "tag": "#DaoTao"}

    if any(k in s for k in [
        "ngoai tru", "the sinh vien", "tham quan", "kien tap", "huy dong",
        "toa dam", "hoi thao", "tuyen dung", "viec lam", "doan", "tu van",
        "thu moi",
    ]) or source_key == "scc":
        return {"key": "student", "icon": "🤝", "label": "Sinh viên & Sự kiện", "tag": "#SinhVien"}

    return {"key": "general", "icon": "📌", "label": "Thông báo HUB", "tag": "#ThongBaoHUB"}


DEADLINE_RE = re.compile(
    r"(?:hạn\s+cuối|trước\s+ngày|đến\s+hết\s+ngày|chậm\s+nhất|hạn\s+nộp|thời\s+hạn|"
    r"từ\s+ngày\s+\d{1,2}[/\.-]\d{1,2}(?:[/\.-]\d{2,4})?\s+đến(?:\s+hết)?\s+ngày)"
    r"[^.\n;]{0,65}?(?<!\d)\d{1,2}[/\.-]\d{1,2}(?:[/\.-]\d{2,4})?(?!\d)",
    re.IGNORECASE,
)


def extract_deadline(text):
    if not text:
        return ""
    m = DEADLINE_RE.search(text)
    if not m:
        return ""
    return re.sub(r"\s+", " ", m.group(0)).strip(" ,;:-")[:90]


# ---------------------------------------------------------------- Parsers per Portal

def get_hidden_fields(html_text):
    fields = {}
    for m in re.finditer(r'<input[^>]+type="hidden"[^>]*>', html_text, re.I):
        tag = m.group(0)
        nm = re.search(r'name="([^"]+)"', tag, re.I)
        vm = re.search(r'value="([^"]*)"', tag, re.I)
        if nm:
            fields[nm.group(1)] = html_lib.unescape(vm.group(1)) if vm else ""
    return fields


ONL_LINK_RE = re.compile(r'^(\d+)"[^>]*>(.*?)</a>', re.S)
ONL_DATE_RE = re.compile(r'class="inputdate"[^>]*>(\d{1,2}/\d{1,2}/\d{4})<')
DNN_NOTIF_DAY_RE = re.compile(r'<span class="day">(\d{1,2})</span>\s*<span class="month-year">(\d{1,2})\.(\d{4})</span>')
DNN_NEWS_DATE_RE = re.compile(r'<p class="news-date">(\d{1,2}/\d{1,2}/\d{4})</p>')
DNN_LINK_RE = re.compile(r'<h3 class="news-title">\s*<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', re.S)


def parse_online_items(page_html):
    idx = page_html.find('title="Messages.aspx?ID=')
    if idx < 0:
        return []
    last_idx = page_html.rfind('title="Messages.aspx?ID=')
    chunk = page_html[idx:min(len(page_html), last_idx + 1600)]
    items = []
    seen = set()
    for seg in chunk.split('title="Messages.aspx?ID=')[1:]:
        lm = ONL_LINK_RE.search(seg)
        if not lm:
            continue
        dm = ONL_DATE_RE.search(seg)
        if not dm:
            continue
        msg_id = lm.group(1)
        if msg_id in seen:
            continue
        title = clean_text(lm.group(2))
        dt = parse_date(dm.group(1))
        if title and dt:
            seen.add(msg_id)
            items.append({
                "id": msg_id,
                "source": "online",
                "code": "onl",
                "title": title,
                "date": dt.strftime("%d/%m/%Y"),
                "date_dt": dt,
                "url": "https://online.hub.edu.vn/Messages.aspx?id={}".format(msg_id),
            })
    return items


def _extract_dnn_id(url):
    m = re.search(r"-(\d+)\.html", url or "")
    if m:
        return m.group(1)
    return str(abs(hash(url)))[:10]


def parse_dnn_notif(page_html, src):
    start = page_html.find('<div class="notification-list mt-8">')
    if start >= 0:
        end = page_html.find("</section>", start)
        chunk = page_html[start:end] if end > start else page_html[start:]
    else:
        chunk = page_html
    items = []
    seen_ids = set()
    for seg in chunk.split('<div class="notification-item">')[1:]:
        dm = DNN_NOTIF_DAY_RE.search(seg)
        if not dm:
            continue
        lm = DNN_LINK_RE.search(seg)
        if not lm:
            continue
        href = html_lib.unescape(lm.group(1)).strip()
        if href.startswith("/"):
            href = src["base"] + href
        iid = _extract_dnn_id(href)
        if iid in seen_ids:
            continue
        title = clean_text(lm.group(2))
        dt = parse_date("{}/{}/{}".format(dm.group(1).zfill(2), dm.group(2).zfill(2), dm.group(3)))
        if title and dt:
            seen_ids.add(iid)
            items.append({
                "id": iid,
                "source": src["key"],
                "code": src["code"],
                "title": title,
                "date": dt.strftime("%d/%m/%Y"),
                "date_dt": dt,
                "url": href,
            })
    return items


def parse_dnn_news(page_html, src):
    if src["type"] == "dnn_pdt_home":
        chunk = page_html
    else:
        start = page_html.find('<div class="news-list mt-8">')
        if start >= 0:
            end = page_html.find("</section>", start)
            chunk = page_html[start:end] if end > start else page_html[start:]
        else:
            chunk = page_html

    items = []
    seen_ids = set()
    for seg in chunk.split('<div class="news-item">')[1:]:
        dm = DNN_NEWS_DATE_RE.search(seg)
        if not dm:
            continue
        lm = DNN_LINK_RE.search(seg)
        if not lm:
            continue
        href = html_lib.unescape(lm.group(1)).strip()
        if href.startswith("/"):
            href = src["base"] + href
        iid = _extract_dnn_id(href)
        if iid in seen_ids:
            continue
        title = clean_text(lm.group(2))
        dt = parse_date(dm.group(1))
        if title and dt:
            seen_ids.add(iid)
            code = src["code"]
            if src["key"] == "daotao_news" and "/xet-tot-nghiep/" in href:
                code = "dtt"
            items.append({
                "id": iid,
                "source": src["key"],
                "code": code,
                "title": title,
                "date": dt.strftime("%d/%m/%Y"),
                "date_dt": dt,
                "url": href,
            })
    return items


def fetch_source_items(src, max_pages=1):
    stype = src["type"]
    is_online = src["key"] == "online"
    html, cookie, _ = fetch_http(
        src["url"],
        timeout=12 if is_online else 18,
        retries=3 if is_online else 2,
    )
    if stype == "asp_grid":
        items = parse_online_items(html)
        if max_pages > 1 and items:
            fields = get_hidden_fields(html)
            for page in range(2, max_pages + 1):
                try:
                    p_data = dict(fields)
                    p_data["__EVENTTARGET"] = ONLINE_GRID_TARGET
                    p_data["__EVENTARGUMENT"] = "Page${}".format(page)
                    p_html, _, _ = fetch_http(ONLINE_HOME, data=p_data, cookie=cookie, timeout=12, retries=1)
                    fields = get_hidden_fields(p_html)
                    p_items = parse_online_items(p_html)
                    if not p_items:
                        break
                    items.extend(p_items)
                except Exception as e:  # noqa: BLE001
                    log("Lỗi phân trang {} trang {}: {}".format(src["key"], page, e))
                    break
        return items, html, cookie

    if stype == "dnn_notif":
        items = parse_dnn_notif(html, src)
        for page in range(2, max_pages + 1):
            try:
                p_html, _, _ = fetch_http("{}?trang={}".format(src["url"], page))
                p_items = parse_dnn_notif(p_html, src)
                if not p_items:
                    break
                items.extend(p_items)
            except Exception:  # noqa: BLE001
                break
        return items, html, ""

    if stype in ("dnn_news", "dnn_pdt_home"):
        items = parse_dnn_news(html, src)
        if stype == "dnn_news":
            for page in range(2, max_pages + 1):
                try:
                    p_html, _, _ = fetch_http("{}?trang={}".format(src["url"], page))
                    p_items = parse_dnn_news(p_html, src)
                    if not p_items:
                        break
                    items.extend(p_items)
                except Exception:  # noqa: BLE001
                    break
        items.sort(key=lambda x: x["date_dt"], reverse=True)
        return items, html, ""

    return [], html, ""


# ---------------------------------------------------------------- Detail & PDF Enricher

def enrich_item(item, online_home_html=None, online_cookie=None):
    info = {"pdfs": [], "downloads": [], "sender": "", "deadline": "", "summary": ""}
    info["deadline"] = extract_deadline(item.get("title", ""))

    try:
        if item["source"] == "online":
            cj = http.cookiejar.CookieJar()
            opener = urllib.request.build_opener(
                urllib.request.HTTPCookieProcessor(cj),
                urllib.request.HTTPSHandler(context=SSL_CTX),
            )
            opener.addheaders = [
                ("User-Agent", USER_AGENT),
                ("Accept-Language", "vi-VN,vi;q=0.9,en;q=0.8"),
                ("Accept-Encoding", "gzip, deflate"),
            ]
            msg_url = "https://online.hub.edu.vn/Messages.aspx?id={}".format(item["id"])
            with opener.open(msg_url, timeout=14) as resp:
                d_html = _decode_body(resp.read(), resp.headers.get("Content-Encoding", ""))

            m_sender = re.search(r'id="[^"]*lblSenderName"[^>]*>(.*?)</span>', d_html, re.S | re.I)
            if m_sender:
                info["sender"] = clean_text(m_sender.group(1))

            m_body = re.search(r'id="[^"]*lblMessageBody"[^>]*>(.*?)</span>', d_html, re.S | re.I)
            body_html = m_body.group(1) if m_body else ""
            for am in re.finditer(r'href="([^"]+)"', body_html, re.I):
                href = html_lib.unescape(am.group(1)).strip()
                if not href or href.startswith("javascript:") or href.startswith("#"):
                    continue
                if href.startswith("/"):
                    href = "https://online.hub.edu.vn" + href
                if re.search(r"\.(?:pdf|docx?|xlsx?|zip|rar)(?:\?|$)", href, re.I):
                    if href not in info["pdfs"]:
                        info["pdfs"].append(href)
                elif re.match(r"^https?://", href, re.I) and "extra_url" not in info:
                    info["extra_url"] = href
            body_text = clean_text(body_html)
            if body_text:
                info["summary"] = body_text[:260]
                if not info["deadline"]:
                    info["deadline"] = extract_deadline(body_text)
            return info

        d_html, _, _ = fetch_http(item["url"], timeout=16, retries=1)
        src = SOURCE_BY_KEY.get(item["source"], {})
        base = src.get("base", "https://hub.edu.vn")

        fc = re.search(
            r'<div class="full-content">(.*?)<div class="(?:attach|news-tags|social|share|box-new-notification)',
            d_html, re.S | re.I,
        )
        body_html = fc.group(1) if fc else ""

        for pm in re.finditer(r'(https?://[^\s"\'<>]+\.(?:pdf|docx?|xlsx?|zip|rar))', body_html, re.I):
            u = html_lib.unescape(pm.group(1))
            if u not in info["pdfs"]:
                info["pdfs"].append(u)

        for dm in re.finditer(r'download\(["\']([^"\']+)["\']\)', d_html):
            dl_url = "{}/taifiledinhkem/tai-file-{}".format(base, dm.group(1))
            if dl_url not in info["downloads"]:
                info["downloads"].append(dl_url)

        body_clean = re.sub(r'<div class="attach".*$', "", body_html, flags=re.S | re.I)
        body_clean = re.sub(r'<table[^>]*filedinhkem_table.*?</table>', "", body_clean, flags=re.S | re.I)
        body_text = clean_text(body_clean)
        body_text = re.sub(r"\bFile đính kèm\b.*$", "", body_text).strip()
        if len(body_text) > 25:
            info["summary"] = body_text[:260]
            if not info["deadline"]:
                info["deadline"] = extract_deadline(body_text)
    except Exception as e:  # noqa: BLE001
        log("Không enrich được {}#{}: {}".format(item["source"], item["id"], e))
    return info


# ---------------------------------------------------------------- Telegram API

def telegram_api_call(token, method, payload, retries=3):
    url = "https://api.telegram.org/bot{}/{}".format(token, method)
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(
                url, data=body, method="POST",
                headers={"Content-Type": "application/json; charset=utf-8"},
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8", "replace"))
            if data.get("ok"):
                return data
            if data.get("error_code") == 429:
                wait = int((data.get("parameters") or {}).get("retry_after", 5 * attempt))
                time.sleep(wait)
                continue
            log("Telegram {} lỗi: {}".format(method, data.get("description", "unknown")))
            return None
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries:
                time.sleep(5 * attempt)
                continue
            if attempt < retries and e.code >= 500:
                time.sleep(3 * attempt)
                continue
            log("Telegram {} HTTP {}".format(method, e.code))
            return None
        except Exception as e:  # noqa: BLE001
            log("Lỗi Telegram {} (lần {}): {}".format(method, attempt, e))
            if attempt < retries:
                time.sleep(3 * attempt)
    return None


def telegram_send(token, chat_id, text, reply_markup=None, parse_mode="HTML"):
    payload = {
        "chat_id": chat_id,
        "text": text,
        "disable_web_page_preview": True,
    }
    if parse_mode:
        payload["parse_mode"] = parse_mode
    if reply_markup:
        payload["reply_markup"] = reply_markup
    res = telegram_api_call(token, "sendMessage", payload)
    return bool(res and res.get("ok"))


def setup_bot_ui(token):
    r1 = telegram_api_call(token, "setMyCommands", {"commands": BOT_COMMANDS})
    r2 = telegram_api_call(token, "setChatMenuButton", {"menu_button": {"type": "commands"}})
    ok = bool(r1 and r2)
    log("Đăng ký Bot Menu & Commands: {}".format("THÀNH CÔNG" if ok else "THẤT BẠI"))
    return ok


def telegram_get_updates(token, offset):
    params = urllib.parse.urlencode({
        "offset": offset,
        "timeout": 0,
        "allowed_updates": '["message"]',
    })
    url = "https://api.telegram.org/bot{}/getUpdates?{}".format(token, params)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = json.loads(resp.read().decode("utf-8", "replace"))
        if data.get("ok"):
            return data.get("result", [])
    except urllib.error.HTTPError as e:
        if e.code == 409:
            return []
        log("Lỗi getUpdates: {}".format(e))
    except Exception as e:  # noqa: BLE001
        log("Lỗi getUpdates: {}".format(e))
    return []


# ---------------------------------------------------------------- Minimalist UI Cards

def build_main_menu_markup():
    return {
        "inline_keyboard": [
            [{"text": "🏛️ Online HUB · Tin mới nhất", "callback_data": "src:online:1"}],
            [
                {"text": "🔥 Tất cả cổng", "callback_data": "list:all:latest:1"},
                {"text": "📅 7 ngày", "callback_data": "list:all:7:1"},
            ],
            [
                {"text": "🗓️ 30 ngày", "callback_data": "list:all:30:1"},
                {"text": "🏢 7 cổng HUB", "callback_data": "m:portals"},
            ],
            [
                {"text": "🏷️ Chủ đề", "callback_data": "m:topics"},
                {"text": "🔎 Tìm kiếm", "callback_data": "m:search"},
            ],
            [
                {"text": "📰 Tổng hợp", "callback_data": "digest:7"},
                {"text": "🔗 Tiện ích", "callback_data": "m:links"},
            ],
            [
                {"text": "📊 Trạng thái", "callback_data": "status"},
                {"text": "👤 Tác giả", "callback_data": "m:author"},
            ],
            [
                {"text": "❓ Trợ giúp", "callback_data": "m:help"},
                {"text": "🧹 Dọn chat", "callback_data": "clear:ask"},
            ],
        ]
    }


def build_main_menu_text():
    now_vn = datetime.datetime.now(VN_TZ).strftime("%H:%M · %d/%m/%Y")
    return (
        "<b>HUB Monitor</b>\n"
        "{}\n"
        "🟢 Trực tuyến · <code>{}</code>\n"
        'Tác giả: <a href="{}">{}</a>'
    ).format(LINE, now_vn, AUTHOR_FB_URL, AUTHOR_NAME)


def build_notification_card(item, extra_sources=None, detail=None, is_test=False):
    cat = classify_item(item["title"], item["source"])
    urgent = is_urgent_title(item["title"])
    src = SOURCE_BY_KEY.get(item["source"], {"emoji": "🏛️", "name": item["source"], "short": item["source"]})

    head_icon = "🚨" if urgent else cat["icon"]
    status_pill = "<b>KIỂM TRA</b>" if is_test else "<b>TIN MỚI</b>"
    badges = [status_pill, "<code>{}</code>".format(cat["tag"])]
    if urgent:
        badges.append("<b>LƯU Ý</b>")

    source_names = ["{} {}".format(src["emoji"], src["name"])]
    if extra_sources:
        for es in extra_sources:
            es_cfg = SOURCE_BY_KEY.get(es)
            if es_cfg and es != item["source"]:
                source_names.append("{} {}".format(es_cfg["emoji"], es_cfg["short"]))

    lines = [
        "{} <b>{}</b>".format(head_icon, escape_html(item["title"])),
        " · ".join(badges),
        LINE,
        "Nguồn: {}".format(escape_html(" · ".join(source_names))),
        "Ngày: <code>{}</code>".format(escape_html(item["date"])),
    ]

    pdfs = (detail or {}).get("pdfs", [])
    downloads = (detail or {}).get("downloads", [])
    sender = (detail or {}).get("sender", "")
    deadline = (detail or {}).get("deadline", "")
    summary = (detail or {}).get("summary", "")

    if sender:
        lines.append("Đơn vị: {}".format(escape_html(sender)))
    if deadline:
        lines.append("Hạn: <b>{}</b>".format(escape_html(deadline)))

    att_parts = []
    if pdfs:
        att_parts.append("{} PDF".format(len(pdfs)))
    if downloads:
        att_parts.append("{} tệp".format(len(downloads)))
    if att_parts:
        lines.append("Đính kèm: {}".format(" · ".join(att_parts)))

    if summary and len(summary) > 30 and not summary.lower().startswith("sv xem chi tiết"):
        preview = summary[:170] + ("..." if len(summary) > 170 else "")
        lines.append("")
        lines.append(escape_html(preview))

    keyboard = []
    cb_view = "v:{}:{}".format(item["code"], item["id"])
    if len(cb_view.encode("utf-8")) <= 64:
        hero_label = "📄 Xem chi tiết & PDF" if (pdfs or downloads) else "📄 Đọc nhanh"
        keyboard.append([{"text": hero_label, "callback_data": cb_view}])

    row2 = []
    if pdfs:
        row2.append({"text": "📥 Mở PDF", "url": pdfs[0]})
    elif downloads:
        row2.append({"text": "📦 Tải tệp", "url": downloads[0]})
    elif (detail or {}).get("extra_url"):
        row2.append({"text": "🔗 Chi tiết", "url": detail["extra_url"]})
    else:
        row2.append({"text": "{} {}".format(src["emoji"], src["short"]), "callback_data": "src:{}:1".format(item["source"])})
    row2.append({"text": "🌐 Mở web", "url": item["url"]})
    keyboard.append(row2)

    keyboard.append([
        {"text": "🔥 Tất cả cổng", "callback_data": "list:all:latest:1"}
        if item["source"] == "online"
        else {"text": "🏛️ Online HUB", "callback_data": "src:online:1"},
        {"text": "📌 Menu", "callback_data": "m:home"},
    ])

    return "\n".join(lines), {"inline_keyboard": keyboard}


def format_list_html(header, items, limit=15):
    if not items:
        return [header + "\n\nChưa có thông báo phù hợp."]
    shown = items[:limit]
    lines = ["<b>{}</b> ({} tin)".format(escape_html(header), len(items)), LINE]
    for i, it in enumerate(shown, 1):
        src = SOURCE_BY_KEY.get(it["source"], {"emoji": "📌", "short": it["source"]})
        cat = classify_item(it["title"], it["source"])
        title = it["title"][:97] + "..." if len(it["title"]) > 100 else it["title"]
        lines.append("")
        lines.append('<b>{}.</b> {} <a href="{}">{}</a>'.format(
            i, cat["icon"], escape_html(it["url"]), escape_html(title)
        ))
        lines.append("   {} · <code>{}</code>".format(escape_html(src["short"]), escape_html(it["date"])))
    if len(items) > limit:
        lines.append("\n+{} tin khác · Dùng /menu để xem theo trang.".format(len(items) - limit))

    chunks = []
    cur = ""
    for line in lines:
        if cur and len(cur) + len(line) + 1 > TELEGRAM_CHUNK:
            chunks.append(cur)
            cur = line
        else:
            cur = cur + "\n" + line if cur else line
    if cur:
        chunks.append(cur)
    return chunks


# ---------------------------------------------------------------- Multi-Portal Aggregator

def fetch_all_sources(max_pages_online=1):
    results = {}
    meta = {}

    def _worker(src):
        t0 = time.time()
        try:
            mp = max_pages_online if src["type"] == "asp_grid" else 1
            items, raw_html, cookie = fetch_source_items(src, max_pages=mp)
            return src["key"], items, {
                "ok": True,
                "ms": int((time.time() - t0) * 1000),
                "count": len(items),
                "html": raw_html if src["key"] == "online" else "",
                "cookie": cookie if src["key"] == "online" else "",
            }
        except Exception as e:  # noqa: BLE001
            log("Lỗi quét cổng {}: {}".format(src["key"], e))
            return src["key"], [], {
                "ok": False,
                "ms": int((time.time() - t0) * 1000),
                "error": str(e),
                "count": 0,
            }

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        futs = [ex.submit(_worker, s) for s in SOURCES]
        for f in futs:
            k, its, m = f.result()
            results[k] = its
            meta[k] = m

    return results, meta


def merge_and_dedupe_items(results_by_source, days=None):
    today = datetime.datetime.now(VN_TZ).date()
    cutoff = today - datetime.timedelta(days=days) if days is not None else None
    ordered_keys = [s["key"] for s in sorted(SOURCES, key=lambda x: x["priority"])]

    by_fp = {}
    ordered = []
    for k in ordered_keys:
        for it in results_by_source.get(k, []):
            if cutoff and it["date_dt"] < cutoff:
                continue
            fp = normalize_title_key(it["title"])
            if fp and fp in by_fp:
                existing = by_fp[fp]
                if existing["source"] != k and abs((it["date_dt"] - existing["date_dt"]).days) <= 14:
                    if k not in existing.setdefault("also_in", []):
                        existing["also_in"].append(k)
                    if it["date_dt"] > existing["date_dt"]:
                        existing["date_dt"] = it["date_dt"]
                        existing["date"] = it["date"]
                    continue
            copy_it = dict(it)
            copy_it["also_in"] = []
            if fp and fp not in by_fp:
                by_fp[fp] = copy_it
            ordered.append(copy_it)

    ordered.sort(key=lambda x: (x["date_dt"], -SOURCE_BY_KEY.get(x["source"], {"priority": 99})["priority"]), reverse=True)
    return ordered


# ---------------------------------------------------------------- Fallback Polling Commands

def handle_commands(token, state, results_by_source):
    offset = int(state.get("telegram_offset", 0) or 0)
    updates = telegram_get_updates(token, offset)
    if not updates:
        return
    max_id = offset
    all_items = merge_and_dedupe_items(results_by_source)

    for u in updates:
        uid = int(u.get("update_id", 0))
        max_id = max(max_id, uid)
        msg = u.get("message") or {}
        text = (msg.get("text") or "").strip()
        cid = (msg.get("chat") or {}).get("id")
        if not cid or not text:
            continue

        cmd = text.split()[0].split("@")[0].lower() if text.startswith("/") else ""
        arg = text[len(text.split()[0]):].strip() if text.startswith("/") else text

        try:
            if cmd in ("/start", "/menu"):
                telegram_send(token, cid, build_main_menu_text(), reply_markup=build_main_menu_markup())
            elif cmd == "/online":
                its = results_by_source.get("online", [])
                for chunk in format_list_html("🏛️ Online HUB", its[:15]):
                    telegram_send(token, cid, chunk)
            elif cmd in ("/latest", "/update"):
                for chunk in format_list_html("🔥 Tin mới nhất · HUB", all_items[:15]):
                    telegram_send(token, cid, chunk, reply_markup={"inline_keyboard": [[{"text": "📌 Menu", "callback_data": "m:home"}]]})
            elif cmd == "/full7d":
                its = merge_and_dedupe_items(results_by_source, days=7)
                for chunk in format_list_html("📅 Thông báo 7 ngày", its):
                    telegram_send(token, cid, chunk)
            elif cmd == "/full30d":
                its = merge_and_dedupe_items(results_by_source, days=30)
                for chunk in format_list_html("🗓️ Thông báo 30 ngày", its):
                    telegram_send(token, cid, chunk)
            elif cmd == "/thi":
                its = [it for it in all_items if classify_item(it["title"], it["source"])["key"] == "exam"]
                for chunk in format_list_html("📝 Lịch thi & Khảo thí", its[:15]):
                    telegram_send(token, cid, chunk)
            elif cmd == "/daotao":
                its = [it for it in all_items if it["source"] in ("daotao", "daotao_news")]
                for chunk in format_list_html("🎓 Phòng Đào tạo", its[:15]):
                    telegram_send(token, cid, chunk)
            elif cmd == "/scc":
                its = [it for it in all_items if it["source"] == "scc"]
                for chunk in format_list_html("🤝 Trung tâm SV (SCC)", its[:15]):
                    telegram_send(token, cid, chunk)
            elif cmd == "/hocphi":
                its = [it for it in all_items if classify_item(it["title"], it["source"])["key"] == "tuition"]
                for chunk in format_list_html("💰 Học phí & Tài chính", its[:15]):
                    telegram_send(token, cid, chunk)
            elif cmd == "/hocbong":
                its = [it for it in all_items if classify_item(it["title"], it["source"])["key"] == "scholar"]
                for chunk in format_list_html("🏆 Học bổng", its[:15]):
                    telegram_send(token, cid, chunk)
            elif cmd in ("/author", "/about"):
                telegram_send(
                    token, cid,
                    "<b>Tác giả</b>\n{}\n👤 <b>{}</b>\n🤖 HUB Monitor · Tự động cập nhật thông báo HUB 24/7".format(LINE, AUTHOR_NAME),
                    reply_markup={"inline_keyboard": [
                        [{"text": "📘 Facebook · {}".format(AUTHOR_NAME), "url": AUTHOR_FB_URL}],
                        [{"text": "⬅️ Menu", "callback_data": "m:home"}],
                    ]},
                )
            elif cmd == "/clear":
                mid = msg.get("message_id")
                if mid:
                    cnt = min(max(10, int(arg) if arg.isdigit() else 100), 300)
                    start_id = max(1, mid - cnt + 1)
                    for end in range(mid, start_id - 1, -100):
                        beg = max(start_id, end - 99)
                        telegram_api_call(token, "deleteMessages", {"chat_id": cid, "message_ids": list(range(beg, end + 1))})
                telegram_send(
                    token, cid,
                    "🧹 <b>Đã dọn lịch sử gần đây.</b>",
                    reply_markup={"inline_keyboard": [[{"text": "📌 Menu", "callback_data": "m:home"}, {"text": "🗑️ Ẩn", "callback_data": "del:self"}]]},
                )
            elif cmd == "/find" or not cmd:
                kw = arg.strip()
                if not kw:
                    telegram_send(token, cid, "🔎 Nhập từ khoá: <code>/find hoc bong</code>")
                else:
                    kw_n = strip_accents(kw).lower()
                    found = [it for it in all_items if kw_n in strip_accents(it["title"]).lower()]
                    for chunk in format_list_html('🔎 "{}"'.format(kw), found[:15]):
                        telegram_send(token, cid, chunk)
            else:
                telegram_send(token, cid, build_main_menu_text(), reply_markup=build_main_menu_markup())
        except Exception as e:  # noqa: BLE001
            log("Lỗi xử lý lệnh '{}': {}".format(text, e))
    state["telegram_offset"] = max_id + 1


# ---------------------------------------------------------------- State & Config

def load_state():
    default = {
        "seen": {},
        "sources": {},
        "seen_titles": {},
        "telegram_offset": 0,
        "bot_ui_version": 0,
    }
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8-sig") as f:
                data = json.load(f)
            if isinstance(data, dict):
                data.setdefault("seen", {})
                data.setdefault("sources", {})
                data.setdefault("seen_titles", {})
                data.setdefault("telegram_offset", 0)
                data.setdefault("bot_ui_version", 0)
                if data["seen"] and "online" not in data["sources"]:
                    data["sources"]["online"] = dict(data["seen"])
                return data
        except (ValueError, OSError):
            pass
    return default


def save_state(state):
    tmp = STATE_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    os.replace(tmp, STATE_FILE)


def get_config():
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_ids_raw = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    worker_url = os.environ.get("WORKER_URL", "").strip().rstrip("/")

    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8-sig") as f:
                cfg = json.load(f)
            token = token or str(cfg.get("telegram_bot_token", "")).strip()
            chat_ids_raw = chat_ids_raw or str(cfg.get("telegram_chat_id", "")).strip()
            worker_url = worker_url or str(cfg.get("worker_url", "")).strip().rstrip("/")
        except (ValueError, OSError):
            pass

    chat_ids = [c.strip() for c in chat_ids_raw.split(",") if c.strip()]
    return token, chat_ids, worker_url


def fetch_kv_subscribers(token, worker_url):
    if not token or not worker_url:
        return []
    try:
        auth = hashlib.sha256("{}:subscribers".format(token).encode("utf-8")).hexdigest()
        req = urllib.request.Request(
            worker_url + "/api/subscribers",
            headers={"User-Agent": USER_AGENT, "X-Hub-Auth": auth},
        )
        with urllib.request.urlopen(req, timeout=15, context=SSL_CTX) as resp:
            data = json.loads(resp.read().decode("utf-8", "replace"))
        if data.get("ok") and isinstance(data.get("chat_ids"), list):
            return [str(x).strip() for x in data["chat_ids"] if str(x).strip()]
    except Exception as e:  # noqa: BLE001
        log("Không lấy được subscribers từ Worker: {}".format(e))
    return []


def prune_seen_dict(d, max_items=250):
    if len(d) <= max_items:
        return d

    def _sort_key(k):
        dt = parse_date(str(d.get(k, "")))
        return dt.toordinal() if dt else 0

    keep = sorted(d.keys(), key=_sort_key, reverse=True)[:max_items]
    return {k: d[k] for k in keep}


def prune_seen_titles(seen_titles, keep_days=30):
    today = datetime.datetime.now(VN_TZ).date()
    cutoff = (today - datetime.timedelta(days=keep_days)).strftime("%Y-%m-%d")
    return {
        fp: meta for fp, meta in seen_titles.items()
        if isinstance(meta, dict) and meta.get("at", "") >= cutoff
    }


# ---------------------------------------------------------------- Main Monitor Loop

def main():
    args = sys.argv[1:]
    do_test = "--test" in args
    notify_first = "--notify-first" in args
    do_setup = "--setup-bot" in args
    dry_run = "--dry-run" in args

    token, admin_chat_ids, worker_url = get_config()
    state = load_state()

    if do_setup:
        if not token:
            log("LỖI: Chưa có TELEGRAM_BOT_TOKEN.")
            sys.exit(1)
        setup_bot_ui(token)
        state["bot_ui_version"] = BOT_UI_VERSION
        if not dry_run:
            save_state(state)
        return

    if token and not dry_run and int(state.get("bot_ui_version", 0) or 0) < BOT_UI_VERSION:
        if setup_bot_ui(token):
            state["bot_ui_version"] = BOT_UI_VERSION

    log("Bắt đầu quét song song {} cổng HUB (ưu tiên Online HUB #1)...".format(len(SOURCES)))
    results, meta = fetch_all_sources(max_pages_online=1)

    ok_sources = [k for k, m in meta.items() if m.get("ok") and m.get("count", 0) > 0]
    for k, m in meta.items():
        status = "OK ({} tin, {}ms)".format(m.get("count", 0), m.get("ms", 0)) if m.get("ok") else "LỖI ({})".format(m.get("error", ""))
        log("  • {:12s}: {}".format(k, status))

    if not ok_sources:
        log("LỖI NGHIÊM TRỌNG: Không thể lấy dữ liệu từ bất kỳ cổng HUB nào!")
        sys.exit(1)

    if token and not dry_run and os.environ.get("SKIP_COMMANDS", "").strip() != "1":
        handle_commands(token, state, results)

    sources_state = state.setdefault("sources", {})
    active_keys = set(SOURCE_BY_KEY.keys())
    for old_key in [k for k in list(sources_state.keys()) if k not in active_keys]:
        del sources_state[old_key]

    seen_titles = prune_seen_titles(state.get("seen_titles", {}))
    today_iso = datetime.datetime.now(VN_TZ).strftime("%Y-%m-%d")

    online_html = (meta.get("online") or {}).get("html", "")
    online_cookie = (meta.get("online") or {}).get("cookie", "")

    ordered_keys = [s["key"] for s in sorted(SOURCES, key=lambda x: x["priority"])]
    candidates = []

    for skey in ordered_keys:
        items = results.get(skey, [])
        if not items:
            continue
        src_seen = sources_state.get(skey)
        is_first_for_source = not isinstance(src_seen, dict) or len(src_seen) == 0

        if is_first_for_source:
            log("Cổng '{}' chạy lần đầu: ghi mốc {} tin.".format(skey, len(items)))
            sources_state[skey] = {it["id"]: it["date"] for it in items}
            for it in items:
                fp = normalize_title_key(it["title"])
                if fp and fp not in seen_titles:
                    seen_titles[fp] = {"source": skey, "date": it["date"], "at": today_iso}
            if notify_first:
                candidates.extend(items[:3])
            continue

        new_for_src = [it for it in items if it["id"] not in src_seen]
        if new_for_src:
            log("Phát hiện {} tin mới từ '{}'!".format(len(new_for_src), skey))
            candidates.extend(new_for_src)

    batch_by_fp = {}
    to_notify = []
    for it in candidates:
        fp = normalize_title_key(it["title"])
        if fp and fp in seen_titles and not notify_first:
            sources_state.setdefault(it["source"], {})[it["id"]] = it["date"]
            continue
        if fp and fp in batch_by_fp:
            primary = batch_by_fp[fp]
            primary["extra_sources"].append(it["source"])
            primary["all_refs"].append((it["source"], it["id"], it["date"]))
            continue
        entry = {
            "item": it,
            "fp": fp,
            "extra_sources": [],
            "all_refs": [(it["source"], it["id"], it["date"])],
        }
        if fp:
            batch_by_fp[fp] = entry
        to_notify.append(entry)

    kv_subs = fetch_kv_subscribers(token, worker_url) if (to_notify and token and worker_url and not dry_run) else []
    broadcast_chat_ids = list(dict.fromkeys(admin_chat_ids + kv_subs))

    can_send = bool(token and broadcast_chat_ids and not dry_run)
    sent_count = 0

    for entry in reversed(to_notify):
        it = entry["item"]
        detail = enrich_item(it, online_home_html=online_html, online_cookie=online_cookie)
        card_text, markup = build_notification_card(
            it, extra_sources=entry["extra_sources"], detail=detail, is_test=False
        )

        if can_send:
            delivered = 0
            for cid in broadcast_chat_ids:
                if telegram_send(token, cid, card_text, reply_markup=markup):
                    delivered += 1
            if delivered == 0:
                continue
            sent_count += 1
            log("ĐÃ GỬI ({}/{} người) [{}#{}]: {}".format(
                delivered, len(broadcast_chat_ids), it["source"], it["id"], it["title"][:80]
            ))
        else:
            log("[DRY] Tin mới [{}#{}]: {}".format(it["source"], it["id"], it["title"][:80]))

        for sk, sid, sdate in entry["all_refs"]:
            sources_state.setdefault(sk, {})[sid] = sdate
        if entry["fp"]:
            seen_titles[entry["fp"]] = {"source": it["source"], "date": it["date"], "at": today_iso}

    if not to_notify:
        log("Không có thông báo mới.")
    else:
        log("Đã gửi {}/{} thông báo mới.".format(sent_count, len(to_notify)))

    for sk in list(sources_state.keys()):
        sources_state[sk] = prune_seen_dict(sources_state[sk], max_items=250)
    state["sources"] = sources_state
    state["seen"] = dict(sources_state.get("online", {}))
    state["seen_titles"] = seen_titles
    state["updated"] = datetime.datetime.now(VN_TZ).strftime("%Y-%m-%d %H:%M:%S")
    if not dry_run:
        save_state(state)

    if do_test and token and admin_chat_ids and not dry_run:
        merged = merge_and_dedupe_items(results)
        if merged:
            latest = merged[0]
            detail = enrich_item(latest, online_home_html=online_html, online_cookie=online_cookie)
            card_text, markup = build_notification_card(latest, detail=detail, is_test=True)
            for cid in admin_chat_ids:
                telegram_send(token, cid, card_text, reply_markup=markup)
            log("Đã gửi 1 thẻ kiểm tra tới {} chat Admin.".format(len(admin_chat_ids)))


if __name__ == "__main__":
    main()
