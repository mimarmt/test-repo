import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ANAHTARSIZ = "http://localhost:5199";
const ANAHTARLI = "http://localhost:5198";

const ornekParselMetni = readFileSync(
  fileURLToPath(new URL("../ornekler/ornek-parsel.json", import.meta.url)),
  "utf8"
);

function b64url(metin: string): string {
  return Buffer.from(metin, "utf8").toString("base64url");
}

test("anahtarsız açılış kilit ekranını gösterir ve konsol hatasızdır", async ({ page }) => {
  const sayfaHatalari: string[] = [];
  page.on("pageerror", (h) => sayfaHatalari.push(String(h)));
  await page.goto(`${ANAHTARSIZ}/`);
  await expect(page.locator("#kilit-ekrani")).toContainText("Google API anahtarı");
  await expect(page.locator("#kilit-ekrani")).toContainText("Map Tiles API");
  expect(sayfaHatalari).toEqual([]);
});

test("cesium statik dosyaları servis ediliyor (Workers)", async ({ request }) => {
  const yanit = await request.get(`${ANAHTARSIZ}/cesium/Workers/createVerticesFromHeightmap.js`);
  expect(yanit.status()).toBe(200);
});

test("parsel URL parametresiyle yüklenir ve panelde görünür", async ({ page }) => {
  await page.goto(`${ANAHTARLI}/?parsel=b64:${b64url(ornekParselMetni)}`);
  await expect(page.locator("#parsel-ozeti")).toContainText("1234 ada / 5 parsel", { timeout: 45_000 });
  await expect(page.locator("#parsel-ozeti")).toContainText("izmir-karsiyaka-1234-ada-5-parsel");
});

test("köprü: POST edilen paket GET ile okunur ve panel düğmesiyle yüklenir", async ({ page, request }) => {
  const bos = await request.get(`${ANAHTARLI}/api/parsel/son`);
  expect([200, 204]).toContain(bos.status());

  const gonder = await request.post(`${ANAHTARLI}/api/parsel`, {
    data: JSON.parse(ornekParselMetni),
  });
  expect(gonder.ok()).toBeTruthy();

  const son = await request.get(`${ANAHTARLI}/api/parsel/son`);
  expect(son.status()).toBe(200);
  const paket = await son.json();
  expect(paket.kimlik.ada).toBe("1234");

  await page.goto(`${ANAHTARLI}/`);
  await page.locator("#dg-parselpro").click();
  await expect(page.locator("#parsel-ozeti")).toContainText("1234 ada", { timeout: 45_000 });
});

test("bozuk parsel JSON'u Türkçe hata mesajı gösterir", async ({ page }) => {
  await page.goto(`${ANAHTARLI}/?parsel=b64:${b64url('{"surum":1}')}`);
  await expect(page.locator("#panel-mesaj")).toContainText("Parsel yüklenemedi", { timeout: 45_000 });
});
