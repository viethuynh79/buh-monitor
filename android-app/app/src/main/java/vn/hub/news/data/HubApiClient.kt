package vn.hub.news.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import vn.hub.news.BuildConfig
import vn.hub.news.model.ArticleDetail
import vn.hub.news.model.ArticleDetailResponse
import vn.hub.news.model.NewsFeedResponse
import vn.hub.news.model.StatusResponse
import java.io.IOException
import java.util.concurrent.TimeUnit

class HubApiClient(
    private val baseUrl: String = BuildConfig.API_BASE_URL,
) {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .callTimeout(25, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    suspend fun fetchNews(
        source: String = "all",
        topic: String = "all",
        days: Int? = null,
        query: String = "",
        limit: Int = 100,
        refresh: Boolean = false,
    ): NewsFeedResponse = withContext(Dispatchers.IO) {
        val urlBuilder = "$baseUrl/api/news".toHttpUrl().newBuilder()
            .addQueryParameter("source", source)
            .addQueryParameter("topic", topic)
            .addQueryParameter("limit", limit.toString())
        if (days != null) urlBuilder.addQueryParameter("days", days.toString())
        if (query.isNotBlank()) urlBuilder.addQueryParameter("q", query.trim())
        if (refresh) urlBuilder.addQueryParameter("refresh", "1")

        val body = executeGet(urlBuilder.build().toString())
        val parsed = json.decodeFromString(NewsFeedResponse.serializer(), body)
        if (!parsed.ok) {
            throw IOException("Máy chủ HUB News phản hồi chưa hợp lệ")
        }
        parsed
    }

    suspend fun fetchDetail(
        code: String,
        id: String,
        refresh: Boolean = false,
    ): ArticleDetail = withContext(Dispatchers.IO) {
        val urlBuilder = "$baseUrl/api/detail".toHttpUrl().newBuilder()
            .addQueryParameter("code", code)
            .addQueryParameter("id", id)
        if (refresh) urlBuilder.addQueryParameter("refresh", "1")

        val body = executeGet(urlBuilder.build().toString())
        val parsed = json.decodeFromString(ArticleDetailResponse.serializer(), body)
        if (!parsed.ok || parsed.detail == null) {
            throw IOException(parsed.error.ifBlank { "Không thể tải chi tiết thông báo" })
        }
        parsed.detail
    }

    suspend fun fetchStatus(live: Boolean = false): StatusResponse = withContext(Dispatchers.IO) {
        val urlBuilder = "$baseUrl/api/status".toHttpUrl().newBuilder()
        if (live) urlBuilder.addQueryParameter("live", "1")
        val body = executeGet(urlBuilder.build().toString())
        val parsed = json.decodeFromString(StatusResponse.serializer(), body)
        if (!parsed.ok) {
            throw IOException("Không thể kiểm tra trạng thái 7 cổng HUB")
        }
        parsed
    }

    private fun executeGet(url: String): String {
        val req = Request.Builder()
            .url(url)
            .header("Accept", "application/json")
            .header("User-Agent", "HUBNewsAndroid/${BuildConfig.VERSION_NAME}")
            .build()

        client.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) {
                throw IOException("Lỗi kết nối HTTP ${resp.code}")
            }
            return resp.body?.string() ?: throw IOException("Phản hồi rỗng từ máy chủ")
        }
    }
}
