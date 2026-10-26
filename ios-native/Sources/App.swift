import SwiftUI
import PhotosUI

@main struct BuildlyApp: App {
    @StateObject private var store = Store()
    var body: some Scene {
        WindowGroup {
            Group {
                if store.loading { ProgressView("Opening your workspace…") }
                else if store.userID.isEmpty { LoginScreen() }
                else { Workspace().id(store.userID) }
            }
            .environmentObject(store).tint(Color(red: 0.19, green: 0.36, blue: 0.26))
            .task { await store.restore() }
            .alert("Buildly", isPresented: Binding(get: { !store.error.isEmpty }, set: { if !$0 { store.error = "" } })) { Button("OK") { store.error = "" } } message: { Text(store.error) }
        }
    }
}
struct LoginScreen: View {
    @EnvironmentObject var store: Store
    @State private var email = ""
    @State private var password = ""
    @State private var signup = false
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    Image("BuildlyLogo").resizable().scaledToFit().frame(width: 64, height: 64).padding(.top, 36)
                    Text(signup ? "Make room for your next idea." : "Welcome back.").font(.largeTitle.bold())
                    Text("Your space. Your projects. Your next great idea.").foregroundStyle(.secondary)
                    Picker("Account", selection: $signup) { Text("Log in").tag(false); Text("Sign up").tag(true) }.pickerStyle(.segmented)
                    TextField("Email address", text: $email).textContentType(.emailAddress).keyboardType(.emailAddress).textInputAutocapitalization(.never).autocorrectionDisabled().textFieldStyle(.roundedBorder)
                    SecureField("Password", text: $password).textContentType(signup ? .newPassword : .password).textFieldStyle(.roundedBorder)
                    Button { Task { await store.authenticate(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password, signup: signup) } } label: {
                        HStack { Spacer(); if store.busy { ProgressView() } else { Text(signup ? "Create account" : "Log in").bold() }; Spacer() }.padding(8)
                    }.buttonStyle(.borderedProminent).disabled(store.busy || email.isEmpty || password.count < 8)
                    if !signup { Button("Forgot password?") { Task {
                        do { _ = try await store.request("/auth/v1/recover", method: "POST", body: ["email": email], authenticated: false); store.error = "Check your email for a password-reset link. After resetting, return to the app and log in." } catch { store.error = error.localizedDescription }
                    } }.disabled(email.isEmpty) }
                    HStack { Link("Privacy", destination: URL(string: Configuration.backend + "/privacy")!); Link("Terms", destination: URL(string: Configuration.backend + "/terms")!) }.font(.footnote)
                }.padding(28)
            }.background(Color(red: 0.96, green: 0.97, blue: 0.94))
        }
    }
}
struct Workspace: View {
    @EnvironmentObject var store: Store
    @State private var creating = false
    @State private var removing: Project?
    @State private var deletingAccount = false
    var body: some View {
        TabView {
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: 22) {
                        Text("A little vision. Something you made.").foregroundStyle(.secondary)
                        Button { creating = true } label: { HStack { Image(systemName: "plus.circle.fill").font(.largeTitle); VStack(alignment: .leading) { Text("Start a project").font(.title3.bold()); Text("Turn your space into a plan").font(.subheadline) }; Spacer(); Image(systemName: "arrow.right") }.padding(20).frame(maxWidth: .infinity) }.buttonStyle(.borderedProminent)
                        if store.projects.isEmpty { ContentUnavailableView("Your first idea starts here", systemImage: "hammer", description: Text("Take a photo. Tell us what you want to build. We’ll help you plan it.")) }
                        ForEach(store.projects) { p in
                            VStack(alignment: .leading, spacing: 12) {
                                NavigationLink { ProjectScreen(id: p.id) } label: {
                                    VStack(alignment: .leading, spacing: 12) { ProjectPhoto(value: p.text("generatedImage")).frame(height: 190).clipped(); Text(p.title).font(.title3.bold()); Text(p.text("projectType")).foregroundStyle(.secondary) }.foregroundStyle(.primary)
                                }
                                Button("Remove project", role: .destructive) { removing = p }.font(.footnote)
                            }.padding(16).background(.background, in: RoundedRectangle(cornerRadius: 24))
                        }
                    }.padding(20)
                }.background(Color(.systemGroupedBackground)).navigationTitle("My projects").refreshable { await store.load() }
                .toolbar { Button { creating = true } label: { Image(systemName: "plus") } }
                .confirmationDialog("Remove this project?", isPresented: Binding(get: { removing != nil }, set: { if !$0 { removing = nil } })) { Button("Remove project", role: .destructive) { if let p = removing { Task { await store.remove(p) } }; removing = nil } }
            }.tabItem { Label("Projects", systemImage: "square.grid.2x2") }
            NavigationStack {
                Form {
                    Section("Your account") { Text(store.email); Text("Your projects sync to your account.").foregroundStyle(.secondary) }
                    Section { Link("Privacy", destination: URL(string: Configuration.backend + "/privacy")!); Link("Terms", destination: URL(string: Configuration.backend + "/terms")!) }
                    Section { Button("Sign out") { store.signOut() }; Button("Delete account", role: .destructive) { deletingAccount = true } }
                }.navigationTitle("Account").confirmationDialog("Permanently delete your account, photos and projects?", isPresented: $deletingAccount) { Button("Delete account", role: .destructive) { Task { await store.deleteAccount() } } }
            }.tabItem { Label("Account", systemImage: "person.crop.circle") }
        }.sheet(isPresented: $creating) { NewProjectScreen() }
    }
}
struct ProjectPhoto: View {
    @EnvironmentObject var store: Store
    let value: String
    @State private var image: UIImage?
    @State private var failed = false
    var body: some View {
        Group {
            if let image { Image(uiImage: image).resizable().scaledToFit() }
            else if failed { Label("Photo unavailable", systemImage: "photo") }
            else { ProgressView().frame(maxWidth: .infinity, minHeight: 140) }
        }.task(id: value) {
            image = nil; failed = false
            do { image = UIImage(data: try await store.imageData(value)); failed = image == nil } catch { failed = true }
        }
    }
}
struct NewProjectScreen: View {
    @EnvironmentObject var store: Store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @State private var generated = false
    @State private var tutorial = 0
    @State private var picked: PhotosPickerItem?
    @State private var photo: Data?
    @State private var camera = false
    @State private var preparing = false
    @State private var idea = ""
    @State private var type = "Deck"
    @State private var width = "12"
    @State private var length = "16"
    @State private var budget = "Not sure"
    @State private var experience = "Beginner"
    let tips = [("camera", "Start with your space.", "Choose a clear photo of the whole area you want to change."), ("pencil.and.outline", "Tell us your idea.", "Describe what you want to build and add your measurements."), ("hammer", "Make it yours.", "Review the design, materials and steps. Everything stays in your project library.")]
    func prepare(_ image: UIImage) {
        let scale = min(1, 1400 / max(image.size.width, image.size.height))
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let format = UIGraphicsImageRendererFormat(); format.scale = 1
        photo = UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }.jpegData(compressionQuality: 0.8)
        if photo == nil { store.error = "Could not prepare this photo. Please choose another." }
    }
    var draftURL: URL { store.cacheURL().deletingLastPathComponent().appendingPathComponent("draft-\(store.userID).json") }
    func saveDraft() {
        guard !generated else { return }
        let draft: [String: Any] = ["photo": photo?.base64EncodedString() ?? "", "idea": idea, "type": type, "width": width, "length": length, "budget": budget, "experience": experience]
        do { try FileManager.default.createDirectory(at: draftURL.deletingLastPathComponent(), withIntermediateDirectories: true); try JSONSerialization.data(withJSONObject: draft).write(to: draftURL, options: [.atomic, .completeFileProtection]) } catch { store.error = "Could not save your draft on this iPhone." }
    }
    func restoreDraft() {
        guard let bytes = try? Data(contentsOf: draftURL), let d = (try? JSONSerialization.jsonObject(with: bytes)) as? [String: String] else { return }
        photo = Data(base64Encoded: d["photo"] ?? ""); idea = d["idea"] ?? ""; type = d["type"] ?? "Deck"; width = d["width"] ?? "12"; length = d["length"] ?? "16"; budget = d["budget"] ?? "Not sure"; experience = d["experience"] ?? "Beginner"
    }
    var body: some View {
        NavigationStack {
            Group {
                if !store.tutorialDone && store.projects.isEmpty {
                    VStack(spacing: 28) {
                        Spacer(); Image(systemName: tips[tutorial].0).font(.system(size: 72)).foregroundStyle(.tint)
                        Text(tips[tutorial].1).font(.largeTitle.bold()); Text(tips[tutorial].2).foregroundStyle(.secondary).multilineTextAlignment(.center)
                        Text("\(tutorial + 1) of 3").font(.caption)
                        Button(tutorial == 2 ? "Add my photo" : "Next") { if tutorial == 2 { store.finishTutorial() } else { tutorial += 1 } }.buttonStyle(.borderedProminent)
                        Button("Skip tutorial") { store.finishTutorial() }; Spacer()
                    }.padding(28)
                } else if store.busy {
                    VStack(spacing: 24) { ProgressView().controlSize(.large); Text("Building your idea…").font(.title2.bold()); Text("Creating your design and project plan. Keep the app open; this can take a few minutes.").multilineTextAlignment(.center).foregroundStyle(.secondary) }.padding(32)
                } else {
                    Form {
                        Section("Your space") {
                            if let photo, let image = UIImage(data: photo) { Image(uiImage: image).resizable().scaledToFit().frame(maxHeight: 240) }
                            if preparing { ProgressView("Preparing photo…") }
                            PhotosPicker(selection: $picked, matching: .images) { Label("Choose a photo", systemImage: "photo.on.rectangle") }.disabled(preparing)
                            if UIImagePickerController.isSourceTypeAvailable(.camera) { Button { camera = true } label: { Label("Take a photo", systemImage: "camera") } }
                        }
                        Section("Your idea") {
                            Picker("Project", selection: $type) { ForEach(["Deck", "Pergola", "Patio", "Fence", "Shed", "Something else"], id: \.self) { Text($0) } }
                            TextField("What would you like to build?", text: $idea, axis: .vertical).lineLimit(3...7)
                            HStack { TextField("Width (ft)", text: $width).keyboardType(.decimalPad); Text("×"); TextField("Length (ft)", text: $length).keyboardType(.decimalPad) }
                            TextField("Budget", text: $budget)
                            Picker("Experience", selection: $experience) { ForEach(["Beginner", "Some experience", "Experienced"], id: \.self) { Text($0) } }
                        }
                        Section { Button("Create my design and plan") { Task {
                            guard let photo, let w = Double(width), let l = Double(length), (1...100).contains(w), (1...200).contains(l) else { store.error = "Add a photo and valid measurements: width 1–100 ft, length 1–200 ft."; return }
                            let p = await store.generate(["originalImage": "data:image/jpeg;base64," + photo.base64EncodedString(), "projectType": type, "description": idea, "width": w, "length": l, "budget": budget, "experienceLevel": experience, "details": [:]])
                            if p != nil { generated = true; try? FileManager.default.removeItem(at: draftURL); dismiss() }
                        } }.disabled(photo == nil || idea.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || idea.count > 2000 || preparing) }
                    }
                }
            }.navigationTitle("New project").navigationBarTitleDisplayMode(.inline)
            .toolbar { if !store.busy { Button("Close") { dismiss() } } }.interactiveDismissDisabled(store.busy)
            .onChange(of: picked) { _, item in Task {
                preparing = true; defer { preparing = false }
                do { guard let data = try await item?.loadTransferable(type: Data.self), let image = UIImage(data: data) else { throw AppFailure(message: "Could not open that photo.") }; prepare(image) } catch { store.error = error.localizedDescription }
            } }
            .onAppear { restoreDraft() }
            .onDisappear { saveDraft() }
            .onChange(of: scenePhase) { _, phase in if phase != .active { saveDraft() } }
            .sheet(isPresented: $camera) { CameraPicker { image in if let image { prepare(image) }; camera = false } }
        }
    }
}
struct CameraPicker: UIViewControllerRepresentable {
    let result: (UIImage?) -> Void
    func makeCoordinator() -> Coordinator { Coordinator(result) }
    func makeUIViewController(context: Context) -> UIImagePickerController { let picker = UIImagePickerController(); picker.sourceType = .camera; picker.delegate = context.coordinator; return picker }
    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}
    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let result: (UIImage?) -> Void
        init(_ result: @escaping (UIImage?) -> Void) { self.result = result }
        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) { result(nil) }
        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) { result(info[.originalImage] as? UIImage) }
    }
}
struct ProjectScreen: View {
    @EnvironmentObject var store: Store
    let id: String
    @State private var original = false
    var body: some View {
        if let p = store.projects.first(where: { $0.id == id }) {
            List {
                Section { ProjectPhoto(value: p.text(original ? "originalImage" : "generatedImage")); Toggle("Original photo", isOn: $original); Text(p.text("planSummary")) }
                if p.text("planStatus") == "unavailable" {
                    Section("Your design is saved") { Text("The plan needs another try. Your photo won’t be generated again."); Button("Retry plan") { Task { await store.retry(p) } }.disabled(store.busy); if store.busy { ProgressView() } }
                }
                Section("Project overview") { Text("\(p.text("difficulty")) · \(p.text("estimatedHours"))"); if let low = p.data["estimatedCostLow"] as? Double, let high = p.data["estimatedCostHigh"] as? Double { Text("Materials estimate: \(low, format: .currency(code: "USD"))–\(high, format: .currency(code: "USD"))") } }
                Section("Materials") { ForEach(Array(p.items("materials").enumerated()), id: \.offset) { _, m in VStack(alignment: .leading, spacing: 6) { Text(m["item"] as? String ?? "Material").bold(); Text("\(m["quantity"] as? Double ?? 0, specifier: "%g") \(m["quantityUnit"] as? String ?? "") · \(m["dimensions"] as? String ?? "")"); if let purpose = m["purpose"] as? String { Text(purpose).font(.caption).foregroundStyle(.secondary) } } } }
                Section("Tools") { ForEach(p.strings("tools"), id: \.self) { Text($0) } }
                Section("Build steps") { ForEach(Array(p.items("steps").enumerated()), id: \.offset) { index, step in
                    DisclosureGroup("\(index + 1). \(step["title"] as? String ?? "Step")") {
                        Text(step["text"] as? String ?? "")
                        ForEach(step["actions"] as? [String] ?? [], id: \.self) { Text("• " + $0) }
                        ForEach(step["checks"] as? [String] ?? [], id: \.self) { Label($0, systemImage: "checkmark.circle") }
                        ForEach(step["stopConditions"] as? [String] ?? [], id: \.self) { Label($0, systemImage: "exclamationmark.triangle").foregroundStyle(.orange) }
                        Button((p.data["completed"] as? Int ?? 0) > index ? "Completed" : "Mark complete through this step") { var next = p.data; next["completed"] = index + 1; next["updatedAt"] = ISO8601DateFormatter().string(from: Date()); Task { await store.save(Project(data: next)) } }
                    }
                } }
                Section("Before you build") { ForEach(p.strings("assumptions") + p.strings("warnings"), id: \.self) { Text($0) }; Text("AI concept. Verify measurements and structural requirements before building.") }
                Section { Button("Sync project to account") { Task { await store.save(p) } } }
            }.navigationTitle(p.title).navigationBarTitleDisplayMode(.inline)
        } else { ContentUnavailableView("Project unavailable", systemImage: "folder") }
    }
}
