package vn.hub.news.ui

import android.app.Application
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import vn.hub.news.data.HubApiClient
import vn.hub.news.data.HubPreferencesStore
import vn.hub.news.model.AdminAnnouncement
import vn.hub.news.model.AppPreferences
import vn.hub.news.model.ArticleDetail
import vn.hub.news.model.HubCatalog
import vn.hub.news.model.NewsDiffEngine
import vn.hub.news.model.NewsItem
import vn.hub.news.model.PortalHealth
import vn.hub.news.model.SourceMeta
import vn.hub.news.model.ThemeMode
import vn.hub.news.model.TimeFilter
import vn.hub.news.model.prettyAttachmentName
import vn.hub.news.notify.HubNotificationManager
import vn.hub.news.notify.HubSyncCoordinator

data class DetailSheetState(
    val open: Boolean = false,
    val loading: Boolean = false,
    val code: String = "",
    val id: String = "",
    val fallbackTitle: String = "",
    val fallbackUrl: String = "",
    val fallbackSource: String = "",
    val detail: ArticleDetail? = null,
    val error: String = "",
)

data class HubUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val isCheckingStatus: Boolean = false,
    val isSyncingNow: Boolean = false,
    val fetchedAt: String = "",
    val allItems: List<NewsItem> = emptyList(),
    val filteredItems: List<NewsItem> = emptyList(),
    val sources: List<SourceMeta> = HubCatalog.DEFAULT_SOURCES,
    val health: List<PortalHealth> = emptyList(),
    val announcements: List<AdminAnnouncement> = emptyList(),
    val bookmarks: List<NewsItem> = emptyList(),
    val unreadUids: Set<String> = emptySet(),
    val selectedSource: String = "all",
    val selectedTopic: String = "all",
    val timeFilter: TimeFilter = TimeFilter.LATEST,
    val searchQuery: String = "",
    val searchVisible: Boolean = false,
    val errorMessage: String = "",
    val snackbarMessage: String = "",
    val prefs: AppPreferences = AppPreferences(),
    val hasNotificationPermission: Boolean = true,
    val detailSheet: DetailSheetState = DetailSheetState(),
)

class HubViewModel(application: Application) : AndroidViewModel(application) {
    private val appContext: Context = application.applicationContext
    private val api = HubApiClient()
    private val store = HubPreferencesStore(appContext)

    private val _uiState = MutableStateFlow(HubUiState())
    val uiState: StateFlow<HubUiState> = _uiState.asStateFlow()

    init {
        hydrateFromCache()
        refreshFeed(forceLive = false)
    }

    private fun hydrateFromCache() {
        val cached = store.loadCachedFeed()
        val prefs = store.getPreferences()
        val bookmarks = store.getBookmarks()
        val unread = store.getUnreadUids()
        val hasPerm = HubNotificationManager.hasNotificationPermission(appContext)

        if (cached != null) {
            _uiState.update { cur ->
                val filtered = NewsDiffEngine.filterLocalItems(
                    items = cached.items,
                    selectedSource = cur.selectedSource,
                    selectedTopic = cur.selectedTopic,
                    timeFilter = cur.timeFilter,
                    query = cur.searchQuery,
                )
                cur.copy(
                    isLoading = false,
                    fetchedAt = cached.fetchedAt,
                    allItems = cached.items,
                    filteredItems = filtered,
                    sources = cached.sources.ifEmpty { HubCatalog.DEFAULT_SOURCES },
                    health = cached.health,
                    announcements = cached.announcements,
                    bookmarks = bookmarks,
                    unreadUids = unread,
                    prefs = prefs,
                    hasNotificationPermission = hasPerm,
                )
            }
        } else {
            _uiState.update {
                it.copy(
                    bookmarks = bookmarks,
                    unreadUids = unread,
                    prefs = prefs,
                    hasNotificationPermission = hasPerm,
                )
            }
        }
    }

    fun updateNotificationPermissionState() {
        val granted = HubNotificationManager.hasNotificationPermission(appContext)
        _uiState.update { it.copy(hasNotificationPermission = granted) }
        if (granted) {
            HubSyncCoordinator.applyScheduling(appContext)
        }
    }

    fun refreshFeed(forceLive: Boolean = false) {
        viewModelScope.launch {
            _uiState.update {
                it.copy(
                    isRefreshing = it.allItems.isNotEmpty(),
                    isLoading = it.allItems.isEmpty(),
                    errorMessage = "",
                )
            }
            try {
                val daysParam = _uiState.value.timeFilter.days
                val feed = api.fetchNews(
                    source = "all",
                    topic = "all",
                    days = daysParam,
                    limit = 120,
                    refresh = forceLive,
                )
                if (daysParam == null) {
                    store.saveCachedFeed(feed)
                }

                // Seed seen state on first launch so background worker never spams old items
                if (!store.hasSeededSeen()) {
                    val diff = NewsDiffEngine.computeDiff(
                        feedItems = feed.items,
                        announcements = feed.announcements,
                        previousSeenUids = emptySet(),
                        previousSeenAnnIds = emptySet(),
                        hasSeededBefore = false,
                        mutedSources = _uiState.value.prefs.mutedSources,
                        urgentOnly = _uiState.value.prefs.urgentOnly,
                    )
                    store.saveSeenState(diff.updatedSeenUids, diff.updatedSeenAnnIds, 0)
                }

                _uiState.update { cur ->
                    val filtered = NewsDiffEngine.filterLocalItems(
                        items = feed.items,
                        selectedSource = cur.selectedSource,
                        selectedTopic = cur.selectedTopic,
                        timeFilter = cur.timeFilter,
                        query = cur.searchQuery,
                    )
                    cur.copy(
                        isLoading = false,
                        isRefreshing = false,
                        fetchedAt = feed.fetchedAt,
                        allItems = feed.items,
                        filteredItems = filtered,
                        sources = feed.sources.ifEmpty { HubCatalog.DEFAULT_SOURCES },
                        health = feed.health,
                        announcements = feed.announcements,
                        prefs = store.getPreferences(),
                        errorMessage = "",
                    )
                }
            } catch (e: Exception) {
                _uiState.update { cur ->
                    cur.copy(
                        isLoading = false,
                        isRefreshing = false,
                        errorMessage = e.message ?: "Không thể kết nối máy chủ HUB News",
                    )
                }
            }
        }
    }

    fun selectSource(sourceKey: String) {
        _uiState.update { cur ->
            val filtered = NewsDiffEngine.filterLocalItems(
                items = cur.allItems,
                selectedSource = sourceKey,
                selectedTopic = cur.selectedTopic,
                timeFilter = cur.timeFilter,
                query = cur.searchQuery,
            )
            cur.copy(selectedSource = sourceKey, filteredItems = filtered)
        }
    }

    fun selectTopic(topicKey: String) {
        _uiState.update { cur ->
            val filtered = NewsDiffEngine.filterLocalItems(
                items = cur.allItems,
                selectedSource = cur.selectedSource,
                selectedTopic = topicKey,
                timeFilter = cur.timeFilter,
                query = cur.searchQuery,
            )
            cur.copy(selectedTopic = topicKey, filteredItems = filtered)
        }
    }

    fun selectTimeFilter(filter: TimeFilter) {
        val needsRemote = filter == TimeFilter.DAYS_30 || _uiState.value.timeFilter == TimeFilter.DAYS_30
        _uiState.update { cur ->
            val filtered = NewsDiffEngine.filterLocalItems(
                items = cur.allItems,
                selectedSource = cur.selectedSource,
                selectedTopic = cur.selectedTopic,
                timeFilter = filter,
                query = cur.searchQuery,
            )
            cur.copy(timeFilter = filter, filteredItems = filtered)
        }
        if (needsRemote) {
            refreshFeed(forceLive = false)
        }
    }

    fun setSearchVisible(visible: Boolean) {
        _uiState.update { cur ->
            val nextQuery = if (visible) cur.searchQuery else ""
            val filtered = NewsDiffEngine.filterLocalItems(
                items = cur.allItems,
                selectedSource = cur.selectedSource,
                selectedTopic = cur.selectedTopic,
                timeFilter = cur.timeFilter,
                query = nextQuery,
            )
            cur.copy(searchVisible = visible, searchQuery = nextQuery, filteredItems = filtered)
        }
    }

    fun updateSearchQuery(query: String) {
        _uiState.update { cur ->
            val filtered = NewsDiffEngine.filterLocalItems(
                items = cur.allItems,
                selectedSource = cur.selectedSource,
                selectedTopic = cur.selectedTopic,
                timeFilter = cur.timeFilter,
                query = query,
            )
            cur.copy(searchQuery = query, filteredItems = filtered)
        }
    }

    fun openArticle(item: NewsItem) {
        val nextUnread = store.markRead(item.uid)
        _uiState.update { it.copy(unreadUids = nextUnread) }
        openArticleByCodeId(
            code = item.code,
            id = item.id,
            fallbackTitle = item.title,
            fallbackUrl = item.url,
            fallbackSource = item.sourceName,
        )
    }

    fun openArticleByCodeId(
        code: String,
        id: String,
        fallbackTitle: String = "",
        fallbackUrl: String = "",
        fallbackSource: String = "",
    ) {
        if (code.isBlank() || id.isBlank()) return
        val uid = "$code:$id"
        val nextUnread = store.markRead(uid)
        _uiState.update {
            it.copy(
                unreadUids = nextUnread,
                detailSheet = DetailSheetState(
                    open = true,
                    loading = true,
                    code = code,
                    id = id,
                    fallbackTitle = fallbackTitle,
                    fallbackUrl = fallbackUrl,
                    fallbackSource = fallbackSource,
                ),
            )
        }
        viewModelScope.launch {
            try {
                val detail = api.fetchDetail(code = code, id = id)
                _uiState.update { cur ->
                    if (cur.detailSheet.code == code && cur.detailSheet.id == id) {
                        cur.copy(
                            detailSheet = cur.detailSheet.copy(
                                loading = false,
                                detail = detail,
                                error = "",
                            )
                        )
                    } else {
                        cur
                    }
                }
            } catch (e: Exception) {
                _uiState.update { cur ->
                    if (cur.detailSheet.code == code && cur.detailSheet.id == id) {
                        cur.copy(
                            detailSheet = cur.detailSheet.copy(
                                loading = false,
                                error = e.message ?: "Không thể tải nội dung chi tiết",
                            )
                        )
                    } else {
                        cur
                    }
                }
            }
        }
    }

    fun closeDetailSheet() {
        _uiState.update { it.copy(detailSheet = DetailSheetState(open = false)) }
    }

    fun toggleBookmark(item: NewsItem) {
        val updated = store.toggleBookmark(item)
        val saved = updated.any { it.uid == item.uid }
        _uiState.update {
            it.copy(
                bookmarks = updated,
                snackbarMessage = if (saved) "Đã lưu thông báo để xem nhanh" else "Đã bỏ khỏi danh sách lưu",
            )
        }
    }

    fun markAllRead() {
        store.markAllRead()
        _uiState.update {
            it.copy(
                unreadUids = emptySet(),
                snackbarMessage = "Đã đánh dấu đọc toàn bộ thông báo",
            )
        }
    }

    fun checkPortalStatusLive() {
        viewModelScope.launch {
            _uiState.update { it.copy(isCheckingStatus = true) }
            try {
                val res = api.fetchStatus(live = true)
                _uiState.update {
                    it.copy(
                        isCheckingStatus = false,
                        fetchedAt = res.fetchedAt,
                        health = res.health,
                        sources = res.sources.ifEmpty { it.sources },
                        snackbarMessage = "Đã kiểm tra trực tiếp ${res.okCount}/${res.totalSources} cổng HUB",
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isCheckingStatus = false,
                        snackbarMessage = e.message ?: "Không thể kiểm tra trạng thái cổng",
                    )
                }
            }
        }
    }

    fun setNotificationsEnabled(enabled: Boolean) {
        store.setNotificationsEnabled(enabled)
        HubSyncCoordinator.applyScheduling(appContext)
        _uiState.update {
            it.copy(
                prefs = store.getPreferences(),
                snackbarMessage = if (enabled) "Đã bật tự động thông báo tin mới HUB" else "Đã tạm tắt thông báo tự động",
            )
        }
    }

    fun setFastFiveMinMode(enabled: Boolean) {
        store.setFastFiveMinMode(enabled)
        HubSyncCoordinator.applyScheduling(appContext)
        _uiState.update {
            it.copy(
                prefs = store.getPreferences(),
                snackbarMessage = if (enabled) {
                    "Đã bật chế độ quét nhanh mỗi 5 phút"
                } else {
                    "Đã chuyển về chế độ tiết kiệm pin (15 phút)"
                },
            )
        }
    }

    fun setUrgentOnly(enabled: Boolean) {
        store.setUrgentOnly(enabled)
        _uiState.update { it.copy(prefs = store.getPreferences()) }
    }

    fun toggleMutedSource(sourceKey: String) {
        store.toggleMutedSource(sourceKey)
        _uiState.update { it.copy(prefs = store.getPreferences()) }
    }

    fun setThemeMode(mode: ThemeMode) {
        store.setThemeMode(mode)
        _uiState.update { it.copy(prefs = store.getPreferences()) }
    }

    fun syncAndNotifyNow() {
        viewModelScope.launch {
            _uiState.update { it.copy(isSyncingNow = true) }
            try {
                val found = HubSyncCoordinator.runSyncOnce(appContext, forceRefresh = true)
                val cached = store.loadCachedFeed()
                _uiState.update { cur ->
                    val items = cached?.items ?: cur.allItems
                    cur.copy(
                        isSyncingNow = false,
                        fetchedAt = cached?.fetchedAt ?: cur.fetchedAt,
                        allItems = items,
                        filteredItems = NewsDiffEngine.filterLocalItems(
                            items = items,
                            selectedSource = cur.selectedSource,
                            selectedTopic = cur.selectedTopic,
                            timeFilter = cur.timeFilter,
                            query = cur.searchQuery,
                        ),
                        announcements = cached?.announcements ?: cur.announcements,
                        unreadUids = store.getUnreadUids(),
                        prefs = store.getPreferences(),
                        snackbarMessage = if (found > 0) {
                            "Phát hiện $found thông báo mới và đã gửi báo về máy"
                        } else {
                            "Đã kiểm tra 7 cổng HUB · Chưa có tin mới hơn"
                        },
                    )
                }
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isSyncingNow = false,
                        snackbarMessage = e.message ?: "Lỗi đồng bộ máy chủ HUB News",
                    )
                }
            }
        }
    }

    fun sendTestNotification() {
        val ok = HubNotificationManager.notifyTestAlert(appContext)
        _uiState.update {
            it.copy(
                hasNotificationPermission = HubNotificationManager.hasNotificationPermission(appContext),
                snackbarMessage = if (ok) {
                    "Đã gửi thông báo thử lên thanh trạng thái"
                } else {
                    "Vui lòng cấp quyền Thông báo trước khi thử"
                },
            )
        }
    }

    fun downloadAttachment(url: String, index: Int) {
        try {
            val fileName = prettyAttachmentName(url, index)
                .replace(Regex("[^a-zA-Z0-9._ -]"), "_")
            val ext = url.substringBefore('?').substringAfterLast('.', "pdf").take(5)
            val fullName = if (fileName.endsWith(".$ext", ignoreCase = true)) fileName else "$fileName.$ext"

            val dm = appContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val req = DownloadManager.Request(Uri.parse(url))
                .setTitle(fullName)
                .setDescription("HUB News · Đang tải tài liệu")
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "HUBNews/$fullName")
            dm.enqueue(req)
            _uiState.update { it.copy(snackbarMessage = "Đang tải tệp vào Downloads/HUBNews") }
        } catch (_: Exception) {
            openExternalUrl(url)
        }
    }

    fun openExternalUrl(url: String) {
        if (url.isBlank()) return
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            appContext.startActivity(intent)
        } catch (_: Exception) {
            _uiState.update { it.copy(snackbarMessage = "Không thể mở liên kết này") }
        }
    }

    fun shareArticle(title: String, url: String) {
        try {
            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_SUBJECT, title)
                putExtra(Intent.EXTRA_TEXT, "$title\n$url\n\n— HUB News")
            }
            val chooser = Intent.createChooser(shareIntent, "Chia sẻ thông báo HUB").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            appContext.startActivity(chooser)
        } catch (_: Exception) {
        }
    }

    fun consumeSnackbar() {
        _uiState.update { it.copy(snackbarMessage = "") }
    }
}
