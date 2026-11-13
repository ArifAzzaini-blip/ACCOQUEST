const CONFIG = {
  APP_NAME: 'ACCOQUEST',
  MAX_PLAYERS: 4,
  MIN_PLAYERS: 2,
  DEFAULT_ROUNDS: 3,
  LOBBY_SHEET: 'Lobbies',
  QUESTION_SHEET: 'Questions',
  HISTORY_SHEET: 'GameHistory'
};

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('ACCOQUEST | Scan. Answer. Spin. Win.')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** Run once from the Apps Script editor. Creates the spreadsheet database. */
function setupDatabase() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('ACCOQUEST_DB_ID');
  let ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('ACCOQUEST DATABASE');
  props.setProperty('ACCOQUEST_DB_ID', ss.getId());
  ensureSheet_(ss, CONFIG.LOBBY_SHEET, ['LobbyID','DataJSON','UpdatedAt']);
  const qs = ensureSheet_(ss, CONFIG.QUESTION_SHEET, ['QuestionID','Category','Question','OptionA','OptionB','OptionC','OptionD','Answer','Subcategory','Difficulty','Explanation','Marks','Active']);
  ensureSheet_(ss, CONFIG.HISTORY_SHEET, ['Timestamp','LobbyID','Round','PlayerID','Username','QuestionID','Correct','Block','Points']);
  ensureSheet_(ss, 'Players', ['LobbyID','PlayerID','Username','Ready','JoinedAt','IsHost']);
  ensureSheet_(ss, 'Scores', ['LobbyID','PlayerID','Username','TotalPoints','CorrectCount','WrongCount','UpdatedAt']);
  const settings = ensureSheet_(ss, 'Settings', ['SettingKey','SettingValue','Description']);
  if (qs.getLastRow() < 2) {
    const questionRows = getAuditQuestionBank_();
    qs.getRange(2,1,questionRows.length,questionRows[0].length).setValues(questionRows);
    qs.setFrozenRows(1); qs.autoResizeColumns(1,13);
  }
  if (settings.getLastRow() < 2) settings.getRange(2,1,6,3).setValues([
    ['MAX_PLAYERS',4,'Bilangan maksimum pemain dalam satu lobby'],
    ['MIN_PLAYERS',2,'Bilangan minimum pemain untuk mula'],
    ['DEFAULT_ROUNDS',3,'Jumlah pusingan lalai'],
    ['QUESTION_TIME_SECONDS',30,'Masa menjawab setiap soalan'],
    ['QUESTION_CATEGORY','Audit','Kategori set soalan semasa'],
    ['QUESTION_DIFFICULTY','Sederhana','Tahap kesukaran set soalan']
  ]);
  return {spreadsheetId:ss.getId(),spreadsheetUrl:ss.getUrl(),questionCount:qs.getLastRow()-1};
}
function getAuditQuestionBank_() {
  return [["AUD001", "Audit", "Apakah tujuan utama juruaudit menyediakan pelan audit?", "Menentukan jumlah keuntungan syarikat", "Memastikan audit dijalankan secara berkesan dan cekap", "Menggantikan tanggungjawab pengurusan", "Menyediakan penyata kewangan bagi pihak klien", "B", "Perancangan Audit", "Sederhana", "Pelan audit membantu menentukan skop, masa dan arah kerja audit.", 1, true], ["AUD002", "Audit", "Antara berikut, yang manakah perlu difahami oleh juruaudit sebelum merancang prosedur audit?", "Persekitaran perniagaan dan kawalan dalaman entiti", "Pilihan pelaburan peribadi pengarah", "Strategi pemasaran pesaing sahaja", "Keutamaan peribadi pemegang saham", "A", "Perancangan Audit", "Sederhana", "Pemahaman entiti dan persekitarannya membantu juruaudit mengenal pasti risiko salah nyata material.", 1, true], ["AUD003", "Audit", "Apakah maksud materialiti dalam audit?", "Kesilapan yang sentiasa menyebabkan penipuan", "Amaun atau sifat salah nyata yang boleh mempengaruhi keputusan pengguna penyata kewangan", "Jumlah keseluruhan aset syarikat", "Perbezaan kecil yang tidak perlu direkodkan", "B", "Materialiti", "Sederhana", "Materialiti dinilai berdasarkan saiz dan sifat maklumat serta kesannya kepada pengguna.", 1, true], ["AUD004", "Audit", "Risiko audit merujuk kepada risiko bahawa juruaudit:", "Tidak dapat menyiapkan audit dalam sehari", "Memberi pendapat yang tidak sesuai apabila penyata kewangan mengandungi salah nyata material", "Tidak menerima surat pelantikan", "Gagal mengutip fi audit", "B", "Risiko Audit", "Sederhana", "Risiko audit ialah risiko pendapat audit yang tidak sesuai terhadap penyata kewangan yang tersalah nyata secara material.", 1, true], ["AUD005", "Audit", "Komponen risiko audit yang berkaitan dengan kelemahan kawalan dalaman ialah:", "Risiko inheren", "Risiko kawalan", "Risiko pengesanan", "Risiko perniagaan", "B", "Risiko Audit", "Sederhana", "Risiko kawalan ialah risiko kawalan dalaman gagal mencegah atau mengesan dan membetulkan salah nyata.", 1, true], ["AUD006", "Audit", "Jika risiko inheren dan risiko kawalan dinilai tinggi, juruaudit lazimnya perlu:", "Mengurangkan bukti audit", "Meningkatkan prosedur substantif dan mengurangkan risiko pengesanan", "Mengabaikan kawalan dalaman", "Memberi pendapat tanpa pengubahsuaian secara automatik", "B", "Risiko Audit", "Sederhana", "Risiko salah nyata material yang tinggi memerlukan tindak balas audit yang lebih kukuh.", 1, true], ["AUD007", "Audit", "Antara berikut, bukti audit manakah biasanya lebih boleh dipercayai?", "Penjelasan lisan pengurus tanpa dokumen", "Dokumen luaran yang diperoleh terus oleh juruaudit daripada pihak bebas", "Salinan dokumen yang disediakan sendiri oleh klien tanpa sokongan", "Anggaran tidak rasmi kakitangan", "B", "Bukti Audit", "Sederhana", "Bukti daripada sumber luaran bebas yang diperoleh terus oleh juruaudit lazimnya lebih boleh dipercayai.", 1, true], ["AUD008", "Audit", "Apakah tujuan prosedur pengesahan luaran bagi baki penghutang?", "Mengesahkan baki dengan mendapatkan maklum balas terus daripada pelanggan", "Menentukan kadar susut nilai aset", "Mengesahkan kehadiran pekerja", "Menyemak harga jualan pesaing", "A", "Bukti Audit", "Sederhana", "Pengesahan luaran memberikan bukti terus daripada pihak ketiga mengenai baki atau transaksi.", 1, true], ["AUD009", "Audit", "Pemeriksaan fizikal aset tetap paling sesuai memberikan bukti tentang:", "Hak milik undang-undang secara muktamad", "Kewujudan aset pada tarikh pemeriksaan", "Ketepatan semua pengiraan susut nilai", "Nilai boleh realisasi bersih secara automatik", "B", "Bukti Audit", "Sederhana", "Pemeriksaan fizikal menyokong asersi kewujudan, tetapi tidak semestinya membuktikan pemilikan atau penilaian.", 1, true], ["AUD010", "Audit", "Apakah tindakan sesuai jika bukti audit daripada dua sumber bercanggah?", "Pilih bukti yang menyokong pengurusan", "Abaikan kedua-dua sumber", "Siasat percanggahan dan dapatkan bukti tambahan yang sesuai", "Terus keluarkan pendapat bersih", "C", "Bukti Audit", "Sederhana", "Percanggahan perlu disiasat dan bukti tambahan diperoleh sebelum kesimpulan dibuat.", 1, true], ["AUD011", "Audit", "Apakah tujuan utama sistem kawalan dalaman?", "Menjamin syarikat memperoleh keuntungan", "Memberi jaminan munasabah tentang operasi, pelaporan dan pematuhan", "Menghapuskan semua risiko perniagaan", "Menggantikan audit luar", "B", "Kawalan Dalaman", "Sederhana", "Kawalan dalaman memberi jaminan munasabah, bukan jaminan mutlak, terhadap objektif organisasi.", 1, true], ["AUD012", "Audit", "Pengasingan tugas bermaksud:", "Seorang pekerja mengendalikan semua transaksi", "Tugas kebenaran, penyimpanan aset dan rekod dibahagikan kepada individu berbeza", "Semua pekerja mempunyai kata laluan sama", "Pengurus tidak menyemak transaksi", "B", "Kawalan Dalaman", "Sederhana", "Pengasingan tugas mengurangkan peluang kesilapan dan penyelewengan tidak dikesan.", 1, true], ["AUD013", "Audit", "Kawalan manakah paling sesuai untuk mengurangkan risiko pembayaran invois dua kali?", "Membayar invois sebaik diterima", "Mengecap invois sebagai telah dibayar dan menyemak nombor invois dalam sistem", "Membenarkan pembekal menyediakan baucar bayaran", "Menyimpan invois tanpa nombor rujukan", "B", "Kawalan Dalaman", "Sederhana", "Penandaan dan semakan invois mengurangkan risiko pembayaran berganda.", 1, true], ["AUD014", "Audit", "Apakah contoh kawalan pencegahan?", "Semakan audit selepas akhir tahun", "Kelulusan penyelia sebelum pesanan pembelian dibuat", "Penyiasatan selepas wang hilang", "Rekonsiliasi selepas kesilapan berlaku", "B", "Kawalan Dalaman", "Sederhana", "Kelulusan awal bertujuan mencegah transaksi tidak dibenarkan.", 1, true], ["AUD015", "Audit", "Rekonsiliasi bank secara berkala merupakan contoh:", "Kawalan pengesanan", "Kawalan pencegahan sahaja", "Kawalan pengganti audit", "Kawalan fizikal inventori", "A", "Kawalan Dalaman", "Sederhana", "Rekonsiliasi membantu mengesan perbezaan antara rekod tunai dan penyata bank.", 1, true], ["AUD016", "Audit", "Kelemahan kawalan dalaman yang ketara perlu dimaklumkan kepada:", "Pelanggan syarikat", "Pihak yang dipertanggungjawabkan dengan tadbir urus", "Semua pesaing syarikat", "Media sosial", "B", "Kawalan Dalaman", "Sederhana", "Kelemahan signifikan perlu dikomunikasikan kepada pihak tadbir urus mengikut keperluan piawaian.", 1, true], ["AUD017", "Audit", "Dokumen yang lazimnya menjadi bukti penghantaran barang kepada pelanggan ialah:", "Nota penghantaran", "Penyata bank", "Baucar pembayaran gaji", "Pesanan pembelian pembekal", "A", "Kitaran Jualan", "Sederhana", "Nota penghantaran menyokong bukti barang telah dihantar kepada pelanggan.", 1, true], ["AUD018", "Audit", "Prosedur mengesan sampel nota penghantaran kepada invois jualan dan lejar jualan menguji asersi:", "Kelengkapan jualan", "Kewujudan jualan yang direkodkan", "Penilaian inventori", "Hak milik aset tetap", "A", "Kitaran Jualan", "Sederhana", "Memilih dokumen penghantaran dan menjejak ke rekod perakaunan membantu menguji kelengkapan jualan.", 1, true], ["AUD019", "Audit", "Padanan pesanan belian, nota penerimaan barang dan invois pembekal bertujuan memastikan:", "Pembelian direkodkan pada harga pasaran tertinggi", "Pembelian adalah sah, diterima dan direkodkan dengan tepat", "Semua pembekal diberi kontrak", "Pembayaran dibuat tanpa kelulusan", "B", "Kitaran Belian", "Sederhana", "Padanan tiga dokumen menyokong kesahihan dan ketepatan transaksi belian.", 1, true], ["AUD020", "Audit", "Jika barang diterima sebelum akhir tahun tetapi invois pembekal diterima selepas akhir tahun, juruaudit perlu memberi perhatian kepada:", "Pengiktirafan liabiliti dan belian dalam tempoh yang betul", "Pengiraan dividen", "Penilaian jenama", "Pengelasan hasil kewangan", "A", "Kitaran Belian", "Sederhana", "Ujian cut-off memastikan transaksi direkodkan dalam tempoh perakaunan yang betul.", 1, true], ["AUD021", "Audit", "Pemerhatian pengiraan inventori fizikal oleh juruaudit terutamanya memberikan bukti tentang:", "Kewujudan dan keadaan inventori", "Pemilikan undang-undang setiap unit", "Ketepatan harga jualan masa hadapan", "Kebolehkutipan penghutang", "A", "Inventori", "Sederhana", "Pemerhatian kiraan fizikal membantu menilai kewujudan dan keadaan inventori.", 1, true], ["AUD022", "Audit", "Inventori usang yang dikenal pasti semasa pemeriksaan perlu dinilai untuk memastikan:", "Ia dikeluarkan daripada rekod tanpa semakan", "Peruntukan penurunan nilai atau nilai realisasi bersih yang sesuai dibuat", "Ia sentiasa dinilai pada kos asal", "Ia dipindahkan kepada aset tetap", "B", "Inventori", "Sederhana", "Inventori perlu dinilai pada nilai yang lebih rendah antara kos dan nilai realisasi bersih.", 1, true], ["AUD023", "Audit", "Ujian cut-off inventori sekitar tarikh akhir tahun bertujuan memastikan:", "Kuantiti inventori sentiasa meningkat", "Penerimaan dan penghantaran direkodkan dalam tempoh yang betul", "Semua inventori mempunyai kod bar", "Inventori disimpan di satu lokasi", "B", "Inventori", "Sederhana", "Ujian cut-off memastikan transaksi pembelian dan jualan direkodkan dalam tempoh yang tepat.", 1, true], ["AUD024", "Audit", "Apakah tujuan utama juruaudit menyemak rekonsiliasi bank?", "Mengesahkan semua jualan tunai", "Menilai ketepatan baki tunai di bank dan mengenal pasti item rekonsiliasi", "Menentukan nilai pasaran saham", "Mengesahkan bilangan pekerja", "B", "Tunai dan Bank", "Sederhana", "Semakan rekonsiliasi bank membantu mengesahkan baki bank dan menyiasat perbezaan.", 1, true], ["AUD025", "Audit", "Cek belum dikemukakan dalam rekonsiliasi bank merujuk kepada cek yang:", "Telah dikeluarkan dan direkodkan tetapi belum ditunaikan oleh bank", "Diterima tetapi belum direkodkan dalam buku tunai", "Dibatalkan oleh pelanggan", "Dikeluarkan oleh bank tanpa arahan", "A", "Tunai dan Bank", "Sederhana", "Cek belum dikemukakan telah direkodkan oleh entiti tetapi belum diproses oleh bank.", 1, true], ["AUD026", "Audit", "Analisis umur penghutang digunakan oleh juruaudit untuk menilai:", "Kebolehkutipan baki penghutang", "Kadar susut nilai mesin", "Jumlah stok fizikal", "Kesahan kontrak sewa", "A", "Penghutang", "Sederhana", "Umur hutang membantu mengenal pasti baki tertunggak dan risiko hutang lapuk.", 1, true], ["AUD027", "Audit", "Penerimaan wang daripada pelanggan selepas tarikh pelaporan boleh menjadi bukti tentang:", "Kebolehkutipan baki penghutang pada tarikh pelaporan", "Kewujudan aset tetap", "Kelengkapan gaji", "Nilai inventori usang", "A", "Penghutang", "Sederhana", "Penerimaan selepas tarikh pelaporan boleh menyokong kebolehkutipan baki pada tarikh penyata.", 1, true], ["AUD028", "Audit", "Prosedur mencari liabiliti yang tidak direkodkan boleh dilakukan dengan:", "Menyemak pembayaran selepas akhir tahun dan invois berkaitan", "Menyemak iklan syarikat", "Mengira stok alat tulis sahaja", "Menemu bual pelanggan jualan sahaja", "A", "Pemiutang", "Sederhana", "Semakan pembayaran selepas tarikh pelaporan membantu mengenal pasti liabiliti yang tertinggal.", 1, true], ["AUD029", "Audit", "Pemeriksaan dokumen hak milik kenderaan syarikat menyokong asersi:", "Hak dan obligasi", "Kelengkapan hasil", "Ketepatan gaji", "Cut-off inventori", "A", "Aset Tetap", "Sederhana", "Dokumen hak milik membantu menyokong bahawa entiti mempunyai hak terhadap aset.", 1, true], ["AUD030", "Audit", "Pengiraan semula susut nilai oleh juruaudit merupakan prosedur untuk menguji:", "Ketepatan pengiraan dan penilaian aset", "Kewujudan pelanggan", "Kelengkapan jualan tunai", "Pematuhan pekerja kepada jadual", "A", "Aset Tetap", "Sederhana", "Pengiraan semula memberikan bukti tentang ketepatan matematik dan penggunaan dasar susut nilai.", 1, true], ["AUD031", "Audit", "Perbelanjaan pembaikan rutin yang tidak meningkatkan manfaat ekonomi aset lazimnya perlu:", "Dipermodalkan sebagai aset baharu", "Diiktiraf sebagai belanja apabila berlaku", "Direkodkan sebagai hasil tertunda", "Ditambah kepada modal pemilik", "B", "Aset Tetap", "Sederhana", "Pembaikan rutin biasanya merupakan belanja, bukan kos aset yang dipermodalkan.", 1, true], ["AUD032", "Audit", "Apakah prosedur audit yang sesuai untuk menguji kewujudan pekerja dalam senarai gaji?", "Memadankan sampel pekerja dengan fail kakitangan dan bukti pekerjaan", "Menyemak senarai pembekal", "Mengira inventori akhir", "Mengesahkan baki bank pelanggan", "A", "Gaji dan Upah", "Sederhana", "Padanan dengan rekod kakitangan membantu mengesan pekerja fiksyen atau bayaran tidak sah.", 1, true], ["AUD033", "Audit", "Semakan kelulusan perubahan kadar gaji bertujuan menguji:", "Kebenaran transaksi gaji", "Penilaian inventori", "Kelengkapan aset tetap", "Kewujudan jualan kredit", "A", "Gaji dan Upah", "Sederhana", "Perubahan gaji perlu mendapat kelulusan pihak berkuasa yang sesuai.", 1, true], ["AUD034", "Audit", "Surat representasi pengurusan boleh digunakan sebagai:", "Pengganti semua bukti audit lain", "Bukti audit tambahan mengenai perkara yang dinyatakan oleh pengurusan", "Jaminan bahawa tiada penipuan berlaku", "Bukti bahawa semua kawalan berkesan", "B", "Pengesahan dan Representasi", "Sederhana", "Representasi pengurusan melengkapkan bukti lain tetapi tidak menggantikannya.", 1, true], ["AUD035", "Audit", "Jika pengurusan enggan memberikan representasi bertulis yang diperlukan, juruaudit perlu:", "Mengabaikan keengganan tersebut", "Menilai kesannya terhadap pendapat audit dan mempertimbangkan implikasi skop", "Mengubah jawapan pengurusan", "Terus menandatangani laporan tanpa tindakan", "B", "Pengesahan dan Representasi", "Sederhana", "Keengganan memberi representasi wajib boleh menjadi batasan skop yang serius.", 1, true], ["AUD036", "Audit", "Tanggungjawab utama mencegah dan mengesan penipuan dalam entiti terletak pada:", "Juruaudit luar sahaja", "Pengurusan dan pihak yang dipertanggungjawabkan dengan tadbir urus", "Pelanggan syarikat", "Pembekal utama", "B", "Penipuan dan Kesilapan", "Sederhana", "Pengurusan dan tadbir urus bertanggungjawab terhadap pencegahan dan pengesanan penipuan.", 1, true], ["AUD037", "Audit", "Apakah maksud skeptisisme profesional?", "Menerima semua penjelasan pengurusan tanpa soal", "Sikap sentiasa berwaspada dan menilai bukti secara kritikal", "Menganggap semua pekerja melakukan penipuan", "Menolak semua dokumen dalaman", "B", "Penipuan dan Kesilapan", "Sederhana", "Skeptisisme profesional melibatkan minda yang bertanya dan penilaian kritikal terhadap bukti.", 1, true], ["AUD038", "Audit", "Petunjuk risiko penipuan yang ditemui juruaudit perlu:", "Diabaikan jika amaunnya kecil", "Dinilai dan disiasat mengikut keadaan serta kesan berpotensi", "Didedahkan terus kepada media", "Dikeluarkan daripada fail audit", "B", "Penipuan dan Kesilapan", "Sederhana", "Petunjuk penipuan perlu dinilai dan tindakan audit yang sesuai diambil.", 1, true], ["AUD039", "Audit", "Perbandingan nisbah margin kasar tahun semasa dengan tahun lalu merupakan contoh:", "Prosedur analitikal", "Pengesahan luaran", "Pemeriksaan fizikal", "Pengesahan hak milik", "A", "Prosedur Analitikal", "Sederhana", "Prosedur analitikal menilai hubungan munasabah antara data kewangan dan bukan kewangan.", 1, true], ["AUD040", "Audit", "Penurunan mendadak margin kasar tanpa perubahan harga atau kos yang munasabah mungkin menunjukkan:", "Risiko salah nyata dalam jualan atau kos jualan", "Semua transaksi telah direkodkan tepat", "Tiada risiko audit", "Aset tetap telah dinilai semula", "A", "Prosedur Analitikal", "Sederhana", "Perubahan tidak dijangka memerlukan siasatan dan bukti sokongan.", 1, true], ["AUD041", "Audit", "Apakah tujuan pensampelan audit?", "Menguji setiap transaksi tanpa pengecualian", "Membuat kesimpulan tentang populasi berdasarkan pemeriksaan sebahagian item", "Menghapuskan risiko audit sepenuhnya", "Menggantikan pertimbangan profesional", "B", "Pensampelan Audit", "Sederhana", "Pensampelan membolehkan juruaudit membuat kesimpulan populasi daripada sampel yang sesuai.", 1, true], ["AUD042", "Audit", "Risiko pensampelan berlaku apabila:", "Kesimpulan berdasarkan sampel berbeza daripada kesimpulan jika seluruh populasi diuji", "Dokumen audit hilang", "Pengurusan lewat memberi maklum balas", "Juruaudit menggunakan komputer", "A", "Pensampelan Audit", "Sederhana", "Risiko pensampelan ialah kemungkinan sampel tidak mewakili populasi untuk tujuan kesimpulan audit.", 1, true], ["AUD043", "Audit", "Apakah tujuan utama dokumentasi audit?", "Menggantikan penyata kewangan", "Merekod prosedur, bukti yang diperoleh dan kesimpulan juruaudit", "Menyediakan iklan syarikat", "Menyimpan semua dokumen operasi klien tanpa pemilihan", "B", "Dokumentasi Audit", "Sederhana", "Dokumentasi menyokong kesimpulan audit dan menunjukkan kerja dilaksanakan mengikut piawaian.", 1, true], ["AUD044", "Audit", "Fail audit biasanya perlu menunjukkan siapa yang melaksanakan kerja dan tarikh kerja disiapkan untuk:", "Membolehkan akauntabiliti dan semakan kerja audit", "Menentukan bonus pengarah", "Mengira cukai jualan", "Menggantikan surat pelantikan", "A", "Dokumentasi Audit", "Sederhana", "Maklumat pelaksana dan tarikh membantu penyeliaan, semakan dan akauntabiliti.", 1, true], ["AUD045", "Audit", "Pendapat tanpa pengubahsuaian diberikan apabila juruaudit menyimpulkan bahawa penyata kewangan:", "Bebas daripada semua kesilapan kecil", "Disediakan, dalam semua aspek material, mengikut rangka kerja pelaporan kewangan yang terpakai", "Menjamin syarikat akan untung", "Tidak memerlukan sebarang pertimbangan", "B", "Laporan Audit", "Sederhana", "Pendapat tanpa pengubahsuaian menyatakan penyata kewangan dibentangkan secara saksama dalam semua aspek material mengikut rangka kerja.", 1, true], ["AUD046", "Audit", "Pendapat wajar dengan pengecualian boleh diberikan apabila salah nyata adalah material tetapi:", "Merebak ke seluruh penyata kewangan", "Tidak merebak atau pervasive kepada penyata kewangan", "Tidak dapat dikesan langsung", "Disebabkan oleh perubahan pengarah", "B", "Laporan Audit", "Sederhana", "Pendapat wajar dengan pengecualian sesuai bagi salah nyata material tetapi tidak pervasive, atau batasan skop dengan kesan berpotensi yang serupa.", 1, true], ["AUD047", "Audit", "Pendapat bertentangan lazimnya diberikan apabila salah nyata yang dikenal pasti adalah:", "Tidak material", "Material dan pervasive", "Hanya berkaitan satu kesilapan kecil", "Telah dibetulkan sepenuhnya", "B", "Laporan Audit", "Sederhana", "Pendapat bertentangan digunakan apabila salah nyata material dan pervasive.", 1, true], ["AUD048", "Audit", "Penafian pendapat mungkin diperlukan apabila juruaudit:", "Tidak dapat memperoleh bukti audit mencukupi dan sesuai dan kemungkinan kesannya material serta pervasive", "Menemui satu kesilapan kecil yang telah dibetulkan", "Mempunyai bukti mencukupi bahawa penyata adalah saksama", "Tidak bersetuju dengan warna logo syarikat", "A", "Laporan Audit", "Sederhana", "Batasan skop yang material dan pervasive boleh menyebabkan juruaudit tidak dapat memberi pendapat.", 1, true], ["AUD049", "Audit", "Ancaman kepentingan diri terhadap kebebasan juruaudit boleh berlaku apabila:", "Juruaudit mempunyai kepentingan kewangan dalam klien audit", "Juruaudit menyemak dokumen sokongan", "Juruaudit menghadiri mesyuarat pasukan audit", "Juruaudit menyediakan indeks fail audit", "A", "Etika dan Kebebasan", "Sederhana", "Kepentingan kewangan boleh menjejaskan objektiviti dan kebebasan juruaudit.", 1, true], ["AUD050", "Audit", "Mengapa juruaudit perlu bebas daripada klien?", "Supaya boleh membuat pertimbangan dan pendapat secara objektif", "Supaya boleh mengurus operasi klien", "Supaya boleh menentukan harga produk klien", "Supaya tidak perlu mematuhi piawaian audit", "A", "Etika dan Kebebasan", "Sederhana", "Kebebasan menyokong objektiviti dan kredibiliti pendapat audit.", 1, true]];
}
function seedAuditQuestions() {
  const sh=getDb_().getSheetByName(CONFIG.QUESTION_SHEET);
  const existing=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,1).getValues().flat().map(String):[];
  const rows=getAuditQuestionBank_().filter(r=>existing.indexOf(String(r[0]))<0);
  if(rows.length) sh.getRange(sh.getLastRow()+1,1,rows.length,rows[0].length).setValues(rows);
  return {added:rows.length,total:sh.getLastRow()-1};
}

function getDb_() {
  const id = PropertiesService.getScriptProperties().getProperty('ACCOQUEST_DB_ID');
  if (!id) throw new Error('Database belum disediakan. Jalankan setupDatabase() dahulu.');
  return SpreadsheetApp.openById(id);
}
function ensureSheet_(ss, name, headers) {
  let sh=ss.getSheetByName(name);
  if(!sh) sh=ss.insertSheet(name);
  if(sh.getLastRow()===0) sh.getRange(1,1,1,headers.length).setValues([headers]);
  return sh;
}
function getLobbyRow_(sheet, lobbyId) {
  const last=sheet.getLastRow();
  if(last<2)return -1;
  const found=sheet.getRange(2,1,last-1,1).createTextFinder(String(lobbyId)).matchEntireCell(true).findNext();
  return found ? found.getRow() : -1;
}
function readLobby_(lobbyId) {
  const sh=getDb_().getSheetByName(CONFIG.LOBBY_SHEET);
  const row=getLobbyRow_(sh,lobbyId);
  if(row<0)throw new Error('Lobby tidak dijumpai.');
  return JSON.parse(sh.getRange(row,2).getValue());
}
function writeLobby_(lobby) {
  const sh=getDb_().getSheetByName(CONFIG.LOBBY_SHEET);
  const row=getLobbyRow_(sh,lobby.lobbyId);
  const values=[[lobby.lobbyId,JSON.stringify(lobby),new Date()]];
  if(row<0)sh.appendRow(values[0]);else sh.getRange(row,1,1,3).setValues(values);
  syncPlayerAndScoreSheets_(lobby);
}
function syncPlayerAndScoreSheets_(lobby) {
  const ss=getDb_(), ps=ss.getSheetByName('Players'), sc=ss.getSheetByName('Scores');
  if(!ps||!sc)return;
  removeLobbyRows_(ps,lobby.lobbyId); removeLobbyRows_(sc,lobby.lobbyId);
  Object.keys(lobby.players||{}).forEach(pid=>{const p=lobby.players[pid];ps.appendRow([lobby.lobbyId,pid,p.name,!!p.ready,new Date(p.joinedAt||Date.now()),pid===lobby.hostId]);});
  if(lobby.game&&lobby.game.scores)Object.keys(lobby.game.scores).forEach(pid=>{const s=lobby.game.scores[pid];sc.appendRow([lobby.lobbyId,pid,s.name,s.points,s.correct,s.wrong,new Date()]);});
}
function removeLobbyRows_(sheet,lobbyId) {
  const last=sheet.getLastRow();if(last<2)return;
  const vals=sheet.getRange(2,1,last-1,1).getValues();
  for(let i=vals.length-1;i>=0;i--)if(String(vals[i][0])===String(lobbyId))sheet.deleteRow(i+2);
}
function withLock_(fn) {
  const lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try{return fn();}finally{lock.releaseLock();}
}
function cleanName_(name) {
  return String(name||'').replace(/[<>]/g,'').trim().slice(0,18);
}
function validatePlayer_(lobby, playerId) {
  if(!lobby.players || !lobby.players[playerId])throw new Error('Anda bukan ahli lobby ini.');
}
function validateTurn_(lobby, playerId) {
  validatePlayer_(lobby,playerId);
  if(!lobby.game || lobby.game.currentPlayerId!==playerId)throw new Error('Bukan giliran anda.');
}
function publicState_(lobby, playerId) {
  const game=lobby.game || null;
  let scores=[];
  if(game && game.scores) {
    scores=Object.keys(game.scores).map(id=>({playerId:id,name:game.scores[id].name,points:game.scores[id].points,correct:game.scores[id].correct,wrong:game.scores[id].wrong}))
      .sort((a,b)=>b.points-a.points);
  }
  return {
    lobbyId:lobby.lobbyId,hostId:lobby.hostId,status:lobby.status,
    players:Object.keys(lobby.players||{}).map(id=>({playerId:id,name:lobby.players[id].name,ready:lobby.players[id].ready,host:id===lobby.hostId})),
    me: lobby.players[playerId] ? {name:lobby.players[playerId].name,ready:lobby.players[playerId].ready} : null,
    game: game ? {
      round:game.round,totalRounds:game.totalRounds,phase:game.phase,
      currentPlayerId:game.currentPlayerId,currentPlayerName:game.scores[game.currentPlayerId] ? game.scores[game.currentPlayerId].name : '',
      isMyTurn:game.currentPlayerId===playerId,
      usedBlocks:game.usedBlocks||[],scores:scores,
      lastResult:game.lastResult||null,
      selectedBlock:game.selectedBlock||null
    } : null
  };
}

function createLobby(payload) {
  return withLock_(function(){
    const playerId=String(payload.playerId||'');
    const name=cleanName_(payload.name);
    if(!playerId || name.length<2)throw new Error('Username mesti sekurang-kurangnya 2 aksara.');
    const sh=getDb_().getSheetByName(CONFIG.LOBBY_SHEET);
    let lobbyId;
    do { lobbyId=String(Math.floor(100000+Math.random()*900000)); } while(getLobbyRow_(sh,lobbyId)>0);
    const lobby={lobbyId:lobbyId,hostId:playerId,status:'waiting',createdAt:Date.now(),
      players:{},game:null};
    lobby.players[playerId]={name:name,ready:false,joinedAt:Date.now()};
    writeLobby_(lobby);
    return publicState_(lobby,playerId);
  });
}
function joinLobby(payload) {
  return withLock_(function(){
    const id=String(payload.lobbyId||'').trim(),playerId=String(payload.playerId||''),name=cleanName_(payload.name);
    if(!/^\d{6}$/.test(id))throw new Error('Kod lobby mesti tepat 6 digit.');
    if(!playerId||name.length<2)throw new Error('Username mesti sekurang-kurangnya 2 aksara.');
    const lobby=readLobby_(id);
    if(lobby.status!=='waiting')throw new Error('Permainan telah bermula.');
    const ids=Object.keys(lobby.players);
    if(!lobby.players[playerId] && ids.length>=CONFIG.MAX_PLAYERS)throw new Error('Lobby sudah penuh (maksimum 4 pemain).');
    ids.forEach(pid=>{if(pid!==playerId && lobby.players[pid].name.toLowerCase()===name.toLowerCase())throw new Error('Username telah digunakan.');});
    lobby.players[playerId]={name:name,ready:false,joinedAt:Date.now()};
    writeLobby_(lobby);
    return publicState_(lobby,playerId);
  });
}
function setReady(payload) {
  return withLock_(function(){
    const lobby=readLobby_(String(payload.lobbyId));
    validatePlayer_(lobby,String(payload.playerId));
    if(lobby.status!=='waiting')throw new Error('Lobby sudah bermula.');
    lobby.players[payload.playerId].ready=!!payload.ready;
    writeLobby_(lobby);
    return publicState_(lobby,payload.playerId);
  });
}
function startGame(payload) {
  return withLock_(function(){
    const lobby=readLobby_(String(payload.lobbyId));
    if(lobby.hostId!==String(payload.playerId))throw new Error('Host sahaja boleh memulakan permainan.');
    const ids=Object.keys(lobby.players);
    if(ids.length<CONFIG.MIN_PLAYERS||ids.length>CONFIG.MAX_PLAYERS||ids.some(id=>!lobby.players[id].ready))throw new Error('Semua pemain mesti READY. Minimum 2 dan maksimum 4 pemain.');
    const order=ids.slice().sort(()=>Math.random()-.5),scores={};
    ids.forEach(id=>scores[id]={name:lobby.players[id].name,points:0,correct:0,wrong:0});
    const rounds=Math.max(1,Math.min(20,Number(payload.totalRounds)||CONFIG.DEFAULT_ROUNDS));
    lobby.status='playing';
    lobby.game={round:1,totalRounds:rounds,order:order,turnIndex:0,currentPlayerId:order[0],phase:'question',
      usedBlocks:[],usedQuestions:[],scores:scores,lastResult:null,selectedBlock:null,answeredQuestionId:null};
    writeLobby_(lobby);
    return publicState_(lobby,payload.playerId);
  });
}
function getGameState(payload) {
  const lobby=readLobby_(String(payload.lobbyId));
  validatePlayer_(lobby,String(payload.playerId));
  return publicState_(lobby,payload.playerId);
}
function getQuestion(payload) {
  return withLock_(function(){
    const lobby=readLobby_(String(payload.lobbyId)),playerId=String(payload.playerId),qid=String(payload.questionId||'').trim().toUpperCase();
    validateTurn_(lobby,playerId);
    if(lobby.game.phase!=='question')throw new Error('Sekarang bukan fasa soalan.');
    if(lobby.game.usedQuestions.indexOf(qid)>=0)throw new Error('Soalan ini telah digunakan dalam permainan.');
    const sh=getDb_().getSheetByName(CONFIG.QUESTION_SHEET),data=sh.getDataRange().getValues();
    let q=null;
    for(let i=1;i<data.length;i++)if(String(data[i][0]).trim().toUpperCase()===qid){
      q={id:String(data[i][0]),category:String(data[i][1]),text:String(data[i][2]),options:[String(data[i][3]),String(data[i][4]),String(data[i][5]),String(data[i][6])],answer:String(data[i][7]).trim().toUpperCase()};break;
    }
    if(!q)throw new Error('Question ID tidak dijumpai.');
    lobby.game.activeQuestionId=q.id;
    writeLobby_(lobby);
    return {id:q.id,category:q.category,text:q.text,options:q.options};
  });
}
function submitAnswer(payload) {
  return withLock_(function() {
    const lobby = readLobby_(String(payload.lobbyId));
    const playerId = String(payload.playerId);
    const qid = String(payload.questionId).trim().toUpperCase();
    const answer = String(payload.answer || '').trim().toUpperCase();

    validateTurn_(lobby, playerId);

    if (
      lobby.game.phase !== 'question' ||
      String(lobby.game.activeQuestionId).trim().toUpperCase() !== qid
    ) {
      throw new Error('Soalan tidak sepadan atau giliran telah berubah.');
    }

    const sh = getDb_().getSheetByName(CONFIG.QUESTION_SHEET);
    const data = sh.getDataRange().getValues();

    let correctAnswer = '';

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim().toUpperCase() === qid) {
        correctAnswer = String(data[i][7]).trim().toUpperCase();
        break;
      }
    }

    if (!correctAnswer) {
      throw new Error('Skema jawapan tidak dijumpai dalam Google Sheets.');
    }

    const correct = answer === correctAnswer;

    if (correct) {
      lobby.game.scores[playerId].correct++;
    } else {
      lobby.game.scores[playerId].wrong++;
    }

    lobby.game.usedQuestions.push(qid);

    lobby.game.lastResult = {
      playerId: playerId,
      correct: correct,
      questionId: qid,
      correctAnswer: correctAnswer
    };

    lobby.game.phase = 'block';
    lobby.game.activeQuestionId = null;

    writeHistory_(lobby, qid, correct, '', 0);
    writeLobby_(lobby);

    return {
      correct: correct,
      correctAnswer: correctAnswer,
      nextPhase: 'block'
    };
  });
}

function chooseBlock(payload) {
  return withLock_(function(){
    const lobby=readLobby_(String(payload.lobbyId)),playerId=String(payload.playerId),block=String(payload.block||'').toUpperCase();
    validateTurn_(lobby,playerId);
    if(lobby.game.phase!=='block')throw new Error('Bukan fasa pemilihan block.');
    if(!/^[A-F]$/.test(block)||lobby.game.usedBlocks.indexOf(block)>=0)throw new Error('Block tidak sah atau sudah dipilih.');
    lobby.game.usedBlocks.push(block);lobby.game.selectedBlock=block;lobby.game.phase='spin';
    writeLobby_(lobby);
    return {ok:true};
  });
}
function spinPoints(payload) {
  return withLock_(function(){
    const lobby=readLobby_(String(payload.lobbyId)),playerId=String(payload.playerId);
    validateTurn_(lobby,playerId);
    if(lobby.game.phase!=='spin')throw new Error('Bukan fasa spin.');
    const pointValues=[5,10,15,20,25,30,50,0,-5,-10];
    const points=pointValues[Math.floor(Math.random()*pointValues.length)];
    lobby.game.scores[playerId].points+=points;
    writeHistory_(lobby,lobby.game.lastResult?lobby.game.lastResult.questionId:'',lobby.game.lastResult?lobby.game.lastResult.correct:false,lobby.game.selectedBlock,points);
    const next=lobby.game.turnIndex+1;
    if(next>=lobby.game.order.length){
      if(lobby.game.round>=lobby.game.totalRounds){lobby.game.phase='finished';lobby.status='finished';}
      else{lobby.game.round++;lobby.game.turnIndex=0;lobby.game.currentPlayerId=lobby.game.order[0];lobby.game.phase='question';lobby.game.usedBlocks=[];}
    } else {
      lobby.game.turnIndex=next;lobby.game.currentPlayerId=lobby.game.order[next];lobby.game.phase='question';
    }
    lobby.game.selectedBlock=null;lobby.game.lastSpin={playerId:playerId,points:points};
    writeLobby_(lobby);
    return {points:points,finished:lobby.status==='finished'};
  });
}
function writeHistory_(lobby,qid,correct,block,points) {
  const sh=getDb_().getSheetByName(CONFIG.HISTORY_SHEET);
  const player=lobby.players[lobby.game.currentPlayerId];
  sh.appendRow([new Date(),lobby.lobbyId,lobby.game.round,lobby.game.currentPlayerId,player?player.name:'',qid,correct,block,points]);
}
function resetGame(payload) {
  return withLock_(function(){
    const lobby=readLobby_(String(payload.lobbyId));
    if(lobby.hostId!==String(payload.playerId))throw new Error('Host sahaja boleh memulakan semula permainan.');
    Object.keys(lobby.players).forEach(id=>lobby.players[id].ready=false);
    lobby.status='waiting';lobby.game=null;
    writeLobby_(lobby);
    return publicState_(lobby,payload.playerId);
  });
}
/**
 * ACCOQUEST API adapter for Cloudflare Pages Functions.
 * ADD this to the existing Code.gs. Do not remove existing game functions.
 * Configure Script Property ACCOQUEST_API_KEY with the same secret as the
 * Cloudflare Pages environment variable ACCOQUEST_API_KEY.
 * Existing doGet(e) can remain as-is; this adapter adds doPost(e).
 */
function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const expected = PropertiesService.getScriptProperties().getProperty('ACCOQUEST_API_KEY');
    if (!expected || payload.apiKey !== expected) {
      return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Unauthorized API request.'}))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const data = payload.data || {};
    let result;
    switch (payload.action) {
      case 'createLobby': result = createLobby(data); break;
      case 'joinLobby': result = joinLobby(data); break;
      case 'getGameState': result = getGameState(data); break;
      case 'setReady': result = setReady(data); break;
      case 'startGame': result = startGame(data); break;
      case 'getQuestion': result = getQuestion(data); break;
      case 'submitAnswer': result = submitAnswer(data); break;
      case 'chooseBlock': result = chooseBlock(data); break;
      case 'spinPoints': result = spinPoints(data); break;
      case 'resetGame': result = resetGame(data); break;
      default: throw new Error('Unknown API action: ' + payload.action);
    }
    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      data: result,
      apiVersion: "ACCOQUEST-FIX-131126"
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ok:false,error:err.message || String(err)}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
