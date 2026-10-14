import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../services/firebase_service.dart';
import 'incident_screen.dart';

/// Availability toggle + list of open incidents.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  static const route = '/home';

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _svc = FirebaseService.instance;

  @override
  void initState() {
    super.initState();
    _svc.updateLocation(); // keep the geo index fresh whenever the app opens
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('SafeMeter Volunteer'),
        actions: [
          IconButton(
            tooltip: 'Refresh my location',
            icon: const Icon(Icons.my_location),
            onPressed: () async {
              await _svc.updateLocation();
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Location updated')));
            },
          ),
        ],
      ),
      body: Column(
        children: [
          StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
            stream: _svc.myProfile(),
            builder: (context, snap) {
              final data = snap.data?.data() ?? {};
              final available = data['available'] == true;
              return SwitchListTile(
                title: Text(available ? 'You are available' : 'You are unavailable'),
                subtitle: Text(available
                    ? 'You will be paged for crashes within ~5 km'
                    : 'Turn on to receive crash alerts'),
                secondary: Icon(Icons.circle, color: available ? Colors.green : Colors.grey),
                value: available,
                onChanged: (v) => _svc.setAvailable(v),
              );
            },
          ),
          const Divider(height: 1),
          Expanded(
            child: StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: _svc.openIncidents(),
              builder: (context, snap) {
                if (snap.hasError) {
                  return Center(child: Text('Error: ${snap.error}'));
                }
                if (!snap.hasData) {
                  return const Center(child: CircularProgressIndicator());
                }
                final docs = snap.data!.docs;
                if (docs.isEmpty) {
                  return const Center(
                    child: Padding(
                      padding: EdgeInsets.all(32),
                      child: Text('No open incidents. Thank you for being ready.',
                          textAlign: TextAlign.center),
                    ),
                  );
                }
                return ListView.separated(
                  itemCount: docs.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, i) {
                    final d = docs[i].data();
                    final status = d['status'] as String? ?? '';
                    final created = (d['createdAt'] as Timestamp?)?.toDate();
                    final isMine = d['responderId'] == _svc.uid;
                    return ListTile(
                      leading: Icon(
                        status == 'alerted' ? Icons.warning_amber_rounded : Icons.directions_run,
                        color: status == 'alerted' ? Colors.red : Colors.orange,
                      ),
                      title: Text('${d['vehicleId'] ?? 'Vehicle'} · ${(d['speedKmh'] ?? 0).round()} km/h · '
                          '${(d['peakG'] ?? 0).toStringAsFixed(1)} g'),
                      subtitle: Text([
                        if (created != null) DateFormat('dd MMM HH:mm').format(created),
                        if (status == 'alerted') 'Needs a responder',
                        if (status == 'responder_assigned') isMine ? 'You are responding' : 'Case taken',
                      ].join(' · ')),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.of(context)
                          .pushNamed(IncidentScreen.route, arguments: docs[i].id),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
