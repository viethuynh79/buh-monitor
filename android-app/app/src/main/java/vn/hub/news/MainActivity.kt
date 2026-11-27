package vn.hub.news

import android.Manifest
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import vn.hub.news.notify.HubNotificationManager
import vn.hub.news.notify.HubSyncCoordinator
import vn.hub.news.ui.HubNewsApp
import vn.hub.news.ui.HubViewModel

class MainActivity : ComponentActivity() {
    private val viewModel: HubViewModel by viewModels()

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) {
        viewModel.updateNotificationPermissionState()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            !HubNotificationManager.hasNotificationPermission(this)
        ) {
            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            HubSyncCoordinator.applyScheduling(this)
        }

        handleDeepLinkIntent(intent)

        setContent {
            HubNewsApp(
                viewModel = viewModel,
                onRequestNotificationPermission = {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                    } else {
                        viewModel.updateNotificationPermissionState()
                    }
                },
            )
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLinkIntent(intent)
    }

    private fun handleDeepLinkIntent(intent: Intent?) {
        if (intent == null) return
        val code = intent.getStringExtra(HubNotificationManager.EXTRA_OPEN_CODE).orEmpty()
        val id = intent.getStringExtra(HubNotificationManager.EXTRA_OPEN_ID).orEmpty()
        if (code.isNotBlank() && id.isNotBlank()) {
            viewModel.openArticleByCodeId(
                code = code,
                id = id,
                fallbackTitle = intent.getStringExtra(HubNotificationManager.EXTRA_OPEN_TITLE).orEmpty(),
                fallbackUrl = intent.getStringExtra(HubNotificationManager.EXTRA_OPEN_URL).orEmpty(),
                fallbackSource = intent.getStringExtra(HubNotificationManager.EXTRA_OPEN_SOURCE).orEmpty(),
            )
            intent.removeExtra(HubNotificationManager.EXTRA_OPEN_CODE)
            intent.removeExtra(HubNotificationManager.EXTRA_OPEN_ID)
        }
    }
}
