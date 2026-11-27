package vn.hub.news

import android.app.Application
import vn.hub.news.notify.HubNotificationManager
import vn.hub.news.notify.HubSyncCoordinator

class HubNewsApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        HubNotificationManager.createChannels(this)
        HubSyncCoordinator.applyScheduling(this)
    }
}
