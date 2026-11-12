# ACCOQUEST — Google Apps Script + Cloudflare Pages + NFC

Pakej ini mengekalkan backend permainan asal pada Google Apps Script dan Google Sheets. Cloudflare Pages hanya menjadi frontend HTTPS supaya `NDEFReader` boleh digunakan pada Android yang menyokong Web NFC.

## Kandungan
- `Code.gs` — kod backend asal yang dibekalkan, ditambah API `doPost` yang diperlukan Cloudflare.
- `GAS_API_ADAPTER.gs` — salinan adapter API sahaja (jangan tambah dua kali jika menggunakan `Code.gs` gabungan).
- `public/` — frontend ACCOQUEST.
- `functions/api/[[path]].js` — API proxy Cloudflare ke Apps Script.
- `wrangler.toml` — tetapan Pages.

## Langkah 1 — Google Apps Script
1. Buka projek Apps Script sedia ada.
2. Simpan salinan/backup projek dahulu.
3. Gantikan kandungan `Code.gs` dengan kandungan fail `Code.gs` dalam pakej ini. Jangan masukkan `GAS_API_ADAPTER.gs` sekali lagi kerana adapter sudah digabungkan di hujung `Code.gs`.
4. Jalankan `setupDatabase()` sekali daripada editor Apps Script dan benarkan akses Google Sheets.
5. Buka **Project Settings → Script Properties** dan tambah:
   - Property: `ACCOQUEST_API_KEY`
   - Value: cipta satu secret panjang dan rawak. Contoh format: `AQ-` diikuti sekurang-kurangnya 40 aksara rawak. Jangan gunakan contoh ini sebagai kata laluan sebenar.
6. Deploy → **New deployment** → type **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone** (API tetap menyemak secret di atas)
7. Salin URL Web App yang berakhir dengan `/exec`.

## Langkah 2 — Cloudflare Pages
1. Log masuk Cloudflare dan buka **Workers & Pages → Create → Pages**.
2. Untuk menyertakan folder `functions/`, deploy menggunakan Wrangler atau sambungan Git. Kaedah muat naik fail statik sahaja tidak menjalankan Pages Functions.
3. Tetapkan output directory kepada `public`.
4. Di **Settings → Variables and Secrets**, tambah dua nilai:
   - `GAS_WEBAPP_URL` = URL `/exec` daripada Langkah 1
   - `ACCOQUEST_API_KEY` = secret yang sama seperti Script Properties Apps Script
5. Deploy dan buka URL `https://NAMA-PROJEK.pages.dev`.

## Langkah 3 — Cara NFC
### Android
1. Buka ACCOQUEST melalui Chrome pada URL `https://...pages.dev`.
2. Sertai lobby. Apabila giliran anda, tekan **SCAN NFC CARD** dan benarkan NFC.
3. Kad boleh mengandungi rekod NDEF jenis Text dengan ID seperti `AUD001`, atau URL dengan parameter `?qid=AUD001`.

### iPhone
1. iPhone tidak menyokong `NDEFReader` dalam Safari. Gunakan kad NFC jenis URL.
2. Tulis URL penuh seperti `https://NAMA-PROJEK.pages.dev/?qid=AUD001` pada kad.
3. Pemain perlu membuka ACCOQUEST dan menyertai lobby menggunakan Safari pada domain yang sama terlebih dahulu. Apabila kad diimbas, URL membuka halaman dengan `qid`; soalan akan dimuatkan secara automatik apabila giliran pemain tersebut.

**Nota:** Setiap pemain perlu menggunakan browser dan domain yang sama untuk mengekalkan `localStorage` (ID pemain dan lobby). Uji dengan dua telefon sebelum sesi sebenar.

## Ujian penerimaan
- Create Lobby dan Join Lobby pada peranti kedua.
- Kedua-dua pemain tekan READY; host mula permainan.
- Android: imbas kad NDEF ketika giliran sendiri.
- iPhone: buka URL NFC `?qid=AUD001` ketika giliran sendiri.
- Hantar jawapan, pilih block, spin mata, dan semak leaderboard.

Jika mana-mana langkah gagal, semak dahulu URL `/exec`, dua secret yang mesti sama, dan deployment Apps Script versi terkini.
