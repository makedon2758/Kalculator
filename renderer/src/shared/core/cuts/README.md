# cuts core (legacy 1:1)

Folder contains the **unchanged** core logic copied from legacy:
- calc.js
- type.js

React UI should import from `shared/core/cuts/index.ts`.
Later we can split/refactor the internals, keeping stable exports.
