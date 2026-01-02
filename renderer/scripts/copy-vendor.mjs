import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function pkgDir(pkgName) {
  const p = require.resolve(`${pkgName}/package.json`);
  return path.dirname(p);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFileOrFail(from, to) {
  if (!fs.existsSync(from)) throw new Error(`Nie znaleziono pliku: ${from}`);
  fs.copyFileSync(from, to);
  console.log(`OK: ${path.basename(to)}`);
}

function findByNameRecursive(startDir, fileName) {
  const stack = [startDir];
  while (stack.length) {
    const dir = stack.pop();
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const it of items) {
      const full = path.join(dir, it.name);
      if (it.isDirectory()) stack.push(full);
      else if (it.isFile() && it.name === fileName) return full;
    }
  }
  return null;
}

const root = process.cwd(); // renderer/
const vendorDir = path.join(root, "public", "vendor");
ensureDir(vendorDir);

// --- xlsx ---
{
  const dir = pkgDir("xlsx");
  const direct = path.join(dir, "dist", "xlsx.full.min.js");
  const found = fs.existsSync(direct) ? direct : findByNameRecursive(dir, "xlsx.full.min.js");
  if (!found) throw new Error(`Nie mogę znaleźć xlsx.full.min.js w paczce xlsx`);
  copyFileOrFail(found, path.join(vendorDir, "xlsx.full.min.js"));
}

// --- xlsx-js-style ---
{
  const dir = pkgDir("xlsx-js-style");
  const direct = path.join(dir, "dist", "xlsx-js-style.min.js");
  const found = fs.existsSync(direct) ? direct : findByNameRecursive(dir, "xlsx-js-style.min.js");
  if (!found) throw new Error(`Nie mogę znaleźć xlsx-js-style.min.js w paczce xlsx-js-style`);
  copyFileOrFail(found, path.join(vendorDir, "xlsx-js-style.min.js"));
}

console.log("Vendor gotowy -> public/vendor/");
