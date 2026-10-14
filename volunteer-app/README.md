# SafeMeter volunteer app (Flutter)

Pages registered volunteers when a SafeMeter unit detects a crash nearby, lets the first
one to accept become the responder, and records time-to-accept / time-to-arrive for the
pilot data.

| Screen            | What it does                                                                 |
|-------------------|------------------------------------------------------------------------------|
| Register          | Name, phone, safety-guide acknowledgement, location permission               |
| Home              | Availability switch, list of open incidents, refresh location                |
| Incident          | Speed at impact, time, **Navigate** (Google Maps), **Call rider / 108**, **Accept**, **I have arrived**, safety reminders |

Push notifications arrive via FCM from `backend/functions/index.js → onIncidentCreated`.
Tapping a notification opens the incident directly.

## Setup

```bash
flutter --version            # 3.19+ recommended
dart pub global activate flutterfire_cli

cd volunteer-app
flutter create . --platforms=android,ios   # generates android/ and ios/ folders
flutterfire configure                      # writes lib/firebase_options.dart + google-services.json
flutter pub get
flutter run
```

`lib/firebase_options.dart`, `google-services.json` and `GoogleService-Info.plist` are
git-ignored — generate them per project with `flutterfire configure`.

### Android specifics

- `android/app/src/main/AndroidManifest.xml`: add
  `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `POST_NOTIFICATIONS`, `CALL_PHONE`.
- Create the notification channel `safemeter_alerts` with high importance so alerts
  make a sound (the backend targets that channel id). The simplest way is the
  `flutter_local_notifications` package, or declare it with
  `<meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="safemeter_alerts"/>`.
- `minSdkVersion 21`.

### iOS specifics

- Enable Push Notifications + Background Modes (remote notifications) capabilities.
- Add `NSLocationWhenInUseUsageDescription` to `Info.plist`.

## Code layout

```
lib/
├── main.dart                       Firebase init, anonymous sign-in, routes
├── screens/
│   ├── register_screen.dart
│   ├── home_screen.dart
│   └── incident_screen.dart
├── services/
│   ├── firebase_service.dart       Firestore + callable functions
│   └── notification_service.dart   FCM token + tap routing
└── utils/geohash.dart              geofire-compatible geohash encoder
```

## Status

The app is written against the current stable Firebase/Flutter plugin APIs but has not yet
been built on a device in this repository — run `flutter analyze` after `flutterfire configure`
and fix anything the analyzer flags for your plugin versions. Volunteer training content is
in [`docs/volunteer-training.md`](../docs/volunteer-training.md).
