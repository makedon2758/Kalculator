import "./ReleaseNotesModal.css";

type Props = {
  open: boolean;
  version: string;
  title: string;
  items: string[];
  onClose: () => void;
};

export function ReleaseNotesModal({ open, version, title, items, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="rnBackdrop" role="dialog" aria-modal="true">
      <div className="rnModal">
        <div className="rnTitle">{title}</div>
        <div className="rnMeta">v{version}</div>

        <ul className="rnList">
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>

        <div className="rnActions">
          <button className="rnBtn" onClick={onClose} type="button">
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}
