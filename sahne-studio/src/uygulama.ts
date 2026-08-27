import type { Entity } from "cesium";
import { b64UrlCoz } from "./yardimci/b64";
import type { UrlBayraklari } from "./yardimci/ortam";
import { paneliKur, type PanelApi } from "./arayuz/panel";
import {
  ParselAlmaHatasi,
  dosyadanParselAl,
  koprudenParselAl,
  metindenParselAl,
  urldenParselAl,
} from "./parsel/al";
import { enUzunKenarAcisi, merkezHesapla, metreKaydir, type LonLat } from "./parsel/geometri";
import { projeDogrula, type SahneProje } from "./semalar";
import { ProjeDurumu } from "./durum/proje";
import {
  parselCiz,
  parselKuresi,
  parseleUc,
  sahneKur,
  sahneMesaji,
  type SahneNesneleri,
} from "./sahne/olustur";
import { kirpmaAcKapat, kirpmaDesteklenir, kirpmaUygula } from "./sahne/kirpma";
import {
  modelYerlestirEntity,
  modelYerlestirPrimitive,
  yerlesimGuncelle,
  zeminOrnekle,
  type ModelAyari,
  type ZeminOrnekleme,
} from "./sahne/model";
import { gunesAyarla } from "./sahne/gunes";
import {
  PRESET_ETIKETLERI,
  aciGeriYukle,
  aciSerilestir,
  presetUcus,
} from "./sahne/kamera";
import { atifMetni, blobIndir, kareYakala, stabilBekle } from "./sahne/yakala";

export async function uygulamayiBaslat(anahtar: string, bayraklar: UrlBayraklari): Promise<void> {
  if (bayraklar.yakalaModu) {
    return yakalaModunuBaslat(anahtar, bayraklar);
  }
  return normalModuBaslat(anahtar, bayraklar);
}

async function normalModuBaslat(anahtar: string, bayraklar: UrlBayraklari): Promise<void> {
  const durum = new ProjeDurumu();
  let sahne: SahneNesneleri | null = null;
  let halka: LonLat[] | null = null;
  let merkez: LonLat | null = null;
  let cepheDeg = 0;
  let zemin: ZeminOrnekleme | null = null;
  let modelEntity: Entity | null = null;
  let glbUri: string | null = null;
  let kirpAcik = true;
  let sonPresetEtiketi: string | null = null;

  function hataMetni(h: unknown): string {
    if (h instanceof ParselAlmaHatasi) return h.hatalar.join(" · ");
    return h instanceof Error ? h.message : String(h);
  }

  function aktifModelAyari(): ModelAyari | null {
    const m = durum.proje?.model;
    if (!m || !glbUri) return null;
    const [lon, lat] = m.kaydirma
      ? metreKaydir(m.konum.lon, m.konum.lat, m.kaydirma.doguM, m.kaydirma.kuzeyM)
      : [m.konum.lon, m.konum.lat];
    return {
      uri: glbUri,
      lon,
      lat,
      yukseklikM: m.konum.zeminMedyanM + m.yukseklikOfsetM,
      headingDeg: m.headingDeg,
      olcek: m.olcek,
    };
  }

  /** GLB'yi sahneye koyar — hem sürükle-bırak hem köprüden otomatik gelen model bunu kullanır. */
  function glbUygula(dosya: File): void {
    if (!durum.proje || !halka || !merkez) {
      panel.mesaj("Önce parsel yükleyin, sonra modeli bırakın.", "hata");
      return;
    }
    if (!sahne) {
      panel.mesaj("3D sahne hazır değil — model yerleştirilemiyor.", "hata");
      return;
    }
      if (glbUri) URL.revokeObjectURL(glbUri);
      glbUri = URL.createObjectURL(dosya);

      const onceki = durum.proje.model;
      const zeminMedyan = zemin?.medyan ?? onceki?.konum.zeminMedyanM ?? 0;
      const model = {
        dosyaAdi: dosya.name,
        konum: onceki?.konum ?? { lon: merkez[0], lat: merkez[1], zeminMedyanM: zeminMedyan },
        headingDeg: onceki?.headingDeg ?? cepheDeg,
        yukseklikOfsetM: onceki?.yukseklikOfsetM ?? 0,
        olcek: onceki?.olcek ?? 1,
        kaydirma: onceki?.kaydirma ?? { doguM: 0, kuzeyM: 0 },
        zeminOrneklemesi: zemin
          ? {
              yontem: "medyan",
              noktalar: zemin.satirlar.map((s) => ({ ad: s.ad, lon: s.lon, lat: s.lat, yukseklikM: s.yukseklikM })),
              egimYuzde: zemin.egimYuzde,
            }
          : onceki?.zeminOrneklemesi,
      };
      model.konum.zeminMedyanM = zeminMedyan;
      durum.modelAyarla(model);

      const ayar = aktifModelAyari();
      if (ayar) modelEntity = modelYerlestirEntity(sahne.viewer, ayar);
      panel.yerlesimGoster(model.headingDeg, model.yukseklikOfsetM, model.olcek, model.kaydirma);
      panel.modelDurumuGoster(`${dosya.name} sahnede — yönü ve kotu kaydırıcılarla ayarlayın.`);
      if (zeminMedyan === 0 && zemin?.medyan === null) {
        panel.mesaj("Zemin kotu bilinmiyor: model 0 kotuna kondu, kot ofsetiyle elle ayarlayın.", "hata");
      }
  }

  function modeliTazele(): void {
    const ayar = aktifModelAyari();
    if (modelEntity && ayar) yerlesimGuncelle(modelEntity, ayar);
  }

  /** Proje nesnesini arayüze ve sahneye uygular (durum'a dokunmaz). */
  async function projeUygula(proje: SahneProje, depodanGeldi: boolean): Promise<void> {
    halka = proje.parsel.geometri.coordinates[0].map((k) => [k[0], k[1]] as LonLat);
    merkez = merkezHesapla(halka);
    cepheDeg = enUzunKenarAcisi(halka);
    zemin = null;

    panel.parselOzetiGoster(proje.parsel, proje.parselSlug);
    panel.gunesGoster(proje.gunesISO);
    panel.acilariGoster(proje.acilar);
    if (proje.model) {
      panel.yerlesimGoster(proje.model.headingDeg, proje.model.yukseklikOfsetM, proje.model.olcek, proje.model.kaydirma);
      panel.modelDurumuGoster(
        depodanGeldi
          ? `Kayıtlı yerleşim bulundu — "${proje.model.dosyaAdi}" dosyasını tekrar bırakın.`
          : `${proje.model.dosyaAdi} bekleniyor — GLB'yi bırakın.`
      );
    } else {
      panel.yerlesimGoster(cepheDeg, 0, 1);
      panel.modelDurumuGoster("Model bekleniyor.");
    }

    if (sahne) {
      const { viewer, tileset } = sahne;
      gunesAyarla(viewer, proje.gunesISO);
      parselCiz(viewer, halka);
      parseleUc(viewer, halka);
      if (kirpmaDesteklenir(viewer.scene)) {
        kirpmaUygula(tileset, halka, kirpAcik);
      } else {
        sahneMesaji("Bu tarayıcıda bina silme (clipping) desteklenmiyor — WebGL2 gerekli.");
      }
      panel.zeminTablosuGoster([{ ad: "Zemin örnekleniyor…", yukseklikM: null }], null);
      zemin = await zeminOrnekle(viewer.scene, halka, merkez);
      panel.zeminTablosuGoster(
        zemin.satirlar.map((s) => ({ ad: s.ad, yukseklikM: s.yukseklikM })),
        zemin.egimYuzde
      );
      if (zemin.medyan === null) {
        panel.mesaj("Zemin kotu örneklenemedi — parsel Google 3D kapsamı dışında olabilir.", "hata");
      } else if (durum.proje?.model && Math.abs(durum.proje.model.konum.zeminMedyanM) < 0.001) {
        durum.proje.model.konum.zeminMedyanM = zemin.medyan;
        durum.kaydet();
        modeliTazele();
      }

      // Parsel Pro köprüsünden gelen model: kullanıcı GLB'yi elle sürüklemesin.
      // Zemin örneklemesi bittikten sonra çekilir ki model doğru kota otursun.
      if (bayraklar.glbUrl && !modelEntity) await koprudekiModeliYukle(bayraklar.glbUrl);
    }
  }

  /** Köprüdeki (ya da verilen adresteki) GLB'yi indirip sahneye koyar. */
  async function koprudekiModeliYukle(adres: string): Promise<void> {
    try {
      const yanit = await fetch(adres);
      if (yanit.status === 204) {
        panel.modelDurumuGoster("Köprüde bekleyen model yok — GLB'yi bırakabilirsiniz.");
        return;
      }
      if (!yanit.ok) throw new Error(`sunucu ${yanit.status}`);
      const veri = await yanit.blob();
      const ad = yanit.headers.get("X-Dosya-Adi") ?? "parselpro_3d.glb";
      glbUygula(new File([veri], ad, { type: "model/gltf-binary" }));
      panel.mesaj("Model Parsel Pro'dan otomatik alındı.");
    } catch (h) {
      panel.mesaj(`Model köprüden alınamadı: ${hataMetni(h)}`, "hata");
    }
  }

  async function parselYukle(paketVeren: () => Promise<import("./semalar").ParselPaketi | null>): Promise<void> {
    try {
      const paket = await paketVeren();
      if (!paket) return;
      const { proje, depodanGeldi } = durum.parselAyarla(paket);
      await projeUygula(proje, depodanGeldi);
      if (depodanGeldi) panel.mesaj("Bu parsel için kayıtlı çalışma geri yüklendi.");
    } catch (h) {
      panel.mesaj(`Parsel yüklenemedi: ${hataMetni(h)}`, "hata");
    }
  }

  const panel: PanelApi = paneliKur(document.getElementById("panel")!, {
    parselDosyasiVerildi: (dosya) => void parselYukle(() => dosyadanParselAl(dosya)),
    parselMetniVerildi: (metin) => void parselYukle(async () => metindenParselAl(metin)),
    parselProdanAl: () =>
      void parselYukle(async () => {
        const paket = await koprudenParselAl();
        if (!paket) {
          panel.mesaj("Köprüde bekleyen parsel yok — Parsel Pro Studio'dan gönderin (README'de protokol).");
        }
        return paket;
      }),

    glbVerildi: (dosya) => glbUygula(dosya),

    headingDegisti: (deg) => {
      durum.modelGuncelle({ headingDeg: deg });
      modeliTazele();
    },
    kotOfsetiDegisti: (m) => {
      durum.modelGuncelle({ yukseklikOfsetM: m });
      modeliTazele();
    },
    kaydirmaDegisti: (doguM, kuzeyM) => {
      durum.modelGuncelle({ kaydirma: { doguM, kuzeyM } });
      modeliTazele();
    },
    olcekDegisti: (olcek) => {
      durum.modelGuncelle({ olcek });
      modeliTazele();
    },

    gunesDegisti: (iso) => {
      durum.gunesAyarla(iso);
      if (sahne) gunesAyarla(sahne.viewer, iso);
    },

    presetSecildi: (ad) => {
      if (!sahne || !halka || !merkez) return;
      sonPresetEtiketi = PRESET_ETIKETLERI[ad];
      presetUcus(sahne.viewer, ad, {
        kure: parselKuresi(halka),
        merkez,
        zeminM: zemin?.medyan ?? 0,
        cepheDeg: durum.proje?.model?.headingDeg ?? cepheDeg,
      });
    },

    mevcutBinaGizleDegisti: (acik) => {
      kirpAcik = acik;
      if (!sahne || !halka) return;
      if (sahne.tileset.clippingPolygons) kirpmaAcKapat(sahne.tileset, acik);
      else if (kirpmaDesteklenir(sahne.viewer.scene)) kirpmaUygula(sahne.tileset, halka, acik);
    },

    aciOnayla: () => {
      if (!sahne || !durum.proje) {
        panel.mesaj("Önce parsel yükleyip sahneyi ayarlayın.", "hata");
        return;
      }
      const kamera = aciSerilestir(sahne.viewer.camera);
      const kayit = durum.aciEkle(kamera, sonPresetEtiketi ?? "Serbest açı");
      panel.acilariGoster(durum.proje.acilar);
      panel.mesaj(`Açı ${String(kayit.aciNo).padStart(2, "0")} onaylandı ve projeye kaydedildi.`);
      sonPresetEtiketi = null;
    },
    aciGit: (aciNo) => {
      const kayit = durum.aciBul(aciNo);
      if (!kayit || !sahne) return;
      gunesAyarla(sahne.viewer, kayit.gunesISO);
      panel.gunesGoster(kayit.gunesISO);
      aciGeriYukle(sahne.viewer, kayit.kamera);
    },
    aciSil: (aciNo) => {
      durum.aciSil(aciNo);
      if (durum.proje) panel.acilariGoster(durum.proje.acilar);
    },

    jpgIndir: () => {
      if (!sahne || !durum.proje) {
        panel.mesaj("Sahne hazır değil.", "hata");
        return;
      }
      panel.mesaj("4K kare hazırlanıyor — doku netleşene kadar birkaç saniye sürebilir…");
      void kareYakala(sahne.viewer, sahne.tileset)
        .then((blob) => {
          blobIndir(blob, `${durum.proje!.parselSlug}-onizleme.jpg`);
          panel.mesaj("JPG indirildi.");
        })
        .catch((h) => panel.mesaj(`Yakalama başarısız: ${hataMetni(h)}`, "hata"));
    },

    projeDisaAktar: () => {
      try {
        const blob = new Blob([durum.disaAktarJSON()], { type: "application/json" });
        blobIndir(blob, "proje.json");
      } catch (h) {
        panel.mesaj(hataMetni(h), "hata");
      }
    },
    projeIceAktar: (dosya) => {
      void dosya
        .text()
        .then(async (metin) => {
          const sonuc = projeDogrula(JSON.parse(metin));
          if (!sonuc.tamam) {
            panel.mesaj(`proje.json geçersiz: ${sonuc.hatalar.join(" · ")}`, "hata");
            return;
          }
          durum.projeyiYukle(sonuc.deger);
          await projeUygula(sonuc.deger, true);
          panel.mesaj("Proje içe aktarıldı.");
        })
        .catch((h) => panel.mesaj(`proje.json okunamadı: ${hataMetni(h)}`, "hata"));
    },
  });

  // 3D sahneyi arka planda kur — panel, sahne gelmese de (yavaş ağ, bozuk anahtar) çalışır;
  // sahne hazır olduğunda o ana kadar yüklenmiş proje sahneye de uygulanır
  const sahneSozu = sahneKur(document.getElementById("sahne")!, anahtar)
    .then((s) => {
      sahne = s;
      if (durum.proje) void projeUygula(durum.proje, false);
    })
    .catch((h) => sahneMesaji(hataMetni(h), "hata"));

  // URL ile gelen parsel (Parsel Pro köprüsünün "Sahne Studio'da Aç" yolu)
  await parselYukle(() => urldenParselAl(bayraklar));
  await sahneSozu;
}

/** ?yakala=1 modu: capture.mjs'nin açtığı sayfa — sahneyi kurar, açıyı uygular, hazır bayrağı diker. */
async function yakalaModunuBaslat(anahtar: string, bayraklar: UrlBayraklari): Promise<void> {
  document.body.classList.add("yakala-modu");
  try {
    if (!bayraklar.projeB64) throw new Error("?proje=b64:... parametresi eksik");
    const sonuc = projeDogrula(JSON.parse(b64UrlCoz(bayraklar.projeB64)));
    if (!sonuc.tamam) throw new Error(`proje geçersiz: ${sonuc.hatalar.join(" · ")}`);
    const proje = sonuc.deger;

    const aci =
      bayraklar.aciNo !== null
        ? proje.acilar.find((a) => a.aciNo === bayraklar.aciNo)
        : proje.acilar[0];
    if (!aci) throw new Error(`İstenen açı projede yok: ${bayraklar.aciNo ?? "(ilk açı)"}`);

    const { viewer, tileset } = await sahneKur(document.getElementById("sahne")!, anahtar);
    tileset.maximumScreenSpaceError = 8; // yakalamada daha keskin doku

    const halka = proje.parsel.geometri.coordinates[0].map((k) => [k[0], k[1]] as LonLat);
    if (kirpmaDesteklenir(viewer.scene)) kirpmaUygula(tileset, halka, true);

    if (proje.model && bayraklar.glbUrl) {
      await modelYerlestirPrimitive(viewer, {
        uri: bayraklar.glbUrl,
        lon: proje.model.konum.lon,
        lat: proje.model.konum.lat,
        yukseklikM: proje.model.konum.zeminMedyanM + proje.model.yukseklikOfsetM,
        headingDeg: proje.model.headingDeg,
        olcek: proje.model.olcek,
      });
    }

    gunesAyarla(viewer, aci.gunesISO);
    aciGeriYukle(viewer, aci.kamera);

    await stabilBekle(viewer, tileset);
    window.__SAHNE_ATIF = atifMetni(viewer);
    window.__SAHNE_HAZIR = { aci: aci.aciNo, zaman: new Date().toISOString() };
    document.body.dataset.yakalaHazir = "1";
  } catch (h) {
    const mesaj = h instanceof Error ? h.message : String(h);
    window.__SAHNE_HATA = mesaj;
    sahneMesaji(`Yakalama hatası: ${mesaj}`, "hata");
  }
}
