import Foundation

enum HubApiError: LocalizedError {
    case invalidURL
    case httpStatus(Int)
    case serverError(String)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Địa chỉ máy chủ không hợp lệ"
        case .httpStatus(let code): return "Lỗi kết nối máy chủ (HTTP \(code))"
        case .serverError(let msg): return msg.isEmpty ? "Không thể tải dữ liệu từ HUB News" : msg
        }
    }
}

final class HubApiClient {
    static let shared = HubApiClient()

    private let baseURL: String
    private let session: URLSession
    private let decoder: JSONDecoder

    init(baseURL: String = HubCatalog.apiBaseURL) {
        self.baseURL = baseURL
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 25
        config.waitsForConnectivity = false
        self.session = URLSession(configuration: config)
        self.decoder = JSONDecoder()
    }

    func fetchNews(
        source: String = "all",
        topic: String = "all",
        days: Int? = nil,
        query: String = "",
        limit: Int = 120,
        refresh: Bool = false
    ) async throws -> NewsFeedResponse {
        guard var comp = URLComponents(string: "\(baseURL)/api/news") else {
            throw HubApiError.invalidURL
        }
        var items = [
            URLQueryItem(name: "source", value: source),
            URLQueryItem(name: "topic", value: topic),
            URLQueryItem(name: "limit", value: String(limit)),
        ]
        if let days = days {
            items.append(URLQueryItem(name: "days", value: String(days)))
        }
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            items.append(URLQueryItem(name: "q", value: trimmed))
        }
        if refresh {
            items.append(URLQueryItem(name: "refresh", value: "1"))
        }
        comp.queryItems = items
        guard let url = comp.url else { throw HubApiError.invalidURL }

        let data = try await executeGET(url: url)
        let parsed = try decoder.decode(NewsFeedResponse.self, from: data)
        guard parsed.ok else {
            throw HubApiError.serverError("Máy chủ HUB News phản hồi chưa hợp lệ")
        }
        return parsed
    }

    func fetchDetail(code: String, id: String, refresh: Bool = false) async throws -> ArticleDetail {
        guard var comp = URLComponents(string: "\(baseURL)/api/detail") else {
            throw HubApiError.invalidURL
        }
        var items = [
            URLQueryItem(name: "code", value: code),
            URLQueryItem(name: "id", value: id),
        ]
        if refresh {
            items.append(URLQueryItem(name: "refresh", value: "1"))
        }
        comp.queryItems = items
        guard let url = comp.url else { throw HubApiError.invalidURL }

        let data = try await executeGET(url: url)
        let parsed = try decoder.decode(ArticleDetailResponse.self, from: data)
        guard parsed.ok, let detail = parsed.detail else {
            throw HubApiError.serverError(parsed.error ?? "Không thể tải chi tiết thông báo")
        }
        return detail
    }

    func fetchStatus(live: Bool = false) async throws -> StatusResponse {
        guard var comp = URLComponents(string: "\(baseURL)/api/status") else {
            throw HubApiError.invalidURL
        }
        if live {
            comp.queryItems = [URLQueryItem(name: "live", value: "1")]
        }
        guard let url = comp.url else { throw HubApiError.invalidURL }

        let data = try await executeGET(url: url)
        let parsed = try decoder.decode(StatusResponse.self, from: data)
        guard parsed.ok else {
            throw HubApiError.serverError("Không thể kiểm tra trạng thái 7 cổng HUB")
        }
        return parsed
    }

    private func executeGET(url: URL) async throws -> Data {
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue("HUBNewsIOS/1.1.0", forHTTPHeaderField: "User-Agent")

        let (data, response) = try await session.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw HubApiError.serverError("Phản hồi không hợp lệ")
        }
        guard (200..<300).contains(http.statusCode) else {
            throw HubApiError.httpStatus(http.statusCode)
        }
        return data
    }
}
