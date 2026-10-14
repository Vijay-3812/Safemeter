import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:geolocator/geolocator.dart';

import '../utils/geohash.dart';

/// Thin wrapper over Firestore / Cloud Functions used by the screens.
class FirebaseService {
  FirebaseService._();
  static final FirebaseService instance = FirebaseService._();

  final _db = FirebaseFirestore.instance;
  final _functions = FirebaseFunctions.instanceFor(region: 'asia-south1');

  String get uid => FirebaseAuth.instance.currentUser!.uid;
  DocumentReference<Map<String, dynamic>> get _me => _db.collection('volunteers').doc(uid);

  Future<bool> isRegistered() async => (await _me.get()).exists;

  Stream<DocumentSnapshot<Map<String, dynamic>>> myProfile() => _me.snapshots();

  /// Create / update the volunteer profile, including the current location.
  Future<void> register({required String name, required String phone, bool trained = false}) async {
    final pos = await _currentPosition();
    await _me.set({
      'name': name,
      'phone': phone,
      'available': true,
      'trained': trained,
      if (pos != null) ...{
        'lat': pos.latitude,
        'lon': pos.longitude,
        'geohash': Geohash.encode(pos.latitude, pos.longitude),
      },
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  Future<void> setAvailable(bool available) => _me.set({
        'available': available,
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));

  Future<void> saveFcmToken(String token) => _me.set({'fcmToken': token}, SetOptions(merge: true));

  /// Refresh the stored location (call on app open / periodically while available).
  Future<void> updateLocation() async {
    final pos = await _currentPosition();
    if (pos == null) return;
    await _me.set({
      'lat': pos.latitude,
      'lon': pos.longitude,
      'geohash': Geohash.encode(pos.latitude, pos.longitude),
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }

  /// Recent incidents that still need help, newest first.
  Stream<QuerySnapshot<Map<String, dynamic>>> openIncidents() => _db
      .collection('incidents')
      .where('status', whereIn: ['alerted', 'responder_assigned'])
      .orderBy('createdAt', descending: true)
      .limit(25)
      .snapshots();

  Stream<DocumentSnapshot<Map<String, dynamic>>> incident(String id) =>
      _db.collection('incidents').doc(id).snapshots();

  /// First volunteer to accept wins. Throws [FirebaseFunctionsException]
  /// with code `already-exists` if someone else got there first.
  Future<void> acceptIncident(String id) =>
      _functions.httpsCallable('acceptIncident').call({'incidentId': id});

  Future<void> markArrived(String id) =>
      _functions.httpsCallable('markArrived').call({'incidentId': id});

  Future<Position?> _currentPosition() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      return null;
    }
    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium),
      );
    } catch (_) {
      return null;
    }
  }
}
