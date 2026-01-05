// legacy/raport1d/import/setup.js
import { readFileAsGrid } from './readers.js';
import { stripStopnieRowsFromGrid } from './stopnieFilter.js';
import { rowsToOrders } from './orders.js';

export function setupImport({ buttonId, inputId, onGrid, onOrders }) {
  const btn = document.getElementById(buttonId);
  const fileInput = document.getElementById(inputId);
  if (!btn || !fileInput) return;

  // Guard: React StrictMode mounts twice in dev -> avoid двойное навешивание listeners
  const __k = 'kcImportBound';
  if (btn.dataset?.[__k] === '1' || fileInput.dataset?.[__k] === '1') return;
  btn.dataset[__k] = '1';
  fileInput.dataset[__k] = '1';

  // Klik w przycisk -> otwieramy wybór pliku
  btn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // 1) Czytamy plik jako grid (nagłówki + surowe wiersze)
      const rawGrid = await readFileAsGrid(file); // { headers, rows }
      const grid = stripStopnieRowsFromGrid(rawGrid);

      if (typeof onGrid === 'function') onGrid(grid);


      // 2) Konwertujemy na zamówienia (L/B/szt) z odrzuceniem stopni
      const orders = rowsToOrders(grid.headers, grid.rows);
      if (typeof onOrders === "function") {
        onOrders(orders);
      }

      // 3) Jeśli tabelę udało się wczytać, ale nie znaleźliśmy L/B/szt
      if (
        (!orders || !orders.length) &&
        Array.isArray(grid.rows) &&
        grid.rows.length > 0
      ) {
        alert(
          "Plik został załadowany, ale nie udało się rozpoznać kolumn L/B/szt.\n" +
          "Tabela została zaimportowana, ale kalkulator nie może policzyć detali automatycznie."
        );
      }
    } catch (err) {
      console.error(err);
      alert("Nie udało się odczytać pliku:\n" + (err?.message || err));
    } finally {
      // żeby móc wybrać ten sam plik drugi raz
      e.target.value = "";
    }
  });
}
