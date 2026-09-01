import { Cartesian3, Color, DirectionalLight, JulianDate, Viewer } from "cesium";

/** Sahne güneşini verilen yerel saate (ISO, +03:00) göre konumlandırır. */
export function gunesAyarla(viewer: Viewer, iso: string): void {
  try {
    viewer.clock.currentTime = JulianDate.fromIso8601(iso);
    viewer.clock.shouldAnimate = false;
  } catch {
    // bozuk tarih gelirse güneşi olduğu yerde bırak
  }
}

/**
 * Sokak yakalaması görünümü: güneş yerine kameradan bakan ışık (gölgede kalan
 * cephe referans karede simsiyah çıkmasın) ve kırpma deliğinden görünen çıplak
 * küre için nötr gri taban (beyaz ızgara AI'yı yanıltıyordu).
 */
export function sokakGorunumuAc(viewer: Viewer): void {
  const fener = new DirectionalLight({ direction: Cartesian3.clone(viewer.scene.camera.directionWC) });
  viewer.scene.light = fener;
  viewer.scene.preRender.addEventListener(() => {
    Cartesian3.clone(viewer.scene.camera.directionWC, fener.direction);
  });
  viewer.scene.globe.baseColor = Color.fromCssColorString("#6b6b6b");
}
