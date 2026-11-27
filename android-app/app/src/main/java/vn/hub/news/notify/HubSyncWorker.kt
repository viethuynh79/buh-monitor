package vn.hub.news.notify

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import vn.hub.news.data.HubApiClient
import vn.hub.news.data.HubPreferencesStore
import vn.hub.news.model.NewsDiffEngine
import java.util.concurrent.TimeUnit

object HubSyncCoordinator {
    private const val PERIODIC_WORK_NAME = "hub_news_periodic_sync_v1"
    private const val IMMEDIATE_WORK_NAME = "hub_news_immediate_sync_v1"

    suspend fun runSyncOnce(context: Context, forceRefresh: Boolean = false): Int {
        val store = HubPreferencesStore(context)
        val prefs = store.getPreferences()
        val api = HubApiClient()

        val feed = api.fetchNews(limit = 80, refresh = forceRefresh)
        store.saveCachedFeed(feed)

        val diff = NewsDiffEngine.computeDiff(
            feedItems = feed.items,
            announcements = feed.announcements,
            previousSeenUids = store.getSeenUids(),
            previousSeenAnnIds = store.getSeenAnnIds(),
            hasSeededBefore = store.hasSeededSeen(),
            mutedSources = prefs.mutedSources,
            urgentOnly = prefs.urgentOnly,
        )

        val totalNew = diff.newItems.size + diff.newAnnouncements.size
        store.saveSeenState(
            uids = diff.updatedSeenUids,
            annIds = diff.updatedSeenAnnIds,
            newFoundCount = totalNew,
            unreadAdded = diff.newItems.map { it.uid },
        )

        if (!diff.seeded && prefs.notificationsEnabled) {
            diff.newAnnouncements.take(3).forEach { ann ->
                HubNotificationManager.notifyAdminAnnouncement(context, ann)
            }
            diff.newItems.take(5).forEach { item ->
                HubNotificationManager.notifyNewsItem(context, item)
            }
        }
        return totalNew
    }

    fun applyScheduling(context: Context) {
        val store = HubPreferencesStore(context)
        val prefs = store.getPreferences()
        val wm = WorkManager.getInstance(context.applicationContext)

        if (!prefs.notificationsEnabled) {
            wm.cancelUniqueWork(PERIODIC_WORK_NAME)
            stopFastMonitor(context)
            return
        }

        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val periodicRequest = PeriodicWorkRequestBuilder<HubSyncWorker>(
            15,
            TimeUnit.MINUTES,
        )
            .setConstraints(constraints)
            .build()

        wm.enqueueUniquePeriodicWork(
            PERIODIC_WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            periodicRequest,
        )

        if (prefs.fastFiveMinMode) {
            startFastMonitor(context)
        } else {
            stopFastMonitor(context)
        }
    }

    fun triggerImmediateSync(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
        val req = OneTimeWorkRequestBuilder<HubSyncWorker>()
            .setConstraints(constraints)
            .build()
        WorkManager.getInstance(context.applicationContext)
            .enqueueUniqueWork(IMMEDIATE_WORK_NAME, ExistingWorkPolicy.REPLACE, req)
    }

    fun startFastMonitor(context: Context) {
        val intent = Intent(context.applicationContext, HubFastMonitorService::class.java)
        try {
            ContextCompat.startForegroundService(context.applicationContext, intent)
        } catch (_: Exception) {
        }
    }

    fun stopFastMonitor(context: Context) {
        val intent = Intent(context.applicationContext, HubFastMonitorService::class.java)
        try {
            context.applicationContext.stopService(intent)
        } catch (_: Exception) {
        }
    }
}

class HubSyncWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        return try {
            HubSyncCoordinator.runSyncOnce(applicationContext, forceRefresh = false)
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }
}

class HubFastMonitorService : Service() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var pollJob: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = HubNotificationManager.buildForegroundMonitorNotification(
            this,
            "Tự động kiểm tra tin mới mỗi 5 phút",
        )
        val fgsType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
        } else {
            0
        }
        try {
            ServiceCompat.startForeground(
                this,
                HubNotificationManager.FOREGROUND_SERVICE_ID,
                notification,
                fgsType,
            )
        } catch (_: Exception) {
            stopSelf()
            return START_NOT_STICKY
        }

        if (pollJob == null || pollJob?.isActive != true) {
            pollJob = serviceScope.launch {
                while (isActive) {
                    try {
                        HubSyncCoordinator.runSyncOnce(applicationContext, forceRefresh = false)
                    } catch (_: Exception) {
                    }
                    delay(5L * 60L * 1000L)
                }
            }
        }
        return START_STICKY
    }

    override fun onTimeout(startId: Int, fgsType: Int) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            super.onTimeout(startId, fgsType)
        }
        // Android 15 dataSync time limit safety: stop cleanly and let WorkManager continue
        stopSelf()
    }

    override fun onDestroy() {
        pollJob?.cancel()
        serviceScope.cancel()
        super.onDestroy()
    }
}
