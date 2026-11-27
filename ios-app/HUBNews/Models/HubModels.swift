import Foundation

struct AuthorInfo: Codable, Equatable {
    var name: String = "Huynh Viet"
    var fbUrl: String = "https://www.facebook.com/profile.php?id=61591547874181"
}

struct SourceMeta: Codable, Identifiable, Equatable {
    var key: String
    var code: String
    var name: String
    var shortName: String
    var emoji: String
    var url: String
    var priority: Int

    var id: String { key }
}

struct PortalHealth: Codable, Identifiable, Equatable {
    var key: String
    var ok: Bool
    var fallback: Bool
    var ms: Int
    var count: Int
    var latestDate: String
    var error: String

    var id: String { key }
}

struct AdminAnnouncement: Codable, Identifiable, Equatable {
    var id: String
    var text: String
    var urgent: Bool
    var createdAt: Int64
    var label: String
    var author: String
}

struct NewsItem: Codable, Identifiable, Equatable {
    var uid: String
    var id: String
    var code: String
    var source: String
    var sourceName: String
    var sourceShort: String
    var sourceEmoji: String
    var priority: Int
    var title: String
    var date: String
    var ts: Int64
    var url: String
    var topicKey: String
    var topicLabel: String
    var topicTag: String
    var urgent: Bool
    var alsoIn: [String]

    enum CodingKeys: String, CodingKey {
        case uid, id, code, source, sourceName, sourceShort, sourceEmoji, priority
        case title, date, ts, url, topicKey, topicLabel, topicTag, urgent, alsoIn
    }

    init(
        uid: String = "",
        id: String = "",
        code: String = "",
        source: String = "",
        sourceName: String = "",
        sourceShort: String = "",
        sourceEmoji: String = "",
        priority: Int = 99,
        title: String = "",
        date: String = "",
        ts: Int64 = 0,
        url: String = "",
        topicKey: String = "general",
        topicLabel: String = "Thông báo HUB",
        topicTag: String = "#ThongBaoHUB",
        urgent: Bool = false,
        alsoIn: [String] = []
    ) {
        self.uid = uid
        self.id = id
        self.code = code
        self.source = source
        self.sourceName = sourceName
        self.sourceShort = sourceShort
        self.sourceEmoji = sourceEmoji
        self.priority = priority
        self.title = title
        self.date = date
        self.ts = ts
        self.url = url
        self.topicKey = topicKey
        self.topicLabel = topicLabel
        self.topicTag = topicTag
        self.urgent = urgent
        self.alsoIn = alsoIn
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        uid = (try? c.decode(String.self, forKey: .uid)) ?? ""
        id = (try? c.decode(String.self, forKey: .id)) ?? ""
        code = (try? c.decode(String.self, forKey: .code)) ?? ""
        source = (try? c.decode(String.self, forKey: .source)) ?? ""
        sourceName = (try? c.decode(String.self, forKey: .sourceName)) ?? ""
        sourceShort = (try? c.decode(String.self, forKey: .sourceShort)) ?? ""
        sourceEmoji = (try? c.decode(String.self, forKey: .sourceEmoji)) ?? ""
        priority = (try? c.decode(Int.self, forKey: .priority)) ?? 99
        title = (try? c.decode(String.self, forKey: .title)) ?? ""
        date = (try? c.decode(String.self, forKey: .date)) ?? ""
        ts = (try? c.decode(Int64.self, forKey: .ts)) ?? 0
        url = (try? c.decode(String.self, forKey: .url)) ?? ""
        topicKey = (try? c.decode(String.self, forKey: .topicKey)) ?? "general"
        topicLabel = (try? c.decode(String.self, forKey: .topicLabel)) ?? "Thông báo HUB"
        topicTag = (try? c.decode(String.self, forKey: .topicTag)) ?? "#ThongBaoHUB"
        urgent = (try? c.decode(Bool.self, forKey: .urgent)) ?? false
        alsoIn = (try? c.decode([String].self, forKey: .alsoIn)) ?? []
    }
}

struct NewsFeedResponse: Codable {
    var ok: Bool
    var brand: String?
    var fetchedAt: String?
    var savedAt: Int64?
    var author: AuthorInfo?
    var sources: [SourceMeta]?
    var health: [PortalHealth]?
    var announcements: [AdminAnnouncement]?
    var total: Int?
    var items: [NewsItem]?
}

struct ExtraLink: Codable, Identifiable, Equatable {
    var url: String
    var label: String
    var id: String { url }
}

struct ArticleDetail: Codable, Equatable {
    var code: String
    var id: String
    var source: String
    var sourceName: String
    var sourceEmoji: String
    var title: String
    var date: String
    var sender: String
    var url: String
    var webUrl: String
    var bodyText: String
    var deadline: String
    var topicKey: String
    var topicLabel: String
    var topicTag: String
    var urgent: Bool
    var pdfs: [String]
    var downloads: [String]
    var extraLinks: [ExtraLink]

    enum CodingKeys: String, CodingKey {
        case code, id, source, sourceName, sourceEmoji, title, date, sender
        case url, webUrl, bodyText, deadline, topicKey, topicLabel, topicTag
        case urgent, pdfs, downloads, extraLinks
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        code = (try? c.decode(String.self, forKey: .code)) ?? ""
        id = (try? c.decode(String.self, forKey: .id)) ?? ""
        source = (try? c.decode(String.self, forKey: .source)) ?? ""
        sourceName = (try? c.decode(String.self, forKey: .sourceName)) ?? ""
        sourceEmoji = (try? c.decode(String.self, forKey: .sourceEmoji)) ?? ""
        title = (try? c.decode(String.self, forKey: .title)) ?? ""
        date = (try? c.decode(String.self, forKey: .date)) ?? ""
        sender = (try? c.decode(String.self, forKey: .sender)) ?? ""
        url = (try? c.decode(String.self, forKey: .url)) ?? ""
        webUrl = (try? c.decode(String.self, forKey: .webUrl)) ?? ""
        bodyText = (try? c.decode(String.self, forKey: .bodyText)) ?? ""
        deadline = (try? c.decode(String.self, forKey: .deadline)) ?? ""
        topicKey = (try? c.decode(String.self, forKey: .topicKey)) ?? "general"
        topicLabel = (try? c.decode(String.self, forKey: .topicLabel)) ?? "Thông báo HUB"
        topicTag = (try? c.decode(String.self, forKey: .topicTag)) ?? "#ThongBaoHUB"
        urgent = (try? c.decode(Bool.self, forKey: .urgent)) ?? false
        pdfs = (try? c.decode([String].self, forKey: .pdfs)) ?? []
        downloads = (try? c.decode([String].self, forKey: .downloads)) ?? []
        extraLinks = (try? c.decode([ExtraLink].self, forKey: .extraLinks)) ?? []
    }
}

struct ArticleDetailResponse: Codable {
    var ok: Bool
    var error: String?
    var detail: ArticleDetail?
}

struct StatusResponse: Codable {
    var ok: Bool
    var brand: String?
    var fetchedAt: String?
    var okCount: Int?
    var totalSources: Int?
    var totalItems: Int?
    var sources: [SourceMeta]?
    var health: [PortalHealth]?
}

enum ThemeMode: String, CaseIterable, Identifiable {
    case system = "system"
    case light = "light"
    case dark = "dark"

    var id: String { rawValue }

    var label: String {
        switch self {
        case .system: return "Hệ thống"
        case .light: return "Sáng"
        case .dark: return "Tối"
        }
    }
}

enum TimeFilter: String, CaseIterable, Identifiable {
    case latest = "latest"
    case days7 = "7"
    case days30 = "30"

    var id: String { rawValue }

    var days: Int? {
        switch self {
        case .latest: return nil
        case .days7: return 7
        case .days30: return 30
        }
    }

    var label: String {
        switch self {
        case .latest: return "Mới nhất"
        case .days7: return "7 ngày"
        case .days30: return "30 ngày"
        }
    }
}

struct TopicFilter: Identifiable, Equatable {
    let key: String
    let label: String
    var id: String { key }
}

struct StudentUtility: Identifiable, Equatable {
    let title: String
    let subtitle: String
    let url: String
    var id: String { url }
}

struct AppPreferences: Equatable {
    var notificationsEnabled: Bool = true
    var urgentOnly: Bool = false
    var mutedSources: Set<String> = []
    var themeMode: ThemeMode = .system
    var lastSyncAtLabel: String = "Chưa kiểm tra"
    var lastSyncNewCount: Int = 0
}

enum HubCatalog {
    static let apiBaseURL = "https://buh-monitor.khanhvietcyber.workers.dev"
    static let authorName = "Huynh Viet"
    static let authorFacebookURL = "https://www.facebook.com/profile.php?id=61591547874181"
    static let bgRefreshIdentifier = "vn.hub.news.refresh"

    static let defaultSources: [SourceMeta] = [
        SourceMeta(key: "online", code: "onl", name: "Online HUB", shortName: "Online HUB", emoji: "🏛️", url: "https://online.hub.edu.vn/", priority: 1),
        SourceMeta(key: "ktdbcl", code: "kt", name: "Phòng Khảo thí & ĐBCL", shortName: "Khảo thí & ĐBCL", emoji: "📝", url: "https://phongktdbcl.hub.edu.vn/thong-bao", priority: 2),
        SourceMeta(key: "daotao", code: "dt", name: "Phòng Đào tạo", shortName: "Phòng Đào tạo", emoji: "🎓", url: "https://phongdaotao.hub.edu.vn/thong-bao", priority: 3),
        SourceMeta(key: "daotao_news", code: "dtn", name: "Đào tạo · Tin & Thực tập", shortName: "Đào tạo (Tin)", emoji: "📰", url: "https://phongdaotao.hub.edu.vn/", priority: 4),
        SourceMeta(key: "scc", code: "scc", name: "Trung tâm SV (SCC)", shortName: "Trung tâm SV", emoji: "🤝", url: "https://scc.hub.edu.vn/thong-bao", priority: 5),
        SourceMeta(key: "hub", code: "hub", name: "Cổng Chính HUB", shortName: "Cổng Chính HUB", emoji: "🏫", url: "https://hub.edu.vn/thong-bao", priority: 6),
        SourceMeta(key: "ketoan", code: "ktc", name: "Tài chính - Kế toán", shortName: "Tài chính - KT", emoji: "💰", url: "https://phongketoan.hub.edu.vn/thong-bao", priority: 7),
    ]

    static let topics: [TopicFilter] = [
        TopicFilter(key: "all", label: "Tất cả chủ đề"),
        TopicFilter(key: "urgent", label: "Khẩn & Lưu ý"),
        TopicFilter(key: "exam", label: "Lịch thi"),
        TopicFilter(key: "tuition", label: "Học phí"),
        TopicFilter(key: "scholar", label: "Học bổng"),
        TopicFilter(key: "grad", label: "Tốt nghiệp"),
        TopicFilter(key: "reg", label: "Đào tạo"),
        TopicFilter(key: "student", label: "Sinh viên"),
    ]

    static let quickKeywords: [String] = [
        "lich thi", "hoc bong", "hoc phi", "tot nghiep",
        "thuc tap", "dang ky", "phuc khao", "tieng anh",
    ]

    static let utilities: [StudentUtility] = [
        StudentUtility(title: "Online HUB", subtitle: "Cổng thông tin sinh viên #1", url: "https://online.hub.edu.vn/"),
        StudentUtility(title: "LMS HUB", subtitle: "Hệ thống học tập trực tuyến", url: "https://lms.hub.edu.vn/"),
        StudentUtility(title: "Đăng ký tín chỉ", subtitle: "Đăng ký học phần trực tuyến", url: "https://dangkytinchi.hub.edu.vn/"),
        StudentUtility(title: "eStudent", subtitle: "Cổng dịch vụ sinh viên HUB", url: "https://estudent.hub.edu.vn/"),
        StudentUtility(title: "Thư viện HUB", subtitle: "Tài liệu & giáo trình số", url: "https://library.hub.edu.vn/"),
        StudentUtility(title: "Tra cứu văn bằng", subtitle: "Xác thực văn bằng tốt nghiệp", url: "https://hub.edu.vn/tra-cuu-van-bang"),
    ]
}

func stripVietnameseAccents(_ input: String) -> String {
    let replaced = input
        .replacingOccurrences(of: "đ", with: "d")
        .replacingOccurrences(of: "Đ", with: "D")
    return replaced.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "vi_VN"))
}

func prettyAttachmentName(_ urlString: String, index: Int) -> String {
    let tail = urlString.components(separatedBy: "/").last ?? ""
    let cleanPart = tail.components(separatedBy: "?").first ?? ""
    let decoded = cleanPart.removingPercentEncoding ?? cleanPart
    let stripped = decoded
        .replacingOccurrences(of: #"^\d{10,}-?\d*[a-zA-Z]*-?"#, with: "", options: .regularExpression)
        .replacingOccurrences(of: #"[_-]+"#, with: " ", options: .regularExpression)
        .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
        .trimmingCharacters(in: .whitespacesAndNewlines)
    if stripped.count >= 5 {
        return stripped.count > 36 ? String(stripped.prefix(33)) + "..." : stripped
    }
    return "Tài liệu #\(index + 1)"
}

struct SyncDiffResult {
    let seeded: Bool
    let newItems: [NewsItem]
    let newAnnouncements: [AdminAnnouncement]
    let updatedSeenUids: Set<String>
    let updatedSeenAnnIds: Set<String>
}

enum NewsDiffEngine {
    static let maxSeen = 450

    static func computeDiff(
        feedItems: [NewsItem],
        announcements: [AdminAnnouncement],
        previousSeenUids: Set<String>,
        previousSeenAnnIds: Set<String>,
        hasSeededBefore: Bool,
        mutedSources: Set<String>,
        urgentOnly: Bool
    ) -> SyncDiffResult {
        let incomingUids = feedItems.map(\.uid).filter { !$0.isEmpty }
        let incomingAnnIds = announcements.map(\.id).filter { !$0.isEmpty }

        var mergedUidArr: [String] = []
        var seenSet = Set<String>()
        for u in incomingUids + Array(previousSeenUids) where seenSet.insert(u).inserted {
            mergedUidArr.append(u)
            if mergedUidArr.count >= maxSeen { break }
        }
        let mergedUids = Set(mergedUidArr)

        var mergedAnnArr: [String] = []
        var seenAnnSet = Set<String>()
        for a in incomingAnnIds + Array(previousSeenAnnIds) where seenAnnSet.insert(a).inserted {
            mergedAnnArr.append(a)
            if mergedAnnArr.count >= 100 { break }
        }
        let mergedAnnIds = Set(mergedAnnArr)

        if !hasSeededBefore {
            return SyncDiffResult(
                seeded: true,
                newItems: [],
                newAnnouncements: [],
                updatedSeenUids: mergedUids,
                updatedSeenAnnIds: mergedAnnIds
            )
        }

        let freshItems = feedItems.filter { item in
            !item.uid.isEmpty &&
                !previousSeenUids.contains(item.uid) &&
                !mutedSources.contains(item.source) &&
                (!urgentOnly || item.urgent)
        }

        let freshAnns = announcements.filter { ann in
            !ann.id.isEmpty && !previousSeenAnnIds.contains(ann.id)
        }

        return SyncDiffResult(
            seeded: false,
            newItems: freshItems,
            newAnnouncements: freshAnns,
            updatedSeenUids: mergedUids,
            updatedSeenAnnIds: mergedAnnIds
        )
    }

    static func filterItems(
        items: [NewsItem],
        normalizedIndex: [String: String] = [:],
        selectedSource: String,
        selectedTopic: String,
        timeFilter: TimeFilter,
        query: String,
        nowMs: Int64 = Int64(Date().timeIntervalSince1970 * 1000)
    ) -> [NewsItem] {
        let cutoffTs: Int64? = timeFilter.days.map { days in
            nowMs - Int64(days) * 86_400_000
        }
        let normQuery = stripVietnameseAccents(query.trimmingCharacters(in: .whitespacesAndNewlines))

        return items.filter { item in
            let matchSource = selectedSource == "all" ||
                item.source == selectedSource ||
                item.alsoIn.contains(selectedSource)
            let matchTopic: Bool
            switch selectedTopic {
            case "all": matchTopic = true
            case "urgent": matchTopic = item.urgent
            default: matchTopic = item.topicKey == selectedTopic
            }
            let matchTime = cutoffTs == nil || item.ts == 0 || item.ts >= cutoffTs!
            let matchQuery: Bool
            if normQuery.isEmpty {
                matchQuery = true
            } else {
                let hay = normalizedIndex[item.uid] ?? stripVietnameseAccents("\(item.title) \(item.sourceName)")
                matchQuery = hay.contains(normQuery)
            }
            return matchSource && matchTopic && matchTime && matchQuery
        }
    }
}
