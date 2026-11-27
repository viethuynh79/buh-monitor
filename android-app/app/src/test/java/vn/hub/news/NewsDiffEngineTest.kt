package vn.hub.news

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import vn.hub.news.model.AdminAnnouncement
import vn.hub.news.model.NewsDiffEngine
import vn.hub.news.model.NewsFeedResponse
import vn.hub.news.model.NewsItem
import vn.hub.news.model.TimeFilter
import vn.hub.news.model.stripVietnameseAccents

class NewsDiffEngineTest {
    private val sampleItems = listOf(
        NewsItem(
            uid = "onl:4800",
            id = "4800",
            code = "onl",
            source = "online",
            sourceName = "Online HUB",
            sourceShort = "Online HUB",
            title = "Thông báo đăng ký học phần HK2 và hạn cuối nộp học phí",
            date = "27/11/2026",
            ts = 1_795_737_600_000L,
            topicKey = "reg",
            urgent = true,
        ),
        NewsItem(
            uid = "kt:901",
            id = "901",
            code = "kt",
            source = "ktdbcl",
            sourceName = "Phòng Khảo thí & ĐBCL",
            sourceShort = "Khảo thí & ĐBCL",
            title = "Lịch thi kết thúc học phần đợt 1",
            date = "27/11/2026",
            ts = 1_795_737_600_000L,
            topicKey = "exam",
            urgent = false,
        ),
        NewsItem(
            uid = "scc:501",
            id = "501",
            code = "scc",
            source = "scc",
            sourceName = "Trung tâm SV (SCC)",
            sourceShort = "Trung tâm SV",
            title = "Học bổng khuyến khích học tập năm 2026",
            date = "25/11/2026",
            ts = 1_795_564_800_000L,
            topicKey = "scholar",
            urgent = false,
        ),
    )

    @Test
    fun firstLaunchSeedsSilentlyWithoutSpam() {
        val diff = NewsDiffEngine.computeDiff(
            feedItems = sampleItems,
            announcements = listOf(AdminAnnouncement(id = "bc_1", text = "Chào mừng")),
            previousSeenUids = emptySet(),
            previousSeenAnnIds = emptySet(),
            hasSeededBefore = false,
            mutedSources = emptySet(),
            urgentOnly = false,
        )
        assertTrue(diff.seeded)
        assertTrue(diff.newItems.isEmpty())
        assertTrue(diff.newAnnouncements.isEmpty())
        assertEquals(3, diff.updatedSeenUids.size)
        assertEquals(1, diff.updatedSeenAnnIds.size)
    }

    @Test
    fun subsequentSyncDetectsNewItemsAndRespectsMutedPortals() {
        val diff = NewsDiffEngine.computeDiff(
            feedItems = sampleItems,
            announcements = listOf(AdminAnnouncement(id = "bc_2", text = "Thông báo khẩn", urgent = true)),
            previousSeenUids = setOf("onl:4800"),
            previousSeenAnnIds = setOf("bc_1"),
            hasSeededBefore = true,
            mutedSources = setOf("scc"),
            urgentOnly = false,
        )
        assertFalse(diff.seeded)
        assertEquals(listOf("kt:901"), diff.newItems.map { it.uid })
        assertEquals(listOf("bc_2"), diff.newAnnouncements.map { it.id })
    }

    @Test
    fun urgentOnlyFilterKeepsOnlyUrgentNotices() {
        val diff = NewsDiffEngine.computeDiff(
            feedItems = sampleItems,
            announcements = emptyList(),
            previousSeenUids = emptySet(),
            previousSeenAnnIds = emptySet(),
            hasSeededBefore = true,
            mutedSources = emptySet(),
            urgentOnly = true,
        )
        assertEquals(listOf("onl:4800"), diff.newItems.map { it.uid })
    }

    @Test
    fun vietnameseDiacriticInsensitiveSearchMatchesCorrectly() {
        assertEquals("hoc bong khuyen khich", stripVietnameseAccents("Học bổng Khuyến Khích"))
        val filtered = NewsDiffEngine.filterLocalItems(
            items = sampleItems,
            selectedSource = "all",
            selectedTopic = "all",
            timeFilter = TimeFilter.LATEST,
            query = "hoc bong",
        )
        assertEquals(1, filtered.size)
        assertEquals("scc:501", filtered.first().uid)
    }

    @Test
    fun parsesRealCloudflareApiPayload() {
        val raw = """
            {
              "ok": true,
              "brand": "HUB News",
              "fetchedAt": "01:05 · 28/11/2026",
              "savedAt": 1795799100000,
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
        """.trimIndent()
        val json = Json { ignoreUnknownKeys = true }
        val parsed = json.decodeFromString(NewsFeedResponse.serializer(), raw)
        assertTrue(parsed.ok)
        assertEquals("HUB News", parsed.brand)
        assertEquals(1, parsed.items.size)
        assertEquals("onl:4800", parsed.items.first().uid)
    }
}
