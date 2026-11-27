# Keep kotlinx.serialization classes
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** {
    *** Companion;
}
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class vn.hub.news.model.**$$serializer { *; }
-keepclassmembers class vn.hub.news.model.** {
    *** Companion;
}
-keepclasseswithmembers class vn.hub.news.model.** {
    kotlinx.serialization.KSerializer serializer(...);
}
