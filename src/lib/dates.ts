import type { Settings, Task, View } from "./model";
export const validDate = (s: unknown): s is string =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(s + "T12:00:00Z")) &&
  new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s;
export function today(timezone = "Asia/Kolkata"): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export const asDate = (s: string) => new Date(s + "T12:00:00Z");
export function addDays(s: string, n: number): string {
  const d = asDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function monthShift(s: string, n: number): string {
  const d = asDate(s),
    day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}
export function period(
  date: string,
  type: "week" | "month" | "year" | "today",
  weekStart: 0 | 1 = 1,
): [string, string] {
  if (type === "today") return [date, date];
  if (type === "week") {
    const start = addDays(
      date,
      -((asDate(date).getUTCDay() - weekStart + 7) % 7),
    );
    return [start, addDays(start, 6)];
  }
  if (type === "month") {
    const start = date.slice(0, 7) + "-01";
    return [start, addDays(monthShift(start, 1), -1)];
  }
  return [date.slice(0, 4) + "-01-01", date.slice(0, 4) + "-12-31"];
}
export function shiftPeriod(date: string, view: View, n: number) {
  return view === "year"
    ? monthShift(date, n * 12)
    : view === "month"
      ? monthShift(date, n)
      : addDays(date, n * (view === "week" ? 7 : 1));
}
export function formatDate(
  date: string,
  opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) {
  return new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" }).format(
    asDate(date),
  );
}
export function matchesView(
  t: Task,
  view: View,
  date: string,
  settings: Settings,
): boolean {
  if (t.purgedAt !== undefined) return false;
  if (view === "trash") return t.deletedAt !== null;
  if (t.deletedAt !== null) return false;
  if (view === "completed") return t.status === "done";
  if (view === "inbox") return t.status !== "done" && !t.dueDate && !t.planType;
  if (view === "settings") return false;
  const [start, end] = period(date, view, settings.weekStart);
  if (view === "today")
    return (
      !!t.dueDate &&
      (t.dueDate === date || (t.dueDate < date && t.status !== "done"))
    );
  return (
    (!!t.dueDate && t.dueDate >= start && t.dueDate <= end) ||
    (!!t.planStart && !!t.planEnd && t.planStart <= end && t.planEnd >= start)
  );
}
