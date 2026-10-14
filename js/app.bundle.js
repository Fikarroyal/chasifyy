(() => {
  // js/database/storage.js
  var mem = /* @__PURE__ */ new Map();
  var lsOk = null;
  function probe() {
    if (lsOk !== null) return lsOk;
    try {
      const k = "__chasify_probe__";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      lsOk = true;
    } catch {
      lsOk = false;
    }
    return lsOk;
  }
  var store = {
    get(k) {
      if (probe()) {
        try {
          return localStorage.getItem(k);
        } catch {
          lsOk = false;
        }
      }
      return mem.has(k) ? mem.get(k) : null;
    },
    set(k, v) {
      v = String(v);
      if (probe()) {
        try {
          localStorage.setItem(k, v);
          return true;
        } catch {
          lsOk = false;
        }
      }
      mem.set(k, v);
      return false;
    },
    remove(k) {
      mem.delete(k);
      try {
        localStorage.removeItem(k);
      } catch {
      }
    },
    /* true bila localStorage benar-benar tersimpan permanen di browser ini */
    get durable() {
      return probe();
    }
  };
  var persisted = false;
  async function requestPersist() {
    if (persisted) return true;
    try {
      if (!navigator.storage?.persist) return false;
      if (await navigator.storage.persisted()) return persisted = true;
      return persisted = await navigator.storage.persist();
    } catch {
      return false;
    }
  }
  if (typeof window !== "undefined") {
    requestPersist();
    const again = () => {
      requestPersist();
    };
    addEventListener("pointerdown", again, { once: true, passive: true });
    addEventListener("keydown", again, { once: true });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") requestPersist();
    });
  }

  // js/utils/theme.js
  var THEMES = [["ocean", "Ocean Blue", "#2563EB"], ["emerald", "Emerald Green", "#059669"], ["purple", "Royal Purple", "#7C3AED"], ["softpink", "Soft Pink", "#F9A8D4"], ["pink", "Pink", "#DB2777"], ["sunset", "Sunset Orange", "#C2410C"], ["navy", "Midnight Navy", "#1E3A8A"], ["teal", "Teal Fresh", "#0F766E"], ["gray", "Minimal Gray", "#334155"]];
  var KEY = "chasify.prefs";
  var DEF = { theme: "ocean", mode: "system", collapsed: false };
  var getPrefs = () => {
    try {
      const p = { ...DEF, ...JSON.parse(store.get(KEY) || "{}") };
      if (p.theme === "rose") p.theme = "pink";
      return p;
    } catch {
      return { ...DEF };
    }
  };
  var savePrefs = (p) => {
    try {
      store.set(KEY, JSON.stringify({ ...getPrefs(), ...p }));
    } catch {
    }
  };
  var mq = matchMedia("(prefers-color-scheme: dark)");
  function apply({ theme, mode }) {
    const r = document.documentElement;
    r.dataset.theme = theme;
    r.dataset.scheme = mode === "system" ? mq.matches ? "dark" : "light" : mode;
  }
  function initTheme() {
    apply(getPrefs());
    mq.addEventListener("change", () => apply(getPrefs()));
  }

  // js/database/db.js
  var NAME = "chasify";
  var VERSION = 1;
  var USER_STORES = ["transactions", "categories", "budgets", "savingsGoals", "savingsContributions", "wallets", "transfers", "recurring", "reminders", "debts", "debtPayments", "preferences"];
  var dbp;
  var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  var open1 = () => new Promise((res, rej) => {
    const r = indexedDB.open(NAME, VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      const u = db.createObjectStore("users", { keyPath: "id" });
      u.createIndex("username", "username", { unique: true });
      u.createIndex("email", "email", { unique: true });
      for (const s of USER_STORES) db.createObjectStore(s, { keyPath: "id" }).createIndex("userId", "userId");
    };
    r.onsuccess = () => {
      const db = r.result;
      db.onversionchange = () => {
        db.close();
        dbp = null;
      };
      db.onclose = () => {
        dbp = null;
      };
      res(db);
    };
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error("IndexedDB diblokir"));
  });
  function openDB() {
    return dbp ??= (async () => {
      if (!globalThis.indexedDB) throw new Error("IndexedDB tidak tersedia");
      let err;
      for (let i = 0; i < 4; i++) {
        try {
          return await open1();
        } catch (e) {
          err = e;
          await sleep(150 * (i + 1));
        }
      }
      throw err;
    })().catch((e) => {
      dbp = null;
      throw e;
    });
  }
  async function transact(names, mode = "readonly") {
    for (let i = 0; ; i++) {
      const db = await openDB();
      try {
        return db.transaction(names, mode, mode === "readwrite" ? { durability: "strict" } : void 0);
      } catch (e) {
        if (i >= 1 || e.name !== "InvalidStateError") throw e;
        dbp = null;
      }
    }
  }
  var wrap = (r) => new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  var st = async (n, m = "readonly") => (await transact(n, m)).objectStore(n);
  async function write(n, fn) {
    const tx = await transact(n, "readwrite");
    return new Promise((res, rej) => {
      let out;
      tx.oncomplete = () => res(out);
      tx.onerror = (e) => rej(e.target?.error || tx.error);
      tx.onabort = () => rej(tx.error || new Error("Transaksi dibatalkan"));
      const q = fn(tx.objectStore(n));
      q.onsuccess = () => {
        out = q.result;
      };
    });
  }
  var put = (n, v) => write(n, (s) => s.put(v));
  var get = async (n, id2) => wrap((await st(n)).get(id2));
  var remove = (n, id2) => write(n, (s) => s.delete(id2));
  var listByUser = async (n, uid) => wrap((await st(n)).index("userId").getAll(uid));
  var byIndex = async (n, idx, key) => wrap((await st(n)).index(idx).get(key));
  async function deleteUserData(uid) {
    const tx = await transact([...USER_STORES, "users"], "readwrite");
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = tx.onabort = () => rej(tx.error);
      tx.objectStore("users").delete(uid);
      for (const s of USER_STORES) tx.objectStore(s).index("userId").openKeyCursor(IDBKeyRange.only(uid)).onsuccess = (e) => {
        const c = e.target.result;
        if (c) {
          tx.objectStore(s).delete(c.primaryKey);
          c.continue();
        }
      };
    });
  }
  async function removeAll(pairs) {
    if (!pairs.length) return;
    const tx = await transact([...new Set(pairs.map((p) => p[0]))], "readwrite");
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = tx.onabort = () => rej(tx.error);
      for (const [s, i] of pairs) tx.objectStore(s).delete(i);
    });
  }
  var all = async (n) => wrap((await st(n)).getAll());
  async function batch(ops) {
    const names = [...new Set(ops.map((o) => o[1]))];
    if (!names.length) return;
    const tx = await transact(names, "readwrite");
    return new Promise((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = tx.onabort = () => rej(tx.error);
      for (const [k, s, v] of ops) {
        const o = tx.objectStore(s);
        k === "put" ? o.put(v) : o.delete(v);
      }
    });
  }
  var putAll = (pairs) => batch(pairs.map(([s, o]) => ["put", s, o]));

  // js/auth/crypto.js
  var ITER = 21e4;
  var enc = new TextEncoder();
  var b64 = (b) => btoa(String.fromCharCode(...new Uint8Array(b)));
  var unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function derive(pw, salt, iterations) {
    if (!globalThis.crypto?.subtle) throw new Error("insecure");
    const k = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
    return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, k, 256);
  }
  async function hashPassword(pw) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return { salt: b64(salt), iter: ITER, hash: b64(await derive(pw, salt, ITER)) };
  }
  async function verifyPassword(pw, { salt, iter, hash }) {
    const h = new Uint8Array(await derive(pw, unb64(salt), iter)), e = unb64(hash);
    let d = h.length ^ e.length;
    for (let i = 0; i < h.length; i++) d |= h[i] ^ (e[i] ?? 0);
    return d === 0;
  }

  // js/auth/auth.js
  var SKEY = "chasify.session";
  var TTL = 30 * 864e5;
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var pwOk = (p) => typeof p === "string" && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p);
  function validateRegister(f) {
    const e = {};
    if (!f.name?.trim()) e.name = "Nama lengkap wajib diisi.";
    if (!/^[a-z0-9_.]{3,20}$/i.test(f.username?.trim() || "")) e.username = "Username 3 sampai 20 karakter: huruf, angka, titik, atau garis bawah.";
    if (!EMAIL.test(f.email?.trim() || "")) e.email = "Format email tidak valid.";
    if (!pwOk(f.password)) e.password = "Minimal 8 karakter, mengandung huruf dan angka.";
    if (f.password !== f.confirm) e.confirm = "Konfirmasi kata sandi tidak cocok.";
    if (!f.terms) e.terms = "Persetujuan privasi diperlukan.";
    return e;
  }
  var startSession = (uid) => {
    store.set(SKEY, JSON.stringify({ uid, exp: Date.now() + TTL }));
    requestPersist();
  };
  var logout = () => store.remove(SKEY);
  async function register(f) {
    let errors = validateRegister(f);
    if (Object.keys(errors).length) throw { errors };
    const username = f.username.trim().toLowerCase(), email = f.email.trim().toLowerCase();
    errors = {};
    if (await byIndex("users", "username", username)) errors.username = "Username sudah digunakan.";
    if (await byIndex("users", "email", email)) errors.email = "Email sudah terdaftar.";
    if (Object.keys(errors).length) throw { errors };
    const user = { id: crypto.randomUUID(), name: f.name.trim(), username, email, pw: await hashPassword(f.password), createdAt: Date.now() };
    try {
      await put("users", user);
    } catch {
      throw { errors: { username: "Username atau email sudah terdaftar." } };
    }
    startSession(user.id);
    return user;
  }
  async function login(identity, password) {
    const id2 = (identity || "").trim().toLowerCase(), errors = {};
    if (!id2) errors.identity = "Wajib diisi.";
    if (!password) errors.password = "Wajib diisi.";
    if (Object.keys(errors).length) throw { errors };
    const u = await byIndex("users", id2.includes("@") ? "email" : "username", id2);
    if (!u || !await verifyPassword(password, u.pw)) throw { errors: { password: "Username/email atau kata sandi salah." } };
    startSession(u.id);
    return u;
  }
  async function currentUser() {
    let s;
    try {
      s = JSON.parse(store.get(SKEY));
    } catch {
    }
    if (!s || s.exp < Date.now()) {
      logout();
      return null;
    }
    const u = await get("users", s.uid);
    if (!u) logout();
    else if (s.exp - Date.now() < TTL / 2) startSession(s.uid);
    return u || null;
  }
  async function deleteAccount(uid) {
    await deleteUserData(uid);
    logout();
  }

  // js/components/ui.js
  function toast(msg, type = "info") {
    const t = document.createElement("div");
    t.className = "toast " + type;
    t.textContent = msg;
    document.getElementById("toasts").append(t);
    setTimeout(() => t.remove(), 4e3);
  }
  function confirmDialog({ title, body, confirmText = "Hapus", danger = true }) {
    return new Promise((res) => {
      const prev = document.activeElement, d = document.createElement("dialog");
      d.className = "sheet";
      d.setAttribute("aria-labelledby", "dlg-t");
      d.innerHTML = `<form method="dialog"><h2 id="dlg-t">${title}</h2><p>${body}</p><div class="row"><button class="btn ghost" value="no">Batal</button><button class="btn ${danger ? "danger" : "primary"}" value="yes">${confirmText}</button></div></form>`;
      d.addEventListener("click", (e) => {
        if (e.target === d) d.close("no");
      });
      d.addEventListener("close", () => {
        res(d.returnValue === "yes");
        d.remove();
        prev?.focus?.();
      });
      document.body.append(d);
      d.showModal();
    });
  }
  var esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function formSheet({ title, fields, submitText = "Simpan", onSubmit }) {
    return new Promise((res) => {
      const prev = document.activeElement, d = document.createElement("dialog");
      d.className = "sheet";
      d.setAttribute("aria-labelledby", "dlg-t");
      const fld = (x) => {
        const i = "f-" + x.id, v = x.value ?? "";
        const inp = x.options ? `<select id="${i}" name="${x.id}">${x.options.map(([o, l]) => `<option value="${esc(o)}" ${o === v ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>` : `<input id="${i}" name="${x.id}" type="${x.type || "text"}" value="${esc(v)}" ${x.money ? 'inputmode="numeric" data-money' : ""} autocomplete="off">`;
        return `<div class="field"><label for="${i}">${x.label}</label>${inp}<p class="err" id="${x.id}-err" role="alert"></p></div>`;
      };
      d.innerHTML = `<form novalidate><h2 id="dlg-t">${title}</h2>${fields.map(fld).join("")}<p class="err" id="_-err" role="alert"></p><div class="row"><button type="button" class="btn ghost" data-x>Batal</button><button type="submit" class="btn primary">${submitText}</button></div></form>`;
      const f = d.firstChild;
      d.querySelectorAll("[data-money]").forEach((i) => i.addEventListener("input", () => {
        const n = i.value.replace(/\D/g, "");
        i.value = n ? new Intl.NumberFormat("id-ID").format(+n) : "";
      }));
      d.querySelector("[data-x]").onclick = () => d.close("no");
      d.addEventListener("click", (e) => {
        if (e.target === d) d.close("no");
      });
      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const b = f.querySelector("[type=submit]");
        b.disabled = true;
        b.classList.add("loading");
        let er;
        try {
          er = await onSubmit(Object.fromEntries(new FormData(f)));
        } catch {
          er = { _: "Penyimpanan gagal. Coba lagi." };
        }
        b.disabled = false;
        b.classList.remove("loading");
        f.querySelectorAll(".err").forEach((p) => p.textContent = "");
        if (er && Object.keys(er).length) {
          for (const [k, m] of Object.entries(er)) {
            const p = f.querySelector("#" + k + "-err");
            if (p) p.textContent = m;
          }
          f.querySelector(".err:not(:empty)")?.previousElementSibling?.focus?.();
        } else d.close("ok");
      });
      d.addEventListener("close", () => {
        res(d.returnValue === "ok");
        d.remove();
        prev?.focus?.();
      });
      document.body.append(d);
      d.showModal();
      f.querySelector("input,select")?.focus();
    });
  }
  function actionSheet({ title, body, actions }) {
    return new Promise((res) => {
      const prev = document.activeElement, d = document.createElement("dialog");
      d.className = "sheet";
      d.setAttribute("aria-labelledby", "dlg-t");
      d.innerHTML = `<form method="dialog"><h2 id="dlg-t">${title}</h2><p>${body}</p><div class="stack">${actions.map(([v, l, c]) => `<button class="btn ${c || ""}" value="${v}">${l}</button>`).join("")}</div></form>`;
      d.addEventListener("click", (e) => {
        if (e.target === d) d.close("");
      });
      d.addEventListener("close", () => {
        res(d.returnValue);
        d.remove();
        prev?.focus?.();
      });
      document.body.append(d);
      d.showModal();
    });
  }

  // js/utils/format.js
  var nf = new Intl.NumberFormat("id-ID");
  var numFmt = (n) => nf.format(n);
  var rupiah = (n) => n < 0 ? "(Rp" + nf.format(Math.abs(n)) + ")" : "Rp" + nf.format(n);
  var parseRupiah = (s) => {
    s = String(s ?? "");
    if (/-/.test(s)) return NaN;
    const d = s.replace(/\D/g, "");
    return d ? parseInt(d, 10) : NaN;
  };
  var todayStr = () => {
    const d = /* @__PURE__ */ new Date();
    return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
  };
  var fmtDate = (s) => (/* @__PURE__ */ new Date(s + "T00:00:00")).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  var validDate = (s) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return false;
    const d = /* @__PURE__ */ new Date(s + "T00:00:00");
    return d.getFullYear() == +s.slice(0, 4) && d.getMonth() + 1 == +s.slice(5, 7) && d.getDate() == +s.slice(8);
  };
  var rupiahC = (n) => {
    const a = Math.abs(n), w = (t) => n < 0 ? "(" + t + ")" : t;
    return a >= 1e12 ? w("Rp" + (a / 1e12).toFixed(2).replace(".", ",") + " T") : a >= 1e9 ? w("Rp" + (a / 1e9).toFixed(2).replace(".", ",") + " M") : rupiah(n);
  };

  // js/components/charts.js
  var short = (n) => n >= 1e9 ? +(n / 1e9).toFixed(1) + " M" : n >= 1e6 ? +(n / 1e6).toFixed(1) + " jt" : n >= 1e3 ? Math.round(n / 1e3) + " rb" : String(Math.round(n));
  var nice = (m) => {
    if (m <= 0) return 1e3;
    const p = 10 ** Math.floor(Math.log10(m)), f = m / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  };
  var legend = (ss) => `<div class="legend">${ss.map((s, i) => `<button type="button" class="lg" data-ser="${i}" aria-pressed="true"><i style="background:${s.color}"></i>${s.name}</button>`).join("")}</div>`;
  var W = 320;
  var H = 170;
  var L = 36;
  var B = 22;
  var T = 8;
  var ph = H - B - T;
  var grid = (mx) => [0, 0.5, 1].map((f) => {
    const y = T + ph * (1 - f);
    return `<line x1="${L}" x2="${W - 4}" y1="${y}" y2="${y}" class="gl"/><text x="${L - 4}" y="${y + 3}" text-anchor="end" class="ax">${short(mx * f)}</text>`;
  }).join("");
  var gid = 0;
  function barChart(items, names = ["Pemasukan", "Pengeluaran"]) {
    const mx = Math.max(...items.flatMap((i) => [i.a, i.b]), 1);
    const rows = items.map((it, i) => {
      const net = it.a - it.b;
      return `<div class="cr"><span class="cl">${it.label}</span><div class="cb"><i class="in s-0" style="--w:${(it.a / mx * 100).toFixed(1)}%;transition-delay:${i * 70}ms" data-tip="${it.label}, ${names[0]}: ${rupiah(it.a)}"></i><i class="out s-1" style="--w:${(it.b / mx * 100).toFixed(1)}%;transition-delay:${i * 70 + 60}ms" data-tip="${it.label}, ${names[1]}: ${rupiah(it.b)}"></i></div><span class="cv ${net < 0 ? "neg" : ""}">${net < 0 ? "(" + short(Math.abs(net)) + ")" : "+" + short(net)}</span></div>`;
    }).join("");
    return `<div class="chart cmp" role="img" aria-label="Perbandingan pemasukan dan pengeluaran per bulan">${rows}${legend([{ name: names[0], color: "var(--c-in)" }, { name: names[1], color: "var(--c-out)" }])}</div>`;
  }
  function lineChart(labels, series) {
    const n = labels.length, pw = W - L - 8, mx = nice(Math.max(...series.flatMap((s) => s.values), 0)), x = (i) => L + (n < 2 ? pw / 2 : pw * i / (n - 1)), y = (v) => T + ph * (1 - v / mx), step = Math.ceil(n / 7), u = "g" + ++gid;
    const defs = series.map((s, k) => `<linearGradient id="${u}${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:${s.color};stop-opacity:.4"/><stop offset="1" style="stop-color:${s.color};stop-opacity:0"/></linearGradient>`).join("");
    const curve = (pts) => pts.map((p, i) => {
      if (!i) return `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
      const q = pts[i - 1], m = ((q[0] + p[0]) / 2).toFixed(1);
      return `C${m} ${q[1].toFixed(1)} ${m} ${p[1].toFixed(1)} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    }).join("");
    const g = series.map((s, k) => {
      const pts = s.values.map((v, i) => [x(i), y(v)]), d = curve(pts), e = pts[n - 1];
      return `<g class="s-${k}"><path class="area" d="${d}L${x(n - 1).toFixed(1)} ${T + ph}L${x(0).toFixed(1)} ${T + ph}Z" fill="url(#${u}${k})"/><path class="ln" pathLength="1" d="${d}" stroke="${s.color}"/><circle class="end" cx="${e[0].toFixed(1)}" cy="${e[1].toFixed(1)}" r="3.6" fill="${s.color}"/>${pts.map((q, i) => `<circle class="pt" cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="8" data-tip="Tgl ${labels[i]}, ${s.name}: ${rupiah(s.values[i])}"/>`).join("")}</g>`;
    }).join("");
    const xs = labels.map((l, i) => i % step === 0 ? `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="ax">${l}</text>` : "").join("");
    return `<div class="chart" role="img" aria-label="Grafik arus kas harian"><svg viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>${grid(mx)}${xs}${g}</svg>${legend(series)}</div>`;
  }
  function donut(items, total) {
    if (!total) return '<p class="sub">Belum ada data.</p>';
    let cum = 0;
    const arcs = items.map((it, i) => {
      const p = it.value / total * 100, a = Math.max(p - 0.8, 0.1), s = `<circle class="arc" cx="21" cy="21" r="15.915" pathLength="100" stroke="${it.color}" transform="rotate(-90 21 21)" style="--da:${a} ${100 - a};stroke-dashoffset:${-cum};transition-delay:${i * 80}ms" data-tip="${esc(it.label)}: ${rupiah(it.value)} (${Math.round(p)}%)"/>`;
      cum += p;
      return s;
    }).join("");
    return `<div class="donut chart"><svg viewBox="0 0 42 42" role="img" aria-label="Pengeluaran per kategori"><circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--border)" stroke-width="5"/>${arcs}<text x="21" y="20" text-anchor="middle" class="ax" style="font-size:3px">Total</text><text x="21" y="24.6" text-anchor="middle" style="font:700 3.6px var(--font);fill:var(--text)">${short(total)}</text></svg><ul class="dl">${items.map((it) => `<li class="dli"><i style="background:${it.color}"></i><span>${esc(it.label)}</span><b>${Math.round(it.value / total * 100)}%</b></li>`).join("")}</ul></div>`;
  }
  var last = "";
  function motion(route) {
    const same = route === last;
    last = route;
    const els = document.querySelectorAll(".chart");
    if (same) els.forEach((e) => e.classList.add("instant", "go"));
    else requestAnimationFrame(() => requestAnimationFrame(() => els.forEach((e) => e.classList.add("go"))));
    if (same || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.querySelectorAll("[data-n]").forEach((el) => {
      const v = +el.dataset.n, t0 = performance.now();
      const f = (t) => {
        const k = Math.min(1, (t - t0) / 800);
        el.textContent = rupiahC(Math.round(v * (1 - (1 - k) ** 3)));
        if (k < 1) requestAnimationFrame(f);
        else el.textContent = rupiahC(v);
      };
      requestAnimationFrame(f);
    });
  }
  function initCharts() {
    const tip = document.createElement("div");
    tip.id = "tip";
    document.body.append(tip);
    const show = (e) => {
      const t = e.target.closest?.("[data-tip]");
      if (!t) {
        tip.style.opacity = 0;
        return;
      }
      tip.textContent = t.dataset.tip;
      tip.style.opacity = 1;
      const w = tip.offsetWidth;
      tip.style.left = Math.min(Math.max(8, e.clientX - w / 2), innerWidth - w - 8) + "px";
      tip.style.top = Math.max(8, e.clientY - 44) + "px";
    };
    document.addEventListener("pointermove", show);
    document.addEventListener("pointerdown", show);
    document.addEventListener("click", (e) => {
      const b = e.target.closest?.(".lg");
      if (!b) return;
      const on = b.getAttribute("aria-pressed") !== "true";
      b.setAttribute("aria-pressed", on);
      b.closest(".chart").querySelectorAll(".s-" + b.dataset.ser).forEach((x) => x.classList.toggle("off", !on));
    });
  }

  // js/modules/finance.js
  var DEFAULT_CATS = [["income", "Gaji", "banknote", "#10B981"], ["income", "Bonus", "gift", "#2563EB"], ["income", "Lainnya", "circle-ellipsis", "#64748B"], ["expense", "Makan & Minum", "utensils", "#EA580C"], ["expense", "Transportasi", "car", "#2563EB"], ["expense", "Belanja", "shopping-bag", "#E11D48"], ["expense", "Tagihan", "receipt", "#7C3AED"], ["expense", "Hiburan", "film", "#0D9488"], ["expense", "Kesehatan", "heart-pulse", "#E11D48"], ["expense", "Lainnya", "circle-ellipsis", "#64748B"]];
  var MAX = 9999999999999;
  var id = () => crypto.randomUUID();
  var bad = (o) => Object.keys(o).length > 0;
  var amt = (v) => {
    const n = parseRupiah(v);
    return !Number.isSafeInteger(n) || n <= 0 ? { err: "Nominal harus lebih dari 0." } : n > MAX ? { err: "Nominal terlalu besar." } : { n };
  };
  var seeding = {};
  var ensureDefaults = (uid) => seeding[uid] ??= (async () => {
    if (await get("preferences", "seed:" + uid)) return;
    const db = await openDB();
    await new Promise((res, rej) => {
      const tx = db.transaction(["categories", "wallets", "preferences"], "readwrite");
      tx.oncomplete = res;
      tx.onerror = tx.onabort = () => rej(tx.error);
      for (const [type, name, icon, color] of DEFAULT_CATS) tx.objectStore("categories").put({ id: id(), userId: uid, type, name, icon, color });
      tx.objectStore("wallets").put({ id: id(), userId: uid, name: "Tunai", kind: "cash", initial: 0, createdAt: Date.now() });
      tx.objectStore("preferences").put({ id: "seed:" + uid, userId: uid });
    });
  })().catch((e) => {
    delete seeding[uid];
    throw e;
  });
  function balances(d) {
    const m = {};
    for (const w of d.wallets) m[w.id] = w.initial;
    for (const t of d.transactions) if (t.walletId in m) m[t.walletId] += t.type === "income" ? t.amount : -t.amount;
    for (const t of d.transfers) {
      if (t.fromId in m) m[t.fromId] -= t.amount;
      if (t.toId in m) m[t.toId] += t.amount;
    }
    for (const c of d.savingsContributions) if (c.walletId in m) m[c.walletId] -= c.amount;
    return m;
  }
  function summary(d, ym) {
    const s = { income: 0, expense: 0, byCat: {} };
    for (const t of d.transactions) {
      if (!t.date.startsWith(ym)) continue;
      s[t.type] += t.amount;
      if (t.type === "expense") s.byCat[t.categoryId] = (s.byCat[t.categoryId] || 0) + t.amount;
    }
    return s;
  }
  var catUse = (d, i) => d.transactions.filter((t) => t.categoryId === i).length;
  var walletUse = (d, i) => d.transactions.filter((t) => t.walletId === i).length + d.transfers.filter((t) => t.fromId === i || t.toId === i).length + d.savingsContributions.filter((c) => c.walletId === i).length;
  async function saveTx(uid, type, v, d, old) {
    const e = {}, a = amt(v.amount);
    if (a.err) e.amount = a.err;
    if (!validDate(v.date)) e.date = "Tanggal tidak valid.";
    if (!d.categories.some((c) => c.id === v.categoryId && c.type === type)) e.categoryId = "Pilih kategori.";
    if (!d.wallets.some((w) => w.id === v.walletId)) e.walletId = "Pilih dompet.";
    if (bad(e)) return e;
    await put("transactions", { id: old?.id || id(), userId: uid, type, amount: a.n, categoryId: v.categoryId, walletId: v.walletId, date: v.date, note: (v.note || "").trim().slice(0, 200), createdAt: old?.createdAt || Date.now(), updatedAt: Date.now() });
  }
  async function saveWallet(uid, v, old) {
    const e = {}, name = (v.name || "").trim(), raw = (v.initial || "").trim(), init = raw === "" ? 0 : parseRupiah(raw);
    if (!name || name.length > 30) e.name = "Nama 1 sampai 30 karakter.";
    if (!Number.isSafeInteger(init) || init < 0 || init > MAX) e.initial = "Saldo awal tidak valid.";
    if (bad(e)) return e;
    await put("wallets", { id: old?.id || id(), userId: uid, name, kind: v.kind, initial: init, createdAt: old?.createdAt || Date.now() });
  }
  async function saveTransfer(uid, v, d) {
    const e = {}, a = amt(v.amount), ws = d.wallets.map((w) => w.id);
    if (!ws.includes(v.fromId)) e.fromId = "Pilih dompet asal.";
    if (!ws.includes(v.toId)) e.toId = "Pilih dompet tujuan.";
    if (!e.fromId && !e.toId && v.fromId === v.toId) e.toId = "Dompet tujuan harus berbeda.";
    if (a.err) e.amount = a.err;
    if (!validDate(v.date)) e.date = "Tanggal tidak valid.";
    if (bad(e)) return e;
    await put("transfers", { id: id(), userId: uid, fromId: v.fromId, toId: v.toId, amount: a.n, date: v.date, note: (v.note || "").trim().slice(0, 200), createdAt: Date.now() });
  }
  async function saveCategory(uid, type, v, d, old) {
    const e = {}, name = (v.name || "").trim();
    if (!name || name.length > 30) e.name = "Nama 1 sampai 30 karakter.";
    else if (d.categories.some((c) => c.type === type && c.id !== old?.id && c.name.toLowerCase() === name.toLowerCase())) e.name = "Nama kategori sudah ada.";
    if (bad(e)) return e;
    await put("categories", { id: old?.id || id(), userId: uid, type, name, icon: v.icon, color: v.color });
  }
  var spent = (d, ym, cid) => d.transactions.reduce((a, t) => a + (t.type === "expense" && t.categoryId === cid && t.date.startsWith(ym) ? t.amount : 0), 0);
  var collected = (d, gid2) => d.savingsContributions.reduce((a, c) => a + (c.goalId === gid2 ? c.amount : 0), 0);
  var goalStatus = (g, col, today) => col >= g.target ? "done" : g.deadline && g.deadline < today ? "late" : "active";
  async function saveBudget(uid, v, d, ym, old) {
    const e = {}, a = amt(v.limit);
    if (a.err) e.limit = a.err;
    if (!d.categories.some((c) => c.id === v.categoryId && c.type === "expense")) e.categoryId = "Pilih kategori.";
    else if (d.budgets.some((b) => b.month === ym && b.categoryId === v.categoryId && b.id !== old?.id)) e.categoryId = "Anggaran kategori ini sudah ada.";
    if (bad(e)) return e;
    await put("budgets", { id: old?.id || id(), userId: uid, categoryId: v.categoryId, month: ym, limit: a.n });
  }
  async function saveGoal(uid, v, old) {
    const e = {}, a = amt(v.target), name = (v.name || "").trim();
    if (a.err) e.target = a.err;
    if (!name || name.length > 40) e.name = "Nama 1 sampai 40 karakter.";
    if (v.deadline && !validDate(v.deadline)) e.deadline = "Tanggal tidak valid.";
    if (bad(e)) return e;
    await put("savingsGoals", { id: old?.id || id(), userId: uid, name, target: a.n, deadline: v.deadline || "", createdAt: old?.createdAt || Date.now() });
  }
  async function saveContribution(uid, v, d, goalId) {
    const e = {}, a = amt(v.amount);
    if (a.err) e.amount = a.err;
    if (!d.wallets.some((w) => w.id === v.walletId)) e.walletId = "Pilih dompet.";
    if (!validDate(v.date)) e.date = "Tanggal tidak valid.";
    if (bad(e)) return e;
    await put("savingsContributions", { id: id(), userId: uid, goalId, walletId: v.walletId, amount: a.n, date: v.date, createdAt: Date.now() });
  }
  var LOAD = ["categories", "wallets", "transactions", "transfers", "budgets", "savingsGoals", "savingsContributions", "recurring", "reminders", "debts", "debtPayments"];
  async function loadFor(uid) {
    await ensureDefaults(uid);
    const rs = await Promise.all(LOAD.map((n) => listByUser(n, uid))), d = Object.fromEntries(LOAD.map((n, i) => [n, rs[i]]));
    if (await processRecurring(uid, d, todayStr())) {
      d.transactions = await listByUser("transactions", uid);
      d.recurring = await listByUser("recurring", uid);
    }
    return d;
  }
  var resetSeed = (uid) => {
    delete seeding[uid];
  };
  function occ(r, k) {
    const [y, m, d] = r.start.split("-").map(Number), f = r.frequency, ymd = (x) => x.toISOString().slice(0, 10);
    if (f === "daily" || f === "weekly") return ymd(new Date(Date.UTC(y, m - 1, d + k * (f === "daily" ? 1 : 7))));
    const t = new Date(Date.UTC(f === "yearly" ? y + k : y, f === "monthly" ? m - 1 + k : m - 1, 1)), last2 = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    return ymd(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(d, last2))));
  }
  async function processRecurring(uid, d, today) {
    const puts = [];
    for (const r of d.recurring) {
      if (!r.active || !d.categories.some((c) => c.id === r.categoryId) || !d.wallets.some((w) => w.id === r.walletId)) continue;
      let last2 = r.lastDate || "", n = 0;
      for (let k = 0; k < 5e3 && n < 400; k++) {
        const dt = occ(r, k);
        if (dt > today || r.end && dt > r.end) break;
        if (dt > last2) {
          puts.push(["transactions", { id: "rec:" + r.id + ":" + dt, userId: uid, type: r.type, amount: r.amount, categoryId: r.categoryId, walletId: r.walletId, date: dt, note: r.note || "Transaksi berulang", createdAt: Date.now(), recurringId: r.id }]);
          last2 = dt;
          n++;
        }
      }
      if (last2 !== (r.lastDate || "")) puts.push(["recurring", { ...r, lastDate: last2 }]);
    }
    if (puts.length) await putAll(puts);
    return puts.length > 0;
  }
  function monthSeries(d, endYm, n = 6) {
    const out = [], [y, m] = endYm.split("-").map(Number), nm = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    for (let i = n - 1; i >= 0; i--) {
      const x = new Date(Date.UTC(y, m - 1 - i, 1)), ym = x.getUTCFullYear() + "-" + String(x.getUTCMonth() + 1).padStart(2, "0"), s = summary(d, ym);
      out.push({ ym, label: nm[x.getUTCMonth()], a: s.income, b: s.expense });
    }
    return out;
  }
  function dailySeries(d, ym) {
    const [y, m] = ym.split("-").map(Number), n = new Date(Date.UTC(y, m, 0)).getUTCDate(), inc = Array(n).fill(0), exp = Array(n).fill(0);
    for (const t of d.transactions) if (t.date.startsWith(ym)) (t.type === "income" ? inc : exp)[+t.date.slice(8) - 1] += t.amount;
    const cum = (a) => {
      let s = 0;
      return a.map((v) => s += v);
    };
    return { labels: Array.from({ length: n }, (_, i) => String(i + 1)), inc: cum(inc), exp: cum(exp) };
  }

  // js/modules/pages.js
  var icons = () => window.lucide?.createIcons();
  var catMap = (d) => Object.fromEntries(d.categories.map((c) => [c.id, c]));
  var walMap = (d) => Object.fromEntries(d.wallets.map((w) => [w.id, w]));
  var sortTx = (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
  var dot = (c) => `<span class="dot" style="background:${esc(c?.color || "#64748B")}"><i data-lucide="${esc(c?.icon || "circle-ellipsis")}"></i></span>`;
  var ib = (a, id2, l, i) => `<button class="btn icon-btn ghost" ${a}="${id2}" aria-label="${l}"><i data-lucide="${i}"></i></button>`;
  var txRow = (t, cm, wm, act) => {
    const c = cm[t.categoryId], inc = t.type === "income", body = `${dot(c)}<div class="grow"><b>${esc(c?.name || "Tanpa kategori")}</b><small>${fmtDate(t.date)}, ${esc(wm[t.walletId]?.name || "Tanpa dompet")}${t.note ? ", " + esc(t.note) : ""}</small></div><span class="amt ${inc ? "in" : ""}">${inc ? "+" : ""}${rupiah(t.amount)}</span>`;
    return `<li class="item">${act ? `<button class="rowbtn" data-open="${t.id}" aria-label="Detail transaksi ${esc(c?.name || "")}">${body}</button>` : body}</li>`;
  };
  var addBtns = '<div class="row"><button class="btn" data-add="income"><i data-lucide="plus"></i>Pemasukan</button><button class="btn primary" data-add="expense"><i data-lucide="plus"></i>Pengeluaran</button></div>';
  var fab = '<button class="fab" data-add="expense" aria-label="Tambah pengeluaran"><i data-lucide="plus"></i></button>';
  var del = async (store2, id2, refresh) => {
    try {
      await remove(store2, id2);
      toast("Dihapus.", "success");
      refresh();
    } catch {
      toast("Gagal menghapus.", "error");
    }
  };
  var saved = (ok) => ok && toast("Tersimpan.", "success");
  async function txForm(ctx, type, old, pre) {
    const { d, user, refresh } = ctx;
    const ok = await formSheet({ title: (old ? "Ubah " : "Tambah ") + (type === "income" ? "pemasukan" : "pengeluaran"), fields: [
      { id: "amount", label: "Nominal (Rp)", money: 1, value: old ? numFmt(old.amount) : "" },
      { id: "categoryId", label: "Kategori", options: d.categories.filter((c) => c.type === type).map((c) => [c.id, c.name]), value: old?.categoryId },
      { id: "walletId", label: "Dompet", options: d.wallets.map((w) => [w.id, w.name]), value: old?.walletId },
      { id: "date", label: "Tanggal", type: "date", value: old?.date || pre || todayStr() },
      { id: "note", label: "Catatan (opsional)", value: old?.note || "" }
    ], onSubmit: (v) => saveTx(user.id, type, v, d, old) });
    if (ok) {
      saved(ok);
      refresh();
    }
  }
  var bindAdd = (ctx) => document.querySelectorAll("[data-add]").forEach((b) => b.onclick = () => txForm(ctx, b.dataset.add));
  function dashboard(u, d) {
    const ym = todayStr().slice(0, 7), s = summary(d, ym), cm = catMap(d), wm = walMap(d);
    const sv = d.savingsContributions.reduce((a, c) => a + c.amount, 0), total = Object.values(balances(d)).reduce((a, b) => a + b, 0) + sv, net = s.income - s.expense;
    const bl = d.budgets.filter((b) => b.month === ym), bt = bl.reduce((a, b) => a + b.limit, 0), bs = bl.reduce((a, b) => a + spent(d, ym, b.categoryId), 0);
    const al = bl.map((b) => ({ b, p: Math.round(spent(d, ym, b.categoryId) / b.limit * 100) })).filter((x) => x.p >= 75);
    const td = todayStr(), lim = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10), rm = d.reminders.filter((r) => !r.paid && r.due <= lim).sort((a, b) => a.due.localeCompare(b.due)), rmCard = rm.length ? `<div class="card"><div class="head"><h2>Pengingat tagihan</h2><a href="#/reminders">Lihat</a></div><ul class="list">${rm.slice(0, 3).map((r) => `<li class="item"><div class="grow"><b>${esc(r.title)}</b><small>${r.due < td ? "Terlambat" : "Jatuh tempo"}, ${fmtDate(r.due)}</small></div><span class="amt">${rupiah(r.amount)}</span></li>`).join("")}</ul></div>` : "";
    const st2 = [["Pemasukan", s.income, "trending-up"], ["Pengeluaran", s.expense, "trending-down"], ["Sisa anggaran", bl.length ? bt - bs : null, "chart-pie"], ["Tabungan", sv, "coins"]];
    const cats = Object.entries(s.byCat).sort((a, b) => b[1] - a[1]).slice(0, 5), recent = [...d.transactions].sort(sortTx).slice(0, 5);
    return `<section class="view-enter"><div class="head"><div><h1>Halo, ${esc(u.name.split(" ")[0])}</h1><p class="sub">Ringkasan bulan ini</p></div>${addBtns}</div>
<div class="hero"><small>Saldo bersih</small><b data-n="${total}">${rupiahC(total)}</b><small>${net >= 0 ? "Surplus" : "Defisit"} bulan ini ${rupiah(Math.abs(net))}</small></div>
<div class="stats">${st2.map(([l, v, i]) => `<div class="stat"><small><i data-lucide="${i}"></i>${l}</small><b ${v === null ? "" : `data-n="${v}"`}>${v === null ? "Belum diatur" : rupiahC(v)}</b></div>`).join("")}</div>
<div class="grid2">${rmCard}${al.length ? `<div class="card"><h2>Peringatan anggaran</h2><ul class="list">${al.map(({ b, p }) => `<li class="item"><div class="grow"><b>${esc(cm[b.categoryId]?.name || "?")}</b><small>${p}% terpakai, ${lvl(p)[0]}</small></div></li>`).join("")}</ul></div>` : ""}
${recent.length ? `<div class="card"><h2>Pengeluaran per kategori</h2>${s.expense ? donut(catItems(d, s), s.expense) : '<p class="sub">Belum ada pengeluaran bulan ini.</p>'}</div><div class="card"><h2>Arus kas 6 bulan terakhir</h2>${barChart(monthSeries(d, ym))}</div>
<div class="card wide"><div class="head"><h2>Transaksi terbaru</h2><a href="#/transactions">Lihat semua</a></div><ul class="list">${recent.map((t) => txRow(t, cm, wm)).join("")}</ul></div>` : '<div class="card empty"><i data-lucide="inbox"></i><h2>Belum ada transaksi</h2><p>Catat pemasukan atau pengeluaran pertama Anda. Semua angka dihitung dari transaksi yang dicatat.</p></div>'}</div>${fab}</section>`;
  }
  var flt = { q: "", type: "all", limit: 30, from: "", to: "", cat: "all", sort: "date" };
  function listHtml(d) {
    const cm = catMap(d), wm = walMap(d), q = flt.q.toLowerCase(), SORT = { date: sortTx, old: (a, b) => sortTx(b, a), big: (a, b) => b.amount - a.amount, small: (a, b) => a.amount - b.amount, cat: (a, b) => (cm[a.categoryId]?.name || "").localeCompare(cm[b.categoryId]?.name || "") };
    const rows = d.transactions.filter((t) => (flt.type === "all" || t.type === flt.type) && (!q || `${cm[t.categoryId]?.name} ${t.note} ${wm[t.walletId]?.name}`.toLowerCase().includes(q)) && (!flt.from || t.date >= flt.from) && (!flt.to || t.date <= flt.to) && (flt.cat === "all" || t.categoryId === flt.cat)).sort(SORT[flt.sort] || sortTx);
    if (!rows.length) return `<div class="empty"><i data-lucide="inbox"></i><h2>${d.transactions.length ? "Tidak ada hasil" : "Belum ada transaksi"}</h2><p>${d.transactions.length ? "Ubah kata kunci atau filter." : "Mulai dengan menambah pemasukan atau pengeluaran."}</p></div>`;
    return `<ul class="list">${rows.slice(0, flt.limit).map((t) => txRow(t, cm, wm, 1)).join("")}</ul>${rows.length > flt.limit ? '<button id="more" class="btn" style="width:100%">Muat lebih banyak</button>' : ""}`;
  }
  var transactions = (u, d) => `<section class="view-enter"><div class="head"><h1>Transaksi</h1>${addBtns}</div><div class="toolbar"><input type="search" id="q" placeholder="Cari transaksi" aria-label="Cari transaksi" value="${esc(flt.q)}"><select id="ftype" aria-label="Jenis transaksi">${[["all", "Semua"], ["income", "Pemasukan"], ["expense", "Pengeluaran"]].map(([v, l]) => `<option value="${v}" ${v === flt.type ? "selected" : ""}>${l}</option>`).join("")}</select></div><div class="toolbar f2"><select id="fcat" aria-label="Kategori"><option value="all">Semua kategori</option>${d.categories.map((c) => `<option value="${c.id}" ${c.id === flt.cat ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select><input type="date" id="ffrom" aria-label="Dari tanggal" value="${flt.from}"><input type="date" id="fto" aria-label="Sampai tanggal" value="${flt.to}"><select id="fsort" aria-label="Urutkan">${[["date", "Terbaru"], ["old", "Terlama"], ["big", "Nominal terbesar"], ["small", "Nominal terkecil"], ["cat", "Nama kategori"]].map(([v, l]) => `<option value="${v}" ${v === flt.sort ? "selected" : ""}>${l}</option>`).join("")}</select></div><div class="card" id="txlist">${listHtml(d)}</div>${fab}</section>`;
  function bindTx(ctx) {
    bindAdd(ctx);
    const { d } = ctx, list = document.getElementById("txlist"), paint = () => {
      list.innerHTML = listHtml(d);
      icons();
    };
    document.getElementById("q").oninput = (e) => {
      flt.q = e.target.value;
      flt.limit = 30;
      paint();
    };
    document.getElementById("ftype").onchange = (e) => {
      flt.type = e.target.value;
      flt.limit = 30;
      paint();
    };
    [["fcat", "cat"], ["ffrom", "from"], ["fto", "to"], ["fsort", "sort"]].forEach(([i, k]) => document.getElementById(i).onchange = (e) => {
      flt[k] = e.target.value;
      flt.limit = 30;
      paint();
    });
    list.onclick = async (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.id === "more") {
        flt.limit += 30;
        return paint();
      }
      const t = d.transactions.find((x) => x.id === b.dataset.open);
      if (!t) return;
      const cm = catMap(d), wm = walMap(d);
      const a = await actionSheet({ title: esc(cm[t.categoryId]?.name || "Transaksi"), body: `${t.type === "income" ? "Pemasukan" : "Pengeluaran"} ${rupiah(t.amount)}<br>${fmtDate(t.date)}, ${esc(wm[t.walletId]?.name || "Tanpa dompet")}${t.note ? "<br>" + esc(t.note) : ""}`, actions: [["edit", "Ubah", "primary"], ["del", "Hapus", "danger"], ["", "Tutup", "ghost"]] });
      if (a === "edit") return txForm(ctx, t.type, t);
      if (a === "del" && await confirmDialog({ title: "Hapus transaksi?", body: "Saldo dan ringkasan akan diperbarui." })) del("transactions", t.id, ctx.refresh);
    };
  }
  var KINDS = [["cash", "Tunai"], ["bank", "Rekening bank"], ["ewallet", "E-wallet"], ["savings", "Tabungan"]];
  function wallets(u, d) {
    const bal = balances(d), wm = walMap(d), tr = [...d.transfers].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 10);
    return `<section class="view-enter"><div class="head"><h1>Dompet</h1><div class="row"><button class="btn" id="xfer" ${d.wallets.length < 2 ? "disabled" : ""}><i data-lucide="arrow-left-right"></i>Transfer</button><button class="btn primary" id="addW"><i data-lucide="plus"></i>Dompet</button></div></div>
<div class="card"><ul class="list">${d.wallets.map((w) => `<li class="item"><span class="dot" style="background:var(--primary)"><i data-lucide="landmark"></i></span><div class="grow"><b>${esc(w.name)}</b><small>${KINDS.find((k) => k[0] === w.kind)?.[1] || ""}</small></div><span class="amt">${rupiah(bal[w.id])}</span>${ib("data-ew", w.id, "Ubah dompet", "pencil")}${ib("data-dw", w.id, "Hapus dompet", "trash-2")}</li>`).join("")}</ul></div>
${tr.length ? `<div class="card"><h2>Riwayat transfer</h2><ul class="list">${tr.map((t) => `<li class="item"><div class="grow"><b>${esc(wm[t.fromId]?.name || "?")} \u2192 ${esc(wm[t.toId]?.name || "?")}</b><small>${fmtDate(t.date)}${t.note ? ", " + esc(t.note) : ""}</small></div><span class="amt">${rupiah(t.amount)}</span>${ib("data-dt", t.id, "Hapus transfer", "trash-2")}</li>`).join("")}</ul><p class="note">Transfer tidak dihitung sebagai pemasukan atau pengeluaran.</p></div>` : ""}</section>`;
  }
  async function walletForm(ctx, old) {
    const { user, refresh } = ctx;
    const ok = await formSheet({ title: old ? "Ubah dompet" : "Tambah dompet", fields: [{ id: "name", label: "Nama dompet", value: old?.name || "" }, { id: "kind", label: "Jenis", options: KINDS, value: old?.kind || "cash" }, { id: "initial", label: "Saldo awal (Rp)", money: 1, value: old ? numFmt(old.initial) : "" }], onSubmit: (v) => saveWallet(user.id, v, old) });
    if (ok) {
      saved(ok);
      refresh();
    }
  }
  async function transferForm(ctx) {
    const { d, user, refresh } = ctx, o = d.wallets.map((w) => [w.id, w.name]);
    const ok = await formSheet({ title: "Transfer antardompet", submitText: "Transfer", fields: [{ id: "fromId", label: "Dari", options: o, value: o[0][0] }, { id: "toId", label: "Ke", options: o, value: o[1][0] }, { id: "amount", label: "Nominal (Rp)", money: 1 }, { id: "date", label: "Tanggal", type: "date", value: todayStr() }, { id: "note", label: "Catatan (opsional)" }], onSubmit: (v) => saveTransfer(user.id, v, d) });
    if (ok) {
      saved(ok);
      refresh();
    }
  }
  function bindW(ctx) {
    const { d, refresh } = ctx;
    document.getElementById("addW").onclick = () => walletForm(ctx);
    document.getElementById("xfer").onclick = () => transferForm(ctx);
    document.getElementById("view").onclick = async (e) => {
      const b = e.target.closest("[data-ew],[data-dw],[data-dt]");
      if (!b) return;
      if (b.dataset.ew) return walletForm(ctx, d.wallets.find((w) => w.id === b.dataset.ew));
      if (b.dataset.dt) {
        if (await confirmDialog({ title: "Hapus transfer?", body: "Saldo kedua dompet akan dikembalikan." })) del("transfers", b.dataset.dt, refresh);
        return;
      }
      const id2 = b.dataset.dw, n = walletUse(d, id2);
      if (d.wallets.length < 2) return toast("Minimal satu dompet diperlukan.", "error");
      if (n) return toast(`Dompet masih dipakai ${n} transaksi/transfer. Hapus atau pindahkan dulu.`, "error");
      if (await confirmDialog({ title: "Hapus dompet?", body: "Dompet ini akan dihapus permanen." })) del("wallets", id2, refresh);
    };
  }
  var ICONS = [["utensils", "Makan"], ["car", "Transportasi"], ["shopping-bag", "Belanja"], ["receipt", "Tagihan"], ["film", "Hiburan"], ["heart-pulse", "Kesehatan"], ["banknote", "Uang"], ["gift", "Hadiah"], ["home", "Rumah"], ["graduation-cap", "Pendidikan"], ["plane", "Perjalanan"], ["circle-ellipsis", "Lainnya"]];
  var COLORS = [["#2563EB", "Biru"], ["#10B981", "Hijau"], ["#7C3AED", "Ungu"], ["#E11D48", "Merah muda"], ["#EA580C", "Oranye"], ["#0D9488", "Teal"], ["#64748B", "Abu-abu"]];
  function categories(u, d) {
    const sec = (type, t) => `<div class="card"><div class="head"><h2>${t}</h2><button class="btn" data-addc="${type}"><i data-lucide="plus"></i>Tambah</button></div><ul class="list">${d.categories.filter((c) => c.type === type).map((c) => `<li class="item">${dot(c)}<div class="grow"><b>${esc(c.name)}</b><small>${catUse(d, c.id)} transaksi</small></div>${ib("data-ec", c.id, "Ubah kategori", "pencil")}${ib("data-dc", c.id, "Hapus kategori", "trash-2")}</li>`).join("")}</ul></div>`;
    return `<section class="view-enter"><h1>Kategori</h1>${sec("income", "Pemasukan")}${sec("expense", "Pengeluaran")}</section>`;
  }
  async function catForm(ctx, type, old) {
    const ok = await formSheet({ title: old ? "Ubah kategori" : "Tambah kategori", fields: [{ id: "name", label: "Nama kategori", value: old?.name || "" }, { id: "icon", label: "Ikon", options: ICONS, value: old?.icon || "circle-ellipsis" }, { id: "color", label: "Warna", options: COLORS, value: old?.color || "#2563EB" }], onSubmit: (v) => saveCategory(ctx.user.id, type, v, ctx.d, old) });
    if (ok) {
      saved(ok);
      ctx.refresh();
    }
  }
  function bindC(ctx) {
    const { d, refresh } = ctx;
    document.getElementById("view").onclick = async (e) => {
      const b = e.target.closest("[data-addc],[data-ec],[data-dc]");
      if (!b) return;
      if (b.dataset.addc) return catForm(ctx, b.dataset.addc);
      const c = d.categories.find((x) => x.id === (b.dataset.ec || b.dataset.dc));
      if (!c) return;
      if (b.dataset.ec) return catForm(ctx, c.type, c);
      const n = catUse(d, c.id);
      if (n) return toast(`Kategori masih dipakai ${n} transaksi. Ubah atau hapus transaksinya dulu.`, "error");
      if (await confirmDialog({ title: "Hapus kategori?", body: `Kategori "${esc(c.name)}" akan dihapus.` })) del("categories", c.id, refresh);
    };
  }
  var bm = todayStr().slice(0, 7);
  var shiftM = (ym, n) => {
    const [y, m] = ym.split("-").map(Number), x = new Date(y, m - 1 + n, 1);
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0");
  };
  var monthLbl = (ym) => (/* @__PURE__ */ new Date(ym + "-01T00:00:00")).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  var lvl = (p) => p >= 100 ? ["Melebihi anggaran", "var(--danger)"] : p >= 90 ? ["Hampir habis (90%+)", "var(--danger)"] : p >= 75 ? ["Waspada (75%+)", "var(--warn)"] : ["Aman", "var(--ok)"];
  function budgets(u, d) {
    const list = d.budgets.filter((b) => b.month === bm), cm = catMap(d), tl = list.reduce((a, b) => a + b.limit, 0), ts = list.reduce((a, b) => a + spent(d, bm, b.categoryId), 0);
    return `<section class="view-enter"><div class="head"><h1>Anggaran</h1><button class="btn primary" id="addB"><i data-lucide="plus"></i>Anggaran</button></div>
<div class="monthnav"><button class="btn icon-btn ghost" id="pm" aria-label="Bulan sebelumnya"><i data-lucide="chevron-left"></i></button><b>${monthLbl(bm)}</b><button class="btn icon-btn ghost" id="nm" aria-label="Bulan berikutnya"><i data-lucide="chevron-right"></i></button></div>
${list.length ? `<div class="card"><div class="split3"><div><small>Terpakai</small><b>${rupiahC(ts)}</b></div><div><small>Batas</small><b>${rupiahC(tl)}</b></div><div><small>Sisa</small><b>${rupiahC(tl - ts)}</b></div></div><div class="bar"><i style="width:${Math.min(100, Math.round(ts / tl * 100))}%;background:${lvl(Math.round(ts / tl * 100))[1]}"></i></div></div><div class="card"><ul class="list">${list.map((b) => {
      const s = spent(d, bm, b.categoryId), p = Math.round(s / b.limit * 100), [t, col] = lvl(p);
      return `<li class="item" style="flex-wrap:wrap">${dot(cm[b.categoryId])}<div class="grow"><b>${esc(cm[b.categoryId]?.name || "?")}</b><small>${rupiah(s)} dari ${rupiah(b.limit)}</small></div>${ib("data-eb", b.id, "Ubah anggaran", "pencil")}${ib("data-db", b.id, "Hapus anggaran", "trash-2")}<div style="flex-basis:100%"><div class="bar"><i style="width:${Math.min(p, 100)}%;background:${col}"></i></div><small class="note">${p}%, ${t}</small></div></li>`;
    }).join("")}</ul></div>` : '<div class="card empty"><i data-lucide="chart-pie"></i><h2>Belum ada anggaran bulan ini</h2><p>Tetapkan batas pengeluaran per kategori untuk memantau sisa anggaran.</p></div>'}</section>`;
  }
  async function budgetForm(ctx, old) {
    const { d, user, refresh } = ctx, used = new Set(d.budgets.filter((b) => b.month === bm && b.id !== old?.id).map((b) => b.categoryId)), opts = d.categories.filter((c) => c.type === "expense" && !used.has(c.id)).map((c) => [c.id, c.name]);
    if (!opts.length) return toast("Semua kategori pengeluaran sudah punya anggaran bulan ini.", "error");
    const ok = await formSheet({ title: (old ? "Ubah" : "Tambah") + " anggaran, " + monthLbl(bm), fields: [{ id: "categoryId", label: "Kategori", options: opts, value: old?.categoryId }, { id: "limit", label: "Batas anggaran (Rp)", money: 1, value: old ? numFmt(old.limit) : "" }], onSubmit: (v) => saveBudget(user.id, v, d, bm, old) });
    if (ok) {
      saved(ok);
      refresh();
    }
  }
  function bindB(ctx) {
    const { d, refresh } = ctx;
    document.getElementById("pm").onclick = () => {
      bm = shiftM(bm, -1);
      refresh();
    };
    document.getElementById("nm").onclick = () => {
      bm = shiftM(bm, 1);
      refresh();
    };
    document.getElementById("addB").onclick = () => budgetForm(ctx);
    document.getElementById("view").onclick = async (e) => {
      const b = e.target.closest("[data-eb],[data-db]");
      if (!b) return;
      const x = d.budgets.find((y) => y.id === (b.dataset.eb || b.dataset.db));
      if (!x) return;
      if (b.dataset.eb) return budgetForm(ctx, x);
      if (await confirmDialog({ title: "Hapus anggaran?", body: "Transaksi tidak ikut terhapus." })) del("budgets", x.id, refresh);
    };
  }
  var GS = { done: "Tercapai", late: "Lewat tenggat", active: "Aktif" };
  function savings(u, d) {
    const today = todayStr(), wm = walMap(d), gm = Object.fromEntries(d.savingsGoals.map((g) => [g.id, g])), hist = [...d.savingsContributions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 10);
    return `<section class="view-enter"><div class="head"><h1>Target Tabungan</h1><button class="btn primary" id="addG"><i data-lucide="plus"></i>Target</button></div>
${d.savingsGoals.length ? `<div class="card"><ul class="list">${d.savingsGoals.map((g) => {
      const c = collected(d, g.id), p = Math.min(100, Math.round(c / g.target * 100)), st2 = goalStatus(g, c, today);
      return `<li class="item" style="flex-wrap:wrap"><span class="dot" style="background:var(--primary);color:var(--on-primary)"><i data-lucide="target"></i></span><div class="grow"><b>${esc(g.name)}</b><small>${rupiah(c)} dari ${rupiah(g.target)}${g.deadline ? ", tenggat " + fmtDate(g.deadline) : ""}</small></div>${ib("data-eg", g.id, "Ubah target", "pencil")}${ib("data-dg", g.id, "Hapus target", "trash-2")}<div style="flex-basis:100%"><div class="bar"><i style="width:${p}%"></i></div><div class="head" style="margin-top:.4rem"><small class="note">${p}%, ${GS[st2]}</small><button class="btn" data-cg="${g.id}" style="min-height:40px;padding:0 .8rem"><i data-lucide="plus"></i>Setor</button></div></div></li>`;
    }).join("")}</ul><p class="note">Setoran memindahkan saldo dompet ke target, bukan pengeluaran.</p></div>` : '<div class="card empty"><i data-lucide="target"></i><h2>Belum ada target</h2><p>Buat target tabungan lalu setor dari dompet Anda.</p></div>'}
${hist.length ? `<div class="card"><h2>Riwayat setoran</h2><ul class="list">${hist.map((c) => `<li class="item"><div class="grow"><b>${esc(gm[c.goalId]?.name || "?")}</b><small>${fmtDate(c.date)}, ${esc(wm[c.walletId]?.name || "Tanpa dompet")}</small></div><span class="amt">${rupiah(c.amount)}</span>${ib("data-dc2", c.id, "Hapus setoran", "trash-2")}</li>`).join("")}</ul></div>` : ""}</section>`;
  }
  async function goalForm(ctx, old) {
    const ok = await formSheet({ title: old ? "Ubah target" : "Tambah target", fields: [{ id: "name", label: "Nama target", value: old?.name || "" }, { id: "target", label: "Nominal target (Rp)", money: 1, value: old ? numFmt(old.target) : "" }, { id: "deadline", label: "Tenggat (opsional)", type: "date", value: old?.deadline || "" }], onSubmit: (v) => saveGoal(ctx.user.id, v, old) });
    if (ok) {
      saved(ok);
      ctx.refresh();
    }
  }
  async function contribForm(ctx, g) {
    const { d } = ctx, ok = await formSheet({ title: "Setor ke " + esc(g.name), submitText: "Setor", fields: [{ id: "amount", label: "Nominal (Rp)", money: 1 }, { id: "walletId", label: "Dari dompet", options: d.wallets.map((w) => [w.id, w.name]) }, { id: "date", label: "Tanggal", type: "date", value: todayStr() }], onSubmit: (v) => saveContribution(ctx.user.id, v, d, g.id) });
    if (ok) {
      saved(ok);
      ctx.refresh();
    }
  }
  function bindS(ctx) {
    const { d, refresh } = ctx;
    document.getElementById("addG").onclick = () => goalForm(ctx);
    document.getElementById("view").onclick = async (e) => {
      const b = e.target.closest("[data-eg],[data-dg],[data-cg],[data-dc2]");
      if (!b) return;
      if (b.dataset.dc2) {
        if (await confirmDialog({ title: "Hapus setoran?", body: "Saldo dompet akan dikembalikan." })) del("savingsContributions", b.dataset.dc2, refresh);
        return;
      }
      const g = d.savingsGoals.find((x) => x.id === (b.dataset.eg || b.dataset.dg || b.dataset.cg));
      if (!g) return;
      if (b.dataset.eg) return goalForm(ctx, g);
      if (b.dataset.cg) return contribForm(ctx, g);
      if (await confirmDialog({ title: "Hapus target?", body: "Semua setoran target ini ikut dihapus dan saldo dikembalikan ke dompet." })) {
        try {
          await removeAll([...d.savingsContributions.filter((c) => c.goalId === g.id).map((c) => ["savingsContributions", c.id]), ["savingsGoals", g.id]]);
          toast("Dihapus.", "success");
          refresh();
        } catch {
          toast("Gagal menghapus.", "error");
        }
      }
    };
  }
  var VIEWS = { budgets: { view: budgets, bind: bindB }, savings: { view: savings, bind: bindS }, dashboard: { view: dashboard, bind: bindAdd }, transactions: { view: transactions, bind: bindTx }, wallets: { view: wallets, bind: bindW }, categories: { view: categories, bind: bindC } };
  var catItems = (d, s) => {
    const cm = catMap(d), a = Object.entries(s.byCat).sort((x, y) => y[1] - x[1]).map(([i, v]) => ({ label: cm[i]?.name || "Tanpa kategori", value: v, color: cm[i]?.color || "#64748B" }));
    return a.length > 6 ? [...a.slice(0, 5), { label: "Lainnya", value: a.slice(5).reduce((t, x) => t + x.value, 0), color: "#94A3B8" }] : a;
  };

  // js/modules/more.js
  var $ = (i) => document.getElementById(i);
  var V = () => $("view");
  var bad2 = (o) => Object.keys(o).length > 0;
  var D = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
  };
  var S = (x) => x.toISOString().slice(0, 10);
  var add = (s, n) => S(new Date(D(s).getTime() + n * 864e5));
  var opt = (a, v) => a.map(([x, l]) => `<option value="${esc(x)}" ${x === v ? "selected" : ""}>${esc(l)}</option>`).join("");
  var mlbl = (ym) => (/* @__PURE__ */ new Date(ym + "-01T00:00:00Z")).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
  var shiftM2 = (ym, n) => {
    const [y, m] = ym.split("-").map(Number), x = new Date(Date.UTC(y, m - 1 + n, 1));
    return x.getUTCFullYear() + "-" + String(x.getUTCMonth() + 1).padStart(2, "0");
  };
  var acts = (m) => {
    V().onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      for (const k in m) if (b.dataset[k] !== void 0) return m[k](b.dataset[k], b);
    };
  };
  var askDel = (t, b, fn) => confirmDialog({ title: t, body: b }).then((y) => y && fn());
  var monthnav = (m) => `<div class="monthnav"><button class="btn icon-btn ghost" id="pm" aria-label="Bulan sebelumnya"><i data-lucide="chevron-left"></i></button><b>${mlbl(m)}</b><button class="btn icon-btn ghost" id="nm" aria-label="Bulan berikutnya"><i data-lucide="chevron-right"></i></button></div>`;
  var empty = (i, t, p) => `<div class="card empty"><i data-lucide="${i}"></i><h2>${t}</h2><p>${p}</p></div>`;
  var save = async (ctx, p) => {
    if (await p) {
      saved(1);
      ctx.refresh();
    }
  };
  var R = { mode: "month", date: todayStr(), from: todayStr().slice(0, 8) + "01", to: todayStr() };
  var MODES = [["day", "Harian"], ["week", "Mingguan"], ["month", "Bulanan"], ["year", "Tahunan"], ["custom", "Khusus"]];
  function range(sh) {
    const d = D(R.date);
    if (R.mode === "day") return [add(R.date, sh), add(R.date, sh)];
    if (R.mode === "week") {
      const a = add(R.date, -((d.getUTCDay() + 6) % 7) + 7 * sh);
      return [a, add(a, 6)];
    }
    if (R.mode === "month") {
      const y = d.getUTCFullYear(), m = d.getUTCMonth() + sh;
      return [S(new Date(Date.UTC(y, m, 1))), S(new Date(Date.UTC(y, m + 1, 0)))];
    }
    if (R.mode === "year") {
      const y = d.getUTCFullYear() + sh;
      return [y + "-01-01", y + "-12-31"];
    }
    const n = Math.round((D(R.to) - D(R.from)) / 864e5) + 1;
    return [add(R.from, n * sh), add(R.to, n * sh)];
  }
  var tot = (d, [a, b]) => {
    const s = { income: 0, expense: 0, by: {}, list: [] };
    for (const t of d.transactions) if (t.date >= a && t.date <= b) {
      s[t.type] += t.amount;
      s.list.push(t);
      if (t.type === "expense") s.by[t.categoryId] = (s.by[t.categoryId] || 0) + t.amount;
    }
    return s;
  };
  var pct = (c, p) => p ? `${c >= p ? "Naik" : "Turun"} ${Math.abs(Math.round((c - p) / p * 100))}% dari periode lalu` : "Belum ada data periode lalu";
  function reports(u, d) {
    const cm = catMap(d), wm = walMap(d), inv = R.mode === "custom" && (!validDate(R.from) || !validDate(R.to) || R.from > R.to);
    let body = '<div class="card"><p class="err">Rentang tanggal tidak valid.</p></div>';
    if (!inv) {
      const g = range(0), c = tot(d, g), p = tot(d, range(-1)), by = Object.entries(c.by).sort((a, b) => b[1] - a[1]), big = c.list.filter((t) => t.type === "expense").sort((a, b) => b.amount - a.amount).slice(0, 5);
      body = `<p class="note" style="margin-top:.6rem">${fmtDate(g[0])} sampai ${fmtDate(g[1])}</p><div class="stats">${[["Pemasukan", rupiah(c.income), pct(c.income, p.income)], ["Pengeluaran", rupiah(c.expense), pct(c.expense, p.expense)], ["Selisih arus kas", rupiah(c.income - c.expense), "Periode lalu: " + rupiah(p.income - p.expense)], ["Jumlah transaksi", c.list.length, "Periode lalu: " + p.list.length]].map(([l, v, s]) => `<div class="stat"><small>${l}</small><b>${v}</b><small>${s}</small></div>`).join("")}</div>
<div class="card"><h2>Pengeluaran per kategori</h2>${by.length ? by.map(([i, v]) => `<div style="margin-bottom:.7rem"><div class="head"><span>${esc(cm[i]?.name || "Tanpa kategori")}</span><b>${rupiah(v)}</b></div><div class="bar"><i style="width:${Math.round(v / c.expense * 100)}%"></i></div></div>`).join("") : '<p class="sub">Tidak ada pengeluaran pada periode ini.</p>'}</div>
<div class="card"><h2>Pengeluaran terbesar</h2>${big.length ? `<ul class="list">${big.map((t) => txRow(t, cm, wm)).join("")}</ul>` : '<p class="sub">Belum ada data.</p>'}</div>`;
    }
    return `<section class="view-enter"><h1>Laporan</h1><div class="toolbar f2"><select id="rmode" aria-label="Periode">${opt(MODES, R.mode)}</select>${R.mode === "custom" ? `<input type="date" id="rfrom" value="${R.from}" aria-label="Dari tanggal"><input type="date" id="rto" value="${R.to}" aria-label="Sampai tanggal">` : `<input type="date" id="rdate" value="${R.date}" aria-label="Tanggal acuan">`}</div>${body}</section>`;
  }
  function bindR(ctx) {
    const set = (k, v) => {
      R[k] = v;
      if (k === "date" && !validDate(v)) R.date = todayStr();
      ctx.refresh();
    };
    $("rmode").onchange = (e) => set("mode", e.target.value);
    [["rdate", "date"], ["rfrom", "from"], ["rto", "to"]].forEach(([i, k]) => {
      if ($(i)) $(i).onchange = (e) => set(k, e.target.value);
    });
  }
  var C = { m: todayStr().slice(0, 7), sel: todayStr(), cat: "all" };
  function calendar(u, d) {
    const [y, m] = C.m.split("-").map(Number), lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7, days = new Date(Date.UTC(y, m, 0)).getUTCDate(), by = {};
    for (const t of d.transactions) if (t.date.startsWith(C.m) && (C.cat === "all" || t.categoryId === C.cat)) (by[t.date] ??= []).push(t);
    const cells = [...Array(lead).fill("<span></span>"), ...Array.from({ length: days }, (_, i) => {
      const dt = C.m + "-" + String(i + 1).padStart(2, "0"), a = by[dt] || [];
      return `<button class="day ${dt === C.sel ? "sel" : ""} ${dt === todayStr() ? "today" : ""}" data-day="${dt}" aria-label="${fmtDate(dt)}, ${a.length} transaksi"><span>${i + 1}</span><span class="dots">${a.some((t) => t.type === "income") ? '<i class="dt in"></i>' : ""}${a.some((t) => t.type === "expense") ? '<i class="dt out"></i>' : ""}</span></button>`;
    })];
    const s = by[C.sel] || [], sum = (ty) => s.filter((t) => t.type === ty).reduce((a, t) => a + t.amount, 0), cm = catMap(d), wm = walMap(d);
    return `<section class="view-enter"><h1>Kalender Keuangan</h1>${monthnav(C.m)}<div class="toolbar"><select id="ccat" aria-label="Kategori">${opt([["all", "Semua kategori"], ...d.categories.map((c) => [c.id, c.name])], C.cat)}</select></div>
<div class="card"><div class="cal">${["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((x) => `<small>${x}</small>`).join("")}${cells.join("")}</div><p class="note" style="margin-top:.6rem">Lingkaran: ada pemasukan, Kotak: ada pengeluaran</p></div>
<div class="card"><h2>${fmtDate(C.sel)}</h2><div class="split2"><div><small>Pemasukan</small><b>${rupiahC(sum("income"))}</b></div><div><small>Pengeluaran</small><b>${rupiahC(sum("expense"))}</b></div></div>${s.length ? `<ul class="list">${s.map((t) => txRow(t, cm, wm)).join("")}</ul>` : '<p class="sub" style="margin-top:.5rem">Tidak ada transaksi.</p>'}<div class="row split"><button class="btn" data-cadd="income"><i data-lucide="plus"></i>Pemasukan</button><button class="btn primary" data-cadd="expense"><i data-lucide="plus"></i>Pengeluaran</button></div></div></section>`;
  }
  function bindCal(ctx) {
    const mv = (n) => {
      C.m = shiftM2(C.m, n);
      C.sel = C.m + "-01";
      ctx.refresh();
    };
    $("pm").onclick = () => mv(-1);
    $("nm").onclick = () => mv(1);
    $("ccat").onchange = (e) => {
      C.cat = e.target.value;
      ctx.refresh();
    };
    acts({ day: (v) => {
      C.sel = v;
      ctx.refresh();
    }, cadd: (t) => txForm(ctx, t, void 0, C.sel) });
  }
  function reminders(u, d) {
    const td = todayStr(), rows = [...d.reminders].sort((a, b) => a.paid - b.paid || a.due.localeCompare(b.due)), st2 = (r) => r.paid ? ["Selesai", "circle-check"] : r.due < td ? ["Terlambat", "triangle-alert"] : r.due === td ? ["Jatuh tempo hari ini", "clock"] : ["Mendatang", "calendar"];
    return `<section class="view-enter"><div class="head"><h1>Pengingat Tagihan</h1><button class="btn primary" id="addR"><i data-lucide="plus"></i>Pengingat</button></div>
${rows.length ? `<div class="card"><ul class="list">${rows.map((r) => {
      const [l, i] = st2(r);
      return `<li class="item"><span class="dot" style="background:${r.paid ? "var(--ok)" : r.due < td ? "var(--danger)" : "var(--primary)"};color:#fff"><i data-lucide="${i}"></i></span><div class="grow"><b class="${r.paid ? "done" : ""}">${esc(r.title)}</b><small>${fmtDate(r.due)}, ${rupiah(r.amount)}, ${l}</small></div>${ib("data-tg", r.id, r.paid ? "Tandai belum selesai" : "Tandai selesai", r.paid ? "rotate-ccw" : "check")}${ib("data-er", r.id, "Ubah pengingat", "pencil")}${ib("data-dr", r.id, "Hapus pengingat", "trash-2")}</li>`;
    }).join("")}</ul><p class="note">Pengingat tampil di Beranda saat jatuh tempo kurang dari 3 hari atau terlambat. Notifikasi hanya muncul di dalam aplikasi saat dibuka.</p></div>` : empty("bell", "Belum ada pengingat", "Tambahkan tagihan agar jatuh temponya tidak terlewat.")}</section>`;
  }
  async function remForm(ctx, old) {
    const { d, user } = ctx;
    save(ctx, formSheet({
      title: old ? "Ubah pengingat" : "Tambah pengingat",
      fields: [{ id: "title", label: "Nama tagihan", value: old?.title || "" }, { id: "amount", label: "Nominal (Rp)", money: 1, value: old ? numFmt(old.amount) : "" }, { id: "categoryId", label: "Kategori", options: [["", "Tanpa kategori"], ...d.categories.filter((c) => c.type === "expense").map((c) => [c.id, c.name])], value: old?.categoryId || "" }, { id: "due", label: "Jatuh tempo", type: "date", value: old?.due || todayStr() }],
      onSubmit: async (v) => {
        const e = {}, a = amt(v.amount), t = (v.title || "").trim();
        if (!t || t.length > 60) e.title = "Nama 1 sampai 60 karakter.";
        if (a.err) e.amount = a.err;
        if (!validDate(v.due)) e.due = "Tanggal tidak valid.";
        if (bad2(e)) return e;
        await put("reminders", { id: old?.id || crypto.randomUUID(), userId: user.id, title: t, amount: a.n, categoryId: v.categoryId, due: v.due, paid: old?.paid || false, createdAt: old?.createdAt || Date.now() });
      }
    }));
  }
  function bindRem(ctx) {
    const g = (id2) => ctx.d.reminders.find((r) => r.id === id2);
    $("addR").onclick = () => remForm(ctx);
    acts({ tg: async (id2) => {
      const r = g(id2);
      try {
        await put("reminders", { ...r, paid: !r.paid });
        ctx.refresh();
      } catch {
        toast("Gagal menyimpan.", "error");
      }
    }, er: (id2) => remForm(ctx, g(id2)), dr: (id2) => askDel("Hapus pengingat?", "Pengingat ini akan dihapus.", () => del("reminders", id2, ctx.refresh)) });
  }
  var KD = [["debt", "Utang saya"], ["recv", "Piutang (orang lain berutang)"]];
  var paidOf = (d, id2) => d.debtPayments.filter((p) => p.debtId === id2).reduce((a, p) => a + p.amount, 0);
  function debts(u, d) {
    const td = todayStr(), rem = (k) => d.debts.filter((x) => x.kind === k).reduce((a, x) => a + x.total - paidOf(d, x.id), 0), dm = Object.fromEntries(d.debts.map((x) => [x.id, x])), hist = [...d.debtPayments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
    return `<section class="view-enter"><div class="head"><h1>Utang &amp; Piutang</h1><button class="btn primary" id="addD"><i data-lucide="plus"></i>Catatan</button></div>
<div class="stats"><div class="stat"><small>Sisa utang saya</small><b>${rupiah(rem("debt"))}</b></div><div class="stat"><small>Sisa piutang</small><b>${rupiah(rem("recv"))}</b></div></div>
${d.debts.length ? `<div class="card"><ul class="list">${d.debts.map((x) => {
      const p = paidOf(d, x.id), r = x.total - p, pc = Math.min(100, Math.round(p / x.total * 100)), s = r <= 0 ? "Lunas" : x.due && x.due < td ? "Lewat tempo" : "Belum lunas";
      return `<li class="item" style="flex-wrap:wrap"><div class="grow"><b>${esc(x.party)}</b><small>${x.kind === "debt" ? "Utang saya" : "Piutang"}, sisa ${rupiah(r)} dari ${rupiah(x.total)}${x.due ? ", tempo " + fmtDate(x.due) : ""}</small></div>${ib("data-ed", x.id, "Ubah catatan", "pencil")}${ib("data-dd", x.id, "Hapus catatan", "trash-2")}<div style="flex-basis:100%"><div class="bar"><i style="width:${pc}%"></i></div><div class="head" style="margin-top:.4rem"><small class="note">${pc}%, ${s}</small>${r > 0 ? `<button class="btn" data-pd="${x.id}" style="min-height:40px;padding:0 .8rem">${x.kind === "debt" ? "Bayar cicilan" : "Terima cicilan"}</button>` : ""}</div></div></li>`;
    }).join("")}</ul><p class="note">Catatan ini terpisah dan tidak mengubah saldo dompet.</p></div>` : empty("handshake", "Belum ada catatan", "Catat utang atau piutang beserta cicilannya.")}
${hist.length ? `<div class="card"><h2>Riwayat cicilan</h2><ul class="list">${hist.map((p) => `<li class="item"><div class="grow"><b>${esc(dm[p.debtId]?.party || "?")}</b><small>${fmtDate(p.date)}</small></div><span class="amt">${rupiah(p.amount)}</span>${ib("data-dp", p.id, "Hapus cicilan", "trash-2")}</li>`).join("")}</ul></div>` : ""}</section>`;
  }
  async function debtForm(ctx, old) {
    const { user } = ctx;
    save(ctx, formSheet({
      title: old ? "Ubah catatan" : "Tambah catatan",
      fields: [{ id: "kind", label: "Jenis", options: KD, value: old?.kind || "debt" }, { id: "party", label: "Nama pihak", value: old?.party || "" }, { id: "total", label: "Nominal awal (Rp)", money: 1, value: old ? numFmt(old.total) : "" }, { id: "due", label: "Jatuh tempo (opsional)", type: "date", value: old?.due || "" }],
      onSubmit: async (v) => {
        const e = {}, a = amt(v.total), p = (v.party || "").trim();
        if (!p || p.length > 60) e.party = "Nama 1 sampai 60 karakter.";
        if (a.err) e.total = a.err;
        if (v.due && !validDate(v.due)) e.due = "Tanggal tidak valid.";
        if (bad2(e)) return e;
        await put("debts", { id: old?.id || crypto.randomUUID(), userId: user.id, kind: v.kind, party: p, total: a.n, due: v.due || "", createdAt: old?.createdAt || Date.now() });
      }
    }));
  }
  async function payForm(ctx, x) {
    const { d, user } = ctx, r = x.total - paidOf(d, x.id);
    save(ctx, formSheet({
      title: (x.kind === "debt" ? "Bayar cicilan, " : "Terima cicilan, ") + esc(x.party),
      submitText: "Simpan",
      fields: [{ id: "amount", label: "Nominal (maks " + rupiah(r) + ")", money: 1 }, { id: "date", label: "Tanggal", type: "date", value: todayStr() }],
      onSubmit: async (v) => {
        const e = {}, a = amt(v.amount);
        if (a.err) e.amount = a.err;
        else if (a.n > r) e.amount = "Melebihi sisa saldo.";
        if (!validDate(v.date)) e.date = "Tanggal tidak valid.";
        if (bad2(e)) return e;
        await put("debtPayments", { id: crypto.randomUUID(), userId: user.id, debtId: x.id, amount: a.n, date: v.date, createdAt: Date.now() });
      }
    }));
  }
  function bindDebt(ctx) {
    const { d } = ctx, g = (id2) => d.debts.find((x) => x.id === id2);
    $("addD").onclick = () => debtForm(ctx);
    acts({
      ed: (id2) => debtForm(ctx, g(id2)),
      pd: (id2) => payForm(ctx, g(id2)),
      dp: (id2) => askDel("Hapus cicilan?", "Sisa saldo akan dihitung ulang.", () => del("debtPayments", id2, ctx.refresh)),
      dd: (id2) => askDel("Hapus catatan?", "Seluruh riwayat cicilannya ikut dihapus.", async () => {
        try {
          await batch([...d.debtPayments.filter((p) => p.debtId === id2).map((p) => ["del", "debtPayments", p.id]), ["del", "debts", id2]]);
          toast("Dihapus.", "success");
          ctx.refresh();
        } catch {
          toast("Gagal menghapus.", "error");
        }
      })
    });
  }
  var FQ = [["daily", "Harian"], ["weekly", "Mingguan"], ["monthly", "Bulanan"], ["yearly", "Tahunan"]];
  function recurring(u, d) {
    const cm = catMap(d), wm = walMap(d), n = (id2) => d.transactions.filter((t) => t.recurringId === id2).length;
    return `<section class="view-enter"><div class="head"><h1>Transaksi Berulang</h1><div class="row"><button class="btn" data-addr="income"><i data-lucide="plus"></i>Pemasukan</button><button class="btn primary" data-addr="expense"><i data-lucide="plus"></i>Pengeluaran</button></div></div>
${d.recurring.length ? `<div class="card"><ul class="list">${d.recurring.map((r) => `<li class="item">${dot(cm[r.categoryId])}<div class="grow"><b>${esc(cm[r.categoryId]?.name || "?")}, ${r.type === "income" ? "+" : ""}${rupiah(r.amount)}</b><small>${FQ.find((f) => f[0] === r.frequency)[1]}, mulai ${fmtDate(r.start)}${r.end ? ", sampai " + fmtDate(r.end) : ""}, ${esc(wm[r.walletId]?.name || "Tanpa dompet")}, ${r.active ? "Aktif" : "Nonaktif"}, ${n(r.id)} transaksi dibuat</small></div>${ib("data-tr", r.id, r.active ? "Nonaktifkan" : "Aktifkan", r.active ? "pause" : "play")}${ib("data-er", r.id, "Ubah", "pencil")}${ib("data-dr", r.id, "Hapus", "trash-2")}</li>`).join("")}</ul><p class="note">Jadwal hanya diproses saat Chasify dibuka, transaksi tidak dibuat otomatis saat browser tertutup. Setiap jadwal hanya membuat satu transaksi per tanggal.</p></div>` : empty("repeat", "Belum ada transaksi berulang", "Atur gaji, langganan, atau cicilan yang terjadi rutin.")}</section>`;
  }
  async function recForm(ctx, type, old) {
    const { d, user } = ctx;
    save(ctx, formSheet({
      title: (old ? "Ubah " : "Tambah ") + (type === "income" ? "pemasukan" : "pengeluaran") + " berulang",
      fields: [{ id: "amount", label: "Nominal (Rp)", money: 1, value: old ? numFmt(old.amount) : "" }, { id: "categoryId", label: "Kategori", options: d.categories.filter((c) => c.type === type).map((c) => [c.id, c.name]), value: old?.categoryId }, { id: "walletId", label: "Dompet", options: d.wallets.map((w) => [w.id, w.name]), value: old?.walletId }, { id: "frequency", label: "Frekuensi", options: FQ, value: old?.frequency || "monthly" }, { id: "start", label: "Tanggal mulai", type: "date", value: old?.start || todayStr() }, { id: "end", label: "Tanggal berakhir (opsional)", type: "date", value: old?.end || "" }, { id: "note", label: "Catatan (opsional)", value: old?.note || "" }],
      onSubmit: async (v) => {
        const e = {}, a = amt(v.amount);
        if (a.err) e.amount = a.err;
        if (!d.categories.some((c) => c.id === v.categoryId && c.type === type)) e.categoryId = "Pilih kategori.";
        if (!d.wallets.some((w) => w.id === v.walletId)) e.walletId = "Pilih dompet.";
        if (!validDate(v.start)) e.start = "Tanggal tidak valid.";
        if (v.end && (!validDate(v.end) || v.end < v.start)) e.end = "Harus setelah tanggal mulai.";
        if (bad2(e)) return e;
        await put("recurring", { id: old?.id || crypto.randomUUID(), userId: user.id, type, amount: a.n, categoryId: v.categoryId, walletId: v.walletId, frequency: v.frequency, start: v.start, end: v.end || "", note: (v.note || "").trim().slice(0, 200), active: old?.active ?? true, lastDate: old?.lastDate || "", createdAt: old?.createdAt || Date.now() });
      }
    }));
  }
  function bindRec(ctx) {
    const g = (id2) => ctx.d.recurring.find((r) => r.id === id2);
    document.querySelectorAll("[data-addr]").forEach((b) => b.onclick = () => recForm(ctx, b.dataset.addr));
    acts({
      addr: () => {
      },
      er: (id2) => recForm(ctx, g(id2).type, g(id2)),
      dr: (id2) => askDel("Hapus jadwal?", "Transaksi yang sudah dibuat tetap tersimpan.", () => del("recurring", id2, ctx.refresh)),
      tr: async (id2) => {
        const r = g(id2), on = !r.active;
        try {
          await put("recurring", { ...r, active: on, lastDate: on && r.lastDate < todayStr() ? todayStr() : r.lastDate });
          ctx.refresh();
        } catch {
          toast("Gagal menyimpan.", "error");
        }
      }
    });
  }
  var STORES = ["categories", "wallets", "transactions", "transfers", "budgets", "savingsGoals", "savingsContributions", "recurring", "reminders", "debts", "debtPayments"];
  var LBL = { categories: "kategori", wallets: "dompet", transactions: "transaksi", transfers: "transfer", budgets: "anggaran", savingsGoals: "target tabungan", savingsContributions: "setoran", recurring: "jadwal berulang", reminders: "pengingat", debts: "utang/piutang", debtPayments: "cicilan" };
  var REFS = { transactions: ["categoryId", "walletId"], transfers: ["fromId", "toId"], budgets: ["categoryId"], savingsContributions: ["goalId", "walletId"], recurring: ["categoryId", "walletId"], reminders: ["categoryId"], debtPayments: ["debtId"] };
  var NUM = ["amount", "limit", "target", "initial", "total"];
  function validate(p) {
    if (p?.app !== "chasify" || p.version !== 1 || !p.data || typeof p.data !== "object") return "Bukan file backup Chasify yang valid.";
    let n = 0;
    for (const s of STORES) {
      const a = p.data[s] ?? [];
      if (!Array.isArray(a)) return `Data "${s}" tidak valid.`;
      n += a.length;
      for (const r of a) {
        if (!r || typeof r !== "object" || typeof r.id !== "string") return `Ada baris tanpa ID pada "${s}".`;
        for (const k of NUM) if (k in r && !(Number.isSafeInteger(r[k]) && r[k] >= 0)) return `Nominal tidak valid pada "${s}".`;
        if ("date" in r && !validDate(r.date)) return `Tanggal tidak valid pada "${s}".`;
      }
    }
    return n > 1e5 ? "Backup terlalu besar." : null;
  }
  async function restore(uid, p, mode, d) {
    const own = /* @__PURE__ */ new Set(), foreign = /* @__PURE__ */ new Set(), map = {}, ops = [];
    for (const s of STORES) for (const r of await all(s)) (r.userId === uid ? own : foreign).add(r.id);
    if (mode === "replace") for (const s of STORES) for (const r of d[s]) ops.push(["del", s, r.id]);
    const skip = (id2) => mode === "merge" && own.has(id2);
    for (const s of STORES) for (const r of p.data[s] || []) if (!skip(r.id) && foreign.has(r.id)) map[r.id] = crypto.randomUUID();
    for (const s of STORES) for (const r of p.data[s] || []) {
      if (skip(r.id)) continue;
      const o = { ...r, id: map[r.id] || r.id, userId: uid };
      for (const k of REFS[s] || []) if (map[o[k]]) o[k] = map[o[k]];
      ops.push(["put", s, o]);
    }
    await batch(ops);
    return ops.filter((o) => o[0] === "put").length;
  }
  var cell = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  var csv = (h, rows) => "\uFEFF" + [h, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
  var dl = (name, text, type = "text/csv;charset=utf-8") => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
  };
  var data = (u) => `<section class="view-enter"><h1>Data &amp; Privasi</h1>
<div class="card"><h2>Profil</h2><p class="sub">${esc(u.name)}, @${esc(u.username)}, ${esc(u.email)}</p><div class="row" style="justify-content:flex-start"><button class="btn" id="pname"><i data-lucide="pencil"></i>Ubah nama</button></div></div>
<div class="card"><h2>Ekspor CSV</h2><p class="sub">Unduh data untuk dibuka di spreadsheet.</p><div class="row split"><button class="btn" id="csvT">Transaksi</button><button class="btn" id="csvC">Kategori</button></div></div>
<div class="card"><h2>Backup dan pulihkan</h2><p class="sub">File JSON berisi kategori, dompet, transaksi, transfer, anggaran, target tabungan, setoran, transaksi berulang, pengingat, utang, dan cicilan. Tidak termasuk kata sandi dan pengaturan tema. File tidak dienkripsi, simpan di tempat aman.</p><div class="row split"><button class="btn primary" id="bk"><i data-lucide="download"></i>Backup</button><button class="btn" id="rsb"><i data-lucide="upload"></i>Pulihkan</button></div><input id="rs" type="file" accept="application/json,.json" hidden></div>
<div class="card danger-zone"><h2>Privasi</h2><p class="sub">Semua data hanya tersimpan di browser perangkat ini dan tidak disinkronkan ke perangkat lain. Menghapus data situs browser akan menghapus semuanya, jadi buat backup berkala.</p><div class="row" style="justify-content:flex-start"><button class="btn danger" id="wipe">Hapus semua data keuangan</button></div><p class="note" style="margin-top:.6rem">Untuk menghapus akun, buka <a href="#/settings">Pengaturan</a>.</p></div></section>`;
  async function pickRestore(ctx, f) {
    if (f.size > 5 * 1024 * 1024) return toast("File terlalu besar (maks 5 MB).", "error");
    let p;
    try {
      p = JSON.parse(await f.text());
    } catch {
      return toast("File bukan JSON yang valid.", "error");
    }
    const er = validate(p);
    if (er) return toast(er, "error");
    const info = STORES.filter((s) => (p.data[s] || []).length).map((s) => `${p.data[s].length} ${LBL[s]}`).join(", ") || "tidak ada data";
    save(ctx, formSheet({
      title: "Pulihkan backup",
      submitText: "Pulihkan",
      fields: [{ id: "mode", label: "Isi file: " + info, options: [["merge", "Gabungkan dengan data sekarang"], ["replace", "Ganti seluruh data sekarang"]] }],
      onSubmit: async (v) => {
        if (v.mode === "replace" && !await confirmDialog({ title: "Ganti semua data?", body: "Data saat ini akan dihapus dan diganti isi backup." })) return { _: "Dibatalkan." };
        await restore(ctx.user.id, p, v.mode, ctx.d);
      }
    }));
  }
  function bindData(ctx) {
    const { user, d } = ctx;
    $("pname").onclick = () => save(ctx, formSheet({ title: "Ubah nama", fields: [{ id: "name", label: "Nama lengkap", value: user.name }], onSubmit: async (v) => {
      const n = (v.name || "").trim();
      if (!n || n.length > 60) return { name: "Nama 1 sampai 60 karakter." };
      await put("users", { ...await get("users", user.id), name: n });
    } }));
    $("csvT").onclick = () => {
      const cm = catMap(d), wm = walMap(d);
      dl("chasify-transaksi.csv", csv(["Tanggal", "Jenis", "Kategori", "Dompet", "Nominal (Rp)", "Catatan"], [...d.transactions].sort(sortTx).map((t) => [t.date, t.type === "income" ? "Pemasukan" : "Pengeluaran", cm[t.categoryId]?.name, wm[t.walletId]?.name, t.amount, t.note])));
    };
    $("csvC").onclick = () => dl("chasify-kategori.csv", csv(["Jenis", "Nama", "Ikon", "Warna"], d.categories.map((c) => [c.type === "income" ? "Pemasukan" : "Pengeluaran", c.name, c.icon, c.color])));
    $("bk").onclick = () => {
      const o = {};
      for (const s of STORES) o[s] = d[s];
      dl(`chasify-backup-${todayStr()}.json`, JSON.stringify({ app: "chasify", version: 1, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), data: o }, null, 1), "application/json");
      toast("Backup diunduh.", "success");
    };
    $("rsb").onclick = () => $("rs").click();
    $("rs").onchange = (e) => {
      const f = e.target.files[0];
      e.target.value = "";
      if (f) pickRestore(ctx, f);
    };
    $("wipe").onclick = () => askDel("Hapus semua data keuangan?", "Semua transaksi, dompet, anggaran, dan data lain di akun ini dihapus. Akun tetap ada. Buat backup dulu bila perlu.", async () => {
      try {
        const ops = [];
        for (const s of STORES) for (const r of d[s]) ops.push(["del", s, r.id]);
        ops.push(["del", "preferences", "seed:" + user.id]);
        await batch(ops);
        resetSeed(user.id);
        toast("Data dihapus.", "success");
        ctx.refresh();
      } catch {
        toast("Gagal menghapus data.", "error");
      }
    });
  }
  var A = { m: todayStr().slice(0, 7) };
  function analytics(u, d) {
    const s = summary(d, A.m), p = summary(d, shiftM2(A.m, -1)), ds = dailySeries(d, A.m), net = s.income - s.expense, rate = s.income ? Math.round(net / s.income * 100) : null, dl2 = (c, v) => v ? `${c >= v ? "Naik" : "Turun"} ${Math.abs(Math.round((c - v) / v * 100))}% dari bulan lalu` : "Belum ada pembanding";
    return `<section class="view-enter"><h1>Analitik</h1>${monthnav(A.m)}<div class="stats"><div class="stat"><small>Pemasukan</small><b>${rupiahC(s.income)}</b><small>${dl2(s.income, p.income)}</small></div><div class="stat"><small>Pengeluaran</small><b>${rupiahC(s.expense)}</b><small>${dl2(s.expense, p.expense)}</small></div><div class="stat"><small>Selisih arus kas</small><b>${rupiahC(net)}</b><small>Bulan lalu: ${rupiahC(p.income - p.expense)}</small></div><div class="stat"><small>Rasio tabungan</small><b>${rate === null ? "Belum ada" : rate + "%"}</b><small>Selisih \xF7 pemasukan</small></div></div>
<div class="grid2"><div class="card"><h2>Arus kas harian (kumulatif)</h2>${s.income || s.expense ? lineChart(ds.labels, [{ name: "Pemasukan", color: "var(--c-in)", values: ds.inc }, { name: "Pengeluaran", color: "var(--c-out)", values: ds.exp }]) : '<p class="sub">Belum ada transaksi bulan ini.</p>'}</div>
<div class="card"><h2>Perbandingan 6 bulan</h2>${barChart(monthSeries(d, A.m))}</div>
<div class="card wide"><h2>Pengeluaran per kategori</h2>${donut(catItems(d, s), s.expense)}</div></div></section>`;
  }
  function bindAn(ctx) {
    $("pm").onclick = () => {
      A.m = shiftM2(A.m, -1);
      ctx.refresh();
    };
    $("nm").onclick = () => {
      A.m = shiftM2(A.m, 1);
      ctx.refresh();
    };
  }
  var MORE = { analytics: { view: analytics, bind: bindAn }, reports: { view: reports, bind: bindR }, calendar: { view: calendar, bind: bindCal }, reminders: { view: reminders, bind: bindRem }, debts: { view: debts, bind: bindDebt }, recurring: { view: recurring, bind: bindRec }, data: { view: data, bind: bindData } };

  // js/components/bg.js
  function initBackground() {
    const c = document.createElement("canvas");
    c.id = "bg";
    c.setAttribute("aria-hidden", "true");
    document.body.prepend(c);
    const x = c.getContext?.("2d");
    if (!x) return;
    const rm = matchMedia("(prefers-reduced-motion: reduce)");
    let w = 0, h = 0, col = [37, 99, 235], P = [], B2 = [], m = { x: -999, y: -999 }, t0 = performance.now();
    const rgb = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(), r = /^#([0-9a-f]{6})$/i.exec(v);
      if (r) {
        const n = parseInt(r[1], 16);
        col = [n >> 16, n >> 8 & 255, n & 255];
      }
    };
    const size = () => {
      const d = Math.min(devicePixelRatio || 1, 2);
      w = innerWidth;
      h = innerHeight;
      c.width = w * d;
      c.height = h * d;
      x.setTransform(d, 0, 0, d, 0, 0);
      P = Array.from({ length: Math.round(Math.min(60, Math.max(22, w * h / 26e3))) }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35 }));
      B2 = Array.from({ length: 9 }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 18 + Math.random() * 60, vy: 0.15 + Math.random() * 0.35, ph: Math.random() * 6.28, a: 0.05 + Math.random() * 0.08 }));
    };
    function frame(t) {
      const dt = Math.min(32, t - t0) / 16;
      t0 = t;
      x.clearRect(0, 0, w, h);
      const [r, g, b] = col, k = document.documentElement.dataset.scheme === "dark" ? 1.5 : 1, D2 = Math.min(130, w / 3);
      for (const o of B2) {
        o.y -= o.vy * dt;
        o.ph += 0.01 * dt;
        o.x += Math.sin(o.ph) * 0.3 * dt;
        if (o.y < -o.r * 2) {
          o.y = h + o.r;
          o.x = Math.random() * w;
        }
        const gr = x.createRadialGradient(o.x - o.r / 3, o.y - o.r / 3, o.r * 0.1, o.x, o.y, o.r);
        gr.addColorStop(0, `rgba(${r},${g},${b},${o.a * k * 1.6})`);
        gr.addColorStop(1, `rgba(${r},${g},${b},${o.a * 0.3 * k})`);
        x.fillStyle = gr;
        x.beginPath();
        x.arc(o.x, o.y, o.r, 0, 6.283);
        x.fill();
        x.strokeStyle = `rgba(${r},${g},${b},${o.a * k * 1.8})`;
        x.lineWidth = 1;
        x.stroke();
      }
      for (const p of P) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      const line = (a, q, al) => {
        x.strokeStyle = `rgba(${r},${g},${b},${al * k})`;
        x.beginPath();
        x.moveTo(a.x, a.y);
        x.lineTo(q.x, q.y);
        x.stroke();
      };
      for (let i = 0; i < P.length; i++) {
        const a = P[i];
        for (let j = i + 1; j < P.length; j++) {
          const q = P[j], d = Math.hypot(a.x - q.x, a.y - q.y);
          if (d < D2) line(a, q, (1 - d / D2) * 0.22);
        }
        const dm = Math.hypot(a.x - m.x, a.y - m.y);
        if (dm < D2 * 1.3) line(a, m, (1 - dm / (D2 * 1.3)) * 0.35);
        x.fillStyle = `rgba(${r},${g},${b},${0.35 * k})`;
        x.beginPath();
        x.arc(a.x, a.y, 1.8, 0, 6.283);
        x.fill();
      }
      if (!rm.matches) requestAnimationFrame(frame);
    }
    let rt;
    addEventListener("resize", () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        size();
        if (rm.matches) frame(performance.now());
      }, 150);
    });
    addEventListener("pointermove", (e) => {
      m.x = e.clientX;
      m.y = e.clientY;
    });
    addEventListener("pointerleave", () => {
      m.x = m.y = -999;
    });
    setInterval(rgb, 1e3);
    rgb();
    size();
    requestAnimationFrame(frame);
  }

  // js/app.js
  Object.assign(VIEWS, MORE);
  var $2 = (s, r = document) => r.querySelector(s);
  var app = $2("#app");
  var esc2 = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  var icons2 = () => window.lucide?.createIcons();
  var go = (h) => {
    location.hash = "#/" + h;
  };
  var PUBLIC = ["welcome", "login", "register", "recovery"];
  var PAGES = { dashboard: ["Beranda", "home"], transactions: ["Transaksi", "arrow-left-right"], budgets: ["Anggaran", "chart-pie"], savings: ["Tabungan", "target"], wallets: ["Dompet", "landmark"], categories: ["Kategori", "tags"], analytics: ["Analitik", "chart-line"], reports: ["Laporan", "chart-column"], calendar: ["Kalender", "calendar"], reminders: ["Pengingat", "bell"], debts: ["Utang", "handshake"], recurring: ["Berulang", "repeat"], data: ["Data & Privasi", "shield-check"], more: ["Lainnya", "menu"], settings: ["Pengaturan", "settings"] };
  var MAIN = ["dashboard", "transactions", "budgets", "savings"];
  var SEC = ["analytics", "wallets", "categories", "reports", "calendar", "reminders", "debts", "recurring", "data", "settings"];
  var SIDE = [...MAIN, ...SEC];
  var BOTTOM = [...MAIN, "more"];
  var mark = '<span class="mark"><i data-lucide="wallet"></i></span>';
  var field = (id2, label, type = "text", x = "") => `<div class="field"><label for="${id2}">${label}</label><input id="${id2}" name="${id2}" type="${type}" ${x} aria-describedby="${id2}-err"><p class="err" id="${id2}-err" role="alert"></p></div>`;
  function showErrors(form, errors) {
    form.querySelectorAll(".err").forEach((p) => p.textContent = "");
    form.querySelectorAll("[aria-invalid]").forEach((i) => i.removeAttribute("aria-invalid"));
    for (const [k, m] of Object.entries(errors)) {
      const p = $2("#" + k + "-err", form);
      if (p) p.textContent = m;
      form.elements[k]?.setAttribute("aria-invalid", "true");
    }
    form.querySelector("[aria-invalid]")?.focus();
  }
  async function submit(form, fn) {
    const b = $2("button[type=submit]", form);
    b.disabled = true;
    b.classList.add("loading");
    try {
      await fn();
    } catch (e) {
      if (e.errors) showErrors(form, e.errors);
      else toast(e.message === "insecure" ? "Fitur keamanan butuh localhost atau HTTPS." : "Penyimpanan lokal gagal. Coba lagi.", "error");
    } finally {
      b.disabled = false;
      b.classList.remove("loading");
    }
  }
  var authPage = (t, s, body) => `<main class="auth view-enter"><div class="auth-card"><a class="brand" href="#/welcome">${mark}<span>Chasify</span></a><h1>${t}</h1><p class="sub">${s}</p>${body}</div></main>`;
  var publicViews = {
    welcome: () => authPage("Keuangan pribadi, lebih jelas.", "Catat, atur, dan pahami uang Anda dalam satu aplikasi.", `<div class="stack"><a class="btn primary" href="#/register">Buat akun</a><a class="btn" href="#/login">Masuk</a></div><p class="note">Akun dan data disimpan hanya di browser perangkat ini. Tidak ada sinkronisasi antarperangkat, dan keamanannya tidak setara layanan perbankan.</p>`),
    login: () => authPage("Masuk", "Gunakan username atau email Anda.", `<form novalidate>${field("identity", "Username atau email", "text", 'autocomplete="username"')}${field("password", "Kata sandi", "password", 'autocomplete="current-password"')}<button class="btn primary" type="submit">Masuk</button></form><div class="links"><a href="#/recovery">Lupa kata sandi?</a><a href="#/register">Buat akun</a></div>`),
    register: () => authPage("Buat akun", "Akun ini hanya berlaku di perangkat ini.", `<form novalidate>${field("name", "Nama lengkap", "text", 'autocomplete="name"')}${field("username", "Username", "text", 'autocomplete="username"')}${field("email", "Email", "email", 'autocomplete="email"')}${field("password", "Kata sandi", "password", 'autocomplete="new-password"')}${field("confirm", "Konfirmasi kata sandi", "password", 'autocomplete="new-password"')}<div class="check"><input type="checkbox" id="terms" name="terms" aria-describedby="terms-err"><label for="terms">Saya memahami data disimpan lokal di perangkat ini dan menyetujui kebijakan privasi.</label></div><p class="err" id="terms-err" role="alert"></p><button class="btn primary" type="submit">Daftar</button></form><div class="links"><span></span><a href="#/login">Sudah punya akun?</a></div>`),
    recovery: () => authPage("Pemulihan lokal", "Tanpa server, email pemulihan tidak dapat dikirim.", `<p>Kata sandi tidak dapat direset dari jarak jauh. Pilihan Anda: ingat kembali kata sandi, atau pulihkan data dari file backup JSON ke akun baru (fitur backup dan restore hadir di Tahap 3).</p><p class="note" style="margin-top:.75rem">Jika backup belum pernah dibuat, data pada akun yang terkunci tidak dapat dipulihkan.</p><div class="stack"><a class="btn" href="#/login">Kembali ke masuk</a></div>`)
  };
  function bindPublic(route) {
    const form = $2("form", app);
    if (!form) return;
    if (route === "login") form.onsubmit = (e) => {
      e.preventDefault();
      submit(form, async () => {
        await login(form.elements.identity.value, form.elements.password.value);
        go("dashboard");
      });
    };
    if (route === "register") form.onsubmit = (e) => {
      e.preventDefault();
      submit(form, async () => {
        const f = Object.fromEntries(new FormData(form));
        f.terms = form.elements.terms.checked;
        await register(f);
        toast("Akun berhasil dibuat.", "success");
        go("dashboard");
      });
    };
  }
  function settings() {
    const p = getPrefs();
    const mode = [["light", "Terang", "sun"], ["dark", "Gelap", "moon"], ["system", "Sistem", "monitor"]];
    return `<section class="view-enter"><h1>Pengaturan</h1><div class="card"><h2>Tema warna</h2><div class="themes" role="radiogroup" aria-label="Tema warna">${THEMES.map(([id2, n, c]) => `<button type="button" role="radio" class="swatch" data-theme-id="${id2}" aria-checked="${id2 === p.theme}"><span style="background:${c}"></span>${n}</button>`).join("")}</div><h2>Mode tampilan</h2><div class="seg" role="radiogroup" aria-label="Mode tampilan">${mode.map(([id2, n, i]) => `<button type="button" role="radio" data-mode-id="${id2}" aria-checked="${id2 === p.mode}"><i data-lucide="${i}"></i>${n}</button>`).join("")}</div><p class="note" style="margin-top:.5rem">Pilihan tampil sebagai pratinjau sampai Anda menekan Terapkan.</p><div class="row"><button id="cancel" class="btn ghost" disabled>Batal</button><button id="applyTheme" class="btn primary" disabled>Terapkan</button></div></div>
<div class="card"><h2>Penyimpanan lokal</h2><p class="sub">Data disimpan di IndexedDB browser ini. Tidak tersinkronisasi ke perangkat lain dan hilang jika data situs dihapus.</p></div>
<div class="card danger-zone"><h2>Hapus akun lokal</h2><p class="sub">Menghapus akun beserta seluruh datanya dari perangkat ini. Tindakan ini tidak dapat dibatalkan.</p><div class="row" style="justify-content:flex-start"><button id="delAcc" class="btn danger">Hapus akun dan data</button></div></div></section>`;
  }
  function bindSettings(user) {
    let d = { ...getPrefs() };
    const sync = () => {
      apply(d);
      const s = getPrefs(), dirty = d.theme !== s.theme || d.mode !== s.mode;
      app.querySelectorAll("[data-theme-id]").forEach((b) => b.setAttribute("aria-checked", b.dataset.themeId === d.theme));
      app.querySelectorAll("[data-mode-id]").forEach((b) => b.setAttribute("aria-checked", b.dataset.modeId === d.mode));
      $2("#cancel").disabled = $2("#applyTheme").disabled = !dirty;
    };
    app.querySelectorAll("[data-theme-id]").forEach((b) => b.onclick = () => {
      d.theme = b.dataset.themeId;
      sync();
    });
    app.querySelectorAll("[data-mode-id]").forEach((b) => b.onclick = () => {
      d.mode = b.dataset.modeId;
      sync();
    });
    $2("#applyTheme").onclick = () => {
      savePrefs({ theme: d.theme, mode: d.mode });
      sync();
      toast("Tema diterapkan.", "success");
    };
    $2("#cancel").onclick = () => {
      d = { ...getPrefs() };
      sync();
    };
    $2("#delAcc").onclick = async () => {
      if (!await confirmDialog({ title: "Hapus akun lokal?", body: "Akun dan semua data keuangan di perangkat ini akan dihapus permanen." })) return;
      try {
        await deleteAccount(user.id);
        toast("Akun dihapus.", "success");
        go("welcome");
      } catch {
        toast("Gagal menghapus akun.", "error");
      }
    };
  }
  var moreView = () => `<section class="view-enter"><h1>Lainnya</h1><div class="card"><ul class="list">${SEC.map((i) => `<li class="item"><a class="menu-link grow" href="#/${i}"><i data-lucide="${PAGES[i][1]}"></i>${PAGES[i][0]}<i data-lucide="chevron-right" class="chev"></i></a></li>`).join("")}</ul></div><button id="logout2" class="btn danger" style="width:100%;margin-top:1rem"><i data-lucide="log-out"></i>Keluar</button></section>`;
  function shell(route, user, inner) {
    const p = getPrefs(), back = MAIN.includes(route) || route === "more" ? "" : '<button id="back" class="btn icon-btn ghost" aria-label="Kembali ke halaman sebelumnya"><i data-lucide="arrow-left"></i></button>';
    const link = (id2, a) => `<a href="#/${id2}" class="${a ? "active" : ""}" ${a ? 'aria-current="page"' : ""}><i data-lucide="${PAGES[id2][1]}"></i><span>${PAGES[id2][0]}</span></a>`, nav = SIDE.map((i) => link(i, i === route)).join(""), bnav = BOTTOM.map((i) => link(i, i === route || i === "more" && SEC.includes(route))).join("");
    app.innerHTML = `<div class="shell ${p.collapsed ? "collapsed" : ""}"><aside class="sidebar"><a class="brand" href="#/dashboard">${mark}<span>Chasify</span></a><nav aria-label="Navigasi utama">${nav}</nav><button id="collapse" class="btn ghost" aria-label="Ciutkan sidebar" aria-pressed="${p.collapsed}"><i data-lucide="panel-left"></i><span>Ciutkan</span></button></aside>
<div class="main"><header class="top"><div class="topl">${back}<nav class="crumbs" aria-label="Breadcrumb">Chasify / <b>${PAGES[route][0]}</b></nav></div><div class="user"><span class="avatar" aria-hidden="true">${esc2(user.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase())}</span><span class="uname">${esc2(user.name)}</span><button id="logout" class="btn icon-btn" aria-label="Keluar"><i data-lucide="log-out"></i></button></div></header><main id="view" tabindex="-1">${inner}</main></div><nav class="bottom" aria-label="Navigasi bawah">${bnav}</nav></div>`;
    $2("#collapse").onclick = () => {
      const c = !getPrefs().collapsed;
      savePrefs({ collapsed: c });
      $2(".shell").classList.toggle("collapsed", c);
      $2("#collapse").setAttribute("aria-pressed", c);
    };
    $2("#logout").onclick = () => {
      logout();
      go("welcome");
    };
    $2("#back")?.addEventListener("click", () => navs ? history.back() : go("dashboard"));
  }
  var tok = 0;
  var navs = 0;
  async function render() {
    const my = ++tok, route = (location.hash.slice(2) || "welcome").split("?")[0];
    const user = await currentUser().catch(() => null);
    if (my !== tok) return;
    apply(getPrefs());
    if (!(route in PAGES || PUBLIC.includes(route))) return go(user ? "dashboard" : "welcome");
    if (user && PUBLIC.includes(route)) return go("dashboard");
    if (!user && route in PAGES) return go("login");
    if (user) {
      let inner, bind = () => {
      };
      if (route === "settings") {
        inner = settings();
        bind = () => bindSettings(user);
      } else if (route === "more") {
        inner = moreView();
        bind = () => {
          $2("#logout2").onclick = () => {
            logout();
            go("welcome");
          };
        };
      } else try {
        const d = await loadFor(user.id);
        if (my !== tok) return;
        const p = VIEWS[route];
        inner = p.view(user, d);
        bind = () => p.bind?.({ user, d, refresh: render });
      } catch {
        inner = '<p class="err" role="alert">Gagal membaca data lokal. Muat ulang halaman.</p>';
      }
      shell(route, user, inner);
      bind();
    } else {
      app.innerHTML = publicViews[route]();
      if (route !== "welcome") $2(".auth-card").insertAdjacentHTML("afterbegin", `<a class="back" href="#/${route === "recovery" ? "login" : "welcome"}"><i data-lucide="chevron-left"></i>Kembali</a>`);
      bindPublic(route);
    }
    icons2();
    if (user) motion(route);
  }
  initTheme();
  initCharts();
  initBackground();
  addEventListener("hashchange", () => {
    navs++;
    render();
  });
  render();
})();
