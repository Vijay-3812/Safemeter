import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';

import '../screens/incident_screen.dart';
import 'firebase_service.dart';

/// Registers the FCM token and routes incident notifications to the incident screen.
class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();
  static final navigatorKey = GlobalKey<NavigatorState>();

  bool _initialised = false;

  Future<void> init() async {
    if (_initialised) return;
    _initialised = true;

    final fcm = FirebaseMessaging.instance;
    await fcm.requestPermission(alert: true, badge: true, sound: true);

    final token = await fcm.getToken();
    if (token != null) await FirebaseService.instance.saveFcmToken(token);
    fcm.onTokenRefresh.listen(FirebaseService.instance.saveFcmToken);

    // App in foreground: show a banner with an "Open" action.
    FirebaseMessaging.onMessage.listen((m) {
      final ctx = navigatorKey.currentContext;
      if (ctx == null) return;
      final id = m.data['incidentId'];
      ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(
        duration: const Duration(seconds: 12),
        backgroundColor: const Color(0xFFE63946),
        content: Text(m.notification?.title ?? 'SafeMeter alert'),
        action: id == null
            ? null
            : SnackBarAction(
                label: 'OPEN',
                textColor: Colors.white,
                onPressed: () => _open(id),
              ),
      ));
    });

    // Notification tapped while app was in background / terminated.
    FirebaseMessaging.onMessageOpenedApp.listen((m) => _openFromMessage(m));
    final initial = await fcm.getInitialMessage();
    if (initial != null) _openFromMessage(initial);
  }

  void _openFromMessage(RemoteMessage m) {
    final id = m.data['incidentId'];
    if (id != null && m.data['type'] == 'incident') _open(id);
  }

  void _open(String incidentId) {
    navigatorKey.currentState?.pushNamed(IncidentScreen.route, arguments: incidentId);
  }
}
