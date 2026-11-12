# ACCOQUEST Cloudflare + Google Apps Script

## Apa yang ada
- `public/`: frontend statik untuk Cloudflare Pages (top-level HTTPS, bukan Apps Script iframe).
- `functions/api/[[path]].js`: Cloudflare Pages Function yang menjadi API proxy ke Google Apps Script.
- `GAS_API_ADAPTER.gs`: adapter `doPost` untuk dispatch panggilan game sedia ada.

## Penting sebelum deploy
Pakej ini menukar frontend sedia ada daripada `google.script.run` kepada `fetch('/api/game')`. Ia mengekalkan action names yang digunakan oleh frontend. Adapter GAS memerlukan fungsi backend ini wujud dalam projek asal: `createLobby`, `joinLobby`, `getGameState`, `setReady`, `startGame`, `getQuestion`, `submitAnswer`, `chooseBlock`, `spinPoints`, `resetGame`. Semak tandatangan/struktur return dalam Code.gs asal sebelum pemasangan. Fail Code.gs asal belum disertakan dalam bahan kerja yang tersedia, jadi adapter ini perlu dipadankan jika nama atau argumen fungsi berbeza.

## 1. Cloudflare Pages
1. Log masuk ke Cloudflare Dashboard.
2. Workers & Pages → Create → Pages → Direct Upload (atau sambungkan Git).
3. Muat naik folder projek ini, pastikan `public/` ialah output directory dan folder `functions/` berada pada root projek. Untuk Pages Functions, gunakan deployment melalui Wrangler/Git integration jika Direct Upload tidak menyertakan Functions.
4. Uji alamat sementara `https://<project>.pages.dev` dahulu.

## 2. Environment variables / secrets
Dalam Pages project → Settings → Variables and Secrets, tetapkan:
- `GAS_WEBAPP_URL` = URL deployment Apps Script yang berakhir dengan `/exec`.
- `ACCOQUEST_API_KEY` = secret rawak panjang (simpan sebagai Secret, bukan plain variable).

## 3. Google Apps Script
1. Buka projek Apps Script yang mengandungi backend game sebenar.
2. Tambahkan kandungan `GAS_API_ADAPTER.gs` ke `Code.gs`; jangan padam fungsi permainan sedia ada.
3. Dalam Project Settings → Script Properties, tambah `ACCOQUEST_API_KEY` dengan nilai sama seperti Cloudflare Secret.
4. Deploy → Manage deployments → Edit → New version → Deploy.
5. Pastikan Web App execute as owner dan akses deployment membenarkan panggilan server-to-server yang diperlukan (lazimnya Anyone). Secret API tetap mengawal tindakan melalui adapter.

## 4. NFC
- Web NFC hanya dicuba daripada frontend Cloudflare Pages yang dibuka sebagai halaman HTTPS top-level.
- Sokongan Web NFC bergantung pada browser/peranti; Chrome Android ialah sasaran utama. iOS Safari tidak menyediakan `NDEFReader`.
- Untuk kad NFC URL, tulis URL seperti `https://<pages-project>.pages.dev/?qid=AUD001` dahulu. Selepas domain disambung, tulis semula kad menggunakan `https://accoquest.com/?qid=AUD001`.
- Pengguna perlu sudah menyertai lobby pada browser/origin yang sama sebelum mengetik kad supaya localStorage player/lobby kekal tersedia.

## 5. Domain accoquest.com
Domain belum dimiliki. Selepas mendaftar domain:
1. Add site/domain ke Cloudflare dan ikut arahan nameserver registrar.
2. Pages project → Custom domains → Set up a domain → `accoquest.com`.
3. Ikut pengesahan DNS/TLS Cloudflare.
4. Uji HTTPS dan NFC URL selepas domain aktif.

## 6. Had integrasi semasa
Backend Code.gs penuh tidak disertakan dalam folder sumber yang tersedia semasa pakej ini dibina. Oleh itu adapter ini ialah jambatan berdasarkan nama fungsi yang digunakan oleh frontend, bukan pengesahan bahawa semua signature backend asal sepadan. Untuk integrasi siap sepenuhnya, semak/laraskan adapter dengan Code.gs sebenar. Jangan anggap sistem multiplayer sudah live sehingga test create lobby, join dari peranti kedua, READY, soalan, jawapan, spin dan leaderboard berjaya.
