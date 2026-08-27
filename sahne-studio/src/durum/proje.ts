import {
  projeDogrula,
  type AciKamerasi,
  type AciKaydi,
  type ModelYerlesimi,
  type ParselPaketi,
  type SahneProje,
} from "../semalar";
import { parselSlug } from "../parsel/geometri";

const DEPO_ONEKI = "sahne-studio/proje/";

function simdiISO(): string {
  return new Date().toISOString();
}

export function varsayilanGunesISO(): string {
  return `${new Date().toISOString().slice(0, 10)}T14:00:00+03:00`;
}

/** Aktif projenin tek sahibi: tüm değişiklikler buradan geçer ve localStorage'a yazılır. */
export class ProjeDurumu {
  proje: SahneProje | null = null;

  /** Parseli yükler; aynı parsel için kayıtlı proje varsa onu geri getirir. */
  parselAyarla(paket: ParselPaketi): { proje: SahneProje; depodanGeldi: boolean } {
    const slug = parselSlug(paket.kimlik);
    const kayitli = this.depodanYukle(slug);
    if (kayitli) {
      kayitli.parsel = paket;
      this.proje = kayitli;
      return { proje: kayitli, depodanGeldi: true };
    }
    this.proje = {
      surum: 1,
      parselSlug: slug,
      parsel: paket,
      model: null,
      gunesISO: varsayilanGunesISO(),
      acilar: [],
      olusturma: simdiISO(),
      guncelleme: simdiISO(),
    };
    this.kaydet();
    return { proje: this.proje, depodanGeldi: false };
  }

  projeyiYukle(proje: SahneProje): void {
    this.proje = proje;
    this.kaydet();
  }

  modelAyarla(model: ModelYerlesimi | null): void {
    if (!this.proje) return;
    this.proje.model = model;
    this.kaydet();
  }

  modelGuncelle(
    kismi: Partial<Pick<ModelYerlesimi, "headingDeg" | "yukseklikOfsetM" | "olcek" | "kaydirma">>
  ): void {
    if (!this.proje?.model) return;
    Object.assign(this.proje.model, kismi);
    this.kaydet();
  }

  gunesAyarla(iso: string): void {
    if (!this.proje) return;
    this.proje.gunesISO = iso;
    this.kaydet();
  }

  aciEkle(kamera: AciKamerasi, ad: string): AciKaydi {
    if (!this.proje) throw new Error("Önce parsel yükleyin");
    const no = this.proje.acilar.reduce((enBuyuk, a) => Math.max(enBuyuk, a.aciNo), 0) + 1;
    const kayit: AciKaydi = {
      aciNo: no,
      ad,
      kamera,
      gunesISO: this.proje.gunesISO,
      enBoyOrani: "16:9",
      onayTarihi: simdiISO(),
    };
    this.proje.acilar.push(kayit);
    this.kaydet();
    return kayit;
  }

  aciSil(aciNo: number): void {
    if (!this.proje) return;
    this.proje.acilar = this.proje.acilar.filter((a) => a.aciNo !== aciNo);
    this.kaydet();
  }

  aciBul(aciNo: number): AciKaydi | undefined {
    return this.proje?.acilar.find((a) => a.aciNo === aciNo);
  }

  disaAktarJSON(): string {
    if (!this.proje) throw new Error("Dışa aktarılacak proje yok");
    return JSON.stringify(this.proje, null, 2);
  }

  kaydet(): void {
    if (!this.proje) return;
    this.proje.guncelleme = simdiISO();
    try {
      localStorage.setItem(DEPO_ONEKI + this.proje.parselSlug, JSON.stringify(this.proje));
    } catch {
      // depolama dolu/kapalı olabilir — sessizce geç, dışa aktarma her zaman elde var
    }
  }

  private depodanYukle(slug: string): SahneProje | null {
    try {
      const ham = localStorage.getItem(DEPO_ONEKI + slug);
      if (!ham) return null;
      const sonuc = projeDogrula(JSON.parse(ham));
      return sonuc.tamam ? sonuc.deger : null;
    } catch {
      return null;
    }
  }
}
