import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

const cesiumKlasorleri = ["Workers", "ThirdParty", "Assets", "Widgets"];

// Parsel Pro Studio'nun parsel paketini bırakabileceği küçük yerel köprü.
// Paket bellekte tutulur; uygulama "Parsel Pro'dan Al" ile /api/parsel/son'u okur.
function parselKoprusu(): Plugin {
  let sonPaket: string | null = null;

  function isle(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const url = req.url ?? "";
    if (!url.startsWith("/api/parsel")) return next();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      return res.end();
    }

    if (req.method === "POST" && url === "/api/parsel") {
      const parcalar: Buffer[] = [];
      req.on("data", (p) => parcalar.push(p));
      req.on("end", () => {
        const govde = Buffer.concat(parcalar).toString("utf8");
        try {
          JSON.parse(govde);
        } catch {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          return res.end(JSON.stringify({ tamam: false, hata: "Geçersiz JSON" }));
        }
        sonPaket = govde;
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ tamam: true }));
      });
      return;
    }

    if (req.method === "GET" && url === "/api/parsel/son") {
      if (sonPaket === null) {
        res.statusCode = 204;
        return res.end();
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      return res.end(sonPaket);
    }

    next();
  }

  return {
    name: "parsel-koprusu",
    configureServer(server) {
      server.middlewares.use(isle);
    },
    configurePreviewServer(server) {
      server.middlewares.use(isle);
    },
  };
}

export default defineConfig({
  define: {
    CESIUM_BASE_URL: JSON.stringify("/cesium"),
  },
  plugins: [
    viteStaticCopy({
      targets: cesiumKlasorleri.map((klasor) => ({
        src: `node_modules/cesium/Build/Cesium/${klasor}/*`,
        dest: `cesium/${klasor}`,
      })),
    }),
    parselKoprusu(),
  ],
  server: {
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 5000,
  },
})
