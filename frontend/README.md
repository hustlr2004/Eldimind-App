# EldiMind Frontend

This directory is reserved for the React PWA frontend.

Planned structure:

- `src/app` - app bootstrap, routing, providers
- `src/features` - feature-based modules such as auth, elder, caretaker, ai, medicines
- `src/components` - shared UI components
- `src/services` - API client, auth client, realtime client
- `src/i18n` - language dictionaries and translation helpers
- `src/styles` - global styles, theme tokens, accessibility styles
- `public` - manifest, icons, service worker assets

Connection plan:

- REST API calls will target the Express backend under `/api/...`
- Firebase client auth on the frontend will obtain an ID token
- The frontend will call `/api/auth/session-login` to establish a secure backend session cookie
- Protected API requests will use `credentials: 'include'`
- Realtime call signaling will use Socket.IO against the same backend host
- Media uploads will use the backend photo endpoints rather than talking directly to storage

Initial frontend env values to prepare later:

- `VITE_API_BASE_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
