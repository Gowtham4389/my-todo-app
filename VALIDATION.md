# Verification record

Run locally on September 30, 2026.

| Check | Result |
| --- | --- |
| TypeScript (`npm run typecheck`) | Passed |
| Core unit tests (`npm test`) | 15 passed |
| Firestore emulator security tests (`npm run test:rules`) | 6 passed, using temporary Temurin Java 21 and a demo project |
| Browser acceptance tests | 5 passed in Google Chrome |
| Production build at `/` | Passed |
| Production build and browser suite at `/my-todo-app/` | Passed |

The browser suite exercised task creation/editing, completion/reopening, undo, Trash restoration, nested hash-route reload, mobile navigation at 390 px with no horizontal overflow, JSON export/preview/duplicate-free reimport, dark mode, recurring occurrence independence, linked goal progress, and production service-worker offline app-shell reload. Desktop and mobile screenshots were visually inspected.

The rules suite verified owner CRUD, denial of other authenticated users (including their own user paths), denial of anonymous access, owner isolation from other user paths, rejection of extra/invalid fields, acceptance of the full 10-subtask limit and rejection above it, deterministic occurrence IDs, and preservation of deletion tombstones.

The full modular Firebase SDK creates a production chunk above Vite's 500 kB uncompressed advisory threshold (about 181 kB gzip). The build succeeds; this is an advisory size warning. Settings and goals are separately lazy-loaded, and the service worker precaches the shell and chunks.

## Requires your account or device

The following have **not** been verified against a real Firebase project or actual GitHub deployment:

- Google sign-in and authorization on your configured domains.
- Production Firestore indexes completing deployment.
- Live synchronization between desktop and mobile devices.
- Offline Firestore edits surviving a reload and synchronizing after reconnecting (the tested offline browser flow used the separate local demo).
- Installation and reopening from a physical phone's home screen.
- GitHub Actions execution and publication to your repository's Pages URL.

Firebase web configuration and the GitHub repository were subsequently supplied. The local configuration, owner rule, Firebase project alias, and GitHub Actions variables are configured. Rules/index deployment requires an authenticated Firebase CLI session. Production authentication and physical-device checks remain separate from emulator and demo tests.
