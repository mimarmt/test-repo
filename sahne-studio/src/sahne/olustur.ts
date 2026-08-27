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

export function kartesyenHalka(halka: LonLat[]): Cartesian3[] {
  return Cartesian3.fromDegreesArray(halka.flat());
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

export function parselKuresi(halka: LonLat[]): BoundingSphere {
  return BoundingSphere.fromPoints(kartesyenHalka(halka));
}

/** Kamerayı parsele uçurur: 45° kuş bakışı, parsel çapının ~4 katı mesafe. */
export function parseleUc(viewer: Viewer, halka: LonLat[], aniden = false): void {
  const kure = parselKuresi(halka);
  viewer.camera.flyToBoundingSphere(kure, {
    offset: new HeadingPitchRange(0, CMath.toRadians(-45), Math.max(kure.radius * 4, 120)),
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
