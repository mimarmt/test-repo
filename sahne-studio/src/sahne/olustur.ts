import {
  BoundingSphere,
  Cartesian3,
  Cesium3DTileset,
  ClassificationType,
  Color,
  GoogleMaps,
  HeadingPitchRange,
  Math as CMath,
  Viewer,
  createGooglePhotorealistic3DTileset,
} from "cesium";
import type { LonLat } from "../parsel/geometri";

export interface SahneNesneleri {
  viewer: Viewer;
  tileset: Cesium3DTileset;
}

export function kartesyenHalka(halka: LonLat[], yukseklikM = 0): Cartesian3[] {
  return halka.map(([lon, lat]) => Cartesian3.fromDegrees(lon, lat, yukseklikM));
}

/** Viewer + Google Photorealistic 3D Tiles kurulumu. Hata TR mesajla fırlatılır. */
export async function sahneKur(hedef: HTMLElement, anahtar: string): Promise<SahneNesneleri> {
  GoogleMaps.defaultApiKey = anahtar;

  const viewer = new Viewer(hedef, {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    navigationHelpButton: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    shadows: true,
    // yakalama için canvas'ın okunabilir kalması gerekir
    contextOptions: { webgl: { preserveDrawingBuffer: true } },
  });

  viewer.scene.globe.show = false;
  viewer.clock.shouldAnimate = false;
  viewer.shadowMap.softShadows = true;
  viewer.shadowMap.size = 4096;
  viewer.shadowMap.maximumDistance = 5000;

  let tileset: Cesium3DTileset;
  try {
    tileset = await createGooglePhotorealistic3DTileset();
  } catch (h) {
    viewer.destroy();
    throw new Error(
      "Google 3D dokusu yüklenemedi. Anahtarınızda Map Tiles API etkin mi? " +
        `(${h instanceof Error ? h.message : String(h)})`
    );
  }
  viewer.scene.primitives.add(tileset);
  return { viewer, tileset };
}

/** Parsel sınırını sahnede sarı çizgiyle gösterir (doku üzerine giydirilmiş). */
export function parselCiz(viewer: Viewer, halka: LonLat[]): void {
  viewer.entities.removeById("parsel-siniri");
  const kapali = [...halka, halka[0]];
  viewer.entities.add({
    id: "parsel-siniri",
    polyline: {
      positions: kartesyenHalka(kapali),
      width: 3,
      material: Color.YELLOW.withAlpha(0.9),
      clampToGround: true,
      classificationType: ClassificationType.CESIUM_3D_TILE,
    },
  });
}

/**
 * Parseli saran küre. yukseklikM verilmeden kurulan küre DENİZ SEVİYESİNDEDİR;
 * yüksek şehirlerde (Yenibosna ≈ 88 m) buna uçan kamera yerin altında kalır —
 * 27.08.2026'da ilk gerçek tıklamada yaşandı. Zemin ölçülür ölçülmez gerçek
 * kotla yeniden uçulmalı (uygulama.ts bunu yapar).
 */
export function parselKuresi(halka: LonLat[], yukseklikM = 0): BoundingSphere {
  return BoundingSphere.fromPoints(kartesyenHalka(halka, yukseklikM));
}

/**
 * Kamerayı parsele uçurur: 45° kuş bakışı, parsel çapının ~4 katı mesafe.
 * bakisDeg: kameranın BAKTIĞI yön (derece). Sokak cephesi kuralı: kamera sokak
 * tarafında durur, binaya bakar — uygulama bunu cephe yönünden türetip geçirir.
 * Verilmezse kuzeyden bakılır (eski davranış).
 */
export function parseleUc(
  viewer: Viewer,
  halka: LonLat[],
  aniden = false,
  yukseklikM = 0,
  bakisDeg = 0
): void {
  const kure = parselKuresi(halka, yukseklikM);
  viewer.camera.flyToBoundingSphere(kure, {
    offset: new HeadingPitchRange(CMath.toRadians(bakisDeg), CMath.toRadians(-45), Math.max(kure.radius * 4, 120)),
    duration: aniden ? 0 : 2.5,
  });
}

export function sahneMesaji(metin: string | null, tur: "uyari" | "hata" = "uyari"): void {
  const kutu = document.getElementById("sahne-mesaj");
  if (!kutu) return;
  if (metin === null) {
    kutu.hidden = true;
    return;
  }
  kutu.hidden = false;
  kutu.textContent = metin;
  kutu.className = tur === "hata" ? "hata" : "";
}
