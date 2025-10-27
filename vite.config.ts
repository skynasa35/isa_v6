import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';

// ملاحظة: نقرأ من process.env (بيئة Actions/CI) مباشرة
export default defineConfig(() => {
  const GEMINI = process.env.VITE_GEMINI_API_KEY ?? '';
  const MAPTILER = process.env.VITE_MAPTILER_KEY ?? '';

  return {
    base: '/isa_v6/', // مهم لـ GitHub Pages
    define: {
      // توافق مع أي كود يقرأ process.env.*
      'process.env.API_KEY': JSON.stringify(GEMINI),
      'process.env.GEMINI_API_KEY': JSON.stringify(GEMINI),
      'process.env.MAPTILER_KEY': JSON.stringify(MAPTILER),
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      },
    },
    server: {
      host: true,
      port: 5283,
    },
  };
});
