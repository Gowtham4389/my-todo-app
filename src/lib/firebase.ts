import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  and,
  orderBy,
  limit,
  getDocsFromServer,
  getDocFromServer,
  writeBatch,
  waitForPendingWrites,
  terminate,
  clearIndexedDbPersistence,
  type QueryConstraint,
  type QueryCompositeFilterConstraint,
  type QueryFilterConstraint,
  type QueryNonFilterConstraint,
  type Firestore,
  type DocumentData,
} from "firebase/firestore";
import type {
  Collection,
  Settings,
  View,
  Snapshot,
  Task,
  Series,
} from "./model";
import { period } from "./dates";
import type { Backup } from "./backup";
const env = import.meta.env;
export const owner = env.VITE_OWNER_UID as string | undefined;
export const configured = !!(
  env.VITE_FIREBASE_API_KEY &&
  env.VITE_FIREBASE_PROJECT_ID &&
  env.VITE_FIREBASE_AUTH_DOMAIN &&
  env.VITE_FIREBASE_APP_ID &&
  owner
);
export const app = configured
  ? initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
      storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    })
  : null;
export const auth = app ? getAuth(app) : null;
let database: Promise<Firestore> | null = null;
export let persistenceWarning = "";
async function storageAvailable() {
  try {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open("daymark-storage-check");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        request.result.close();
        indexedDB.deleteDatabase("daymark-storage-check");
        resolve();
      };
    });
    return true;
  } catch {
    return false;
  }
}
export function getDb() {
  if (!app) throw new Error("Firebase is not configured.");
  return (database ??= storageAvailable().then((ok) => {
    if (!ok)
      persistenceWarning =
        "Persistent storage is unavailable. Keep this tab open until changes synchronize.";
    return initializeFirestore(app!, {
      localCache: ok
        ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        : memoryLocalCache(),
    });
  }));
}
export const login = () => signInWithPopup(auth!, new GoogleAuthProvider());
export const logout = () => signOut(auth!);
export async function listenData(
  uid: string,
  view: View,
  date: string,
  settings: Settings,
  count: number,
  onData: (
    key: string,
    rows: DocumentData[],
    cached: boolean,
    pending: boolean,
  ) => void,
  onError: (error: Error) => void,
) {
  const db = await getDb();
  const cleanups: (() => void)[] = [];
  const listen = (
    key: string,
    path: string,
    constraints: (QueryConstraint | QueryCompositeFilterConstraint)[] = [],
  ) => {
    const filters = constraints.filter((c) =>
      ["where", "and", "or"].includes(c.type),
    ) as QueryFilterConstraint[];
    const rest = constraints.filter(
      (c) => !["where", "and", "or"].includes(c.type),
    ) as QueryNonFilterConstraint[];
    onData(key, [], true, false);
    const base = collection(db, `users/${uid}/${path}`);
    const q = filters.length
      ? query(base, and(...filters), ...rest)
      : query(base, ...rest);
    cleanups.push(
      onSnapshot(
        q,
        { includeMetadataChanges: true },
        (snapshot) =>
          onData(
            key,
            snapshot.docs.map((d) => ({ ...d.data(), id: d.id })),
            snapshot.metadata.fromCache,
            snapshot.metadata.hasPendingWrites,
          ),
        onError,
      ),
    );
  };
  const range = period(
    date,
    ["week", "month", "year"].includes(view)
      ? (view as "week" | "month" | "year")
      : "today",
    settings.weekStart,
  );
  let filters: (QueryConstraint | QueryCompositeFilterConstraint)[];
  if (view === "trash")
    filters = [
      where("deletedAt", "!=", null),
      orderBy("deletedAt", "desc"),
      limit(count),
    ];
  else if (view === "completed")
    filters = [
      where("deletedAt", "==", null),
      where("status", "==", "done"),
      orderBy("completedAt", "desc"),
      limit(count),
    ];
  else if (view === "inbox")
    filters = [
      where("deletedAt", "==", null),
      where("dueDate", "==", null),
      where("planType", "==", null),
      where("status", "in", ["todo", "progress"]),
    ];
  else if (view === "today")
    filters = [where("deletedAt", "==", null), where("dueDate", "==", date)];
  else
    filters = [
      where("deletedAt", "==", null),
      where("dueDate", ">=", range[0]),
      where("dueDate", "<=", range[1]),
      orderBy("dueDate"),
    ];
  if (view !== "settings") listen("tasks", "tasks", filters);
  if (view === "today") {
    const overdue = [
      where("deletedAt", "==", null),
      where("dueDate", "<", date),
      where("status", "in", ["todo", "progress"]),
      orderBy("dueDate"),
    ];
    listen("overdueTasks", "tasks", overdue);
    listen("overdueOccurrences", "occurrences", overdue);
  }
  if (["week", "month", "year"].includes(view))
    listen("plannedTasks", "tasks", [
      where("deletedAt", "==", null),
      where("planStart", "<=", range[1]),
      where("planEnd", ">=", range[0]),
      orderBy("planStart"),
      orderBy("planEnd"),
    ]);
  if (view === "completed" || view === "trash")
    listen("occurrences", "occurrences", filters);
  else if (view !== "settings")
    listen("occurrences", "occurrences", [
      where("occurrenceDate", ">=", range[0]),
      where("occurrenceDate", "<=", range[1]),
    ]);
  if (view === "today") listen("movedOccurrences", "occurrences", filters);
  if (
    view !== "today" &&
    view !== "settings" &&
    view !== "completed" &&
    view !== "trash" &&
    view !== "inbox"
  )
    listen("movedOccurrences", "occurrences", [
      where("dueDate", ">=", range[0]),
      where("dueDate", "<=", range[1]),
    ]);
  listen("goals", "goals");
  listen("series", "series");
  if (view === "year")
    listen("linkedTasks", "tasks", [where("goalId", "!=", null)]);
  cleanups.push(
    onSnapshot(
      doc(db, `users/${uid}/settings/preferences`),
      { includeMetadataChanges: true },
      (s) =>
        onData(
          "settings",
          s.exists() ? [s.data()] : [],
          s.metadata.fromCache,
          s.metadata.hasPendingWrites,
        ),
      onError,
    ),
  );
  return () => cleanups.forEach((fn) => fn());
}
export async function writeRecord(
  uid: string,
  key: Collection,
  id: string,
  value: DocumentData,
  existing: boolean,
) {
  const ref = doc(await getDb(), `users/${uid}/${key}/${id}`);
  return existing ? updateDoc(ref, value) : setDoc(ref, value);
}
export async function removeRecord(uid: string, key: Collection, id: string) {
  return deleteDoc(doc(await getDb(), `users/${uid}/${key}/${id}`));
}
export async function savePreferences(uid: string, value: Settings) {
  return setDoc(
    doc(await getDb(), `users/${uid}/settings/preferences`),
    value,
    { merge: true },
  );
}
export async function fullSnapshot(
  uid: string,
  settings: Settings,
): Promise<Snapshot> {
  const db = await getDb();
  const result = { settings } as Snapshot;
  await Promise.all(
    (["tasks", "occurrences", "goals", "series"] as const).map(async (key) => {
      const snap = await getDocsFromServer(
        collection(db, `users/${uid}/${key}`),
      );
      Object.assign(result, {
        [key]: snap.docs.map((d) => ({ ...d.data(), id: d.id })),
      });
    }),
  );
  const prefs = await getDocFromServer(
    doc(db, `users/${uid}/settings/preferences`),
  );
  if (prefs.exists()) result.settings = prefs.data() as Settings;
  return result;
}
export async function importRecords(
  uid: string,
  existing: Snapshot,
  incoming: Backup,
) {
  const db = await getDb();
  let batch = writeBatch(db),
    size = 0;
  for (const key of ["tasks", "occurrences", "goals", "series"] as const) {
    const times = new Map(existing[key].map((x) => [x.id, x.updatedAt]));
    for (const row of incoming[key]) {
      const time = times.get(row.id);
      if (time !== undefined && time >= row.updatedAt) continue;
      batch.set(doc(db, `users/${uid}/${key}/${row.id}`), row, { merge: true });
      size++;
      if (size === 400) {
        await batch.commit();
        batch = writeBatch(db);
        size = 0;
      }
    }
  }
  if (size) await batch.commit();
}
export async function clearDeviceCache() {
  const db = await getDb();
  await terminate(db);
  await clearIndexedDbPersistence(db);
}

export async function flushPending() {
  await waitForPendingWrites(await getDb());
}
export async function beginSeries(
  uid: string,
  series: Series,
  source: Task | null,
) {
  const db = await getDb();
  const batch = writeBatch(db);
  batch.set(doc(db, `users/${uid}/series/${series.id}`), series);
  if (source)
    batch.update(doc(db, `users/${uid}/tasks/${source.id}`), {
      deletedAt: series.updatedAt,
      updatedAt: series.updatedAt,
    });
  await batch.commit();
}
