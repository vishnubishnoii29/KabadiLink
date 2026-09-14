import 'package:flutter/material.dart';
import 'ui/collector/sell_wizard.dart';
import 'ui/collector/safety_page.dart';

void main() {
  runApp(const KabadiLinkMobileApp());
}

class KabadiLinkMobileApp extends StatelessWidget {
  const KabadiLinkMobileApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'KabadiLink Collector',
      theme: ThemeData(
        primarySwatch: Colors.teal,
        useMaterial3: true,
      ),
      home: const CollectorHomeScreen(),
    );
  }
}

class CollectorHomeScreen extends StatefulWidget {
  const CollectorHomeScreen({Key? key}) : super(key: key);

  @override
  State<CollectorHomeScreen> createState() => _CollectorHomeScreenState();
}

class _CollectorHomeScreenState extends State<CollectorHomeScreen> {
  int _currentIndex = 0;

  final List<Widget> _tabs = [
    const SellWizardPage(),
    const SafetyGuidePage(materialCode: 'BATTERY'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _tabs[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        items: const [
          BottomNavigationBarItem(
            icon: Icon(Icons.add_a_photo),
            label: 'Sell Scrap',
          ),
          BottomNavigationBarItem(
            icon: Icon(Icons.health_and_safety),
            label: 'Safety Guide',
          ),
        ],
      ),
    );
  }
}
