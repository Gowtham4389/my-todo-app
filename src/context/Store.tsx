import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  auth,
  owner,
  listenData,
  writeRecord,
  removeRecord,
  savePreferences,
  logout,
  persistenceWarning,
  fullSnapshot,
  importRecords,
  flushPending,
  beginSeries,
} from "../lib/firebase";
import {
  blankSnapshot,
  makeTask,
  purgeOccurrence,
  type Task,
  type Collection,
  type Snapshot,
  type Settings,
  type View,
  type Goal,
  type Series,
} from "../lib/model";
import { demoData } from "../lib/demo";
import {
  mergeBackup,
  parseBackup,
  validSettings,
  type Backup,
} from "../lib/backup";
interface Store {
  data: Snapshot;
  user: User | null;
  ready: boolean;
  mode: "setup" | "demo" | "cloud";
  state: string;
  cached: boolean;
  error: string;
  notice: string;
  pending: number;
  enterDemo: () => void;
  exit: () => Promise<void>;
  patch: (task: Task, fields: Partial<Task>) => void;
  put: (key: Collection, row: Task | Goal | Series) => void;
  remove: (task: Task) => void;
  preferences: (s: Settings) => void;
  undo: () => void;
  canUndo: boolean;
  full: () => Promise<Snapshot>;
  importData: (b: Backup) => Promise<void>;
  repeat: (series: Series, source: Task | null) => void;
  clearError: () => void;
  notify: (s: string) => void;
}
const Context = createContext<Store>(null!);
export const useStore = () => useContext(Context);
const demoKey = "daymark-demo-v1";
export function Provider({
  children,
  view,
  date,
  count,
}: {
  children: ReactNode;
  view: View;
  date: string;
  count: number;
}) {
  const [data, setData] = useState<Snapshot>(blankSnapshot),
    [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(!auth),
    [demo, setDemo] = useState(false),
    [cached, setCached] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [pending, setPending] = useState(0),
    [remotePending, setRemotePending] = useState(false),
    [recoveringQueue, setRecoveringQueue] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [undoItem, setUndoItem] = useState<{
      task: Task;
      fields: Partial<Task>;
    } | null>(null);
  useEffect(() => {
    if (!undoItem) return;
    const timer = setTimeout(() => setUndoItem(null), 10000);
    return () => clearTimeout(timer);
  }, [undoItem]);
  const dataRef = useRef(data);
  dataRef.current = data;
  const mode = demo
    ? "demo"
    : user && owner && user.uid === owner
      ? "cloud"
      : "setup";
  const generation = useRef(0);
  useEffect(() => {
    if (mode !== "cloud") {
      setRecoveringQueue(false);
      return;
    }
    let cancelled = false;
    setRecoveringQueue(true);
    void flushPending()
      .then(() => {
        if (!cancelled) setRecoveringQueue(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setRecoveringQueue(false);
          setError(String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mode, user?.uid]);
  useEffect(
    () =>
      auth
        ? onAuthStateChanged(auth, (u) => {
            generation.current++;
            setData(blankSnapshot());
            setDemo(false);
            setUser(u);
            setReady(true);
            setUndoItem(null);
            setRemotePending(false);
            setError(
              u && u.uid !== owner
                ? "This Google account is not the configured owner. Your UID: " +
                    u.uid
                : "",
            );
          })
        : undefined,
    [],
  );
  useEffect(() => {
    const handle = () => setOnline(navigator.onLine);
    addEventListener("online", handle);
    addEventListener("offline", handle);
    return () => {
      removeEventListener("online", handle);
      removeEventListener("offline", handle);
    };
  }, []);
  useEffect(() => {
    if (mode !== "cloud" || !user) return;
    let cancelled = false,
      unsubscribe: (() => void) | undefined;
    setCached(true);
    setData((d) => ({ ...d, tasks: [], occurrences: [] }));
    const metadata = new Map<string, boolean>();
    const pendingMetadata = new Map<string, boolean>();
    const slices: Record<string, unknown[]> = {};
    listenData(
      user.uid,
      view,
      date,
      dataRef.current.settings,
      count,
      (key, rows, fromCache, hasPending) => {
        if (cancelled) return;
        metadata.set(key, fromCache);
        pendingMetadata.set(key, hasPending);
        setRemotePending([...pendingMetadata.values()].some(Boolean));
        setCached([...metadata.values()].some(Boolean));
        slices[key] = rows;
        setData((old) => {
          const next = { ...old };
          if (key === "settings") {
            if (validSettings(rows[0])) next.settings = rows[0];
          } else if (
            ["tasks", "linkedTasks", "overdueTasks", "plannedTasks"].includes(
              key,
            )
          ) {
            next.tasks = [
              ...new Map(
                [
                  ...(slices.tasks || []),
                  ...(slices.linkedTasks || []),
                  ...(slices.overdueTasks || []),
                  ...(slices.plannedTasks || []),
                ].map((r) => [(r as Task).id, r as Task]),
              ).values(),
            ];
          } else if (
            ["occurrences", "movedOccurrences", "overdueOccurrences"].includes(
              key,
            )
          ) {
            next.occurrences = [
              ...new Map(
                [
                  ...(slices.occurrences || []),
                  ...(slices.movedOccurrences || []),
                  ...(slices.overdueOccurrences || []),
                ].map((r) => [(r as Task).id, r as Task]),
              ).values(),
            ];
          } else Object.assign(next, { [key]: rows });
          return next;
        });
        if (persistenceWarning) setNotice(persistenceWarning);
      },
      (e) => {
        if (!cancelled) setError(e.message);
      },
    )
      .then((fn) => {
        if (cancelled) fn();
        else unsubscribe = fn;
      })
      .catch((e) => setError(String(e)));
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [mode, user, view, date, count, data.settings.weekStart]);
  useEffect(() => {
    const s = data.settings;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        s.theme === "system" ? (media.matches ? "dark" : "light") : s.theme);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [data.settings]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending || remotePending || recoveringQueue) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [pending, remotePending, recoveringQueue]);
  const persistDemo = (next: Snapshot) => {
    try {
      localStorage.setItem(
        demoKey,
        JSON.stringify({
          ...next,
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
        }),
      );
    } catch {
      setError(
        "Could not save demo data on this device. Export a backup before closing this tab.",
      );
    }
  };
  const run = useCallback(
    (action: () => Promise<unknown>, rollback?: () => void) => {
      setPending((n) => n + 1);
      const g = generation.current;
      void action()
        .catch((e) => {
          if (g === generation.current) {
            rollback?.();
            setError(
              "Sync failed: " + (e instanceof Error ? e.message : String(e)),
            );
          }
        })
        .finally(() => setPending((n) => Math.max(0, n - 1)));
    },
    [],
  );
  const put = (
    key: Collection,
    row: Task | Goal | Series,
    fields?: Record<string, unknown>,
  ) => {
    const old = dataRef.current;
    const previous = old[key].find((x) => x.id === row.id);
    if (previous && "purgedAt" in previous) return;
    const next = {
      ...old,
      [key]: [...old[key].filter((x) => x.id !== row.id), row],
    };
    dataRef.current = next;
    setData(next);
    if (mode === "demo") persistDemo(next);
    else if (mode === "cloud" && user)
      run(
        () =>
          writeRecord(
            user.uid,
            key,
            row.id,
            fields && previous ? fields : row,
            !!previous,
          ),
        () =>
          setData((d) => ({
            ...d,
            [key]: previous
              ? d[key].map((x) => (x.id === row.id ? previous : x))
              : d[key].filter((x) => x.id !== row.id),
          })),
      );
  };
  const patch = (task: Task, fields: Partial<Task>) => {
    const changed = { ...fields, updatedAt: Date.now() };
    if ("deletedAt" in fields || "completedAt" in fields) {
      const before: Partial<Task> = {};
      for (const key of Object.keys(fields) as (keyof Task)[])
        Object.assign(before, { [key]: task[key] });
      setUndoItem({ task: { ...task, ...changed }, fields: before });
    }
    put(
      task.seriesId ? "occurrences" : "tasks",
      { ...task, ...changed },
      changed,
    );
  };
  const enterDemo = () => {
    generation.current++;
    let initial = demoData();
    try {
      const raw = localStorage.getItem(demoKey);
      if (raw) initial = parseBackup(raw);
    } catch {
      setNotice("The saved demo could not be read. A fresh demo is ready.");
    }
    setData(initial);
    setDemo(true);
    setCached(false);
    setError("");
  };
  const exit = async () => {
    if (pending || remotePending || recoveringQueue) {
      setError(
        "Wait for pending edits to synchronize before signing out. Reconnect to the internet if needed.",
      );
      return;
    }
    generation.current++;
    setData(blankSnapshot());
    setUndoItem(null);
    setDemo(false);
    if (auth) await logout();
  };
  const full = async () => {
    if (mode === "demo") return dataRef.current;
    if (!online)
      throw new Error(
        "Connect to the internet for a complete backup or import preview.",
      );
    if (pending || remotePending || recoveringQueue)
      throw new Error("Wait for pending edits to synchronize first.");
    return fullSnapshot(user!.uid, dataRef.current.settings);
  };
  const importData = async (b: Backup) => {
    const current = await full();
    if (mode === "demo") {
      const merged = mergeBackup(current, b);
      setData(merged);
      persistDemo(merged);
    } else {
      setPending((n) => n + 1);
      try {
        await importRecords(user!.uid, current, b);
      } finally {
        setPending((n) => n - 1);
      }
    }
    setNotice("Backup merged. Existing settings were preserved.");
  };
  const repeat = (series: Series, source: Task | null) => {
    const previous = dataRef.current;
    const next = {
      ...previous,
      series: [...previous.series, series],
      tasks: previous.tasks.map((t) =>
        source?.id === t.id
          ? { ...t, deletedAt: series.updatedAt, updatedAt: series.updatedAt }
          : t,
      ),
    };
    dataRef.current = next;
    setData(next);
    if (mode === "demo") persistDemo(next);
    else
      run(
        () => beginSeries(user!.uid, series, source),
        () =>
          setData((d) => ({
            ...d,
            series: d.series.filter((x) => x.id !== series.id),
            tasks: d.tasks.map((t) => (source?.id === t.id ? source : t)),
          })),
      );
  };
  const remove = (task: Task) => {
    setUndoItem((item) => (item?.task.id === task.id ? null : item));
    if (task.seriesId) {
      put("occurrences", purgeOccurrence(task));
      return;
    }
    const next = {
      ...dataRef.current,
      tasks: dataRef.current.tasks.filter((t) => t.id !== task.id),
    };
    dataRef.current = next;
    setData(next);
    if (mode === "demo") persistDemo(next);
    else
      run(
        () => removeRecord(user!.uid, "tasks", task.id),
        () =>
          setData((d) => ({
            ...d,
            tasks: [...d.tasks.filter((t) => t.id !== task.id), task],
          })),
      );
  };
  const preferences = (settings: Settings) => {
    const old = dataRef.current.settings;
    setData((d) => ({ ...d, settings }));
    if (mode === "demo") persistDemo({ ...dataRef.current, settings });
    else
      run(
        () => savePreferences(user!.uid, settings),
        () => setData((d) => ({ ...d, settings: old })),
      );
  };
  return (
    <Context.Provider
      value={{
        data,
        user,
        ready,
        mode,
        cached,
        error,
        notice,
        pending: pending + (remotePending || recoveringQueue ? 1 : 0),
        state:
          mode === "demo"
            ? "Saved on this device"
            : error
              ? "Sync failed"
              : !online
                ? "Offline"
                : pending || remotePending || recoveringQueue
                  ? "Syncing"
                  : cached
                    ? "Loading cached data"
                    : "Synced",
        enterDemo,
        exit,
        patch,
        put,
        remove,
        preferences,
        undo: () => {
          if (undoItem) {
            patch(undoItem.task, undoItem.fields);
            setUndoItem(null);
          }
        },
        canUndo: !!undoItem,
        full,
        importData,
        repeat,
        clearError: () => setError(""),
        notify: setNotice,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export { makeTask };
