# Bot theo dõi thông báo trường ĐH Ngân Hàng (online.hub.edu.vn)

Bot tự động quét trang **"THÔNG BÁO MỚI"** của `https://online.hub.edu.vn/` mỗi **5 phút**
và gửi tin nhắn **Telegram** ngay khi trường đăng thông báo/tin tức mới.

- Chạy trên **GitHub Actions** → **máy tính tắt vẫn hoạt động**, miễn phí, không cần thẻ tín dụng.
- Không cần cài đặt gì trên máy (chỉ cần tạo tài khoản GitHub).

---

## Các lệnh Telegram

Nhắn cho bot (mở `@viethubnews_bot` trên Telegram):

| Lệnh | Tác dụng |
|---|---|
| `/full7d` | Xem danh sách thông báo **7 ngày gần nhất** (kèm link) |
| `/full30d` | Xem danh sách thông báo **30 ngày gần nhất** (kèm link) |
| `/find <từ khoá>` | Tìm từ khoá trong tiêu đề thông báo **30 ngày gần nhất**, ví dụ `/find học bổng` |
| `/help` hoặc `/start` | Xem hướng dẫn |

> Lưu ý: lệnh được xử lý sau mỗi chu kỳ quét (tối đa ~5 phút), nên bot trả lời sau vài phút.

---

## 1. Chuẩn bị (làm 1 lần, khoảng 10 phút)

### a) Tạo bot Telegram, lấy `BOT_TOKEN`
1. Mở Telegram, tìm **@BotFather** (bot chính thức, có tick xanh).
2. Gửi lệnh: `/newbot`
3. Đặt tên bot (ví dụ: `Thong bao BUH cua toi`).
4. Đặt username bot, **phải kết thúc bằng `bot`** (ví dụ: `buh_thongbao_bot`).
5. BotFather trả về một dòng dạng:
   `Use this token to access the HTTP API:` → copy token này, ví dụ:
   `7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   → đây là `BOT_TOKEN`.

### b) Lấy `CHAT_ID` (id người nhận tin)
1. Trong Telegram, mở chat với bot vừa tạo, bấm **Start** (gửi `/start`).
2. Tìm **@userinfobot**, bấm Start, nó sẽ trả về `Id` của bạn (ví dụ `123456789`)
   → đây là `CHAT_ID`.
   (Cách khác: gửi 1 tin bất kỳ cho bot, rồi mở
   `https://api.telegram.org/bot<BOT_TOKEN>/getUpdates` và tìm `"chat":{"id":...}`.)

### c) Tạo repository GitHub
1. Đăng ký/đăng nhập [github.com](https://github.com).
2. Bấm **New repository**:
   - Tên: `buh-monitor`
   - Chọn **Public** (bắt buộc để miễn phí chạy liên tục; repo chỉ chứa code, KHÔNG chứa token).
   - Không cần tạo README.
3. Tải file trong thư mục này lên repo (gồm: `monitor.py`, `.github/workflows/monitor.yml`,
   `seen.json`, `.gitignore`, `README.md`).

### d) Thêm 2 "secret" vào repo
1. Vào repo → tab **Settings** → **Secrets and variables** → **Actions**.
2. Bấm **New repository secret**, thêm:
   - `TELEGRAM_BOT_TOKEN` = token bot ở bước (a).
   - `TELEGRAM_CHAT_ID`   = id ở bước (b).

### e) Bật và chạy thử
1. Vào repo → tab **Actions** → bấm **I understand my workflows, go ahead and enable them**.
2. Chọn workflow **BUH Monitor** → **Run workflow** → nhập `true` vào ô test → **Run workflow**.
3. Đợi ~1 phút, bạn sẽ nhận tin nhắn Telegram:
   `✅ Bot BUH đã hoạt động.`

Xong! Từ giờ bot tự chạy mỗi 5 phút, máy tính tắt vẫn nhận thông báo.

---

## 2. Cách hoạt động

- Mỗi lần chạy, bot tải trang chủ, đọc danh sách **THÔNG BÁO MỚI** (id + tiêu đề + ngày đăng).
- So sánh với file `seen.json` (danh sách đã biết) để tìm **tin mới**.
- Tin mới → gửi Telegram:
  ```
  🔔 THÔNG BÁO MỚI — BUH
  📌 <tiêu đề>
  📅 <ngày đăng>
  🔗 https://online.hub.edu.vn/Messages.aspx?id=<id>
  ```
- Lần đầu chỉ ghi mốc (không spam các tin cũ). File `seen.json` được bot tự cập nhật
  (chỉ commit khi có tin mới).

## 3. Lưu ý

- **Giữ repo Public** để chạy miễn phí không giới hạn. Token nằm trong *Secret* nên không ai đọc được.
- GitHub chạy theo lịch có thể trễ vài phút; 5 phút/lần là mức nhanh nhất GitHub hỗ trợ
  (thực tế với tin nhà trường là đủ nhanh).
- Nếu repo không có hoạt động nào trong 60 ngày, GitHub có thể tạm dừng lịch — chỉ cần vào
  repo bấm chạy lại 1 lần là hoạt động tiếp.
- Muốn nhận nhanh hơn 5 phút (1 phút/lần): có thể chuyển sang Cloudflare Workers — liên hệ để
  mình hướng dẫn thêm.

## 4. Chạy thử trên máy (không bắt buộc)

```powershell
cd buh-monitor
python monitor.py --test
```

- Nếu không muốn đặt biến môi trường, tạo file `config.json` cạnh `monitor.py`:
  ```json
  {
    "telegram_bot_token": "7123456789:AAH...",
    "telegram_chat_id": "123456789"
  }
  ```
  (`config.json` đã nằm trong `.gitignore`, sẽ không bị đẩy lên GitHub.)
