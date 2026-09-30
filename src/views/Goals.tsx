import { useRef, useState } from "react";
import { Target, Plus, ArrowUpRight, X } from "lucide-react";
import { useStore } from "../context/Store";
import { categories, type Goal } from "../lib/model";
import s from "../App.module.scss";
export default function Goals({ year }: { year: number }) {
  const { data, put } = useStore(),
    ref = useRef<HTMLDialogElement>(null),
    [draft, setDraft] = useState<Goal | null>(null);
  const open = (goal?: Goal) => {
    setDraft(
      goal || {
        id: crypto.randomUUID(),
        title: "",
        notes: "",
        year,
        category: "Personal",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    );
    ref.current?.showModal();
  };
  return (
    <section className={s.goals}>
      <div className={s.sectionHeading}>
        <h2>
          <Target size={16} /> Your north stars <span>{year}</span>
        </h2>
        <button onClick={() => open()}>
          <Plus size={15} />
          New goal
        </button>
      </div>
      <div className={s.goalGrid}>
        {data.goals
          .filter((g) => g.year === year)
          .map((g) => {
            const tasks = [...data.tasks, ...data.occurrences].filter(
              (t) => t.goalId === g.id && !t.deletedAt,
            );
            const done = tasks.filter((t) => t.status === "done").length;
            return (
              <button key={g.id} className={s.goalCard} onClick={() => open(g)}>
                <span className={s.category} data-category={g.category}>
                  {g.category}
                  <ArrowUpRight size={15} />
                </span>
                <h3>{g.title}</h3>
                <div className={s.goalTrack}>
                  <span
                    style={{
                      width: `${tasks.length ? (done / tasks.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className={s.goalProgress}>
                  {done} of {tasks.length} linked tasks complete{" "}
                  <strong>
                    {tasks.length ? Math.round((done / tasks.length) * 100) : 0}
                    %
                  </strong>
                </div>
              </button>
            );
          })}
        {!data.goals.some((g) => g.year === year) && (
          <button className={s.emptyGoal} onClick={() => open()}>
            <Target size={25} />
            <strong>What matters to you this year?</strong>
            <span>Give your everyday steps a direction.</span>
          </button>
        )}
      </div>
      <dialog
        ref={ref}
        className={s.smallDialog}
        onCancel={() => setDraft(null)}
        aria-labelledby="goal-title"
      >
        <div className={s.dialogTop}>
          <h2 id="goal-title">A bigger intention</h2>
          <button
            onClick={() => {
              ref.current?.close();
              setDraft(null);
            }}
            aria-label="Close goal"
          >
            <X size={20} />
          </button>
        </div>
        {draft && (
          <form
            className={s.goalForm}
            onSubmit={(e) => {
              e.preventDefault();
              put("goals", {
                ...draft,
                title: draft.title.trim(),
                updatedAt: Date.now(),
              });
              ref.current?.close();
              setDraft(null);
            }}
          >
            <label>
              Goal
              <input
                autoFocus
                required
                maxLength={300}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <div className={s.formGrid}>
              <label>
                Year
                <input
                  type="number"
                  min={1900}
                  max={9999}
                  required
                  value={draft.year}
                  onChange={(e) =>
                    setDraft({ ...draft, year: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                Category
                <select
                  value={draft.category}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      category: e.target.value as Goal["category"],
                    })
                  }
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Why it matters
              <textarea
                rows={3}
                maxLength={20000}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </label>
            <p className={s.muted}>
              Link tasks from their details to track progress. Recurring
              progress counts saved occurrences in the selected year.
            </p>
            <button className={s.primary} type="submit">
              Save goal
            </button>
          </form>
        )}
      </dialog>
    </section>
  );
}
