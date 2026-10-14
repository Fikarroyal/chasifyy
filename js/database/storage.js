/* Lapisan penyimpanan aman untuk Chasify.
   1) store: pembungkus localStorage yang tidak pernah melempar error (Safari mode privat / kuota penuh / diblokir).
      Jika localStorage tidak bisa dipakai, nilai disimpan di memori supaya aplikasi tetap jalan selama tab terbuka.
   2) requestPersist: meminta browser menandai data situs sebagai "persistent" agar tidak dibersihkan otomatis
      saat penyimpanan menipis (Chrome/Edge/Firefox/Safari 17+). */
const mem = new Map();
let lsOk = null;

function probe() {
  if (lsOk !== null) return lsOk;
  try {
    const k = '__chasify_probe__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    lsOk = true;
  } catch {
    lsOk = false;
  }
  return lsOk;
}

export const store = {
  get(k) {
    if (probe()) {
      try { return localStorage.getItem(k); } catch { lsOk = false; }
    }
    return mem.has(k) ? mem.get(k) : null;
  },
  set(k, v) {
    v = String(v);
    if (probe()) {
      try { localStorage.setItem(k, v); return true; } catch { lsOk = false; }
    }
    mem.set(k, v);
    return false;
  },
  remove(k) {
    mem.delete(k);
    try { localStorage.removeItem(k); } catch { /* diabaikan */ }
  },
  /* true bila localStorage benar-benar tersimpan permanen di browser ini */
  get durable() { return probe(); }
};

let persisted = false;

/* Minta penyimpanan persisten. Aman dipanggil berulang kali: setelah berhasil tidak diulang,
   jika ditolak akan dicoba lagi pada pemanggilan berikutnya (mis. setelah pengguna berinteraksi). */
export async function requestPersist() {
  if (persisted) return true;
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return (persisted = true);
    return (persisted = await navigator.storage.persist());
  } catch {
    return false;
  }
}

/* Info ringkas untuk ditampilkan di UI bila dibutuhkan */
export async function storageInfo() {
  const info = { persisted: false, usage: null, quota: null };
  try {
    if (navigator.storage?.persisted) info.persisted = await navigator.storage.persisted();
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      info.usage = e.usage ?? null;
      info.quota = e.quota ?? null;
    }
  } catch { /* diabaikan */ }
  return info;
}

/* Otomatis: coba saat aplikasi dimuat, lalu coba lagi pada interaksi pertama pengguna
   (beberapa browser hanya menyetujui setelah ada interaksi / keterlibatan pengguna). */
if (typeof window !== 'undefined') {
  requestPersist();
  const again = () => { requestPersist(); };
  addEventListener('pointerdown', again, { once: true, passive: true });
  addEventListener('keydown', again, { once: true });
  /* Setiap kali tab kembali aktif, pastikan status persisten tetap dicoba */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') requestPersist();
  });
}
