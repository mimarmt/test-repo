"""Varyant uretimi — tek "en iyi" plan degil, FARKLI planlar.

"Dogru planlar onume gelmiyor" sikayetinin en sik sebebi puanlamanin
yanlis olmasi degil, LISTENIN KLON DOLU olmasidir: ilk 5 varyant ayni
topolojinin 20 cm kaymis halleridir. Mimar 5 plan gordugunu sanir,
aslinda 1 plan gormustur; iyi plan 40 klonun altinda kalir.

Iki mekanizma:

1. AGIRLIK UZAYINDA ORNEKLEME. Her kosuda amac agirliklari sarsilir.
   Boylece her varyant "bir agirliklandirmaya gore optimal"dir —
   rastgele bozulmus bir plan degil. Mimara savunulabilir: bu plan
   komsuluga daha cok, alan hedefine daha az onem verirse en iyisi.

2. TOPOLOJI IMZASIYLA TEKILLESTIRME. Iki plan, ayni oda ciftleri
   birbirine degiyorsa AYNI plandir — 20 cm'lik kayma yeni plan degildir.
   Imza = kapi genisligini gecen komsuluklarin kumesi.
"""

from __future__ import annotations

import copy
import random

from .dogrula import _ortak_kenar
from .motor import uret


def topoloji_imzasi(plan: dict, kapi: float) -> frozenset[tuple[str, str]]:
    """Planin komsuluk grafi. Mimarin "farkli plan" dedigi sey budur."""
    o = plan["odalar"]
    return frozenset(
        (min(a["ad"], b["ad"]), max(a["ad"], b["ad"]))
        for i, a in enumerate(o)
        for b in o[i + 1:]
        if _ortak_kenar(a, b) >= kapi - 1e-9
    )


def uret_varyantlar(
    girdi: dict,
    program: dict,
    sayi: int = 5,
    deneme: int = 12,
    tohum: int = 0,
    sarsma: float = 0.6,
) -> list[dict]:
    """Topolojisi birbirinden farkli en fazla `sayi` plan dondurur.

    deneme : kac kez cozulecegi (her cozum bir agirlik ornegi)
    sarsma : agirliklarin carpani [1-sarsma, 1+sarsma] araliginda gezer
    """
    rng = random.Random(tohum)
    kapi = program["esikler"]["kapi_genisligi"]

    bulunan: dict[frozenset, dict] = {}
    for k in range(deneme):
        p = copy.deepcopy(program)
        p["esikler"]["tohum"] = rng.randrange(1 << 30)
        if k > 0:  # ilk kosu bozulmamis agirliklarla
            for ad in p["agirliklar"]:
                if ad.startswith("_"):
                    continue
                carpan = 1.0 + rng.uniform(-sarsma, sarsma)
                p["agirliklar"][ad] = max(1, int(p["agirliklar"][ad] * carpan))

        plan = uret(girdi, p)
        if not plan.get("odalar"):
            continue
        plan["agirliklar"] = {
            a: v for a, v in p["agirliklar"].items() if not a.startswith("_")
        }
        imza = topoloji_imzasi(plan, kapi)
        # Ayni topoloji tekrar cikarsa alan sapmasi kucuk olani tut
        onceki = bulunan.get(imza)
        if onceki is None or (
            plan["rapor"]["toplam_alan_sapmasi_m2"]
            < onceki["rapor"]["toplam_alan_sapmasi_m2"]
        ):
            bulunan[imza] = plan
        if len(bulunan) >= sayi and k >= sayi:
            break

    return list(bulunan.values())[:sayi]
