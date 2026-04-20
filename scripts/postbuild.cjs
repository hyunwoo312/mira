/**
 * Post-build cleanup for the Chrome extension.
 *
 * Removes duplicate ONNX Runtime WASM files from assets/.
 * Vite emits a copy via asset import, but ORT loads from the root
 * via wasmPaths. Only exact duplicates of the root copy are removed —
 * the pthread variant (different hash) is kept since ORT needs it.
 */
const fs = require('fs');
const path = require('path');

const buildDir = path.join('.output', 'chrome-mv3');
const assetsDir = path.join(buildDir, 'assets');
const rootWasm = path.join(buildDir, 'ort-wasm-simd-threaded.jsep.wasm');

try {
  const rootData = fs.readFileSync(rootWasm);
  let removed = 0;

  for (const file of fs.readdirSync(assetsDir)) {
    if (!file.includes('ort-wasm') || !file.endsWith('.wasm')) continue;

    const assetPath = path.join(assetsDir, file);
    const assetData = fs.readFileSync(assetPath);

    if (Buffer.compare(rootData, assetData) === 0) {
      fs.unlinkSync(assetPath);
      removed++;
      console.log(
        `  Removed duplicate: assets/${file} (${(assetData.length / 1024 / 1024).toFixed(0)}MB)`,
      );
    } else {
      console.log(
        `  Kept: assets/${file} (${(assetData.length / 1024 / 1024).toFixed(0)}MB, different variant)`,
      );
    }
  }

  if (removed === 0) {
    console.log('  No duplicate WASM files found');
  }
} catch {
  // Build dir may not exist or no WASM files present
}
