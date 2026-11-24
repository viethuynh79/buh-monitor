#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HUB Monitor Pro v2.0 — Hệ thống theo dõi thông báo toàn hệ sinh thái ĐH Ngân hàng TP.HCM (HUB)
Dành riêng cho sinh viên HUB & Khoa Hệ thống Thông tin Quản lý (MIS / HTTTQL).

Nguồn theo dõi tự động (mỗi 5 phút qua GitHub Actions):
  1. Cổng Sinh viên Online     : https://online.hub.edu.vn/
  2. Phòng Khảo thí & ĐBCL     : https://phongktdbcl.hub.edu.vn/thong-bao
  3. Phòng Quản lý Đào tạo     : https://phongdaotao.hub.edu.vn/thong-bao & trang chủ (Tin tức / Thực tập & Tốt nghiệp)
  4. Trung tâm SV & QHDN (SCC) : https://scc.hub.edu.vn/thong-bao
  5. Khoa HTTTQL (MIS)         : https://khoahtttql.hub.edu.vn/thong-bao & Sự kiện hoạt động
  6. Cổng Chính HUB            : https://hub.edu.vn/thong-bao
  7. Phòng Tài chính - Kế toán : https://phongketoan.hub.edu.vn/thong-bao
  8. (Tuỳ chọn) Fanpage Khoa HTTTQL qua RSS bridge (biến môi trường FB_HTTTQL_RSS_URL)

Tính năng nổi bật:
  - Tự động quét song song tất cả cổng HUB & đẩy Telegram NGAY khi có tin mới.
  - Tự động chống trùng lặp chéo cổng (gộp thông báo trùng giữa online.hub.edu.vn & các phòng ban).
  - Tự động trích xuất link PDF đính kèm, đơn vị gửi, hạn chót quan trọng (deadline).
  - Gắn thẻ phân loại thông minh & Radar ưu tiên tin Khoa HTTTQL (MIS).
  - Thẻ thông báo HTML đẹp mắt kèm nút bấm Inline (Đọc nhanh, Tải PDF, Mở bài viết, Menu).
  - Tự động cài đặt nút "Menu" xanh & danh sách lệnh trên Telegram Bot.

Cách dùng thủ công:
  python monitor.py               # Quét tất cả cổng và gửi tin mới
  python monitor.py --test        # Gửi thẻ kiểm tra + Menu tương tác qua Telegram
  python monitor.py --setup-bot   # Đăng ký nút Menu & danh sách lệnh Telegram
  python monitor.py --dry-run     # Chạy thử không gửi Telegram, không ghi seen.json
  python monitor.py --notify-first # Gửi cả tin hiện có nếu nguồn mới chạy lần đầu
"""

import concurrent.futures
import datetime
import html as html_lib
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
import xml.etree.ElementTree as ET

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATE_FILE = os.path.join(BASE_DIR, "seen.json")
CONFIG_FILE = os.path.join(BASE_DIR, "config.json")

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

VN_TZ = datetime.timezone(datetime.timedelta(hours=7))
BOT_UI_VERSION = 3

ONLINE_HOME = "https://online.hub.edu.vn/"
ONLINE_GRID_TARGET = "ctl00$ContentPlaceHolder1$ctl00$ctl00$ctl00$ctl00$grvNewsgroup"
ONLINE_ITEM_RE = re.compile(
    r'title="Messages\.aspx\?ID=(\d+)"[^>]*>(.*?)</a>'
    r'.*?<span[^>]*class="inputdate"[^>]*>(\d{1,2}/\d{1,2}/\d{4})</span>',
    re.DOTALL,
)

FB_HTTTQL_URL = "https://www.facebook.com/htttql.hub"

# Cấu hình toàn bộ nguồn thông báo thuộc hệ sinh thái HUB
# Priority thấp hơn = được ưu tiên làm link chính khi trùng bài giữa nhiều cổng
SOURCES = [
    {
        "key": "htttql",
        "code": "mis",
        "name": "Khoa HTTTQL (MIS)",
        "short": "Khoa HTTTQL",
        "emoji": "💻",
        "type": "dnn_notif",
        "url": "https://khoahtttql.hub.edu.vn/thong-bao",
        "base": "https://khoahtttql.hub.edu.vn",
        "section": "thong-bao",
        "priority": 1,
    },
    {
        "key": "htttql_ev",
        "code": "mise",
        "name": "Khoa HTTTQL — Sự kiện",
        "short": "Sự kiện MIS",
        "emoji": "🚀",
        "type": "dnn_news",
        "url": "https://khoahtttql.hub.edu.vn/thong-bao-su-kien/su-kien-hoat-dong",
        "base": "https://khoahtttql.hub.edu.vn",
        "section": "thong-bao-su-kien/su-kien-hoat-dong",
        "priority": 2,
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
        "priority": 3,
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
        "priority": 4,
    },
    {
        "key": "daotao_news",
        "code": "dtn",
        "name": "Phòng Đào tạo — Tin & Thực tập",
        "short": "Đào tạo (Tin tức)",
        "emoji": "📰",
        "type": "dnn_pdt_home",
        "url": "https://phongdaotao.hub.edu.vn/",
        "base": "https://phongdaotao.hub.edu.vn",
        "section": "tin-tuc-su-kien",
        "priority": 5,
    },
    {
        "key": "scc",
        "code": "scc",
        "name": "Trung tâm SV & QHDN (SCC)",
        "short": "Trung tâm SV (SCC)",
        "emoji": "🤝",
        "type": "dnn_news",
        "url": "https://scc.hub.edu.vn/thong-bao",
        "base": "https://scc.hub.edu.vn",
        "section": "thong-bao",
        "priority": 6,
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
        "priority": 7,
    },
    {
        "key": "ketoan",
        "code": "ktc",
        "name": "Phòng Tài chính - Kế toán",
        "short": "Tài chính - Kế toán",
        "emoji": "💰",
        "type": "dnn_notif",
        "url": "https://phongketoan.hub.edu.vn/thong-bao",
        "base": "https://phongketoan.hub.edu.vn",
        "section": "thong-bao",
        "priority": 8,
    },
    {
        "key": "online",
        "code": "onl",
        "name": "Cổng Sinh viên Online",
        "short": "Online HUB",
        "emoji": "🏛️",
        "type": "asp_grid",
        "url": ONLINE_HOME,
        "base": "https://online.hub.edu.vn",
        "section": "",
        "priority": 9,
    },
]

SOURCE_BY_KEY = {s["key"]: s for s in SOURCES}

BOT_COMMANDS = [
    {"command": "menu", "description": "📌 Mở bảng điều khiển nút bấm (Full tính năng)"},
    {"command": "latest", "description": "🔥 Thông báo mới nhất từ tất cả cổng HUB"},
    {"command": "update", "description": "⚡ Kiểm tra nhanh tin mới nhất (real-time)"},
    {"command": "full7d", "description": "📅 Tổng hợp thông báo 7 ngày gần nhất"},
    {"command": "full30d", "description": "🗓️ Tổng hợp thông báo 30 ngày gần nhất"},
    {"command": "find", "description": "🔎 Tìm kiếm không dấu (VD: /find hoc bong)"},
    {"command": "htttql", "description": "💻 Không gian Khoa HTTTQL (MIS) & Fanpage"},
    {"command": "thi", "description": "📝 Lịch thi, phúc khảo & Phòng Khảo thí"},
    {"command": "daotao", "description": "🎓 Phòng Đào tạo (Thông báo, Thực tập, Tốt nghiệp)"},
    {"command": "scc", "description": "🤝 Trung tâm SV (Ngoại trú, Học bổng, Sự kiện)"},
    {"command": "hocphi", "description": "💰 Học phí, miễn giảm & Phòng Kế toán"},
    {"command": "hocbong", "description": "🏆 Săn học bổng & khen thưởng toàn HUB"},
    {"command": "digest", "description": "📰 Bản tin tổng hợp tuần theo chủ đề"},
    {"command": "portals", "description": "🔗 Mở nhanh LMS, ĐKTC, eStudent, Fanpage MIS"},
    {"command": "status", "description": "📊 Kiểm tra trạng thái 7 cổng HUB (real-time)"},
    {"command": "clear", "description": "🧹 Xoá lịch sử trò chuyện gần đây"},
    {"command": "help", "description": "❓ Hướng dẫn sử dụng Bot HUB Pro"},
]

MAX_PAGES_ONLINE = 8
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


def fetch_http(url, data=None, cookie=None, timeout=25, retries=2):
    """GET/POST với retry + trả về (body, set_cookie, final_url)."""
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
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
            req = urllib.request.Request(url, data=body, headers=headers)
            with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as resp:
                raw = resp.read().decode("utf-8", "replace")
                sc = resp.headers.get("Set-Cookie", "")
                sess = sc.split(";")[0].strip() if sc else ""
                return raw, sess, resp.geturl()
        except Exception as e:  # noqa: BLE001
            last_err = e
            if attempt < retries:
                time.sleep(1.5 * attempt)
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
    """Chuẩn hóa đầy đủ tiêu đề để chống trùng lặp chéo cổng (không cắt cụt phần Đợt 1/Đợt 2)."""
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


def is_mis_related(title, source_key=""):
    if source_key in ("htttql", "htttql_ev", "fb_htttql"):
        return True
    s = strip_accents(title).lower()
    keywords = [
        "he thong thong tin",
        "htttql",
        " mis ",
        "mis -",
        "- mis",
        "do an nganh",
        "cong nghe thong tin",
        "thuong mai dien tu",
        "tri tue nhan tao",
        "khoa hoc du lieu",
        "fintech",
        "chuyen doi so",
    ]
    padded = " " + s + " "
    return any(k in padded for k in keywords)


def is_urgent_title(title):
    s = strip_accents(title).lower()
    urgent_kw = [
        "huy hoc phan",
        "canh bao",
        "han cuoi",
        "khan",
        "bo sung",
        "vi pham",
        "vang thi",
        "kiem do",
        "tam ngung",
        "lua dao",
        "bat buoc",
        "thoi hoc",
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
    ]) or source_key in ("scc", "htttql_ev"):
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
    res = re.sub(r"\s+", " ", m.group(0)).strip(" ,;:-")
    return res[:90]


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


def parse_online_items(page_html):
    items = []
    for m in ONLINE_ITEM_RE.finditer(page_html):
        msg_id = m.group(1)
        title = clean_text(m.group(2))
        dt = parse_date(m.group(3))
        if title and dt:
            items.append({
                "id": msg_id,
                "source": "online",
                "code": "onl",
                "title": title,
                "date": dt.strftime("%d/%m/%Y"),
                "date_dt": dt,
                "url": ONLINE_HOME,
                "legacy_url": "https://online.hub.edu.vn/Messages.aspx?id={}".format(msg_id),
            })
    return items


def _extract_dnn_id(url):
    m = re.search(r"-(\d+)\.html", url or "")
    if m:
        return m.group(1)
    return str(abs(hash(url)))[:10]


def parse_dnn_notif(page_html, src):
    """Parse các trang dạng <div class="notification-item"> (ktdbcl, daotao, hub, ketoan, khoahtttql)."""
    m_main = re.search(r'<div class="notification-list mt-8">(.*?)</section>', page_html, re.S)
    chunk = m_main.group(1) if m_main else page_html
    pattern = re.compile(
        r'<div class="notification-item">.*?'
        r'<span class="day">(\d{1,2})</span>\s*<span class="month-year">(\d{1,2})\.(\d{4})</span>.*?'
        r'<h3 class="news-title">\s*<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
        re.S,
    )
    items = []
    seen_ids = set()
    for m in pattern.finditer(chunk):
        day, mo, yr = m.group(1).zfill(2), m.group(2).zfill(2), m.group(3)
        href = html_lib.unescape(m.group(4)).strip()
        if href.startswith("/"):
            href = src["base"] + href
        title = clean_text(m.group(5))
        dt = parse_date("{}/{}/{}".format(day, mo, yr))
        iid = _extract_dnn_id(href)
        if title and dt and iid not in seen_ids:
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
    """Parse các trang dạng <div class="news-item"> (scc, khoahtttql sự kiện, pdt trang chủ)."""
    if src["type"] == "dnn_pdt_home":
        chunk = page_html
    else:
        m_main = re.search(r'<div class="news-list mt-8">(.*?)</section>', page_html, re.S)
        chunk = m_main.group(1) if m_main else page_html

    pattern = re.compile(
        r'<div class="news-item">.*?'
        r'<p class="news-date">(\d{1,2}/\d{1,2}/\d{4})</p>\s*'
        r'<h3 class="news-title">\s*<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
        re.S,
    )
    items = []
    seen_ids = set()
    for m in pattern.finditer(chunk):
        dt = parse_date(m.group(1))
        href = html_lib.unescape(m.group(2)).strip()
        if href.startswith("/"):
            href = src["base"] + href
        title = clean_text(m.group(3))
        iid = _extract_dnn_id(href)
        if title and dt and iid not in seen_ids:
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
    """Lấy danh sách thông báo từ 1 cổng HUB. Trả về (items, first_html, session_cookie)."""
    stype = src["type"]
    html, cookie, _ = fetch_http(src["url"])
    if stype == "asp_grid":
        items = parse_online_items(html)
        if max_pages > 1 and items:
            fields = get_hidden_fields(html)
            for page in range(2, max_pages + 1):
                try:
                    p_data = dict(fields)
                    p_data["__EVENTTARGET"] = ONLINE_GRID_TARGET
                    p_data["__EVENTARGUMENT"] = "Page${}".format(page)
                    p_html, _, _ = fetch_http(ONLINE_HOME, data=p_data, cookie=cookie)
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


def fetch_fb_rss_items(rss_url):
    """Đọc RSS feed tuỳ chọn của Fanpage Khoa HTTTQL (nếu người dùng cài FB_HTTTQL_RSS_URL)."""
    if not rss_url:
        return []
    xml_text, _, _ = fetch_http(rss_url, timeout=20)
    root = ET.fromstring(xml_text)
    items = []
    today = datetime.datetime.now(VN_TZ).date()
    # RSS 2.0 <item>
    for el in root.findall(".//item"):
        title = clean_text(el.findtext("title") or "")
        link = (el.findtext("link") or FB_HTTTQL_URL).strip()
        guid = (el.findtext("guid") or link).strip()
        pub = (el.findtext("pubDate") or "").strip()
        dt = today
        if pub:
            for fmt in ("%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S GMT"):
                try:
                    dt = datetime.datetime.strptime(pub, fmt).date()
                    break
                except ValueError:
                    continue
        if title:
            iid = re.sub(r"[^a-zA-Z0-9]", "", guid)[-18:] or str(abs(hash(title)))[:12]
            items.append({
                "id": iid,
                "source": "fb_htttql",
                "code": "fb",
                "title": title[:220],
                "date": dt.strftime("%d/%m/%Y"),
                "date_dt": dt,
                "url": link,
            })
    return items[:15]


# ---------------------------------------------------------------- Detail & PDF Enricher

def enrich_item(item, online_home_html=None, online_cookie=None):
    """
    Lấy chi tiết bài viết để trích xuất:
      - pdfs: danh sách link PDF / tài liệu trực tiếp
      - downloads: link tải file đính kèm (/taifiledinhkem/...)
      - sender: đơn vị gửi (nếu có)
      - deadline: thời hạn trích xuất từ nội dung
      - summary: đoạn tóm tắt ngắn
    """
    info = {"pdfs": [], "downloads": [], "sender": "", "deadline": "", "summary": ""}
    info["deadline"] = extract_deadline(item.get("title", ""))

    try:
        if item["source"] == "online":
            if not online_home_html or not online_cookie:
                online_home_html, online_cookie, _ = fetch_http(ONLINE_HOME)
            m_row = re.search(
                r'title="Messages\.aspx\?ID={}"[^>]*href="javascript:__doPostBack\(&#39;([^&]+)&#39;'
                .format(re.escape(item["id"])),
                online_home_html,
            )
            if not m_row:
                return info
            fields = get_hidden_fields(online_home_html)
            fields["__EVENTTARGET"] = m_row.group(1)
            fields["__EVENTARGUMENT"] = ""
            d_html, _, _ = fetch_http(ONLINE_HOME, data=fields, cookie=online_cookie, timeout=18, retries=1)

            m_sender = re.search(r'id="[^"]*lblSenderName"[^>]*>(.*?)</span>', d_html, re.S | re.I)
            if m_sender:
                info["sender"] = clean_text(m_sender.group(1))

            m_body = re.search(r'id="[^"]*lblMessageBody"[^>]*>(.*?)</span>', d_html, re.S | re.I)
            body_html = m_body.group(1) if m_body else ""
            # Lấy link file đính kèm trong body
            for am in re.finditer(r'href="([^"]+)"', body_html, re.I):
                href = html_lib.unescape(am.group(1)).strip()
                if href.startswith("/"):
                    href = "https://online.hub.edu.vn" + href
                if re.search(r"\.(?:pdf|docx?|xlsx?|zip|rar)(?:\?|$)", href, re.I):
                    if href not in info["pdfs"]:
                        info["pdfs"].append(href)
            body_text = clean_text(body_html)
            if body_text:
                info["summary"] = body_text[:260]
                if not info["deadline"]:
                    info["deadline"] = extract_deadline(body_text)
            return info

        if item["source"] == "fb_htttql":
            return info

        # Các cổng DNN (*.hub.edu.vn)
        d_html, _, _ = fetch_http(item["url"], timeout=18, retries=1)
        src = SOURCE_BY_KEY.get(item["source"], {})
        base = src.get("base", "https://hub.edu.vn")

        fc = re.search(
            r'<div class="full-content">(.*?)<div class="(?:attach|news-tags|social|share|box-new-notification)',
            d_html, re.S | re.I,
        )
        body_html = fc.group(1) if fc else ""

        # Trích xuất PDF trực tiếp (fileserver2.hub.edu.vn, iframe, link)
        for pm in re.finditer(r'(https?://[^\s"\'<>]+\.(?:pdf|docx?|xlsx?|zip|rar))', body_html, re.I):
            u = html_lib.unescape(pm.group(1))
            if u not in info["pdfs"]:
                info["pdfs"].append(u)

        # Trích xuất bảng file đính kèm javascript:download("m12345")
        for dm in re.finditer(r'download\(["\']([^"\']+)["\']\)', d_html):
            dl_url = "{}/taifiledinhkem/tai-file-{}".format(base, dm.group(1))
            if dl_url not in info["downloads"]:
                info["downloads"].append(dl_url)

        # Tóm tắt nội dung văn bản (bỏ tiêu đề bảng đính kèm)
        body_clean = re.sub(r'<div class="attach".*$', "", body_html, flags=re.S | re.I)
        body_clean = re.sub(r'<table[^>]*filedinhkem_table.*?</table>', "", body_clean, flags=re.S | re.I)
        body_text = clean_text(body_clean)
        body_text = re.sub(r"\bFile đính kèm\b.*$", "", body_text).strip()
        if len(body_text) > 25:
            info["summary"] = body_text[:280]
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
            err_code = data.get("error_code")
            if err_code == 429:
                wait = int((data.get("parameters") or {}).get("retry_after", 5 * attempt))
                log("Telegram 429, thử lại sau {}s ...".format(wait))
                time.sleep(wait)
                continue
            log("Telegram {} lỗi: {}".format(method, data.get("description", "unknown")))
            return None
        except urllib.error.HTTPError as e:
            err_body = ""
            try:
                err_body = e.read().decode("utf-8", "replace")
            except Exception:  # noqa: BLE001
                pass
            if e.code == 429 and attempt < retries:
                time.sleep(5 * attempt)
                continue
            log("Telegram {} HTTP {}: {}".format(method, e.code, err_body[:200]))
            if attempt < retries and e.code >= 500:
                time.sleep(3 * attempt)
                continue
            return None
        except Exception as e:  # noqa: BLE001
            log("Lỗi gọi Telegram {} (lần {}): {}".format(method, attempt, e))
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
    """Đăng ký danh sách lệnh và bật nút 'Menu' xanh ở góc dưới trái Telegram."""
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
        log("getUpdates lỗi: {}".format(data.get("description")))
    except urllib.error.HTTPError as e:
        if e.code == 409:
            return []  # Cloudflare webhook đang bật -> bỏ qua polling
        log("Lỗi getUpdates: {}".format(e))
    except Exception as e:  # noqa: BLE001
        log("Lỗi getUpdates: {}".format(e))
    return []


# ---------------------------------------------------------------- UI Cards & Keyboards

def build_main_menu_markup():
    return {
        "inline_keyboard": [
            [{"text": "🔥 Thông báo mới nhất (Tất cả cổng HUB)", "callback_data": "list:all:latest:1"}],
            [
                {"text": "📅 Tin 7 ngày", "callback_data": "list:all:7:1"},
                {"text": "🗓️ Tin 30 ngày", "callback_data": "list:all:30:1"},
            ],
            [
                {"text": "💻 Khoa HTTTQL (MIS)", "callback_data": "m:mis"},
                {"text": "📝 Lịch thi & ĐBCL", "callback_data": "src:ktdbcl:1"},
            ],
            [
                {"text": "🏢 Chọn cổng HUB (7)", "callback_data": "m:portals"},
                {"text": "🏷️ Lọc theo chủ đề", "callback_data": "m:topics"},
            ],
            [
                {"text": "🔎 Tìm kiếm nhanh", "callback_data": "m:search"},
                {"text": "📰 Bản tin tuần", "callback_data": "digest:7"},
            ],
            [
                {"text": "🔗 Cổng tiện ích SV", "callback_data": "m:links"},
                {"text": "📊 Trạng thái HUB", "callback_data": "status"},
            ],
            [
                {"text": "❓ Hướng dẫn", "callback_data": "m:help"},
                {"text": "🧹 Dọn chat", "callback_data": "clear:ask"},
            ],
        ]
    }


def build_main_menu_text():
    now_vn = datetime.datetime.now(VN_TZ).strftime("%H:%M · %d/%m/%Y")
    return (
        "📌 <b>BẢNG ĐIỀU KHIỂN — HUB MONITOR PRO</b>\n"
        "🎓 <i>Hệ sinh thái ĐH Ngân hàng TP.HCM · Khoa HTTTQL (MIS)</i>\n"
        "━━━━━━━━━━━━━━━━━━━━\n"
        "🟢 <b>Trạng thái BOT:</b> Đang hoạt động · <code>{}</code>\n"
        "⚡ <b>Tức thì:</b> Đọc nội dung &amp; tải PDF ngay trong Telegram\n\n"
        "👇 <i>Vui lòng chọn menu bên dưới:</i>"
    ).format(now_vn)


def build_notification_card(item, extra_sources=None, detail=None, is_test=False):
    """Tạo thẻ thông báo HTML chuẩn phong cách gọn đẹp + Inline Buttons (giống ảnh mẫu)."""
    cat = classify_item(item["title"], item["source"])
    mis_flag = is_mis_related(item["title"], item["source"])
    urgent = is_urgent_title(item["title"])

    src = SOURCE_BY_KEY.get(item["source"], {
        "emoji": "📘", "name": "Fanpage Khoa HTTTQL (FB)", "short": "Fanpage MIS",
    })

    head_icon = "🚨" if urgent else ("💻" if mis_flag and item["source"] in ("htttql", "htttql_ev", "fb_htttql") else cat["icon"])
    status_pill = "🧪 <b>KIỂM TRA HỆ THỐNG</b>" if is_test else "➕ <b>THÔNG BÁO MỚI</b>"
    badges = [status_pill, "<code>{}</code>".format(cat["tag"])]
    if mis_flag:
        badges.append("⭐ <b>KHOA HTTTQL</b>")
    if urgent:
        badges.append("⚡ <b>CHÚ Ý</b>")

    source_names = ["{} {}".format(src["emoji"], src["name"])]
    if extra_sources:
        for es in extra_sources:
            es_cfg = SOURCE_BY_KEY.get(es)
            if es_cfg and es != item["source"]:
                source_names.append("{} {}".format(es_cfg["emoji"], es_cfg["short"]))

    lines = [
        "{} <b>{}</b>".format(head_icon, escape_html(item["title"])),
        " · ".join(badges),
        "━━━━━━━━━━━━━━━━━━━━",
        "🏢 <b>Nguồn:</b> {}".format(escape_html(" · ".join(source_names))),
        "📅 <b>Ngày đăng:</b> <code>{}</code>".format(escape_html(item["date"])),
        "🏷️ <b>Phân loại:</b> {} {}".format(cat["icon"], escape_html(cat["label"])),
    ]

    pdfs = (detail or {}).get("pdfs", [])
    downloads = (detail or {}).get("downloads", [])
    sender = (detail or {}).get("sender", "")
    deadline = (detail or {}).get("deadline", "")
    summary = (detail or {}).get("summary", "")

    if sender:
        lines.append("👤 <b>Đơn vị:</b> {}".format(escape_html(sender)))
    if deadline:
        lines.append("⏰ <b>Lưu ý hạn:</b> <i>{}</i>".format(escape_html(deadline)))

    att_parts = []
    if pdfs:
        att_parts.append("{} file PDF".format(len(pdfs)))
    if downloads:
        att_parts.append("{} tệp tải về".format(len(downloads)))
    if att_parts:
        lines.append("📎 <b>Đính kèm:</b> {}".format(" + ".join(att_parts)))

    if summary and len(summary) > 30 and not summary.lower().startswith("sv xem chi tiết"):
        preview = summary[:190] + ("..." if len(summary) > 190 else "")
        lines.append("")
        lines.append("💬 <i>{}</i>".format(escape_html(preview)))

    # Inline Buttons giống phong cách ảnh mẫu (nút chính full-width nổi bật + nút phụ 2 cột)
    keyboard = []
    cb_view = "v:{}:{}".format(item["code"], item["id"])
    if item["source"] != "fb_htttql" and len(cb_view.encode("utf-8")) <= 64:
        hero_label = "📄 Xem chi tiết & Tải PDF" if (pdfs or downloads) else "📄 Xem nhanh nội dung"
        keyboard.append([{"text": hero_label, "callback_data": cb_view}])

    row2 = []
    if pdfs:
        row2.append({"text": "📥 Mở PDF trực tiếp", "url": pdfs[0]})
    elif downloads:
        row2.append({"text": "📦 Tải tệp đính kèm", "url": downloads[0]})
    else:
        src_cb = "src:{}:1".format(item["source"]) if item["source"] in SOURCE_BY_KEY else "m:mis"
        row2.append({"text": "{} Xem cổng này".format(src["emoji"]), "callback_data": src_cb})

    open_url = item["url"] if item["source"] != "online" else (pdfs[0] if pdfs else ONLINE_HOME)
    open_label = "🌐 Mở bài viết" if item["source"] != "online" else "🏛️ Mở Online HUB"
    row2.append({"text": open_label, "url": open_url})
    keyboard.append(row2)

    keyboard.append([
        {"text": "💻 Khoa HTTTQL", "callback_data": "m:mis"},
        {"text": "📌 Mở Menu", "callback_data": "m:home"},
    ])

    return "\n".join(lines), {"inline_keyboard": keyboard}


def format_list_html(header, items, limit=15):
    if not items:
        return [header + "\n\n<i>Không tìm thấy thông báo nào phù hợp.</i>"]
    shown = items[:limit]
    lines = ["<b>{}</b> <i>({} tin)</i>".format(escape_html(header), len(items)), "━━━━━━━━━━━━━━━━━━━━"]
    for i, it in enumerate(shown, 1):
        src = SOURCE_BY_KEY.get(it["source"], {"emoji": "📌", "short": it["source"]})
        cat = classify_item(it["title"], it["source"])
        title = it["title"]
        if len(title) > 105:
            title = title[:102] + "..."
        url = it["url"]
        lines.append("")
        lines.append("<b>{}.</b> {} <a href=\"{}\">{}</a>".format(
            i, cat["icon"], escape_html(url), escape_html(title)
        ))
        lines.append("   └ {} {} · 📅 <code>{}</code>".format(
            src["emoji"], escape_html(src["short"]), escape_html(it["date"])
        ))
    if len(items) > limit:
        lines.append("\n<i>... và {} tin khác. Gõ /menu để duyệt theo trang!</i>".format(len(items) - limit))

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

def fetch_all_sources(fb_rss_url="", max_pages_online=1):
    """Quét song song toàn bộ hệ sinh thái HUB. Trả về (results_by_source, meta_by_source)."""
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

    with concurrent.futures.ThreadPoolExecutor(max_workers=len(SOURCES) + 1) as ex:
        futs = [ex.submit(_worker, s) for s in SOURCES]
        fb_fut = None
        if fb_rss_url:
            def _fb_worker():
                t0 = time.time()
                try:
                    its = fetch_fb_rss_items(fb_rss_url)
                    return "fb_htttql", its, {"ok": True, "ms": int((time.time() - t0) * 1000), "count": len(its)}
                except Exception as e:  # noqa: BLE001
                    log("Lỗi quét FB RSS: {}".format(e))
                    return "fb_htttql", [], {"ok": False, "ms": int((time.time() - t0) * 1000), "error": str(e), "count": 0}
            fb_fut = ex.submit(_fb_worker)

        for f in futs:
            k, its, m = f.result()
            results[k] = its
            meta[k] = m
        if fb_fut:
            k, its, m = fb_fut.result()
            results[k] = its
            meta[k] = m

    return results, meta


def merge_and_dedupe_items(results_by_source, days=None):
    """Gộp tin từ tất cả cổng, khử trùng theo tiêu đề chuẩn hóa & sắp xếp mới nhất trước."""
    today = datetime.datetime.now(VN_TZ).date()
    cutoff = today - datetime.timedelta(days=days) if days is not None else None

    # Sắp xếp nguồn theo priority để ưu tiên giữ link của phòng ban (có PDF & link trực tiếp)
    ordered_keys = [s["key"] for s in sorted(SOURCES, key=lambda x: x["priority"])]
    if "fb_htttql" in results_by_source:
        ordered_keys.append("fb_htttql")

    by_fp = {}
    ordered = []
    for k in ordered_keys:
        for it in results_by_source.get(k, []):
            if cutoff and it["date_dt"] < cutoff:
                continue
            fp = normalize_title_key(it["title"])
            if fp and fp in by_fp:
                existing = by_fp[fp]
                # Chỉ gộp khi khác cổng và chênh lệch ngày <= 14 ngày
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
        log("Polling xử lý '{}' từ chat {}".format(text[:50], cid))

        try:
            if cmd in ("/start", "/menu"):
                telegram_send(token, cid, build_main_menu_text(), reply_markup=build_main_menu_markup())
            elif cmd in ("/latest", "/update"):
                for chunk in format_list_html("🔥 THÔNG BÁO MỚI NHẤT — TOÀN HUB", all_items[:15]):
                    telegram_send(token, cid, chunk, reply_markup=build_main_menu_markup())
            elif cmd == "/full7d":
                its = merge_and_dedupe_items(results_by_source, days=7)
                for chunk in format_list_html("📅 THÔNG BÁO 7 NGÀY GẦN NHẤT", its):
                    telegram_send(token, cid, chunk)
            elif cmd == "/full30d":
                its = merge_and_dedupe_items(results_by_source, days=30)
                for chunk in format_list_html("🗓️ THÔNG BÁO 30 NGÀY GẦN NHẤT", its):
                    telegram_send(token, cid, chunk)
            elif cmd == "/htttql" or cmd == "/mis":
                its = [it for it in all_items if is_mis_related(it["title"], it["source"])]
                for chunk in format_list_html("💻 KHOA HTTTQL (MIS) & TIN LIÊN QUAN", its[:15]):
                    telegram_send(token, cid, chunk, reply_markup={
                        "inline_keyboard": [
                            [{"text": "📘 Mở Fanpage Khoa HTTTQL", "url": FB_HTTTQL_URL}],
                            [{"text": "📌 Mở Menu chính", "callback_data": "m:home"}],
                        ]
                    })
            elif cmd == "/thi":
                its = [it for it in all_items if classify_item(it["title"], it["source"])["key"] == "exam"]
                for chunk in format_list_html("📝 LỊCH THI & KHẢO THÍ HUB", its[:15]):
                    telegram_send(token, cid, chunk)
            elif cmd == "/daotao":
                its = [it for it in all_items if it["source"] in ("daotao", "daotao_news")]
                for chunk in format_list_html("🎓 PHÒNG QUẢN LÝ ĐÀO TẠO", its[:15]):
                    telegram_send(token, cid, chunk)
            elif cmd == "/scc":
                its = [it for it in all_items if it["source"] == "scc"]
                for chunk in format_list_html("🤝 TRUNG TÂM SV & QHDN (SCC)", its[:15]):
                    telegram_send(token, cid, chunk)
            elif cmd == "/hocphi":
                its = [it for it in all_items if classify_item(it["title"], it["source"])["key"] == "tuition"]
                for chunk in format_list_html("💰 HỌC PHÍ & TÀI CHÍNH", its[:15]):
                    telegram_send(token, cid, chunk)
            elif cmd == "/hocbong":
                its = [it for it in all_items if classify_item(it["title"], it["source"])["key"] == "scholar"]
                for chunk in format_list_html("🏆 HỌC BỔNG & KHEN THƯỞNG", its[:15]):
                    telegram_send(token, cid, chunk)
            elif cmd == "/clear":
                mid = msg.get("message_id")
                if mid:
                    cnt = min(max(10, int(arg) if arg.isdigit() else 100), 300)
                    all_ids = list(range(mid, max(0, mid - cnt), -1))
                    for i in range(0, len(all_ids), 100):
                        telegram_api_call(token, "deleteMessages", {"chat_id": cid, "message_ids": all_ids[i:i + 100]})
                telegram_send(
                    token, cid,
                    "🧹 <b>Đã dọn sạch lịch sử trò chuyện gần đây!</b>",
                    reply_markup={"inline_keyboard": [[{"text": "📌 Mở Menu", "callback_data": "m:home"}, {"text": "🗑️ Ẩn tin này", "callback_data": "del:self"}]]},
                )
            elif cmd == "/find" or not cmd:
                kw = arg.strip()
                if not kw:
                    telegram_send(token, cid, "🔎 Hãy nhập từ khoá, ví dụ: <code>/find hoc bong</code>")
                else:
                    kw_n = strip_accents(kw).lower()
                    found = [it for it in all_items if kw_n in strip_accents(it["title"]).lower()]
                    for chunk in format_list_html('🔎 KẾT QUẢ TÌM "{}"'.format(kw), found[:15]):
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
                # Tương thích ngược: chuyển dữ liệu 'seen' cũ sang sources['online']
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
    fb_rss = os.environ.get("FB_HTTTQL_RSS_URL", "").strip()

    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8-sig") as f:
                cfg = json.load(f)
            token = token or str(cfg.get("telegram_bot_token", "")).strip()
            chat_ids_raw = chat_ids_raw or str(cfg.get("telegram_chat_id", "")).strip()
            fb_rss = fb_rss or str(cfg.get("fb_htttql_rss_url", "")).strip()
        except (ValueError, OSError):
            pass

    chat_ids = [c.strip() for c in chat_ids_raw.split(",") if c.strip()]
    return token, chat_ids, fb_rss


def prune_seen_dict(d, max_items=250):
    if len(d) <= max_items:
        return d
    # Sắp xếp theo ngày mới nhất
    def _sort_key(k):
        dt = parse_date(str(d.get(k, "")))
        return dt.toordinal() if dt else 0
    keep = sorted(d.keys(), key=_sort_key, reverse=True)[:max_items]
    return {k: d[k] for k in keep}


def prune_seen_titles(seen_titles, keep_days=30):
    today = datetime.datetime.now(VN_TZ).date()
    cutoff = (today - datetime.timedelta(days=keep_days)).strftime("%Y-%m-%d")
    out = {}
    for fp, meta in seen_titles.items():
        if isinstance(meta, dict) and meta.get("at", "") >= cutoff:
            out[fp] = meta
    return out


# ---------------------------------------------------------------- Main Monitor Loop

def main():
    args = sys.argv[1:]
    do_test = "--test" in args
    notify_first = "--notify-first" in args
    do_setup = "--setup-bot" in args
    dry_run = "--dry-run" in args

    token, chat_ids, fb_rss = get_config()
    state = load_state()

    if do_setup:
        if not token:
            log("LỖI: Chưa có TELEGRAM_BOT_TOKEN để cài đặt Bot UI.")
            sys.exit(1)
        setup_bot_ui(token)
        state["bot_ui_version"] = BOT_UI_VERSION
        if not dry_run:
            save_state(state)
        return

    # Tự động đồng bộ nút Menu & danh sách lệnh 1 lần khi nâng cấp phiên bản
    if token and not dry_run and int(state.get("bot_ui_version", 0) or 0) < BOT_UI_VERSION:
        if setup_bot_ui(token):
            state["bot_ui_version"] = BOT_UI_VERSION

    log("Bắt đầu quét song song {} cổng HUB{} ...".format(
        len(SOURCES), " + Fanpage RSS" if fb_rss else ""
    ))
    results, meta = fetch_all_sources(fb_rss_url=fb_rss, max_pages_online=1)

    ok_sources = [k for k, m in meta.items() if m.get("ok") and m.get("count", 0) > 0]
    for k, m in meta.items():
        status = "OK ({} tin, {}ms)".format(m.get("count", 0), m.get("ms", 0)) if m.get("ok") else "LỖI ({})".format(m.get("error", ""))
        log("  • {:12s}: {}".format(k, status))

    if not ok_sources:
        log("LỖI NGHIÊM TRỌNG: Không thể lấy dữ liệu từ bất kỳ cổng HUB nào!")
        sys.exit(1)

    # 1) Xử lý lệnh fallback qua getUpdates nếu chưa bật Cloudflare Webhook
    if token and not dry_run and os.environ.get("SKIP_COMMANDS", "").strip() != "1":
        handle_commands(token, state, results)

    sources_state = state.setdefault("sources", {})
    seen_titles = prune_seen_titles(state.get("seen_titles", {}))
    today_iso = datetime.datetime.now(VN_TZ).strftime("%Y-%m-%d")

    online_html = (meta.get("online") or {}).get("html", "")
    online_cookie = (meta.get("online") or {}).get("cookie", "")

    # 2) Tìm tất cả tin mới theo từng cổng (seed âm thầm cho cổng mới chạy lần đầu)
    ordered_keys = [s["key"] for s in sorted(SOURCES, key=lambda x: x["priority"])]
    if "fb_htttql" in results:
        ordered_keys.append("fb_htttql")

    candidates = []  # danh sách tin mới phát hiện trong chu kỳ này
    seeded_sources = []

    for skey in ordered_keys:
        items = results.get(skey, [])
        if not items:
            continue
        src_seen = sources_state.get(skey)
        is_first_for_source = not isinstance(src_seen, dict) or len(src_seen) == 0

        if is_first_for_source:
            log("Cổng '{}' chạy lần đầu: ghi mốc {} tin hiện tại.".format(skey, len(items)))
            src_seen = {it["id"]: it["date"] for it in items}
            sources_state[skey] = src_seen
            seeded_sources.append(skey)
            for it in items:
                fp = normalize_title_key(it["title"])
                if fp and fp not in seen_titles:
                    seen_titles[fp] = {"source": skey, "date": it["date"], "at": today_iso}
            if notify_first:
                candidates.extend(items[:3])
            continue

        new_for_src = [it for it in items if it["id"] not in src_seen]
        if new_for_src:
            log("Phát hiện {} tin mới từ cổng '{}'!".format(len(new_for_src), skey))
            candidates.extend(new_for_src)

    # 3) Khử trùng lặp chéo cổng cho các tin mới phát hiện trong chu kỳ này
    batch_by_fp = {}
    to_notify = []
    skipped_dupes = []

    for it in candidates:
        fp = normalize_title_key(it["title"])
        # Đã từng gửi cùng tiêu đề từ cổng khác gần đây? -> Ghi nhận ID, không spam lại!
        if fp and fp in seen_titles and not notify_first:
            skipped_dupes.append(it)
            sources_state.setdefault(it["source"], {})[it["id"]] = it["date"]
            continue
        # Trùng ngay trong cùng chu kỳ quét? -> Gộp nguồn vào 1 thẻ duy nhất!
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

    if skipped_dupes:
        log("Đã tự động khử {} tin trùng tiêu đề chéo cổng.".format(len(skipped_dupes)))

    # 4) Enrich & gửi Telegram từng thông báo mới (từ cũ đến mới để đúng thứ tự đọc)
    can_send = bool(token and chat_ids and not dry_run)
    sent_count = 0

    for entry in reversed(to_notify):
        it = entry["item"]
        detail = enrich_item(it, online_home_html=online_html, online_cookie=online_cookie)
        card_text, markup = build_notification_card(
            it, extra_sources=entry["extra_sources"], detail=detail, is_test=False
        )

        if can_send:
            all_ok = True
            for cid in chat_ids:
                if not telegram_send(token, cid, card_text, reply_markup=markup):
                    all_ok = False
            if not all_ok:
                log("Gửi thất bại cho {}#{}, sẽ thử lại chu kỳ sau.".format(it["source"], it["id"]))
                continue
            sent_count += 1
            log("ĐÃ GỬI [{}#{}]: {}".format(it["source"], it["id"], it["title"][:80]))
        else:
            log("[DRY/NO-TOKEN] Tin mới [{}#{}]: {}".format(it["source"], it["id"], it["title"][:80]))

        for sk, sid, sdate in entry["all_refs"]:
            sources_state.setdefault(sk, {})[sid] = sdate
        if entry["fp"]:
            seen_titles[entry["fp"]] = {"source": it["source"], "date": it["date"], "at": today_iso}

    if not to_notify:
        log("Không có thông báo mới nào trên toàn hệ thống HUB.")
    else:
        log("Tổng kết: đã gửi {}/{} thông báo mới.".format(sent_count, len(to_notify)))

    # 5) Cắt gọn & lưu state
    for sk in list(sources_state.keys()):
        sources_state[sk] = prune_seen_dict(sources_state[sk], max_items=250)
    state["sources"] = sources_state
    state["seen"] = dict(sources_state.get("online", {}))  # giữ tương thích ngược
    state["seen_titles"] = seen_titles
    state["updated"] = datetime.datetime.now(VN_TZ).strftime("%Y-%m-%d %H:%M:%S")
    if not dry_run:
        save_state(state)

    # 6) Chế độ --test: gửi thẻ demo tin mới nhất + Bảng điều khiển Menu
    if do_test and can_send:
        merged = merge_and_dedupe_items(results)
        if merged:
            latest = merged[0]
            detail = enrich_item(latest, online_home_html=online_html, online_cookie=online_cookie)
            card_text, markup = build_notification_card(latest, detail=detail, is_test=True)
            for cid in chat_ids:
                telegram_send(token, cid, card_text, reply_markup=markup)
                telegram_send(token, cid, build_main_menu_text(), reply_markup=build_main_menu_markup())
            log("Đã gửi thẻ kiểm tra + Menu tương tác tới {} chat.".format(len(chat_ids)))


if __name__ == "__main__":
    main()
