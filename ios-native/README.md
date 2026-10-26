# Native iPhone app

This is the new SwiftUI application. It has no Capacitor dependency and no web view. The public website remains a prototype; only JSON APIs and Supabase are used by this app.

Implemented: login/signup/password-reset email, Keychain sessions with refresh, project dashboard and account tabs, one-time tutorial, native PhotosPicker/camera, image normalization, local protected drafts and projects, generation, private cloud image/project sync, materials/tools/detailed steps, completion tracking, plan retries, deletion and sign-out.

The bundle ID remains `com.nomapps.buildly`, matching the existing App Store record. GitHub's TestFlight workflow now generates this Xcode project using XcodeGen, compiles for simulator, then archives and uploads. It no longer runs Capacitor sync or builds the old wrapper. This version requires a new TestFlight binary.

Deploy the updated `/api/config` endpoint first. It supplies only the public Supabase URL/publishable key; the build generates ignored `Sources/Configuration.swift`. No AI or service-role key is embedded. The server origin comes from the existing BUILDLY_APP_URL GitHub variable.

Native purchases, design refinement and project chat are not yet ported. This first native beta requires hosted billing to remain disabled. The build refuses a paid backend. Do not enable charges until native purchases and the full generation flow have passed device tests.

On a Mac: install XcodeGen, run `node scripts/native-config.mjs` from the repository root, then `cd ios-native && xcodegen generate`. Open BuildlyNative.xcodeproj. Xcode 26 and iOS 17+ are required.

Validation still required on Apple hardware: Swift compiler/type checking, camera permissions (allow/deny/cancel), HEIC and large images, sign-in refresh, confirmation/reset emails, offline/relaunch draft restoration, existing project sync, real Gemini generation and plan retry, account isolation and deletion. Linux checks cannot substitute for these. GitHub's simulator compile is a release gate, not proof of device functionality.
