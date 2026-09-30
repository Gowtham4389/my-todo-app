import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useStore } from "../context/Store";
import s from "../App.module.scss";
export default function UpdatePrompt({ editing }: { editing: boolean }) {
  const { pending } = useStore();
  const [unsaved, setUnsaved] = useState(false);
  useEffect(() => {
    const update = () =>
      setUnsaved(
        !!document.querySelector('dialog[open], [data-unsaved="true"]'),
      );
    const observer = new MutationObserver(update);
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["open", "data-unsaved"],
    });
    update();
    return () => observer.disconnect();
  }, []);
  const {
    needRefresh: [refresh, setRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!refresh) return null;
  return (
    <div className={s.updatePrompt} role="status">
      <span>
        A fresh version of Daymark is ready.
        {editing || unsaved || pending
          ? " Finish editing and sync before updating."
          : ""}
      </span>
      <button
        disabled={editing || unsaved || pending > 0}
        onClick={() => void updateServiceWorker(true)}
      >
        Update
      </button>
      <button onClick={() => setRefresh(false)}>Later</button>
    </div>
  );
}
