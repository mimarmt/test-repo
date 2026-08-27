import {
  BoundingSphere,
  Camera,
  Cartesian3,
  Cartographic,
  HeadingPitchRange,
  Math as CMath,
  PerspectiveFrustum,
  Viewer,
} from "cesium";
import type { AciKamerasi } from "../semalar";
import { metreOtele, type LonLat } from "../parsel/geometri";

export type PresetAdi = "kus-45-kd" | "kus-45-gd" | "kus-45-gb" | "kus-45-kb" | "insan-gozu" | "cephe-dik";

export const PRESET_ETIKETLERI: Record<PresetAdi, string> = {
  "kus-45-kd": "Kuş bakışı 45° KD",
  "kus-45-gd": "Kuş bakışı 45° GD",
  "kus-45-gb": "Kuş bakışı 45° GB",
  "kus-45-kb": "Kuş bakışı 45° KB",
  "insan-gozu": "Sokak — insan gözü",
  "cephe-dik": "Cepheye dik",
};

export function aciSerilestir(camera: Camera): AciKamerasi {
  const k = camera.positionCartographic;
  const frustum = camera.frustum as PerspectiveFrustum;
  return {
    lon: CMath.toDegrees(k.longitude),
    lat: CMath.toDegrees(k.latitude),
    yukseklikM: k.height,
    headingDeg: CMath.toDegrees(camera.heading),
    pitchDeg: CMath.toDegrees(camera.pitch),
    rollDeg: CMath.toDegrees(camera.roll),
    fovDeg: typeof frustum.fov === "number" ? CMath.toDegrees(frustum.fov) : 60,
  };
}

/** setView parametreleri — saf fonksiyon, birim testte gidiş-dönüşü doğrulanır. */
export function aciUygulaParametreleri(aci: AciKamerasi): {
  destination: Cartesian3;
  orientation: { heading: number; pitch: number; roll: number };
} {
  return {
    destination: Cartesian3.fromDegrees(aci.lon, aci.lat, aci.yukseklikM),
    orientation: {
      heading: CMath.toRadians(aci.headingDeg),
      pitch: CMath.toRadians(aci.pitchDeg),
      roll: CMath.toRadians(aci.rollDeg),
    },
  };
}

/** Kartesyen konumdan geri açı koordinatı — testte gidiş-dönüş için. */
export function kartesyendenKoordinat(konum: Cartesian3): { lon: number; lat: number; yukseklikM: number } {
  const k = Cartographic.fromCartesian(konum);
  return { lon: CMath.toDegrees(k.longitude), lat: CMath.toDegrees(k.latitude), yukseklikM: k.height };
}

export function aciGeriYukle(viewer: Viewer, aci: AciKamerasi): void {
  viewer.camera.setView(aciUygulaParametreleri(aci));
  const frustum = viewer.camera.frustum as PerspectiveFrustum;
  if (typeof frustum.fov === "number") frustum.fov = CMath.toRadians(aci.fovDeg);
}

export interface PresetBaglami {
  kure: BoundingSphere;
  merkez: LonLat;
  zeminM: number;
  cepheDeg: number;
}

export function presetUcus(viewer: Viewer, ad: PresetAdi, baglam: PresetBaglami): void {
  const { kure, merkez, zeminM, cepheDeg } = baglam;
  const kusMesafesi = Math.max(kure.radius * 3.2, 90);

  const kusBakisi = (headingDeg: number) =>
    viewer.camera.flyToBoundingSphere(kure, {
      offset: new HeadingPitchRange(CMath.toRadians(headingDeg), CMath.toRadians(-42), kusMesafesi),
      duration: 1.4,
    });

  switch (ad) {
    case "kus-45-kd":
      return void kusBakisi(45);
    case "kus-45-gd":
      return void kusBakisi(135);
    case "kus-45-gb":
      return void kusBakisi(225);
    case "kus-45-kb":
      return void kusBakisi(315);
    case "insan-gozu": {
      // Sokak, uzun eksenin cephe yönünde varsayılır (dar-derin parsellerde ön
      // cephe kısa kenardır). Mimarın sokak karesi: kamera KARŞI kaldırımda ve
      // sokak boyunca yana kaymış durur (3/4 kompozisyon) — cephe tam kadraj
      // doldurmaz, komşu binalar ve sokak perspektifi karede kalır. setView
      // yerine flyTo: tek tuşla "sokağa iniş" hissi (Murat kuralı, 27.08).
      const bakisYonu = cepheDeg % 360;
      // Dar sokak gerçeği (27.08 ölçümü): parselden ~+12 m ötesi çoğu kez KARŞI
      // binanın içidir; kamera oraya girerse yakın doku görünmez olur. Güvenli
      // bölge sokak koridorudur: yol ortasına çık (yarıçap + ~5 m), sonra sokak
      // BOYUNCA yana kay — aşağıdan yukarı bakan 3/4 mimar karesi.
      const sokakUzakM = kure.radius + 5;
      const yanKaymaM = Math.max(kure.radius * 1.8, 14);
      const sokakOrta = metreOtele(merkez, sokakUzakM, bakisYonu);
      const konum = metreOtele(sokakOrta, yanKaymaM, (bakisYonu + 90) % 360);
      // Kameradan parsel merkezine bakış yönü (eşdikdörtgen yaklaşım yeterli):
      const dDogu = (merkez[0] - konum[0]) * Math.cos(CMath.toRadians(merkez[1])) * 111320;
      const dKuzey = (merkez[1] - konum[1]) * 111132;
      const merkezeBakis = (CMath.toDegrees(Math.atan2(dDogu, dKuzey)) + 360) % 360;
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(konum[0], konum[1], zeminM + 1.7),
        orientation: {
          heading: CMath.toRadians(merkezeBakis),
          pitch: CMath.toRadians(10),
          roll: 0,
        },
        duration: 2.2,
      });
      return;
    }
    case "cephe-dik": {
      const bakisYonu = cepheDeg % 360;
      const konum = metreOtele(merkez, Math.max(kure.radius * 3.5, 45), bakisYonu);
      viewer.camera.flyTo({
        destination: Cartesian3.fromDegrees(konum[0], konum[1], zeminM + Math.max(kure.radius * 0.9, 12)),
        orientation: {
          heading: CMath.toRadians((bakisYonu + 180) % 360),
          pitch: CMath.toRadians(-12),
          roll: 0,
        },
        duration: 1.6,
      });
      return;
    }
  }
}
