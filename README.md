# Chasify (Tahap 1 + sebagian Tahap 2)

Aplikasi keuangan pribadi: HTML, CSS, JavaScript ES Modules, tanpa backend.

## Menjalankan
- Cara termudah: klik dua kali `index.html` (memakai `js/app.bundle.js`).
- Disarankan: server lokal, `python3 -m http.server 8080` lalu buka http://localhost:8080 (memakai modul ES langsung).
- Setelah mengubah kode di `js/`, jalankan `./build.sh` (butuh Node.js) agar `app.bundle.js` ikut diperbarui.
- Fitur kriptografi (hash kata sandi) membutuhkan `localhost`, `file://`, atau HTTPS; alamat IP biasa (http://192.168.x.x) tidak didukung browser.

Dependensi CDN: Lucide Icons dan Google Fonts. Tanpa internet, ikon tidak tampil dan font beralih ke font sistem.

## Sudah ada
Tema (8 warna + Terang/Gelap/Sistem), akun lokal (PBKDF2-SHA256), IndexedDB, dashboard dengan angka nyata, transaksi (tambah/ubah/hapus, cari, filter jenis, muat bertahap), kategori (CRUD, penghapusan diblokir jika masih dipakai), dompet (CRUD, saldo awal, transfer).

## Aturan akuntansi
Saldo dompet = saldo awal + pemasukan − pengeluaran − transfer keluar + transfer masuk. Saldo bersih = jumlah saldo semua dompet. Transfer tidak dihitung sebagai pemasukan/pengeluaran. Nominal disimpan sebagai integer rupiah.

## Belum ada
Anggaran, target tabungan, filter tanggal/kategori/urutan (Tahap 2); grafik, kalender, pengingat, utang, laporan, backup (Tahap 3); PWA dan pengujian di perangkat nyata (Tahap 4).

## Keterbatasan penyimpanan lokal
Akun lokal bukan autentikasi terpusat; tidak ada sinkronisasi atau pemulihan lewat email. Sesi di localStorage tidak kebal manipulasi di perangkat yang sama. Menghapus data situs menghapus semua data; backup JSON hadir di Tahap 3.


## Penyimpanan di Vercel / browser lain
Data utama di IndexedDB, sesi dan tema di localStorage, lewat `js/database/storage.js`. Aplikasi meminta status *persistent storage* (`navigator.storage.persist()`) agar browser tidak menghapus data otomatis, koneksi IndexedDB dibuka ulang otomatis bila tertutup (Safari), dan simpan baru dianggap berhasil setelah transaksi commit. Data terikat ke domain: gunakan satu domain produksi yang sama (bukan URL preview per-deploy), dan buka lewat HTTPS yang sama setiap kali.
