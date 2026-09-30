import { useEffect, useRef, useState } from "react";
import {
  X,
  Plus,
  Trash2,
  Copy,
  ArrowUpRight,
  Repeat2,
  Check,
  CalendarDays,
  Flag,
  AlignLeft,
} from "lucide-react";
import { useStore } from "../context/Store";
import { categories, makeTask, type Task, type Series } from "../lib/model";
import { period, today } from "../lib/dates";
import s from "../App.module.scss";
export default function TaskEditor({
  task,
  onClose,
  isNew = false,
}: {
  task: Task;
  onClose: () => void;
  isNew?: boolean;
}) {
  const store = useStore(),
    [draft, setDraft] = useState(task),
    [frequency, setFrequency] = useState(""),
    [subtask, setSubtask] = useState(""),
    [formError, setFormError] = useState("");
  const ref = useRef<HTMLDialogElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(task) || !!frequency;
  const close = () => {
    if (!dirty || confirm("Discard your unsaved task changes?")) onClose();
  };
  useEffect(() => {
    ref.current?.showModal();
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    addEventListener("beforeunload", handler);
    return () => removeEventListener("beforeunload", handler);
  }, [dirty]);
  const change = (fields: Partial<Task>) =>
    setDraft((d) => ({ ...d, ...fields }));
  const save = () => {
    if (!draft.title.trim()) {
      setFormError("Give your task a title.");
      return;
    }
    const now = Date.now(),
      next = { ...draft, title: draft.title.trim(), updatedAt: now };
    if (frequency) {
      const id = crypto.randomUUID();
      store.repeat(
        {
          id,
          template: {
            ...next,
            id: crypto.randomUUID(),
            status: "todo",
            completedAt: null,
            deletedAt: null,
          },
          frequency: frequency as Series["frequency"],
          startDate: next.dueDate || today(store.data.settings.timezone),
          endDate: null,
          createdAt: now,
          updatedAt: now,
        },
        isNew ? null : task,
      );
    } else if (isNew) store.put("tasks", next);
    else {
      const changed: Partial<Task> = {};
      for (const key of Object.keys(next) as (keyof Task)[])
        if (JSON.stringify(next[key]) !== JSON.stringify(task[key]))
          Object.assign(changed, { [key]: next[key] });
      store.patch(task, changed);
    }
    onClose();
  };
  const updatePlan = (type: Task["planType"], date: string) => {
    const [start, end] = type
      ? period(date, type, store.data.settings.weekStart)
      : [null, null];
    change({ planType: type, planStart: start, planEnd: end });
  };
  return (
    <dialog
      ref={ref}
      className={s.taskDialog}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      aria-labelledby="task-dialog-title"
    >
      <div className={s.dialogTop}>
        <span id="task-dialog-title">
          {isNew ? "A little intention" : "Task details"}
        </span>
        <button
          className={s.iconButton}
          onClick={close}
          aria-label="Close task details"
        >
          <X size={20} />
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className={s.editor}
      >
        <input
          className={s.titleInput}
          aria-label="Task title"
          placeholder="What’s on your mind?"
          value={draft.title}
          maxLength={300}
          onChange={(e) => change({ title: e.target.value })}
          required
          autoFocus
        />
        {task.seriesId && (
          <div className={s.info}>
            <Repeat2 size={15} /> Editing only this occurrence ·{" "}
            {task.occurrenceDate}
          </div>
        )}
        <div className={s.formGrid}>
          <label>
            Status
            <select
              value={draft.status}
              onChange={(e) =>
                change({
                  status: e.target.value as Task["status"],
                  completedAt: e.target.value === "done" ? Date.now() : null,
                })
              }
            >
              <option value="todo">To do</option>
              <option value="progress">In progress</option>
              <option value="done">Done</option>
            </select>
          </label>
          <label>
            <Flag size={14} /> Priority
            <select
              value={draft.priority}
              onChange={(e) =>
                change({ priority: e.target.value as Task["priority"] })
              }
            >
              {["none", "low", "medium", "high"].map((x) => (
                <option key={x} value={x}>
                  {x[0].toUpperCase() + x.slice(1)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <CalendarDays size={14} /> Due date
            <input
              type="date"
              value={draft.dueDate || ""}
              onChange={(e) => change({ dueDate: e.target.value || null })}
            />
          </label>
          <label>
            Category
            <select
              value={draft.category}
              onChange={(e) =>
                change({ category: e.target.value as Task["category"] })
              }
            >
              {categories.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          {!task.seriesId && (
            <>
              <label>
                Planning period
                <select
                  value={draft.planType || ""}
                  onChange={(e) =>
                    updatePlan(
                      (e.target.value || null) as Task["planType"],
                      draft.planStart || today(store.data.settings.timezone),
                    )
                  }
                >
                  <option value="">Unplanned</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                </select>
              </label>
              <label>
                Plan around
                <input
                  type="date"
                  disabled={!draft.planType}
                  value={draft.planStart || ""}
                  onChange={(e) => {
                    if (e.target.value)
                      updatePlan(draft.planType, e.target.value);
                  }}
                />
              </label>
            </>
          )}
          <label className={s.fullWidth}>
            Larger goal
            <select
              value={draft.goalId || ""}
              onChange={(e) => change({ goalId: e.target.value || null })}
            >
              <option value="">No linked goal</option>
              {store.data.goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title} · {g.year}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className={s.field}>
          <AlignLeft size={15} /> Notes
          <textarea
            rows={4}
            placeholder="A little context, an idea, a next step…"
            maxLength={20000}
            value={draft.notes}
            onChange={(e) => change({ notes: e.target.value })}
          />
        </label>
        <div className={s.subtaskHeader}>
          Small steps{" "}
          <span>
            {draft.subtasks.filter((x) => x.done).length}/
            {draft.subtasks.length}
          </span>
        </div>
        {draft.subtasks.map((item) => (
          <div className={s.subtask} key={item.id}>
            <input
              type="checkbox"
              checked={item.done}
              aria-label={`Complete ${item.title}`}
              onChange={(e) =>
                change({
                  subtasks: draft.subtasks.map((x) =>
                    x.id === item.id ? { ...x, done: e.target.checked } : x,
                  ),
                })
              }
            />
            <span>{item.title}</span>
            <button
              type="button"
              aria-label={`Remove ${item.title}`}
              onClick={() =>
                change({
                  subtasks: draft.subtasks.filter((x) => x.id !== item.id),
                })
              }
            >
              <X size={14} />
            </button>
          </div>
        ))}
        <div className={s.subtaskAdd}>
          <input
            aria-label="New subtask"
            placeholder="Break it into a small step"
            maxLength={300}
            value={subtask}
            onChange={(e) => setSubtask(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (subtask.trim() && draft.subtasks.length < 10) {
                  change({
                    subtasks: [
                      ...draft.subtasks,
                      {
                        id: crypto.randomUUID(),
                        title: subtask.trim(),
                        done: false,
                      },
                    ],
                  });
                  setSubtask("");
                }
              }
            }}
          />
          <button
            type="button"
            aria-label="Add subtask"
            disabled={!subtask.trim() || draft.subtasks.length >= 10}
            onClick={() => {
              change({
                subtasks: [
                  ...draft.subtasks,
                  {
                    id: crypto.randomUUID(),
                    title: subtask.trim(),
                    done: false,
                  },
                ],
              });
              setSubtask("");
            }}
          >
            <Plus size={17} />
          </button>
        </div>
        {!task.seriesId && (
          <label className={s.field}>
            <Repeat2 size={15} /> Repeat
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            >
              <option value="">Does not repeat</option>
              {["daily", "weekly", "monthly", "yearly"].map((x) => (
                <option key={x} value={x}>
                  {x[0].toUpperCase() + x.slice(1)}
                </option>
              ))}
            </select>
          </label>
        )}
        {frequency && (
          <p className={s.muted}>
            Creates a series starting on the due date, or today. Each occurrence
            is completed separately.
          </p>
        )}
        {formError && <p role="alert">{formError}</p>}
        <button className={s.primary} type="submit">
          <Check size={17} />
          {isNew ? "Create task" : "Save changes"}
        </button>
      </form>
      {!isNew && (
        <div className={s.editorActions}>
          <button
            onClick={() => {
              store.put(
                "tasks",
                makeTask(draft.title + " (copy)", {
                  ...draft,
                  id: crypto.randomUUID(),
                  seriesId: null,
                  occurrenceDate: null,
                  status: "todo",
                  completedAt: null,
                  deletedAt: null,
                  createdAt: Date.now(),
                  updatedAt: Date.now(),
                }),
              );
              store.notify("Task duplicated.");
              onClose();
            }}
          >
            <Copy size={16} />
            Duplicate
          </button>
          <button
            onClick={() => {
              store.patch(task, { deletedAt: Date.now() });
              onClose();
            }}
          >
            <Trash2 size={16} />
            Move to trash
          </button>
          {task.seriesId && (
            <button
              onClick={() => {
                const series = store.data.series.find(
                  (x) => x.id === task.seriesId,
                );
                if (
                  series &&
                  confirm(
                    "End this series after this occurrence? Saved occurrence records will be kept.",
                  )
                ) {
                  store.put("series", {
                    ...series,
                    endDate: task.occurrenceDate!,
                    updatedAt: Date.now(),
                  });
                  onClose();
                }
              }}
            >
              <ArrowUpRight size={16} />
              End series
            </button>
          )}
        </div>
      )}
      <p className={s.editorFoot}>Small steps make meaningful progress.</p>
    </dialog>
  );
}
