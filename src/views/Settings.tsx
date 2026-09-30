import { useState } from "react";
import {
  Download,
  Upload,
  LogOut,
  ShieldCheck,
  HardDrive,
  Repeat2,
} from "lucide-react";
import { useStore } from "../context/Store";
import {
  parseBackup,
  download,
  taskCSV,
  importPreview,
  type Backup,
} from "../lib/backup";
import { clearDeviceCache } from "../lib/firebase";
import type { Settings } from "../lib/model";
import { today } from "../lib/dates";
import s from "../App.module.scss";
export default function SettingsView() {
  const store = useStore(),
    [timezone, setTimezone] = useState(store.data.settings.timezone),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [incoming, setIncoming] = useState<Backup | null>(null),
    [preview, setPreview] = useState<ReturnType<typeof importPreview> | null>(
      null,
    );
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const set = (patch: Partial<Settings>) =>
    store.preferences({ ...store.data.settings, ...patch });
  return (
    <div className={s.settingsGrid}>
      <section className={s.settingsCard}>
        <h2>A space that feels like you</h2>
        <p>Small preferences for your everyday rhythm.</p>
        <label>
          Appearance
          <select
            value={store.data.settings.theme}
            onChange={(e) =>
              set({ theme: e.target.value as Settings["theme"] })
            }
          >
            <option value="system">Follow system</option>
            <option value="light">Light & airy</option>
            <option value="dark">Calm after dark</option>
          </select>
        </label>
        <label>
          Week starts on
          <select
            value={store.data.settings.weekStart}
            onChange={(e) =>
              set({ weekStart: Number(e.target.value) as 0 | 1 })
            }
          >
            <option value={1}>Monday</option>
            <option value={0}>Sunday</option>
          </select>
        </label>
        <form
          data-unsaved={timezone !== store.data.settings.timezone}
          onSubmit={(e) => {
            e.preventDefault();
            try {
              new Intl.DateTimeFormat("en", { timeZone: timezone });
              set({ timezone });
              setError("");
              store.notify("Timezone updated. Calendar dates stay the same.");
            } catch {
              setError(
                "Use a valid IANA timezone, for example Asia/Kolkata or America/New_York.",
              );
            }
          }}
        >
          <label>
            Timezone
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              list="timezones"
              maxLength={100}
            />
            <datalist id="timezones">
              {[
                "Asia/Kolkata",
                "UTC",
                "Europe/London",
                "Europe/Paris",
                "America/New_York",
                "America/Los_Angeles",
                "Asia/Tokyo",
                "Australia/Sydney",
              ].map((z) => (
                <option key={z}>{z}</option>
              ))}
            </datalist>
          </label>
          <button className={s.secondary}>Save timezone</button>
        </form>
        <p className={s.muted}>
          Dates are stored as calendar dates. Changing your timezone changes
          what “today” means, never your deadlines.
        </p>
      </section>
      <section className={s.settingsCard}>
        <h2>
          <HardDrive size={19} /> Keep a copy of your progress
        </h2>
        <p>
          Sync keeps devices together. A backup keeps your history safe. Store
          exports somewhere private, outside your repository.
        </p>
        <div className={s.backupButtons}>
          <button
            disabled={busy}
            className={s.secondary}
            onClick={() =>
              void run(async () => {
                const data = await store.full();
                download(
                  `daymark-backup-${today()}.json`,
                  JSON.stringify(
                    {
                      ...data,
                      schemaVersion: 1,
                      exportedAt: new Date().toISOString(),
                    },
                    null,
                    2,
                  ),
                );
              })
            }
          >
            <Download size={16} />
            Export full JSON backup
          </button>
          <button
            disabled={busy}
            className={s.secondary}
            onClick={() =>
              void run(async () => {
                const data = await store.full();
                download(
                  `daymark-tasks-${today()}.csv`,
                  taskCSV([...data.tasks, ...data.occurrences]),
                  "text/csv;charset=utf-8",
                );
              })
            }
          >
            <Download size={16} />
            Export tasks as CSV
          </button>
          <label className={s.fileButton}>
            <Upload size={16} />
            Choose JSON backup
            <input
              aria-label="Import JSON backup"
              type="file"
              accept="application/json,.json"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  void run(async () => {
                    setIncoming(null);
                    setPreview(null);
                    if (file.size > 20_000_000)
                      throw new Error("Maximum backup size is 20 MB.");
                    const b = parseBackup(await file.text());
                    const current = await store.full();
                    setIncoming(b);
                    setPreview(importPreview(current, b));
                  });
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {preview && incoming && (
          <div className={s.importPreview} data-unsaved="true">
            <strong>Ready to merge</strong>
            <p>
              {preview.added} added · {preview.updated} updated ·{" "}
              {preview.skipped} skipped
            </p>
            <p>
              Only newer records replace matching IDs. Other records and your
              current settings are kept.
            </p>
            <button
              disabled={busy}
              className={s.primary}
              onClick={() =>
                void run(async () => {
                  await store.importData(incoming);
                  setIncoming(null);
                  setPreview(null);
                })
              }
            >
              Merge backup
            </button>
            <button
              className={s.textButton}
              onClick={() => {
                setIncoming(null);
                setPreview(null);
              }}
            >
              Cancel
            </button>
            <button
              className={s.textButton}
              onClick={() => {
                store.preferences(incoming.settings);
                store.notify("Backup preferences restored.");
              }}
            >
              Restore backup preferences separately
            </button>
          </div>
        )}
        {busy && <p role="status">Working on your backup…</p>}
        <p className={s.muted}>
          Cloud export and import require a connection and synchronized edits,
          so your backup includes every record.
        </p>
      </section>
      <section className={s.settingsCard}>
        <h2>
          <ShieldCheck size={19} /> Your personal account
        </h2>
        <p>
          {store.mode === "demo"
            ? "You’re exploring a local demo. It is separate from your Firebase data."
            : store.user?.email}
        </p>
        {store.user && <p className={s.uid}>Firebase UID: {store.user.uid}</p>}
        <button className={s.secondary} onClick={() => void store.exit()}>
          <LogOut size={16} />
          {store.mode === "demo" ? "Leave demo" : "Sign out"}
        </button>
        {store.mode === "cloud" && (
          <>
            <p className={s.muted}>
              Tasks are hidden immediately when you sign out. On shared devices,
              clear the local cache too. Close other Daymark tabs before
              clearing.
            </p>
            <button
              className={s.textButton}
              disabled={busy || store.pending > 0}
              onClick={() => {
                if (
                  confirm(
                    "Sign out and clear the task cache on this device? Export a backup first if needed.",
                  )
                )
                  void run(async () => {
                    if (store.pending)
                      throw new Error("Pending edits must synchronize first.");
                    await store.exit();
                    try {
                      await clearDeviceCache();
                      location.reload();
                    } catch {
                      throw new Error(
                        "Close all other Daymark tabs, reload, and try again. The browser could not clear the local cache.",
                      );
                    }
                  });
              }}
            >
              Sign out & clear device cache
            </button>
          </>
        )}
      </section>
      <section className={s.settingsCard}>
        <h2>
          <Repeat2 size={19} /> Your recurring rhythms
        </h2>
        <p>
          Month-end dates clamp to the last day of shorter months, then return
          to the original date. February 29 repeats on February 28 in non-leap
          years.
        </p>
        {store.data.series.map((series) => (
          <div className={s.seriesRow} key={series.id}>
            <div>
              <strong>{series.template.title}</strong>
              <small>
                {series.frequency} ·{" "}
                {series.endDate ? `Ends ${series.endDate}` : "Ongoing"}
              </small>
            </div>
            {!series.endDate && (
              <button
                className={s.secondary}
                onClick={() => {
                  if (confirm("End future occurrences after today?"))
                    store.put("series", {
                      ...series,
                      endDate:
                        today(store.data.settings.timezone) < series.startDate
                          ? series.startDate
                          : today(store.data.settings.timezone),
                      updatedAt: Date.now(),
                    });
                }}
              >
                End series
              </button>
            )}
          </div>
        ))}
        {!store.data.series.length && (
          <p className={s.muted}>
            Set “Repeat” when creating or editing a task to begin a rhythm.
          </p>
        )}
        <p className={s.muted}>
          Unrecorded recurring occurrences are generated for the selected
          period. Missed dates outside that period are not added to Today. Open
          the original period to complete them.
        </p>
      </section>
      {error && (
        <div role="alert" className={s.error}>
          {error}
        </div>
      )}
    </div>
  );
}
