export type TabKey =
  | "kalkulator"
  | "magazyn"
  | "historia"
  | "koszt"
  | "nesting2d"
  | "ustawienia";

export const TABS: { key: TabKey; label: string }[] = [
  { key: "kalkulator", label: "Kalkulator (1D)" },
  { key: "magazyn", label: "Magazyn" },
  { key: "historia", label: "Zamówienia / Historia" },
  { key: "koszt", label: "Koszt" },
  { key: "nesting2d", label: "Nesting 2D" },
  { key: "ustawienia", label: "Ustawienia" },
];
