# SafeMeter dashboard

A single static page (no build step) that shows:

- **Live incident list** — time, vehicle, speed before impact, peak g, status, time-to-accept, time-to-arrive
- **Map** — colour-coded markers (red = alerted, orange = responder assigned, green = arrived, grey = cancelled)
- **Black-spot heatmap** — toggle in the header; cancelled events are excluded
- **Response-time summary** — average time to accept and arrive

## Run it

```bash
# any static server works
cd dashboard
python3 -m http.server 8000
# open http://localhost:8000
```

Without a Firebase config the page runs in **demo mode** with generated incidents around
Chennai and a new "alert" every 20 s, which is handy for the live demo.

## Connect to Firebase

1. Firebase console → Project settings → *Your apps* → Web app → copy the config.
2. Paste it into `firebase-config.js`.
3. Enable **Anonymous** sign-in (Authentication → Sign-in method) so the Firestore rules
   (`request.auth != null`) allow reads, or swap `signInAnonymously()` for your own login.
4. Deploy with `firebase deploy --only hosting` from `backend/` (hosting is pointed here).

## Files

| File                 | Purpose                                     |
|----------------------|---------------------------------------------|
| `index.html`         | Layout                                      |
| `app.js`             | Firestore listener, rendering, demo data    |
| `styles.css`         | Dark theme                                  |
| `firebase-config.js` | Your project config (placeholder = demo)    |

Dependencies are loaded from CDNs (Leaflet, leaflet.heat, Firebase compat SDK) so the page
works from any static host without a bundler.
