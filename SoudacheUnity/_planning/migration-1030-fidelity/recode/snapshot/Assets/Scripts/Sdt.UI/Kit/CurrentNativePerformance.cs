// Native consumers of the current performance-settings.css named decorative layers.
namespace Sdt.UI.Kit
{
    public static class CurrentNativePerformance
    {
        public static bool Available => true;
        public static bool Low => CurrentUiPreferences.Quality == "low";
        public static bool High => CurrentUiPreferences.Quality == "high";
    }
}
