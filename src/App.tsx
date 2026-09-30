import { lazy, Suspense, useEffect, useState } from "react";
import {
  Sun,
  Inbox,
  CalendarDays,
  CalendarRange,
  Calendar,
  CheckCheck,
  Trash2,
  Settings,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  CloudCheck,
  WifiOff,
  LoaderCircle,
  CircleAlert,
  MoreHorizontal,
  X,
  Target,
  ArrowDownWideNarrow,
  SlidersHorizontal,
  Leaf,
  LogIn,
  ArrowRight,
  PanelLeftClose,
} from "lucide-react";
import { Provider, useStore } from "./context/Store";
import { configured, login } from "./lib/firebase";
import {
  formatDate,
  today,
  period,
  shiftPeriod,
  matchesView,
} from "./lib/dates";
import { expandSeries } from "./lib/recurrence";
import { categories, makeTask, type View, type Task } from "./lib/model";
import TaskRow from "./components/TaskRow";
import TaskEditor from "./components/TaskEditor";
import UpdatePrompt from "./components/UpdatePrompt";
import s from "./App.module.scss";
const SettingsView = lazy(() => import("./views/Settings"));
const Goals = lazy(() => import("./views/Goals"));
const navigation = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "today", label: "Today", icon: Sun },
  { id: "week", label: "This week", icon: CalendarDays },
  { id: "month", label: "This month", icon: CalendarRange },
  { id: "year", label: "This year", icon: Calendar },
] as const;
const viewFromHash = (): View => {
  const value = location.hash.replace("#/", "");
  return [
    "today",
    "week",
    "month",
    "year",
    "inbox",
    "completed",
    "trash",
    "settings",
  ].includes(value)
    ? (value as View)
    : "today";
};
export default function App() {
  const [view, setView] = useState<View>(viewFromHash),
    [date, setDate] = useState(today()),
    [count, setCount] = useState(30);
  useEffect(() => {
    const change = () => {
      setView(viewFromHash());
      setCount(30);
    };
    addEventListener("hashchange", change);
    return () => removeEventListener("hashchange", change);
  }, []);
  return (
    <Provider view={view} date={date} count={count}>
      <Workspace
        view={view}
        date={date}
        setDate={setDate}
        count={count}
        setCount={setCount}
      />
    </Provider>
  );
}
function Workspace({
  view,
  date,
  setDate,
  count,
  setCount,
}: {
  view: View;
  date: string;
  setDate: (s: string) => void;
  count: number;
  setCount: (n: number) => void;
}) {
  const store = useStore(),
    { data } = store,
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("all"),
    [priority, setPriority] = useState("all"),
    [status, setStatus] = useState("all"),
    [sort, setSort] = useState("due"),
    [filters, setFilters] = useState(false),
    [more, setMore] = useState(false),
    [selected, setSelected] = useState<Task | null>(null),
    [isNew, setIsNew] = useState(false),
    [quick, setQuick] = useState(""),
    [authError, setAuthError] = useState("");
  const current = today(data.settings.timezone);
  useEffect(() => {
    setSelected(null);
    setQuick("");
  }, [store.mode, store.user?.uid]);
  useEffect(() => {
    setDate(today(data.settings.timezone));
  }, [data.settings.timezone, setDate]);
  useEffect(() => {
    setSearch("");
    setCategory("all");
    setPriority("all");
    setStatus("all");
    setMore(false);
  }, [view]);
  const [start, end] = period(
    date,
    ["week", "month", "year"].includes(view)
      ? (view as "week" | "month" | "year")
      : "today",
    data.settings.weekStart,
  );
  const occurrences = expandSeries(data.series, data.occurrences, start, end);
  const allTasks = [
    ...data.tasks,
    ...(view === "completed" || view === "trash"
      ? data.occurrences
      : occurrences),
  ];
  const visible = allTasks.filter((t) =>
    matchesView(t, view, date, data.settings),
  );
  const tasks = visible
    .filter(
      (t) =>
        (!search ||
          `${t.title} ${t.notes}`
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        (category === "all" || t.category === category) &&
        (priority === "all" || t.priority === priority) &&
        (status === "all" || t.status === status),
    )
    .sort((a, b) => {
      if (view === "completed")
        return (b.completedAt || 0) - (a.completedAt || 0);
      if (view === "trash") return (b.deletedAt || 0) - (a.deletedAt || 0);
      if (sort === "newest") return b.createdAt - a.createdAt;
      if (sort === "priority") {
        const rank = { high: 0, medium: 1, low: 2, none: 3 };
        return rank[a.priority] - rank[b.priority];
      }
      return (
        (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
        b.createdAt - a.createdAt
      );
    });
  const complete = visible.filter((t) => t.status === "done").length,
    active = tasks.filter((t) => t.status !== "done"),
    done = tasks.filter((t) => t.status === "done"),
    overdue = active.filter((t) => t.dueDate && t.dueDate < date),
    due = active.filter((t) => !t.dueDate || t.dueDate >= date);
  const newTask = (title = "") => {
    let extra: Partial<Task> = {};
    if (view === "today") extra = { dueDate: date };
    if (["week", "month", "year"].includes(view))
      extra = {
        planType: view as "week" | "month" | "year",
        planStart: start,
        planEnd: end,
      };
    return makeTask(title, extra);
  };
  const openNew = () => {
    setIsNew(true);
    setSelected(newTask());
  };
  const select = (t: Task) => {
    setIsNew(false);
    setSelected(t);
  };
  const goto = (v: string) => {
    location.hash = "/" + v;
  };
  const signIn = () => {
    setAuthError("");
    void login().catch((e) => setAuthError(e.message));
  };
  const title =
    view === "today"
      ? date === current
        ? "Today"
        : formatDate(date, { weekday: "long" })
      : view === "week"
        ? "Your week"
        : view === "month"
          ? formatDate(date, { month: "long" })
          : view === "year"
            ? "The bigger picture"
            : view === "inbox"
              ? "A place for every idea"
              : view === "completed"
                ? "Look how far you’ve come"
                : view === "trash"
                  ? "Trash"
                  : "Your space, your way";
  const subtitle =
    view === "today"
      ? "A fresh start. A few small steps. Make today count."
      : view === "week"
        ? "Find your rhythm. Make room for what matters."
        : view === "month"
          ? "Set your intentions. Take it one week at a time."
          : view === "year"
            ? "Big intentions become meaningful, everyday progress."
            : view === "inbox"
              ? "Get it out of your head. Give it a home when you’re ready."
              : view === "completed"
                ? "Every small step deserves a little recognition."
                : view === "trash"
                  ? "A little breathing room. Restore tasks whenever you need."
                  : "Make Daymark feel a little more like you.";
  const section = (label: string, items: Task[], kind = "") => (
    <section className={s.taskSection}>
      <div className={s.sectionHeading}>
        <h2 className={kind === "overdue" ? s.overdueDate : ""}>
          {label}
          <span>{items.length}</span>
        </h2>
        {kind === "overdue" && <span>A fresh chance to catch up</span>}
        {kind === "done" && <CheckCheck size={15} />}
      </div>
      {items.map((t) => (
        <TaskRow
          key={t.id}
          task={t}
          onSelect={select}
          overdue={kind === "overdue"}
        />
      ))}
    </section>
  );
  return (
    <div className={s.app}>
      <aside className={s.sidebar}>
        <a href="#/today" className={s.brand}>
          <span className={s.brandMark}>
            <CheckCheck size={22} />
          </span>
          daymark<span className={s.brandDot}>.</span>
        </a>
        <p className={s.brandCaption}>A little more intentional.</p>
        <button
          className={s.sidebarAdd}
          onClick={openNew}
          disabled={store.mode === "setup"}
        >
          <Plus size={18} /> Add a task <span>＋</span>
        </button>
        <div className={s.navLabel}>YOUR SPACE</div>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <a
              href={`#/${item.id}`}
              aria-label={item.label}
              key={item.id}
              className={view === item.id ? s.navActive : ""}
              aria-current={view === item.id ? "page" : undefined}
            >
              <item.icon size={19} />
              {item.label}
              {item.id === view && store.mode !== "setup" && (
                <span className={s.navCount}>
                  {visible.filter((t) => t.status !== "done").length}
                </span>
              )}
            </a>
          ))}
        </nav>
        <div className={s.navDivider} />
        <nav aria-label="History">
          <a
            href="#/completed"
            className={view === "completed" ? s.navActive : ""}
          >
            <CheckCheck size={19} />
            Completed
          </a>
          <a href="#/trash" className={view === "trash" ? s.navActive : ""}>
            <Trash2 size={18} />
            Trash
          </a>
        </nav>
        <div className={s.sidebarNote}>
          <span className={s.noteIcon}>
            <Leaf size={20} />
          </span>
          <p>
            Little by little,
            <br />a little becomes a lot.
          </p>
          <span>Keep showing up for yourself.</span>
        </div>
        <div className={s.sidebarBottom}>
          <a href="#/settings">
            <Settings size={18} />
            Settings
          </a>
          <div className={s.account}>
            <span className={s.avatar}>
              {store.mode === "demo"
                ? "D"
                : store.user?.displayName?.[0] || "Y"}
            </span>
            <div>
              <strong>
                {store.mode === "demo"
                  ? "Your demo space"
                  : store.user?.displayName || "Your personal space"}
              </strong>
              <small>
                {store.mode === "demo"
                  ? "Local demo · this device"
                  : "A calmer kind of productive"}
              </small>
            </div>
            <PanelLeftClose size={16} />
          </div>
        </div>
      </aside>
      <div className={s.workspace}>
        <header className={s.topbar}>
          <div className={s.breadcrumb}>
            <span>My workspace</span>
            <span>/</span>{" "}
            <strong>
              {view === "settings"
                ? "Settings"
                : view === "completed"
                  ? "Completed"
                  : view === "trash"
                    ? "Trash"
                    : navigation.find((n) => n.id === view)?.label}
            </strong>
          </div>
          <div className={s.topbarRight}>
            <span
              className={s.sync}
              title={
                store.mode === "demo"
                  ? "Demo data stays in this browser."
                  : store.state
              }
            >
              {store.state === "Offline" ? (
                <WifiOff size={15} />
              ) : store.error ? (
                <CircleAlert size={15} />
              ) : store.pending ? (
                <LoaderCircle size={15} />
              ) : (
                <CloudCheck size={16} />
              )}
              <span>
                {store.mode === "setup" ? "Your personal planner" : store.state}
              </span>
            </span>
            <span className={s.topbarDivider} />
            <span className={s.avatarSmall}>
              {store.mode === "demo"
                ? "D"
                : store.user?.displayName?.[0] || "Y"}
            </span>
          </div>
        </header>
        <main className={s.main} id="main-content" tabIndex={-1}>
          {store.mode === "setup" ? (
            <div className={s.setup}>
              <div className={s.setupLeaf}>
                <Leaf size={36} />
              </div>
              <p className={s.eyebrow}>LESS NOISE. MORE INTENTION.</p>
              <h1>
                Make room for
                <br />
                <em>what matters.</em>
              </h1>
              <p>
                Your big dreams and small, everyday steps.
                <br />
                Together in one calm, personal space.
              </p>
              <div className={s.setupFeatures}>
                <span>
                  <Sun size={18} />A clearer today
                </span>
                <span>
                  <CalendarDays size={18} />A thoughtful week
                </span>
                <span>
                  <Target size={18} />A bigger picture
                </span>
              </div>
              {configured ? (
                <>
                  <button
                    className={s.primary}
                    onClick={signIn}
                    disabled={!store.ready}
                  >
                    <LogIn size={17} />
                    {store.ready
                      ? "Continue with Google"
                      : "Getting your space ready…"}
                  </button>
                  {store.user && (
                    <button
                      className={s.textButton}
                      onClick={() => void store.exit()}
                    >
                      Sign out of this account
                    </button>
                  )}
                </>
              ) : (
                <div className={s.setupBox}>
                  <h2>Your space is almost ready</h2>
                  <p>
                    Connect Firebase to securely sync your plans across devices.
                    Copy <code>.env.example</code> to <code>.env.local</code>,
                    add your Firebase web configuration and owner UID, then
                    restart the app.
                  </p>
                  <p>The README walks you through every step.</p>
                </div>
              )}
              <button
                className={configured ? s.textButton : s.primary}
                onClick={store.enterDemo}
              >
                Explore the demo <ArrowRight size={17} />
              </button>
              <small>
                Demo data is saved only in this browser. No account needed.
              </small>
              {(authError || store.error) && (
                <p className={s.error} role="alert">
                  {authError || store.error}
                </p>
              )}
            </div>
          ) : (
            <>
              {store.mode === "demo" && (
                <div className={s.demoBanner}>
                  <span>
                    <span className={s.demoDot} />
                    DEMO SPACE{" "}
                    <span className={s.demoDetail}>
                      A little preview, with real working tasks. Saved on this
                      device.
                    </span>
                  </span>
                  <button onClick={() => void store.exit()}>
                    Connect your account <ArrowUpRight size={14} />
                  </button>
                </div>
              )}
              {store.error && (
                <div className={s.error} role="alert">
                  <span>{store.error}</span>
                  <button aria-label="Dismiss error" onClick={store.clearError}>
                    <X size={17} />
                  </button>
                </div>
              )}
              {store.cached && (
                <p className={s.cacheNotice} role="status">
                  Showing available cached data. Results may be incomplete until
                  the server responds.
                </p>
              )}
              <div className={s.pageHeading}>
                <div>
                  <p className={s.eyebrow}>
                    {view === "today"
                      ? formatDate(date, {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })
                      : view === "week"
                        ? `${formatDate(start)} – ${formatDate(end, { month: "short", day: "numeric", year: "numeric" })}`
                        : view === "month" || view === "year"
                          ? date.slice(0, 4)
                          : "MAKE ROOM FOR WHAT MATTERS"}
                  </p>
                  <h1>
                    {title}
                    <span className={s.headingDot}>.</span>
                  </h1>
                  <p className={s.subtitle}>{subtitle}</p>
                </div>
                {view !== "settings" &&
                  view !== "trash" &&
                  view !== "completed" && (
                    <button className={s.primary} onClick={openNew}>
                      <Plus size={18} />
                      Add task
                    </button>
                  )}
              </div>
              {view === "settings" ? (
                <Suspense fallback={<p>Opening settings…</p>}>
                  <SettingsView />
                </Suspense>
              ) : (
                <>
                  {["today", "week", "month", "year"].includes(view) && (
                    <div className={s.periodBar}>
                      <div className={s.periodControls}>
                        <button
                          aria-label="Previous period"
                          onClick={() => setDate(shiftPeriod(date, view, -1))}
                        >
                          <ChevronLeft size={17} />
                        </button>
                        <button onClick={() => setDate(current)}>
                          {view === "today" ? "Today" : `This ${view}`}
                        </button>
                        <button
                          aria-label="Next period"
                          onClick={() => setDate(shiftPeriod(date, view, 1))}
                        >
                          <ChevronRight size={17} />
                        </button>
                      </div>
                      <span>
                        {formatDate(start, {
                          month: "long",
                          ...(view === "year"
                            ? { year: "numeric" }
                            : { day: "numeric" }),
                        })}
                        {view === "week" ? ` – ${formatDate(end)}` : ""}
                      </span>
                    </div>
                  )}
                  {view === "year" && (
                    <Suspense fallback={<p>Opening goals…</p>}>
                      <Goals year={Number(date.slice(0, 4))} />
                    </Suspense>
                  )}
                  {view === "today" && (
                    <div className={s.dayCard}>
                      <div className={s.dayIcon}>
                        <Sun size={25} />
                      </div>
                      <div>
                        <strong>A little progress, every day</strong>
                        <p>
                          {complete
                            ? `${complete} ${complete === 1 ? "task" : "tasks"} complete. You’re making things happen.`
                            : "You don’t have to do it all. Just take the next step."}
                        </p>
                      </div>
                      <div className={s.dayProgress}>
                        <span>
                          <strong>{complete}</strong> / {visible.length}
                          <small>completed</small>
                        </span>
                        <svg
                          viewBox="0 0 44 44"
                          aria-label={`${complete} of ${visible.length} tasks complete`}
                        >
                          <circle cx="22" cy="22" r="18" />
                          <circle
                            cx="22"
                            cy="22"
                            r="18"
                            strokeDasharray={`${visible.length ? (complete / visible.length) * 113 : 0} 113`}
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                  <div className={s.toolbar}>
                    <label className={s.search}>
                      <Search size={17} />
                      <input
                        placeholder={
                          view === "completed"
                            ? "Search loaded history…"
                            : "Search tasks…"
                        }
                        aria-label="Search tasks"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      {search && (
                        <button
                          aria-label="Clear search"
                          onClick={() => setSearch("")}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </label>
                    <button
                      className={filters ? s.filterActive : ""}
                      onClick={() => setFilters(!filters)}
                      aria-label="Filter tasks"
                      aria-expanded={filters}
                    >
                      <SlidersHorizontal size={15} />
                      <span>Filter</span>
                      {(category !== "all" ||
                        priority !== "all" ||
                        status !== "all") &&
                        " •"}
                    </button>
                    <label className={s.sort}>
                      <ArrowDownWideNarrow size={16} />
                      <select
                        aria-label="Sort tasks"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                      >
                        <option value="due">Due date</option>
                        <option value="priority">Priority</option>
                        <option value="newest">Newest</option>
                      </select>
                    </label>
                  </div>
                  {filters && (
                    <div className={s.filters}>
                      <select
                        aria-label="Filter category"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        <option value="all">All categories</option>
                        {categories.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                      <select
                        aria-label="Filter priority"
                        value={priority}
                        onChange={(e) => setPriority(e.target.value)}
                      >
                        <option value="all">All priorities</option>
                        {["none", "low", "medium", "high"].map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                      <select
                        aria-label="Filter status"
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                      >
                        <option value="all">All statuses</option>
                        <option value="todo">To do</option>
                        <option value="progress">In progress</option>
                        <option value="done">Done</option>
                      </select>
                      <button
                        onClick={() => {
                          setCategory("all");
                          setPriority("all");
                          setStatus("all");
                        }}
                      >
                        Reset
                      </button>
                    </div>
                  )}
                  <div className={s.taskList}>
                    {view === "today" ? (
                      <>
                        {overdue.length > 0 &&
                          section("Overdue", overdue, "overdue")}
                        {section("On your list", due)}
                        {done.length > 0 &&
                          section("A little closer", done, "done")}
                      </>
                    ) : view === "year" ? (
                      <>
                        {section(
                          "Yearly intentions",
                          tasks.filter(
                            (t) =>
                              !t.dueDate &&
                              (t.planType === "year" || !t.planStart),
                          ),
                        )}
                        {Array.from({ length: 12 }, (_, i) =>
                          String(i + 1).padStart(2, "0"),
                        ).map((month) => {
                          const list = tasks.filter(
                            (t) =>
                              (t.dueDate || t.planStart)?.slice(5, 7) ===
                                month && !!(t.dueDate || t.planType !== "year"),
                          );
                          return list.length ? (
                            <div key={month}>
                              {section(
                                formatDate(`${date.slice(0, 4)}-${month}-01`, {
                                  month: "long",
                                }),
                                list,
                              )}
                            </div>
                          ) : null;
                        })}
                      </>
                    ) : (
                      section(
                        view === "completed"
                          ? "Completed tasks"
                          : view === "trash"
                            ? "Recently deleted"
                            : view === "inbox"
                              ? "Ideas & possibilities"
                              : "Your plan",
                        tasks,
                      )
                    )}
                    {!tasks.length && (
                      <div className={s.empty}>
                        <Leaf size={30} />
                        <h3>
                          {store.cached
                            ? "Your saved tasks are loading"
                            : search ||
                                category !== "all" ||
                                priority !== "all" ||
                                status !== "all"
                              ? "Nothing matches just yet"
                              : view === "completed"
                                ? "Every small win starts somewhere"
                                : view === "trash"
                                  ? "A clean slate"
                                  : "A little breathing room"}
                        </h3>
                        <p>
                          {store.cached
                            ? "Reconnect to see the complete list."
                            : search
                              ? "Try another search or clear your filters."
                              : view === "trash"
                                ? "Deleted tasks will wait here until you’re sure."
                                : "There’s room for something meaningful."}
                        </p>
                      </div>
                    )}
                    {!["completed", "trash"].includes(view) && (
                      <form
                        className={s.quickAdd}
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (quick.trim()) {
                            store.put("tasks", newTask(quick.trim()));
                            setQuick("");
                          }
                        }}
                      >
                        <Plus size={19} />
                        <input
                          aria-label="Quick add task"
                          placeholder="Add a task. Make a little space in your mind."
                          maxLength={300}
                          value={quick}
                          onChange={(e) => setQuick(e.target.value)}
                        />
                        <button
                          type="submit"
                          disabled={!quick.trim()}
                          aria-label="Create quick task"
                        >
                          {quick ? "Add" : "↵"}
                        </button>
                      </form>
                    )}
                  </div>
                  {["completed", "trash"].includes(view) && (
                    <div className={s.historyFooter}>
                      <p>
                        Search covers loaded records. Recurring deletions stay
                        in Trash to preserve the skipped occurrence.
                      </p>
                      {(data.tasks.length >= count ||
                        data.occurrences.length >= count) && (
                        <button
                          className={s.secondary}
                          onClick={() => setCount(count + 30)}
                        >
                          Load 30 more
                        </button>
                      )}
                    </div>
                  )}
                  <footer className={s.pageFooter}>
                    <Leaf size={13} />
                    <span>Progress, not perfection.</span>
                    <span>One day at a time.</span>
                  </footer>
                </>
              )}
            </>
          )}
        </main>
      </div>
      {store.mode !== "setup" && (
        <>
          <button className={s.fab} aria-label="Add task" onClick={openNew}>
            <Plus size={24} />
          </button>
          <nav className={s.mobileNav} aria-label="Mobile navigation">
            {navigation
              .filter((n) => ["today", "week", "inbox"].includes(n.id))
              .sort(
                (a, b) =>
                  ["today", "week", "inbox"].indexOf(a.id) -
                  ["today", "week", "inbox"].indexOf(b.id),
              )
              .map((n) => (
                <a
                  href={`#/${n.id}`}
                  key={n.id}
                  aria-current={view === n.id ? "page" : undefined}
                  className={view === n.id ? s.mobileActive : ""}
                >
                  <n.icon size={21} />
                  <span>{n.id === "week" ? "Week" : n.label}</span>
                </a>
              ))}
            <button onClick={() => setMore(!more)} aria-expanded={more}>
              <MoreHorizontal size={22} />
              <span>More</span>
            </button>
          </nav>
          {more && (
            <div className={s.moreMenu}>
              <button
                className={s.moreClose}
                onClick={() => setMore(false)}
                aria-label="Close more menu"
              >
                <X size={18} />
              </button>
              {[
                ["month", "Month"],
                ["year", "Year & goals"],
                ["completed", "Completed"],
                ["trash", "Trash"],
                ["settings", "Settings"],
              ].map(([id, label]) => (
                <button key={id} onClick={() => goto(id)}>
                  {label}
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {selected && store.mode !== "setup" && (
        <TaskEditor
          key={selected.id}
          task={selected}
          isNew={isNew}
          onClose={() => setSelected(null)}
        />
      )}
      {(store.canUndo || store.notice) && (
        <div className={s.toast} role="status">
          <span>
            {store.canUndo ? "Your change is saved locally." : store.notice}
          </span>
          {store.canUndo && <button onClick={store.undo}>Undo</button>}
          {store.notice && (
            <button
              aria-label="Dismiss notification"
              onClick={() => store.notify("")}
            >
              <X size={15} />
            </button>
          )}
        </div>
      )}
      <UpdatePrompt editing={!!selected || !!quick} />
    </div>
  );
}
