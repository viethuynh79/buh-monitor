import Foundation

final class HubPreferencesStore {
    static let shared = HubPreferencesStore()

    private let defaults: UserDefaults
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    private enum Keys {
        static let notifyEnabled = "hub_notify_enabled_v1"
        static let urgentOnly = "hub_urgent_only_v1"
        static let mutedSources = "hub_muted_sources_v1"
        static let themeMode = "hub_theme_mode_v1"
        static let hasSeeded = "hub_has_seeded_v1"
        static let seenUids = "hub_seen_uids_v1"
        static let seenAnnIds = "hub_seen_ann_ids_v1"
        static let unreadUids = "hub_unread_uids_v1"
        static let cachedFeed = "hub_cached_feed_v1"
        static let bookmarks = "hub_bookmarks_v1"
        static let lastSyncLabel = "hub_last_sync_label_v1"
        static let lastSyncNewCount = "hub_last_sync_new_count_v1"
    }

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    func getPreferences() -> AppPreferences {
        let notifyEnabled = defaults.object(forKey: Keys.notifyEnabled) == nil
            ? true
            : defaults.bool(forKey: Keys.notifyEnabled)
        let urgentOnly = defaults.bool(forKey: Keys.urgentOnly)
        let muted = Set(defaults.stringArray(forKey: Keys.mutedSources) ?? [])
        let theme = ThemeMode(rawValue: defaults.string(forKey: Keys.themeMode) ?? "") ?? .system
        let lastLabel = defaults.string(forKey: Keys.lastSyncLabel) ?? "Chưa kiểm tra"
        let lastCount = defaults.integer(forKey: Keys.lastSyncNewCount)
        return AppPreferences(
            notificationsEnabled: notifyEnabled,
            urgentOnly: urgentOnly,
            mutedSources: muted,
            themeMode: theme,
            lastSyncAtLabel: lastLabel,
            lastSyncNewCount: lastCount
        )
    }

    func setNotificationsEnabled(_ enabled: Bool) {
        defaults.set(enabled, forKey: Keys.notifyEnabled)
    }

    func setUrgentOnly(_ enabled: Bool) {
        defaults.set(enabled, forKey: Keys.urgentOnly)
    }

    func toggleMutedSource(_ sourceKey: String) -> Set<String> {
        var current = Set(defaults.stringArray(forKey: Keys.mutedSources) ?? [])
        if current.contains(sourceKey) {
            current.remove(sourceKey)
        } else {
            current.insert(sourceKey)
        }
        defaults.set(Array(current), forKey: Keys.mutedSources)
        return current
    }

    func setThemeMode(_ mode: ThemeMode) {
        defaults.set(mode.rawValue, forKey: Keys.themeMode)
    }

    func hasSeededSeen() -> Bool {
        defaults.bool(forKey: Keys.hasSeeded)
    }

    func getSeenUids() -> Set<String> {
        Set(defaults.stringArray(forKey: Keys.seenUids) ?? [])
    }

    func getSeenAnnIds() -> Set<String> {
        Set(defaults.stringArray(forKey: Keys.seenAnnIds) ?? [])
    }

    func saveSeenState(
        uids: Set<String>,
        annIds: Set<String>,
        newFoundCount: Int,
        unreadAdded: [String] = []
    ) {
        let df = DateFormatter()
        df.locale = Locale(identifier: "vi_VN")
        df.dateFormat = "HH:mm · dd/MM/yyyy"
        let nowLabel = df.string(from: Date())

        let updatedUnread = Array(getUnreadUids().union(unreadAdded)).prefix(200)
        defaults.set(true, forKey: Keys.hasSeeded)
        defaults.set(Array(uids), forKey: Keys.seenUids)
        defaults.set(Array(annIds), forKey: Keys.seenAnnIds)
        defaults.set(Array(updatedUnread), forKey: Keys.unreadUids)
        defaults.set(nowLabel, forKey: Keys.lastSyncLabel)
        defaults.set(newFoundCount, forKey: Keys.lastSyncNewCount)
    }

    func getUnreadUids() -> Set<String> {
        Set(defaults.stringArray(forKey: Keys.unreadUids) ?? [])
    }

    func markRead(_ uid: String) -> Set<String> {
        var current = getUnreadUids()
        current.remove(uid)
        defaults.set(Array(current), forKey: Keys.unreadUids)
        return current
    }

    func markAllRead() {
        defaults.set([String](), forKey: Keys.unreadUids)
    }

    func saveCachedFeed(_ feed: NewsFeedResponse) {
        if let data = try? encoder.encode(feed) {
            defaults.set(data, forKey: Keys.cachedFeed)
        }
    }

    func loadCachedFeed() -> NewsFeedResponse? {
        guard let data = defaults.data(forKey: Keys.cachedFeed) else { return nil }
        return try? decoder.decode(NewsFeedResponse.self, from: data)
    }

    func getBookmarks() -> [NewsItem] {
        guard let data = defaults.data(forKey: Keys.bookmarks),
              let list = try? decoder.decode([NewsItem].self, from: data) else {
            return []
        }
        return list
    }

    func toggleBookmark(_ item: NewsItem) -> [NewsItem] {
        var list = getBookmarks()
        if let idx = list.firstIndex(where: { $0.uid == item.uid }) {
            list.remove(at: idx)
        } else {
            list.insert(item, at: 0)
        }
        let capped = Array(list.prefix(100))
        if let data = try? encoder.encode(capped) {
            defaults.set(data, forKey: Keys.bookmarks)
        }
        return capped
    }
}
