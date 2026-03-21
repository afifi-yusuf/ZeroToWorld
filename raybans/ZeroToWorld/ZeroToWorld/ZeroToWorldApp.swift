import MWDATCore
import SwiftUI

@main
struct ZeroToWorldApp: App {
    @StateObject private var vm = ZeroToWorldSessionViewModel()

    init() {
        do {
            try Wearables.configure()
            NSLog("[ZeroToWorld] Wearables SDK configured")
        } catch {
            NSLog("[ZeroToWorld] Wearables.configure() FAILED: %@", "\(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            NavigationStack {
                ContentView(vm: vm)
            }
            .preferredColorScheme(.dark)
            .onOpenURL { url in
                guard
                    let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
                    components.queryItems?.contains(where: { $0.name == "metaWearablesAction" }) == true
                else { return }
                Task {
                    do {
                        _ = try await Wearables.shared.handleUrl(url)
                    } catch {
                        NSLog("[ZeroToWorld] handleUrl error: %@", "\(error)")
                    }
                }
            }
        }
    }
}
