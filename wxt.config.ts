import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Mira',
    description: 'Job application auto-fill',
    permissions: [
      'activeTab',
      'tabs',
      'sidePanel',
      'storage',
      'offscreen',
      'unlimitedStorage',
      'scripting',
      'webNavigation',
    ],
    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      48: 'icon-48.png',
      96: 'icon-96.png',
      128: 'icon-128.png',
    },
    host_permissions: ['<all_urls>'],
    // wasm-unsafe-eval is required for ONNX Runtime (ort-wasm-simd-threaded)
    // which powers the on-device ML model for form field classification.
    // No remote code is loaded — all WASM binaries are bundled with the extension.
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
    web_accessible_resources: [
      {
        resources: ['models/unified/*', 'models/unified/onnx/*'],
        matches: ['<all_urls>'],
      },
    ],
  },
});
