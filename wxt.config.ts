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
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
    web_accessible_resources: [
      {
        resources: ['models/field-classifier/*', 'models/embeddings/*', 'models/embeddings/onnx/*'],
        matches: ['<all_urls>'],
      },
    ],
  },
});
