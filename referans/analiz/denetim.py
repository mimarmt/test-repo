"""Tum parametrelerin gercek veriye karsi denetimi.

    python -m referans.analiz.denetim

Her parametre icin: benim degerim, verinin soyledigi, hukum.
"""

from __future__ import annotations

import numpy as np

from .veri import TABLO

SIRKULASYON = {"koridor", "antre"}
ISLAK = {"wc_dus", "kucuk_wc", "wc_camasir"}
YATAK = {"yatak", "yatak_1", "yatak_2", "yatak_3", "yatak_4", "eb_yatak_1"}


def baslik(s: str) -> None:
    print(f"\n{'═' * 76}\n{s}\n{'═' * 76}")


def sirkulasyon() -> None:
    baslik("A · SIRKULASYON TAVANI — CLAUDE.md: 'sirkulasyon %8'i gecmemeli'")
    print(f"  {'tipoloji':9s} {'net':>6s}  {'koridor':>8s} {'antre':>7s}  "
          f"{'yalniz kor.':>12s} {'kor.+antre':>11s}  hukum")
    ihlal_k = ihlal_ka = toplam = 0
    for tip, (adlar, satirlar) in TABLO.items():
        for net, alanlar in satirlar:
            d = dict(zip(adlar, alanlar))
            kor = d.get("koridor", 0.0)
            ant = d.get("antre", 0.0)
            if kor == 0 and ant == 0:
                continue
            toplam += 1
            o1, o2 = kor / net, (kor + ant) / net
            ihlal_k += o1 > 0.08
            ihlal_ka += o2 > 0.08
            im = "✗ ASIYOR" if o2 > 0.08 else "✓"
            print(f"  {tip:9s} {net:6.0f}  {kor:8.1f} {ant:7.1f}  "
                  f"{o1*100:11.1f}% {o2*100:10.1f}%  {im}")
    print(f"\n  Yalnizca koridor sayilirsa : {ihlal_k}/{toplam} satir %8'i asiyor")
    print(f"  Koridor + antre sayilirsa  : {ihlal_ka}/{toplam} satir %8'i asiyor")
    print("\n  HUKUM: %8 tavani mimarin KENDI cozumleriyle celisiyor.")
    print("  Ya tanim dar (yalniz koridor) ya da tavan yanlis. Karar mimarin.")


def islak_hacim() -> None:
    baslik("B · ISLAK HACIM — 'wc+dus' tek oda mu, toplam butce mu?")
    print("  wc+dus alani net m2 ile nasil buyuyor:\n")
    for tip, (adlar, satirlar) in TABLO.items():
        if "wc_dus" not in adlar or len(satirlar) < 2:
            continue
        k = adlar.index("wc_dus")
        print(f"  {tip}:")
        for net, alanlar in satirlar:
            pay = alanlar[k] / net * 100
            print(f"     {net:5.0f} m2 net → wc+dus {alanlar[k]:5.1f} m2  (%{pay:.1f})")
        ilk, son = satirlar[0][1][k], satirlar[-1][1][k]
        print(f"     {ilk:.0f} → {son:.0f} m2  ({son/ilk:.1f} kat)\n")
    print("  3+1'de wc+dus 75 m2'de 6 m2, 100 m2'de 12 m2 — TAM IKI KATI.")
    print("  Tek bir banyo 6'dan 12 m2'ye buyumez; bu bir banyo + bir")
    print("  ebeveyn banyosu gibi durur. Eger oyleyse aradiginiz esik:")
    print("\n     3+1 ebeveyn banyosu esigi ≈ 100 m2 NET")
    print("\n  ⚠ VARSAYIM, dogrulanmadi. Cevabi yalnizca siz verebilirsiniz:")
    print("  100 m2'lik 3+1'inizde kac ayri islak hacim var?")


def antre() -> None:
    baslik("C · ANTRE — modelim zorunlu tutuyor, tabloda 4+1'e kadar YOK")
    for tip, (adlar, _) in TABLO.items():
        var = "VAR" if "antre" in adlar else "yok"
        kor = "koridor VAR" if "koridor" in adlar else "koridor yok"
        print(f"  {tip:5s} antre {var:3s}   {kor}")
    print("\n  HUKUM: 1+1, 2+1, 3+1'de giris holu ile koridor AYNI mekan.")
    print("  Antre ayri bir oda olarak ancak 140 m2'de (4+1) beliriyor.")
    print("  Modelim 'giris' kapisini ANTRE odasina bagliyor -> 3+1 icin YANLIS.")
    print("  Duzeltme: giris, o tipolojide hangi sirkulasyon mekani varsa ona baglanir.")


def salon_mutfak() -> None:
    baslik("D · SALON-MUTFAK — 'salondan mutfaga gecilmez' kurali her yerde mi?")
    for tip, (adlar, _) in TABLO.items():
        if "salon_mutfak" in adlar:
            print(f"  {tip:5s} → salon ve mutfak TEK HUCRE (birlesik)")
        elif "salon" in adlar and "mutfak" in adlar:
            print(f"  {tip:5s} → salon ve mutfak AYRI")
        else:
            print(f"  {tip:5s} → salon yok")
    print("\n  HUKUM: 1+1'de mutfak salonun icinde. 'Salondan mutfaga gecilmez'")
    print("  kurali 1+1 icin anlamsiz; kural 2+1 ve yukarisinda gecerli.")
    print("  Kurallara TIPOLOJI KAPSAMI alani eklenmeli.")


def balkon() -> None:
    baslik("E · BALKON — tabloda hic yok")
    print("  Hicbir tipolojide balkon sutunu yok ve oda alanlari net m2'yi")
    print("  TAM dolduruyor. Yani bu tablo balkonu net alana KATMIYOR.")
    print("\n  Modelim balkonu konturun icine doseyip alanini net alandan")
    print("  dusuyor. Bu, 120 m2'lik bir daireden 5-8 m2'yi ic mekandan")
    print("  calmak demek. Iki model uyusmuyor.")
    print("\n  HUKUM: balkon net alan butcesinin DISINDA tutulmali —")
    print("  ya kontura eklenen cikma, ya ayri bir alan kalemi. Karar mimarin.")


def tipoloji_araliklari() -> None:
    baslik("F · TIPOLOJI m2 ARALIKLARI — ortusme ve bosluk")
    araliklar = []
    for tip, (_, satirlar) in TABLO.items():
        netler = [s[0] for s in satirlar]
        araliklar.append((tip, min(netler), max(netler)))
        print(f"  {tip:5s}  {min(netler):5.0f} – {max(netler):5.0f} m2 net")
    print("\n  Ortusen bolgeler — ayni m2'de iki tipoloji satilabilir:")
    for i in range(len(araliklar) - 1):
        t1, _, u1 = araliklar[i]
        t2, a2, _ = araliklar[i + 1]
        if a2 <= u1:
            print(f"     {a2:5.0f} – {u1:5.0f} m2  →  {t1} veya {t2}  (ticari karar)")
        else:
            print(f"     {u1:5.0f} – {a2:5.0f} m2  →  BOSLUK, tipoloji tanimli degil")


def bant_onerisi() -> None:
    baslik("G · DUZELTILMIS PARAMETRE ONERISI — pay tabanli, veriden")
    print("  alan = oran × net m2   (oran tipolojiye gore degisir)")
    print("  Sabit oda tipleri icin oran yerine sabit deger.\n")
    for tip, (adlar, satirlar) in TABLO.items():
        if len(satirlar) < 2:
            continue
        netler = np.array([s[0] for s in satirlar], dtype=float)
        print(f"  ── {tip}")
        for k, ad in enumerate(adlar):
            y = np.array([s[1][k] for s in satirlar], dtype=float)
            pay = y / netler
            egim = np.polyfit(netler, y, 1)[0]
            if abs(egim) < 0.02:
                print(f"     {ad:14s} SABIT {y.mean():5.1f} m2  "
                      f"(gozlenen {y.min():.1f}–{y.max():.1f})")
            else:
                print(f"     {ad:14s} oran %{pay.mean()*100:5.2f}  "
                      f"(sacilim %{pay.min()*100:.1f}–%{pay.max()*100:.1f})  "
                      f"→ alan = {pay.mean():.4f} × net")
        print()


def main() -> int:
    sirkulasyon()
    islak_hacim()
    antre()
    salon_mutfak()
    balkon()
    tipoloji_araliklari()
    bant_onerisi()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
