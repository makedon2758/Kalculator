import { useState } from "react";
import "./app.css";
import { type TabKey } from "./tabs";
import { AppShell } from "./AppShell/AppShell";
import { useReleaseNotes } from "../features/release-notes/model/useReleaseNotes";
import { ReleaseNotesModal } from "../features/release-notes/ui/ReleaseNotesModal";
import { SettingsPage } from "../features/settings/ui/SettingsPage";
import { CalculatorHubPage } from "../features/calculators/ui/CalculatorHubPage";

export default function App() {
  const [tab, setTab] = useState<TabKey>("kalkulator");

  const [rn, closeRn, openRn] = useReleaseNotes();
  
  return (
    <>
      <ReleaseNotesModal
        open={rn.open}
        version={rn.version}
        title={rn.title}
        items={rn.items}
        onClose={closeRn}
      />
        <AppShell version={rn.version} tab={tab} onTabChange={setTab}>
          {tab === "ustawienia" ? (
            <SettingsPage version={rn.version} onShowReleaseNotes={openRn} />
          ) : tab === "kalkulator" ? (
            <CalculatorHubPage />
          ) : (
            <div style={{ opacity: 0.9 }}>Wkrótce…</div>
          )}
        </AppShell>
    </>
  );
}
