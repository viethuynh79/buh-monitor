import Foundation
import SwiftUI
import UserNotifications

struct DetailPresentation: Identifiable, Equatable {
    let code: String
    let id: String
    let fallbackTitle: String
    let fallbackUrl: String
    let fallbackSource: String

    var uid: String { "\(code):\(id)" }
}

@MainActor
final class HubViewModel: ObservableObject {
    @Published var isLoading: Bool = true
    @Published var isRefreshing: Bool = false
    @Published var isCheckingStatus: Bool = false
    @Published var isSyncingNow: Bool = false
    @Published var fetchedAt: String = ""
    @Published var allItems: [NewsItem] = []
    @Published var filteredItems: [NewsItem] = []
    @Published var sources: [SourceMeta] = HubCatalog.defaultSources
    @Published var health: [PortalHealth] = []
    @Published var announcements: [AdminAnnouncement] = []
    @Published var bookmarks: [NewsItem] = []
    @Published var bookmarkedUids: Set<String> = []
    @Published var unreadUids: Set<String> = []

    @Published var selectedSource: String = "all"
    @Published var selectedTopic: String = "all"
    @Published var timeFilter: TimeFilter = .latest
    @Published var searchQuery: String = ""
    @Published var searchVisible: Bool = false

    @Published var errorMessage: String = ""
    @Published var toastMessage: String = ""
    @Published var prefs: AppPreferences = AppPreferences()
    @Published var hasNotificationPermission: Bool = true

    // Detail sheet state
    @Published var activeDetailTarget: DetailPresentation?
    @Published var detailLoading: Bool = false
    @Published var activeDetail: ArticleDetail?
    @Published var detailError: String = ""

    private let api = HubApiClient.shared
    private let store = HubPreferencesStore.shared
    private let notifier = HubNotificationService.shared

    private var normalizedIndex: [String: String] = [:]
    private var detailCache: [String: ArticleDetail] = [:]
    private var detailCacheOrder: [String] = []
    private var toastTask: Task<Void, Never>?

    init() {
        hydrateFromCache()
        Task {
            await refreshNotificationPermission()
            await refreshFeed(forceLive: false)
        }
    }

    private func rebuildSearchIndex(_ items: [NewsItem]) {
        var idx: [String: String] = [:]
        idx.reserveCapacity(items.count)
        for item in items {
            idx[item.uid] = stripVietnameseAccents("\(item.title) \(item.sourceName)")
        }
        normalizedIndex = idx
    }

    private func applyFilters() {
        filteredItems = NewsDiffEngine.filterItems(
            items: allItems,
            normalizedIndex: normalizedIndex,
            selectedSource: selectedSource,
            selectedTopic: selectedTopic,
            timeFilter: timeFilter,
            query: searchQuery
        )
    }

    private func cacheDetail(_ detail: ArticleDetail, uid: String) {
        detailCache[uid] = detail
        detailCacheOrder.removeAll { $0 == uid }
        detailCacheOrder.append(uid)
        if detailCacheOrder.count > 40, let oldest = detailCacheOrder.first {
            detailCacheOrder.removeFirst()
            detailCache.removeValue(forKey: oldest)
        }
    }

    private func prefetchTopDetails(_ items: [NewsItem]) {
        let top = Array(items.prefix(3).filter { !$0.code.isEmpty && !$0.id.isEmpty })
        guard !top.isEmpty else { return }
        Task.detached(priority: .utility) { [weak self, api] in
            for item in top {
                let uid = "\(item.code):\(item.id)"
                let exists = await MainActor.run { self?.detailCache[uid] != nil }
                if exists { continue }
                if let detail = try? await api.fetchDetail(code: item.code, id: item.id) {
                    await MainActor.run {
                        self?.cacheDetail(detail, uid: uid)
                    }
                }
            }
        }
    }

    private func hydrateFromCache() {
        prefs = store.getPreferences()
        bookmarks = store.getBookmarks()
        bookmarkedUids = Set(bookmarks.map(\.uid))
        unreadUids = store.getUnreadUids()

        if let cached = store.loadCachedFeed() {
            let items = cached.items ?? []
            allItems = items
            rebuildSearchIndex(items)
            fetchedAt = cached.fetchedAt ?? ""
            sources = (cached.sources?.isEmpty == false) ? cached.sources! : HubCatalog.defaultSources
            health = cached.health ?? []
            announcements = cached.announcements ?? []
            isLoading = false
            applyFilters()
        }
    }

    func refreshNotificationPermission() async {
        let st = await notifier.checkPermissionStatus()
        hasNotificationPermission = (st == .authorized || st == .provisional || st == .ephemeral)
    }

    func requestNotificationPermission() {
        Task {
            let granted = await notifier.requestPermission()
            hasNotificationPermission = granted
            if granted {
                notifier.scheduleNextBackgroundRefresh()
                showToast("Đã bật quyền thông báo đẩy HUB News")
            } else {
                showToast("Hãy bật Thông báo trong Cài đặt iPhone cho HUB News")
            }
        }
    }

    func refreshFeed(forceLive: Bool) async {
        isRefreshing = !allItems.isEmpty
        isLoading = allItems.isEmpty
        errorMessage = ""

        do {
            let feed = try await api.fetchNews(
                source: "all",
                topic: "all",
                days: timeFilter.days,
                limit: 120,
                refresh: forceLive
            )
            let items = feed.items ?? []
            let anns = feed.announcements ?? []
            if timeFilter == .latest {
                store.saveCachedFeed(feed)
            }
            if !store.hasSeededSeen() {
                let diff = NewsDiffEngine.computeDiff(
                    feedItems: items,
                    announcements: anns,
                    previousSeenUids: [],
                    previousSeenAnnIds: [],
                    hasSeededBefore: false,
                    mutedSources: prefs.mutedSources,
                    urgentOnly: prefs.urgentOnly
                )
                store.saveSeenState(uids: diff.updatedSeenUids, annIds: diff.updatedSeenAnnIds, newFoundCount: 0)
            }

            allItems = items
            rebuildSearchIndex(items)
            fetchedAt = feed.fetchedAt ?? ""
            sources = (feed.sources?.isEmpty == false) ? feed.sources! : HubCatalog.defaultSources
            health = feed.health ?? []
            announcements = anns
            prefs = store.getPreferences()
            isLoading = false
            isRefreshing = false
            applyFilters()
            prefetchTopDetails(items)
        } catch {
            isLoading = false
            isRefreshing = false
            errorMessage = error.localizedDescription
        }
    }

    func selectSource(_ sourceKey: String) {
        HubHaptics.selection()
        selectedSource = sourceKey
        applyFilters()
    }

    func selectTopic(_ topicKey: String) {
        HubHaptics.selection()
        selectedTopic = topicKey
        applyFilters()
    }

    func selectTimeFilter(_ filter: TimeFilter) {
        HubHaptics.selection()
        let needsRemote = (filter == .days30 || timeFilter == .days30) && filter != timeFilter
        timeFilter = filter
        applyFilters()
        if needsRemote {
            Task { await refreshFeed(forceLive: false) }
        }
    }

    func updateSearchQuery(_ q: String) {
        searchQuery = q
        applyFilters()
    }

    func toggleSearchVisible() {
        HubHaptics.light()
        searchVisible.toggle()
        if !searchVisible {
            searchQuery = ""
            applyFilters()
        }
    }

    func resetFilters() {
        HubHaptics.light()
        selectedSource = "all"
        selectedTopic = "all"
        timeFilter = .latest
        searchQuery = ""
        applyFilters()
    }

    func openArticle(_ item: NewsItem) {
        unreadUids = store.markRead(item.uid)
        openArticleByCodeId(
            code: item.code,
            id: item.id,
            fallbackTitle: item.title,
            fallbackUrl: item.url,
            fallbackSource: item.sourceName
        )
    }

    func openArticleByCodeId(
        code: String,
        id: String,
        fallbackTitle: String = "",
        fallbackUrl: String = "",
        fallbackSource: String = "",
        forceReload: Bool = false
    ) {
        guard !code.isEmpty, !id.isEmpty else { return }
        let uid = "\(code):\(id)"
        unreadUids = store.markRead(uid)

        let target = DetailPresentation(
            code: code,
            id: id,
            fallbackTitle: fallbackTitle,
            fallbackUrl: fallbackUrl,
            fallbackSource: fallbackSource
        )
        activeDetailTarget = target
        detailError = ""

        if !forceReload, let cached = detailCache[uid] {
            activeDetail = cached
            detailLoading = false
            return
        }

        activeDetail = nil
        detailLoading = true
        Task {
            do {
                let detail = try await api.fetchDetail(code: code, id: id, refresh: forceReload)
                cacheDetail(detail, uid: uid)
                if activeDetailTarget?.uid == uid {
                    activeDetail = detail
                    detailLoading = false
                }
            } catch {
                if activeDetailTarget?.uid == uid {
                    detailError = error.localizedDescription
                    detailLoading = false
                }
            }
        }
    }

    func toggleBookmark(_ item: NewsItem) {
        HubHaptics.light()
        let updated = store.toggleBookmark(item)
        bookmarks = updated
        bookmarkedUids = Set(updated.map(\.uid))
        showToast(bookmarkedUids.contains(item.uid) ? "Đã lưu thông báo để xem nhanh" : "Đã bỏ khỏi danh sách lưu")
    }

    func toggleBookmarkForCurrentDetail() {
        guard let target = activeDetailTarget else { return }
        if let existing = allItems.first(where: { $0.uid == target.uid }) {
            toggleBookmark(existing)
            return
        }
        let d = activeDetail
        let synthetic = NewsItem(
            uid: target.uid,
            id: target.id,
            code: target.code,
            source: d?.source ?? "",
            sourceName: d?.sourceName ?? target.fallbackSource,
            sourceShort: d?.sourceName ?? target.fallbackSource,
            sourceEmoji: d?.sourceEmoji ?? "📌",
            title: d?.title ?? target.fallbackTitle,
            date: d?.date ?? "—",
            url: d?.webUrl ?? target.fallbackUrl,
            topicKey: d?.topicKey ?? "general",
            topicLabel: d?.topicLabel ?? "Thông báo HUB",
            topicTag: d?.topicTag ?? "#ThongBaoHUB",
            urgent: d?.urgent ?? false
        )
        toggleBookmark(synthetic)
    }

    func markAllRead() {
        HubHaptics.light()
        store.markAllRead()
        unreadUids = []
        notifier.clearAppBadge()
        showToast("Đã đánh dấu đọc toàn bộ thông báo")
    }

    func checkPortalStatusLive() {
        guard !isCheckingStatus else { return }
        HubHaptics.light()
        isCheckingStatus = true
        Task {
            do {
                let res = try await api.fetchStatus(live: true)
                fetchedAt = res.fetchedAt ?? fetchedAt
                health = res.health ?? health
                if let s = res.sources, !s.isEmpty { sources = s }
                isCheckingStatus = false
                HubHaptics.success()
                showToast("Đã kiểm tra trực tiếp \(res.okCount ?? 0)/\(res.totalSources ?? 7) cổng HUB")
            } catch {
                isCheckingStatus = false
                showToast(error.localizedDescription)
            }
        }
    }

    func setNotificationsEnabled(_ enabled: Bool) {
        HubHaptics.light()
        store.setNotificationsEnabled(enabled)
        prefs = store.getPreferences()
        notifier.scheduleNextBackgroundRefresh()
        showToast(enabled ? "Đã bật tự động thông báo tin mới HUB" : "Đã tạm tắt thông báo tự động")
    }

    func setUrgentOnly(_ enabled: Bool) {
        HubHaptics.light()
        store.setUrgentOnly(enabled)
        prefs = store.getPreferences()
    }

    func toggleMutedSource(_ sourceKey: String) {
        HubHaptics.light()
        _ = store.toggleMutedSource(sourceKey)
        prefs = store.getPreferences()
    }

    func setThemeMode(_ mode: ThemeMode) {
        HubHaptics.selection()
        store.setThemeMode(mode)
        prefs = store.getPreferences()
    }

    func syncAndNotifyNow() {
        guard !isSyncingNow else { return }
        HubHaptics.light()
        isSyncingNow = true
        Task {
            do {
                let found = try await notifier.runSyncOnce(forceRefresh: true)
                if let cached = store.loadCachedFeed() {
                    let items = cached.items ?? []
                    allItems = items
                    rebuildSearchIndex(items)
                    fetchedAt = cached.fetchedAt ?? fetchedAt
                    announcements = cached.announcements ?? announcements
                    applyFilters()
                }
                unreadUids = store.getUnreadUids()
                prefs = store.getPreferences()
                isSyncingNow = false
                HubHaptics.success()
                showToast(found > 0
                    ? "Phát hiện \(found) thông báo mới và đã gửi báo về máy"
                    : "Đã kiểm tra 7 cổng HUB · Chưa có tin mới hơn")
            } catch {
                isSyncingNow = false
                showToast(error.localizedDescription)
            }
        }
    }

    func sendTestNotification() {
        HubHaptics.light()
        Task {
            let ok = await notifier.sendTestNotification()
            await refreshNotificationPermission()
            if ok {
                HubHaptics.success()
                showToast("Đã gửi thông báo thử (hiển thị sau 1 giây)")
            } else {
                showToast("Vui lòng cấp quyền Thông báo trước khi thử")
            }
        }
    }

    func showToast(_ message: String) {
        toastTask?.cancel()
        withAnimation(.easeInOut(duration: 0.2)) {
            toastMessage = message
        }
        toastTask = Task {
            try? await Task.sleep(nanoseconds: 2_600_000_000)
            guard !Task.isCancelled else { return }
            withAnimation(.easeInOut(duration: 0.25)) {
                toastMessage = ""
            }
        }
    }
}
