import { addDays, asDate, monthShift } from "./dates";
import type { Series, Task } from "./model";
export const occurrenceId = (seriesId: string, date: string) =>
  `${seriesId}_${date}`;
export function occursOn(s: Series, date: string): boolean {
  if (date < s.startDate || (s.endDate && date > s.endDate)) return false;
  const start = asDate(s.startDate),
    candidate = asDate(date);
  const days = Math.round((candidate.getTime() - start.getTime()) / 86400000);
  if (s.frequency === "daily") return true;
  if (s.frequency === "weekly") return days % 7 === 0;
  const months =
    (candidate.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    candidate.getUTCMonth() -
    start.getUTCMonth();
  if (s.frequency === "yearly" && months % 12 !== 0) return false;
  return monthShift(s.startDate, months) === date;
}
export function expandSeries(
  series: Series[],
  records: Task[],
  from: string,
  to: string,
): Task[] {
  const overrides = new Map(records.map((t) => [t.id, t]));
  const result: Task[] = [];
  for (const s of series) {
    for (let date = from; date <= to; date = addDays(date, 1)) {
      if (!occursOn(s, date)) continue;
      const id = occurrenceId(s.id, date);
      result.push(
        overrides.get(id) || {
          ...s.template,
          id,
          seriesId: s.id,
          occurrenceDate: date,
          dueDate: date,
          planType: null,
          planStart: null,
          planEnd: null,
          status: "todo",
          completedAt: null,
          deletedAt: null,
        },
      );
      overrides.delete(id);
    }
  }
  // Overrides survive ending a series and moving an occurrence to a different day.
  return [...result, ...overrides.values()];
}
