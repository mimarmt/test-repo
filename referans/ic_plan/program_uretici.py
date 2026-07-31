"""Daire tipi + brut m2 -> oda listesi ve alan bantlari.

Bu modul, oda programinin SABIT olmadigini kabul eder. 120 m2'lik bir 3+1
ile 95 m2'lik bir 3+1 ayni programa sahip degildir: kucuk olanda tek duslu
wc vardir ve alan diger odalara dagilir; buyuk olanda ebeveyn banyosu
ayrilir (ticari satista avantaj).

Su an ESIKLER YOK. Uydurmak yerine acik hata veriyor — bu bilincli bir
tercih: yanlis esikle uretilen plan, plan uretmemekten kotudur, cunku
dogru gorunur.
"""

from __future__ import annotations


class EsikYok(Exception):
    """Program semasindaki esik henuz olculmedi."""


def oda_listesi(tipoloji: str, brut_m2: float, sema: dict) -> list[dict]:
    """Verilen tipoloji ve brut alan icin oda listesini kurar."""
    t = sema["tipolojiler"].get(tipoloji)
    if t is None:
        raise KeyError(f"Bilinmeyen tipoloji: {tipoloji}")

    odalar = [{"tip": tip} for tip in t["cekirdek_odalar"]]

    for kosullu in t["kosullu_odalar"]:
        esik = kosullu["kosul"].get("brut_m2_min")
        if esik is None:
            raise EsikYok(
                f"'{kosullu['tip']}' esigi olculmedi "
                f"({kosullu['esik_kaynagi']}). {brut_m2:.0f} m2'lik "
                f"{tipoloji} icin bu odanin konup konmayacagi bilinmiyor. "
                f"Tahmin edilmeyecek."
            )
        if brut_m2 >= esik:
            odalar.append({"tip": kosullu["tip"]})

    # Ayni tipten birden fazla varsa numaralandir
    sayac: dict[str, int] = {}
    for o in odalar:
        sayac[o["tip"]] = sayac.get(o["tip"], 0) + 1
    gorulen: dict[str, int] = {}
    for o in odalar:
        gorulen[o["tip"]] = gorulen.get(o["tip"], 0) + 1
        o["ad"] = (
            f"{o['tip'].replace('_', ' ').title()} {gorulen[o['tip']]}"
            if sayac[o["tip"]] > 1
            else o["tip"].replace("_", " ").title()
        )
    return odalar


def alan_bandi(tip: str, brut_m2: float, sema: dict) -> dict[str, float]:
    """Oda tipinin bu daire buyuklugundeki alan bandi.

    hedef = egim * brut + sabit ; min/max = hedef -+ bant
    Katsayilar Excel'den regresyonla gelir; yoksa hata verir.
    """
    kat = sema["alan_dagilimi"]["tipler"].get(tip)
    if not kat:
        raise EsikYok(
            f"'{tip}' icin alan-m2 iliskisi olculmedi. "
            f"oda_programi.json'daki sabit bant kullanilirsa sonuc "
            f"{brut_m2:.0f} m2 icin dogru olmayabilir."
        )
    hedef = kat["egim"] * brut_m2 + kat["sabit"]
    return {
        "alan_hedef": round(hedef, 2),
        "alan_min": round(hedef - kat["bant"], 2),
        "alan_max": round(hedef + kat["bant"], 2),
    }


def doyma_orani(plan: dict, program: dict) -> float:
    """Odalarin kacta kaci alan bandinin UST sinirina dayanmis.

    Esik bulma olcutu: bu oran yuksekse (ornegin > 0.5) oda programi o
    daire icin FAZLA KUCUKTUR — kosullu bir oda eklenmelidir.

    Olculdu (31.07.2026, 120 m2 brut 3+1):
      tek duslu wc          -> doyma yuksek, farkli topoloji 4
      + ebeveyn banyosu     -> doyma dustu,  farkli topoloji 7
    """
    tipler = program["tipler"]
    doyan = 0
    for o in plan["odalar"]:
        ust = tipler[o["tip"]]["alan_max"]
        if o["alan"] >= ust - 0.05:
            doyan += 1
    return doyan / len(plan["odalar"])
