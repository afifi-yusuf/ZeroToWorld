import MWDATCore
import SwiftUI

struct GlassesConnectionView: View {
    @ObservedObject var glasses: GlassesCameraManager

    var body: some View {
        ZStack {
            ZeroToWorldTheme.backgroundPrimary
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: 16) {

                    // MARK: - Status Section
                    VStack(spacing: 0) {
                        StatusRow(title: "Connection",
                                  value: glasses.isConnected ? "Connected" : "Disconnected",
                                  valueColor: glasses.isConnected ? ZeroToWorldTheme.statusGreen : ZeroToWorldTheme.textSecondary)
                        Divider().background(Color.white.opacity(0.1))
                        StatusRow(title: "Devices",
                                  value: "\(glasses.devices.count)",
                                  valueColor: ZeroToWorldTheme.textSecondary)
                        Divider().background(Color.white.opacity(0.1))
                        StatusRow(title: "Active Device",
                                  value: glasses.hasActiveDevice ? "Yes" : "No",
                                  valueColor: glasses.hasActiveDevice ? ZeroToWorldTheme.statusGreen : ZeroToWorldTheme.textSecondary)
                        Divider().background(Color.white.opacity(0.1))
                        StatusRow(title: "Stream",
                                  value: String(describing: glasses.streamState),
                                  valueColor: ZeroToWorldTheme.textSecondary)
                    }
                    .glassCard()

                    // MARK: - Pairing Section
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Pairing")
                            .font(.subheadline.bold())
                            .foregroundStyle(ZeroToWorldTheme.textPrimary)

                        switch glasses.registrationState {
                        case .unavailable:
                            HStack(spacing: 8) {
                                Image(systemName: "antenna.radiowaves.left.and.right.slash")
                                    .foregroundStyle(ZeroToWorldTheme.textSecondary)
                                Text("Bluetooth unavailable")
                                    .foregroundStyle(ZeroToWorldTheme.textSecondary)
                            }

                        case .available:
                            GradientButton(
                                title: "Pair Glasses",
                                icon: "eyeglasses",
                                gradient: ZeroToWorldTheme.sessionInactiveGradient
                            ) {
                                glasses.pair()
                            }

                        case .registering:
                            HStack(spacing: 8) {
                                ProgressView()
                                    .tint(ZeroToWorldTheme.accent)
                                Text("Pairing...")
                                    .foregroundStyle(ZeroToWorldTheme.textSecondary)
                            }

                        case .registered:
                            HStack(spacing: 8) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(ZeroToWorldTheme.statusGreen)
                                Text("Paired")
                                    .foregroundStyle(ZeroToWorldTheme.statusGreen)
                            }

                            Button {
                                glasses.unpair()
                            } label: {
                                Label("Unpair", systemImage: "xmark.circle")
                                    .font(.subheadline.bold())
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 10)
                                    .foregroundStyle(ZeroToWorldTheme.statusRed)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: ZeroToWorldTheme.cornerRadiusSmall)
                                            .stroke(ZeroToWorldTheme.statusRed, lineWidth: 1.5)
                                    )
                            }

                        @unknown default:
                            Text("Unknown state")
                                .foregroundStyle(ZeroToWorldTheme.textSecondary)
                        }
                    }
                    .glassCard()

                    // MARK: - Devices Section
                    if !glasses.devices.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Devices")
                                .font(.subheadline.bold())
                                .foregroundStyle(ZeroToWorldTheme.textPrimary)
                            ForEach(glasses.devices, id: \.self) { deviceId in
                                Text(deviceId)
                                    .font(.caption.monospaced())
                                    .foregroundStyle(ZeroToWorldTheme.textSecondary)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .glassCard()
                    }

                    // MARK: - Error Section
                    if let error = glasses.errorMessage {
                        HStack(spacing: 8) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundStyle(ZeroToWorldTheme.statusRed)
                            Text(error)
                                .font(.caption)
                                .foregroundStyle(ZeroToWorldTheme.statusRed)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .glassCard()
                    }
                }
                .padding()
            }
        }
        .navigationTitle("Meta Glasses")
        .toolbarColorScheme(.dark, for: .navigationBar)
    }
}

// MARK: - StatusRow

private struct StatusRow: View {
    let title: String
    let value: String
    let valueColor: Color

    var body: some View {
        HStack {
            Text(title)
                .font(.subheadline)
                .foregroundStyle(ZeroToWorldTheme.textSecondary)
            Spacer()
            Text(value)
                .font(.subheadline.bold())
                .foregroundStyle(valueColor)
        }
        .padding(.vertical, 8)
    }
}

