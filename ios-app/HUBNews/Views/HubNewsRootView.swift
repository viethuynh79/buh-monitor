import SwiftUI

struct HubNewsRootView: View {
    @ObservedObject var viewModel: HubViewModel
    @State private var selectedTab: Int = 0
    @State private var safariLink: SafariLink?

    private var preferredScheme: ColorScheme? {
        switch viewModel.prefs.themeMode {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            TabView(selection: $selectedTab) {
                FeedTabView(viewModel: viewModel)
                    .tabItem {
                        Label("Tin mới", systemImage: "newspaper.fill")
                    }
                    .badge(viewModel.unreadUids.count)
                    .tag(0)

                PortalsTabView(
                    viewModel: viewModel,
                    onSelectPortal: { key in
                        viewModel.selectSource(key)
                        selectedTab = 0
                    },
                    onOpenURL: openInAppBrowser
                )
                .tabItem {
                    Label("Cổng HUB", systemImage: "building.columns.fill")
                }
                .tag(1)

                BookmarksTabView(viewModel: viewModel)
                    .tabItem {
                        Label("Đã lưu", systemImage: "bookmark.fill")
                    }
                    .badge(viewModel.bookmarks.count)
                    .tag(2)

                SettingsTabView(
                    viewModel: viewModel,
                    onOpenURL: openInAppBrowser
                )
                .tabItem {
                    Label("Cài đặt", systemImage: viewModel.prefs.notificationsEnabled ? "bell.badge.fill" : "gearshape.fill")
                }
                .tag(3)
            }
            .tint(HubPalette.adaptivePrimary)

            if !viewModel.toastMessage.isEmpty {
                Text(viewModel.toastMessage)
                    .font(.footnote.weight(.semibold))
                    .foregroundColor(HubPalette.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 10)
                    .background(HubPalette.navyDeep.opacity(0.95))
                    .clipShape(Capsule())
                    .overlay(
                        Capsule()
                            .stroke(HubPalette.red.opacity(0.75), lineWidth: 1)
                    )
                    .shadow(color: .black.opacity(0.18), radius: 8, y: 4)
                    .padding(.bottom, 64)
                    .padding(.horizontal, 20)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .preferredColorScheme(preferredScheme)
        .sheet(item: $viewModel.activeDetailTarget) { target in
            ArticleDetailSheetView(
                target: target,
                viewModel: viewModel
            )
            .preferredColorScheme(preferredScheme)
        }
        .sheet(item: $safariLink) { link in
            SafariView(url: link.url)
                .ignoresSafeArea()
        }
        .onReceive(NotificationCenter.default.publisher(for: .hubOpenArticleFromNotification)) { note in
            guard let info = note.userInfo,
                  let code = info["code"] as? String,
                  let id = info["id"] as? String else { return }
            viewModel.openArticleByCodeId(
                code: code,
                id: id,
                fallbackTitle: info["title"] as? String ?? "",
                fallbackUrl: info["url"] as? String ?? "",
                fallbackSource: info["sourceName"] as? String ?? ""
            )
        }
    }

    private func openInAppBrowser(_ urlString: String) {
        guard let url = URL(string: urlString),
              let scheme = url.scheme?.lowercased(),
              scheme == "http" || scheme == "https" else {
            return
        }
        safariLink = SafariLink(url: url)
    }
}

// MARK: - Signature HUB Navigation Header (HUB Navy + Official HUB Logo + 3pt Crimson Red Bar)

private struct HubHeaderChrome: ViewModifier {
    let subtitle: String
    let fetchedAt: String
    let online: Bool

    func body(content: Content) -> some View {
        VStack(spacing: 0) {
            // Signature 3pt HUB Crimson Red hairline below Navy Navigation Bar
            Rectangle()
                .fill(HubPalette.red)
                .frame(height: 3)
            content
        }
        .background(HubPalette.canvasBg.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(HubPalette.navy, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .navigationBarLeading) {
                HStack(spacing: 10) {
                    Image("HUBLogo")
                        .resizable()
                        .scaledToFit()
                        .padding(3)
                        .frame(width: 30, height: 30)
                        .background(HubPalette.white)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                    VStack(alignment: .leading, spacing: 1) {
                        HStack(spacing: 6) {
                            Text("HUB News")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(HubPalette.white)
                            HStack(spacing: 4) {
                                Circle()
                                    .fill(online ? Color(hex: 0x5CE0A0) : HubPalette.warnAmber)
                                    .frame(width: 6, height: 6)
                                Text(fetchedAt.isEmpty ? "Trực tuyến" : fetchedAt.components(separatedBy: " ·").first ?? "Trực tuyến")
                                    .font(.system(size: 10, weight: .semibold))
                                    .foregroundColor(HubPalette.white)
                            }
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(HubPalette.white.opacity(0.15))
                            .clipShape(Capsule())
                        }
                        Text(subtitle)
                            .font(.system(size: 11, weight: .regular))
                            .foregroundColor(HubPalette.white.opacity(0.84))
                            .lineLimit(1)
                    }
                }
            }
        }
    }
}

private extension View {
    func hubHeader(subtitle: String, fetchedAt: String, online: Bool) -> some View {
        modifier(HubHeaderChrome(subtitle: subtitle, fetchedAt: fetchedAt, online: online))
    }
}

// MARK: - Tab 1: Tin mới (Feed)

private struct FeedTabView: View {
    @ObservedObject var viewModel: HubViewModel
    @FocusState private var searchFocused: Bool

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 10) {
                        Color.clear
                            .frame(height: 1)
                            .id("feed_top")

                        if !viewModel.hasNotificationPermission {
                            PermissionBannerView {
                                viewModel.requestNotificationPermission()
                            }
                            .padding(.horizontal, 16)
                        }

                        if let latestAnn = viewModel.announcements.first {
                            AdminBannerView(announcement: latestAnn)
                                .padding(.horizontal, 16)
                        }

                        if viewModel.searchVisible {
                            VStack(spacing: 8) {
                                HStack(spacing: 8) {
                                    Image(systemName: "magnifyingglass")
                                        .foregroundColor(HubPalette.secondaryText)
                                    TextField(
                                        "Tìm không dấu: hoc bong, lich thi, hoc phi...",
                                        text: Binding(
                                            get: { viewModel.searchQuery },
                                            set: { viewModel.updateSearchQuery($0) }
                                        )
                                    )
                                    .textInputAutocapitalization(.never)
                                    .disableAutocorrection(true)
                                    .submitLabel(.search)
                                    .focused($searchFocused)
                                    .onSubmit { searchFocused = false }

                                    if !viewModel.searchQuery.isEmpty {
                                        Button {
                                            viewModel.updateSearchQuery("")
                                        } label: {
                                            Image(systemName: "xmark.circle.fill")
                                                .foregroundColor(HubPalette.secondaryText)
                                        }
                                    }
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 10)
                                .background(HubPalette.cardSurface)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .stroke(HubPalette.hairline, lineWidth: 1)
                                )

                                ScrollView(.horizontal) {
                                    HStack(spacing: 6) {
                                        ForEach(HubCatalog.quickKeywords, id: \.self) { kw in
                                            let active = viewModel.searchQuery.caseInsensitiveCompare(kw) == .orderedSame
                                            FilterPill(
                                                title: kw,
                                                selected: active,
                                                activeColor: HubPalette.red
                                            ) {
                                                viewModel.updateSearchQuery(kw)
                                                searchFocused = false
                                            }
                                        }
                                    }
                                }
                                .scrollIndicators(.hidden)
                            }
                            .padding(.horizontal, 16)
                            .transition(.opacity.combined(with: .move(edge: .top)))
                        }

                        // Source filter strip: All Portals FIRST -> Online HUB (#1) -> 6 remaining portals
                        ScrollView(.horizontal) {
                            HStack(spacing: 8) {
                                FilterPill(
                                    title: "Tất cả cổng",
                                    selected: viewModel.selectedSource == "all",
                                    activeColor: HubPalette.navy
                                ) {
                                    viewModel.selectSource("all")
                                    withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo("feed_top") }
                                }

                                ForEach(viewModel.sources) { src in
                                    let isOnline = src.key == "online"
                                    FilterPill(
                                        title: isOnline ? "Online HUB (#1)" : src.shortName,
                                        selected: viewModel.selectedSource == src.key,
                                        activeColor: isOnline ? HubPalette.red : HubPalette.navy
                                    ) {
                                        viewModel.selectSource(src.key)
                                        withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo("feed_top") }
                                    }
                                }
                            }
                            .padding(.horizontal, 16)
                        }
                        .scrollIndicators(.hidden)

                        // Time + Topic filter strip
                        ScrollView(.horizontal) {
                            HStack(spacing: 8) {
                                ForEach(TimeFilter.allCases) { tf in
                                    FilterPill(
                                        title: tf.label,
                                        selected: viewModel.timeFilter == tf,
                                        activeColor: HubPalette.red
                                    ) {
                                        viewModel.selectTimeFilter(tf)
                                    }
                                }

                                ForEach(HubCatalog.topics.dropFirst()) { tp in
                                    let sel = viewModel.selectedTopic == tp.key
                                    FilterPill(
                                        title: tp.label,
                                        selected: sel,
                                        activeColor: tp.key == "urgent" ? HubPalette.red : HubPalette.navy
                                    ) {
                                        viewModel.selectTopic(sel ? "all" : tp.key)
                                    }
                                }
                            }
                            .padding(.horizontal, 16)
                        }
                        .scrollIndicators(.hidden)

                        // Counter bar
                        HStack {
                            Text("\(viewModel.filteredItems.count) thông báo")
                                .font(.caption.weight(.medium))
                                .foregroundColor(HubPalette.secondaryText)
                            Spacer()
                            if viewModel.selectedSource != "all" || viewModel.selectedTopic != "all" || !viewModel.searchQuery.isEmpty || viewModel.timeFilter != .latest {
                                Button("Đặt lại bộ lọc") {
                                    viewModel.resetFilters()
                                }
                                .font(.caption.weight(.semibold))
                                .foregroundColor(HubPalette.adaptiveRed)
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.top, 2)

                        // Content list
                        if viewModel.isLoading && viewModel.allItems.isEmpty {
                            ForEach(0..<6, id: \.self) { _ in
                                ShimmerCardView()
                                    .padding(.horizontal, 16)
                            }
                        } else if !viewModel.errorMessage.isEmpty && viewModel.filteredItems.isEmpty {
                            VStack(spacing: 12) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .font(.system(size: 28))
                                    .foregroundColor(HubPalette.red)
                                Text(viewModel.errorMessage)
                                    .font(.subheadline)
                                    .foregroundColor(HubPalette.primaryText)
                                    .multilineTextAlignment(.center)
                                Button("Thử tải lại") {
                                    Task { await viewModel.refreshFeed(forceLive: true) }
                                }
                                .buttonStyle(.borderedProminent)
                                .tint(HubPalette.navy)
                            }
                            .padding(24)
                            .frame(maxWidth: .infinity)
                            .background(HubPalette.cardSurface)
                            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                            .padding(.horizontal, 16)
                        } else if viewModel.filteredItems.isEmpty {
                            Text("Không có thông báo phù hợp với bộ lọc hiện tại.")
                                .font(.subheadline)
                                .foregroundColor(HubPalette.secondaryText)
                                .padding(.vertical, 48)
                                .padding(.horizontal, 24)
                        } else {
                            ForEach(viewModel.filteredItems, id: \.uid) { item in
                                NewsCardView(
                                    item: item,
                                    isUnread: viewModel.unreadUids.contains(item.uid),
                                    isBookmarked: viewModel.bookmarkedUids.contains(item.uid),
                                    onTap: { viewModel.openArticle(item) },
                                    onBookmark: { viewModel.toggleBookmark(item) }
                                )
                                .padding(.horizontal, 16)
                            }
                        }
                    }
                    .padding(.top, 10)
                    .padding(.bottom, 28)
                }
                .refreshable {
                    HubHaptics.light()
                    await viewModel.refreshFeed(forceLive: true)
                }
                .hubHeader(
                    subtitle: "7 cổng chính thức · Ưu tiên Online HUB",
                    fetchedAt: viewModel.fetchedAt,
                    online: viewModel.errorMessage.isEmpty
                )
                .toolbar {
                    ToolbarItemGroup(placement: .navigationBarTrailing) {
                        if !viewModel.unreadUids.isEmpty {
                            Button {
                                viewModel.markAllRead()
                            } label: {
                                Image(systemName: "checkmark.circle")
                            }
                        }
                        Button {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                viewModel.toggleSearchVisible()
                            }
                            if viewModel.searchVisible {
                                searchFocused = true
                            }
                        } label: {
                            Image(systemName: viewModel.searchVisible ? "xmark" : "magnifyingglass")
                        }
                        Button {
                            HubHaptics.light()
                            Task { await viewModel.refreshFeed(forceLive: true) }
                        } label: {
                            Image(systemName: "arrow.clockwise")
                        }
                    }
                }
            }
        }
    }
}

private struct FilterPill: View {
    let title: String
    let selected: Bool
    let activeColor: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundColor(selected ? HubPalette.white : HubPalette.primaryText)
                .padding(.horizontal, 12)
                .padding(.vertical, 7)
                .background(selected ? activeColor : HubPalette.cardSurface)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(selected ? activeColor : HubPalette.hairline, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}

private struct NewsCardView: View {
    let item: NewsItem
    let isUnread: Bool
    let isBookmarked: Bool
    let onTap: () -> Void
    let onBookmark: () -> Void

    private var isOnline: Bool { item.source == "online" }
    private var stripeColor: Color {
        if item.urgent { return HubPalette.red }
        if isOnline { return HubPalette.red.opacity(0.85) }
        return HubPalette.navy
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 0) {
                Rectangle()
                    .fill(stripeColor)
                    .frame(width: 3.5)

                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 6) {
                        if isUnread {
                            Circle()
                                .fill(HubPalette.red)
                                .frame(width: 8, height: 8)
                        }

                        Text(isOnline ? "Online HUB · #1" : item.sourceShort)
                            .font(.caption2.weight(.semibold))
                            .foregroundColor(isOnline ? HubPalette.white : HubPalette.adaptivePrimary)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(isOnline ? HubPalette.navy : HubPalette.adaptiveNavyContainer)
                            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))

                        if item.urgent {
                            Text("KHẨN")
                                .font(.caption2.weight(.bold))
                                .foregroundColor(HubPalette.white)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 3)
                                .background(HubPalette.red)
                                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                        }

                        Spacer()

                        Text(item.date)
                            .font(.caption2)
                            .foregroundColor(HubPalette.secondaryText)
                    }

                    Text(item.title)
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundColor(HubPalette.primaryText)
                        .lineLimit(3)
                        .multilineTextAlignment(.leading)

                    HStack {
                        Text(item.topicTag)
                            .font(.caption2.weight(.semibold))
                            .foregroundColor(item.urgent ? HubPalette.adaptiveRed : HubPalette.adaptivePrimary)
                        if !item.alsoIn.isEmpty {
                            Text("· +\(item.alsoIn.count) cổng khác")
                                .font(.caption2)
                                .foregroundColor(HubPalette.secondaryText)
                        }
                        Spacer()
                        Button(action: onBookmark) {
                            Image(systemName: isBookmarked ? "bookmark.fill" : "bookmark")
                                .font(.system(size: 15, weight: .medium))
                                .foregroundColor(isBookmarked ? HubPalette.adaptiveRed : HubPalette.secondaryText)
                                .padding(4)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
            }
            .background(HubPalette.cardSurface)
            .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 15, style: .continuous)
                    .stroke(
                        item.urgent ? HubPalette.adaptiveRed.opacity(0.45) : HubPalette.hairline.opacity(0.85),
                        lineWidth: item.urgent ? 1.1 : 0.75
                    )
            )
        }
        .buttonStyle(.plain)
    }
}

private struct ShimmerCardView: View {
    @State private var pulse = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                RoundedRectangle(cornerRadius: 6)
                    .fill(HubPalette.subtleSurface)
                    .frame(width: 96, height: 18)
                Spacer()
                RoundedRectangle(cornerRadius: 6)
                    .fill(HubPalette.subtleSurface)
                    .frame(width: 64, height: 14)
            }
            RoundedRectangle(cornerRadius: 6)
                .fill(HubPalette.subtleSurface)
                .frame(height: 16)
            RoundedRectangle(cornerRadius: 6)
                .fill(HubPalette.subtleSurface)
                .frame(width: 220, height: 16)
            RoundedRectangle(cornerRadius: 6)
                .fill(HubPalette.subtleSurface)
                .frame(width: 80, height: 12)
        }
        .padding(16)
        .background(HubPalette.cardSurface)
        .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
        .opacity(pulse ? 0.52 : 1.0)
        .onAppear {
            withAnimation(.easeInOut(duration: 0.85).repeatForever(autoreverses: true)) {
                pulse = true
            }
        }
    }
}

private struct PermissionBannerView: View {
    let onGrant: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "bell.badge.fill")
                .font(.title3)
                .foregroundColor(HubPalette.adaptiveRed)
            VStack(alignment: .leading, spacing: 2) {
                Text("Bật quyền thông báo đẩy")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(HubPalette.primaryText)
                Text("Nhận tin mới từ 7 cổng HUB ngay cả khi đóng ứng dụng.")
                    .font(.caption)
                    .foregroundColor(HubPalette.secondaryText)
            }
            Spacer()
            Button("Bật", action: onGrant)
                .font(.caption.weight(.bold))
                .foregroundColor(HubPalette.white)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(HubPalette.red)
                .clipShape(Capsule())
        }
        .padding(14)
        .background(HubPalette.adaptiveRedContainer)
        .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 15, style: .continuous)
                .stroke(HubPalette.adaptiveRed.opacity(0.3), lineWidth: 1)
        )
    }
}

private struct AdminBannerView: View {
    let announcement: AdminAnnouncement

    var body: some View {
        let accent = announcement.urgent ? HubPalette.adaptiveRed : HubPalette.adaptivePrimary
        let bg = announcement.urgent ? HubPalette.adaptiveRedContainer : HubPalette.adaptiveNavyContainer
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: "megaphone.fill")
                    .font(.caption)
                    .foregroundColor(accent)
                Text(announcement.urgent ? "THÔNG BÁO KHẨN TỪ QUẢN TRỊ VIÊN" : "THÔNG BÁO TỪ QUẢN TRỊ VIÊN")
                    .font(.caption.weight(.bold))
                    .foregroundColor(accent)
            }
            Text(announcement.text)
                .font(.subheadline)
                .foregroundColor(HubPalette.primaryText)
            Text("\(announcement.label) · Admin \(announcement.author)")
                .font(.caption2)
                .foregroundColor(HubPalette.secondaryText)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(bg)
        .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 15, style: .continuous)
                .stroke(accent.opacity(0.32), lineWidth: 1)
        )
    }
}

// MARK: - Tab 2: Các Cổng HUB

private struct PortalsTabView: View {
    @ObservedObject var viewModel: HubViewModel
    let onSelectPortal: (String) -> Void
    let onOpenURL: (String) -> Void

    private var healthByKey: [String: PortalHealth] {
        Dictionary(uniqueKeysWithValues: viewModel.health.map { ($0.key, $0) })
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 10) {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Các Cổng HUB")
                                .font(.headline)
                                .foregroundColor(HubPalette.primaryText)
                            Text("7 cổng chính thức · Tự động cập nhật 5 phút/lần")
                                .font(.caption)
                                .foregroundColor(HubPalette.secondaryText)
                        }
                        Spacer()
                        Button {
                            viewModel.checkPortalStatusLive()
                        } label: {
                            HStack(spacing: 6) {
                                if viewModel.isCheckingStatus {
                                    ProgressView().scaleEffect(0.75)
                                }
                                Text("Kiểm tra live")
                                    .font(.caption.weight(.semibold))
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .foregroundColor(HubPalette.adaptivePrimary)
                            .overlay(
                                Capsule().stroke(HubPalette.adaptivePrimary, lineWidth: 1)
                            )
                        }
                        .disabled(viewModel.isCheckingStatus)
                    }

                    // Featured All-Portals card
                    Button {
                        onSelectPortal("all")
                    } label: {
                        VStack(spacing: 0) {
                            HStack(spacing: 12) {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                        .fill(HubPalette.red)
                                        .frame(width: 38, height: 38)
                                    Image(systemName: "bolt.fill")
                                        .foregroundColor(HubPalette.white)
                                }
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Tất cả cổng HUB · Mới nhất")
                                        .font(.subheadline.weight(.bold))
                                        .foregroundColor(HubPalette.white)
                                    Text("Gộp & khử trùng toàn bộ 7 cổng (\(viewModel.allItems.count) tin)")
                                        .font(.caption)
                                        .foregroundColor(HubPalette.white.opacity(0.84))
                                }
                                Spacer()
                            }
                            .padding(15)
                            Rectangle()
                                .fill(HubPalette.red)
                                .frame(height: 3)
                        }
                        .background(HubPalette.navy)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                    .buttonStyle(.plain)

                    ForEach(viewModel.sources) { src in
                        let h = healthByKey[src.key]
                        PortalRowView(
                            src: src,
                            health: h,
                            onSelect: { onSelectPortal(src.key) },
                            onOpenWeb: { onOpenURL(src.url) }
                        )
                    }

                    Text("Tiện ích sinh viên HUB")
                        .font(.headline)
                        .foregroundColor(HubPalette.primaryText)
                        .padding(.top, 10)

                    ForEach(HubCatalog.utilities) { util in
                        Button {
                            onOpenURL(util.url)
                        } label: {
                            HStack(spacing: 12) {
                                ZStack {
                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                        .fill(HubPalette.adaptiveNavyContainer)
                                        .frame(width: 36, height: 36)
                                    Image(systemName: "globe")
                                        .foregroundColor(HubPalette.adaptivePrimary)
                                }
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(util.title)
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundColor(HubPalette.primaryText)
                                    Text(util.subtitle)
                                        .font(.caption)
                                        .foregroundColor(HubPalette.secondaryText)
                                }
                                Spacer()
                                Image(systemName: "arrow.up.right.square")
                                    .foregroundColor(HubPalette.secondaryText)
                            }
                            .padding(13)
                            .background(HubPalette.cardSurface)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 14, style: .continuous)
                                    .stroke(HubPalette.hairline.opacity(0.8), lineWidth: 0.75)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(16)
            }
            .hubHeader(
                subtitle: "Các Cổng HUB & Tiện ích sinh viên",
                fetchedAt: viewModel.fetchedAt,
                online: viewModel.errorMessage.isEmpty
            )
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        viewModel.checkPortalStatusLive()
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
        }
    }
}

private struct PortalRowView: View {
    let src: SourceMeta
    let health: PortalHealth?
    let onSelect: () -> Void
    let onOpenWeb: () -> Void

    private var dotColor: Color {
        guard let h = health else { return HubPalette.hairline }
        if h.ok && !h.fallback { return HubPalette.onlineGreen }
        if h.ok && h.fallback { return HubPalette.warnAmber }
        return HubPalette.red
    }

    private var statusText: String {
        guard let h = health else { return "Sẵn sàng đồng bộ" }
        if h.ok && h.fallback { return "\(h.count) tin · Bản đệm nhanh" }
        if h.ok {
            let msPart = h.ms > 0 ? " · \(h.ms)ms" : ""
            return "\(h.count) tin · Mới nhất \(h.latestDate)\(msPart)"
        }
        return h.error.isEmpty ? "Tạm thời không phản hồi" : h.error
    }

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 12) {
                Circle()
                    .fill(dotColor)
                    .frame(width: 10, height: 10)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        Text(src.name)
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(HubPalette.primaryText)
                        if src.priority == 1 {
                            Text("Ưu tiên #1")
                                .font(.caption2.weight(.bold))
                                .foregroundColor(HubPalette.white)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(HubPalette.red)
                                .clipShape(RoundedRectangle(cornerRadius: 5, style: .continuous))
                        }
                    }
                    Text(statusText)
                        .font(.caption)
                        .foregroundColor(HubPalette.secondaryText)
                }
                Spacer()
                Button(action: onOpenWeb) {
                    Image(systemName: "arrow.up.right.square")
                        .foregroundColor(HubPalette.secondaryText)
                        .padding(6)
                }
                .buttonStyle(.plain)
            }
            .padding(14)
            .background(HubPalette.cardSurface)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(
                        src.priority == 1 ? HubPalette.adaptiveRed.opacity(0.45) : HubPalette.hairline.opacity(0.8),
                        lineWidth: src.priority == 1 ? 1.1 : 0.75
                    )
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Tab 3: Đã lưu (Bookmarks)

private struct BookmarksTabView: View {
    @ObservedObject var viewModel: HubViewModel

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.bookmarks.isEmpty {
                    VStack(spacing: 10) {
                        Image(systemName: "bookmark")
                            .font(.system(size: 38))
                            .foregroundColor(HubPalette.secondaryText)
                        Text("Chưa có thông báo đã lưu")
                            .font(.headline)
                            .foregroundColor(HubPalette.primaryText)
                        Text("Bấm biểu tượng dấu trang trên mỗi thông báo để lưu xem nhanh kể cả khi không có mạng.")
                            .font(.caption)
                            .foregroundColor(HubPalette.secondaryText)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ScrollView {
                        LazyVStack(spacing: 10) {
                            ForEach(viewModel.bookmarks, id: \.uid) { item in
                                NewsCardView(
                                    item: item,
                                    isUnread: false,
                                    isBookmarked: true,
                                    onTap: { viewModel.openArticle(item) },
                                    onBookmark: { viewModel.toggleBookmark(item) }
                                )
                            }
                        }
                        .padding(16)
                    }
                }
            }
            .hubHeader(
                subtitle: "Thông báo đã lưu (\(viewModel.bookmarks.count))",
                fetchedAt: viewModel.fetchedAt,
                online: viewModel.errorMessage.isEmpty
            )
        }
    }
}

// MARK: - Tab 4: Cài đặt & Thông báo

private struct SettingsTabView: View {
    @ObservedObject var viewModel: HubViewModel
    let onOpenURL: (String) -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    // Notification control card
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(spacing: 8) {
                            Image(systemName: viewModel.prefs.notificationsEnabled ? "bell.badge.fill" : "bell.slash.fill")
                                .foregroundColor(viewModel.prefs.notificationsEnabled ? HubPalette.adaptiveRed : HubPalette.secondaryText)
                            Text("Thông báo tự động")
                                .font(.headline)
                                .foregroundColor(HubPalette.primaryText)
                        }

                        if !viewModel.hasNotificationPermission {
                            Button {
                                viewModel.requestNotificationPermission()
                            } label: {
                                Label("Cấp quyền thông báo iOS", systemImage: "bell.fill")
                                    .font(.subheadline.weight(.semibold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 10)
                                    .background(HubPalette.red)
                                    .foregroundColor(HubPalette.white)
                                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            }
                        }

                        Toggle(isOn: Binding(
                            get: { viewModel.prefs.notificationsEnabled },
                            set: { viewModel.setNotificationsEnabled($0) }
                        )) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Tự động báo tin mới HUB")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundColor(HubPalette.primaryText)
                                Text("Chạy nền bằng iOS Background App Refresh")
                                    .font(.caption)
                                    .foregroundColor(HubPalette.secondaryText)
                            }
                        }
                        .tint(HubPalette.navy)

                        Divider()

                        Toggle(isOn: Binding(
                            get: { viewModel.prefs.urgentOnly },
                            set: { viewModel.setUrgentOnly($0) }
                        )) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Chỉ báo tin Khẩn & Quản trị")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundColor(HubPalette.primaryText)
                                Text("Lọc riêng hạn cuối, huỷ học phần, cảnh báo và tin Admin")
                                    .font(.caption)
                                    .foregroundColor(HubPalette.secondaryText)
                            }
                        }
                        .tint(HubPalette.navy)
                        .disabled(!viewModel.prefs.notificationsEnabled)

                        Text("Lần kiểm tra gần nhất: \(viewModel.prefs.lastSyncAtLabel)")
                            .font(.caption)
                            .foregroundColor(HubPalette.secondaryText)

                        HStack(spacing: 10) {
                            Button {
                                viewModel.syncAndNotifyNow()
                            } label: {
                                HStack(spacing: 6) {
                                    if viewModel.isSyncingNow {
                                        ProgressView().tint(HubPalette.white).scaleEffect(0.8)
                                    }
                                    Text("Quét tin ngay")
                                        .font(.subheadline.weight(.semibold))
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                                .background(HubPalette.navy)
                                .foregroundColor(HubPalette.white)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            }
                            .disabled(viewModel.isSyncingNow)

                            Button {
                                viewModel.sendTestNotification()
                            } label: {
                                Text("Thông báo thử")
                                    .font(.subheadline.weight(.semibold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 10)
                                    .foregroundColor(HubPalette.adaptiveRed)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                                            .stroke(HubPalette.adaptiveRed, lineWidth: 1.2)
                                    )
                            }
                        }
                    }
                    .padding(16)
                    .background(HubPalette.cardSurface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(HubPalette.hairline.opacity(0.8), lineWidth: 0.75)
                    )

                    // Per-portal toggles
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Chọn cổng nhận thông báo")
                            .font(.headline)
                            .foregroundColor(HubPalette.primaryText)
                        Text("Bật/tắt thông báo đẩy theo từng cổng HUB")
                            .font(.caption)
                            .foregroundColor(HubPalette.secondaryText)

                        ForEach(Array(viewModel.sources.enumerated()), id: \.element.key) { idx, src in
                            Toggle(isOn: Binding(
                                get: { !viewModel.prefs.mutedSources.contains(src.key) },
                                set: { _ in viewModel.toggleMutedSource(src.key) }
                            )) {
                                Text(src.priority == 1 ? "\(src.name) (Ưu tiên #1)" : src.name)
                                    .font(.subheadline)
                                    .foregroundColor(HubPalette.primaryText)
                            }
                            .tint(HubPalette.navy)
                            .disabled(!viewModel.prefs.notificationsEnabled)

                            if idx < viewModel.sources.count - 1 {
                                Divider()
                            }
                        }
                    }
                    .padding(16)
                    .background(HubPalette.cardSurface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(HubPalette.hairline.opacity(0.8), lineWidth: 0.75)
                    )

                    // Theme mode selector
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Giao diện hiển thị")
                            .font(.headline)
                            .foregroundColor(HubPalette.primaryText)
                        Picker("Giao diện", selection: Binding(
                            get: { viewModel.prefs.themeMode },
                            set: { viewModel.setThemeMode($0) }
                        )) {
                            ForEach(ThemeMode.allCases) { mode in
                                Text(mode.label).tag(mode)
                            }
                        }
                        .pickerStyle(.segmented)
                    }
                    .padding(16)
                    .background(HubPalette.cardSurface)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .stroke(HubPalette.hairline.opacity(0.8), lineWidth: 0.75)
                    )

                    // Official HUB Logo Author card
                    Button {
                        onOpenURL(HubCatalog.authorFacebookURL)
                    } label: {
                        HStack(spacing: 12) {
                            Image("HUBLogo")
                                .resizable()
                                .scaledToFit()
                                .padding(5)
                                .frame(width: 44, height: 44)
                                .background(HubPalette.white)
                                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .stroke(HubPalette.hairline, lineWidth: 0.8)
                                )

                            VStack(alignment: .leading, spacing: 2) {
                                Text("HUB News · v1.1.0 (iOS)")
                                    .font(.subheadline.weight(.bold))
                                    .foregroundColor(HubPalette.adaptivePrimary)
                                Text("Tác giả: \(HubCatalog.authorName)")
                                    .font(.caption.weight(.medium))
                                    .foregroundColor(HubPalette.primaryText)
                                Text("ĐH Ngân hàng TP.HCM · Cập nhật 24/7")
                                    .font(.caption2)
                                    .foregroundColor(HubPalette.secondaryText)
                            }
                            Spacer()
                            Image(systemName: "arrow.up.right.square")
                                .foregroundColor(HubPalette.adaptiveRed)
                        }
                        .padding(16)
                        .background(HubPalette.cardSurface)
                        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .stroke(HubPalette.hairline.opacity(0.8), lineWidth: 0.75)
                        )
                    }
                    .buttonStyle(.plain)
                }
                .padding(16)
            }
            .hubHeader(
                subtitle: "Thông báo tự động & Cài đặt",
                fetchedAt: viewModel.fetchedAt,
                online: viewModel.errorMessage.isEmpty
            )
        }
    }
}

// MARK: - Article Detail Sheet (Full Text + Deadline + PDF Reader + Share)

private struct ArticleDetailSheetView: View {
    let target: DetailPresentation
    @ObservedObject var viewModel: HubViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var safariLink: SafariLink?

    private func openInAppBrowser(_ urlString: String) {
        guard let url = URL(string: urlString),
              let scheme = url.scheme?.lowercased(),
              scheme == "http" || scheme == "https" else {
            return
        }
        safariLink = SafariLink(url: url)
    }

    private var displayTitle: String {
        let t = viewModel.activeDetail?.title ?? ""
        return t.isEmpty ? (target.fallbackTitle.isEmpty ? "Chi tiết thông báo" : target.fallbackTitle) : t
    }

    private var displayUrl: String {
        let u = viewModel.activeDetail?.webUrl ?? ""
        return u.isEmpty ? target.fallbackUrl : u
    }

    private var isBookmarked: Bool {
        viewModel.bookmarkedUids.contains(target.uid)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 8) {
                        Text(viewModel.activeDetail?.sourceName.isEmpty == false
                             ? viewModel.activeDetail!.sourceName
                             : (target.fallbackSource.isEmpty ? "HUB News" : target.fallbackSource))
                            .font(.caption.weight(.semibold))
                            .foregroundColor(HubPalette.white)
                            .padding(.horizontal, 9)
                            .padding(.vertical, 4)
                            .background(HubPalette.navy)
                            .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))

                        if let date = viewModel.activeDetail?.date, !date.isEmpty {
                            Text(date)
                                .font(.caption)
                                .foregroundColor(HubPalette.secondaryText)
                        }
                        Spacer()
                    }

                    Text(displayTitle)
                        .font(.title3.weight(.bold))
                        .foregroundColor(HubPalette.primaryText)

                    if let sender = viewModel.activeDetail?.sender, !sender.isEmpty {
                        Text("Đơn vị: \(sender)")
                            .font(.caption)
                            .foregroundColor(HubPalette.secondaryText)
                    }

                    if let deadline = viewModel.activeDetail?.deadline, !deadline.isEmpty {
                        HStack(spacing: 8) {
                            Image(systemName: "clock.badge.exclamationmark.fill")
                                .foregroundColor(HubPalette.adaptiveRed)
                            Text("Hạn: \(deadline)")
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(HubPalette.adaptiveRed)
                        }
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(HubPalette.adaptiveRedContainer)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(HubPalette.adaptiveRed.opacity(0.3), lineWidth: 1)
                        )
                    }

                    Divider()

                    if viewModel.detailLoading {
                        VStack(alignment: .leading, spacing: 10) {
                            ForEach(0..<5, id: \.self) { i in
                                RoundedRectangle(cornerRadius: 6)
                                    .fill(HubPalette.subtleSurface)
                                    .frame(maxWidth: i == 4 ? 200 : .infinity)
                                    .frame(height: 15)
                            }
                        }
                        .padding(.vertical, 8)
                    } else if !viewModel.detailError.isEmpty {
                        VStack(spacing: 10) {
                            Text(viewModel.detailError)
                                .font(.subheadline)
                                .foregroundColor(HubPalette.adaptiveRed)
                            Button("Thử tải lại") {
                                viewModel.openArticleByCodeId(
                                    code: target.code,
                                    id: target.id,
                                    fallbackTitle: target.fallbackTitle,
                                    fallbackUrl: target.fallbackUrl,
                                    fallbackSource: target.fallbackSource,
                                    forceReload: true
                                )
                            }
                            .buttonStyle(.bordered)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                    } else if let d = viewModel.activeDetail {
                        let bodyStr = d.bodyText.trimmingCharacters(in: .whitespacesAndNewlines)
                        if bodyStr.count > 15 {
                            Text(bodyStr)
                                .font(.body)
                                .foregroundColor(HubPalette.primaryText)
                                .textSelection(.enabled)
                        } else if !d.pdfs.isEmpty || !d.downloads.isEmpty {
                            Text("Thông báo này đính kèm văn bản PDF/tệp bên dưới.")
                                .font(.subheadline)
                                .foregroundColor(HubPalette.secondaryText)
                        } else {
                            Text("Mở bài gốc bên dưới để xem toàn bộ nội dung hiển thị trên cổng trường.")
                                .font(.subheadline)
                                .foregroundColor(HubPalette.secondaryText)
                        }

                        let allFiles = d.pdfs + d.downloads
                        if !allFiles.isEmpty {
                            Text("Tài liệu đính kèm (\(allFiles.count))")
                                .font(.subheadline.weight(.bold))
                                .foregroundColor(HubPalette.adaptivePrimary)
                                .padding(.top, 8)

                            ForEach(Array(allFiles.enumerated()), id: \.offset) { idx, fileUrl in
                                Button {
                                    openInAppBrowser(fileUrl)
                                } label: {
                                    HStack(spacing: 10) {
                                        Image(systemName: "doc.richtext.fill")
                                            .font(.title3)
                                            .foregroundColor(HubPalette.adaptiveRed)
                                        Text(prettyAttachmentName(fileUrl, index: idx))
                                            .font(.subheadline)
                                            .foregroundColor(HubPalette.primaryText)
                                            .lineLimit(2)
                                            .multilineTextAlignment(.leading)
                                        Spacer()
                                        Text("Xem PDF")
                                            .font(.caption.weight(.bold))
                                            .foregroundColor(HubPalette.adaptivePrimary)
                                    }
                                    .padding(12)
                                    .background(HubPalette.subtleSurface)
                                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        if !d.extraLinks.isEmpty {
                            ForEach(d.extraLinks) { link in
                                Button {
                                    openInAppBrowser(link.url)
                                } label: {
                                    Text(link.label.isEmpty ? "Xem liên kết đính kèm" : link.label)
                                        .font(.subheadline.weight(.medium))
                                        .frame(maxWidth: .infinity)
                                        .padding(.vertical, 10)
                                        .foregroundColor(HubPalette.adaptivePrimary)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                                .stroke(HubPalette.hairline, lineWidth: 1)
                                        )
                                }
                            }
                        }
                    }

                    if !displayUrl.isEmpty, let webURL = URL(string: displayUrl) {
                        HStack(spacing: 10) {
                            Button {
                                openInAppBrowser(displayUrl)
                            } label: {
                                Label("Mở bài gốc HUB", systemImage: "safari.fill")
                                    .font(.subheadline.weight(.semibold))
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 12)
                                    .background(HubPalette.navy)
                                    .foregroundColor(HubPalette.white)
                                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                            }

                            ShareLink(
                                item: webURL,
                                subject: Text(displayTitle),
                                message: Text("\(displayTitle)\n— HUB News")
                            ) {
                                Label("Chia sẻ", systemImage: "square.and.arrow.up")
                                    .font(.subheadline.weight(.semibold))
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 12)
                                    .foregroundColor(HubPalette.adaptiveRed)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                                            .stroke(HubPalette.adaptiveRed, lineWidth: 1.2)
                                    )
                            }
                        }
                        .padding(.top, 8)
                    }
                }
                .padding(20)
            }
            .background(HubPalette.canvasBg.ignoresSafeArea())
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Đóng") { dismiss() }
                        .foregroundColor(HubPalette.adaptivePrimary)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        viewModel.toggleBookmarkForCurrentDetail()
                    } label: {
                        Image(systemName: isBookmarked ? "bookmark.fill" : "bookmark")
                            .foregroundColor(isBookmarked ? HubPalette.adaptiveRed : HubPalette.adaptivePrimary)
                    }
                }
            }
        }
        .presentationDragIndicator(.visible)
        .sheet(item: $safariLink) { link in
            SafariView(url: link.url)
                .ignoresSafeArea()
        }
    }
}
