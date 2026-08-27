import { defineConfig } from "vitest/config";

// Birim testleri yalnız *.test.ts dosyalarıdır; *.spec.ts Playwright'a aittir (npm run smoke).
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
});
