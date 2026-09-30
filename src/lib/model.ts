export type View =
  | "today"
  | "week"
  | "month"
  | "year"
  | "inbox"
  | "completed"
  | "trash"
  | "settings";
export type Status = "todo" | "progress" | "done";
export type Priority = "none" | "low" | "medium" | "high";
export type Category = "Personal" | "Work" | "Learning" | "Health" | "Finance";
export const categories: Category[] = [
  "Personal",
  "Work",
  "Learning",
  "Health",
  "Finance",
];
export interface Settings {
  theme: "system" | "light" | "dark";
  timezone: string;
  weekStart: 0 | 1;
}
export const defaultSettings: Settings = {
  theme: "system",
  timezone: "Asia/Kolkata",
  weekStart: 1,
};
export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}
export interface Task {
  id: string;
  title: string;
  notes: string;
  status: Status;
  priority: Priority;
  category: Category;
  dueDate: string | null;
  planType: "week" | "month" | "year" | null;
  planStart: string | null;
  planEnd: string | null;
  goalId: string | null;
  subtasks: Subtask[];
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  deletedAt: number | null;
  seriesId: string | null;
  occurrenceDate: string | null;
}
export interface Goal {
  id: string;
  title: string;
  notes: string;
  year: number;
  category: Category;
  createdAt: number;
  updatedAt: number;
}
export interface Series {
  id: string;
  template: Task;
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  startDate: string;
  endDate: string | null;
  createdAt: number;
  updatedAt: number;
}
export interface Snapshot {
  tasks: Task[];
  occurrences: Task[];
  goals: Goal[];
  series: Series[];
  settings: Settings;
}
export type Collection = "tasks" | "occurrences" | "goals" | "series";
export const blankSnapshot = (): Snapshot => ({
  tasks: [],
  occurrences: [],
  goals: [],
  series: [],
  settings: { ...defaultSettings },
});
export const makeTask = (title: string, extra: Partial<Task> = {}): Task => ({
  id: crypto.randomUUID(),
  title,
  notes: "",
  status: "todo",
  priority: "none",
  category: "Personal",
  dueDate: null,
  planType: null,
  planStart: null,
  planEnd: null,
  goalId: null,
  subtasks: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  completedAt: null,
  deletedAt: null,
  seriesId: null,
  occurrenceDate: null,
  ...extra,
});
