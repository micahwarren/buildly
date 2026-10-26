import SwiftUI
import Security

struct Project: Identifiable {
    var data: [String: Any]
    var id: String { data["id"] as? String ?? "" }
    var title: String { data["title"] as? String ?? "My project" }
    func text(_ key: String) -> String { data[key] as? String ?? "" }
    func items(_ key: String) -> [[String: Any]] { data[key] as? [[String: Any]] ?? [] }
    func strings(_ key: String) -> [String] { data[key] as? [String] ?? [] }
}
struct AppFailure: LocalizedError { let message: String; var errorDescription: String? { message } }
enum SessionVault {
    static let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "com.nomapps.buildly.native", kSecAttrAccount as String: "session"]
    static func read() -> Data? {
        var q = query; q[kSecReturnData as String] = true
        var result: CFTypeRef?; SecItemCopyMatching(q as CFDictionary, &result)
        return result as? Data
    }
    static func write(_ data: Data?) throws {
        SecItemDelete(query as CFDictionary)
        guard let data else { return }
        var q = query; q[kSecValueData as String] = data
        q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        guard SecItemAdd(q as CFDictionary, nil) == errSecSuccess else { throw AppFailure(message: "Could not securely save your login.") }
    }
}
@MainActor final class Store: ObservableObject {
    @Published var userID = ""
    @Published var email = ""
    @Published var projects: [Project] = []
    @Published var error = ""
    @Published var busy = false
    @Published var loading = true
    @Published var tutorialDone = false
    private var access = ""
    private var refresh = ""
    private var expires: Double = 0
    private var metadata: [String: Any] = [:]
    private let network = URLSession(configuration: { let c = URLSessionConfiguration.default; c.timeoutIntervalForRequest = 320; c.timeoutIntervalForResource = 360; return c }())
    func request(_ path: String, method: String = "GET", body: Any? = nil, backend: Bool = false, authenticated: Bool = true, bytes: Data? = nil, mime: String = "application/json") async throws -> Data {
        if authenticated && !refresh.isEmpty && expires < Date().timeIntervalSince1970 + 60 { try await renew() }
        guard let url = URL(string: (backend ? Configuration.backend : Configuration.supabase) + path) else { throw AppFailure(message: "Invalid server configuration.") }
        var r = URLRequest(url: url); r.httpMethod = method
        if !backend { r.setValue(Configuration.publicKey, forHTTPHeaderField: "apikey") }
        if authenticated && !access.isEmpty { r.setValue("Bearer \(access)", forHTTPHeaderField: "Authorization") }
        r.setValue(mime, forHTTPHeaderField: "Content-Type")
        r.setValue("resolution=merge-duplicates", forHTTPHeaderField: "Prefer")
        r.httpBody = try bytes ?? body.map { try JSONSerialization.data(withJSONObject: $0) }
        let (data, response) = try await network.data(for: r)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            let obj = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
            throw AppFailure(message: obj["error_description"] as? String ?? obj["msg"] as? String ?? obj["error"] as? String ?? "The request failed. Please try again.")
        }
        return data
    }
    func adopt(_ data: Data) throws {
        guard let s = try JSONSerialization.jsonObject(with: data) as? [String: Any], let token = s["access_token"] as? String, let u = s["user"] as? [String: Any], let id = u["id"] as? String else { throw AppFailure(message: "Check your email to confirm your account, then sign in.") }
        try SessionVault.write(data)
        access = token; refresh = s["refresh_token"] as? String ?? ""; expires = s["expires_at"] as? Double ?? Date().timeIntervalSince1970 + (s["expires_in"] as? Double ?? 3600)
        userID = id; email = u["email"] as? String ?? ""; metadata = u["user_metadata"] as? [String: Any] ?? [:]
        tutorialDone = metadata["first_project_tutorial"] as? Bool == true || UserDefaults.standard.bool(forKey: "guide-\(id)")
    }
    func renew() async throws { try adopt(await request("/auth/v1/token?grant_type=refresh_token", method: "POST", body: ["refresh_token": refresh], authenticated: false)) }
    func restore() async {
        defer { loading = false }
        guard let data = SessionVault.read() else { return }
        do { try adopt(data); try await renew(); await load() } catch { self.error = error.localizedDescription; signOut() }
    }
    func authenticate(email: String, password: String, signup: Bool) async {
        busy = true; defer { busy = false }
        do {
            try adopt(await request(signup ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password", method: "POST", body: ["email": email, "password": password], authenticated: false))
            await load()
        } catch { self.error = error.localizedDescription }
    }
    func signOut() { try? SessionVault.write(nil); access = ""; refresh = ""; userID = ""; email = ""; projects = []; metadata = [:] }
    func finishTutorial() {
        tutorialDone = true; UserDefaults.standard.set(true, forKey: "guide-\(userID)")
        metadata["first_project_tutorial"] = true
        Task { _ = try? await request("/auth/v1/user", method: "PUT", body: ["data": metadata]) }
    }
    func cacheURL() -> URL { FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("projects-\(userID).json") }
    func cache() throws {
        let url = cacheURL(); try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try JSONSerialization.data(withJSONObject: projects.map(\.data)).write(to: url, options: [.atomic, .completeFileProtection])
    }
    func load() async {
        let owner = userID
        if let data = try? Data(contentsOf: cacheURL()), let rows = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]] { projects = rows.map { Project(data: $0) } }
        do {
            let bytes = try await request("/rest/v1/projects?select=payload&user_id=eq.\(owner)&order=updated_at.desc")
            let rows = try JSONSerialization.jsonObject(with: bytes) as? [[String: Any]] ?? []
            guard userID == owner else { return }
            var merged = Dictionary(uniqueKeysWithValues: projects.map { ($0.id, $0) })
            for row in rows { if let payload = row["payload"] as? [String: Any] {
                let p = Project(data: payload)
                if merged[p.id] == nil || p.text("updatedAt") >= merged[p.id]!.text("updatedAt") { merged[p.id] = p }
            } }
            projects = merged.values.sorted { $0.text("updatedAt") > $1.text("updatedAt") }; try cache()
        } catch { self.error = "Could not sync your projects. Local copies are kept. \(error.localizedDescription)" }
    }
    func imageData(_ value: String) async throws -> Data {
        if value.hasPrefix("data:"), let part = value.split(separator: ",", maxSplits: 1).last, let data = Data(base64Encoded: String(part)) { return data }
        if value.hasPrefix("storage:") { return try await request("/storage/v1/object/authenticated/project-images/" + String(value.dropFirst(8))) }
        if value.hasPrefix("/images/") { return try await request(value, backend: true, authenticated: false) }
        throw AppFailure(message: "Photo unavailable.")
    }
    func hydrated(_ p: Project) async throws -> [String: Any] {
        var body = p.data
        for key in ["originalImage", "generatedImage"] where p.text(key).hasPrefix("storage:") {
            let value = p.text(key); let mime = value.hasSuffix(".png") ? "image/png" : value.hasSuffix(".webp") ? "image/webp" : "image/jpeg"
            body[key] = "data:\(mime);base64," + (try await imageData(value)).base64EncodedString()
        }
        return body
    }
    func save(_ p: Project) async {
        projects.removeAll { $0.id == p.id }; projects.insert(p, at: 0)
        do {
            try cache() // Keep the generated image even when cloud storage fails.
            var payload = p.data
            for key in ["originalImage", "generatedImage"] where p.text(key).hasPrefix("data:") {
                let path = "\(userID)/\(p.id)/\(key)-\(UUID().uuidString).jpg"
                let source = try await imageData(p.text(key))
                guard let image = UIImage(data: source), let jpeg = image.jpegData(compressionQuality: 0.9) else { throw AppFailure(message: "Image could not be saved.") }
                _ = try await request("/storage/v1/object/project-images/\(path)", method: "POST", bytes: jpeg, mime: "image/jpeg")
                payload[key] = "storage:\(path)"
            }
            _ = try await request("/rest/v1/projects?on_conflict=user_id,id", method: "POST", body: ["id": p.id, "user_id": userID, "payload": payload, "updated_at": p.text("updatedAt")])
        } catch { self.error = "Saved on this iPhone; cloud sync needs another try. \(error.localizedDescription)" }
    }
    func generate(_ body: [String: Any]) async -> Project? {
        busy = true; defer { busy = false }
        do {
            let data = try await request("/api/projects", method: "POST", body: body, backend: true)
            guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any], json["id"] is String else { throw AppFailure(message: "The server returned an incomplete project.") }
            let p = Project(data: json); await save(p); return p
        } catch { self.error = error.localizedDescription; return nil }
    }
    func retry(_ p: Project) async {
        busy = true; defer { busy = false }
        do {
            var body = try await hydrated(p)
            let data = try await request("/api/plan", method: "POST", body: body, backend: true)
            if let plan = try JSONSerialization.jsonObject(with: data) as? [String: Any] { body.merge(plan) { _, new in new } }
            body["updatedAt"] = ISO8601DateFormatter().string(from: Date()); await save(Project(data: body))
        } catch { self.error = error.localizedDescription }
    }
    func remove(_ p: Project) async {
        do { _ = try await request("/rest/v1/projects?id=eq.\(p.id)&user_id=eq.\(userID)", method: "DELETE"); projects.removeAll { $0.id == p.id }; try cache() } catch { self.error = error.localizedDescription }
    }
    func deleteAccount() async {
        do { _ = try await request("/api/account", method: "DELETE", backend: true); try? FileManager.default.removeItem(at: cacheURL()); try? FileManager.default.removeItem(at: cacheURL().deletingLastPathComponent().appendingPathComponent("draft-\(userID).json")); UserDefaults.standard.removeObject(forKey: "guide-\(userID)"); signOut() } catch { self.error = error.localizedDescription }
    }
}
