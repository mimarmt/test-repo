"""L3 ic plan uretici — CP-SAT referans motoru.

Saf fonksiyon: JSON alir, JSON verir. Dosya yolu bilmez.

MODELIN OMURGASI — dort fikir
-----------------------------
1. Her oda TEK bir dikdortgendir. Boylece "oda kendi icinde butun mu"
   sorusu ortadan kalkar; CP-SAT'ta baglantililik (connectivity) kisiti
   pahalidir, dikdortgen varsayimi onu bedavaya getirir.

2. Bosluksuz doseme, uc kisitin YAN ETKISI olarak elde edilir:
      (a) her oda kontur icinde
      (b) odalar cakismiyor (AddNoOverlap2D)
      (c) alanlarin toplami = kontur alani
   Bu uc sart birlikte saglaniyorsa bosluk kalmasi geometrik olarak
   imkansizdir. Ayrica "her hucre bir odaya ait" kisiti yazmaya gerek yok
   — 12x10 m'lik bir daire icin bu 12.000 hucre degiskeni demekti.

3. en x boy = alan carpimini AddMultiplicationEquality ile kurmak yavastir.
   Yerine her oda icin gecerli (en, boy, alan) uclulerini onceden uretip
   AddAllowedAssignments ile tablo kisiti veriyoruz. Min kenar ve en/boy
   orani da bu tabloya girdigi icin ayrica kisit yazilmiyor — filtreleme
   arama oncesinde, bir kez yapiliyor.

4. Komsuluklar ZORUNLU DEGIL, agirlikli. Cozulemeyen komsuluk sistemi
   "cozum yok" ile durdurmaz; plani uretir ve raporda hangi komsulugun
   saglanamadigini yazar. (PARAMETRE_SEMASI md.8 ile ayni felsefe:
   sinir asilinca kirpilmaz, uyarilir.)
"""

from __future__ import annotations

from ortools.sat.python import cp_model

YON_KENARLARI = ("sol", "sag", "alt", "ust")


# ─────────────────────────────────────────────────────────────
# Birim donusumu — disarisi metre, CP-SAT'in icerisi tamsayi hucre
# ─────────────────────────────────────────────────────────────

def _hucre(metre: float, izgara: float) -> int:
    """Olcuyu en yakin hucreye yuvarlar. Yalnizca VERI icin (kontur vb.)."""
    return int(round(metre / izgara))


def _tavan(metre: float, izgara: float) -> int:
    """ALT SINIR icin yukari yuvarlar.

    Bu ayrim kritik: kapi genisligi 0.90 m, cozum izgarasi 0.20 m iken
    round(0.90/0.20) = 4 hucre = 0.80 m eder ve esik sessizce dusen bir
    degere doner. Uretilen planda 80 cm'lik gecis cikar, kimse fark etmez.
    Alt sinirlar her zaman yukari, ust sinirlar asagi yuvarlanir.
    """
    return -(-int(round(metre / izgara * 1e6)) // int(1e6))


def _taban(metre: float, izgara: float) -> int:
    """UST SINIR icin asagi yuvarlar."""
    return int(round(metre / izgara * 1e6)) // int(1e6)


def _metre(hucre: int, izgara: float) -> float:
    return round(hucre * izgara, 3)


def _olcu_tablosu(tip: dict, izgara: float, en_sinir: int, boy_sinir: int) -> list[tuple[int, int, int]]:
    """Bir oda tipi icin gecerli (en, boy, alan) uclulerini uretir.

    Alan bandi, min kenar ve en/boy orani burada suzulur; arama uzayina
    zaten yalnizca mimari olarak kabul edilebilir olculer girer.
    """
    alan_min = _tavan(tip["alan_min"], izgara * izgara)
    alan_max = _taban(tip["alan_max"], izgara * izgara)
    min_kenar = _tavan(tip["min_kenar"], izgara)
    max_oran = float(tip["max_oran"])

    tablo: list[tuple[int, int, int]] = []
    for en in range(min_kenar, en_sinir + 1):
        # Bu genislikte alan bandini tutturan boy araligi
        alt = max(min_kenar, -(-alan_min // en))          # tavana yuvarlama
        ust = min(boy_sinir, alan_max // en)
        for boy in range(alt, ust + 1):
            if max(en, boy) > max_oran * min(en, boy):
                continue
            tablo.append((en, boy, en * boy))
    return tablo


# ─────────────────────────────────────────────────────────────
# Ana uretim
# ─────────────────────────────────────────────────────────────

def uret(girdi: dict, program: dict) -> dict:
    """Kontur + oda listesinden ic plan uretir.

    girdi  : {"kontur":{"en","boy"}, "cepheler":[...], "bosluklar":[...],
              "odalar":[{"ad","tip"}], "komsuluklar":[["A","B"], ...]}
    program: oda_programi.json icerigi
    donus  : {"durum", "odalar":[...], "rapor":{...}}
    """
    esik = program["esikler"]
    agirlik = program["agirliklar"]
    izgara = float(esik["izgara"])

    EN = _hucre(girdi["kontur"]["en"], izgara)
    BOY = _hucre(girdi["kontur"]["boy"], izgara)
    kapi = _tavan(esik["kapi_genisligi"], izgara)
    min_cephe = _tavan(esik["min_cephe"], izgara)
    cepheler = set(girdi.get("cepheler", YON_KENARLARI))

    odalar = girdi["odalar"]
    n = len(odalar)
    tipler = [program["tipler"][o["tip"]] for o in odalar]
    adlar = [o["ad"] for o in odalar]

    # Cekirdek, saft gibi konumu onceden belli sabit bloklar.
    # Dikdortgen olmayan konturlar da buradan modellenir: eksik parca
    # sabit bir blok olarak konur, kalan alan gercek konturdur.
    bosluklar = girdi.get("bosluklar", [])
    bosluk_alani = sum(
        _hucre(b["en"], izgara) * _hucre(b["boy"], izgara) for b in bosluklar
    )
    net_alan = EN * BOY - bosluk_alani

    # ── Fizibilite on kontrolu: uydurmadan once soyle ──
    toplam_min = sum(_tavan(t["alan_min"], izgara * izgara) for t in tipler)
    toplam_max = sum(_taban(t["alan_max"], izgara * izgara) for t in tipler)
    if not (toplam_min <= net_alan <= toplam_max):
        return {
            "durum": "GIRDI_TUTARSIZ",
            "odalar": [],
            "rapor": {
                "neden": "Oda alan bantlarinin toplami kontur alanini kapsamiyor.",
                "kontur_net_m2": round(net_alan * izgara * izgara, 2),
                "program_min_m2": round(toplam_min * izgara * izgara, 2),
                "program_max_m2": round(toplam_max * izgara * izgara, 2),
            },
        }

    model = cp_model.CpModel()

    x1, y1, x2, y2, en_v, boy_v, alan_v = [], [], [], [], [], [], []
    x_aralik, y_aralik = [], []

    for i, tip in enumerate(tipler):
        tablo = _olcu_tablosu(tip, izgara, EN, BOY)
        if not tablo:
            return {
                "durum": "GIRDI_TUTARSIZ",
                "odalar": [],
                "rapor": {
                    "neden": f"'{adlar[i]}' icin kontura sigan gecerli olcu yok "
                             f"(min kenar / en-boy orani / alan bandi celisiyor).",
                },
            }

        a = model.NewIntVar(0, EN, f"x1_{i}")
        b = model.NewIntVar(0, EN, f"x2_{i}")
        c = model.NewIntVar(0, BOY, f"y1_{i}")
        d = model.NewIntVar(0, BOY, f"y2_{i}")
        e = model.NewIntVar(1, EN, f"en_{i}")
        f = model.NewIntVar(1, BOY, f"boy_{i}")
        g = model.NewIntVar(1, EN * BOY, f"alan_{i}")

        # (en, boy, alan) yalnizca onceden suzulmus uclulerden birini alabilir
        model.AddAllowedAssignments([e, f, g], tablo)

        x_aralik.append(model.NewIntervalVar(a, e, b, f"xa_{i}"))
        y_aralik.append(model.NewIntervalVar(c, f, d, f"ya_{i}"))

        x1.append(a); x2.append(b); y1.append(c); y2.append(d)
        en_v.append(e); boy_v.append(f); alan_v.append(g)

    # Sabit bloklar da cakisma kontrolune girer
    for k, bl in enumerate(bosluklar):
        bx, by = _hucre(bl["x"], izgara), _hucre(bl["y"], izgara)
        be, bb = _hucre(bl["en"], izgara), _hucre(bl["boy"], izgara)
        x_aralik.append(model.NewIntervalVar(bx, be, bx + be, f"bx_{k}"))
        y_aralik.append(model.NewIntervalVar(by, bb, by + bb, f"by_{k}"))

    # (b) cakisma yok
    model.AddNoOverlap2D(x_aralik, y_aralik)

    # (c) alanlar konturu tam doldurur -> bosluk kalmasi imkansiz
    model.Add(sum(alan_v) == net_alan)

    # ── Cephe iliskisi ──
    # Gun isigi isteyen her oda dis cepheye deger. Balkon icin bu yetmez:
    # "balkon hicbir zaman odalarin icinde olmaz, dis cephede olur"
    # (Murat Turna, 31.07.2026). Cepheye 1.20 m degmek, balkonun plana
    # icerlek bir yarik gibi sokulmasini engellemiyordu — 1.4 x 3.6'lik
    # balkon kisa kenariyla cepheye degip uzun kenariyla ice giriyordu.
    # Kural: UZUN kenar cephede, derinlik sinirli.
    for i, tip in enumerate(tipler):
        if not tip.get("gun_isigi"):
            continue
        kural = tip.get("cephe_kurali") or {}
        uzun_kenar = bool(kural.get("uzun_kenar_cephede"))
        d_max = _taban(kural["derinlik_max"], izgara) if kural.get("derinlik_max") else None

        # kenar -> (degisken, olmasi gereken deger, cephe boyu, derinlik)
        kenarlar = {
            "sol": (x1[i], 0,   boy_v[i], en_v[i]),
            "sag": (x2[i], EN,  boy_v[i], en_v[i]),
            "alt": (y1[i], 0,   en_v[i],  boy_v[i]),
            "ust": (y2[i], BOY, en_v[i],  boy_v[i]),
        }
        secenek = []
        for kenar, (degisken, deger, cephe_boyu, derinlik) in kenarlar.items():
            if kenar not in cepheler:
                continue
            lit = model.NewBoolVar(f"cephe_{kenar}_{i}")
            model.Add(degisken == deger).OnlyEnforceIf(lit)
            model.Add(cephe_boyu >= min_cephe).OnlyEnforceIf(lit)
            if uzun_kenar:
                model.Add(cephe_boyu >= derinlik).OnlyEnforceIf(lit)
            if d_max is not None:
                model.Add(derinlik <= d_max).OnlyEnforceIf(lit)
            secenek.append(lit)
        model.AddBoolOr(secenek)

    sira = {ad: i for i, ad in enumerate(adlar)}

    # ── Giris kapisi ──
    # Bunu yazmadan once model her kisiti sagliyor ve DAIREYE GIRILEMEYEN
    # bir plan uretiyordu: antre plani ortasinda, hicbir kenara degmiyor.
    # CP-SAT yazmadigin kisiti bilmez; ureteci degil, program eksikti.
    giris = girdi.get("giris")
    if giris:
        i = sira[giris["oda"]]
        kenar = giris["kenar"]
        a1 = _taban(giris["konum"], izgara)
        a2 = _tavan(giris["konum"] + giris["genislik"], izgara)
        if kenar == "alt":
            model.Add(y1[i] == 0)
        elif kenar == "ust":
            model.Add(y2[i] == BOY)
        elif kenar == "sol":
            model.Add(x1[i] == 0)
        elif kenar == "sag":
            model.Add(x2[i] == EN)
        # Kapi bosluguna gercekten oturmali
        if kenar in ("alt", "ust"):
            model.Add(x1[i] <= a1)
            model.Add(x2[i] >= a2)
        else:
            model.Add(y1[i] <= a1)
            model.Add(y2[i] >= a2)

    # ── Sirkulasyon tavani ──
    sirk = [alan_v[i] for i, t in enumerate(tipler) if t.get("sirkulasyon")]
    if sirk:
        model.Add(sum(sirk) * 100 <= int(esik["sirkulasyon_max_oran"] * 100) * net_alan)

    # ── Komsuluk degiskenleri ──
    komsu_var: dict[tuple[int, int], cp_model.IntVar] = {}

    def komsuluk(i: int, j: int) -> cp_model.IntVar:
        anahtar = (min(i, j), max(i, j))
        if anahtar in komsu_var:
            return komsu_var[anahtar]
        i, j = anahtar

        # Ortak kenar uzunlugu — iki eksen icin
        ortak = {}
        for eksen, (a1, a2, sinir) in {
            "y": (y1, y2, BOY),
            "x": (x1, x2, EN),
        }.items():
            ust = model.NewIntVar(0, sinir, f"ust_{eksen}_{i}_{j}")
            alt = model.NewIntVar(0, sinir, f"alt_{eksen}_{i}_{j}")
            model.AddMinEquality(ust, [a2[i], a2[j]])
            model.AddMaxEquality(alt, [a1[i], a1[j]])
            fark = model.NewIntVar(-sinir, sinir, f"ortak_{eksen}_{i}_{j}")
            model.Add(fark == ust - alt)
            ortak[eksen] = fark

        # Dort olasi temas yonu
        yonler = [
            (x2[i], x1[j], "y"),   # i solda, j sagda
            (x2[j], x1[i], "y"),   # j solda, i sagda
            (y2[i], y1[j], "x"),   # i altta, j ustte
            (y2[j], y1[i], "x"),   # j altta, i ustte
        ]
        lits = []
        for k, (sol, sag, eksen) in enumerate(yonler):
            lit = model.NewBoolVar(f"temas_{i}_{j}_{k}")
            model.Add(sol == sag).OnlyEnforceIf(lit)
            model.Add(ortak[eksen] >= kapi).OnlyEnforceIf(lit)
            lits.append(lit)

        v = model.NewBoolVar(f"komsu_{i}_{j}")
        # v <=> (herhangi bir yonde temas)
        model.AddBoolOr(lits + [v.Not()])
        for lit in lits:
            model.AddImplication(lit, v)

        komsu_var[anahtar] = v
        return v

    istenen: list[tuple[str, str, cp_model.IntVar]] = []
    for a, b in girdi.get("komsuluklar", []):
        if a not in sira or b not in sira:
            continue
        istenen.append((a, b, komsuluk(sira[a], sira[b])))

    # ── Islak hacimler tek sema yakin dursun (yumusak) ──
    islak = [i for i, t in enumerate(tipler) if t.get("islak")]
    islak_bag = [
        komsuluk(islak[a], islak[b])
        for a in range(len(islak))
        for b in range(a + 1, len(islak))
    ]

    # ── ERISIM (SERT) — her odaya bir gecis mekanindan girilsin ──
    # Bu kisit yazilmadan once uretilen 8 varyantin 6'si mimari olarak
    # oluydu: banyoya yatak odasindan giriliyordu. Hepsi OPTIMAL'di,
    # cunku "erisim" hicbir yerde yazmiyordu. Bunu puanlamayla duzeltmeye
    # calismak yanlis katman — olu plani iyi siralamak degil, hic
    # uretmemek gerekir.
    # Kapinin nereye acilabilecegi oda_programi.json'daki "erisim"
    # tablosundan okunur — koda gomulmez. Banyo/wc koridora acilir;
    # yatak odasindan yalnizca ebeveyn banyosuna girilir (Murat Turna,
    # 31.07.2026). Tabloyu degistirmek kod degisikligi gerektirmez.
    def erisim_kaynaklari(oda_tipi: str) -> list[int]:
        izin = program["tipler"][oda_tipi].get("erisim", ["sirkulasyon"])
        kaynak = set()
        for j, o in enumerate(odalar):
            if "sirkulasyon" in izin and tipler[j].get("sirkulasyon"):
                kaynak.add(j)
            if o["tip"] in izin:
                kaynak.add(j)
        return sorted(kaynak)

    for i, o in enumerate(odalar):
        if tipler[i].get("sirkulasyon"):
            continue
        kaynak = [j for j in erisim_kaynaklari(o["tip"]) if j != i]
        if kaynak:
            model.AddBoolOr([komsuluk(i, j) for j in kaynak])

    gecis = [i for i, t in enumerate(tipler) if t.get("sirkulasyon")]
    if gecis:
        # Gecis mekanlari kendi aralarinda kopuk kalmasin.
        # NOT: bu kosul 3 dugume kadar bagliligi garanti eder. Daha fazla
        # gecis mekaninda gercek baglilik kodlamasi (akis / AddCircuit)
        # gerekir; Asama B'de koridorlu kat plani gelince sart olacak.
        if len(gecis) > 1:
            for i in gecis:
                model.AddBoolOr([komsuluk(i, j) for j in gecis if j != i])

    # ── Amac ──
    sapmalar = []
    for i, tip in enumerate(tipler):
        hedef = _hucre(tip["alan_hedef"], izgara * izgara)
        s = model.NewIntVar(0, EN * BOY, f"sapma_{i}")
        model.AddAbsEquality(s, alan_v[i] - hedef)
        sapmalar.append(s)

    amac = agirlik["alan_sapmasi"] * sum(sapmalar)
    if istenen:
        amac += agirlik["komsuluk_ihlali"] * sum(1 - v for _, _, v in istenen)
    if islak_bag:
        amac += agirlik["islak_dagilmasi"] * (len(islak_bag) - sum(islak_bag))
    model.Minimize(amac)

    # ── Coz ──
    cozucu = cp_model.CpSolver()
    cozucu.parameters.max_time_in_seconds = float(esik["cozum_suresi_sn"])
    cozucu.parameters.num_workers = 8
    cozucu.parameters.random_seed = int(esik.get("tohum", 0))
    sonuc = cozucu.Solve(model)

    if sonuc not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        # Bu ikisini ayirmak sart: biri programin celiskili oldugunu,
        # digeri yalnizca surenin yetmedigini soyler. Ayni mesaji vermek
        # mimari yanlis yone gonderir.
        if sonuc == cp_model.INFEASIBLE:
            durum, neden = "COZUM_YOK", (
                "Kisitlar birlikte saglanamiyor — program celiskili. "
                "Gun isigi isteyen oda sayisini veya sirkulasyon tavanini gozden gecirin."
            )
        else:
            durum, neden = "SURE_YETMEDI", (
                "Verilen surede cozum bulunamadi; celiski kanitlanmadi. "
                "Once cozum izgarasini kabalastirin (0.20 -> 0.25 m), sonra sureyi artirin."
            )
        return {
            "durum": durum,
            "odalar": [],
            "rapor": {"neden": neden, "sure_sn": round(cozucu.WallTime(), 2)},
        }

    cikti_odalar = []
    for i, ad in enumerate(adlar):
        cikti_odalar.append({
            "ad": ad,
            "tip": odalar[i]["tip"],
            "x": _metre(cozucu.Value(x1[i]), izgara),
            "y": _metre(cozucu.Value(y1[i]), izgara),
            "en": _metre(cozucu.Value(en_v[i]), izgara),
            "boy": _metre(cozucu.Value(boy_v[i]), izgara),
            "alan": round(cozucu.Value(alan_v[i]) * izgara * izgara, 2),
        })

    saglanmayan = [
        [a, b] for a, b, v in istenen if not cozucu.Value(v)
    ]
    sirk_alan = sum(
        o["alan"] for o, t in zip(cikti_odalar, tipler) if t.get("sirkulasyon")
    )

    return {
        "durum": "OPTIMAL" if sonuc == cp_model.OPTIMAL else "KABUL_EDILEBILIR",
        "odalar": cikti_odalar,
        "bosluklar": bosluklar,
        "kontur": girdi["kontur"],
        "rapor": {
            "saglanmayan_komsuluklar": saglanmayan,
            "sirkulasyon_orani": round(sirk_alan / (net_alan * izgara * izgara), 4),
            "toplam_alan_sapmasi_m2": round(
                sum(cozucu.Value(s) for s in sapmalar) * izgara * izgara, 2
            ),
            "islak_baglanti": f"{sum(cozucu.Value(v) for v in islak_bag)}/{len(islak_bag)}",
            "sure_sn": round(cozucu.WallTime(), 2),
            "dal_sayisi": cozucu.NumBranches(),
        },
    }
