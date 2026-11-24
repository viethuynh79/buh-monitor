# 🎓 HUB Monitor Pro v2.0 — Bot Telegram Hệ sinh thái ĐH Ngân hàng TP.HCM (MIS Edition)

Bot Telegram thế hệ mới tự động quét **toàn bộ hệ sinh thái thông báo của Trường Đại học Ngân hàng TP.HCM (HUB)** & **Khoa Hệ thống Thông tin Quản lý (HTTTQL / MIS)** mỗi **5 phút**, tự động gửi thẻ thông báo kèm nút bấm Inline & file PDF ngay khi trường cập nhật website!

- 🚀 **Chạy 24/7 hoàn toàn miễn phí** trên **GitHub Actions** (tự đẩy tin mới) + **Cloudflare Workers** (bấm nút & phản hồi tức thì < 1 giây).
- 🎨 **Giao diện nút bấm Inline chuẩn App** (có nút **Menu** xanh ở góc dưới trái, phân trang cập nhật tại chỗ không spam chat).
- 📄 **Đọc nhanh toàn văn & Tải file PDF trực tiếp ngay trong Telegram** — không cần phải mở trình duyệt chờ web trường tải chậm.

---

## 🌐 Toàn bộ hệ thống thông báo đã tích hợp

| # | Cổng thông tin HUB | Website theo dõi | Auto-Push (5p) | Đọc PDF trong chat |
|---|---|---|---|---|
| 1 | 💻 **Khoa HTTTQL (MIS) — Thông báo** | `khoahtttql.hub.edu.vn/thong-bao` | ✅ | ✅ |
| 2 | 🚀 **Khoa HTTTQL (MIS) — Sự kiện** | `khoahtttql.hub.edu.vn/thong-bao-su-kien/su-kien-hoat-dong` | ✅ | ✅ |
| 3 | 📝 **Phòng Khảo thí & ĐBCL** | `phongktdbcl.hub.edu.vn/thong-bao` | ✅ | ✅ |
| 4 | 🎓 **Phòng Quản lý Đào tạo (Thông báo)** | `phongdaotao.hub.edu.vn/thong-bao` | ✅ | ✅ |
| 5 | 📰 **Phòng Đào tạo (Tin tức & Thực tập)** | `phongdaotao.hub.edu.vn/` | ✅ | ✅ |
| 6 | 🤝 **Trung tâm SV & QHDN (SCC)** | `scc.hub.edu.vn/thong-bao` | ✅ | ✅ |
| 7 | 🏫 **Cổng Chính Trường HUB** | `hub.edu.vn/thong-bao` | ✅ | ✅ |
| 8 | 💰 **Phòng Tài chính - Kế toán** | `phongketoan.hub.edu.vn/thong-bao` | ✅ | ✅ |
| 9 | 🏛️ **Cổng Sinh viên Online** | `online.hub.edu.vn` | ✅ | ✅ (giải mã postback PDF!) |
| 10 | 📘 **Fanpage Khoa HTTTQL (Facebook)** | `facebook.com/htttql.hub` | ⚡ Tuỳ chọn RSS | Nút mở nhanh |

---

## ✨ Tính năng nâng cấp đặc biệt v2.0

1. **🔔 Auto-Notify Thông minh & Chống trùng lặp chéo cổng**
   - Quét song song cả 9 nguồn mỗi 5 phút.
   - Nếu trường đăng cùng 1 thông báo lên cả `online.hub.edu.vn` lẫn `phongktdbcl.hub.edu.vn` (hoặc `scc.hub.edu.vn`), bot **tự động gộp thành 1 thẻ duy nhất** (ưu tiên link chuẩn có PDF, không spam 2 lần!).
   - Tự trích xuất sẵn **link file PDF**, **đơn vị gửi**, **cảnh báo hạn chót (`⏰ Lưu ý hạn`)** và gắn nút bấm ngay dưới thẻ tin!

2. **📌 Bảng điều khiển `/menu` & Nút `Menu` xanh ở góc trái**
   - Giao diện nút bấm đối xứng gọn đẹp:
     - `🔥 Thông báo mới nhất (Tất cả cổng HUB)`
     - `📅 Tin 7 ngày` | `🗓️ Tin 30 ngày`
     - `💻 Khoa HTTTQL (MIS)` | `📝 Lịch thi & ĐBCL`
     - `🏢 Chọn cổng HUB (7)` | `🏷️ Lọc theo chủ đề`
     - `🔎 Tìm kiếm nhanh` | `📰 Bản tin tuần`
     - `🔗 Cổng tiện ích SV` | `📊 Trạng thái HUB`
     - `❓ Hướng dẫn & Lệnh nhanh`

3. **💻 Không gian riêng Khoa HTTTQL (MIS)**
   - Nút `/htttql` riêng gom Thông báo Khoa, Sự kiện/Tọa đàm, Website Khoa & Fanpage `fb.com/htttql.hub`.
   - **🌟 Radar MIS:** Tự động quét toàn bộ 7 cổng HUB để đánh dấu `⭐ KHOA HTTTQL` cho mọi tin liên quan đến *Hệ thống thông tin quản lý, MIS, CNTT, Đồ án ngành, TMĐT, AI, Chuyển đổi số*.

4. **📄 Trình đọc nhanh & Tải PDF trong Telegram**
   - Dưới mỗi danh sách 5 tin có thanh nút `[ 📖 1 ] [ 📖 2 ] [ 📖 3 ] [ 📖 4 ] [ 📖 5 ]`.
   - Bấm 1 chạm để đọc nội dung trích xuất + bấm nút `📥 Mở / Tải PDF` tải thẳng file từ `fileserver2.hub.edu.vn` hoặc `online.hub.edu.vn`!

5. **🔎 Tìm kiếm thông minh KHÔNG CẦN DẤU + Chip 1 chạm**
   - Nhắn thẳng từ khoá bất kỳ vào chat (ví dụ `hoc bong`, `lich thi`, `ngoai tru`) mà không cần gõ `/find`!
   - Hoặc bấm nút `🔎 Tìm kiếm nhanh` để chọn nhanh các từ khoá phổ biến.

6. **📤 Chia sẻ tin ngay trong nhóm lớp (Inline Mode)**
   - Bật **Inline Mode** trong `@BotFather` (`/setinline`) → gõ `@viethubnews_bot lịch thi` trong bất kỳ nhóm chat lớp nào để gửi thẻ thông báo chính thức kèm nút mở link!

---

## ⌨️ Danh sách lệnh Telegram

| Lệnh | Tác dụng |
|---|---|
| `/menu` hoặc `/start` | 📌 Mở bảng điều khiển nút bấm (Full tính năng) |
| `/latest` hoặc `/update` | 🔥 Xem thông báo mới nhất từ tất cả cổng HUB (real-time) |
| `/full7d` | 📅 Danh sách thông báo 7 ngày gần nhất (phân trang nút bấm) |
| `/full30d` | 🗓️ Danh sách thông báo 30 ngày gần nhất (phân trang nút bấm) |
| `/find <từ khoá>` | 🔎 Tìm kiếm không phân biệt dấu toàn HUB (hoặc nhắn thẳng từ khoá!) |
| `/htttql` (hoặc `/mis`) | 💻 Không gian riêng Khoa HTTTQL (MIS), Radar MIS & Fanpage |
| `/thi` | 📝 Lịch thi, phúc khảo, vắng thi, xóa điểm I |
| `/daotao` | 🎓 Phòng Quản lý Đào tạo (Thông báo, Tin tức, Thực tập & Tốt nghiệp) |
| `/scc` | 🤝 Trung tâm Sinh viên & QHDN (Ngoại trú, Học bổng, Hoạt động SV) |
| `/hocphi` | 💰 Học phí, miễn giảm, công nợ (Phòng Tài chính - Kế toán) |
| `/hocbong` | 🏆 Săn học bổng & khen thưởng toàn HUB |
| `/digest` | 📰 Bản tin tổng hợp tuần/tháng nhóm theo chủ đề |
| `/portals` | 🔗 Mở nhanh LMS, Đăng ký tín chỉ, eStudent, Thư viện, Fanpage MIS |
| `/status` | 📊 Kiểm tra tình trạng hoạt động & độ trễ 7 cổng HUB (real-time) |
| `/clear [số tin]` | 🧹 Xoá lịch sử trò chuyện gần đây (mặc định 100 tin, tối đa 300 tin trong vòng 48h) |
| `/author` | 👨‍💻 Thông tin tác giả **Huynh Viet** & liên hệ Facebook |
| `/help` | ❓ Xem hướng dẫn chi tiết |

---

## 🛠️ Hướng dẫn cập nhật & cài đặt (Chỉ mất 2 phút!)

### Bước 1: Cập nhật Cloudflare Worker (Để bấm nút & trả lời tức thì)
1. Vào [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → mở Worker bot của bạn (`buh-bot`).
2. Bấm **Edit code** → xoá code cũ → dán toàn bộ nội dung file [`cloudflare-worker.js`](./cloudflare-worker.js) vào → bấm **Deploy**.
3. Đảm bảo trong **Settings → Variables and Secrets** đã có biến `BOT_TOKEN` (token bot từ BotFather).
4. **Cài đặt tự động 1-Click:** Mở trình duyệt và truy cập:
   ```
   https://<ten-worker-cua-ban>.workers.dev/setup
   ```
   Trang trả về `"status": "ALL_OK"` nghĩa là đã tự động:
   - ✅ Kết nối Webhook (nhận cả lệnh, nút bấm Inline & Inline Mode)
   - ✅ Đăng ký toàn bộ 16 câu lệnh tiếng Việt
   - ✅ Bật **nút `Menu` màu xanh** ở góc dưới bên trái Telegram!

> 💡 *(Tuỳ chọn bảo mật)*: Bạn có thể thêm biến `SETUP_SECRET` trong Cloudflare Worker Settings nếu muốn khoá đường dẫn `/setup?key=<SETUP_SECRET>`.

### Bước 2: Kiểm tra GitHub Actions (Auto-Push 24/7 mỗi 5 phút)
1. Vào repo GitHub → **Settings → Secrets and variables → Actions** đảm bảo đã có:
   - `TELEGRAM_BOT_TOKEN`: token bot Telegram
   - `TELEGRAM_CHAT_ID`: chat ID của bạn *(hỗ trợ gửi nhiều nơi bằng dấu phẩy, VD: `123456,-100987654`)*
2. Vào tab **Actions → HUB Monitor Pro → Run workflow**:
   - Nhập `true` vào ô **test** → bấm **Run workflow**.
   - Sau ~30 giây, Telegram của bạn sẽ nhận được **Thẻ thông báo mẫu có nút tải PDF** + **Bảng điều khiển `/menu` mới**!

### Bước 3 *(Tuỳ chọn)*: Nhận Auto-Push bài đăng mới từ Fanpage Facebook Khoa HTTTQL
Facebook chặn máy chủ bên ngoài đọc trực tiếp mà không đăng nhập, nên nếu bạn muốn bot **tự động gửi thông báo khi Fanpage `fb.com/htttql.hub` có bài mới**:
1. Tạo 1 link RSS miễn phí cho `https://www.facebook.com/htttql.hub` (ví dụ qua [rss.app](https://rss.app) hoặc dịch vụ RSS bridge).
2. Vào GitHub Repo → **Settings → Secrets → Actions** → thêm secret mới tên `FB_HTTTQL_RSS_URL` với giá trị là link RSS đó.
3. Bot sẽ tự động quét thêm Fanpage Khoa HTTTQL mỗi 5 phút mà không cần sửa code!

### Bước 4 *(Tuỳ chọn)*: Bật chế độ chia sẻ nhanh trong nhóm lớp (`Inline Mode`)
1. Nhắn `@BotFather` lệnh `/setinline`.
2. Chọn bot của bạn → nhập gợi ý: `Tìm thông báo HUB (VD: lịch thi, học bổng)...`.
3. Từ giờ trong bất kỳ nhóm chat nào, chỉ cần gõ `@<username_bot> lịch thi` để chia sẻ thông báo chính thức ngay!

---

## 💻 Chạy thử trên máy cá nhân

```powershell
python monitor.py --dry-run    # Quét thử tất cả 9 nguồn HUB (không gửi Telegram, không sửa seen.json)
python monitor.py --setup-bot  # Cài đặt nút Menu xanh & danh sách lệnh
python monitor.py --test       # Gửi thẻ demo + Menu tương tác về Telegram
```

---

## 👨‍💻 Tác giả

- **Author:** [Huynh Viet](https://www.facebook.com/profile.php?id=61591547874181)
- **Khoa:** Hệ thống Thông tin Quản lý (HTTTQL / MIS) — Trường Đại học Ngân hàng TP.HCM (HUB)
- **GitHub:** [viethuynh79/buh-monitor](https://github.com/viethuynh79/buh-monitor)
