import {
  Cartesian3,
  Cartographic,
  ConstantPositionProperty,
  ConstantProperty,
  Entity,
  HeadingPitchRoll,
  Math as CMath,
  Matrix4,
  Model,
  Scene,
  ShadowMode,
  Transforms,
  Viewer,
} from "cesium";
import { yaklasikCapM, type LonLat } from "../parsel/geometri";

export interface ZeminSatiri {
  ad: string;
  lon: number;
  lat: number;
  yukseklikM: number | null;
}

export interface ZeminOrnekleme {
  satirlar: ZeminSatiri[];
  medyan: number | null;
  egimYuzde: number | null;
}

/**
 * Parsel merkezinin ve köşelerinin zemin kotunu Google dokusundan örnekler.
 * Kapsama dışında kalan noktalar null döner; medyan yalnız geçerli değerlerden hesaplanır.
 */
export async function zeminOrnekle(scene: Scene, halka: LonLat[], merkez: LonLat): Promise<ZeminOrnekleme> {
  if (!scene.sampleHeightSupported) {
    return { satirlar: [], medyan: null, egimYuzde: null };
  }
  const adlar = ["Merkez", ...halka.map((_, i) => `Köşe ${i + 1}`)];
  const konumlar = [merkez, ...halka];

  let sonuc: (Cartographic | undefined)[] = [];
  for (let deneme = 0; deneme < 2 && sonuc.length === 0; deneme++) {
    try {
      const kartografikler = konumlar.map(([lon, lat]) => Cartographic.fromDegrees(lon, lat));
      sonuc = await scene.sampleHeightMostDetailed(kartografikler);
    } catch {
      sonuc = [];
    }
  }

  const satirlar: ZeminSatiri[] = konumlar.map(([lon, lat], i) => {
    const k = sonuc[i];
    const y = k && Number.isFinite(k.height) ? k.height : null;
    return { ad: adlar[i], lon, lat, yukseklikM: y };
  });

  const gecerli = satirlar.map((s) => s.yukseklikM).filter((y): y is number => y !== null);
  let medyan: number | null = null;
  let egimYuzde: number | null = null;
  if (gecerli.length > 0) {
    const sirali = [...gecerli].sort((a, b) => a - b);
    const orta = Math.floor(sirali.length / 2);
    medyan = sirali.length % 2 === 1 ? sirali[orta] : (sirali[orta - 1] + sirali[orta]) / 2;
    const cap = yaklasikCapM(halka);
    if (cap > 1) egimYuzde = ((sirali[sirali.length - 1] - sirali[0]) / cap) * 100;
  }
  return { satirlar, medyan, egimYuzde };
}

export interface ModelAyari {
  uri: string;
  lon: number;
  lat: number;
  yukseklikM: number;
  headingDeg: number;
  olcek: number;
}

function konumHesapla(ayar: ModelAyari): Cartesian3 {
  return Cartesian3.fromDegrees(ayar.lon, ayar.lat, ayar.yukseklikM);
}

function yonHesapla(konum: Cartesian3, headingDeg: number) {
  const hpr = new HeadingPitchRoll(CMath.toRadians(headingDeg), 0, 0);
  return Transforms.headingPitchRollQuaternion(konum, hpr);
}

/** Etkileşimli mod: entity olarak yerleştirir; kaydırıcılar yerlesimGuncelle ile oynatır. */
export function modelYerlestirEntity(viewer: Viewer, ayar: ModelAyari): Entity {
  viewer.entities.removeById("sahne-modeli");
  const konum = konumHesapla(ayar);
  return viewer.entities.add({
    id: "sahne-modeli",
    position: konum,
    orientation: yonHesapla(konum, ayar.headingDeg),
    model: {
      uri: ayar.uri,
      scale: ayar.olcek,
      shadows: ShadowMode.ENABLED,
    },
  });
}

export function yerlesimGuncelle(entity: Entity, ayar: ModelAyari): void {
  const konum = konumHesapla(ayar);
  entity.position = new ConstantPositionProperty(konum);
  entity.orientation = new ConstantProperty(yonHesapla(konum, ayar.headingDeg));
  if (entity.model) entity.model.scale = new ConstantProperty(ayar.olcek);
}

/** Yakalama modu: primitive Model — readyEvent ile yüklenme kesin olarak beklenir. */
export async function modelYerlestirPrimitive(viewer: Viewer, ayar: ModelAyari): Promise<Model> {
  const konum = konumHesapla(ayar);
  const hpr = new HeadingPitchRoll(CMath.toRadians(ayar.headingDeg), 0, 0);
  const matris = Transforms.headingPitchRollToFixedFrame(konum, hpr);
  Matrix4.multiplyByUniformScale(matris, ayar.olcek, matris);
  const model = await Model.fromGltfAsync({
    url: ayar.uri,
    modelMatrix: matris,
    shadows: ShadowMode.ENABLED,
  });
  viewer.scene.primitives.add(model);
  await new Promise<void>((coz, reddet) => {
    model.readyEvent.addEventListener(() => coz());
    model.errorEvent.addEventListener((h) => reddet(h instanceof Error ? h : new Error(String(h))));
  });
  return model;
}
