import { JulianDate, Viewer } from "cesium";

/** Sahne güneşini verilen yerel saate (ISO, +03:00) göre konumlandırır. */
export function gunesAyarla(viewer: Viewer, iso: string): void {
  try {
    viewer.clock.currentTime = JulianDate.fromIso8601(iso);
    viewer.clock.shouldAnimate = false;
  } catch {
    // bozuk tarih gelirse güneşi olduğu yerde bırak
  }
}
