import { defineConfig } from "@playwright/test";

// İki sunucu: 5199 anahtarsız (kilit ekranı testi), 5198 sahte anahtarlı (panel/köprü testleri).
// Gerçek ortam değişkenleri .env'den gelse bile buradaki env değerleri onları ezer.
export default defineConfig({
  testDir: "test",
  testMatch: /.*\.spec\.ts/,
  timeout: 90_000,
  retries: 0,
  use: {
    launchOptions: {
      // GPU'suz makinelerde (CI/konteyner) WebGL için yazılım render'ına izin ver
      args: ["--enable-unsafe-swiftshader", "--hide-scrollbars"],
    },
  },
  webServer: [
    {
      command: "npm run dev -- --port 5199 --strictPort",
      port: 5199,
      reuseExistingServer: false,
      env: { VITE_GOOGLE_API_KEY: "" },
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --port 5198 --strictPort",
      port: 5198,
      reuseExistingServer: false,
      env: { VITE_GOOGLE_API_KEY: "SMOKE-TEST-ANAHTARI" },
      timeout: 120_000,
    },
  ],
});
