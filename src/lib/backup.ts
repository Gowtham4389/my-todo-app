import { validDate } from "./dates";
import {
  categories,
  shouldImportRecord,
  type Snapshot,
  type Task,
  type Goal,
  type Series,
  type Settings,
} from "./model";
export interface Backup extends Snapshot {
  schemaVersion: 1;
  exportedAt: string;
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number) =>
  typeof v === "string" && v.length <= max;
const id = (v: unknown) =>
  typeof v === "string" && /^[a-zA-Z0-9_-]{1,180}$/.test(v);
const date = (v: unknown) => v === null || validDate(v);
const timestamp = (v: unknown) =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
function keys(v: Record<string, unknown>, allowed: string[]) {
  return (
    Object.keys(v).length === allowed.length &&
    Object.keys(v).every((k) => allowed.includes(k))
  );
}
export function validTask(v: unknown): v is Task {
  if (
    !object(v) ||
    !keys(v, [
      "id",
      "title",
      "notes",
      "status",
      "priority",
      "category",
      "dueDate",
      "planType",
      "planStart",
      "planEnd",
      "goalId",
      "subtasks",
      "createdAt",
      "updatedAt",
      "completedAt",
      "deletedAt",
      "seriesId",
      "occurrenceDate",
      ...("purgedAt" in v ? ["purgedAt"] : []),
    ])
  )
    return false;
  return (
    (!("purgedAt" in v) ||
      (timestamp(v.purgedAt) &&
        v.seriesId !== null &&
        v.deletedAt === v.purgedAt &&
        v.title === "Deleted occurrence" &&
        v.notes === "" &&
        v.status === "todo" &&
        v.priority === "none" &&
        v.category === "Personal" &&
        v.dueDate === null &&
        v.planType === null &&
        v.goalId === null &&
        v.completedAt === null &&
        Array.isArray(v.subtasks) &&
        v.subtasks.length === 0)) &&
    id(v.id) &&
    text(v.title, 300) &&
    (v.title as string).trim().length > 0 &&
    text(v.notes, 20000) &&
    ["todo", "progress", "done"].includes(v.status as string) &&
    ["none", "low", "medium", "high"].includes(v.priority as string) &&
    categories.includes(v.category as never) &&
    date(v.dueDate) &&
    date(v.planStart) &&
    date(v.planEnd) &&
    [null, "week", "month", "year"].includes(v.planType as never) &&
    ((v.planType === null && v.planStart === null && v.planEnd === null) ||
      (v.planType !== null &&
        validDate(v.planStart) &&
        validDate(v.planEnd) &&
        v.planStart <= v.planEnd)) &&
    (v.goalId === null || id(v.goalId)) &&
    timestamp(v.createdAt) &&
    timestamp(v.updatedAt) &&
    (v.completedAt === null || timestamp(v.completedAt)) &&
    (v.deletedAt === null || timestamp(v.deletedAt)) &&
    (v.seriesId === null || id(v.seriesId)) &&
    date(v.occurrenceDate) &&
    ((v.seriesId === null && v.occurrenceDate === null) ||
      (id(v.seriesId) &&
        validDate(v.occurrenceDate) &&
        v.id === `${v.seriesId}_${v.occurrenceDate}`)) &&
    Array.isArray(v.subtasks) &&
    v.subtasks.length <= 10 &&
    v.subtasks.every(
      (s) =>
        object(s) &&
        keys(s, ["id", "title", "done"]) &&
        id(s.id) &&
        text(s.title, 300) &&
        typeof s.done === "boolean",
    ) &&
    new Set(v.subtasks.map((s) => s.id)).size === v.subtasks.length
  );
}
export function validGoal(v: unknown): v is Goal {
  return (
    object(v) &&
    keys(v, [
      "id",
      "title",
      "notes",
      "year",
      "category",
      "createdAt",
      "updatedAt",
    ]) &&
    id(v.id) &&
    text(v.title, 300) &&
    (v.title as string).trim().length > 0 &&
    text(v.notes, 20000) &&
    Number.isInteger(v.year) &&
    Number(v.year) >= 1900 &&
    Number(v.year) <= 9999 &&
    categories.includes(v.category as never) &&
    timestamp(v.createdAt) &&
    timestamp(v.updatedAt)
  );
}
export function validSeries(v: unknown): v is Series {
  return (
    object(v) &&
    keys(v, [
      "id",
      "template",
      "frequency",
      "startDate",
      "endDate",
      "createdAt",
      "updatedAt",
    ]) &&
    id(v.id) &&
    validTask(v.template) &&
    v.template.seriesId === null &&
    ["daily", "weekly", "monthly", "yearly"].includes(v.frequency as string) &&
    validDate(v.startDate) &&
    date(v.endDate) &&
    (v.endDate === null || String(v.endDate) >= v.startDate) &&
    timestamp(v.createdAt) &&
    timestamp(v.updatedAt)
  );
}
export function validSettings(v: unknown): v is Settings {
  if (
    !object(v) ||
    !keys(v, ["theme", "timezone", "weekStart"]) ||
    !["system", "light", "dark"].includes(v.theme as string) ||
    ![0, 1].includes(v.weekStart as number) ||
    !text(v.timezone, 100)
  )
    return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: v.timezone as string });
    return true;
  } catch {
    return false;
  }
}
export function parseBackup(raw: string): Backup {
  if (raw.length > 20_000_000)
    throw new Error("Backup is too large (maximum 20 MB).");
  const b: unknown = JSON.parse(raw);
  if (
    !object(b) ||
    !keys(b, [
      "schemaVersion",
      "exportedAt",
      "tasks",
      "occurrences",
      "goals",
      "series",
      "settings",
    ]) ||
    b.schemaVersion !== 1 ||
    typeof b.exportedAt !== "string" ||
    Number.isNaN(Date.parse(b.exportedAt)) ||
    !validSettings(b.settings)
  )
    throw new Error("Invalid backup or unsupported schema version.");
  const validators = {
    tasks: validTask,
    occurrences: validTask,
    goals: validGoal,
    series: validSeries,
  };
  for (const key of ["tasks", "occurrences", "goals", "series"] as const) {
    const records = b[key];
    if (
      !Array.isArray(records) ||
      records.length > 50000 ||
      !records.every(validators[key])
    )
      throw new Error(`Invalid ${key} records.`);
    if (new Set(records.map((r) => r.id)).size !== records.length)
      throw new Error(`Duplicate IDs in ${key}.`);
  }
  const result = b as unknown as Backup;
  if (
    result.tasks.some((t) => t.seriesId !== null) ||
    result.occurrences.some((t) => !t.seriesId)
  )
    throw new Error("Occurrence records must be separate from tasks.");
  return result;
}
export function importPreview(current: Snapshot, incoming: Backup) {
  let added = 0,
    updated = 0,
    skipped = 0;
  for (const k of ["tasks", "occurrences", "goals", "series"] as const) {
    const existing = new Map(current[k].map((x) => [x.id, x]));
    for (const record of incoming[k]) {
      const old = existing.get(record.id);
      if (!old) added++;
      else if (shouldImportRecord(old, record)) updated++;
      else skipped++;
    }
  }
  return { added, updated, skipped };
}
export function mergeBackup(current: Snapshot, incoming: Backup): Snapshot {
  const result = { ...current };
  for (const key of ["tasks", "occurrences", "goals", "series"] as const) {
    const map = new Map<string, Task | Goal | Series>(
      current[key].map((x) => [x.id, x]),
    );
    for (const record of incoming[key]) {
      const old = map.get(record.id);
      if (shouldImportRecord(old, record)) map.set(record.id, record);
    }
    Object.assign(result, { [key]: [...map.values()] });
  }
  return result;
}
export function download(
  name: string,
  content: string,
  mime = "application/json",
) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function taskCSV(tasks: Task[]) {
  const cell = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^(?:\s*[=+@-]|[\t\r\n])/, "'$&")
      .replaceAll('"', '""') +
    '"';
  return [
    [
      "Title",
      "Status",
      "Priority",
      "Category",
      "Due date",
      "Planning period",
      "Plan start",
      "Plan end",
      "Notes",
    ],
    ...tasks
      .filter((t) => t.purgedAt === undefined)
      .map((t) => [
        t.title,
        t.status,
        t.priority,
        t.category,
        t.dueDate,
        t.planType,
        t.planStart,
        t.planEnd,
        t.notes,
      ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
