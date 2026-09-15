import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AppSettings {
  AppSettings._();
  static final AppSettings instance = AppSettings._();

  final ValueNotifier<bool> lowLiteracyMode = ValueNotifier<bool>(false);

  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    lowLiteracyMode.value = prefs.getBool('low_literacy_mode') ?? false;
  }

  Future<void> setLowLiteracyMode(bool value) async {
    lowLiteracyMode.value = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('low_literacy_mode', value);
  }
}
