import SwiftUI
import UIKit

final class HubAppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        HubNotificationService.shared.registerBackgroundTask()
        return true
    }
}

@main
struct HUBNewsApp: App {
    @UIApplicationDelegateAdaptor(HubAppDelegate.self) private var appDelegate
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var viewModel = HubViewModel()

    var body: some Scene {
        WindowGroup {
            HubNewsRootView(viewModel: viewModel)
                .onChange(of: scenePhase) { newPhase in
                    switch newPhase {
                    case .active:
                        HubNotificationService.shared.clearAppBadge()
                        Task { await viewModel.refreshNotificationPermission() }
                    case .background:
                        HubNotificationService.shared.scheduleNextBackgroundRefresh()
                    default:
                        break
                    }
                }
        }
    }
}
