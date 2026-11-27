package vn.hub.news.model

import kotlinx.serialization.Serializable
import java.text.Normalizer

@Serializable
data class AuthorInfo(
    val name: String = "Huynh Viet",
    val fbUrl: String = "https://www.facebook.com/profile.php?id=61591547874181",
)

@Serializable
data class SourceMeta(
    val key: String = "",
    val code: String = "",
    val name: String = "",
    val shortName: String = "",
    val emoji: String = "",
    val url: String = "",
    val priority: Int = 99,
)

@Serializable
data class PortalHealth(
    val key: String = "",
    val ok: Boolean = false,
    val fallback: Boolean = false,
    val ms: Long = 0,
    val count: Int = 0,
    val latestDate: String = "—",
    val error: String = "",
)

@Serializable
data class AdminAnnouncement(
    val id: String = "",
    val text: String = "",
    val urgent: Boolean = false,
    val createdAt: Long = 0,
    val label: String = "",
    val author: String = "Huynh Viet",
)

@Serializable
data class NewsItem(
    val uid: String = "",
    val id: String = "",
    val code: String = "",
    val source: String = "",
    val sourceName: String = "",
    val sourceShort: String = "",
    val sourceEmoji: String = "",
    val priority: Int = 99,
    val title: String = "",
    val date: String = "",
    val ts: Long = 0,
    val url: String = "",
    val topicKey: String = "general",
    val topicLabel: String = "Thông báo HUB",
    val topicTag: String = "#ThongBaoHUB",
    val urgent: Boolean = false,
    val alsoIn: List<String> = emptyList(),
)

@Serializable
data class NewsFeedResponse(
    val ok: Boolean = false,
    val brand: String = "HUB News",
    val fetchedAt: String = "",
    val savedAt: Long = 0,
    val author: AuthorInfo = AuthorInfo(),
    val sources: List<SourceMeta> = emptyList(),
    val health: List<PortalHealth> = emptyList(),
    val announcements: List<AdminAnnouncement> = emptyList(),
    val total: Int = 0,
    val items: List<NewsItem> = emptyList(),
)

@Serializable
data class ExtraLink(
    val url: String = "",
    val label: String = "",
)

@Serializable
data class ArticleDetail(
    val code: String = "",
    val id: String = "",
    val source: String = "",
    val sourceName: String = "",
    val sourceEmoji: String = "",
    val title: String = "",
    val date: String = "",
    val sender: String = "",
    val url: String = "",
    val webUrl: String = "",
    val bodyText: String = "",
    val deadline: String = "",
    val topicKey: String = "general",
    val topicLabel: String = "Thông báo HUB",
    val topicTag: String = "#ThongBaoHUB",
    val urgent: Boolean = false,
    val pdfs: List<String> = emptyList(),
    val downloads: List<String> = emptyList(),
    val extraLinks: List<ExtraLink> = emptyList(),
)

@Serializable
data class ArticleDetailResponse(
    val ok: Boolean = false,
    val error: String = "",
    val detail: ArticleDetail? = null,
)

@Serializable
data class StatusResponse(
    val ok: Boolean = false,
    val brand: String = "HUB News",
    val fetchedAt: String = "",
    val okCount: Int = 0,
    val totalSources: Int = 7,
    val totalItems: Int = 0,
    val sources: List<SourceMeta> = emptyList(),
    val health: List<PortalHealth> = emptyList(),
)

enum class ThemeMode(val key: String, val label: String) {
    SYSTEM("system", "Hệ thống"),
    LIGHT("light", "Sáng"),
    DARK("dark", "Tối");

    companion object {
        fun fromKey(key: String?): ThemeMode = entries.firstOrNull { it.key == key } ?: SYSTEM
    }
}

enum class TimeFilter(val days: Int?, val label: String) {
    LATEST(null, "Mới nhất"),
    DAYS_7(7, "7 ngày"),
    DAYS_30(30, "30 ngày"),
}

data class TopicFilter(
    val key: String,
    val label: String,
)

data class StudentUtility(
    val title: String,
    val subtitle: String,
    val url: String,
)

data class AppPreferences(
    val notificationsEnabled: Boolean = true,
    val fastFiveMinMode: Boolean = false,
    val urgentOnly: Boolean = false,
    val mutedSources: Set<String> = emptySet(),
    val themeMode: ThemeMode = ThemeMode.SYSTEM,
    val lastSyncAtLabel: String = "Chưa kiểm tra",
    val lastSyncNewCount: Int = 0,
)

object HubCatalog {
    const val AUTHOR_NAME = "Huynh Viet"
    const val AUTHOR_FB_URL = "https://www.facebook.com/profile.php?id=61591547874181"

    val DEFAULT_SOURCES = listOf(
        SourceMeta("online", "onl", "Online HUB", "Online HUB", "🏛️", "https://online.hub.edu.vn/", 1),
        SourceMeta("ktdbcl", "kt", "Phòng Khảo thí & ĐBCL", "Khảo thí & ĐBCL", "📝", "https://phongktdbcl.hub.edu.vn/thong-bao", 2),
        SourceMeta("daotao", "dt", "Phòng Đào tạo", "Phòng Đào tạo", "🎓", "https://phongdaotao.hub.edu.vn/thong-bao", 3),
        SourceMeta("daotao_news", "dtn", "Đào tạo · Tin & Thực tập", "Đào tạo (Tin)", "📰", "https://phongdaotao.hub.edu.vn/", 4),
        SourceMeta("scc", "scc", "Trung tâm SV (SCC)", "Trung tâm SV", "🤝", "https://scc.hub.edu.vn/thong-bao", 5),
        SourceMeta("hub", "hub", "Cổng Chính HUB", "Cổng Chính HUB", "🏫", "https://hub.edu.vn/thong-bao", 6),
        SourceMeta("ketoan", "ktc", "Tài chính - Kế toán", "Tài chính - KT", "💰", "https://phongketoan.hub.edu.vn/thong-bao", 7),
    )

    val TOPICS = listOf(
        TopicFilter("all", "Tất cả chủ đề"),
        TopicFilter("urgent", "Khẩn & Lưu ý"),
        TopicFilter("exam", "Lịch thi"),
        TopicFilter("tuition", "Học phí"),
        TopicFilter("scholar", "Học bổng"),
        TopicFilter("grad", "Tốt nghiệp"),
        TopicFilter("reg", "Đào tạo"),
        TopicFilter("student", "Sinh viên"),
    )

    val QUICK_KEYWORDS = listOf(
        "lich thi",
        "hoc bong",
        "hoc phi",
        "tot nghiep",
        "thuc tap",
        "dang ky",
        "phuc khao",
        "tieng anh",
    )

    val UTILITIES = listOf(
        StudentUtility("Online HUB", "Cổng thông tin sinh viên #1", "https://online.hub.edu.vn/"),
        StudentUtility("LMS HUB", "Hệ thống học tập trực tuyến", "https://lms.hub.edu.vn/"),
        StudentUtility("Đăng ký tín chỉ", "Đăng ký học phần trực tuyến", "https://dangkytinchi.hub.edu.vn/"),
        StudentUtility("eStudent", "Cổng dịch vụ sinh viên HUB", "https://estudent.hub.edu.vn/"),
        StudentUtility("Thư viện HUB", "Tài liệu & giáo trình số", "https://library.hub.edu.vn/"),
        StudentUtility("Tra cứu văn bằng", "Xác thực văn bằng tốt nghiệp", "https://hub.edu.vn/tra-cuu-van-bang"),
    )
}

fun stripVietnameseAccents(input: String): String {
    val replaced = input.replace('đ', 'd').replace('Đ', 'D')
    val normalized = Normalizer.normalize(replaced, Normalizer.Form.NFD)
    return normalized.replace(Regex("\\p{InCombiningDiacriticalMarks}+"), "").lowercase()
}

fun prettyAttachmentName(url: String, index: Int): String {
    return try {
        val raw = java.net.URLDecoder.decode(url.substringAfterLast('/').substringBefore('?'), "UTF-8")
        val clean = raw
            .replace(Regex("^\\d{10,}-?\\d*[a-z]*-?", RegexOption.IGNORE_CASE), "")
            .replace(Regex("[_-]+"), " ")
            .replace(Regex("\\s+"), " ")
            .trim()
        when {
            clean.length >= 5 && clean.length > 34 -> clean.take(31) + "..."
            clean.length >= 5 -> clean
            else -> "Tài liệu #${index + 1}"
        }
    } catch (_: Exception) {
        "Tài liệu #${index + 1}"
    }
}

data class SyncDiffResult(
    val seeded: Boolean,
    val newItems: List<NewsItem>,
    val newAnnouncements: List<AdminAnnouncement>,
    val updatedSeenUids: Set<String>,
    val updatedSeenAnnIds: Set<String>,
)

object NewsDiffEngine {
    private const val MAX_SEEN = 450

    fun computeDiff(
        feedItems: List<NewsItem>,
        announcements: List<AdminAnnouncement>,
        previousSeenUids: Set<String>,
        previousSeenAnnIds: Set<String>,
        hasSeededBefore: Boolean,
        mutedSources: Set<String>,
        urgentOnly: Boolean,
    ): SyncDiffResult {
        val allIncomingUids = feedItems.mapNotNull { it.uid.ifBlank { null } }
        val allIncomingAnnIds = announcements.mapNotNull { it.id.ifBlank { null } }

        val mergedUids = (allIncomingUids + previousSeenUids).distinct().take(MAX_SEEN).toSet()
        val mergedAnnIds = (allIncomingAnnIds + previousSeenAnnIds).distinct().take(100).toSet()

        if (!hasSeededBefore) {
            return SyncDiffResult(
                seeded = true,
                newItems = emptyList(),
                newAnnouncements = emptyList(),
                updatedSeenUids = mergedUids,
                updatedSeenAnnIds = mergedAnnIds,
            )
        }

        val freshItems = feedItems.filter { item ->
            item.uid.isNotBlank() &&
                item.uid !in previousSeenUids &&
                item.source !in mutedSources &&
                (!urgentOnly || item.urgent)
        }

        val freshAnns = announcements.filter { ann ->
            ann.id.isNotBlank() && ann.id !in previousSeenAnnIds
        }

        return SyncDiffResult(
            seeded = false,
            newItems = freshItems,
            newAnnouncements = freshAnns,
            updatedSeenUids = mergedUids,
            updatedSeenAnnIds = mergedAnnIds,
        )
    }

    fun filterLocalItems(
        items: List<NewsItem>,
        selectedSource: String,
        selectedTopic: String,
        timeFilter: TimeFilter,
        query: String,
        nowMs: Long = System.currentTimeMillis(),
    ): List<NewsItem> {
        val cutoffTs = timeFilter.days?.let { days ->
            nowMs - days.toLong() * 86_400_000L
        }
        val normQuery = stripVietnameseAccents(query.trim())

        return items.filter { item ->
            val matchSource = selectedSource == "all" ||
                item.source == selectedSource ||
                selectedSource in item.alsoIn
            val matchTopic = when (selectedTopic) {
                "all" -> true
                "urgent" -> item.urgent
                else -> item.topicKey == selectedTopic
            }
            val matchTime = cutoffTs == null || item.ts == 0L || item.ts >= cutoffTs
            val matchQuery = normQuery.isBlank() ||
                stripVietnameseAccents(item.title).contains(normQuery) ||
                stripVietnameseAccents(item.sourceName).contains(normQuery)
            matchSource && matchTopic && matchTime && matchQuery
        }
    }
}
