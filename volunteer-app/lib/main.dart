import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';

import 'firebase_options.dart';
import 'screens/home_screen.dart';
import 'screens/incident_screen.dart';
import 'screens/register_screen.dart';
import 'services/firebase_service.dart';
import 'services/notification_service.dart';

/// Background FCM handler — must be a top-level function.
@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  // Nothing else to do: the system tray notification is shown automatically.
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);

  // Anonymous sign-in keeps the pilot simple; swap for phone auth in production.
  if (FirebaseAuth.instance.currentUser == null) {
    await FirebaseAuth.instance.signInAnonymously();
  }
  runApp(const SafeMeterVolunteerApp());
}

class SafeMeterVolunteerApp extends StatelessWidget {
  const SafeMeterVolunteerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SafeMeter Volunteer',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFFE63946),
        useMaterial3: true,
      ),
      navigatorKey: NotificationService.navigatorKey,
      routes: {
        '/': (_) => const _Gate(),
        RegisterScreen.route: (_) => const RegisterScreen(),
        HomeScreen.route: (_) => const HomeScreen(),
        IncidentScreen.route: (ctx) {
          final id = ModalRoute.of(ctx)!.settings.arguments as String;
          return IncidentScreen(incidentId: id);
        },
      },
    );
  }
}

/// Decides between registration and home, and wires up push notifications.
class _Gate extends StatefulWidget {
  const _Gate();

  @override
  State<_Gate> createState() => _GateState();
}

class _GateState extends State<_Gate> {
  @override
  void initState() {
    super.initState();
    NotificationService.instance.init();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<bool>(
      future: FirebaseService.instance.isRegistered(),
      builder: (context, snap) {
        if (!snap.hasData) {
          return const Scaffold(body: Center(child: CircularProgressIndicator()));
        }
        return snap.data! ? const HomeScreen() : const RegisterScreen();
      },
    );
  }
}
