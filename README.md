# HUB News — Bot Telegram Thông Báo ĐH Ngân hàng TP.HCM (HUB)

Bot Telegram tối giản theo dõi tự động **7 cổng thông tin chính thức của Trường Đại học Ngân hàng TP.HCM (HUB)** với **Cloudflare Workers Cron Trigger mỗi 5 phút** và phản hồi nút bấm tức thì trên Cloudflare Edge.

## 7 cổng thông tin HUB (Ưu tiên #1: Online HUB)

| Ưu tiên | Cổng thông tin | Địa chỉ |
|---|---|---|
| 1 | 🏛️ **Online HUB** | `https://online.hub.edu.vn/` |
| 2 | 📝 **Phòng Khảo thí & ĐBCL** | `https://phongktdbcl.hub.edu.vn/thong-bao` |
| 3 | 🎓 **Phòng Đào tạo** | `https://phongdaotao.hub.edu.vn/thong-bao` |
| 4 | 📰 **Đào tạo · Tin & Thực tập** | `https://phongdaotao.hub.edu.vn/` |
| 5 | 🤝 **Trung tâm SV (SCC)** | `https://scc.hub.edu.vn/thong-bao` |
| 6 | 🏫 **Cổng Chính HUB** | `https://hub.edu.vn/thong-bao` |
| 7 | 💰 **Tài chính - Kế toán** | `https://phongketoan.hub.edu.vn/thong-bao` |

## Tính năng chính

- **Tối ưu tốc độ Online HUB (#1):** Edge cache 45s, lazy pagination (chỉ tải 1 trang cho 10 tin đầu), timeout nhanh kết hợp retry luân phiên `/` & `/Default.aspx` và bản đệm KV (`cache:online_lkg`) phòng khi máy chủ trường quá tải.
- **Tự động báo tin mới mỗi 5 phút thật:** Chạy trực tiếp trên Cloudflare Workers Cron Trigger (`*/5 * * * *`), tự khử trùng chéo cổng, trích xuất PDF và gửi tới tất cả người dùng đã `/start`.
- **Đọc nhanh & tải PDF trong Telegram:** Bấm số `1–5` dưới mỗi danh sách để đọc nội dung và mở tệp đính kèm trực tiếp.
- **Quản trị & phát sóng (`/admin`, `/bc`, `/bc!`):** Gửi thông báo văn bản hoặc ảnh kèm chú thích tới toàn bộ người dùng đã đăng ký.

## Danh sách lệnh

- `/menu` — Bảng điều khiển chính
- `/online` — Cổng SV Online HUB (Ưu tiên #1)
- `/latest` · `/full7d` · `/full30d` — Tin mới nhất / 7 ngày / 30 ngày
- `/find <từ khoá>` — Tìm kiếm không dấu (hoặc nhắn trực tiếp vào chat)
- `/thi` · `/daotao` · `/scc` · `/hocphi` · `/hocbong` — Lọc nhanh chuyên mục
- `/digest` · `/portals` · `/status` · `/notify` · `/clear` · `/author` · `/help`
- `/admin` · `/bc` · `/bc!` — Khu vực Quản trị viên

## Triển khai

1. Deploy `cloudflare-worker.js` lên Cloudflare Worker có biến `BOT_TOKEN`, `SUBSCRIBERS_KV`, và Cron Trigger `*/5 * * * *`.
2. Mở `https://<worker>.workers.dev/setup` để đồng bộ Webhook, danh sách lệnh và nút `Menu`.

## Tác giả

- [Huynh Viet](https://www.facebook.com/profile.php?id=61591547874181)
