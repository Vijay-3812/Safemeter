import 'package:flutter/material.dart';

import '../services/firebase_service.dart';
import 'home_screen.dart';

/// One-time registration: name, phone, training acknowledgement, location permission.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});
  static const route = '/register';

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  bool _trained = false;
  bool _busy = false;

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      await FirebaseService.instance.register(
        name: _name.text.trim(),
        phone: _phone.text.trim(),
        trained: _trained,
      );
      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed(HomeScreen.route);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not register: $e')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Become a SafeMeter volunteer')),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const Text(
              'When a SafeMeter unit detects a crash near you, you will get a notification '
              'with the location and speed at impact. The first volunteer to accept becomes '
              'the responder. Family and emergency services are always alerted in parallel.',
            ),
            const SizedBox(height: 20),
            TextFormField(
              controller: _name,
              decoration: const InputDecoration(labelText: 'Full name', border: OutlineInputBorder()),
              validator: (v) => (v == null || v.trim().length < 2) ? 'Enter your name' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                labelText: 'Mobile number',
                hintText: '+91 98765 43210',
                border: OutlineInputBorder(),
              ),
              validator: (v) => (v == null || v.replaceAll(RegExp(r'\D'), '').length < 10)
                  ? 'Enter a valid mobile number'
                  : null,
            ),
            const SizedBox(height: 12),
            CheckboxListTile(
              value: _trained,
              onChanged: (v) => setState(() => _trained = v ?? false),
              controlAffinity: ListTileControlAffinity.leading,
              title: const Text('I have read the volunteer safety guide'),
              subtitle: const Text('Approach safely · call 108 · do not move a suspected spinal injury'),
            ),
            const SizedBox(height: 20),
            FilledButton.icon(
              onPressed: _busy ? null : _submit,
              icon: _busy
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.volunteer_activism),
              label: const Text('Register and share my location'),
            ),
            const SizedBox(height: 12),
            const Text(
              'Your location is used only to find volunteers near an incident. '
              'It is never shown to other volunteers or riders.',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
      ),
    );
  }
}
