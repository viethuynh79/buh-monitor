package vn.hub.news.notify

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import vn.hub.news.MainActivity
import vn.hub.news.R
import vn.hub.news.model.AdminAnnouncement
import vn.hub.news.model.NewsItem

object HubNotificationManager {
    const val CHANNEL_URGENT = "hub_news_urgent"
    const val CHANNEL_ONLINE = "hub_news_online"
    const val CHANNEL_GENERAL = "hub_news_general"
    const val CHANNEL_MONITOR = "hub_news_monitor"

    const val EXTRA_OPEN_CODE = "extra_open_code"
    const val EXTRA_OPEN_ID = "extra_open_id"
    const val EXTRA_OPEN_TITLE = "extra_open_title"
    const val EXTRA_OPEN_URL = "extra_open_url"
    const val EXTRA_OPEN_SOURCE = "extra_open_source"

    private const val GROUP_KEY_HUB = "vn.hub.news.GROUP_NOTICES"
    const val FOREGROUND_SERVICE_ID = 9001
    private const val COLOR_HUB_NAVY = 0xFF203469.toInt()
    private const val COLOR_HUB_RED = 0xFFA71B28.toInt()

    fun createChannels(context: Context) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val urgentChannel = NotificationChannel(
            CHANNEL_URGENT,
            "Tin khẩn & Thông báo Quản trị",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Thông báo khẩn cấp, hạn cuối và thông báo trực tiếp từ Quản trị viên HUB News"
            enableVibration(true)
        }

        val onlineChannel = NotificationChannel(
            CHANNEL_ONLINE,
            "Online HUB (Ưu tiên #1)",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "Thông báo mới nhất từ cổng sinh viên online.hub.edu.vn"
            enableVibration(true)
        }

        val generalChannel = NotificationChannel(
            CHANNEL_GENERAL,
            "Tin mới 7 cổng HUB",
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = "Thông báo từ Phòng Khảo thí, Đào tạo, SCC, Cổng Chính và Tài chính"
        }

        val monitorChannel = NotificationChannel(
            CHANNEL_MONITOR,
            "Dịch vụ quét nhanh 5 phút",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Hiển thị trạng thái khi bật chế độ theo dõi tức thì mỗi 5 phút"
            setShowBadge(false)
        }

        manager.createNotificationChannels(
            listOf(urgentChannel, onlineChannel, generalChannel, monitorChannel)
        )
    }

    fun hasNotificationPermission(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun buildForegroundMonitorNotification(context: Context, subtitle: String): Notification {
        createChannels(context)
        val openIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pi = PendingIntent.getActivity(
            context,
            100,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(context, CHANNEL_MONITOR)
            .setSmallIcon(R.drawable.ic_stat_hub)
            .setColor(COLOR_HUB_NAVY)
            .setContentTitle("HUB News · Đang theo dõi 7 cổng")
            .setContentText(subtitle)
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(pi)
            .build()
    }

    fun notifyNewsItem(context: Context, item: NewsItem) {
        if (!hasNotificationPermission(context)) return
        createChannels(context)

        val channel = when {
            item.urgent -> CHANNEL_URGENT
            item.source == "online" -> CHANNEL_ONLINE
            else -> CHANNEL_GENERAL
        }

        val headerPrefix = if (item.urgent) "KHẨN · " else ""
        val contentTitle = "$headerPrefix${item.sourceShort} · ${item.topicTag}"

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_OPEN_CODE, item.code)
            putExtra(EXTRA_OPEN_ID, item.id)
            putExtra(EXTRA_OPEN_TITLE, item.title)
            putExtra(EXTRA_OPEN_URL, item.url)
            putExtra(EXTRA_OPEN_SOURCE, item.sourceName)
        }
        val reqCode = item.uid.hashCode()
        val pi = PendingIntent.getActivity(
            context,
            reqCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_stat_hub)
            .setColor(if (item.urgent) COLOR_HUB_RED else COLOR_HUB_NAVY)
            .setContentTitle(contentTitle)
            .setContentText(item.title)
            .setSubText(item.date)
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText("${item.title}\n\nNguồn: ${item.sourceName} · Ngày: ${item.date}")
            )
            .setPriority(if (item.urgent || item.source == "online") NotificationCompat.PRIORITY_HIGH else NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setAutoCancel(true)
            .setGroup(GROUP_KEY_HUB)
            .setContentIntent(pi)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(reqCode, notification)
        } catch (_: SecurityException) {
        }
    }

    fun notifyAdminAnnouncement(context: Context, announcement: AdminAnnouncement) {
        if (!hasNotificationPermission(context)) return
        createChannels(context)

        val title = if (announcement.urgent) {
            "THÔNG BÁO KHẨN · HUB News"
        } else {
            "Thông báo từ Quản trị viên · HUB News"
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val reqCode = ("ann_" + announcement.id).hashCode()
        val pi = PendingIntent.getActivity(
            context,
            reqCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_URGENT)
            .setSmallIcon(R.drawable.ic_stat_hub)
            .setColor(COLOR_HUB_RED)
            .setContentTitle(title)
            .setContentText(announcement.text)
            .setSubText(announcement.label)
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText("${announcement.text}\n\n${announcement.label} · Admin ${announcement.author}")
            )
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()

        try {
            NotificationManagerCompat.from(context).notify(reqCode, notification)
        } catch (_: SecurityException) {
        }
    }

    fun notifyTestAlert(context: Context): Boolean {
        if (!hasNotificationPermission(context)) return false
        createChannels(context)

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pi = PendingIntent.getActivity(
            context,
            8888,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_ONLINE)
            .setSmallIcon(R.drawable.ic_stat_hub)
            .setColor(COLOR_HUB_NAVY)
            .setContentTitle("HUB News · Thông báo đang hoạt động")
            .setContentText("Bạn sẽ nhận được tin tức mới nhất từ 7 cổng HUB ngay khi trường đăng bài.")
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText("Hệ thống theo dõi 7 cổng thông tin ĐH Ngân hàng TP.HCM (Ưu tiên #1 Online HUB) đã sẵn sàng gửi thông báo tức thì cho bạn.")
            )
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build()

        return try {
            NotificationManagerCompat.from(context).notify(8888, notification)
            true
        } catch (_: SecurityException) {
            false
        }
    }
}
