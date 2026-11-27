import SwiftUI
import UIKit

enum HubPalette {
    // Exact official HUB University crest brand colors
    static let white = Color(hex: 0xFFFFFF)
    static let navy = Color(hex: 0x203469)        // Xanh Đậm Logo HUB
    static let navyDeep = Color(hex: 0x15254F)
    static let navySoft = Color(hex: 0xE8EEF8)
    static let red = Color(hex: 0xA71B28)         // Đỏ Logo HUB
    static let redSoft = Color(hex: 0xFBE9EB)
    static let onlineGreen = Color(hex: 0x1B8A5A)
    static let warnAmber = Color(hex: 0xD9820B)

    // Adaptive surfaces for crisp Light & Dark mode harmony
    static let canvasBg = Color(UIColor { tc in
        tc.userInterfaceStyle == .dark
            ? UIColor(red: 0.047, green: 0.078, blue: 0.149, alpha: 1) // #0C1426
            : UIColor(red: 0.965, green: 0.969, blue: 0.980, alpha: 1) // #F6F7FA
    })

    static let cardSurface = Color(UIColor { tc in
        tc.userInterfaceStyle == .dark
            ? UIColor(red: 0.075, green: 0.118, blue: 0.212, alpha: 1) // #131E36
            : UIColor.white
    })

    static let subtleSurface = Color(UIColor { tc in
        tc.userInterfaceStyle == .dark
            ? UIColor(red: 0.114, green: 0.173, blue: 0.302, alpha: 1) // #1D2C4D
            : UIColor(red: 0.933, green: 0.945, blue: 0.969, alpha: 1) // #EEF1F7
    })

    static let hairline = Color(UIColor { tc in
        tc.userInterfaceStyle == .dark
            ? UIColor(red: 0.169, green: 0.243, blue: 0.400, alpha: 1) // #2B3E66
            : UIColor(red: 0.835, green: 0.863, blue: 0.922, alpha: 1) // #D5DCEB
    })

    static let primaryText = Color(UIColor { tc in
        tc.userInterfaceStyle == .dark
            ? UIColor.white
            : UIColor(red: 0.078, green: 0.118, blue: 0.212, alpha: 1) // #141E36
    })

    static let secondaryText = Color(UIColor { tc in
        tc.userInterfaceStyle == .dark
            ? UIColor(red: 0.702, green: 0.753, blue: 0.863, alpha: 1) // #B3C0DC
            : UIColor(red: 0.294, green: 0.349, blue: 0.471, alpha: 1) // #4B5978
    })

    static let adaptivePrimary = Color(UIColor { tc in
        tc.userInterfaceStyle == .dark
            ? UIColor(red: 0.541, green: 0.659, blue: 0.902, alpha: 1) // #8AA8E6
            : UIColor(red: 0.125, green: 0.204, blue: 0.412, alpha: 1) // #203469
    })

    static let adaptiveRed = Color(UIColor { tc in
        tc.userInterfaceStyle == .dark
            ? UIColor(red: 0.910, green: 0.420, blue: 0.463, alpha: 1) // #E86B76
            : UIColor(red: 0.655, green: 0.106, blue: 0.157, alpha: 1) // #A71B28
    })

    static let adaptiveRedContainer = Color(UIColor { tc in
        tc.userInterfaceStyle == .dark
            ? UIColor(red: 0.361, green: 0.067, blue: 0.098, alpha: 1) // #5C1119
            : UIColor(red: 0.984, green: 0.914, blue: 0.922, alpha: 1) // #FBE9EB
    })

    static let adaptiveNavyContainer = Color(UIColor { tc in
        tc.userInterfaceStyle == .dark
            ? UIColor(red: 0.125, green: 0.204, blue: 0.412, alpha: 1) // #203469
            : UIColor(red: 0.910, green: 0.933, blue: 0.973, alpha: 1) // #E8EEF8
    })
}

extension Color {
    init(hex: UInt32, alpha: Double = 1.0) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255.0,
            green: Double((hex >> 8) & 0xFF) / 255.0,
            blue: Double(hex & 0xFF) / 255.0,
            opacity: alpha
        )
    }
}

enum HubHaptics {
    static func light() {
        let gen = UIImpactFeedbackGenerator(style: .light)
        gen.prepare()
        gen.impactOccurred()
    }

    static func selection() {
        let gen = UISelectionFeedbackGenerator()
        gen.prepare()
        gen.selectionChanged()
    }

    static func success() {
        let gen = UINotificationFeedbackGenerator()
        gen.prepare()
        gen.notificationOccurred(.success)
    }
}
