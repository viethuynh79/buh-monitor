package vn.hub.news.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.Crossfade
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.OpenInNew
import androidx.compose.material.icons.rounded.AccountBalance
import androidx.compose.material.icons.rounded.Bolt
import androidx.compose.material.icons.rounded.Bookmark
import androidx.compose.material.icons.rounded.BookmarkBorder
import androidx.compose.material.icons.rounded.Campaign
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.DoneAll
import androidx.compose.material.icons.rounded.Download
import androidx.compose.material.icons.rounded.KeyboardArrowUp
import androidx.compose.material.icons.rounded.Language
import androidx.compose.material.icons.rounded.Newspaper
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.NotificationsOff
import androidx.compose.material.icons.rounded.PictureAsPdf
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.Share
import androidx.compose.material.icons.rounded.Warning
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
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
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SmallFloatingActionButton
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchColors
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.launch
import vn.hub.news.BuildConfig
import vn.hub.news.R
import vn.hub.news.model.AdminAnnouncement
import vn.hub.news.model.HubCatalog
import vn.hub.news.model.NewsItem
import vn.hub.news.model.PortalHealth
import vn.hub.news.model.SourceMeta
import vn.hub.news.model.ThemeMode
import vn.hub.news.model.TimeFilter
import vn.hub.news.model.prettyAttachmentName
import vn.hub.news.ui.theme.HubNavy
import vn.hub.news.ui.theme.HubNewsTheme
import vn.hub.news.ui.theme.HubOnlineGreen
import vn.hub.news.ui.theme.HubRed
import vn.hub.news.ui.theme.HubWarnAmber
import vn.hub.news.ui.theme.HubWhite

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HubNewsApp(
    viewModel: HubViewModel,
    onRequestNotificationPermission: () -> Unit,
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    var selectedTab by rememberSaveable { mutableIntStateOf(0) }
    val snackbarHostState = remember { SnackbarHostState() }
    val haptic = LocalHapticFeedback.current
    val scope = rememberCoroutineScope()

    // Preserved scroll state per tab + smooth tap-active-tab-to-top
    val feedListState = rememberLazyListState()
    val portalsListState = rememberLazyListState()
    val bookmarksListState = rememberLazyListState()
    val settingsListState = rememberLazyListState()

    val showScrollTop by remember {
        derivedStateOf {
            selectedTab == 0 && feedListState.firstVisibleItemIndex >= 4
        }
    }

    LaunchedEffect(state.snackbarMessage) {
        if (state.snackbarMessage.isNotBlank()) {
            snackbarHostState.showSnackbar(state.snackbarMessage)
            viewModel.consumeSnackbar()
        }
    }

    HubNewsTheme(themeMode = state.prefs.themeMode) {
        Scaffold(
            snackbarHost = { SnackbarHost(snackbarHostState) },
            floatingActionButton = {
                AnimatedVisibility(
                    visible = showScrollTop,
                    enter = fadeIn(tween(180)) + scaleIn(tween(180), initialScale = 0.85f),
                    exit = fadeOut(tween(150)) + scaleOut(tween(150), targetScale = 0.85f),
                ) {
                    SmallFloatingActionButton(
                        onClick = {
                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            scope.launch { feedListState.animateScrollToItem(0) }
                        },
                        containerColor = HubNavy,
                        contentColor = HubWhite,
                        shape = CircleShape,
                    ) {
                        Icon(Icons.Rounded.KeyboardArrowUp, contentDescription = "Lên đầu trang")
                    }
                }
            },
            topBar = {
                Column {
                    TopAppBar(
                        colors = TopAppBarDefaults.topAppBarColors(
                            containerColor = HubNavy,
                            titleContentColor = HubWhite,
                            actionIconContentColor = HubWhite,
                        ),
                        title = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Surface(
                                    shape = RoundedCornerShape(10.dp),
                                    color = HubWhite,
                                    modifier = Modifier.size(36.dp),
                                ) {
                                    Image(
                                        painter = painterResource(id = R.drawable.hub_logo),
                                        contentDescription = "Logo HUB",
                                        contentScale = ContentScale.Fit,
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .padding(3.dp),
                                    )
                                }
                                Spacer(Modifier.width(10.dp))
                                Column {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = "HUB News",
                                            style = MaterialTheme.typography.titleLarge,
                                            color = HubWhite,
                                        )
                                        Spacer(Modifier.width(8.dp))
                                        HeaderStatusPill(
                                            online = state.errorMessage.isBlank(),
                                            label = if (state.fetchedAt.isNotBlank()) {
                                                state.fetchedAt.substringBefore(" ·")
                                            } else {
                                                "Trực tuyến"
                                            },
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
                                        color = HubWhite.copy(alpha = 0.84f),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                            }
                        },
                        actions = {
                            if (selectedTab == 0) {
                                if (state.unreadUids.isNotEmpty()) {
                                    IconButton(onClick = {
                                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                        viewModel.markAllRead()
                                    }) {
                                        Icon(
                                            imageVector = Icons.Rounded.DoneAll,
                                            contentDescription = "Đánh dấu đã đọc",
                                        )
                                    }
                                }
                                IconButton(onClick = {
                                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    viewModel.setSearchVisible(!state.searchVisible)
                                }) {
                                    Icon(
                                        imageVector = if (state.searchVisible) Icons.Rounded.Close else Icons.Rounded.Search,
                                        contentDescription = "Tìm kiếm",
                                    )
                                }
                                IconButton(onClick = {
                                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    viewModel.refreshFeed(forceLive = true)
                                }) {
                                    Icon(
                                        imageVector = Icons.Rounded.Refresh,
                                        contentDescription = "Làm mới",
                                    )
                                }
                            } else if (selectedTab == 1) {
                                IconButton(onClick = {
                                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    viewModel.checkPortalStatusLive()
                                }) {
                                    Icon(
                                        imageVector = Icons.Rounded.Refresh,
                                        contentDescription = "Kiểm tra trực tiếp 7 cổng",
                                    )
                                }
                            }
                        },
                    )
                    // Signature HUB Crimson Red hairline accent beneath HUB Navy header
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(3.dp)
                            .background(HubRed),
                    )
                }
            },
            bottomBar = {
                Column {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.55f))
                    NavigationBar(
                        containerColor = MaterialTheme.colorScheme.surface,
                        tonalElevation = 0.dp,
                    ) {
                        val navColors = NavigationBarItemDefaults.colors(
                            selectedIconColor = HubWhite,
                            selectedTextColor = MaterialTheme.colorScheme.primary,
                            indicatorColor = HubNavy,
                            unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        NavigationBarItem(
                            selected = selectedTab == 0,
                            onClick = {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                if (selectedTab == 0) {
                                    scope.launch { feedListState.animateScrollToItem(0) }
                                } else {
                                    selectedTab = 0
                                }
                            },
                            icon = {
                                BadgedBox(
                                    badge = {
                                        val count = state.unreadUids.size
                                        if (count > 0) {
                                            Badge(containerColor = HubRed, contentColor = HubWhite) {
                                                Text(if (count > 99) "99+" else count.toString())
                                            }
                                        }
                                    },
                                ) {
                                    Icon(Icons.Rounded.Newspaper, contentDescription = null)
                                }
                            },
                            label = { Text("Tin mới") },
                            colors = navColors,
                        )
                        NavigationBarItem(
                            selected = selectedTab == 1,
                            onClick = {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                if (selectedTab == 1) {
                                    scope.launch { portalsListState.animateScrollToItem(0) }
                                } else {
                                    selectedTab = 1
                                }
                            },
                            icon = { Icon(Icons.Rounded.AccountBalance, contentDescription = null) },
                            label = { Text("Cổng HUB") },
                            colors = navColors,
                        )
                        NavigationBarItem(
                            selected = selectedTab == 2,
                            onClick = {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                if (selectedTab == 2) {
                                    scope.launch { bookmarksListState.animateScrollToItem(0) }
                                } else {
                                    selectedTab = 2
                                }
                            },
                            icon = {
                                BadgedBox(
                                    badge = {
                                        val count = state.bookmarks.size
                                        if (count > 0) {
                                            Badge(
                                                containerColor = MaterialTheme.colorScheme.primaryContainer,
                                                contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
                                            ) {
                                                Text(if (count > 99) "99+" else count.toString())
                                            }
                                        }
                                    },
                                ) {
                                    Icon(Icons.Rounded.Bookmark, contentDescription = null)
                                }
                            },
                            label = { Text("Đã lưu") },
                            colors = navColors,
                        )
                        NavigationBarItem(
                            selected = selectedTab == 3,
                            onClick = {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                if (selectedTab == 3) {
                                    scope.launch { settingsListState.animateScrollToItem(0) }
                                } else {
                                    selectedTab = 3
                                }
                            },
                            icon = {
                                Icon(
                                    if (state.prefs.notificationsEnabled) Icons.Rounded.NotificationsActive else Icons.Rounded.Settings,
                                    contentDescription = null,
                                )
                            },
                            label = { Text("Cài đặt") },
                            colors = navColors,
                        )
                    }
                }
            },
        ) { innerPadding ->
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .background(MaterialTheme.colorScheme.background),
            ) {
                Crossfade(
                    targetState = selectedTab,
                    animationSpec = tween(durationMillis = 180),
                    label = "hub_tab_crossfade",
                ) { tab ->
                    when (tab) {
                        0 -> FeedTab(
                            state = state,
                            listState = feedListState,
                            viewModel = viewModel,
                            onRequestPermission = onRequestNotificationPermission,
                        )
                        1 -> PortalsTab(
                            state = state,
                            listState = portalsListState,
                            onOpenPortalFeed = { key ->
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                viewModel.selectSource(key)
                                selectedTab = 0
                                scope.launch { feedListState.scrollToItem(0) }
                            },
                            onCheckLive = { viewModel.checkPortalStatusLive() },
                            onOpenUrl = { viewModel.openExternalUrl(it) },
                        )
                        2 -> BookmarksTab(
                            bookmarks = state.bookmarks,
                            listState = bookmarksListState,
                            onOpen = { viewModel.openArticle(it) },
                            onRemove = {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                viewModel.toggleBookmark(it)
                            },
                        )
                        else -> SettingsTab(
                            state = state,
                            listState = settingsListState,
                            viewModel = viewModel,
                            onRequestPermission = onRequestNotificationPermission,
                        )
                    }
                }
            }
        }

        if (state.detailSheet.open) {
            ArticleDetailSheet(
                detailState = state.detailSheet,
                isBookmarked = "${state.detailSheet.code}:${state.detailSheet.id}" in state.bookmarkedUids,
                onDismiss = { viewModel.closeDetailSheet() },
                onRetry = {
                    viewModel.openArticleByCodeId(
                        code = state.detailSheet.code,
                        id = state.detailSheet.id,
                        fallbackTitle = state.detailSheet.fallbackTitle,
                        fallbackUrl = state.detailSheet.fallbackUrl,
                        fallbackSource = state.detailSheet.fallbackSource,
                        forceReload = true,
                    )
                },
                onToggleBookmark = {
                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
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
                onDownloadPdf = { url, idx ->
                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    viewModel.downloadAttachment(url, idx)
                },
                onShare = { title, url ->
                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    viewModel.shareArticle(title, url)
                },
            )
        }
    }
}

@Composable
private fun HeaderStatusPill(online: Boolean, label: String) {
    val dotColor = if (online) Color(0xFF5CE0A0) else HubWarnAmber
    Surface(
        shape = RoundedCornerShape(999.dp),
        color = HubWhite.copy(alpha = 0.14f),
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
                color = HubWhite,
            )
        }
    }
}

@Composable
private fun rememberShimmerBrush(): Brush {
    val base = MaterialTheme.colorScheme.surfaceVariant
    val highlight = MaterialTheme.colorScheme.surface
    val transition = rememberInfiniteTransition(label = "shimmer_transition")
    val shift by transition.animateFloat(
        initialValue = 0f,
        targetValue = 900f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1050, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "shimmer_shift",
    )
    return Brush.linearGradient(
        colors = listOf(base, highlight, base),
        start = Offset(shift - 300f, 0f),
        end = Offset(shift, 180f),
    )
}

@Composable
private fun ShimmerArticleCard(
    brush: Brush,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(0.75.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.6f)),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .width(96.dp)
                        .height(18.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(brush),
                )
                Spacer(Modifier.weight(1f))
                Box(
                    modifier = Modifier
                        .width(64.dp)
                        .height(14.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(brush),
                )
            }
            Spacer(Modifier.height(12.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(16.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(brush),
            )
            Spacer(Modifier.height(7.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.74f)
                    .height(16.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(brush),
            )
            Spacer(Modifier.height(12.dp))
            Box(
                modifier = Modifier
                    .width(72.dp)
                    .height(12.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(brush),
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FeedTab(
    state: HubUiState,
    listState: LazyListState,
    viewModel: HubViewModel,
    onRequestPermission: () -> Unit,
) {
    val haptic = LocalHapticFeedback.current
    val keyboard = LocalSoftwareKeyboardController.current
    val scope = rememberCoroutineScope()

    PullToRefreshBox(
        isRefreshing = state.isRefreshing,
        onRefresh = {
            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
            viewModel.refreshFeed(forceLive = true)
        },
        modifier = Modifier.fillMaxSize(),
    ) {
        LazyColumn(
            state = listState,
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(top = 10.dp, bottom = 84.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            if (!state.hasNotificationPermission) {
                item(key = "perm_banner", contentType = "banner") {
                    PermissionBanner(
                        onGrant = onRequestPermission,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                    )
                }
            }

            if (state.announcements.isNotEmpty()) {
                item(key = "admin_ann", contentType = "banner") {
                    AdminAnnouncementBanner(
                        announcement = state.announcements.first(),
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                    )
                }
            }

            item(key = "search_bar", contentType = "search") {
                AnimatedVisibility(
                    visible = state.searchVisible,
                    modifier = Modifier.animateContentSize(),
                ) {
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
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                            keyboardActions = KeyboardActions(onSearch = { keyboard?.hide() }),
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
                            items(HubCatalog.QUICK_KEYWORDS, key = { it }) { kw ->
                                FilterChip(
                                    selected = state.searchQuery.equals(kw, ignoreCase = true),
                                    onClick = {
                                        haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                        viewModel.updateSearchQuery(kw)
                                        keyboard?.hide()
                                    },
                                    label = { Text(kw, style = MaterialTheme.typography.labelMedium) },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = HubRed,
                                        selectedLabelColor = HubWhite,
                                    ),
                                )
                            }
                        }
                    }
                }
            }

            // Priority filter strip: All Portals FIRST -> Online HUB (#1) -> Remaining 6 portals
            item(key = "source_strip", contentType = "chips") {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    item(key = "src_all") {
                        FilterChip(
                            selected = state.selectedSource == "all",
                            onClick = {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                viewModel.selectSource("all")
                                scope.launch { listState.animateScrollToItem(0) }
                            },
                            label = { Text("Tất cả cổng") },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = HubNavy,
                                selectedLabelColor = HubWhite,
                            ),
                        )
                    }
                    items(state.sources, key = { it.key }) { src ->
                        val isOnline = src.key == "online"
                        val label = if (isOnline) "Online HUB (#1)" else src.shortName
                        FilterChip(
                            selected = state.selectedSource == src.key,
                            onClick = {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                viewModel.selectSource(src.key)
                                scope.launch { listState.animateScrollToItem(0) }
                            },
                            label = { Text(label) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = if (isOnline) HubRed else HubNavy,
                                selectedLabelColor = HubWhite,
                            ),
                        )
                    }
                }
            }

            // Time & Topic filter row
            item(key = "topic_time_strip", contentType = "chips") {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(TimeFilter.entries, key = { it.name }) { tf ->
                        FilterChip(
                            selected = state.timeFilter == tf,
                            onClick = {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                viewModel.selectTimeFilter(tf)
                            },
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
                            onClick = {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                viewModel.selectTopic(if (selected) "all" else tp.key)
                            },
                            label = { Text(tp.label) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = if (tp.key == "urgent") HubRed else HubNavy,
                                selectedLabelColor = HubWhite,
                            ),
                        )
                    }
                }
            }

            // Counter header
            item(key = "feed_meta", contentType = "meta") {
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
                    if (state.selectedSource != "all" || state.selectedTopic != "all" || state.searchQuery.isNotBlank() || state.timeFilter != TimeFilter.LATEST) {
                        Text(
                            text = "Đặt lại bộ lọc",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.secondary,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.clickable {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                viewModel.resetFilters()
                            },
                        )
                    }
                }
            }

            if (state.isLoading && state.allItems.isEmpty()) {
                items(6, key = { "shimmer_$it" }, contentType = { "shimmer" }) {
                    val brush = rememberShimmerBrush()
                    ShimmerArticleCard(
                        brush = brush,
                        modifier = Modifier.padding(horizontal = 16.dp),
                    )
                }
            } else if (state.errorMessage.isNotBlank() && state.filteredItems.isEmpty()) {
                item(key = "error", contentType = "status") {
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
                            Icon(Icons.Rounded.Warning, contentDescription = null, tint = HubRed, modifier = Modifier.size(32.dp))
                            Spacer(Modifier.height(8.dp))
                            Text(state.errorMessage, style = MaterialTheme.typography.bodyMedium)
                            Spacer(Modifier.height(12.dp))
                            Button(
                                onClick = { viewModel.refreshFeed(forceLive = true) },
                                colors = ButtonDefaults.buttonColors(containerColor = HubNavy, contentColor = HubWhite),
                            ) {
                                Text("Thử tải lại")
                            }
                        }
                    }
                }
            } else if (state.filteredItems.isEmpty()) {
                item(key = "empty", contentType = "status") {
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
                items(
                    items = state.filteredItems,
                    key = { it.uid },
                    contentType = { "article" },
                ) { item ->
                    NewsArticleCard(
                        item = item,
                        isUnread = item.uid in state.unreadUids,
                        isBookmarked = item.uid in state.bookmarkedUids,
                        onClick = { viewModel.openArticle(item) },
                        onBookmark = {
                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            viewModel.toggleBookmark(item)
                        },
                        modifier = Modifier
                            .padding(horizontal = 16.dp)
                            .animateItem(),
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
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.secondary.copy(alpha = 0.28f)),
    ) {
        Row(
            modifier = Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                imageVector = Icons.Rounded.NotificationsActive,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.secondary,
            )
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "Bật quyền thông báo đẩy",
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.onSecondaryContainer,
                )
                Text(
                    text = "Nhận tin mới từ 7 cổng HUB ngay cả khi đóng ứng dụng.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.width(8.dp))
            Button(
                onClick = onGrant,
                colors = ButtonDefaults.buttonColors(containerColor = HubRed, contentColor = HubWhite),
                contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp),
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
    val bg = if (announcement.urgent) {
        MaterialTheme.colorScheme.secondaryContainer
    } else {
        MaterialTheme.colorScheme.primaryContainer
    }
    val accent = if (announcement.urgent) {
        MaterialTheme.colorScheme.secondary
    } else {
        MaterialTheme.colorScheme.primary
    }
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = bg),
        border = BorderStroke(1.dp, accent.copy(alpha = 0.3f)),
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
    val isOnline = item.source == "online"
    val stripeColor = when {
        item.urgent -> HubRed
        isOnline -> HubRed.copy(alpha = 0.85f)
        else -> HubNavy
    }

    Card(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(
            width = if (item.urgent) 1.15.dp else 0.75.dp,
            color = if (item.urgent) MaterialTheme.colorScheme.secondary.copy(alpha = 0.48f) else MaterialTheme.colorScheme.outline.copy(alpha = 0.72f),
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(IntrinsicSize.Min),
        ) {
            // Signature HUB vertical accent bar (Crimson Red for Online/Urgent, Deep Navy for portals)
            Box(
                modifier = Modifier
                    .width(3.5.dp)
                    .fillMaxHeight()
                    .background(stripeColor),
            )
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 14.dp, vertical = 13.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (isUnread) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(HubRed),
                        )
                        Spacer(Modifier.width(7.dp))
                    }
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = if (isOnline) HubNavy else MaterialTheme.colorScheme.primaryContainer,
                    ) {
                        Text(
                            text = if (isOnline) "Online HUB · #1" else item.sourceShort,
                            style = MaterialTheme.typography.labelSmall,
                            color = if (isOnline) HubWhite else MaterialTheme.colorScheme.onPrimaryContainer,
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                        )
                    }
                    Spacer(Modifier.width(6.dp))
                    if (item.urgent) {
                        Surface(
                            shape = RoundedCornerShape(8.dp),
                            color = HubRed,
                        ) {
                            Text(
                                text = "KHẨN",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = HubWhite,
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

                Spacer(Modifier.height(8.dp))

                Text(
                    text = item.title,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                )

                Spacer(Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = item.topicTag,
                        style = MaterialTheme.typography.labelSmall,
                        color = if (item.urgent) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.SemiBold,
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
                            tint = if (isBookmarked) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(20.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun PortalsTab(
    state: HubUiState,
    listState: LazyListState,
    onOpenPortalFeed: (String) -> Unit,
    onCheckLive: () -> Unit,
    onOpenUrl: (String) -> Unit,
) {
    val healthByKey = remember(state.health) { state.health.associateBy { it.key } }

    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item(key = "portals_header", contentType = "header") {
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
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary),
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

        item(key = "portal_all_card", contentType = "featured") {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onOpenPortalFeed("all") },
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = HubNavy),
            ) {
                Column {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Surface(
                            shape = RoundedCornerShape(10.dp),
                            color = HubRed,
                            modifier = Modifier.size(38.dp),
                        ) {
                            Box(contentAlignment = Alignment.Center) {
                                Icon(Icons.Rounded.Bolt, contentDescription = null, tint = HubWhite)
                            }
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Tất cả cổng HUB · Mới nhất",
                                style = MaterialTheme.typography.titleMedium,
                                color = HubWhite,
                            )
                            Text(
                                text = "Gộp & khử trùng toàn bộ 7 cổng (${state.allItems.size} tin)",
                                style = MaterialTheme.typography.bodySmall,
                                color = HubWhite.copy(alpha = 0.84f),
                            )
                        }
                    }
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(3.dp)
                            .background(HubRed),
                    )
                }
            }
        }

        items(state.sources, key = { it.key }, contentType = { "portal" }) { src ->
            PortalCard(
                src = src,
                health = healthByKey[src.key],
                onOpenFeed = { onOpenPortalFeed(src.key) },
                onOpenWeb = { onOpenUrl(src.url) },
            )
        }

        item(key = "utils_header", contentType = "header") {
            Spacer(Modifier.height(8.dp))
            Text("Tiện ích sinh viên HUB", style = MaterialTheme.typography.titleMedium)
        }

        items(HubCatalog.UTILITIES, key = { it.url }, contentType = { "utility" }) { util ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onOpenUrl(util.url) },
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(0.75.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.7f)),
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Surface(
                        shape = RoundedCornerShape(10.dp),
                        color = MaterialTheme.colorScheme.primaryContainer,
                        modifier = Modifier.size(36.dp),
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Icon(
                                imageVector = Icons.Rounded.Language,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(20.dp),
                            )
                        }
                    }
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
        else -> HubRed
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
        border = BorderStroke(
            width = if (src.priority == 1) 1.15.dp else 0.75.dp,
            color = if (src.priority == 1) MaterialTheme.colorScheme.secondary.copy(alpha = 0.45f) else MaterialTheme.colorScheme.outline.copy(alpha = 0.75f),
        ),
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
                            color = HubRed,
                        ) {
                            Text(
                                text = "Ưu tiên #1",
                                style = MaterialTheme.typography.labelSmall,
                                color = HubWhite,
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
    listState: LazyListState,
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
        state = listState,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        items(bookmarks, key = { it.uid }, contentType = { "article" }) { item ->
            NewsArticleCard(
                item = item,
                isUnread = false,
                isBookmarked = true,
                onClick = { onOpen(item) },
                onBookmark = { onRemove(item) },
                modifier = Modifier.animateItem(),
            )
        }
    }
}

@Composable
private fun SettingsTab(
    state: HubUiState,
    listState: LazyListState,
    viewModel: HubViewModel,
    onRequestPermission: () -> Unit,
) {
    val prefs = state.prefs
    val haptic = LocalHapticFeedback.current
    val switchColors = SwitchDefaults.colors(
        checkedThumbColor = HubWhite,
        checkedTrackColor = HubNavy,
    )

    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item(key = "notify_card", contentType = "settings") {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(0.75.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.75f)),
            ) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = if (prefs.notificationsEnabled) Icons.Rounded.NotificationsActive else Icons.Rounded.NotificationsOff,
                            contentDescription = null,
                            tint = if (prefs.notificationsEnabled) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.width(10.dp))
                        Text("Thông báo tự động", style = MaterialTheme.typography.titleMedium)
                    }
                    Spacer(Modifier.height(12.dp))

                    if (!state.hasNotificationPermission) {
                        Button(
                            onClick = onRequestPermission,
                            colors = ButtonDefaults.buttonColors(containerColor = HubRed, contentColor = HubWhite),
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
                        colors = switchColors,
                        onCheckedChange = {
                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            viewModel.setNotificationsEnabled(it)
                        },
                    )
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))

                    SettingSwitchRow(
                        title = "Chế độ Quét nhanh 5 phút",
                        subtitle = "Theo dõi sát từng 5 phút như BOT (phù hợp tuần đăng ký học phần)",
                        checked = prefs.fastFiveMinMode,
                        enabled = prefs.notificationsEnabled,
                        colors = switchColors,
                        onCheckedChange = {
                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            viewModel.setFastFiveMinMode(it)
                        },
                    )
                    HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp), color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))

                    SettingSwitchRow(
                        title = "Chỉ báo tin Khẩn & Quản trị",
                        subtitle = "Lọc riêng hạn cuối, huỷ học phần, cảnh báo và thông báo Admin",
                        checked = prefs.urgentOnly,
                        enabled = prefs.notificationsEnabled,
                        colors = switchColors,
                        onCheckedChange = {
                            haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            viewModel.setUrgentOnly(it)
                        },
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
                            onClick = {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                viewModel.syncAndNotifyNow()
                            },
                            enabled = !state.isSyncingNow,
                            colors = ButtonDefaults.buttonColors(containerColor = HubNavy, contentColor = HubWhite),
                            modifier = Modifier.weight(1f),
                        ) {
                            if (state.isSyncingNow) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(16.dp),
                                    strokeWidth = 2.dp,
                                    color = HubWhite,
                                )
                                Spacer(Modifier.width(6.dp))
                            }
                            Text("Quét tin ngay")
                        }
                        OutlinedButton(
                            onClick = {
                                haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                viewModel.sendTestNotification()
                            },
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.secondary),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.secondary),
                            modifier = Modifier.weight(1f),
                        ) {
                            Text("Thông báo thử")
                        }
                    }
                }
            }
        }

        item(key = "portal_toggles", contentType = "settings") {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(0.75.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.75f)),
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
                                colors = switchColors,
                                onCheckedChange = {
                                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    viewModel.toggleMutedSource(src.key)
                                },
                            )
                        }
                        if (idx < state.sources.lastIndex) {
                            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.35f))
                        }
                    }
                }
            }
        }

        item(key = "theme_card", contentType = "settings") {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(0.75.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.75f)),
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
                                onClick = {
                                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                    viewModel.setThemeMode(mode)
                                },
                                label = { Text(mode.label) },
                                colors = FilterChipDefaults.filterChipColors(
                                    selectedContainerColor = HubNavy,
                                    selectedLabelColor = HubWhite,
                                ),
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }
            }
        }

        item(key = "author_card", contentType = "about") {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                border = BorderStroke(0.75.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.75f)),
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { viewModel.openExternalUrl(HubCatalog.AUTHOR_FB_URL) }
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Surface(
                        shape = RoundedCornerShape(12.dp),
                        color = HubWhite,
                        border = BorderStroke(0.8.dp, MaterialTheme.colorScheme.outline),
                        modifier = Modifier.size(44.dp),
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.hub_logo),
                            contentDescription = "Logo HUB",
                            contentScale = ContentScale.Fit,
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(4.dp),
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "HUB News · v${BuildConfig.VERSION_NAME}",
                            style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        Text(
                            text = "Tác giả: ${HubCatalog.AUTHOR_NAME}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface,
                        )
                        Text(
                            text = "ĐH Ngân hàng TP.HCM · Cập nhật 24/7",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Icon(
                        imageVector = Icons.AutoMirrored.Rounded.OpenInNew,
                        contentDescription = "Facebook",
                        tint = MaterialTheme.colorScheme.secondary,
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
    colors: SwitchColors = SwitchDefaults.colors(),
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
            colors = colors,
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
                .padding(horizontal = 20.dp, vertical = 6.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = HubNavy,
                ) {
                    Text(
                        text = d?.sourceName?.ifBlank { detailState.fallbackSource } ?: detailState.fallbackSource.ifBlank { "HUB News" },
                        style = MaterialTheme.typography.labelSmall,
                        color = HubWhite,
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
                        tint = if (isBookmarked) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.onSurfaceVariant,
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
                    color = MaterialTheme.colorScheme.secondaryContainer,
                    border = BorderStroke(1.dp, MaterialTheme.colorScheme.secondary.copy(alpha = 0.28f)),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            Icons.Rounded.Schedule,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.secondary,
                            modifier = Modifier.size(18.dp),
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = "Hạn: ${d.deadline}",
                            style = MaterialTheme.typography.titleSmall,
                            color = MaterialTheme.colorScheme.onSecondaryContainer,
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
                    val brush = rememberShimmerBrush()
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        repeat(4) { idx ->
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth(if (idx == 3) 0.65f else 1f)
                                    .height(15.dp)
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(brush),
                            )
                        }
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
                            color = MaterialTheme.colorScheme.secondary,
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
                                        tint = MaterialTheme.colorScheme.secondary,
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
                                        Text("Mở", color = MaterialTheme.colorScheme.primary)
                                    }
                                    IconButton(onClick = { onDownloadPdf(fileUrl, idx) }) {
                                        Icon(
                                            imageVector = Icons.Rounded.Download,
                                            contentDescription = "Tải về máy",
                                            tint = MaterialTheme.colorScheme.secondary,
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
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Button(
                        onClick = { onOpenUrl(displayUrl) },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = HubNavy, contentColor = HubWhite),
                    ) {
                        Icon(Icons.AutoMirrored.Rounded.OpenInNew, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(8.dp))
                        Text("Mở bài gốc HUB")
                    }
                    OutlinedButton(
                        onClick = { onShare(displayTitle, displayUrl) },
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.secondary),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.secondary),
                    ) {
                        Icon(Icons.Rounded.Share, contentDescription = null, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("Chia sẻ")
                    }
                }
            }

            Spacer(Modifier.height(28.dp))
        }
    }
}
