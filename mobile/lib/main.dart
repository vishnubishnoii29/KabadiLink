import 'package:flutter/material.dart';
import 'core/app_settings.dart';
import 'core/config.dart';
import 'data/repository.dart';
import 'ui/auth/login_page.dart';
import 'ui/collector/sell_wizard.dart';
import 'ui/collector/lots_page.dart';
import 'ui/collector/passport_page.dart';
import 'ui/collector/earnings_page.dart';
import 'ui/collector/safety_page.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppSettings.instance.load();
  await Repository.instance.bootstrap();
  runApp(const KabadiLinkMobileApp());
}

class KabadiLinkMobileApp extends StatelessWidget {
  const KabadiLinkMobileApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: AppSettings.instance.lowLiteracyMode,
      builder: (context, lowLiteracy, _) {
        return MaterialApp(
          title: AppConfig.appName,
          theme: ThemeData(
            primarySwatch: Colors.teal,
            useMaterial3: true,
            visualDensity: lowLiteracy ? VisualDensity.comfortable : VisualDensity.standard,
            textTheme: lowLiteracy
                ? Typography.material2021().black.apply(fontSizeFactor: 1.35)
                : Typography.material2021().black,
          ),
          home: const _AuthGate(),
        );
      },
    );
  }
}

class _AuthGate extends StatefulWidget {
  const _AuthGate();

  @override
  State<_AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<_AuthGate> {
  late bool _loggedIn;

  @override
  void initState() {
    super.initState();
    _loggedIn = Repository.instance.isAuthenticated;
  }

  @override
  Widget build(BuildContext context) {
    if (!_loggedIn) {
      return LoginPage(onLoggedIn: () => setState(() => _loggedIn = true));
    }
    return const CollectorHomeScreen();
  }
}

class CollectorHomeScreen extends StatefulWidget {
  const CollectorHomeScreen({Key? key}) : super(key: key);

  @override
  State<CollectorHomeScreen> createState() => _CollectorHomeScreenState();
}

class _CollectorHomeScreenState extends State<CollectorHomeScreen> {
  int _currentIndex = 0;

  final List<Widget> _tabs = const [
    SellWizardPage(),
    LotsPage(),
    PassportPage(),
    EarningsPage(),
    SafetyGuidePage(materialCode: 'BATTERY'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('KabadiLink'),
        backgroundColor: Colors.teal,
        actions: [
          ValueListenableBuilder<bool>(
            valueListenable: AppSettings.instance.lowLiteracyMode,
            builder: (context, enabled, _) => IconButton(
              icon: Icon(enabled ? Icons.accessibility_new : Icons.accessibility_new_outlined),
              tooltip: 'Large text / voice-guided mode',
              onPressed: () => AppSettings.instance.setLowLiteracyMode(!enabled),
            ),
          ),
        ],
      ),
      body: _tabs[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.add_a_photo), label: 'Sell'),
          BottomNavigationBarItem(icon: Icon(Icons.list_alt), label: 'Lots'),
          BottomNavigationBarItem(icon: Icon(Icons.badge), label: 'Passport'),
          BottomNavigationBarItem(icon: Icon(Icons.payments), label: 'Earnings'),
          BottomNavigationBarItem(icon: Icon(Icons.health_and_safety), label: 'Safety'),
        ],
      ),
    );
  }
}
