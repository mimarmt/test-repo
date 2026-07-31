"""Iki katmanli varyant degerlendirme.

SORUN: "bir suru kural yazdim ama varyant puanlamasi yanlis, dogru planlar
onume gelmiyor."

TESHIS: tek bir agirlikli toplam kullanildiginda bir eksende alinan yuksek
puan, baska eksendeki OLUMCUL kusuru telafi eder. 'Alan hedefleri mukemmel,
en/boy orani ideal, ama banyoya salondan giriliyor' plani toplamda one cikar.
Mimari kalite toplamsal degil, once ELEYICI sonra sirali bir yapidir.

COZUM — iki katman:

  KATMAN 1 · ELEME (ikili, agirliksiz)
      Olumcul kusur = plan listeye HIC girmez. Puanlanmaz, telafi edilemez.
      Erisilemeyen oda, yatak odasindan gecilen banyo, girilemeyen daire.

  KATMAN 2 · SIRALAMA (ogrenilmis agirlik)
      Elemeden gecenler, MIMARIN IKILI TERCIHLERINDEN ogrenilmis
      agirliklarla siralanir. Agirlik elle ayarlanmaz — veriden cikar.

Neden elle ayar calismiyor: 12 ozellik = 12 dugme, geri besleme yok.
Birini duzeltince digeri bozulur, ne zaman durulacagi bilinmez.
Ikili karsilastirma ("bu mu su mu?") mimarin 5 saniyede guvenilir yaptigi
bir istir; 200 karsilastirma ~20 dakika eder ve agirliklari BELIRLER.
"""

from __future__ import annotations

import math

import numpy as np

from .dogrula import _dis_cephe, _ortak_kenar

# Ozellik adlari — hepsi mimarin tartisabilecegi seyler.
# "yon" = +1 ise buyuk olmasi iyi, -1 ise kucuk olmasi iyi (baslangic sezgisi;
# ogrenme bunlari degistirebilir, ki degistirmesi bilgi demektir).
OZELLIKLER: list[tuple[str, int]] = [
    ("komsuluk_karsilanma",   +1),
    ("gun_isigi_payi",        +1),
    ("islak_kumelenme",       +1),
    ("sirkulasyon_orani",     -1),
    ("en_kotu_oran",          -1),
    ("ortalama_oran",         -1),
    ("alan_sapmasi_orani",    -1),
    ("salon_payi",            +1),
    ("yatak_dengesizligi",    -1),
    ("ic_duvar_uzunlugu",     -1),
    ("antre_mahremiyeti",     +1),
    ("kose_oda_payi",         +1),
]


# ─────────────────────────────────────────────────────────────
# Komsuluk grafi
# ─────────────────────────────────────────────────────────────

def graf(plan: dict, kapi: float) -> dict[str, set[str]]:
    o = plan["odalar"]
    g: dict[str, set[str]] = {r["ad"]: set() for r in o}
    for i, a in enumerate(o):
        for b in o[i + 1:]:
            if _ortak_kenar(a, b) >= kapi - 1e-9:
                g[a["ad"]].add(b["ad"])
                g[b["ad"]].add(a["ad"])
    return g


def izinli_erisim(ad: str, plan: dict, program: dict) -> set[str]:
    """Bu odanin kapisinin acilabilecegi odalar — 'erisim' tablosuna gore."""
    tip = {o["ad"]: o["tip"] for o in plan["odalar"]}
    tipler = program["tipler"]
    izin = tipler[tip[ad]].get("erisim", ["sirkulasyon"])
    return {
        o["ad"] for o in plan["odalar"]
        if o["ad"] != ad and (
            ("sirkulasyon" in izin and tipler[o["tip"]].get("sirkulasyon"))
            or o["tip"] in izin
        )
    }


def erisilebilir(plan: dict, program: dict, baslangic: str, kapi: float) -> set[str]:
    """Giristen baslayip erisim tablosuna uyarak nereye varilir.

    Tanim ozyinelemeli: R odasina varilir <=> R'nin, ERISIM TABLOSUNUN
    izin verdigi bir komsusu vardir ve o komsuya da varilir.

    Bu, "hangi odadan gecilir" diye ayri bir liste tutmayi gereksiz kilar;
    tek dogruluk kaynagi oda_programi.json'daki 'erisim' alanidir.
    Ornegin balkona salondan veya yatak odasindan varilir (tablo oyle
    diyor), banyoya yalnizca koridordan varilir.
    """
    g = graf(plan, kapi)
    varilan = {baslangic}
    degisti = True
    while degisti:
        degisti = False
        for o in plan["odalar"]:
            ad = o["ad"]
            if ad in varilan:
                continue
            if g[ad] & izinli_erisim(ad, plan, program) & varilan:
                varilan.add(ad)
                degisti = True
    return varilan


# ─────────────────────────────────────────────────────────────
# KATMAN 1 — Eleme
# ─────────────────────────────────────────────────────────────

def ele(plan: dict, girdi: dict, program: dict) -> list[str]:
    """Olumcul kusurlar. Bos liste = plan siralamaya girer."""
    if not plan.get("odalar"):
        return ["plan bos"]

    esik, tipler = program["esikler"], program["tipler"]
    kapi = esik["kapi_genisligi"]
    K = plan["kontur"]
    tip = {o["ad"]: o["tip"] for o in plan["odalar"]}
    g = graf(plan, kapi)
    kusur: list[str] = []

    giris = girdi.get("giris")
    baslangic = giris["oda"] if giris else next(
        (o["ad"] for o in plan["odalar"] if tipler[o["tip"]].get("sirkulasyon")),
        plan["odalar"][0]["ad"],
    )

    # E1 — Daireye girilebiliyor mu
    if giris:
        a = next(o for o in plan["odalar"] if o["ad"] == giris["oda"])
        if _dis_cephe(a, K, {giris["kenar"]}) < kapi:
            kusur.append(f"GIRILEMEZ: {giris['oda']} giris cephesine deymiyor")

    # E2 — Her odaya gecis mekanindan ulasilabiliyor mu
    varilan = erisilebilir(plan, program, baslangic, kapi)
    for o in plan["odalar"]:
        if o["ad"] not in varilan:
            kusur.append(f"ERISILEMEZ: {o['ad']} (yalnizca baska bir oda icinden)")

    # E3 — Kapi yeri: her odanin kapisi 'erisim' tablosunun izin verdigi
    # bir mekana acilmali. Model de ayni tabloyu okur; ikisi arasinda
    # felsefe farki kalmadi, tek dogruluk kaynagi oda_programi.json.
    for ad in g:
        if tipler[tip[ad]].get("sirkulasyon"):
            continue
        if not (g[ad] & izinli_erisim(ad, plan, program)):
            izin = tipler[tip[ad]].get("erisim", ["sirkulasyon"])
            kusur.append(f"KAPI YERI: {ad} kapisi {izin} disina aciliyor")

    # E4 — Kullanilamaz oda
    for o in plan["odalar"]:
        t = tipler[o["tip"]]
        if min(o["en"], o["boy"]) < t["min_kenar"] - 1e-9:
            kusur.append(f"KULLANILAMAZ: {o['ad']} kisa kenar {min(o['en'], o['boy']):.2f} m")

    return kusur


# ─────────────────────────────────────────────────────────────
# KATMAN 2 — Ozellik cikarimi
# ─────────────────────────────────────────────────────────────

def ozellikler(plan: dict, girdi: dict, program: dict) -> dict[str, float]:
    esik, tipler = program["esikler"], program["tipler"]
    kapi = esik["kapi_genisligi"]
    K = plan["kontur"]
    toplam = K["en"] * K["boy"]
    odalar = plan["odalar"]
    tip = {o["ad"]: o["tip"] for o in odalar}
    g = graf(plan, kapi)

    istenen = [tuple(k) for k in girdi.get("komsuluklar", [])]
    karsilanan = sum(1 for a, b in istenen if b in g.get(a, ()))

    isik_gereken = [o for o in odalar if tipler[o["tip"]].get("gun_isigi")]
    isik_alan = [
        o for o in isik_gereken
        if _dis_cephe(o, K, set(girdi.get("cepheler", ("sol", "sag", "alt", "ust"))))
        >= esik["min_cephe"] - 1e-9
    ]

    islak = [o["ad"] for o in odalar if tipler[o["tip"]].get("islak")]
    islak_cift = [
        (islak[i], islak[j])
        for i in range(len(islak)) for j in range(i + 1, len(islak))
    ]
    islak_bitisik = sum(1 for a, b in islak_cift if b in g[a])

    oranlar = [max(o["en"], o["boy"]) / min(o["en"], o["boy"]) for o in odalar]
    sapma = sum(
        abs(o["en"] * o["boy"] - tipler[o["tip"]]["alan_hedef"]) for o in odalar
    )
    salon = sum(o["en"] * o["boy"] for o in odalar if o["tip"] == "salon")
    yatak = [o["en"] * o["boy"] for o in odalar if o["tip"] in ("yatak", "ebeveyn")]

    # Ic duvar uzunlugu — kaba insaat maliyeti vekili
    ic_duvar = sum(
        _ortak_kenar(a, b)
        for i, a in enumerate(odalar) for b in odalar[i + 1:]
    )

    # Antre mahremiyeti: girisden salonun tamami gorunmesin —
    # antre salona dogrudan aciliyorsa 0, holden geciyorsa 1
    giris = girdi.get("giris")
    antre = giris["oda"] if giris else None
    salon_ad = next((o["ad"] for o in odalar if o["tip"] == "salon"), None)
    mahremiyet = 0.0
    if antre and salon_ad:
        mahremiyet = 0.0 if salon_ad in g.get(antre, ()) else 1.0

    # Kose oda payi: iki cepheden isik alan oda sayisi (mimari deger)
    kose = sum(
        1 for o in odalar
        if sum(
            1 for kenar in ("sol", "sag", "alt", "ust")
            if _dis_cephe(o, K, {kenar}) >= esik["min_cephe"] - 1e-9
        ) >= 2
    )

    return {
        "komsuluk_karsilanma": karsilanan / len(istenen) if istenen else 1.0,
        "gun_isigi_payi": len(isik_alan) / len(isik_gereken) if isik_gereken else 1.0,
        "islak_kumelenme": islak_bitisik / len(islak_cift) if islak_cift else 1.0,
        "sirkulasyon_orani": sum(
            o["en"] * o["boy"] for o in odalar if tipler[o["tip"]].get("sirkulasyon")
        ) / toplam,
        "en_kotu_oran": max(oranlar),
        "ortalama_oran": sum(oranlar) / len(oranlar),
        "alan_sapmasi_orani": sapma / toplam,
        "salon_payi": salon / toplam,
        "yatak_dengesizligi": (float(np.std(yatak)) / float(np.mean(yatak))) if yatak else 0.0,
        "ic_duvar_uzunlugu": ic_duvar / math.sqrt(toplam),
        "antre_mahremiyeti": mahremiyet,
        "kose_oda_payi": kose / len(odalar),
    }


def vektor(oz: dict[str, float]) -> np.ndarray:
    return np.array([oz[ad] for ad, _ in OZELLIKLER], dtype=float)


def olcekle(X: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """z-skor. Ayni toplamda m2, oran ve adet karistirmak olcek hatasinin
    en sik kaynagidir; agirliklar ancak normalize ozellikler uzerinde
    karsilastirilabilir olur."""
    ort = X.mean(axis=0)
    std = X.std(axis=0)
    std[std < 1e-9] = 1.0
    return (X - ort) / std, ort, std


# ─────────────────────────────────────────────────────────────
# KATMAN 2 — Agirliklari ikili tercihlerden ogren
# ─────────────────────────────────────────────────────────────

def ogren(
    fark: np.ndarray,
    adim: float = 0.3,
    tur: int = 4000,
    ceza: float = 0.01,
) -> np.ndarray:
    """Bradley-Terry / lojistik siralama.

    fark[k] = ozellik(kazanan) - ozellik(kaybeden), mimarin sectigi cift.
    Amac: sigmoid(w . fark) -> 1. Duz gradyan inisi; harici bagimlilik yok.
    """
    w = np.zeros(fark.shape[1])
    for _ in range(tur):
        z = fark @ w
        p = 1.0 / (1.0 + np.exp(np.clip(z, -30, 30)))   # yanlis siralama olasiligi
        egim = (fark * p[:, None]).mean(axis=0) - ceza * w
        w += adim * egim
    return w


def dogruluk(fark: np.ndarray, w: np.ndarray) -> float:
    """Ogrenilen agirlik, tercihlerin yuzde kacini dogru siraliyor."""
    return float((fark @ w > 0).mean())


def puanla(X_olcekli: np.ndarray, w: np.ndarray) -> np.ndarray:
    return X_olcekli @ w
