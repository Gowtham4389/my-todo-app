import {
  Check,
  Repeat2,
  Flag,
  ListChecks,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useStore } from "../context/Store";
import { formatDate } from "../lib/dates";
import type { Task } from "../lib/model";
import s from "../App.module.scss";
export default function TaskRow({
  task,
  onSelect,
  overdue = false,
}: {
  task: Task;
  onSelect: (t: Task) => void;
  overdue?: boolean;
}) {
  const store = useStore();
  return (
    <div className={`${s.taskRow} ${task.status === "done" ? s.done : ""}`}>
      {!task.deletedAt && (
        <button
          className={`${s.checkButton} ${task.status === "done" ? s.checked : ""} ${task.status === "progress" ? s.inProgress : ""}`}
          aria-label={`${task.status === "done" ? "Reopen" : "Complete"} ${task.title}`}
          onClick={() =>
            store.patch(task, {
              status: task.status === "done" ? "todo" : "done",
              completedAt: task.status === "done" ? null : Date.now(),
            })
          }
        >
          {task.status === "done" && <Check size={14} />}
        </button>
      )}
      <button className={s.taskContent} onClick={() => onSelect(task)}>
        <span className={s.taskTitle}>{task.title}</span>
        <span className={s.taskMeta}>
          <span className={s.category} data-category={task.category}>
            {task.category}
          </span>
          {task.status === "progress" && (
            <span className={s.progressTag}>In progress</span>
          )}
          {task.subtasks.length > 0 && (
            <span>
              <ListChecks size={13} />
              {task.subtasks.filter((x) => x.done).length}/
              {task.subtasks.length}
            </span>
          )}
          {task.seriesId && <Repeat2 size={13} />}
          <span className={overdue ? s.overdueDate : ""}>
            {task.dueDate
              ? formatDate(task.dueDate)
              : task.planType
                ? `This ${task.planType}`
                : ""}
          </span>
        </span>
      </button>
      {task.priority !== "none" && (
        <span
          className={s.priority}
          data-priority={task.priority}
          title={`${task.priority} priority`}
        >
          <Flag size={15} />
          <span>{task.priority}</span>
        </span>
      )}
      {task.deletedAt && (
        <>
          <button
            className={s.iconButton}
            aria-label={`Restore ${task.title}`}
            onClick={() => store.patch(task, { deletedAt: null })}
          >
            <RotateCcw size={18} />
          </button>
          {!task.seriesId && (
            <button
              className={s.iconButton}
              aria-label={`Permanently delete ${task.title}`}
              onClick={() => {
                if (
                  confirm(
                    "Permanently delete this task? This cannot be undone.",
                  )
                )
                  store.remove(task);
              }}
            >
              <Trash2 size={18} />
            </button>
          )}
        </>
      )}
    </div>
  );
}
