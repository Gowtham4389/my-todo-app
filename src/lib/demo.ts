import { makeTask, type Snapshot, defaultSettings } from "./model";
import { today, addDays, period } from "./dates";
export function demoData(): Snapshot {
  const date = today(),
    year = Number(date.slice(0, 4)),
    now = Date.now();
  const goals = [
    {
      id: "goal-reading",
      title: "Make learning a lifelong habit",
      notes: "A little curiosity, every day.",
      year,
      category: "Learning" as const,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "goal-health",
      title: "Build a healthier, happier routine",
      notes: "Consistency over perfection.",
      year,
      category: "Health" as const,
      createdAt: now,
      updatedAt: now,
    },
  ];
  const tasks = [
    makeTask("Make space for a little morning movement", {
      dueDate: date,
      category: "Health",
      priority: "medium",
      goalId: "goal-health",
      subtasks: [
        { id: "walk", title: "Take a 20-minute walk", done: true },
        { id: "stretch", title: "Stretch and reset", done: false },
      ],
    }),
    makeTask("Outline the next chapter of my portfolio", {
      dueDate: date,
      category: "Work",
      priority: "high",
      status: "progress",
      notes: "Keep it simple. Start with the work I am most proud of.",
      subtasks: [
        { id: "projects", title: "Choose three projects", done: false },
        { id: "intro", title: "Write a short introduction", done: false },
      ],
    }),
    makeTask("Read 20 pages of my current book", {
      dueDate: date,
      category: "Learning",
      goalId: "goal-reading",
      priority: "low",
    }),
    makeTask("Plan something lovely for the weekend", {
      dueDate: date,
      category: "Personal",
    }),
    makeTask("Review this month’s subscriptions", {
      dueDate: addDays(date, -1),
      category: "Finance",
      priority: "medium",
    }),
    makeTask("Drink a glass of water before coffee", {
      dueDate: date,
      category: "Health",
      status: "done",
      completedAt: now,
      goalId: "goal-health",
    }),
    makeTask("Explore ideas for a small side project", {
      category: "Learning",
    }),
    makeTask("Find a new recipe to try", { category: "Personal" }),
    makeTask("Review my weekly priorities", {
      category: "Work",
      planType: "week",
      planStart: period(date, "week")[0],
      planEnd: period(date, "week")[1],
    }),
    makeTask("Finish one thoughtful book", {
      category: "Learning",
      goalId: "goal-reading",
      planType: "month",
      planStart: period(date, "month")[0],
      planEnd: period(date, "month")[1],
    }),
  ];
  return {
    tasks,
    goals,
    series: [],
    occurrences: [],
    settings: { ...defaultSettings },
  };
}
