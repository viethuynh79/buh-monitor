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
- **Hỗ trợ đầy đủ Nhóm lớp Telegram (0 eKYC):** Tự động đăng ký nhóm khi được mời vào (`my_chat_member`), bảo vệ quyền bật/tắt thông báo theo Quản trị viên nhóm (`/notify`, `/bat`, `/tat`), hỗ trợ Forum Topics (`/settopic`), tự chuyển đổi khi nhóm nâng cấp `supergroup`, và lọc riêng danh sách nhóm trong `/admin` (`/bcg`).
- **Quản trị & phát sóng (`/admin`, `/bc`, `/bc!`, `/bcg`):** Gửi thông báo văn bản hoặc ảnh kèm chú thích tới toàn bộ người dùng và nhóm lớp đã đăng ký.

## Danh sách lệnh

- `/menu` — Bảng điều khiển chính
- `/latest` · `/online` — Tin mới nhất toàn HUB / Online HUB (Ưu tiên #1)
- `/full7d` · `/full30d` — Tin 7 ngày / 30 ngày
- `/find <từ khoá>` — Tìm kiếm không dấu (hoặc nhắn trực tiếp vào chat)
- `/thi` · `/daotao` · `/scc` · `/hocphi` · `/hocbong` — Lọc nhanh chuyên mục
- `/digest` · `/portals` · `/status` · `/notify` · `/bat` · `/tat` · `/settopic` · `/clear` · `/author` · `/help`
- `/admin` · `/bc` · `/bc!` · `/bcg` — Khu vực Quản trị viên (chat riêng)

## Triển khai & Thêm vào Nhóm lớp

1. Deploy `cloudflare-worker.js` lên Cloudflare Worker (`buh-monitor`) có biến `BOT_TOKEN`, `SUBSCRIBERS_KV`, và Cron Trigger `*/5 * * * *`.
2. Mở `https://<worker>.workers.dev/setup` để đồng bộ Webhook (`my_chat_member`), lệnh cá nhân & nhóm, tên Bot **HUB News** và nút `Menu`.
3. **Thêm vào Nhóm Telegram:** Bấm nút `➕ Thêm vào nhóm lớp` ngay trong `/menu` của BOT (hoặc thêm BOT từ mục *Thêm thành viên* trong nhóm) → BOT tự chào và tự đẩy thông báo 7 cổng HUB vào nhóm mỗi 5 phút. Nếu nhóm bật **Topics (Chủ đề)**, Quản trị nhóm gõ `/settopic` ngay trong chủ đề muốn nhận tin.

## Ứng dụng Android (`android-app/`)

Ứng dụng Android thuần Kotlin + Jetpack Compose + Material 3 kết nối trực tiếp JSON API trên Cloudflare Worker (`/api/news`, `/api/detail`, `/api/status`, `/api/announcements`):

- **Thông báo đẩy nền tự động:** Chạy nền bằng Android `WorkManager` (tự khôi phục sau khởi động lại máy) + chế độ tuỳ chọn **Quét nhanh 5 phút**, hỗ trợ chọn riêng từng cổng HUB, lọc tin Khẩn và nhận trực tiếp phát sóng từ Quản trị viên (`/bc`, `/bc!`).
- **Đọc nhanh & tải PDF:** Bấm thông báo để mở thẳng bài chi tiết, hạn nộp nổi bật và tải PDF vào `Downloads/HUBNews/`.
- **Biên dịch tự động:** GitHub Actions (`.github/workflows/android-build.yml`) chạy unit test và xuất sẵn tệp `HUB-News-v1.1.0.apk`.

## Ứng dụng iOS (`ios-app/`)

Ứng dụng iOS thuần **Swift + SwiftUI (iOS 16+)** đồng bộ Logo HUB, bảng màu Trắng (`#FFFFFF`) – Đỏ (`#A71B28`) – Xanh Đậm (`#203469`) và dùng chung JSON API trên Cloudflare Worker:

- **Thông báo đẩy nền iOS:** `UNUserNotificationCenter` + `BGAppRefreshTask` (tự đồng bộ 7 cổng HUB và phát sóng Admin `/bc`, bấm vào thông báo mở thẳng chi tiết bài viết).
- **Trải nghiệm mượt mà 120Hz:** Bộ đệm LRU 40 bài + prefetch 3 tin đầu (mở gần như 0ms), đọc PDF & bài gốc ngay trong ứng dụng bằng `SFSafariViewController`, chia sẻ native (`ShareLink`), Haptic feedback và chế độ Sáng/Tối.
- **Biên dịch tự động trên macOS:** GitHub Actions (`.github/workflows/ios-build.yml`) tạo dự án bằng `XcodeGen`, chạy `XCTest` trên iOS Simulator và xuất tệp `HUB-News-iOS-v1.1.0.ipa` (cài lên iPhone qua AltStore / SideStore / Sideloadly / TrollStore hoặc mở `HUBNews.xcodeproj` trên Xcode).

## Tác giả

- [Huynh Viet](https://www.facebook.com/profile.php?id=61591547874181)
