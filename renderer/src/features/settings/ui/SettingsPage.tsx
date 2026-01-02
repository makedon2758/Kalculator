import "./SettingsPage.css";

type Props = {
  version: string;
  onShowReleaseNotes: () => void;
};

export function SettingsPage({ version, onShowReleaseNotes }: Props) {
  return (
    <div className="settings">
      <div className="settingsTitle">Ustawienia</div>

      <div className="settingsCard">
        <div className="settingsRow">
          <div className="settingsLabel">Wersja aplikacji</div>
          <div className="settingsValue">v{version}</div>
        </div>

        <div className="settingsRow">
          <div className="settingsLabel">Co nowego</div>
          <button className="settingsBtn" onClick={onShowReleaseNotes} type="button">
            Pokaż
          </button>
        </div>
      </div>

      <div className="settingsHint">
        Примечание: “Co nowego” доступно вручную всегда, даже без обновления.
      </div>
    </div>
  );
}
