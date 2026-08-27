import type { AciKaydi, ParselPaketi } from "../semalar";
import type { PresetAdi } from "../sahne/kamera";

export interface ZeminTablosuSatiri {
  ad: string;
  yukseklikM: number | null;
}

export interface PanelOlaylari {
  parselDosyasiVerildi(dosya: File): void;
  parselMetniVerildi(metin: string): void;
  parselProdanAl(): void;
  glbVerildi(dosya: File): void;
  headingDegisti(deg: number): void;
  kotOfsetiDegisti(m: number): void;
  kaydirmaDegisti(doguM: number, kuzeyM: number): void;
  gercekSokakIstendi(): void;
  olcekDegisti(olcek: number): void;
  gunesDegisti(iso: string): void;
  presetSecildi(ad: PresetAdi): void;
  mevcutBinaGizleDegisti(acik: boolean): void;
  aciOnayla(): void;
  aciGit(aciNo: number): void;
  aciSil(aciNo: number): void;
  jpgIndir(): void;
  projeDisaAktar(): void;
  projeIceAktar(dosya: File): void;
}

export interface PanelApi {
  parselOzetiGoster(p: ParselPaketi, slug: string): void;
  zeminTablosuGoster(satirlar: ZeminTablosuSatiri[], egimYuzde: number | null): void;
  modelDurumuGoster(metin: string): void;
  yerlesimGoster(
    headingDeg: number,
    kotOfsetiM: number,
    olcek: number,
    kaydirma?: { doguM: number; kuzeyM: number }
  ): void;
  gunesGoster(iso: string): void;
  acilariGoster(acilar: AciKaydi[]): void;
  mesaj(metin: string, tur?: "bilgi" | "hata"): void;
}

const PRESETLER: { ad: PresetAdi; etiket: string }[] = [
  { ad: "kus-45-kd", etiket: "Kuş 45° KD" },
  { ad: "kus-45-gd", etiket: "Kuş 45° GD" },
  { ad: "kus-45-gb", etiket: "Kuş 45° GB" },
  { ad: "kus-45-kb", etiket: "Kuş 45° KB" },
  { ad: "insan-gozu", etiket: "Sokağa in" },
  { ad: "cephe-dik", etiket: "Cepheye dik" },
];

function saatMetni(dakika: number): string {
  const s = Math.floor(dakika / 60);
  const d = dakika % 60;
  return `${String(s).padStart(2, "0")}:${String(d).padStart(2, "0")}`;
}

function isoParcala(iso: string): { tarih: string; dakika: number } {
  const e = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!e) return { tarih: new Date().toISOString().slice(0, 10), dakika: 14 * 60 };
  return { tarih: e[1], dakika: Number(e[2]) * 60 + Number(e[3]) };
}

export function paneliKur(kok: HTMLElement, olaylar: PanelOlaylari): PanelApi {
  kok.innerHTML = `
    <h1>Sahne <span>Studio</span></h1>
    <p class="altbaslik">Gerçek çevrede model · açı onayı · AI render</p>

    <section class="bolum" id="b-parsel">
      <h2>Parsel</h2>
      <div class="parsel-ozeti" id="parsel-ozeti" hidden></div>
      <div class="izgara-2" style="margin-bottom:8px">
        <button id="dg-parselpro" type="button">Parsel Pro'dan Al</button>
        <label class="birak-alani" id="ba-parsel" style="padding:7px">parsel .json seç/bırak
          <input type="file" id="gi-parsel" accept=".json,application/json,.geojson">
        </label>
      </div>
      <details class="yapistir">
        <summary>Parsel JSON yapıştır</summary>
        <textarea id="ta-parsel" spellcheck="false" placeholder='{"surum":1,"kimlik":{...},"geometri":{...}}'></textarea>
        <button id="dg-yapistir" type="button" class="kucuk" style="margin-top:6px">Doğrula ve Yükle</button>
      </details>
      <label class="satir" style="margin-top:10px">
        <input type="checkbox" id="og-kirp" checked style="accent-color:var(--vurgu)">
        <span style="width:auto;color:var(--metin)">Parseldeki mevcut binayı gizle</span>
      </label>
    </section>

    <section class="bolum" id="b-model">
      <h2>Model (SketchUp GLB)</h2>
      <label class="birak-alani" id="ba-glb">.glb dosyasını buraya bırak (SketchUp 2025: File → Export → 3D Model → glb)
        <input type="file" id="gi-glb" accept=".glb,model/gltf-binary">
      </label>
      <p class="altbaslik" id="model-durum" style="margin:8px 0 8px"></p>
      <div class="satir"><label for="sr-heading">Yön</label>
        <input type="range" id="sr-heading" min="0" max="360" step="0.5" value="0">
        <span class="deger" id="dg-heading">0°</span></div>
      <div class="satir"><label for="sr-kot">Kot ofseti</label>
        <input type="range" id="sr-kot" min="-5" max="5" step="0.01" value="0">
        <span class="deger" id="dg-kot">0,00 m</span></div>
      <div class="satir"><label for="gi-olcek">Ölçek</label>
        <input type="number" id="gi-olcek" min="0.01" step="0.01" value="1">
        <span class="deger"></span></div>
      <div class="satir"><label for="sr-dogu">Doğu ↔ Batı</label>
        <input type="range" id="sr-dogu" min="-25" max="25" step="0.1" value="0">
        <span class="deger" id="dg-dogu">0,0 m</span></div>
      <div class="satir"><label for="sr-kuzey">Kuzey ↔ Güney</label>
        <input type="range" id="sr-kuzey" min="-25" max="25" step="0.1" value="0">
        <span class="deger" id="dg-kuzey">0,0 m</span></div>
      <button type="button" id="db-kaydirma-sifirla" class="ikincil">Kaydırmayı sıfırla</button>
      <div id="zemin-kabi" hidden>
        <table class="zemin" id="zemin-tablo"></table>
        <p class="altbaslik" id="zemin-egim" style="margin:6px 0 0"></p>
      </div>
    </section>

    <section class="bolum" id="b-gunes">
      <h2>Güneş</h2>
      <div class="satir"><label for="gi-tarih">Tarih</label>
        <input type="date" id="gi-tarih"></div>
      <div class="satir"><label for="sr-saat">Saat</label>
        <input type="range" id="sr-saat" min="0" max="1430" step="10" value="840">
        <span class="deger" id="dg-saat">14:00</span></div>
    </section>

    <section class="bolum" id="b-kamera">
      <h2>Kamera</h2>
      <div class="izgara-3" id="presetler"></div>
      <button type="button" id="db-gercek-sokak" class="ikincil" style="margin-top:8px" title="Google Street View: sokağın gerçek fotoğrafı, parselin önünden">🚶 Gerçek sokak (Street View)</button>
      <p class="altbaslik" style="margin:8px 0 0">Serbest dolaşım — Sol tık: kaydır ·
      Teker: yakınlaş/uzaklaş · Ctrl+Sol (veya orta tık): eğ/döndür.</p>
    </section>

    <section class="bolum" id="b-acilar">
      <h2>Onaylı Açılar</h2>
      <ul class="aci-listesi" id="aci-listesi"></ul>
      <button class="birincil" id="dg-onayla" type="button">✓ Bu açıyı onayla</button>
    </section>

    <section class="bolum" id="b-cikti">
      <h2>Çıktı</h2>
      <div class="izgara-2">
        <button id="dg-jpg" type="button">JPG indir (4K)</button>
        <button id="dg-disa" type="button">proje.json indir</button>
      </div>
      <label class="birak-alani" style="margin-top:8px;padding:7px" id="ba-proje">proje.json yükle
        <input type="file" id="gi-proje" accept=".json,application/json">
      </label>
      <p class="altbaslik" style="margin:10px 0 0">Onaylı açıları toplu 4K almak için:
      <code>npm run yakala</code>, AI render için <code>npm run render</code> (README).</p>
    </section>

    <div id="panel-mesaj" hidden class="panel-mesaj"></div>
  `;

  const $ = <T extends HTMLElement>(id: string) => kok.querySelector<T>(`#${id}`)!;

  // --- parsel girişleri ---
  const parselGirdi = $<HTMLInputElement>("gi-parsel");
  parselGirdi.addEventListener("change", () => {
    const d = parselGirdi.files?.[0];
    if (d) olaylar.parselDosyasiVerildi(d);
    parselGirdi.value = "";
  });
  $("dg-parselpro").addEventListener("click", () => olaylar.parselProdanAl());
  $("dg-yapistir").addEventListener("click", () => {
    const metin = $<HTMLTextAreaElement>("ta-parsel").value.trim();
    if (metin) olaylar.parselMetniVerildi(metin);
  });
  $<HTMLInputElement>("og-kirp").addEventListener("change", (e) =>
    olaylar.mevcutBinaGizleDegisti((e.target as HTMLInputElement).checked)
  );

  // --- glb ---
  const glbGirdi = $<HTMLInputElement>("gi-glb");
  glbGirdi.addEventListener("change", () => {
    const d = glbGirdi.files?.[0];
    if (d) olaylar.glbVerildi(d);
    glbGirdi.value = "";
  });

  // sürükle-bırak: .glb → model, .json → parsel (panelin herhangi bir yerine)
  for (const alanId of ["ba-glb", "ba-parsel", "ba-proje"]) {
    const alan = $(alanId);
    alan.addEventListener("dragover", (e) => {
      e.preventDefault();
      alan.classList.add("aktif");
    });
    alan.addEventListener("dragleave", () => alan.classList.remove("aktif"));
  }
  kok.addEventListener("dragover", (e) => e.preventDefault());
  kok.addEventListener("drop", (e) => {
    e.preventDefault();
    kok.querySelectorAll(".birak-alani").forEach((a) => a.classList.remove("aktif"));
    const dosya = e.dataTransfer?.files?.[0];
    if (!dosya) return;
    const ad = dosya.name.toLowerCase();
    if (ad.endsWith(".glb")) olaylar.glbVerildi(dosya);
    else if (ad === "proje.json" || ad.endsWith(".proje.json")) olaylar.projeIceAktar(dosya);
    else if (ad.endsWith(".json") || ad.endsWith(".geojson")) olaylar.parselDosyasiVerildi(dosya);
  });

  // --- yerleşim kaydırıcıları ---
  const heading = $<HTMLInputElement>("sr-heading");
  heading.addEventListener("input", () => {
    $("dg-heading").textContent = `${Number(heading.value).toFixed(1)}°`;
    olaylar.headingDegisti(Number(heading.value));
  });
  const kot = $<HTMLInputElement>("sr-kot");
  kot.addEventListener("input", () => {
    $("dg-kot").textContent = `${Number(kot.value).toFixed(2).replace(".", ",")} m`;
    olaylar.kotOfsetiDegisti(Number(kot.value));
  });
  const dogu = $<HTMLInputElement>("sr-dogu");
  const kuzey = $<HTMLInputElement>("sr-kuzey");
  function kaydirmaYayinla(): void {
    $("dg-dogu").textContent = `${Number(dogu.value).toFixed(1).replace(".", ",")} m`;
    $("dg-kuzey").textContent = `${Number(kuzey.value).toFixed(1).replace(".", ",")} m`;
    olaylar.kaydirmaDegisti(Number(dogu.value), Number(kuzey.value));
  }
  dogu.addEventListener("input", kaydirmaYayinla);
  kuzey.addEventListener("input", kaydirmaYayinla);
  $<HTMLButtonElement>("db-gercek-sokak").addEventListener("click", () => olaylar.gercekSokakIstendi());
  $<HTMLButtonElement>("db-kaydirma-sifirla").addEventListener("click", () => {
    dogu.value = "0";
    kuzey.value = "0";
    kaydirmaYayinla();
  });

  const olcek = $<HTMLInputElement>("gi-olcek");
  olcek.addEventListener("change", () => {
    const deger = Number(olcek.value);
    if (deger > 0) olaylar.olcekDegisti(deger);
  });

  // --- güneş ---
  const tarih = $<HTMLInputElement>("gi-tarih");
  const saat = $<HTMLInputElement>("sr-saat");
  const gunesBildir = () => {
    if (!tarih.value) return;
    const iso = `${tarih.value}T${saatMetni(Number(saat.value))}:00+03:00`;
    $("dg-saat").textContent = saatMetni(Number(saat.value));
    olaylar.gunesDegisti(iso);
  };
  tarih.addEventListener("change", gunesBildir);
  saat.addEventListener("input", gunesBildir);

  // --- kamera presetleri ---
  const presetKabi = $("presetler");
  for (const p of PRESETLER) {
    const dugme = document.createElement("button");
    dugme.type = "button";
    dugme.className = "kucuk";
    dugme.textContent = p.etiket;
    dugme.addEventListener("click", () => olaylar.presetSecildi(p.ad));
    presetKabi.appendChild(dugme);
  }

  // --- açılar / çıktı ---
  $("dg-onayla").addEventListener("click", () => olaylar.aciOnayla());
  $("dg-jpg").addEventListener("click", () => olaylar.jpgIndir());
  $("dg-disa").addEventListener("click", () => olaylar.projeDisaAktar());
  const projeGirdi = $<HTMLInputElement>("gi-proje");
  projeGirdi.addEventListener("change", () => {
    const d = projeGirdi.files?.[0];
    if (d) olaylar.projeIceAktar(d);
    projeGirdi.value = "";
  });

  let mesajZamanlayici = 0;

  const api: PanelApi = {
    parselOzetiGoster(p, slug) {
      const ozet = $("parsel-ozeti");
      ozet.hidden = false;
      const mahalle = p.kimlik.mahalle ? `${p.kimlik.mahalle} Mah. · ` : "";
      const alan = p.alanM2 ? ` · ${Math.round(p.alanM2)} m²` : "";
      ozet.innerHTML = `<b>${p.kimlik.ada} ada / ${p.kimlik.parsel} parsel</b><br>` +
        `${mahalle}${p.kimlik.ilce} / ${p.kimlik.il}${alan}<br>` +
        `<span style="color:var(--soluk)">klasör: ${slug}</span>`;
    },
    zeminTablosuGoster(satirlar, egimYuzde) {
      const kap = $("zemin-kabi");
      const tablo = $("zemin-tablo");
      kap.hidden = satirlar.length === 0;
      tablo.innerHTML =
        `<tr><th>Zemin noktası</th><th>Kot (m)</th></tr>` +
        satirlar
          .map(
            (s) =>
              `<tr><td>${s.ad}</td><td>${
                s.yukseklikM === null ? "—" : s.yukseklikM.toFixed(2).replace(".", ",")
              }</td></tr>`
          )
          .join("");
      $("zemin-egim").textContent =
        egimYuzde === null ? "" : `Parsel içi kot farkına göre eğim ≈ %${egimYuzde.toFixed(1).replace(".", ",")}`;
    },
    modelDurumuGoster(metin) {
      $("model-durum").textContent = metin;
    },
    yerlesimGoster(headingDeg, kotOfsetiM, olcekDegeri, kaydirma) {
      heading.value = String(headingDeg);
      $("dg-heading").textContent = `${headingDeg.toFixed(1)}°`;
      kot.value = String(kotOfsetiM);
      $("dg-kot").textContent = `${kotOfsetiM.toFixed(2).replace(".", ",")} m`;
      olcek.value = String(olcekDegeri);
      dogu.value = String(kaydirma?.doguM ?? 0);
      kuzey.value = String(kaydirma?.kuzeyM ?? 0);
      $("dg-dogu").textContent = `${(kaydirma?.doguM ?? 0).toFixed(1).replace(".", ",")} m`;
      $("dg-kuzey").textContent = `${(kaydirma?.kuzeyM ?? 0).toFixed(1).replace(".", ",")} m`;
    },
    gunesGoster(iso) {
      const { tarih: t, dakika } = isoParcala(iso);
      tarih.value = t;
      saat.value = String(dakika);
      $("dg-saat").textContent = saatMetni(dakika);
    },
    acilariGoster(acilar) {
      const liste = $("aci-listesi");
      liste.innerHTML = "";
      if (acilar.length === 0) {
        liste.innerHTML = `<li style="color:var(--soluk)">Henüz onaylı açı yok — sahneyi ayarlayıp onaylayın.</li>`;
        return;
      }
      for (const aci of acilar) {
        const oge = document.createElement("li");
        const no = document.createElement("span");
        no.className = "no";
        no.textContent = String(aci.aciNo).padStart(2, "0");
        const ad = document.createElement("span");
        ad.className = "ad";
        ad.textContent = aci.ad;
        const git = document.createElement("button");
        git.className = "kucuk";
        git.textContent = "Git";
        git.addEventListener("click", () => olaylar.aciGit(aci.aciNo));
        const sil = document.createElement("button");
        sil.className = "kucuk tehlike";
        sil.textContent = "Sil";
        sil.addEventListener("click", () => olaylar.aciSil(aci.aciNo));
        oge.append(no, ad, git, sil);
        liste.appendChild(oge);
      }
    },
    mesaj(metin, tur = "bilgi") {
      const kutu = $("panel-mesaj");
      kutu.hidden = false;
      kutu.className = `panel-mesaj ${tur}`;
      kutu.textContent = metin;
      window.clearTimeout(mesajZamanlayici);
      mesajZamanlayici = window.setTimeout(() => (kutu.hidden = true), 7000);
    },
  };

  api.acilariGoster([]);
  return api;
}
