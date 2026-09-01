export function kilitEkraniGoster(): void {
  const kaplama = document.getElementById("kaplama");
  if (!kaplama) return;
  kaplama.hidden = false;
  kaplama.innerHTML = `
    <div class="kilit-kart" id="kilit-ekrani">
      <h1>Sahne <span>Studio</span></h1>
      <p><strong>Google API anahtarı gerekli.</strong> Gerçek 3D şehir dokusu ve AI render için
      tek bir Google anahtarı yeterli. Kurulum bir kez yapılır:</p>
      <ol>
        <li><a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer">Google Cloud Console</a>'da
          projenizde bir API anahtarı oluşturun (veya mevcut anahtarınızı kullanın).</li>
        <li>Anahtarın kullanabileceği API'lere şunları ekleyin:
          <strong>Map Tiles API</strong> ve <strong>Gemini API</strong>.</li>
        <li>Bu klasörde <code>.env.example</code> dosyasını <code>.env</code> adıyla kopyalayın ve
          <code>VITE_GOOGLE_API_KEY=</code> satırına anahtarınızı yapıştırın.</li>
        <li>Uygulamayı yeniden başlatın: <code>npm run dev</code></li>
      </ol>
      <p>İpucu: Anahtarı "yalnızca API" ile kısıtlayın (Map Tiles + Gemini). Web sitesi (referer)
      kısıtı koyarsanız render betiği çalışmaz — ayrıntı README'de.</p>
      <p>Aylık 1.000 sahne oturumu ve Gemini deneme kotası ücretsizdir; ofis kullanımında maliyet
      görsel başına ~0,12–0,24 $ ile sınırlı kalır.</p>
    </div>`;
}
