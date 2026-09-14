class AppConfig {
  static const String appName = 'KabadiLink';
  static const String defaultApiUrl = 'http://10.0.2.2:8000'; // Android emulator localhost
  static String apiUrl = defaultApiUrl;

  static const double confidenceThreshold = 0.70;
  static const int sessionTtlMinutes = 30;

  static void setApiUrl(String url) {
    apiUrl = url;
  }
}
