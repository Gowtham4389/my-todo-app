import { describe, it, expect, vi } from "vitest";
import {
  addDays,
  monthShift,
  period,
  today,
  matchesView,
  validDate,
} from "../src/lib/dates";
import {
  makeTask,
  purgeOccurrence,
  blankSnapshot,
  defaultSettings,
  type Series,
} from "../src/lib/model";
import { occursOn, expandSeries, occurrenceId } from "../src/lib/recurrence";
import {
  parseBackup,
  mergeBackup,
  importPreview,
  taskCSV,
} from "../src/lib/backup";
const series = (frequency: Series["frequency"], startDate: string): Series => ({
  id: "test-series",
  template: makeTask("A recurring task"),
  frequency,
  startDate,
  endDate: null,
  createdAt: 1,
  updatedAt: 1,
});
const backup = () => ({
  ...blankSnapshot(),
  schemaVersion: 1 as const,
  exportedAt: new Date().toISOString(),
});
describe("calendar dates", () => {
  it("handles week boundaries across years for either week start", () => {
    expect(period("2026-01-01", "week")).toEqual(["2025-12-29", "2026-01-04"]);
    expect(period("2026-01-01", "week", 0)).toEqual([
      "2025-12-28",
      "2026-01-03",
    ]);
  });
  it("handles leap February and year boundaries", () => {
    expect(period("2024-02-14", "month")).toEqual(["2024-02-01", "2024-02-29"]);
    expect(period("2025-02-14", "month")[1]).toBe("2025-02-28");
    expect(period("2026-12-31", "year")).toEqual(["2026-01-01", "2026-12-31"]);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("uses the selected timezone without shifting stored dates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:30:00Z"));
    expect(today("Asia/Kolkata")).toBe("2026-01-01");
    expect(today("America/Los_Angeles")).toBe("2025-12-31");
    expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
    vi.useRealTimers();
  });
  it("clamps month navigation and rejects impossible dates", () => {
    expect(monthShift("2024-01-31", 1)).toBe("2024-02-29");
    expect(validDate("2025-02-29")).toBe(false);
    expect(validDate("2024-02-29")).toBe(true);
  });
  it("keeps plans independent of deadlines and excludes Trash", () => {
    const t = makeTask("Learn TS", {
      planType: "year",
      planStart: "2026-01-01",
      planEnd: "2026-12-31",
    });
    expect(matchesView(t, "year", "2026-09-30", defaultSettings)).toBe(true);
    expect(matchesView(t, "today", "2026-09-30", defaultSettings)).toBe(false);
    expect(
      matchesView(
        { ...t, deletedAt: 1 },
        "year",
        "2026-09-30",
        defaultSettings,
      ),
    ).toBe(false);
  });
});
describe("recurrence", () => {
  it("clamps month-end then returns to the anchor day", () => {
    const s = series("monthly", "2024-01-31");
    expect(occursOn(s, "2024-02-29")).toBe(true);
    expect(occursOn(s, "2024-03-31")).toBe(true);
    expect(occursOn(s, "2024-03-29")).toBe(false);
  });
  it("returns to leap day in leap years", () => {
    const s = series("yearly", "2024-02-29");
    expect(occursOn(s, "2025-02-28")).toBe(true);
    expect(occursOn(s, "2028-02-29")).toBe(true);
    expect(occursOn(s, "2028-02-28")).toBe(false);
  });
  it("respects weekly cadence and inclusive series ends", () => {
    const s = { ...series("weekly", "2026-09-01"), endDate: "2026-09-15" };
    expect(expandSeries([s], [], "2026-09-01", "2026-09-30")).toHaveLength(3);
  });
  it("completes one deterministic occurrence without completing the series", () => {
    const s = series("daily", "2026-09-01");
    const initial = expandSeries([s], [], "2026-09-01", "2026-09-03");
    const completed = {
      ...initial[0],
      status: "done" as const,
      completedAt: 1,
    };
    const result = expandSeries([s], [completed], "2026-09-01", "2026-09-03");
    expect(result).toHaveLength(3);
    expect(result.filter((t) => t.status === "done")).toHaveLength(1);
    expect(result[0].id).toBe(occurrenceId(s.id, "2026-09-01"));
  });
  it("keeps a deleted occurrence as a tombstone", () => {
    const s = series("daily", "2026-09-01");
    const task = expandSeries([s], [], "2026-09-01", "2026-09-01")[0];
    expect(
      expandSeries(
        [s],
        [{ ...task, deletedAt: 1 }],
        "2026-09-01",
        "2026-09-01",
      )[0].deletedAt,
    ).toBe(1);
  });
});
describe("backup validation and merging", () => {
  it("round-trips data without duplicate records", () => {
    const b = backup();
    b.tasks = [makeTask("A")];
    const parsed = parseBackup(JSON.stringify(b));
    const once = mergeBackup(blankSnapshot(), parsed);
    const twice = mergeBackup(once, parsed);
    expect(twice.tasks).toHaveLength(1);
    expect(importPreview(twice, parsed)).toEqual({
      added: 0,
      updated: 0,
      skipped: 1,
    });
  });
  it("keeps newer local records, unmentioned data, and current settings", () => {
    const local = blankSnapshot();
    local.tasks = [
      makeTask("Newest", { id: "one", updatedAt: 10 }),
      makeTask("Keep me"),
    ];
    const b = backup();
    b.tasks = [makeTask("Older", { id: "one", updatedAt: 5 })];
    b.settings.theme = "dark";
    expect(mergeBackup(local, b).tasks).toEqual(local.tasks);
    expect(mergeBackup(local, b).settings.theme).toBe("system");
  });
  it("rejects duplicate IDs, unknown fields, oversized titles and schema versions", () => {
    const b = backup(),
      t = makeTask("A");
    for (const bad of [
      { ...b, schemaVersion: 2 },
      { ...b, tasks: [t, t] },
      { ...b, tasks: [{ ...t, admin: true }] },
      { ...b, tasks: [{ ...t, title: "x".repeat(301) }] },
    ])
      expect(() => parseBackup(JSON.stringify(bad))).toThrow();
  });
  it("rejects invalid dates and mismatched occurrence IDs", () => {
    const b = backup();
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...b,
          tasks: [makeTask("bad", { dueDate: "2025-02-30" })],
        }),
      ),
    ).toThrow();
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...b,
          occurrences: [
            makeTask("bad", { seriesId: "test", occurrenceDate: "2026-01-01" }),
          ],
        }),
      ),
    ).toThrow();
  });
  it("neutralizes spreadsheet formulas and escapes commas/quotes", () => {
    const csv = taskCSV([makeTask("=1+1", { notes: 'Hello, "world"' })]);
    expect(csv).toContain("'=1+1");
    expect(csv).toContain('"Hello, ""world"""');
  });
});

describe("permanent occurrence deletion", () => {
  it("scrubs contents and prevents regeneration in every view", () => {
    const s = series("daily", "2026-09-01");
    const task = expandSeries([s], [], "2026-09-01", "2026-09-01")[0];
    const marker = purgeOccurrence(
      {
        ...task,
        notes: "Private notes",
        goalId: "goal",
        subtasks: [{ id: "step", title: "Private step", done: true }],
      },
      123,
    );
    expect(marker.title).toBe("Deleted occurrence");
    expect(marker.notes).toBe("");
    expect(marker.subtasks).toEqual([]);
    expect(marker.goalId).toBeNull();
    for (const view of [
      "today",
      "week",
      "month",
      "year",
      "inbox",
      "completed",
      "trash",
    ] as const)
      expect(matchesView(marker, view, "2026-09-01", defaultSettings)).toBe(
        false,
      );
    const remaining = expandSeries([s], [marker], "2026-09-01", "2026-09-03");
    expect(remaining.map((t) => t.occurrenceDate)).toEqual([
      "2026-09-02",
      "2026-09-03",
    ]);
    expect(taskCSV([marker])).not.toContain("Deleted occurrence");
  });
  it("preserves deletion in backups even against a newer stale copy", () => {
    const s = series("daily", "2026-09-01");
    const task = expandSeries([s], [], "2026-09-01", "2026-09-01")[0];
    const b = {
      ...backup(),
      series: [s],
      occurrences: [purgeOccurrence(task, 123)],
    };
    const parsed = parseBackup(JSON.stringify(b));
    const stale = { ...backup(), occurrences: [{ ...task, updatedAt: 999 }] };
    expect(mergeBackup(parsed, stale).occurrences).toEqual(parsed.occurrences);
    expect(importPreview(parsed, stale)).toEqual({
      added: 0,
      updated: 0,
      skipped: 1,
    });
    expect(mergeBackup(stale, parsed).occurrences).toEqual(parsed.occurrences);
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...b,
          occurrences: [{ ...b.occurrences[0], notes: "Not scrubbed" }],
        }),
      ),
    ).toThrow();
    expect(() =>
      parseBackup(
        JSON.stringify({
          ...b,
          tasks: [{ ...makeTask("bad"), purgedAt: 123 }],
        }),
      ),
    ).toThrow();
  });
});
