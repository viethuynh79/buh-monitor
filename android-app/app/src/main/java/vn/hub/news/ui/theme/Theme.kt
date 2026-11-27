package vn.hub.news.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import vn.hub.news.model.ThemeMode

// Exact brand palette sampled directly from the official HUB University crest logo
val HubWhite = Color(0xFFFFFFFF)
val HubNavy = Color(0xFF203469)        // Xanh Đậm chủ đạo của Logo HUB
val HubNavyDeep = Color(0xFF15254F)    // Xanh Đậm nhấn sâu
val HubNavySoft = Color(0xFFE8EEF8)    // Nền xanh nhạt hài hòa
val HubRed = Color(0xFFA71B28)         // Đỏ HUB chủ đạo của Logo HUB
val HubRedSoft = Color(0xFFFBE9EB)     // Nền đỏ nhạt tinh tế
val HubOnlineGreen = Color(0xFF1B8A5A)
val HubWarnAmber = Color(0xFFD9820B)

private val LightColors = lightColorScheme(
    primary = HubNavy,
    onPrimary = HubWhite,
    primaryContainer = HubNavySoft,
    onPrimaryContainer = HubNavy,
    secondary = HubRed,
    onSecondary = HubWhite,
    secondaryContainer = HubRedSoft,
    onSecondaryContainer = HubRed,
    tertiary = HubRed,
    onTertiary = HubWhite,
    background = Color(0xFFF6F7FA),
    onBackground = Color(0xFF141E36),
    surface = HubWhite,
    onSurface = Color(0xFF141E36),
    surfaceVariant = Color(0xFFEEF1F7),
    onSurfaceVariant = Color(0xFF4B5978),
    outline = Color(0xFFD5DCEB),
    error = HubRed,
    onError = HubWhite,
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF8AA8E6),
    onPrimary = Color(0xFF0E1B3A),
    primaryContainer = HubNavy,
    onPrimaryContainer = HubWhite,
    secondary = Color(0xFFE86B76),
    onSecondary = Color(0xFF2D0409),
    secondaryContainer = Color(0xFF5C1119),
    onSecondaryContainer = Color(0xFFFFDADE),
    tertiary = Color(0xFFE86B76),
    onTertiary = Color(0xFF2D0409),
    background = Color(0xFF0C1426),
    onBackground = HubWhite,
    surface = Color(0xFF131E36),
    onSurface = HubWhite,
    surfaceVariant = Color(0xFF1D2C4D),
    onSurfaceVariant = Color(0xFFB3C0DC),
    outline = Color(0xFF2B3E66),
    error = Color(0xFFFF7A85),
    onError = Color(0xFF2D0409),
)

// 100% upright minimalist typography (FontStyle.Normal everywhere)
private val HubTypography = Typography(
    headlineSmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontStyle = FontStyle.Normal,
        fontSize = 21.sp,
        lineHeight = 27.sp,
        letterSpacing = (-0.2).sp,
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Bold,
        fontStyle = FontStyle.Normal,
        fontSize = 18.sp,
        lineHeight = 24.sp,
    ),
    titleMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontStyle = FontStyle.Normal,
        fontSize = 15.sp,
        lineHeight = 21.sp,
    ),
    titleSmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontStyle = FontStyle.Normal,
        fontSize = 13.sp,
        lineHeight = 18.sp,
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontStyle = FontStyle.Normal,
        fontSize = 15.sp,
        lineHeight = 22.sp,
    ),
    bodyMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontStyle = FontStyle.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp,
    ),
    bodySmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Normal,
        fontStyle = FontStyle.Normal,
        fontSize = 12.sp,
        lineHeight = 17.sp,
    ),
    labelLarge = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.SemiBold,
        fontStyle = FontStyle.Normal,
        fontSize = 13.sp,
        lineHeight = 18.sp,
    ),
    labelMedium = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontStyle = FontStyle.Normal,
        fontSize = 12.sp,
        lineHeight = 16.sp,
    ),
    labelSmall = TextStyle(
        fontFamily = FontFamily.SansSerif,
        fontWeight = FontWeight.Medium,
        fontStyle = FontStyle.Normal,
        fontSize = 11.sp,
        lineHeight = 14.sp,
    ),
)

@Composable
fun HubNewsTheme(
    themeMode: ThemeMode = ThemeMode.SYSTEM,
    content: @Composable () -> Unit,
) {
    val dark = when (themeMode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.DARK -> true
        ThemeMode.LIGHT -> false
    }
    MaterialTheme(
        colorScheme = if (dark) DarkColors else LightColors,
        typography = HubTypography,
        content = content,
    )
}
