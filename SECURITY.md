# Security policy

SafeMeter is a research prototype. No release is currently designated production-supported or certified for emergency use. Security fixes target the current development code on `main`; there is no promised response-time SLA.

## Report privately

Do not open a public issue containing a vulnerability exploit, API credentials, phone numbers or personal locations.

Use the repository’s **Security → Advisories → Report a vulnerability** option if private reporting is enabled. If that option is unavailable, open a minimal issue asking the maintainer for a private reporting channel, **without vulnerability details**. Do not send secrets in that issue.

Include the affected component/commit, reproduction steps with synthetic data, impact, and any suggested fix. Test only your own devices and Firebase projects. Never trigger emergency services or access another person’s incident data.

## Before any connected deployment

- Replace example configuration; provision and rotate device keys. Keep privileged Firebase service-account credentials out of Git and client apps.
- Review authentication, authorization and Firestore rules with emulator tests; do not assume client UI restrictions secure the database.
- Add ingestion validation, abuse controls, monitoring and least-privilege service accounts.
- Restrict access to precise locations and phone numbers. Define consent, retention and deletion policies before collecting personal data.
- Use consenting test recipients. Clearly label demonstrations and synthetic incidents.
- Review HTTPS transport, retries, failure handling and dependency advisories.

Firebase web configuration is generally a client identifier, not an admin credential; access must be enforced by authentication and server-side rules. Device ingestion keys and service-account credentials **are secrets**.

Physical safety or false-negative reports should also include mounting, calibration, sensor range, power and network conditions. Do not recreate an unsafe event to reproduce a report.
