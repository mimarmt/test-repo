import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

const cesiumKlasorleri = ["Workers", "ThirdParty", "Assets", "Widgets"];

// Parsel Pro Studio'nun parsel paketini ve 3D modelini bırakabileceği küçük yerel köprü.
// İkisi de bellekte tutulur; uygulama /api/parsel/son ve /api/model/son ile okur.
// Böylece "Sahne Studio'da Aç" tek tıkta parsel + model getirir (elle sürükleme yok).
function parselKoprusu(): Plugin {
  let sonPaket: string | null = null;
  let sonModel: { veri: Buffer; ad: string } | null = null;

  function isle(req: IncomingMessage, res: ServerResponse, next: () => void) {
    const url = req.url ?? "";
    if (!url.startsWith("/api/parsel") && !url.startsWith("/api/model")) return next();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Dosya-Adi");
    res.setHeader("Access-Control-Expose-Headers", "X-Dosya-Adi");
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

    // --- 3D model (GLB) ---
    if (req.method === "POST" && url === "/api/model") {
      const parcalar: Buffer[] = [];
      req.on("data", (p) => parcalar.push(p));
      req.on("end", () => {
        const veri = Buffer.concat(parcalar);
        // glTF ikili dosyası "glTF" sihirli sözcüğüyle başlar — yanlış dosyayı erken yakala
        if (veri.length < 12 || veri.toString("utf8", 0, 4) !== "glTF") {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          return res.end(JSON.stringify({ tamam: false, hata: "Geçerli bir .glb değil" }));
        }
        const ad = String(req.headers["x-dosya-adi"] ?? "parselpro_3d.glb");
        sonModel = { veri, ad };
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ tamam: true, bayt: veri.length, ad }));
      });
      return;
    }

    if (req.method === "GET" && url === "/api/model/son") {
      if (sonModel === null) {
        res.statusCode = 204;
        return res.end();
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "model/gltf-binary");
      res.setHeader("X-Dosya-Adi", sonModel.ad);
      return res.end(sonModel.veri);
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
