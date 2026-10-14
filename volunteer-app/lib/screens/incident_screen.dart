import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../services/firebase_service.dart';

/// Incident details: speed at impact, time, map link, Accept / Arrived actions.
class IncidentScreen extends StatefulWidget {
  const IncidentScreen({super.key, required this.incidentId});
  static const route = '/incident';
  final String incidentId;

  @override
  State<IncidentScreen> createState() => _IncidentScreenState();
}

class _IncidentScreenState extends State<IncidentScreen> {
  final _svc = FirebaseService.instance;
  bool _busy = false;

  Future<void> _accept() async {
    setState(() => _busy = true);
    try {
      await _svc.acceptIncident(widget.incidentId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('You are the responder. Approach safely and call 108.')),
      );
    } on FirebaseFunctionsException catch (e) {
      if (!mounted) return;
      final msg = e.code == 'already-exists'
          ? 'Another volunteer already took this case.'
          : 'Could not accept: ${e.message}';
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _arrived() async {
    setState(() => _busy = true);
    try {
      await _svc.markArrived(widget.incidentId);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _openMaps(double lat, double lon) async {
    final uri = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=$lat,$lon&travelmode=driving');
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not open maps')));
    }
  }

  Future<void> _call(String number) async {
    await launchUrl(Uri.parse('tel:$number'));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Crash alert')),
      body: StreamBuilder<DocumentSnapshot<Map<String, dynamic>>>(
        stream: _svc.incident(widget.incidentId),
        builder: (context, snap) {
          if (!snap.hasData) return const Center(child: CircularProgressIndicator());
          final d = snap.data!.data();
          if (d == null) return const Center(child: Text('Incident not found'));

          final status = d['status'] as String? ?? '';
          final lat = (d['lat'] as num?)?.toDouble();
          final lon = (d['lon'] as num?)?.toDouble();
          final created = (d['createdAt'] as Timestamp?)?.toDate();
          final responder = d['responderId'] as String?;
          final isMine = responder == _svc.uid;
          final taken = responder != null && !isMine;
          final ownerPhone = d['ownerPhone'] as String?;

          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              _StatusBanner(status: status, isMine: isMine),
              const SizedBox(height: 16),
              _Row('Vehicle', '${d['vehicleId'] ?? '–'}'),
              _Row('Time', created != null ? DateFormat('dd MMM yyyy, HH:mm:ss').format(created) : '–'),
              _Row('Speed before impact', '${(d['speedKmh'] ?? 0).round()} km/h'),
              _Row('Peak impact', '${(d['peakG'] ?? 0).toStringAsFixed(1)} g'),
              if (d['timeToAcceptSec'] != null) _Row('Time to accept', '${d['timeToAcceptSec']} s'),
              if (d['timeToArriveSec'] != null) _Row('Time to arrive', '${d['timeToArriveSec']} s'),
              const SizedBox(height: 20),
              if (lat != null && lon != null)
                OutlinedButton.icon(
                  onPressed: () => _openMaps(lat, lon),
                  icon: const Icon(Icons.map),
                  label: Text('Navigate to ${lat.toStringAsFixed(5)}, ${lon.toStringAsFixed(5)}'),
                )
              else
                const Text('No GPS location was available for this alert.'),
              const SizedBox(height: 10),
              if (ownerPhone != null)
                OutlinedButton.icon(
                  onPressed: () => _call(ownerPhone),
                  icon: const Icon(Icons.phone),
                  label: const Text('Call the rider'),
                ),
              OutlinedButton.icon(
                onPressed: () => _call('108'),
                icon: const Icon(Icons.local_hospital),
                label: const Text('Call 108 (ambulance)'),
              ),
              const SizedBox(height: 24),
              if (status == 'alerted' && !taken)
                FilledButton.icon(
                  onPressed: _busy ? null : _accept,
                  icon: const Icon(Icons.check_circle),
                  label: const Text('ACCEPT — I am going'),
                  style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
                ),
              if (isMine && status == 'responder_assigned')
                FilledButton.icon(
                  onPressed: _busy ? null : _arrived,
                  icon: const Icon(Icons.flag),
                  label: const Text('I have arrived'),
                ),
              if (taken)
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: Text('Another volunteer is responding. Thank you for being ready.',
                      textAlign: TextAlign.center),
                ),
              const SizedBox(height: 24),
              const _SafetyCard(),
            ],
          );
        },
      ),
    );
  }
}

class _StatusBanner extends StatelessWidget {
  const _StatusBanner({required this.status, required this.isMine});
  final String status;
  final bool isMine;

  @override
  Widget build(BuildContext context) {
    final (text, color) = switch (status) {
      'alerted' => ('CRASH DETECTED — needs a responder', Colors.red),
      'responder_assigned' => (isMine ? 'You are responding' : 'Responder assigned', Colors.orange),
      'responder_arrived' => ('Responder on scene', Colors.green),
      'cancelled' => ('Cancelled by rider (false alarm)', Colors.grey),
      _ => (status, Colors.blueGrey),
    };
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
      child: Row(children: [
        Icon(Icons.info, color: color),
        const SizedBox(width: 10),
        Expanded(child: Text(text, style: TextStyle(fontWeight: FontWeight.w600, color: color))),
      ]),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row(this.label, this.value);
  final String label, value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(children: [
        Expanded(child: Text(label, style: const TextStyle(color: Colors.grey))),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
      ]),
    );
  }
}

class _SafetyCard extends StatelessWidget {
  const _SafetyCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: const [
            Text('Responder safety reminders', style: TextStyle(fontWeight: FontWeight.bold)),
            SizedBox(height: 8),
            Text('• Park safely, switch on hazard lights, watch for traffic.'),
            Text('• Call 108 first if it has not been called.'),
            Text('• Do NOT move the rider if a neck or spinal injury is possible.'),
            Text('• Do not remove the helmet unless the airway is blocked.'),
            Text('• Stop heavy bleeding with firm pressure; keep the rider warm and talking.'),
            Text('• You are a first responder, not a doctor — guide, reassure, hand over.'),
          ],
        ),
      ),
    );
  }
}
