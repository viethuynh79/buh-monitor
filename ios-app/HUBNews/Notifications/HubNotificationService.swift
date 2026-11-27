import BackgroundTasks
import Foundation
import UserNotifications

extension Notification.Name {
    static let hubOpenArticleFromNotification = Notification.Name("hubOpenArticleFromNotification")
}

final class HubNotificationService: NSObject, UNUserNotificationCenterDelegate {
    static let shared = HubNotificationService()

    private let center = UNUserNotificationCenter.current()

    override private init() {
        super.init()
        center.delegate = self
    }

    func requestPermission() async -> Bool {
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            return granted
        } catch {
            return false
        }
    }

    func checkPermissionStatus() async -> UNAuthorizationStatus {
        let settings = await center.notificationSettings()
        return settings.authorizationStatus
    }

    func clearAppBadge() {
        Task { @MainActor in
            if #available(iOS 17.0, *) {
                try? await UNUserNotificationCenter.current().setBadgeCount(0)
            }
        }
    }

    func registerBackgroundTask() {
        BGTaskScheduler.shared.register(
            forTaskWithIdentifier: HubCatalog.bgRefreshIdentifier,
            using: nil
        ) { task in
            guard let refreshTask = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }
            self.handleAppRefresh(task: refreshTask)
        }
    }

    func scheduleNextBackgroundRefresh() {
        let prefs = HubPreferencesStore.shared.getPreferences()
        guard prefs.notificationsEnabled else {
            BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: HubCatalog.bgRefreshIdentifier)
            return
        }
        let request = BGAppRefreshTaskRequest(identifier: HubCatalog.bgRefreshIdentifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }

    private func handleAppRefresh(task: BGAppRefreshTask) {
        scheduleNextBackgroundRefresh()
        let syncTask = Task {
            do {
                _ = try await runSyncOnce(forceRefresh: false)
                task.setTaskCompleted(success: true)
            } catch {
                task.setTaskCompleted(success: false)
            }
        }
        task.expirationHandler = {
            syncTask.cancel()
        }
    }

    @discardableResult
    func runSyncOnce(forceRefresh: Bool) async throws -> Int {
        let store = HubPreferencesStore.shared
        let prefs = store.getPreferences()
        let feed = try await HubApiClient.shared.fetchNews(limit: 80, refresh: forceRefresh)
        store.saveCachedFeed(feed)

        let items = feed.items ?? []
        let announcements = feed.announcements ?? []

        let diff = NewsDiffEngine.computeDiff(
            feedItems: items,
            announcements: announcements,
            previousSeenUids: store.getSeenUids(),
            previousSeenAnnIds: store.getSeenAnnIds(),
            hasSeededBefore: store.hasSeededSeen(),
            mutedSources: prefs.mutedSources,
            urgentOnly: prefs.urgentOnly
        )

        let totalNew = diff.newItems.count + diff.newAnnouncements.count
        store.saveSeenState(
            uids: diff.updatedSeenUids,
            annIds: diff.updatedSeenAnnIds,
            newFoundCount: totalNew,
            unreadAdded: diff.newItems.map(\.uid)
        )

        if !diff.seeded && prefs.notificationsEnabled {
            for ann in diff.newAnnouncements.prefix(3) {
                await postAdminNotification(ann)
            }
            for item in diff.newItems.prefix(5) {
                await postNewsNotification(item)
            }
        }
        return totalNew
    }

    func postNewsNotification(_ item: NewsItem) async {
        let content = UNMutableNotificationContent()
        let prefix = item.urgent ? "KHẨN · " : ""
        content.title = "\(prefix)\(item.sourceShort) · \(item.topicTag)"
        content.body = item.title
        content.subtitle = "Ngày \(item.date)"
        content.sound = .default
        content.threadIdentifier = "vn.hub.news.\(item.source)"
        if item.urgent || item.source == "online" {
            content.interruptionLevel = .timeSensitive
        }
        content.userInfo = [
            "code": item.code,
            "id": item.id,
            "title": item.title,
            "url": item.url,
            "sourceName": item.sourceName,
        ]
        let req = UNNotificationRequest(
            identifier: "hub_news_\(item.uid)",
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        )
        try? await center.add(req)
    }

    func postAdminNotification(_ ann: AdminAnnouncement) async {
        let content = UNMutableNotificationContent()
        content.title = ann.urgent ? "THÔNG BÁO KHẨN · HUB News" : "Thông báo từ Quản trị viên · HUB News"
        content.body = ann.text
        content.subtitle = "\(ann.label) · Admin \(ann.author)"
        content.sound = .default
        content.interruptionLevel = .timeSensitive
        let req = UNNotificationRequest(
            identifier: "hub_ann_\(ann.id)",
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        )
        try? await center.add(req)
    }

    func sendTestNotification() async -> Bool {
        let status = await checkPermissionStatus()
        guard status == .authorized || status == .provisional || status == .ephemeral else {
            return false
        }
        let content = UNMutableNotificationContent()
        content.title = "HUB News · Thông báo đang hoạt động"
        content.subtitle = "7 cổng ĐH Ngân hàng TP.HCM"
        content.body = "Bạn sẽ nhận được thông báo ngay khi trường đăng tin mới (ưu tiên Online HUB #1)."
        content.sound = .default
        let req = UNNotificationRequest(
            identifier: "hub_test_\(Int(Date().timeIntervalSince1970))",
            content: content,
            trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
        )
        do {
            try await center.add(req)
            return true
        } catch {
            return false
        }
    }

    // Show banners even when app is in foreground (e.g., for Test Notification or live sync)
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        return [.banner, .sound, .list]
    }

    // Deep-link directly to article detail when user taps an iOS notification
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let info = response.notification.request.content.userInfo
        if let code = info["code"] as? String,
           let id = info["id"] as? String,
           !code.isEmpty, !id.isEmpty {
            await MainActor.run {
                NotificationCenter.default.post(
                    name: .hubOpenArticleFromNotification,
                    object: nil,
                    userInfo: info
                )
            }
        }
    }
}
