import { z } from "zod";
import { GeometriHatasi, halkaNormallestir } from "./parsel/geometri";

const sayiVeyaMetin = z.union([z.string(), z.number()]).transform((v) => String(v).trim());

const Konum = z
  .array(z.number())
  .min(2, "koordinat [boylam, enlem] olmalı")
  .max(3)
  .refine((k) => k[0] >= -180 && k[0] <= 180, "boylam -180..180 aralığında olmalı")
  .refine((k) => k[1] >= -90 && k[1] <= 90, "enlem -90..90 aralığında olmalı");

const Halka = z
  .array(Konum)
  .min(3, "halka en az 3 köşe içermeli")
  .max(201, "halka en fazla 200 köşe içerebilir");

export const ParselPaketiSemasi = z.object({
  surum: z.literal(1),
  kimlik: z.object({
    il: z.string().min(1, "il boş olamaz"),
    ilce: z.string().min(1, "ilçe boş olamaz"),
    mahalle: z.string().optional(),
    ada: sayiVeyaMetin,
    parsel: sayiVeyaMetin,
    tkgmId: z.string().optional(),
  }),
  geometri: z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(Halka).length(1, "yalnız dış halka desteklenir (delikli parsel değil)"),
  }),
  // Belgede söz: "alanM2 opsiyoneldir". optional yalnız YOKLUĞU kabul eder;
  // ParselPro alanı bilmediğinde null gönderir — onu da kabul et (27.08 canlı tıklama dersi).
  alanM2: z.number().positive().nullable().optional(),
  kaynak: z
    .object({
      uygulama: z.string(),
      surum: z.string().optional(),
      alinmaTarihi: z.string().optional(),
    })
    .optional(),
});
export type ParselPaketi = z.infer<typeof ParselPaketiSemasi>;

export const AciKamerasiSemasi = z.object({
  lon: z.number(),
  lat: z.number(),
  yukseklikM: z.number(),
  headingDeg: z.number(),
  pitchDeg: z.number(),
  rollDeg: z.number(),
  fovDeg: z.number().positive().max(120),
});
export type AciKamerasi = z.infer<typeof AciKamerasiSemasi>;

export const AciKaydiSemasi = z.object({
  aciNo: z.number().int().positive(),
  ad: z.string(),
  kamera: AciKamerasiSemasi,
  gunesISO: z.string(),
  enBoyOrani: z.literal("16:9"),
  onayTarihi: z.string(),
});
export type AciKaydi = z.infer<typeof AciKaydiSemasi>;

export const ModelYerlesimiSemasi = z.object({
  dosyaAdi: z.string().min(1),
  sha256: z.string().optional(),
  konum: z.object({
    lon: z.number(),
    lat: z.number(),
    zeminMedyanM: z.number(),
  }),
  headingDeg: z.number(),
  yukseklikOfsetM: z.number(),
  olcek: z.number().positive(),
  // Modeli parsel merkezinden yana kaydırma (metre). Otomatik yerleştirme
  // merkeze koyar; gerçek yapı merkezde olmayabilir — kullanıcı elle düzeltir.
  // Eski proje.json'larda yok: opsiyonel, yokluğu (0,0) sayılır.
  kaydirma: z.object({ doguM: z.number(), kuzeyM: z.number() }).optional(),
  zeminOrneklemesi: z
    .object({
      yontem: z.string(),
      noktalar: z.array(
        z.object({ ad: z.string(), lon: z.number(), lat: z.number(), yukseklikM: z.number().nullable() })
      ),
      egimYuzde: z.number().nullable(),
    })
    .optional(),
});
export type ModelYerlesimi = z.infer<typeof ModelYerlesimiSemasi>;

export const SahneProjeSemasi = z.object({
  surum: z.literal(1),
  parselSlug: z.string().min(1),
  parsel: ParselPaketiSemasi,
  model: ModelYerlesimiSemasi.nullable(),
  gunesISO: z.string(),
  acilar: z.array(AciKaydiSemasi),
  olusturma: z.string(),
  guncelleme: z.string(),
});
export type SahneProje = z.infer<typeof SahneProjeSemasi>;

export type DogrulamaSonucu<T> = { tamam: true; deger: T } | { tamam: false; hatalar: string[] };

function turAdi(t: string): string {
  const eslem: Record<string, string> = {
    string: "metin",
    number: "sayı",
    object: "nesne",
    array: "dizi",
    boolean: "doğru/yanlış",
    undefined: "eksik",
    null: "boş (null)",
  };
  return eslem[t] ?? t;
}

function konuMesaji(sorun: z.ZodIssue): string {
  if (sorun.code === "invalid_type") {
    return `beklenen ${turAdi(sorun.expected)}, gelen ${turAdi(sorun.received)}`;
  }
  if (sorun.code === "invalid_literal") {
    return `beklenen değer: ${JSON.stringify(sorun.expected)}`;
  }
  return sorun.message;
}

function hatalariCevir(hata: z.ZodError): string[] {
  return hata.issues.map((s) => `${s.path.join(".") || "(kök)"}: ${konuMesaji(s)}`);
}

/** Parsel paketini doğrular ve halkayı normalleştirir (kapanış tekrarı atılır, CCW yapılır). */
export function parselDogrula(veri: unknown): DogrulamaSonucu<ParselPaketi> {
  const sonuc = ParselPaketiSemasi.safeParse(veri);
  if (!sonuc.success) return { tamam: false, hatalar: hatalariCevir(sonuc.error) };
  try {
    const halka = halkaNormallestir(sonuc.data.geometri.coordinates[0]);
    const paket: ParselPaketi = {
      ...sonuc.data,
      geometri: { type: "Polygon", coordinates: [halka.map((k) => [k[0], k[1]])] },
    };
    return { tamam: true, deger: paket };
  } catch (h) {
    if (h instanceof GeometriHatasi) return { tamam: false, hatalar: [`geometri: ${h.message}`] };
    throw h;
  }
}

export function projeDogrula(veri: unknown): DogrulamaSonucu<SahneProje> {
  const sonuc = SahneProjeSemasi.safeParse(veri);
  if (!sonuc.success) return { tamam: false, hatalar: hatalariCevir(sonuc.error) };
  const parsel = parselDogrula(sonuc.data.parsel);
  if (!parsel.tamam) return parsel;
  return { tamam: true, deger: { ...sonuc.data, parsel: parsel.deger } };
}
