import { useEffect, useState } from "react";
import { RELEASE_NOTES } from "./releaseNotes";

type State = {
  version: string;
  open: boolean;
  title: string;
  items: string[];
};

const FALLBACK = {
  title: "Aktualizacja do wersji",
  items: ["Zmiany w tej wersji zostaną dodane później.."],
};

function notesFor(version: string) {
  const n = RELEASE_NOTES[version];
  if (n) return { title: n.title, items: n.items };
  return { title: `${FALLBACK.title} ${version}`, items: FALLBACK.items };
}

export function useReleaseNotes(): [State, () => void, () => void] {
  const [state, setState] = useState<State>({
    version: "0.0.0",
    open: false,
    title: "",
    items: [],
  });

  useEffect(() => {
    (async () => {
      const version =
        (await window.KC?.getVersion?.().catch(() => "0.0.0")) || "0.0.0";

      const lastSeen = localStorage.getItem("kc:lastSeenVersion");

      // 1) Первый запуск: фиксируем версию и НЕ показываем
      if (!lastSeen) {
        localStorage.setItem("kc:lastSeenVersion", version);
        setState((s) => ({ ...s, version, open: false }));
        return;
      }

      // 2) Реальное обновление: показываем
      if (lastSeen !== version) {
        const n = notesFor(version);
        setState({ version, open: true, title: n.title, items: n.items });
        return;
      }

      // 3) Обновления нет
      setState((s) => ({ ...s, version, open: false }));
    })();
  }, []);

  function close() {
    setState((s) => {
      localStorage.setItem("kc:lastSeenVersion", s.version);
      return { ...s, open: false };
    });
  }

  // Ручное открытие “Co nowego”
  function openNow() {
    setState((s) => {
      const n = notesFor(s.version);
      return { ...s, open: true, title: n.title, items: n.items };
    });
  }

  return [state, close, openNow];
}
