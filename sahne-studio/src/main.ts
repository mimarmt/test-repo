import "cesium/Build/Cesium/Widgets/widgets.css";
import "./stil.css";
import { googleAnahtari, urlBayraklari } from "./yardimci/ortam";
import { kilitEkraniGoster } from "./arayuz/kilitEkrani";

async function basla(): Promise<void> {
  const anahtar = googleAnahtari();
  if (!anahtar) {
    kilitEkraniGoster();
    return;
  }
  const { uygulamayiBaslat } = await import("./uygulama");
  await uygulamayiBaslat(anahtar, urlBayraklari());
}

void basla();
