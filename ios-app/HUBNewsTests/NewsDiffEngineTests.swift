import XCTest
@testable import HUBNews

final class NewsDiffEngineTests: XCTestCase {
    private let sampleItems: [NewsItem] = [
        NewsItem(
            uid: "onl:4800",
            id: "4800",
            code: "onl",
            source: "online",
            sourceName: "Online HUB",
            sourceShort: "Online HUB",
            title: "Thông báo đăng ký học phần HK2 và hạn cuối nộp học phí",
            date: "27/11/2026",
            ts: 1_795_737_600_000,
            topicKey: "reg",
            urgent: true
        ),
        NewsItem(
            uid: "kt:901",
            id: "901",
            code: "kt",
            source: "ktdbcl",
            sourceName: "Phòng Khảo thí & ĐBCL",
            sourceShort: "Khảo thí & ĐBCL",
            title: "Lịch thi kết thúc học phần đợt 1",
            date: "27/11/2026",
            ts: 1_795_737_600_000,
            topicKey: "exam",
            urgent: false
        ),
        NewsItem(
            uid: "scc:501",
            id: "501",
            code: "scc",
            source: "scc",
            sourceName: "Trung tâm SV (SCC)",
            sourceShort: "Trung tâm SV",
            title: "Học bổng khuyến khích học tập năm 2026",
            date: "25/11/2026",
            ts: 1_795_564_800_000,
            topicKey: "scholar",
            urgent: false
        ),
    ]

    func testFirstLaunchSeedsSilentlyWithoutSpam() {
        let diff = NewsDiffEngine.computeDiff(
            feedItems: sampleItems,
            announcements: [AdminAnnouncement(id: "bc_1", text: "Chào mừng", urgent: false, createdAt: 1, label: "02:00", author: "Huynh Viet")],
            previousSeenUids: [],
            previousSeenAnnIds: [],
            hasSeededBefore: false,
            mutedSources: [],
            urgentOnly: false
        )
        XCTAssertTrue(diff.seeded)
        XCTAssertTrue(diff.newItems.isEmpty)
        XCTAssertTrue(diff.newAnnouncements.isEmpty)
        XCTAssertEqual(diff.updatedSeenUids.count, 3)
        XCTAssertEqual(diff.updatedSeenAnnIds.count, 1)
    }

    func testSubsequentSyncDetectsNewItemsAndRespectsMutedPortals() {
        let diff = NewsDiffEngine.computeDiff(
            feedItems: sampleItems,
            announcements: [AdminAnnouncement(id: "bc_2", text: "Khẩn", urgent: true, createdAt: 2, label: "02:05", author: "Huynh Viet")],
            previousSeenUids: ["onl:4800"],
            previousSeenAnnIds: ["bc_1"],
            hasSeededBefore: true,
            mutedSources: ["scc"],
            urgentOnly: false
        )
        XCTAssertFalse(diff.seeded)
        XCTAssertEqual(diff.newItems.map(\.uid), ["kt:901"])
        XCTAssertEqual(diff.newAnnouncements.map(\.id), ["bc_2"])
    }

    func testUrgentOnlyFilterKeepsOnlyUrgentNotices() {
        let diff = NewsDiffEngine.computeDiff(
            feedItems: sampleItems,
            announcements: [],
            previousSeenUids: [],
            previousSeenAnnIds: [],
            hasSeededBefore: true,
            mutedSources: [],
            urgentOnly: true
        )
        XCTAssertEqual(diff.newItems.map(\.uid), ["onl:4800"])
    }

    func testVietnameseDiacriticInsensitiveSearch() {
        XCTAssertEqual(stripVietnameseAccents("Học bổng ĐH Ngân hàng"), "hoc bong dh ngan hang")
        let filtered = NewsDiffEngine.filterItems(
            items: sampleItems,
            selectedSource: "all",
            selectedTopic: "all",
            timeFilter: .latest,
            query: "hoc bong"
        )
        XCTAssertEqual(filtered.map(\.uid), ["scc:501"])
    }

    func testParsesCloudflareApiPayload() throws {
        let raw = """
        {
          "ok": true,
          "brand": "HUB News",
          "fetchedAt": "02:30 · 28/11/2026",
          "savedAt": 1795804200000,
          "total": 1,
          "items": [
            {
              "uid": "onl:4800",
              "id": "4800",
              "code": "onl",
              "source": "online",
              "sourceName": "Online HUB",
              "sourceShort": "Online HUB",
              "title": "Quyết định trợ cấp xã hội",
              "date": "27/11/2026",
              "ts": 1795737600000,
              "url": "https://online.hub.edu.vn/Messages.aspx?id=4800",
              "topicKey": "tuition",
              "topicTag": "#HocPhi",
              "urgent": false,
              "alsoIn": []
            }
          ]
        }
        """.data(using: .utf8)!
        let parsed = try JSONDecoder().decode(NewsFeedResponse.self, from: raw)
        XCTAssertTrue(parsed.ok)
        XCTAssertEqual(parsed.brand, "HUB News")
        XCTAssertEqual(parsed.items?.first?.uid, "onl:4800")
    }
}
