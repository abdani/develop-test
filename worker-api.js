
const KUNCI_DATA = 'data';
const KUNCI_PENGGUNA = 'pengguna';
const AWALAN_FOTO = 'img:';
const AWALAN_SESI = 'sesi:';
const AWALAN_RIWAYAT = 'riwayat:';
const AWALAN_AKTIVITAS = 'akt:';
const AWALAN_TITIK = 'titik:';
const KUNCI_CADANGAN = 'cadangan-lengkap';
const MAKS_FOTO = 5 * 1024 * 1024;
const MAKS_DATA = 3 * 1024 * 1024;
const DATA_KOSONG = '{"menus":[],"sosmed":[],"diperbarui":null}';
const SESI_DETIK = 12 * 3600;
const MAKS_GAGAL = 5;
const KUNCI_MS = 3600000;
const PANJANG_LOG = 50;
const MAKS_PENGGUNA = 50;
const AKTIVITAS_DETIK = 60 * 86400;
const TITIK_DETIK = 8 * 86400;
const WIB_MS = 7 * 3600000;

const namaFotoAman = n => /^\d{4}-\d{2}-\d{2}(-\d{13})?\.jpg$/.test(n);
const jpegUtuh = buf => {
  const b = new Uint8Array(buf), n = b.length;
  return n > 4 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF && b[n - 2] === 0xFF && b[n - 1] === 0xD9;
};
const usernameSah = u => /^[a-z0-9][a-z0-9._@-]{2,39}$/.test(u);
const kunciSah = k => typeof k === 'string' && /^[0-9a-f]{64}$/.test(k);
const rapikan = u => String(u ?? '').trim().toLowerCase();
const potong = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const iso = () => new Date().toISOString();

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
  'X-Content-Type-Options': 'nosniff'
};

const HEADER_JSON = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS };
const mentah = isi => new Response(isi, { headers: HEADER_JSON });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADER_JSON });
const isiJson = request => request.json().then(b => b || {}, () => ({}));

const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const acak = n => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async t => hex(await crypto.subtle.digest('SHA-256', enc.encode(t)));
function samaAman(a, b){
  const x = enc.encode(a), y = enc.encode(b);
  return x.byteLength === y.byteLength && crypto.subtle.timingSafeEqual(x, y);
}
const tokenValid = (request, env) =>
  !!env.WRITE_TOKEN && samaAman(request.headers.get('Authorization') || '', `Bearer ${env.WRITE_TOKEN}`);

const bacaJson = async (env, kunci, awal) => { const v = await env.MBG_KV.get(kunci); return v ? JSON.parse(v) : awal; };
const bacaPengguna = env => bacaJson(env, KUNCI_PENGGUNA, []);
const simpanPengguna = (env, daftar) => env.MBG_KV.put(KUNCI_PENGGUNA, JSON.stringify(daftar));
const bacaRiwayat = (env, id) => bacaJson(env, AWALAN_RIWAYAT + id, { gagal: 0, kunciSampai: 0, log: [] });
function catat(env, id, r, entri){
  r.log = [entri, ...(r.log || [])].slice(0, PANJANG_LOG);
  return env.MBG_KV.put(AWALAN_RIWAYAT + id, JSON.stringify(r));
}
const publik = p => ({ id: p.id, username: p.username, peran: p.peran, aktif: p.aktif });
const kunciSesi = async (id, rahasia) => `${AWALAN_SESI}${id}:${await sha256(rahasia)}`;

function asal(request){
  const cf = request.cf || {};
  const ua = request.headers.get('User-Agent') || '';
  const cari = daftar => (daftar.find(([pola]) => pola.test(ua)) || [])[1] || '';
  const peramban = cari([[/EdgA?\/|EdgiOS/, 'Edge'], [/OPR\/|Opera/, 'Opera'], [/SamsungBrowser/, 'Samsung Internet'],
    [/Firefox\/|FxiOS/, 'Firefox'], [/Chrome\/|CriOS/, 'Chrome'], [/Safari\//, 'Safari']]);
  const sistem = cari([[/Android/, 'Android'], [/iPhone|iPad|iPod/, 'iOS'], [/Windows/, 'Windows'],
    [/Macintosh|Mac OS X/, 'macOS'], [/CrOS/, 'ChromeOS'], [/Linux/, 'Linux']]);
  return {
    ip: request.headers.get('CF-Connecting-IP') || '',
    lokasi: [cf.city, cf.country].filter(Boolean).join(', '),
    perangkat: [peramban, sistem].filter(Boolean).join(' · ') || ua.slice(0, 40) || '-'
  };
}

const percobaan = new Map();
function terlaluSering(ip){
  const kini = Date.now();
  if(percobaan.size > 5000) percobaan.clear();
  const c = percobaan.get(ip);
  if(!c || kini - c.mulai > 600000){ percobaan.set(ip, { mulai: kini, n: 1 }); return false; }
  return ++c.n > 20;
}

async function masuk(request, env){
  const dari = asal(request);
  if(terlaluSering(dari.ip)) return json({ error: 'Terlalu banyak percobaan login dari jaringan ini. Tunggu 10 menit.' }, 429);
  const b = await isiJson(request);
  const username = rapikan(b.username);
  const salah = () => json({ error: 'Username atau password salah' }, 401);
  if(!usernameSah(username) || !kunciSah(b.kunci)) return salah();
  const p = (await bacaPengguna(env)).find(x => x.username === username);
  if(!p) return salah();
  const r = await bacaRiwayat(env, p.id);
  const kini = Date.now();
  if(r.kunciSampai > kini) return json({ error: 'Akun terkunci', kunciSampai: r.kunciSampai }, 423);
  const entri = { t: new Date(kini).toISOString(), ...dari };
  if(!samaAman(await sha256(p.garam + b.kunci), p.hash)){
    r.gagal = (r.gagal || 0) + 1;
    const terkunci = r.gagal >= MAKS_GAGAL;
    if(terkunci){ r.gagal = 0; r.kunciSampai = kini + KUNCI_MS; }
    await catat(env, p.id, r, { ...entri, h: terkunci ? 'kunci' : 'salah' });
    return terkunci ? json({ error: 'Akun terkunci', kunciSampai: r.kunciSampai }, 423) : salah();
  }
  if(!p.aktif) return json({ error: 'Akun ini dinonaktifkan. Hubungi Super Admin.' }, 403);
  r.gagal = 0;
  r.kunciSampai = 0;
  const rahasia = acak(24);
  const ks = await kunciSesi(p.id, rahasia);   // awaited before the writes start, so a failed write is never left unhandled
  await Promise.all([
    catat(env, p.id, r, { ...entri, h: 'masuk' }),
    env.MBG_KV.put(ks, '1', { expirationTtl: SESI_DETIK, metadata: { ver: p.ver, dibuat: kini, ...dari } })
  ]);
  return json({ token: `${p.id}.${rahasia}`, ...await tentangSaya(env, p) });
}
// Super Admin also learns when ALAT menu 1 last made a full backup (data + photos)
const tentangSaya = async (env, p) => ({ pengguna: publik(p), cadangan: p.peran === 'super' ? await env.MBG_KV.get(KUNCI_CADANGAN) : undefined });

async function semuaKunci(env, prefix){
  const nama = [];
  let cursor;
  do {
    const r = await env.MBG_KV.list({ prefix, cursor });
    r.keys.forEach(k => nama.push(k.name.slice(prefix.length)));
    cursor = r.list_complete ? null : r.cursor;
  } while (cursor);
  return nama;
}

async function sesiDari(request, env){
  const m = /^Bearer ([0-9a-f]{12})\.([0-9a-f]{48})$/.exec(request.headers.get('Authorization') || '');
  if(!m) return null;
  const kunci = await kunciSesi(m[1], m[2]);
  const [{ value, metadata }, daftar] = await Promise.all([env.MBG_KV.getWithMetadata(kunci), bacaPengguna(env)]);
  const p = daftar.find(x => x.id === m[1]);
  if(value === null || !metadata || !p || !p.aktif || p.ver !== metadata.ver
     || Date.now() - metadata.dibuat > SESI_DETIK * 1000) return null;
  return { ...p, kunciSesi: kunci, daftar };
}
async function siapa(request, env){
  if(tokenValid(request, env)) return { id: 'alat', username: 'ALAT-PEMULIHAN', peran: 'super', aktif: true, daftar: await bacaPengguna(env) };
  return sesiDari(request, env);
}

async function keluar(request, env, orang){
  if(!orang.kunciSesi) return json({ ok: true });
  const r = await bacaRiwayat(env, orang.id);
  await Promise.all([env.MBG_KV.delete(orang.kunciSesi), catat(env, orang.id, r, { t: iso(), h: 'keluar', ...asal(request) })]);
  return json({ ok: true });
}

async function aturPemilik(request, env){
  if(!tokenValid(request, env)) return json({ error: 'Tidak berwenang' }, 401);
  const b = await isiJson(request);
  const username = rapikan(b.username);
  if(!usernameSah(username) || !kunciSah(b.kunci)) return json({ error: 'Username atau kunci password tidak sah' }, 400);
  const daftar = await bacaPengguna(env);
  if(daftar.some(p => p.peran !== 'super' && p.username === username)) return json({ error: 'Username sudah dipakai admin lain' }, 409);
  const garam = acak(16), hash = await sha256(garam + b.kunci);
  let p = daftar.find(x => x.peran === 'super');
  if(p) Object.assign(p, { username, garam, hash, aktif: true, ver: p.ver + 1 });
  else daftar.unshift(p = { id: acak(6), username, peran: 'super', aktif: true, garam, hash, ver: 1, dibuat: iso() });
  const r = await bacaRiwayat(env, p.id);
  r.gagal = 0;
  r.kunciSampai = 0;
  await Promise.all([simpanPengguna(env, daftar), catat(env, p.id, r, { t: iso(), h: 'reset', oleh: 'ALAT-PEMULIHAN' })]);
  return json({ ok: true, pengguna: publik(p) });
}

async function riwayat(env, orang){
  const target = orang.peran === 'super' ? orang.daftar : orang.daftar.filter(p => p.id === orang.id);
  const semua = await Promise.all(target.map(async p => (await bacaRiwayat(env, p.id)).log.map(e => ({ ...e, u: p.username }))));
  return json(semua.flat().sort((a, b) => b.t.localeCompare(a.t)).slice(0, 300));
}

async function daftarPengguna(env, orang){
  const kini = Date.now();
  const r = await Promise.all(orang.daftar.map(p => bacaRiwayat(env, p.id)));
  return json(orang.daftar.map((p, i) => ({
    ...publik(p), dibuat: p.dibuat,
    kunciSampai: r[i].kunciSampai > kini ? r[i].kunciSampai : 0,
    terakhir: r[i].log.find(e => e.h === 'masuk') || null
  })));
}

async function tambahPengguna(request, env, orang){
  const b = await isiJson(request);
  const username = rapikan(b.username);
  if(!usernameSah(username)) return json({ error: 'Username 3-40 karakter: huruf kecil, angka, titik, @, _ atau -' }, 400);
  if(!kunciSah(b.kunci)) return json({ error: 'Kunci password tidak sah' }, 400);
  if(orang.daftar.some(p => p.username === username)) return json({ error: 'Username sudah dipakai' }, 409);
  if(orang.daftar.length >= MAKS_PENGGUNA) return json({ error: `Maksimal ${MAKS_PENGGUNA} pengguna` }, 400);
  const garam = acak(16);
  const p = { id: acak(6), username, peran: 'admin', aktif: true, garam, hash: await sha256(garam + b.kunci), ver: 1, dibuat: iso() };
  await simpanPengguna(env, [...orang.daftar, p]);
  return json({ pengguna: publik(p) }, 201);
}

async function ubahPengguna(request, env, orang, id){
  const p = orang.daftar.find(x => x.id === id);
  if(!p) return json({ error: 'Pengguna tidak ditemukan' }, 404);
  const b = await isiJson(request);
  if(b.username !== undefined){
    const u = rapikan(b.username);
    if(!usernameSah(u)) return json({ error: 'Username 3-40 karakter: huruf kecil, angka, titik, @, _ atau -' }, 400);
    if(orang.daftar.some(x => x !== p && x.username === u)) return json({ error: 'Username sudah dipakai' }, 409);
  }
  if(b.kunci !== undefined && !kunciSah(b.kunci)) return json({ error: 'Kunci password tidak sah' }, 400);
  if(p.id === orang.id && (b.kunci !== undefined || b.username !== undefined)
     && !(kunciSah(b.kunciLama) && samaAman(await sha256(p.garam + b.kunciLama), p.hash))){
    await env.MBG_KV.delete(orang.kunciSesi);
    return json({ error: 'Password lama salah', alasan: 'Password lama salah. Demi keamanan sesi diakhiri - silakan login lagi.' }, 401);
  }
  if(b.aktif === false && p.peran === 'super') return json({ error: 'Super Admin tidak bisa dinonaktifkan' }, 400);
  const r = await bacaRiwayat(env, p.id);
  let tulisRiwayat = false;
  if(b.username !== undefined) p.username = rapikan(b.username);
  if(b.kunci !== undefined){
    p.garam = acak(16);
    p.hash = await sha256(p.garam + b.kunci);
    p.ver++;
    r.gagal = 0;
    r.kunciSampai = 0;
    r.log = [{ t: iso(), h: 'reset', oleh: orang.username }, ...r.log].slice(0, PANJANG_LOG);
    tulisRiwayat = true;
  }
  if(typeof b.aktif === 'boolean'){
    if(p.aktif && !b.aktif) p.ver++;
    p.aktif = b.aktif;
  }
  if(b.bukaKunci && (r.kunciSampai || r.gagal)){
    r.gagal = 0;
    r.kunciSampai = 0;
    tulisRiwayat = true;
  }
  await Promise.all([simpanPengguna(env, orang.daftar), tulisRiwayat && env.MBG_KV.put(AWALAN_RIWAYAT + p.id, JSON.stringify(r))]);
  return json({ pengguna: publik(p), keluar: p.id === orang.id && b.kunci !== undefined });
}

async function daftarSesi(env, orang){
  const peta = new Map(orang.daftar.map(p => [p.id, p]));
  const { keys } = await env.MBG_KV.list({ prefix: AWALAN_SESI });
  const kini = Date.now();
  const calon = keys
    .map(k => ({ k, p: peta.get(k.name.split(':')[1]) }))
    .filter(({ k, p }) => p && p.aktif && k.metadata && k.metadata.ver === p.ver && kini - k.metadata.dibuat < SESI_DETIK * 1000);
  const masih = await Promise.all(calon.map(({ k }) => env.MBG_KV.get(k.name)));
  return json(calon.filter((_, i) => masih[i] !== null)
    .map(({ k, p }) => ({ ...k.metadata, id: k.name.slice(AWALAN_SESI.length), username: p.username, peran: p.peran, sesiIni: k.name === orang.kunciSesi }))
    .sort((a, b) => b.dibuat - a.dibuat));
}

async function paksaKeluar(env, orang, sid){
  const uid = sid.split(':')[0];
  const kunci = AWALAN_SESI + sid;
  if(kunci === orang.kunciSesi) return json({ error: 'Pakai Logout untuk sesi Anda sendiri' }, 400);
  if(!orang.daftar.some(p => p.id === uid)) return json({ error: 'Pengguna tidak ditemukan' }, 404);
  const r = await bacaRiwayat(env, uid);
  await Promise.all([env.MBG_KV.delete(kunci), catat(env, uid, r, { t: iso(), h: 'paksa', oleh: orang.username })]);
  return json({ ok: true });
}

const GIZI = [['kalori', 'Energi'], ['protein', 'Protein'], ['lemak', 'Lemak'], ['karbohidrat', 'Karbohidrat'], ['serat', 'Serat']];
const rincianMenu = (a, b) => [
  a.nama !== b.nama && `nama: ${potong(a.nama, 30)} → ${potong(b.nama, 30)}`,
  a.tanggal !== b.tanggal && `tanggal: ${a.tanggal || '-'} → ${b.tanggal || '-'}`,
  ...['besar', 'kecil'].flatMap(porsi => GIZI.map(([k, n]) => {
    const u = a.gizi?.[porsi]?.[k], v = b.gizi?.[porsi]?.[k];
    return u !== v && `${n} ${porsi}: ${u ?? '-'} → ${v ?? '-'}`;
  })),
  (a.gambar || '') !== (b.gambar || '') && (!b.gambar ? 'foto dihapus' : a.gambar ? 'foto diganti' : 'foto ditambah'),
  (a.deskripsi || '') !== (b.deskripsi || '') && 'deskripsi diubah'
].filter(Boolean);
const samaMenu = (a, b) => a.nama === b.nama && a.tanggal === b.tanggal && a.gambar === b.gambar && a.deskripsi === b.deskripsi
  && GIZI.every(([k]) => a.gizi?.besar?.[k] === b.gizi?.besar?.[k] && a.gizi?.kecil?.[k] === b.gizi?.kecil?.[k]);
const menuRingkas = m =>({ tg: m.tanggal || '', nm: potong(m.nama, 50) });
const kontakRingkas = s => ({ nm: potong(s.judul || s.platform, 40) });
const objek = x => x && typeof x === 'object';

function bandingkan(lama, baru){
  const hasil = [];
  const menuLama = new Map((lama.menus || []).filter(objek).map(m => [m.id, m]));
  const idBaru = new Set(baru.menus.filter(objek).map(m => m.id));
  for(const m of baru.menus.filter(objek)){
    const a = menuLama.get(m.id);
    if(!a){ hasil.push({ k: 'tambah', o: 'menu', ...menuRingkas(m) }); continue; }
    if(samaMenu(a, m)) continue;
    const x = rincianMenu(a, m);
    if(x.length) hasil.push({ k: 'ubah', o: 'menu', ...menuRingkas(m), x: potong(x.join('; '), 200) });
  }
  for(const m of menuLama.values()) if(!idBaru.has(m.id)) hasil.push({ k: 'hapus', o: 'menu', ...menuRingkas(m) });
  const kontakLama = new Map((lama.sosmed || []).filter(objek).map(s => [s.url, s]));
  const urlBaru = new Set(baru.sosmed.filter(objek).map(s => s.url));
  for(const s of baru.sosmed.filter(objek)){
    const a = kontakLama.get(s.url);
    if(!a) hasil.push({ k: 'tambah', o: 'kontak', ...kontakRingkas(s) });
    else if((a.judul || '') !== (s.judul || '')) hasil.push({ k: 'ubah', o: 'kontak', ...kontakRingkas(s), x: potong(`judul: ${a.judul || '-'} → ${s.judul || '-'}`, 200) });
  }
  for(const s of kontakLama.values()) if(!urlBaru.has(s.url)) hasil.push({ k: 'hapus', o: 'kontak', ...kontakRingkas(s) });
  return hasil;
}

async function catatAktivitas(env, orang, perubahan, dasar, versi, catatan){
  const meta = { t: versi, u: orang.username, p: orang.peran, d: dasar, n: perubahan.length, c: catatan, x: [] };
  for(const x of perubahan){
    meta.x.push(x);
    if(enc.encode(JSON.stringify(meta)).length > 1000){ meta.x.pop(); break; }
  }
  const urut = String(9e15 - Date.parse(versi)).padStart(16, '0');
  await env.MBG_KV.put(`${AWALAN_AKTIVITAS}${urut}:${acak(3)}`, '1', { expirationTtl: AKTIVITAS_DETIK, metadata: meta });
}

async function simpanTitik(env, lamaTeks, lama){
  const kunci = AWALAN_TITIK + new Date(Date.now() + WIB_MS).toISOString().slice(0, 10);
  if(await env.MBG_KV.get(kunci, 'arrayBuffer') !== null) return;
  await env.MBG_KV.put(kunci, lamaTeks, { expirationTtl: TITIK_DETIK,
    metadata: { menu: (lama.menus || []).length, kontak: (lama.sosmed || []).length, versi: lama.diperbarui || null } });
}

// ponytail: every save parses the whole dataset twice; about 10 ms CPU near 350 KB (~3 years). ALAT warns at 350 KB:
// delete the oldest year or move to Workers Paid. Per-year KV keys if neither is enough.
async function simpanData(request, env, orang){
  const teks = await request.text();
  if(teks.length > MAKS_DATA) return json({ error: 'Data terlalu besar (maks. 3 MB)' }, 413);
  let masuk = null;
  try{ masuk = JSON.parse(teks); }catch(e){}
  if(!masuk || !Array.isArray(masuk.menus) || !Array.isArray(masuk.sosmed)) {
    return json({ error: 'Format data tidak sesuai' }, 400);
  }
  const lamaTeks = await env.MBG_KV.get(KUNCI_DATA);
  const lama = JSON.parse(lamaTeks || DATA_KOSONG);
  const dasar = lama.diperbarui ?? null;
  if(masuk.dasar !== dasar) return json({ error: 'Data di server sudah diubah dari tempat lain' }, 409);
  const simpan = { menus: masuk.menus, sosmed: masuk.sosmed, diperbarui: iso() };
  try{
    await env.MBG_KV.put(KUNCI_DATA, JSON.stringify(simpan));
  }catch(e){
    return json({ error: 'Server sedang sibuk menyimpan perubahan lain. Coba lagi.' }, 503);
  }
  const perubahan = bandingkan(lama, simpan);
  const catatan = orang.peran === 'super' ? potong(masuk.catatan, 60) : '';
  await Promise.all([
    lamaTeks && simpanTitik(env, lamaTeks, lama),
    perubahan.length && catatAktivitas(env, orang, perubahan, dasar, simpan.diperbarui, catatan)
  ].map(t => Promise.resolve(t).catch(() => {})));
  return json({ ok: true, diperbarui: simpan.diperbarui });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (!env.MBG_KV) return json({ error: 'Binding MBG_KV belum dipasang di Worker ini' }, 500);
    // await is required: a bare `return handler()` lets rejections escape the catch (Cloudflare 1101, no CORS)
    try { return await layani(request, env); }
    catch (e) { return json({ error: 'Kesalahan server: ' + e.message }, 500); }
  }
};

async function layani(request, env){
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method;

  if (path === '/data' && method === 'GET') return mentah(await env.MBG_KV.get(KUNCI_DATA, 'arrayBuffer') ?? DATA_KOSONG);

  if (path.startsWith('/img/')) {
    const nama = path.slice('/img/'.length);
    if (!namaFotoAman(nama)) return json({ error: 'Nama berkas tidak sah' }, 400);
    const kunci = AWALAN_FOTO + nama;

    if (method === 'GET') {
      const data = await env.MBG_KV.get(kunci, { type: 'arrayBuffer', cacheTtl: 3600 });   // names are unique per upload, so an edge copy is safe
      if (!data) return new Response('Tidak ditemukan', { status: 404, headers: CORS });
      return new Response(data, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Security-Policy': "default-src 'none'; sandbox",
          ...CORS
        }
      });
    }
    if (method === 'PUT') {
      if (!await siapa(request, env)) return json({ error: 'Sesi berakhir. Silakan login lagi.' }, 401);
      const data = await request.arrayBuffer();
      if (data.byteLength === 0) return json({ error: 'Berkas kosong' }, 400);
      if (data.byteLength > MAKS_FOTO) return json({ error: 'Foto melebihi 5 MB' }, 413);
      if (!jpegUtuh(data)) return json({ error: 'Berkas bukan foto JPEG yang utuh' }, 415);
      if ((await env.MBG_KV.list({ prefix: kunci, limit: 1 })).keys.length) return json({ error: 'Nama foto sudah dipakai' }, 409);
      await env.MBG_KV.put(kunci, data);
      return json({ ok: true, nama });
    }
  }

  if (path === '/auth/masuk' && method === 'POST') return masuk(request, env);
  if (path === '/auth/pemilik' && method === 'POST') return aturPemilik(request, env);

  const orang = await siapa(request, env);
  if (!orang) return json({ error: 'Sesi berakhir. Silakan login lagi.' }, 401);

  if (path === '/data' && method === 'PUT') return simpanData(request, env, orang);
  if (path === '/auth/saya' && method === 'GET') return json(await tentangSaya(env, orang));

  // emergency key only (ALAT-PEMULIHAN): full-backup stamp and orphan-photo cleanup
  if (orang.id === 'alat') {
    if (path === '/cadangan' && method === 'POST') { await env.MBG_KV.put(KUNCI_CADANGAN, iso()); return json({ ok: true }); }
    if (path === '/img' && method === 'GET') return json(await semuaKunci(env, AWALAN_FOTO));
    if (path.startsWith('/img/') && method === 'DELETE') {   // name already validated by the /img/ block above
      await env.MBG_KV.delete(AWALAN_FOTO + path.slice('/img/'.length));
      return json({ ok: true });
    }
  }
  if (path === '/auth/keluar' && method === 'POST') return keluar(request, env, orang);
  if (path === '/riwayat' && method === 'GET') return riwayat(env, orang);

  if (orang.peran !== 'super') return json({ error: 'Khusus Super Admin' }, 403);

  if (path === '/pengguna' && method === 'GET') return daftarPengguna(env, orang);
  if (path === '/pengguna' && method === 'POST') return tambahPengguna(request, env, orang);
  const idPengguna = /^\/pengguna\/([0-9a-f]{12})$/.exec(path);
  if (idPengguna && method === 'PUT') return ubahPengguna(request, env, orang, idPengguna[1]);
  if (path === '/sesi' && method === 'GET') return daftarSesi(env, orang);
  const idSesi = /^\/sesi\/([0-9a-f]{12}:[0-9a-f]{64})$/.exec(path.replace(/%3A/gi, ':'));
  if (idSesi && method === 'DELETE') return paksaKeluar(env, orang, idSesi[1]);
  if (path === '/aktivitas' && method === 'GET') {
    const { keys } = await env.MBG_KV.list({ prefix: AWALAN_AKTIVITAS, limit: 30 });
    return json(keys.map(k => k.metadata).filter(Boolean));
  }
  if (path === '/titik' && method === 'GET') {
    const { keys } = await env.MBG_KV.list({ prefix: AWALAN_TITIK });
    return json(keys.map(k => ({ ...k.metadata, tanggal: k.name.slice(AWALAN_TITIK.length) }))
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal)));
  }
  const tglTitik = /^\/titik\/(\d{4}-\d{2}-\d{2})$/.exec(path);
  if (tglTitik && method === 'GET') {
    const isi = await env.MBG_KV.get(AWALAN_TITIK + tglTitik[1]);
    return isi ? mentah(isi) : json({ error: 'Titik pulih tidak ditemukan' }, 404);
  }

  return json({ error: 'Rute tidak dikenal' }, 404);
}
