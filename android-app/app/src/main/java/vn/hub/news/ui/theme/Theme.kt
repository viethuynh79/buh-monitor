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

val HubNavy = Color(0xFF0B1F3A)
val HubNavyLight = Color(0xFF17365D)
val HubGold = Color(0xFFC9972C)
val HubGoldSoft = Color(0xFFF6EBD3)
val HubUrgent = Color(0xFFC62828)
val HubUrgentBg = Color(0xFFFFEBEE)
val HubOnlineGreen = Color(0xFF1B8A5A)
val HubWarnAmber = Color(0xFFD9820B)

private val LightColors = lightColorScheme(
    primary = HubNavy,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE3ECF7),
    onPrimaryContainer = HubNavy,
    secondary = HubGold,
    onSecondary = Color(0xFF1A1200),
    secondaryContainer = HubGoldSoft,
    onSecondaryContainer = Color(0xFF4A3400),
    background = Color(0xFFF7F8FA),
    onBackground = Color(0xFF111827),
    surface = Color.White,
    onSurface = Color(0xFF111827),
    surfaceVariant = Color(0xFFEEF2F6),
    onSurfaceVariant = Color(0xFF526071),
    outline = Color(0xFFD8E0EA),
    error = HubUrgent,
    onError = Color.White,
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF8AB8F0),
    onPrimary = Color(0xFF061529),
    primaryContainer = Color(0xFF152C4C),
    onPrimaryContainer = Color(0xFFDCEBFF),
    secondary = Color(0xFFE2B857),
    onSecondary = Color(0xFF1F1600),
    secondaryContainer = Color(0xFF3D2E0A),
    onSecondaryContainer = Color(0xFFFBE2A2),
    background = Color(0xFF0B111A),
    onBackground = Color(0xFFF0F4F8),
    surface = Color(0xFF121A26),
    onSurface = Color(0xFFF0F4F8),
    surfaceVariant = Color(0xFF1C2738),
    onSurfaceVariant = Color(0xFFA6B4C6),
    outline = Color(0xFF28364A),
    error = Color(0xFFFF7B7B),
    onError = Color(0xFF2A0000),
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
