import { Cesium3DTileset, ClippingPolygon, ClippingPolygonCollection, Scene } from "cesium";
import type { LonLat } from "../parsel/geometri";
import { kartesyenHalka } from "./olustur";

export function kirpmaDesteklenir(scene: Scene): boolean {
  return ClippingPolygonCollection.isSupported(scene);
}

/** Parsel poligonunu dokudan oyar: parseldeki mevcut bina/ağaç dokusu görünmez olur. */
export function kirpmaUygula(tileset: Cesium3DTileset, halka: LonLat[], acik: boolean): void {
  tileset.clippingPolygons = new ClippingPolygonCollection({
    polygons: [new ClippingPolygon({ positions: kartesyenHalka(halka) })],
    enabled: acik,
  });
}

export function kirpmaAcKapat(tileset: Cesium3DTileset, acik: boolean): void {
  if (tileset.clippingPolygons) tileset.clippingPolygons.enabled = acik;
}
