# Daymark

A quiet home for yearly goals, monthly plans, weekly intentions, and everyday tasks. A responsive, static React + TypeScript application with Google authentication, Firestore synchronization, offline persistence, and an installable PWA. No application server is required.

Repository: [Gowtham4389/my-todo-app](https://github.com/Gowtham4389/my-todo-app). The project-specific Firebase configuration is in ignored `.env.local`; `.env.example` remains a reusable template. Firestore rules and `.firebaserc` are configured for this project. The published app uses `/my-todo-app/` as its base path.

## Start locally

Use **Node.js 24 LTS** and npm. Dependencies are pinned and `package-lock.json` is committed for reproducible builds.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Without Firebase configuration, Daymark explains setup and offers **Explore the demo**. The demo has working tasks and backups, stores its records under `daymark-demo-v1` in browser local storage, and never writes to Firebase. Leaving the demo hides its data; returning restores it. Private browsing or clearing browser storage can erase demo data.

To preview the production PWA:

```sh
npm run build
npm run preview
```

The service worker runs in the production build, not the development server. The first visit requires internet. There are no remote fonts, image services, analytics, or application backend.

## Connect your Firebase account

1. In the [Firebase console](https://console.firebase.google.com/), create a project, then register a **Web app** in Project settings → General. Copy its public web configuration.
2. In Build → Authentication → Sign-in method, enable **Google**, including the support email. Under Authentication → Settings → Authorized domains, add `localhost` for local development and `YOUR_USERNAME.github.io` for deployment. Add your custom domain if applicable. Use domain names, without paths or protocols.
3. In Build → Firestore Database, create a database in **production mode**. Choose a region near you. Do not enable open test rules.
4. Copy the example configuration:

   ```sh
   cp .env.example .env.local
   ```

   Fill in the Firebase web fields. For local development set `VITE_BASE_PATH=/`. Initially set `VITE_OWNER_UID=temporary-owner-placeholder`.
5. Restart Vite, open the app, and click **Continue with Google**. The app rejects this temporary owner configuration and displays the signed-in account's UID. You can also copy the UID from Firebase Console → Authentication → Users. Copy it into `VITE_OWNER_UID` in `.env.local`.
6. Set the UID in the `owner(uid)` function in **firestore.rules** to that exact UID (this repository already has its configured owner). The rules do not read frontend environment variables. Until this replacement, they deny all real users.
7. Deploy rules and indexes using the included Firebase CLI:

   ```sh
   npx firebase login
   npx firebase deploy --only firestore:rules,firestore:indexes --project YOUR_FIREBASE_PROJECT_ID
   ```

8. Wait for the Firestore indexes to finish building, restart Vite, and sign in again. Both the UI and database enforce the configured owner. An unauthorized Google account can authenticate but cannot read or write any app data.

Firebase web API keys and web configuration are **public identifiers**, not server secrets. Security comes from Firebase Authentication and the deployed Firestore rules. Never put service-account JSON, private keys, or Admin SDK credentials in this app or repository. The UID is not a secret, but must match in the build and rules.

Popup sign-in needs an internet connection and a user gesture. If the browser blocks the popup, allow it for this site and retry. The app uses popup sign-in to avoid cross-domain redirect storage problems on static hosting.

## Publish to GitHub Pages

1. Create a GitHub repository and push this folder to its `main` branch. This workspace is initially an ordinary folder; initialize Git if necessary. Do not commit `.env.local`, personal exports, or downloaded credentials.
2. In the repository, open Settings → Secrets and variables → Actions → **Variables**. Add all `VITE_FIREBASE_*` and `VITE_OWNER_UID` values from `.env.example`. The workflow reads repository **variables**, not secrets. Firebase's web configuration is public, so variables are appropriate.
3. Open Settings → Pages → Source and choose **GitHub Actions**.
4. Push to `main` or manually run **Verify and deploy Daymark**. The workflow installs from the lockfile, checks TypeScript, runs unit tests and emulator security tests, builds, and deploys the `dist` artifact.
5. Open `https://YOUR_USERNAME.github.io/YOUR_REPOSITORY/`. The workflow automatically sets `VITE_BASE_PATH` to `/YOUR_REPOSITORY/`; Vite asset paths, manifest scope/start URL, and service worker fallback all use it. Navigation uses `#/today`, `#/week`, etc., so a nested-view refresh works on Pages without server rewrites.
6. Ensure `YOUR_USERNAME.github.io` is in Firebase Authentication's authorized domains and the production rules and indexes are deployed.

For a custom domain or a `YOUR_USERNAME.github.io` root repository, change the workflow's `VITE_BASE_PATH` to `/`. For local tests of a project path, run `VITE_BASE_PATH=/YOUR_REPOSITORY/ npm run build`, then run `VITE_BASE_PATH=/YOUR_REPOSITORY/ npm run preview` and open that path.

The workflow does **not** deploy Firebase rules automatically: that requires your Firebase credentials and is a separate, explicit command. Publishing the frontend alone does not configure its database.

## Everyday use

- **Inbox:** unscheduled, undated active tasks. Capture quickly and plan later.
- **Today:** tasks due on the selected day, with active overdue tasks separated. Use the arrows to move between days.
- **Week / Month:** deadlines within the period or planning ranges that overlap it. A yearly intention can appear in shorter planning views without acquiring a deadline.
- **Year:** yearly goals plus tasks grouped by deadline month or planning month. Annual intentions without deadlines have their own group.
- **Completed / Trash:** history is loaded in increments of 30 records per collection. Search filters loaded history; load more to search further back. Recurring occurrence tombstones can be restored but cannot be permanently deleted, so the series does not regenerate them.
- Click a task to edit its notes, status, priority, category, due date, plan, linked goal, and up to 10 subtasks. Save explicitly. Closing a dirty task asks before discarding changes.
- Complete a task using its circle. Recent completion and deletion changes can be undone for 10 seconds. Trash keeps soft-deleted tasks indefinitely until you restore or permanently delete them.
- **Settings:** light/dark/system theme, IANA timezone, Monday/Sunday week start, account, series controls, and backups.

Date-only fields use validated `YYYY-MM-DD` strings and UTC calendar arithmetic; they never convert a deadline to a local timestamp. `Asia/Kolkata` and Monday are the defaults. The selected timezone determines “today.” Record creation, modification, completion, and deletion use millisecond timestamps.

## Data model

All records live under `users/{ownerUid}`:

| Collection / document | Purpose |
| --- | --- |
| `tasks/{id}` | One-off tasks, including completed and soft-deleted tasks |
| `goals/{id}` | Annual goals, category, and notes |
| `series/{id}` | Recurrence anchor, frequency, optional end date, and task template |
| `occurrences/{seriesId_YYYY-MM-DD}` | Individual occurrence edits, completion records, and deletion tombstones |
| `settings/preferences` | Theme, timezone, and week-start preference |

`dueDate` is independent from `planType`, `planStart`, and `planEnd`. Views query the same records; changing views never duplicates tasks. Goal progress counts completed linked one-off tasks, plus saved occurrence records in the selected year, excluding Trash. Unrecorded future recurring instances are not counted toward progress. Year view loads linked tasks for goal totals; the regular task list still filters by the selected period.

## Recurrence rules and limitations

Daily and weekly repetition follow the anchor calendar date. Monthly repeats clamp the anchor day to the last day of a shorter month, then return to the original day (January 31 → February 28/29 → March 31). A February 29 yearly repeat falls on February 28 in non-leap years and returns to February 29 in leap years.

The UI generates occurrences only for the selected day/week/month/year. It creates **no unlimited future documents**. The first edit, completion, or deletion writes an occurrence document whose ID is deterministic across devices. Completing an occurrence never completes its template or other occurrences.

Editing a recurring instance affects only that occurrence. Its visible due date may move while its identity remains tied to its original date. Saved occurrences remain available after a series ends. Ending a series keeps its end date inclusive and prevents generation afterward. There is no “edit all future occurrences” operation: end the old series and create a new one. A future-starting series ended before its start keeps its first occurrence; remove that occurrence individually to skip it.

Missed, unrecorded occurrences outside the selected period are not automatically backfilled into Today's overdue list. Open the original week/month/year to act on them. Saved overdue occurrence records do appear in Today. Deleted instances remain as tombstones; the UI and rules prohibit permanently deleting them.

## Offline behavior, synchronization, and conflicts

The shell renders without waiting for Firebase queries. Live listeners show locally available results while refreshing in the background. Task queries are limited to the selected range; small goal/series metadata collections are observed separately. Completed and Trash use bounded, increasing query limits; requesting another page re-subscribes with a larger limit. Listeners are removed on view changes and sign-out. Actions update local state immediately and write directly; they do not refetch the full collection.

Firestore uses its **full modular SDK**, `persistentLocalCache`, and `persistentMultipleTabManager`. Application files are precached by the PWA service worker. **Firestore handles task data caching; the service worker does not cache Firestore or Google authentication traffic.**

The status distinguishes Offline, Syncing, Synced, and Sync failed. Local write promises and snapshot pending-write metadata both prevent premature “Synced” status, including previously queued writes after reload. A cached-data banner explains that results may be incomplete. An empty cached query is not presented as proof that the server has no matching tasks. Rejected writes are displayed and the immediate optimistic change is rolled back; inspect the error, correct its cause, then retry the edit.

First sign-in, unvisited data, and full cloud backups need internet. Previously cached data can be read and edited offline with an existing authenticated session. Unsaved task-editor text is not a database write: save it before closing the tab. Persistent browser storage is checked before initialization; if unavailable the app uses memory caching and warns that the tab must stay open until edits synchronize. Browser eviction or quota limits can still affect storage: export backups regularly. The demo uses local storage and reports storage failures.

Firestore resolves simultaneous writes to the same field by **last write received by the backend**. Task edits update only changed fields, preserving concurrent edits to other fields. Arrays such as subtasks are a single field: concurrent array edits can overwrite one another. Client `updatedAt` timestamps are used for backup merge ordering, not as a substitute for server conflict resolution; keep device clocks correct. There is no CRDT or version history.

Signing out immediately hides tasks and discards the in-memory view. The owner check prevents a different authenticated user from reading the previous user's cache. Firestore's disk cache is not encrypted by the app; on a shared device, use **Sign out & clear device cache**. Pending edits block sign-out/cache removal. Close other Daymark tabs before clearing because the multi-tab cache cannot be cleared while another tab uses it. If clearing fails, the account is still signed out; close all app tabs and clear site data through the browser if needed.

Reference: [Firebase offline persistence and last-write-wins behavior](https://firebase.google.com/docs/firestore/manage-data/enable-offline).

## Backups and recovery

Settings → **Export full JSON backup** downloads schema version 1 with all tasks (including Trash), goals, series, saved occurrences, and settings. Cloud export reads complete server collections and requires connectivity and no pending writes; it does not silently export a partial cached view. Very large personal datasets may need a dedicated export strategy because this operation intentionally loads all records.

Choose a JSON file to validate it and see an **added / updated / skipped** preview before merging. Validation checks field allowlists, types, text lengths, valid dates, IDs, and duplicate records, with a 20 MB file limit. Records are matched by ID; existing records not mentioned in the file are retained, and matching IDs update only when the imported `updatedAt` is newer. Current settings stay intact unless you explicitly restore backup preferences. Reimporting the same file does not create duplicates.

Cloud imports write batches of up to 400 records. They are not globally atomic; a later failed batch may leave earlier batches imported. The error is shown, and retrying is safe because IDs and timestamps are stable. Avoid simultaneous editing from another device during an import; the preview is not a lock on remote changes. “Newer wins” may intentionally restore an imported completion or deletion state; inspect the preview and keep a fresh export before merging.

CSV export includes one-off tasks and saved occurrences. It quotes fields and neutralizes spreadsheet formula prefixes. It is for reading/spreadsheets, not lossless restoration. Synchronization is **not** a backup; keep JSON exports in private storage outside this repository.

## PWA installation and updates

Visit the HTTPS production site online once. On desktop, use the browser's Install action if offered. On iPhone/iPad, use Safari → Share → Add to Home Screen. Android Chrome exposes Install/Add to Home screen in its menu. Install availability depends on the browser.

The manifest includes 192 px and 512 px PNG icons, standalone display, and matching scope/start URL. Updates show a non-disruptive prompt. The Update button remains disabled while the task editor has a draft or writes are pending; Later keeps the current version. Open dialogs and unsaved settings forms also block updates until you save or close them. [Vite PWA registration documentation](https://vite-pwa-org.netlify.app/guide/register-service-worker) explains the prompt lifecycle.

No scheduled notifications are promised while the app is closed. Background reminders and calendar integrations are future enhancements.

## Checks

See [VALIDATION.md](VALIDATION.md) for the actual local verification results and checks still requiring your account or devices.

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:rules
```

Browser tests use an installed Google Chrome and launch a production preview server on port 4173. To use a Playwright-managed Chromium instead, install it with `npx playwright install chromium` and remove `channel: 'chrome'` from `playwright.config.ts`. Security tests require **Java 21+** and download the Firestore emulator on first run. They use `demo-daymark`, substitute the configured owner clause in memory with `test-owner`, and never access your production database. CI installs Java 21 and runs these tests before deployment.

`tests/core.test.ts` covers calendar and timezone boundaries, recurrence, month-end/leap years, independent completion, import validation, duplicate prevention, merge behavior, and CSV escaping. `tests/firestore.test.ts` checks owner CRUD, rejection of anonymous/other-user access, cross-user paths, field validation, and occurrence tombstones. `tests/browser/app.spec.ts` checks desktop/mobile task flows, details, undo, Trash restoration, nested-route reload, JSON reimport, themes, and service-worker offline shell reload.

Real Google authentication, actual two-device sync, offline Firestore write/reload/reconnect, and home-screen installation on physical devices require your configured Firebase project/devices. Do not treat demo browser tests as proof of those cloud/device flows. After setup, create a task on desktop, open the same account on mobile, edit offline, reload, reconnect, and confirm the pending status resolves to Synced and both devices converge. Also test denied rules with a different account and refresh `#/week` on the actual Pages URL.

## Source map

```text
src/
  App.tsx / App.module.scss     Responsive shell, navigation, task views
  components/                  Task rows/editor and PWA update prompt
  context/Store.tsx             React state, auth gating, optimistic writes
  lib/model.ts                 Shared typed data model
  lib/dates.ts                 Calendar/date-only utilities
  lib/recurrence.ts            Deterministic occurrence expansion
  lib/backup.ts                Validation, merge, JSON/CSV helpers
  lib/firebase.ts              Modular Firebase access and live queries
  lib/demo.ts                  Separate local sample data
  views/                       Lazy-loaded goals and settings
public/                        App icons
tests/                         Core, rules, and browser tests
firestore.rules                Deny-by-default owner-only validation
firestore.indexes.json         Range and history indexes
.github/workflows/deploy.yml   Verification and GitHub Pages publication
```
