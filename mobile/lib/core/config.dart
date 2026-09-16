class AppConfig {
  static const String appName = 'KabadiLink';
  // Computer LAN IP (10.34.1.52) for physical phone on Wi-Fi, or 10.0.2.2:8000 for Android Emulator
  static const String defaultApiUrl = 'http://10.34.1.52:8000';
  static String apiUrl = defaultApiUrl;


  static const double confidenceThreshold = 0.70;
  static const int sessionTtlMinutes = 30;

  static void setApiUrl(String url) {
    apiUrl = url;
  }
}
