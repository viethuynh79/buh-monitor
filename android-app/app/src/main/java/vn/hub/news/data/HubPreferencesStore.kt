package vn.hub.news.data

import android.content.Context
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.Json
import vn.hub.news.model.AppPreferences
import vn.hub.news.model.NewsFeedResponse
import vn.hub.news.model.NewsItem
import vn.hub.news.model.ThemeMode
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class HubPreferencesStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
    }

    fun getPreferences(): AppPreferences {
        return AppPreferences(
            notificationsEnabled = prefs.getBoolean(KEY_NOTIFY_ENABLED, true),
            fastFiveMinMode = prefs.getBoolean(KEY_FAST_MODE, false),
            urgentOnly = prefs.getBoolean(KEY_URGENT_ONLY, false),
            mutedSources = prefs.getStringSet(KEY_MUTED_SOURCES, emptySet())?.toSet() ?: emptySet(),
            themeMode = ThemeMode.fromKey(prefs.getString(KEY_THEME_MODE, ThemeMode.SYSTEM.key)),
            lastSyncAtLabel = prefs.getString(KEY_LAST_SYNC_LABEL, "Chưa kiểm tra") ?: "Chưa kiểm tra",
            lastSyncNewCount = prefs.getInt(KEY_LAST_SYNC_NEW_COUNT, 0),
        )
    }

    fun setNotificationsEnabled(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_NOTIFY_ENABLED, enabled).apply()
    }

    fun setFastFiveMinMode(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_FAST_MODE, enabled).apply()
    }

    fun setUrgentOnly(enabled: Boolean) {
        prefs.edit().putBoolean(KEY_URGENT_ONLY, enabled).apply()
    }

    fun toggleMutedSource(sourceKey: String): Set<String> {
        val current = (prefs.getStringSet(KEY_MUTED_SOURCES, emptySet()) ?: emptySet()).toMutableSet()
        if (!current.add(sourceKey)) {
            current.remove(sourceKey)
        }
        prefs.edit().putStringSet(KEY_MUTED_SOURCES, current).apply()
        return current.toSet()
    }

    fun setThemeMode(mode: ThemeMode) {
        prefs.edit().putString(KEY_THEME_MODE, mode.key).apply()
    }

    fun hasSeededSeen(): Boolean = prefs.getBoolean(KEY_HAS_SEEDED, false)

    fun getSeenUids(): Set<String> =
        prefs.getStringSet(KEY_SEEN_UIDS, emptySet())?.toSet() ?: emptySet()

    fun getSeenAnnIds(): Set<String> =
        prefs.getStringSet(KEY_SEEN_ANN_IDS, emptySet())?.toSet() ?: emptySet()

    fun saveSeenState(
        uids: Set<String>,
        annIds: Set<String>,
        newFoundCount: Int,
        unreadAdded: List<String> = emptyList(),
    ) {
        val nowLabel = SimpleDateFormat("HH:mm · dd/MM/yyyy", Locale("vi", "VN")).format(Date())
        val updatedUnread = (getUnreadUids() + unreadAdded).take(200).toSet()
        prefs.edit()
            .putBoolean(KEY_HAS_SEEDED, true)
            .putStringSet(KEY_SEEN_UIDS, uids)
            .putStringSet(KEY_SEEN_ANN_IDS, annIds)
            .putStringSet(KEY_UNREAD_UIDS, updatedUnread)
            .putString(KEY_LAST_SYNC_LABEL, nowLabel)
            .putInt(KEY_LAST_SYNC_NEW_COUNT, newFoundCount)
            .apply()
    }

    fun getUnreadUids(): Set<String> =
        prefs.getStringSet(KEY_UNREAD_UIDS, emptySet())?.toSet() ?: emptySet()

    fun markRead(uid: String): Set<String> {
        val next = getUnreadUids().toMutableSet()
        next.remove(uid)
        prefs.edit().putStringSet(KEY_UNREAD_UIDS, next).apply()
        return next.toSet()
    }

    fun markAllRead() {
        prefs.edit().putStringSet(KEY_UNREAD_UIDS, emptySet()).apply()
    }

    fun saveCachedFeed(feed: NewsFeedResponse) {
        try {
            val encoded = json.encodeToString(NewsFeedResponse.serializer(), feed)
            prefs.edit().putString(KEY_CACHED_FEED, encoded).apply()
        } catch (_: Exception) {
        }
    }

    fun loadCachedFeed(): NewsFeedResponse? {
        val raw = prefs.getString(KEY_CACHED_FEED, null) ?: return null
        return try {
            json.decodeFromString(NewsFeedResponse.serializer(), raw)
        } catch (_: Exception) {
            null
        }
    }

    fun getBookmarks(): List<NewsItem> {
        val raw = prefs.getString(KEY_BOOKMARKS, null) ?: return emptyList()
        return try {
            json.decodeFromString(ListSerializer(NewsItem.serializer()), raw)
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun toggleBookmark(item: NewsItem): List<NewsItem> {
        val current = getBookmarks().toMutableList()
        val idx = current.indexOfFirst { it.uid == item.uid }
        if (idx >= 0) {
            current.removeAt(idx)
        } else {
            current.add(0, item)
        }
        val capped = current.take(100)
        try {
            val encoded = json.encodeToString(ListSerializer(NewsItem.serializer()), capped)
            prefs.edit().putString(KEY_BOOKMARKS, encoded).apply()
        } catch (_: Exception) {
        }
        return capped
    }

    companion object {
        private const val PREFS_NAME = "hub_news_prefs_v1"
        private const val KEY_NOTIFY_ENABLED = "notify_enabled"
        private const val KEY_FAST_MODE = "fast_five_min_mode"
        private const val KEY_URGENT_ONLY = "urgent_only"
        private const val KEY_MUTED_SOURCES = "muted_sources"
        private const val KEY_THEME_MODE = "theme_mode"
        private const val KEY_HAS_SEEDED = "has_seeded_v1"
        private const val KEY_SEEN_UIDS = "seen_uids_v1"
        private const val KEY_SEEN_ANN_IDS = "seen_ann_ids_v1"
        private const val KEY_UNREAD_UIDS = "unread_uids_v1"
        private const val KEY_CACHED_FEED = "cached_feed_v1"
        private const val KEY_BOOKMARKS = "bookmarks_v1"
        private const val KEY_LAST_SYNC_LABEL = "last_sync_label"
        private const val KEY_LAST_SYNC_NEW_COUNT = "last_sync_new_count"
    }
}
