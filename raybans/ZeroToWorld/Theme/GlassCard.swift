import SwiftUI

struct GlassCard: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: ZeroToWorldTheme.cornerRadius)
                    .fill(ZeroToWorldTheme.backgroundCard.opacity(0.6))
                    .background(
                        RoundedRectangle(cornerRadius: ZeroToWorldTheme.cornerRadius)
                            .fill(.ultraThinMaterial)
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: ZeroToWorldTheme.cornerRadius)
                    .stroke(ZeroToWorldTheme.cardBorderGradient, lineWidth: 1)
            )
    }
}

extension View {
    func glassCard() -> some View {
        modifier(GlassCard())
    }
}
