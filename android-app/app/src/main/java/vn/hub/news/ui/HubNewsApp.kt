package vn.hub.news.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.OpenInNew
import androidx.compose.material.icons.rounded.AccountBalance
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.Bookmark
import androidx.compose.material.icons.rounded.BookmarkBorder
import androidx.compose.material.icons.rounded.Campaign
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DoneAll
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.Language
import androidx.compose.material.icons.rounded.Newspaper
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.NotificationsOff
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.PictureAsPdf
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import vn.hub.news.model.AdminAnnouncement
import vn.hub.news.model.HubCatalog
import vn.hub.news.model.NewsItem
import vn.hub.news.model.PortalHealth
import vn.hub.news.model.SourceMeta
import vn.hub.news.model.ThemeMode
import vn.hub.news.model.TimeFilter
import vn.hub.news.model.prettyAttachmentName
import vn.hub.news.ui.theme.HubGold
import vn.hub.news.ui.theme.HubNewsTheme
import vn.hub.news.ui.theme.HubOnlineGreen
import vn.hub.news.ui.theme.HubUrgent
import vn.hub.news.ui.theme.HubUrgentBg
import vn.hub.news.ui.theme.HubWarnAmber

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HubNewsApp(
    viewModel: HubViewModel,
    onRequestNotificationPermission: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var selectedTab by rememberSaveable { mutableIntStateOf(0) }
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(state.snackbarMessage) {
        if (state.snackbarMessage.isNotBlank()) {
            snackbarHostState.showSnackbar(state.snackbarMessage)
            viewModel.consumeSnackbar()
        }
    }

    HubNewsTheme(themeMode = state.prefs.themeMode) {
        Scaffold(
            snackbarHost = { SnackbarHost(snackbarHostState) },
            topBar = {
                TopAppBar(
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface,
                        titleContentColor = MaterialTheme.colorScheme.onSurface,
                    ),
                    title = {
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "HUB News",
                                    style = MaterialTheme.typography.titleLarge,
                                    color = MaterialTheme.colorScheme.primary,
                                )
                                Spacer(Modifier.width(8.dp))
                                StatusDotPill(
                                    online = state.errorMessage.isBlank(),
                                    label = if (state.fetchedAt.isNotBlank()) state.fetchedAt.substringBefore(" ·") else "Trực tuyến",
                                )
                            }
                            Text(
                                text = when (selectedTab) {
                                    0 -> "7 cổng chính thức · Ưu tiên Online HUB"
                                    1 -> "Các Cổng HUB & Tiện ích sinh viên"
                                    2 -> "Thông báo đã lưu (${state.bookmarks.size})"
                                    else -> "Thông báo tự động & Cài đặt"
                                },
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    },
                    actions = {
                        if (selectedTab == 0) {
                            if (state.unreadUids.isNotEmpty()) {
                                IconButton(onClick = { viewModel.markAllRead() }) {
                                    Icon(
                                        imageVector = Icons.Rounded.DoneAll,
                                        contentDescription = "Đánh dấu đã đọc",
                                    )
                                }
                            }
                            IconButton(onClick = { viewModel.setSearchVisible(!state.searchVisible) }) {
                                Icon(
                                    imageVector = if (state.searchVisible) Icons.Rounded.Close else Icons.Rounded.Search,
                                    contentDescription = "Tìm kiếm",
                                )
                            }
                            IconButton(onClick = { viewModel.refreshFeed(forceLive = true) }) {
                                Icon(
                                    imageVector = Icons.Rounded.Refresh,
                                    contentDescription = "Làm mới",
                                )
                            }
                        } else if (selectedTab == 1) {
                            IconButton(onClick = { viewModel.checkPortalStatusLive() }) {
                                Icon(
                                    imageVector = Icons.Rounded.Refresh,
                                    contentDescription = "Kiểm tra trực tiếp 7 cổng",
                                )
                            }
                        }
                    },
                )
            },
            bottomBar = {
                NavigationBar(
                    containerColor = MaterialTheme.colorScheme.surface,
                    tonalElevation = 0.dp,
                ) {
                    NavigationBarItem(
                        selected = selectedTab == 0,
                        onClick = { selectedTab = 0 },
                        icon = { Icon(Icons.Rounded.Newspaper, contentDescription = null) },
                        label = { Text("Tin mới") },
                    )
                    NavigationBarItem(
                        selected = selectedTab == 1,
                        onClick = { selectedTab = 1 },
                        icon = { Icon(Icons.Rounded.AccountBalance, contentDescription = null) },
                        label = { Text("Cổng HUB") },
                    )
                    NavigationBarItem(
                        selected = selectedTab == 2,
                        onClick = { selectedTab = 2 },
                        icon = { Icon(Icons.Rounded.Bookmark, contentDescription = null) },
                        label = { Text("Đã lưu") },
                    )
                    NavigationBarItem(
                        selected = selectedTab == 3,
                        onClick = { selectedTab = 3 },
                        icon = {
                            Icon(
                                if (state.prefs.notificationsEnabled) Icons.Rounded.NotificationsActive else Icons.Rounded.Settings,
                                contentDescription = null,
                            )
                        },
                        label = { Text("Cài đặt") },
                    )
                }
            },
        ) { innerPadding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .background(MaterialTheme.colorScheme.background),
            ) {
                when (selectedTab) {
                    0 -> FeedTab(
                        state = state,
                        viewModel = viewModel,
                        onRequestPermission = onRequestNotificationPermission,
                    )
                    1 -> PortalsTab(
                        state = state,
                        onOpenPortalFeed = { key ->
                            viewModel.selectSource(key)
                            selectedTab = 0
                        },
                        onCheckLive = { viewModel.checkPortalStatusLive() },
                        onOpenUrl = { viewModel.openExternalUrl(it) },
                    )
                    2 -> BookmarksTab(
                        bookmarks = state.bookmarks,
                        onOpen = { viewModel.openArticle(it) },
                        onRemove = { viewModel.toggleBookmark(it) },
                    )
                    3 -> SettingsTab(
                        state = state,
                        viewModel = viewModel,
                        onRequestPermission = onRequestNotificationPermission,
                    )
                }
            }
        }

        if (state.detailSheet.open) {
            ArticleDetailSheet(
                detailState = state.detailSheet,
                isBookmarked = state.bookmarks.any { it.uid == "${state.detailSheet.code}:${state.detailSheet.id}" },
                onDismiss = { viewModel.closeDetailSheet() },
                onRetry = {
                    viewModel.openArticleByCodeId(
                        code = state.detailSheet.code,
                        id = state.detailSheet.id,
                        fallbackTitle = state.detailSheet.fallbackTitle,
                        fallbackUrl = state.detailSheet.fallbackUrl,
                        fallbackSource = state.detailSheet.fallbackSource,
                    )
                },
                onToggleBookmark = {
                    val d = state.detailSheet.detail
                    val item = state.allItems.firstOrNull {
                        it.code == state.detailSheet.code && it.id == state.detailSheet.id
                    } ?: NewsItem(
                        uid = "${state.detailSheet.code}:${state.detailSheet.id}",
                        id = state.detailSheet.id,
                        code = state.detailSheet.code,
                        source = d?.source ?: "",
                        sourceName = d?.sourceName ?: state.detailSheet.fallbackSource,
                        sourceShort = d?.sourceName ?: state.detailSheet.fallbackSource,
                        sourceEmoji = d?.sourceEmoji ?: "📌",
                        title = d?.title ?: state.detailSheet.fallbackTitle,
                        date = d?.date ?: "—",
                        url = d?.webUrl ?: state.detailSheet.fallbackUrl,
                        topicKey = d?.topicKey ?: "general",
                        topicLabel = d?.topicLabel ?: "Thông báo HUB",
                        topicTag = d?.topicTag ?: "#ThongBaoHUB",
                        urgent = d?.urgent ?: false,
                    )
                    viewModel.toggleBookmark(item)
                },
                onOpenUrl = { viewModel.openExternalUrl(it) },
                onDownloadPdf = { url, idx -> viewModel.downloadAttachment(url, idx) },
                onShare = { title, url -> viewModel.shareArticle(title, url) },
            )
        }
    }
}

@Composable
private fun StatusDotPill(online: Boolean, label: String) {
    val dotColor = if (online) HubOnlineGreen else HubWarnAmber
    Surface(
        shape = RoundedCornerShape(999.dp),
        color = dotColor.copy(alpha = 0.12f),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(7.dp)
                    .clip(CircleShape)
                    .background(dotColor),
            )
            Spacer(Modifier.width(5.dp))
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = dotColor,
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FeedTab(
    state: HubUiState,
    viewModel: HubViewModel,
    onRequestPermission: () -> Unit,
) {
    PullToRefreshBox(
        isRefreshing = state.isRefreshing,
        onRefresh = { viewModel.refreshFeed(forceLive = true) },
        modifier = Modifier.fillMaxSize(),
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (!state.hasNotificationPermission) {
                item(key = "perm_banner") {
                    PermissionBanner(
                        onGrant = onRequestPermission,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
                    )
                }
            }

            if (state.announcements.isNotEmpty()) {
                item(key = "admin_ann") {
                    AdminAnnouncementBanner(
                        announcement = state.announcements.first(),
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                    )
                }
            }

            item(key = "search_bar") {
                AnimatedVisibility(visible = state.searchVisible) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 4.dp),
                    ) {
                        OutlinedTextField(
                            value = state.searchQuery,
                            onValueChange = { viewModel.updateSearchQuery(it) },
                            modifier = Modifier.fillMaxWidth(),
                            placeholder = { Text("Tìm không dấu: hoc bong, lich thi, hoc phi...") },
                            singleLine = true,
                            shape = RoundedCornerShape(14.dp),
                            leadingIcon = { Icon(Icons.Rounded.Search, contentDescription = null) },
                            trailingIcon = {
                                if (state.searchQuery.isNotBlank()) {
                                    IconButton(onClick = { viewModel.updateSearchQuery("") }) {
                                        Icon(Icons.Rounded.Close, contentDescription = "Xoá")
                                    }
                                }
                            },
                        )
                        Spacer(Modifier.height(6.dp))
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            items(HubCatalog.QUICK_KEYWORDS) { kw ->
                                FilterChip(
                                    selected = state.searchQuery.equals(kw, ignoreCase = true),
                                    onClick = { viewModel.updateSearchQuery(kw) },
                                    label = { Text(kw, style = MaterialTheme.typography.labelMedium) },
                                )
                            }
                        }
                    }
                }
            }

            // Priority filter strip: All Portals FIRST -> Online HUB (#1) -> Remaining 6 portals
            item(key = "source_strip") {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    item(key = "src_all") {
                        FilterChip(
                            selected = state.selectedSource == "all",
                            onClick = { viewModel.selectSource("all") },
                            label = { Text("Tất cả cổng") },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = MaterialTheme.colorScheme.primary,
                                selectedLabelColor = MaterialTheme.colorScheme.onPrimary,
                            ),
                        )
                    }
                    items(state.sources, key = { it.key }) { src ->
                        val label = if (src.key == "online") "Online HUB (#1)" else src.shortName
                        FilterChip(
                            selected = state.selectedSource == src.key,
                            onClick = { viewModel.selectSource(src.key) },
                            label = { Text(label) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = MaterialTheme.colorScheme.primary,
                                selectedLabelColor = MaterialTheme.colorScheme.onPrimary,
                            ),
                        )
                    }
                }
            }

            // Time & Topic filter row
            item(key = "topic_time_strip") {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(TimeFilter.entries, key = { it.name }) { tf ->
                        FilterChip(
                            selected = state.timeFilter == tf,
                            onClick = { viewModel.selectTimeFilter(tf) },
                            label = { Text(tf.label) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = MaterialTheme.colorScheme.secondaryContainer,
                                selectedLabelColor = MaterialTheme.colorScheme.onSecondaryContainer,
                            ),
                        )
                    }
                    items(HubCatalog.TOPICS.drop(1), key = { it.key }) { tp ->
                        val selected = state.selectedTopic == tp.key
                        FilterChip(
                            selected = selected,
                            onClick = { viewModel.selectTopic(if (selected) "all" else tp.key) },
                            label = { Text(tp.label) },
                        )
                    }
                }
            }

            // Counter header
            item(key = "feed_meta") {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "${state.filteredItems.size} thông báo",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    if (state.selectedSource != "all" || state.selectedTopic != "all" || state.searchQuery.isNotBlank()) {
                        Text(
                            text = "Đặt lại bộ lọc",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.clickable {
                                viewModel.selectSource("all")
                                viewModel.selectTopic("all")
                                viewModel.selectTimeFilter(TimeFilter.LATEST)
                                viewModel.updateSearchQuery("")
                            },
                        )
                    }
                }
            }

            if (state.isLoading && state.allItems.isEmpty()) {
                item(key = "loading") {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 64.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            CircularProgressIndicator(strokeWidth = 3.dp)
                            Spacer(Modifier.height(12.dp))
                            Text(
                                text = "Đang tải tin từ 7 cổng HUB...",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            } else if (state.errorMessage.isNotBlank() && state.filteredItems.isEmpty()) {
                item(key = "error") {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp),
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                        shape = RoundedCornerShape(16.dp),
                    ) {
                        Column(
                            modifier = Modifier.padding(20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) {
                            Icon(Icons.Rounded.Warning, contentDescription = null, tint = HubWarnAmber, modifier = Modifier.size(32.dp))
                            Spacer(Modifier.height(8.dp))
                            Text(state.errorMessage, style = MaterialTheme.typography.bodyMedium)
                            Spacer(Modifier.height(12.dp))
                            Button(onClick = { viewModel.refreshFeed(forceLive = true) }) {
                                Text("Thử tải lại")
                            }
                        }
                    }
                }
            } else if (state.filteredItems.isEmpty()) {
                item(key = "empty") {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 56.dp, horizontal = 24.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            text = "Không có thông báo phù hợp với bộ lọc hiện tại.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            } else {
                val bookmarkIds = state.bookmarks.map { it.uid }.toSet()
                items(state.filteredItems, key = { it.uid }) { item ->
                    NewsArticleCard(
                        item = item,
                        isUnread = item.uid in state.unreadUids,
                        isBookmarked = item.uid in bookmarkIds,
                        onClick = { viewModel.openArticle(item) },
                        onBookmark = { viewModel.toggleBookmark(item) },
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun PermissionBanner(
    onGrant: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Rounded.NotificationsActive,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.primary,
            )
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Bật quyền thông báo đẩy",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
                Text(
                    text = "Nhận tin mới từ 7 cổng HUB ngay cả khi đóng ứng dụng.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.85f),
                )
            }
            Spacer(Modifier.width(8.dp))
            Button(
                onClick = onGrant,
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
            ) {
                Text("Bật")
            }
        }
    }
}

@Composable
private fun AdminAnnouncementBanner(
    announcement: AdminAnnouncement,
    modifier: Modifier = Modifier,
) {
    val bg = if (announcement.urgent) HubUrgentBg else MaterialTheme.colorScheme.secondaryContainer
    val accent = if (announcement.urgent) HubUrgent else MaterialTheme.colorScheme.onSecondaryContainer
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = bg),
        border = BorderStroke(1.dp, accent.copy(alpha = 0.25f)),
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Rounded.Campaign,
                    contentDescription = null,
                    tint = accent,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    text = if (announcement.urgent) "THÔNG BÁO KHẨN TỪ QUẢN TRỊ VIÊN" else "THÔNG BÁO TỪ QUẢN TRỊ VIÊN",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.Bold,
                    color = accent,
                )
            }
            Spacer(Modifier.height(6.dp))
            Text(
                text = announcement.text,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                text = "${announcement.label} · Admin ${announcement.author}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun NewsArticleCard(
    item: NewsItem,
    isUnread: Boolean,
    isBookmarked: Boolean,
    onClick: () -> Unit,
    onBookmark: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(
            width = if (item.urgent) 1.dp else 0.7.dp,
            color = if (item.urgent) HubUrgent.copy(alpha = 0.35f) else MaterialTheme.colorScheme.outline.copy(alpha = 0.7f),
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Column(modifier = Modifier.padding(15.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (isUnread) {
                    Box(
                        modifier = Modifier
                            .size(8.dp)
                            .clip(CircleShape)
                            .background(HubGold),
                    )
                    Spacer(Modifier.width(7.dp))
                }
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = if (item.source == "online") {
                        MaterialTheme.colorScheme.primaryContainer
                    } else {
                        MaterialTheme.colorScheme.surfaceVariant
                    },
                ) {
                    Text(
                        text = if (item.source == "online") "Online HUB · #1" else item.sourceShort,
                        style = MaterialTheme.typography.labelSmall,
                        color = if (item.source == "online") {
                            MaterialTheme.colorScheme.onPrimaryContainer
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant
                        },
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                    )
                }
                Spacer(Modifier.width(6.dp))
                if (item.urgent) {
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = HubUrgent.copy(alpha = 0.14f),
                    ) {
                        Text(
                            text = "KHẨN",
                            style = MaterialTheme.typography.labelSmall,
                            fontWeight = FontWeight.Bold,
                            color = HubUrgent,
                            modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp),
                        )
                    }
                    Spacer(Modifier.width(6.dp))
                }
                Spacer(Modifier.weight(1f))
                Text(
                    text = item.date,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(Modifier.height(9.dp))

            Text(
                text = item.title,
                style = MaterialTheme.typography.titleMedium,
                color = MaterialTheme.colorScheme.onSurface,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )

            Spacer(Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = item.topicTag,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.primary,
                )
                if (item.alsoIn.isNotEmpty()) {
                    Text(
                        text = " · +${item.alsoIn.size} cổng khác",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Spacer(Modifier.weight(1f))
                IconButton(
                    onClick = onBookmark,
                    modifier = Modifier.size(32.dp),
                ) {
                    Icon(
                        imageVector = if (isBookmarked) Icons.Rounded.Bookmark else Icons.Rounded.BookmarkBorder,
                        contentDescription = "Lưu thông báo",
                        tint = if (isBookmarked) HubGold else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun PortalsTab(
    state: HubUiState,
    onOpenPortalFeed: (String) -> Unit,
    onCheckLive: () -> Unit,
    onOpenUrl: (String) -> Unit,
) {
    val healthByKey = remember(state.health) { state.health.associateBy { it.key } }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "portals_header") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column {
                    Text("Các Cổng HUB", style = MaterialTheme.typography.titleMedium)
                    Text(
                        text = "7 cổng chính thức · Tự động cập nhật 5 phút/lần",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                OutlinedButton(
                    onClick = onCheckLive,
                    enabled = !state.isCheckingStatus,
                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                ) {
                    if (state.isCheckingStatus) {
                        CircularProgressIndicator(modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                        Spacer(Modifier.width(6.dp))
                    }
                    Text("Kiểm tra live")
                }
            }
        }

        item(key = "portal_all_card") {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onOpenPortalFeed("all") },
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary),
            ) {
                Row(
                    modifier = Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(Icons.Rounded.Bolt, contentDescription = null, tint = HubGold)
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Tất cả cổng HUB · Mới nhất",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onPrimary,
                        )
                        Text(
                            text = "Gộp & khử trùng toàn bộ 7 cổng (${state.allItems.size} tin)",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.82f),
                        )
                    }
                }
            }
        }

        items(state.sources, key = { it.key }) { src ->
            PortalCard(
                src = src,
                health = healthByKey[src.key],
                onOpenFeed = { onOpenPortalFeed(src.key) },
                onOpenWeb = { onOpenUrl(src.url) },
            )
        }

        item(key = "utils_header") {
            Spacer(Modifier.height(8.dp))
            Text("Tiện ích sinh viên HUB", style = MaterialTheme.typography.titleMedium)
        }

        items(HubCatalog.UTILITIES, key = { it.url }) { util ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onOpenUrl(util.url) },
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(0.7.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.65f)),
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Language,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                    )
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(util.title, style = MaterialTheme.typography.titleSmall)
                        Text(
                            util.subtitle,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Icon(
                        imageVector = Icons.AutoMirrored.Rounded.OpenInNew,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun PortalCard(
    src: SourceMeta,
    health: PortalHealth?,
    onOpenFeed: () -> Unit,
    onOpenWeb: () -> Unit,
) {
    val dotColor = when {
        health == null -> MaterialTheme.colorScheme.outline
        health.ok && !health.fallback -> HubOnlineGreen
        health.ok && health.fallback -> HubWarnAmber
        else -> HubUrgent
    }
    val subText = when {
        health == null -> "Sẵn sàng đồng bộ"
        health.ok && health.fallback -> "${health.count} tin · Bản đệm nhanh"
        health.ok -> "${health.count} tin · Mới nhất ${health.latestDate}" + if (health.ms > 0) " · ${health.ms}ms" else ""
        else -> health.error.ifBlank { "Tạm thời không phản hồi" }
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onOpenFeed),
        shape = RoundedCornerShape(15.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(0.7.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.7f)),
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .clip(CircleShape)
                    .background(dotColor),
            )
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = src.name,
                        style = MaterialTheme.typography.titleSmall,
                    )
                    if (src.priority == 1) {
                        Spacer(Modifier.width(6.dp))
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = MaterialTheme.colorScheme.secondaryContainer,
                        ) {
                            Text(
                                text = "Ưu tiên #1",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSecondaryContainer,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            )
                        }
                    }
                }
                Spacer(Modifier.height(2.dp))
                Text(
                    text = subText,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = onOpenWeb) {
                Icon(
                    imageVector = Icons.AutoMirrored.Rounded.OpenInNew,
                    contentDescription = "Mở web cổng",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(19.dp),
                )
            }
        }
    }
}

@Composable
private fun BookmarksTab(
    bookmarks: List<NewsItem>,
    onOpen: (NewsItem) -> Unit,
    onRemove: (NewsItem) -> Unit,
) {
    if (bookmarks.isEmpty()) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    imageVector = Icons.Rounded.BookmarkBorder,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(44.dp),
                )
                Spacer(Modifier.height(10.dp))
                Text("Chưa có thông báo đã lưu", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "Bấm biểu tượng dấu trang trên mỗi thông báo để lưu xem nhanh kể cả khi không có mạng.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        items(bookmarks, key = { it.uid }) { item ->
            NewsArticleCard(
                item = item,
                isUnread = false,
                isBookmarked = true,
                onClick = { onOpen(item) },
                onBookmark = { onRemove(item) },
            )
        }
    }
}

@Composable
private fun SettingsTab(
    state: HubUiState,
    viewModel: HubViewModel,
    onRequestPermission: () -> Unit,
) {
    val prefs = state.prefs
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "notify_card") {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(0.7.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.7f)),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = if (prefs.notificationsEnabled) Icons.Rounded.NotificationsActive else Icons.Rounded.NotificationsOff,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                        )
                        Spacer(Modifier.width(10.dp))
                        Text("Thông báo tự động", style = MaterialTheme.typography.titleMedium)
                    }
                    Spacer(Modifier.height(12.dp))

                    if (!state.hasNotificationPermission) {
                        OutlinedButton(
                            onClick = onRequestPermission,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Icon(Icons.Rounded.Notifications, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Cấp quyền thông báo Android")
                        }
                        Spacer(Modifier.height(10.dp))
                    }

                    SettingSwitchRow(
                        title = "Tự động báo tin mới HUB",
                        subtitle = "Chạy nền bằng WorkManager (tự khôi phục sau khi khởi động lại máy)",
                        checked = prefs.notificationsEnabled,
                        onCheckedChange = { viewModel.setNotificationsEnabled(it) },
                    )
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))

                    SettingSwitchRow(
                        title = "Chế độ Quét nhanh 5 phút",
                        subtitle = "Theo dõi sát từng 5 phút như BOT (phù hợp tuần đăng ký học phần)",
                        checked = prefs.fastFiveMinMode,
                        enabled = prefs.notificationsEnabled,
                        onCheckedChange = { viewModel.setFastFiveMinMode(it) },
                    )
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))

                    SettingSwitchRow(
                        title = "Chỉ báo tin Khẩn & Quản trị",
                        subtitle = "Lọc riêng hạn cuối, huỷ học phần, cảnh báo và thông báo Admin",
                        checked = prefs.urgentOnly,
                        enabled = prefs.notificationsEnabled,
                        onCheckedChange = { viewModel.setUrgentOnly(it) },
                    )

                    Spacer(Modifier.height(12.dp))
                    Text(
                        text = "Lần kiểm tra gần nhất: ${prefs.lastSyncAtLabel}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        Button(
                            onClick = { viewModel.syncAndNotifyNow() },
                            enabled = !state.isSyncingNow,
                            modifier = Modifier.weight(1f),
                        ) {
                            if (state.isSyncingNow) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    strokeWidth = 2.dp,
                                    color = MaterialTheme.colorScheme.onPrimary,
                                )
                                Spacer(Modifier.width(6.dp))
                            }
                            Text("Quét tin ngay")
                        }
                        OutlinedButton(
                            onClick = { viewModel.sendTestNotification() },
                            modifier = Modifier.weight(1f),
                        ) {
                            Text("Thông báo thử")
                        }
                    }
                }
            }
        }

        item(key = "portal_toggles") {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(0.7.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.7f)),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Chọn cổng nhận thông báo", style = MaterialTheme.typography.titleMedium)
                    Text(
                        text = "Bật/tắt thông báo đẩy theo từng cổng HUB",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(10.dp))
                    state.sources.forEachIndexed { idx, src ->
                        val enabled = src.key !in prefs.mutedSources
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = if (src.priority == 1) "${src.name} (Ưu tiên #1)" else src.name,
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                            }
                            Switch(
                                checked = enabled,
                                enabled = prefs.notificationsEnabled,
                                onCheckedChange = { viewModel.toggleMutedSource(src.key) },
                            )
                        }
                        if (idx < state.sources.lastIndex) {
                            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.35f))
                        }
                    }
                }
            }
        }

        item(key = "theme_card") {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(0.7.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.7f)),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Giao diện hiển thị", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(10.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        ThemeMode.entries.forEach { mode ->
                            FilterChip(
                                selected = prefs.themeMode == mode,
                                onClick = { viewModel.setThemeMode(mode) },
                                label = { Text(mode.label) },
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }
            }
        }

        item(key = "author_card") {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(0.7.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.7f)),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { viewModel.openExternalUrl(HubCatalog.AUTHOR_FB_URL) }
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = Icons.Rounded.Person,
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                    )
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text("Tác giả: ${HubCatalog.AUTHOR_NAME}", style = MaterialTheme.typography.titleSmall)
                        Text(
                            text = "HUB News · Tự động cập nhật thông báo HUB 24/7",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Icon(
                        imageVector = Icons.AutoMirrored.Rounded.OpenInNew,
                        contentDescription = "Facebook",
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }
        }
    }
}

@Composable
private fun SettingSwitchRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    enabled: Boolean = true,
    onCheckedChange: (Boolean) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Spacer(Modifier.width(12.dp))
        Switch(
            checked = checked,
            enabled = enabled,
            onCheckedChange = onCheckedChange,
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ArticleDetailSheet(
    detailState: DetailSheetState,
    isBookmarked: Boolean,
    onDismiss: () -> Unit,
    onRetry: () -> Unit,
    onToggleBookmark: () -> Unit,
    onOpenUrl: (String) -> Unit,
    onDownloadPdf: (String, Int) -> Unit,
    onShare: (String, String) -> Unit,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = MaterialTheme.colorScheme.surface,
    ) {
        val d = detailState.detail
        val displayTitle = d?.title?.ifBlank { detailState.fallbackTitle } ?: detailState.fallbackTitle
        val displayUrl = d?.webUrl?.ifBlank { detailState.fallbackUrl } ?: detailState.fallbackUrl

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 8.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = MaterialTheme.colorScheme.primaryContainer,
                ) {
                    Text(
                        text = d?.sourceName?.ifBlank { detailState.fallbackSource } ?: detailState.fallbackSource.ifBlank { "HUB News" },
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    )
                }
                if (d != null && d.date.isNotBlank()) {
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = d.date,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Spacer(Modifier.weight(1f))
                IconButton(onClick = onToggleBookmark) {
                    Icon(
                        imageVector = if (isBookmarked) Icons.Rounded.Bookmark else Icons.Rounded.BookmarkBorder,
                        contentDescription = "Lưu",
                        tint = if (isBookmarked) HubGold else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (displayUrl.isNotBlank()) {
                    IconButton(onClick = { onShare(displayTitle, displayUrl) }) {
                        Icon(Icons.Rounded.Share, contentDescription = "Chia sẻ")
                    }
                }
            }

            Spacer(Modifier.height(6.dp))
            Text(
                text = displayTitle.ifBlank { "Chi tiết thông báo" },
                style = MaterialTheme.typography.titleLarge,
                color = MaterialTheme.colorScheme.onSurface,
            )

            if (d != null && d.sender.isNotBlank()) {
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "Đơn vị: ${d.sender}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            if (d != null && d.deadline.isNotBlank()) {
                Spacer(Modifier.height(10.dp))
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = HubUrgentBg,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Rounded.Schedule, contentDescription = null, tint = HubUrgent, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = "Hạn: ${d.deadline}",
                            style = MaterialTheme.typography.titleSmall,
                            color = HubUrgent,
                        )
                    }
                }
            }

            HorizontalDivider(
                modifier = Modifier.padding(vertical = 12.dp),
                color = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f),
            )

            when {
                detailState.loading -> {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 32.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        CircularProgressIndicator(strokeWidth = 3.dp)
                    }
                }
                detailState.error.isNotBlank() -> {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Text(
                            text = detailState.error,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.error,
                        )
                        Spacer(Modifier.height(10.dp))
                        OutlinedButton(onClick = onRetry) {
                            Text("Thử tải lại")
                        }
                    }
                }
                d != null -> {
                    val body = d.bodyText.trim()
                    if (body.length > 15) {
                        Text(
                            text = body,
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                    } else if (d.pdfs.isNotEmpty() || d.downloads.isNotEmpty()) {
                        Text(
                            text = "Thông báo này đính kèm văn bản PDF/tệp bên dưới.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    } else {
                        Text(
                            text = "Mở bài gốc bên dưới để xem toàn bộ nội dung hiển thị trên cổng trường.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }

                    val allFiles = d.pdfs + d.downloads
                    if (allFiles.isNotEmpty()) {
                        Spacer(Modifier.height(16.dp))
                        Text(
                            text = "Tài liệu đính kèm (${allFiles.size})",
                            style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        Spacer(Modifier.height(8.dp))
                        allFiles.forEachIndexed { idx, fileUrl ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 8.dp),
                                shape = RoundedCornerShape(12.dp),
                                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                            ) {
                                Row(
                                    modifier = Modifier.padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Icon(
                                        imageVector = Icons.Rounded.PictureAsPdf,
                                        contentDescription = null,
                                        tint = HubUrgent,
                                    )
                                    Spacer(Modifier.width(10.dp))
                                    Text(
                                        text = prettyAttachmentName(fileUrl, idx),
                                        style = MaterialTheme.typography.bodyMedium,
                                        modifier = Modifier.weight(1f),
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    TextButton(onClick = { onOpenUrl(fileUrl) }) {
                                        Text("Mở")
                                    }
                                    IconButton(onClick = { onDownloadPdf(fileUrl, idx) }) {
                                        Icon(
                                            imageVector = Icons.Rounded.Download,
                                            contentDescription = "Tải về máy",
                                            tint = MaterialTheme.colorScheme.primary,
                                        )
                                    }
                                }
                            }
                        }
                    }

                    if (d.extraLinks.isNotEmpty()) {
                        Spacer(Modifier.height(8.dp))
                        d.extraLinks.forEach { link ->
                            OutlinedButton(
                                onClick = { onOpenUrl(link.url) },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 6.dp),
                            ) {
                                Text(link.label.ifBlank { "Xem liên kết đính kèm" })
                            }
                        }
                    }
                }
            }

            if (displayUrl.isNotBlank()) {
                Spacer(Modifier.height(14.dp))
                Button(
                    onClick = { onOpenUrl(displayUrl) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary),
                ) {
                    Icon(Icons.AutoMirrored.Rounded.OpenInNew, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Mở bài viết gốc trên cổng HUB")
                }
            }

            Spacer(Modifier.height(28.dp))
        }
    }
}
