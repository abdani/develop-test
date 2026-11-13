const GARAM_APP = 'nilaigizi-mbg-sppg-v1';
const PUTARAN = 250000;

async function kunciDari(password){
  const bahan = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name:'PBKDF2', salt: new TextEncoder().encode(GARAM_APP), iterations: PUTARAN, hash:'SHA-256' }, bahan, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const IKON_MATA = {
  buka:  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  tutup: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17.9 17.9A10.1 10.1 0 0 1 12 19C5 19 1 12 1 12a18.5 18.5 0 0 1 5.1-5.9M9.9 5.2A9.1 9.1 0 0 1 12 5c7 0 11 7 11 7a18.5 18.5 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="M1 1l22 22"/></svg>'
};
function aturMata(btn, tampil){
  btn.previousElementSibling.type = tampil ? 'text' : 'password';
  btn.innerHTML = tampil ? IKON_MATA.tutup : IKON_MATA.buka;
  btn.setAttribute('aria-pressed', tampil);
  btn.setAttribute('aria-label', tampil ? 'Sembunyikan password' : 'Tampilkan password');
  btn.title = btn.getAttribute('aria-label');
}
function lihatPassword(btn){
  const input = btn.previousElementSibling;
  aturMata(btn, input.type === 'password');
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}
const sembunyikanPassword = () => document.querySelectorAll('.pw-mata').forEach(b => aturMata(b, false));

let sesi = '';
let pengguna = null;
try{ sesi = sessionStorage.getItem('mbg_sesi') || ''; }catch(e){}
const superAdmin = () => pengguna?.peran === 'super';

async function tryLogin(){
  sembunyikanPassword();
  const username = $('loginUsername').value.trim().toLowerCase();
  const password = $('loginPassword').value;
  if(!username || !password) return tampilTeks('loginError', 'Isi username dan password.');
  if(!window.crypto?.subtle) return tampilTeks('loginError', 'Browser ini tidak mendukung pemeriksaan password (butuh https).');
  const tombol = $('loginBtn');
  tombol.disabled = true;
  tombol.textContent = 'Memeriksa...';
  try{
    const kunci = await kunciDari(password);
    const r = await fetch(`${API}/auth/masuk`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, kunci })
    });
    const d = await r.json().catch(() => ({}));
    if(!r.ok){
      return tampilTeks('loginError', r.status === 423 && d.kunciSampai
        ? `Akun terkunci sampai pukul ${jam(d.kunciSampai)} karena 5 kali salah password. Hubungi Super Admin untuk membukanya lebih cepat.`
        : d.error || `Server menjawab ${r.status}`);
    }
    sesi = d.token;
    try{ sessionStorage.setItem('mbg_sesi', sesi); }catch(e){}
    $('loginPassword').value = '';
    tampilTeks('loginError', '');
    terimaSaya(d);
    showApp();
  }catch(e){
    tampilTeks('loginError', 'Tidak bisa menghubungi server. Periksa internet lalu coba lagi.');
  }finally{
    tombol.disabled = false;
    tombol.textContent = 'Masuk';
  }
}
function terapkanPengguna(p){
  pengguna = p;
  document.body.classList.toggle('super', p.peran === 'super');
  $('akunNama').textContent = p.username;
  $('akunPeran').textContent = (p.peran === 'super' ? 'Super Admin' : 'Admin') + ' · SPPG Siringagung 3';
}
let sesiSelesai = false;
function sesiBerakhir(pesan){
  if(sesiSelesai) return;
  sesiSelesai = true;
  try{
    sessionStorage.removeItem('mbg_sesi');
    sessionStorage.setItem('mbg_pesan_login', pesan || 'Sesi Anda berakhir (lewat 12 jam, dikeluarkan Super Admin, atau password diganti). Silakan login lagi.');
  }catch(e){}
  location.reload();
}
async function api(jalur, { method = 'GET', body } = {}){
  const r = await fetch(API + jalur, {
    method, cache: 'no-store',
    headers: { 'Authorization': `Bearer ${sesi}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  if(r.status === 401) sesiBerakhir((await r.clone().json().catch(() => ({}))).alasan);
  return wajibOk(r, 'Server menjawab');
}
const cekSesi = () => api('/auth/saya').then(terimaSaya).catch(() => {});

const IKON_DLG = { tanya: '?', bahaya: '!', info: 'i', ok: '✓' };
let dlgSibuk = false;
function tanya({ judul, pesan = '', ya = 'OK', tidak = 'Batal', jenis = 'tanya', ketik = null, isian = null }){
  const d = $('dlg');
  // still showing: never stack a second dialog. Just closed but its close event is still queued: wait for it, then open
  if(dlgSibuk) return d.open ? Promise.resolve(false)
    : new Promise(r => d.addEventListener('close', r, { once: true })).then(() => tanya(arguments[0]));
  dlgSibuk = true;
  d.className = 'dlg ' + jenis;
  $('dlgIkon').textContent = IKON_DLG[jenis];
  $('dlgJudul').textContent = judul;
  $('dlgPesan').textContent = pesan;
  $('dlgYa').textContent = ya;
  $('dlgYa').className = 'btn' + (jenis === 'bahaya' ? ' danger' : '');
  $('dlgTidak').textContent = tidak || '';
  $('dlgTidak').hidden = !tidak;
  const kolom = $('dlgKetik');
  kolom.hidden = $('dlgKetikLabel').hidden = !(ketik || isian);
  kolom.type = isian?.tipe || 'text';
  kolom.value = isian?.nilai || '';
  kolom.setAttribute('autocapitalize', ketik ? 'characters' : 'none');
  kolom.setAttribute('autocomplete', isian?.tipe === 'password' ? 'new-password' : 'off');
  $('dlgKetikLabel').textContent = ketik ? `Ketik ${ketik} untuk melanjutkan` : isian ? isian.label : '';
  tampilTeks('dlgGalat', '');
  const galat = () => ketik ? (kolom.value.trim().toUpperCase() === ketik ? '' : ' ') : isian ? isian.cek(kolom.value) : '';
  $('dlgYa').disabled = !!galat();
  kolom.oninput = () => {
    const g = galat();
    $('dlgYa').disabled = !!g;
    tampilTeks('dlgGalat', isian && kolom.value ? g : '');
  };
  kolom.onkeydown = e => {
    if(e.key !== 'Enter') return;
    e.preventDefault();
    if(!$('dlgYa').disabled) d.close('ya');
  };
  d.returnValue = '';
  d.showModal();
  (ketik || isian ? kolom : jenis === 'bahaya' && tidak ? $('dlgTidak') : $('dlgYa')).focus();
  return new Promise(res => d.addEventListener('close', () => {
    dlgSibuk = false;
    const setuju = d.returnValue === 'ya';
    const nilai = kolom.value;
    kolom.value = '';
    kolom.type = 'text';
    res(setuju && isian ? nilai : setuju);
  }, { once: true }));
}
const beritahu = (judul, pesan, jenis = 'info') => tanya({ judul, pesan, jenis, ya: 'Mengerti', tidak: null });

async function logout(){
  if(!await tanya({ judul: 'Logout dari admin?', pesan: 'Kembali ke layar login.', ya: 'Logout' })) return;
  await fetch(`${API}/auth/keluar`, { method: 'POST', headers: { 'Authorization': `Bearer ${sesi}` }, keepalive: true }).catch(() => {});
  try{ sessionStorage.removeItem('mbg_sesi'); }catch(e){}
  location.reload();
}

// full backup = ALAT-PEMULIHAN menu 1 (data + photos), stamped on the server; only sent to Super Admin
let cadanganLengkap = null;
const hariCadangan = () => cadanganLengkap ? Math.floor((Date.now() - Date.parse(cadanganLengkap)) / 864e5) : null;
function terimaSaya(d){
  terapkanPengguna(d.pengguna);
  cadanganLengkap = d.cadangan || null;
  const h = hariCadangan();
  tampilTeks('cadanganNotice', superAdmin() && (h === null || h > 30)
    ? `Cadangan lengkap (data + foto) ${h === null ? 'belum pernah dibuat' : `terakhir ${h} hari lalu`}. Jalankan ALAT-PEMULIHAN.bat menu 1 di komputer pengelola, lalu salin folder cadangan ke flashdisk & Drive.` : '');
}
function isiInfoAkun(){
  const hari = hariCadangan();
  $('infoStatus').textContent = versiServer === undefined ? 'Mode cadangan - simpan dikunci' : 'Tersinkron';
  $('infoStatus').classList.toggle('telat', versiServer === undefined);
  $('infoMenu').textContent = menuData.length;
  $('infoWaktu').textContent = versiServer
    ? new Date(versiServer).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
  $('infoCadangan').textContent = hari === null ? 'belum pernah'
    : hari === 0 ? 'hari ini' : `${hari} hari lalu`;
  $('infoCadangan').classList.toggle('telat', hari === null || hari > 30);
}
function showApp(){
  document.documentElement.classList.remove('masuk');
  $('loginScreen').style.display = 'none';
  $('appScreen').style.display = 'block';
  muatDariServer();
  muatAktivitas();
}

let menuData = [];
let sosmedData = [];
let editingId = null;
let versiServer;

function status(pesan, jenis){
  $('statusBar').className = 'notice' + (jenis === 'bahaya' ? ' bahaya' : '');
  tampilTeks('statusBar', pesan);
}

async function muatDariServer(){
  status('Memuat data dari server...');
  try{
    const d = await ambilDariServer();
    menuData = d.menus;
    sosmedData = d.sosmed;
    versiServer = d.diperbarui;
    if(!menuData.length && d.diperbarui === null && publishedMenus().length){
      menuData = publishedMenus();
      sosmedData = publishedSosmed();
      status('Server masih kosong. Data dari cadangan data.js dimuat - klik Simpan pada salah satu menu untuk mengirimkannya.', 'bahaya');
    } else {
      status(d.diperbarui ? 'Tersinkron. Terakhir diperbarui ' + new Date(d.diperbarui).toLocaleString('id-ID') : 'Tersinkron.');
    }
  }catch(e){
    menuData = publishedMenus();
    sosmedData = publishedSosmed();
    versiServer = undefined;
    status('Server tidak terjangkau: ' + e.message + '. Menampilkan cadangan - penyimpanan dikunci sampai server pulih, klik Muat Ulang.', 'bahaya');
  }
  ingatDataServer();
  refresh();
}

let dataServer = '';
const ingatDataServer = () => { dataServer = JSON.stringify({ menuData, sosmedData }); };
function kembalikanDataServer(){
  if(!dataServer) return;
  ({ menuData, sosmedData } = JSON.parse(dataServer));
  refresh();
}

async function simpan(ubah, pesanSukses, { ulang = true, catatan } = {}){
  const galat = ubah();
  if(galat){
    kembalikanDataServer();
    status(galat, 'bahaya');
    return false;
  }
  status('Menyimpan...');
  try{
    const r = await simpanKeServer(menuData, sosmedData, sesi, versiServer, catatan);
    versiServer = r.diperbarui;
    ingatDataServer();
    status(pesanSukses + ' Tersimpan ' + new Date(r.diperbarui).toLocaleTimeString('id-ID'));
    return true;
  }catch(e){
    if(e.status === 401){ sesiBerakhir(); return false; }
    if(e.status === 409){
      await muatDariServer();
      if(versiServer === undefined) return false;
      if(ulang){
        status('Ada perubahan dari pengguna lain - menggabungkan dengan perubahan Anda...');
        return simpan(ubah, pesanSukses, { ulang: false, catatan });
      }
      status('TIDAK tersimpan: data di server sudah diubah dari perangkat/tab lain. '
        + 'Data terbaru sudah dimuat - ulangi perubahan Anda.', 'bahaya');
      return false;
    }
    kembalikanDataServer();
    if(e.status === 503 && ulang){
      await new Promise(r => setTimeout(r, 1100));
      return simpan(ubah, pesanSukses, { ulang: false, catatan });
    }
    status('GAGAL menyimpan: ' + e.message + '. Tidak ada yang berubah di server - tampilan dikembalikan ke data server, silakan ulangi.', 'bahaya');
    return false;
  }
}

function exportData(){
  const content = 'const MENU_DATA = ' + JSON.stringify(untukPublikasi(menuData), null, 2) + ';\n\n'
                + 'const SOSMED_DATA = ' + JSON.stringify(sosmedData, null, 2) + ';\n';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], {type:'text/javascript'}));
  a.download = 'data.js';
  a.click();
  URL.revokeObjectURL(a.href);
  beritahu('Cadangan data.js terunduh', `${menuData.length} menu dan ${sosmedData.length} kontak tersimpan di berkas data.js.\n\n`
    + 'Simpan berkas ini. Foto tidak ikut - untuk cadangan lengkap (data + foto) pakai ALAT-PEMULIHAN.bat menu 1.', 'ok');
}
async function gantiSemuaData(m, s, sumber, pesanSukses, catatan){
  if(!await tanya({ jenis: 'bahaya', judul: 'Ganti data server dengan ' + sumber + '?',
    pesan: `${sumber[0].toUpperCase() + sumber.slice(1)}: ${m.length} menu, ${s.length} kontak.\n`
         + `Data di server sekarang: ${menuData.length} menu, ${sosmedData.length} kontak - akan DIGANTI seluruhnya.`,
    ya: 'Ganti data', ketik: m.length < menuData.length ? 'GANTI' : null })) return;
  await simpan(() => { menuData = m; sosmedData = s; return ''; }, pesanSukses, { catatan });
  refresh();
}
async function importData(file){
  $('importFile').value = '';
  if(!file) return;
  let menu, kontak;
  try{
    const teks = await file.text();
    menu = ambilArray(teks, 'MENU_DATA');
    kontak = ambilArray(teks, 'SOSMED_DATA') || [];
  }catch(e){ return beritahu('Isi berkas rusak', 'Berkas ini tidak bisa dibaca: ' + e.message); }
  if(menu === null) return beritahu('Format berkas tidak dikenali',
    'Pilih berkas data.js hasil tombol Cadangkan, atau cadangan\\data-TANGGAL.js dari ALAT-PEMULIHAN.');
  const m = normalizeList(menu), s = normalizeSosmed(kontak);
  await gantiSemuaData(m, s, `berkas "${file.name}"`, `Data dipulihkan dari cadangan (${m.length} menu).`, 'Pulihkan dari ' + file.name);
}

const PER_HALAMAN = 30;
let jumlahTampil = PER_HALAMAN;
let menuUrut = [];
let hasilFilter = [];
let dipilih = new Set();

function render(){
  const q = kataCari($('search'));
  const bulan = $('filterBulan').value;
  const semua = menuUrut.filter(m => cocokCari(m, q) && cocokBulan(m, bulan));
  hasilFilter = semua;
  const adaDiFilter = new Set(semua.map(m => m.id));
  dipilih = new Set([...dipilih].filter(id => adaDiFilter.has(id)));
  const rows = semua.slice(0, jumlahTampil);
  const tersisa = semua.length - rows.length;
  $('btnLagi').style.display = tersisa > 0 ? 'inline-block' : 'none';
  $('btnLagi').textContent = `Muat lebih banyak (${tersisa} menu lagi)`;
  $('menuBody').innerHTML = rows.map(m => `
    <tr${dipilih.has(m.id) ? ' class="terpilih"' : ''}>
      <td class="kol-cek"><input type="checkbox" name="pilih" value="${angka(m.id)}" aria-label="Pilih ${esc(m.nama)}"${dipilih.has(m.id) ? ' checked' : ''} data-ubah="pilih"></td>
      <td>${fotoMenu(m, 'loading="lazy" decoding="async" class="foto-kecil"')}</td>
      <td>${m.tanggal ? `<span class="tgl-panjang">${esc(formatTanggal(m.tanggal))}</span><span class="tgl-pendek">${esc(tanggalPendek(m.tanggal))}</span>` : '<span class="none">Belum diisi</span>'}</td>
      <td>${esc(m.nama)}</td>
      <td>${angka(m.gizi.besar.kalori)} / ${angka(m.gizi.kecil.kalori)}</td>
      <td>
        <button class="btn ghost small" data-klik="edit" data-arg="${angka(m.id)}">Edit</button>
        <button class="btn danger small" data-klik="hapus" data-arg="${angka(m.id)}">Hapus</button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="6" class="none">${menuUrut.length ? 'Tidak ada menu yang cocok dengan pencarian/filter.' : 'Belum ada menu.'}</td></tr>`;
  perbaruiPilihan();
}
function perbaruiPilihan(){
  const n = dipilih.size, total = hasilFilter.length;
  const cek = $('cekSemua');
  cek.checked = n > 0 && n === total;
  cek.indeterminate = n > 0 && n < total;
  cek.disabled = !total;
  $('pilihBar').hidden = !n;
  if(!n) return;
  const terlihat = Math.min(total, jumlahTampil);
  const tersembunyi = n - hasilFilter.slice(0, terlihat).filter(m => dipilih.has(m.id)).length;
  const filter = $('filterBulan').value || $('search').value.trim();
  $('pilihInfo').textContent = `${n} menu dipilih`
    + (n === total && filter ? ' (semua hasil filter)' : n === menuUrut.length ? ' (SEMUA menu)' : '')
    + (tersembunyi ? ` - ${tersembunyi} belum tampil di tabel` : '');
}
function pilih(id, kotak){
  kotak.checked ? dipilih.add(id) : dipilih.delete(id);
  kotak.closest('tr').classList.toggle('terpilih', kotak.checked);
  perbaruiPilihan();
}
function pilihSemua(ya){
  dipilih = ya ? new Set(hasilFilter.map(m => m.id)) : new Set();
  render();
}
function batalPilih(){
  dipilih.clear();
  render();
}

async function hapusMenu(ids){
  const buang = new Set(ids);
  const target = urutTerbaru(menuData.filter(m => buang.has(m.id)));
  const n = target.length;
  if(!n) return;
  const semua = n === menuData.length;
  const daftar = target.slice(0, 5).map(m => `• ${m.tanggal ? formatTanggal(m.tanggal) : 'Tanpa tanggal'} - ${m.nama}`).join('\n')
               + (n > 5 ? `\n… dan ${n - 5} menu lainnya` : '');
  if(!await tanya({ jenis: 'bahaya',
    judul: semua && n > 1 ? `Hapus SEMUA ${n} menu?` : n === 1 ? 'Hapus menu ini?' : `Hapus ${n} menu?`,
    pesan: daftar + '\n\nLangsung hilang dari situs publik dan tidak bisa dibatalkan.'
         + (n > 1 && superAdmin() ? ' Sebaiknya cadangkan dulu (tombol Cadangkan).' : ''),
    ya: n === 1 ? 'Hapus' : `Hapus ${n} menu`, ketik: semua && n > 1 ? 'HAPUS' : null })) return;
  const hapus = new Set(target.map(m => m.id));
  await simpan(() => { menuData = menuData.filter(m => !hapus.has(m.id)); return ''; },
    n === 1 ? 'Menu dihapus.' : `${n} menu dihapus.`);
  refresh();
}
function renderDariAwal(){
  jumlahTampil = PER_HALAMAN;
  render();
}
function refresh(){
  menuUrut = urutTerbaru(menuData);
  isiPilihanBulan($('filterBulan'), menuData);
  peringatkanTanggalGanda();
  render();
  renderSosmed();
}
function peringatkanTanggalGanda(){
  const ganda = tanggalGanda(menuData);
  tampilTeks('gandaNotice', ganda.length ? `Tanggal dobel terdeteksi: ${ganda.map(formatTanggal).join(', ')}. Satu tanggal hanya boleh dipakai satu menu.` : '');
}

function renderSosmed(){
  $('sosList').innerHTML = sosmedData.map((s, i) => `
    <div class="sosmed-item">
      ${ikonSosmed(s.platform)}
      <input type="text" name="judulSosmed" maxlength="40" value="${esc(judulSosmed(s))}"
             aria-label="Judul tautan" data-ubah="judulSosmed" data-arg="${angka(i)}">
      <span class="url" title="${esc(s.url)}">${esc(s.url)}</span>
      <button class="btn danger small" data-klik="sosHapus" data-arg="${angka(i)}">Hapus</button>
    </div>
  `).join('') || '<p class="none rapat">Belum ada tautan.</p>';
  $('sosInfo').textContent = `${sosmedData.length} dari maksimal ${MAX_SOSMED} tautan.`;
}
async function ubahJudulSosmed(i, nilai){
  const url = sosmedData[i]?.url;
  if(!url) return;
  await simpan(() => {
    const s = sosmedData.find(x => x.url === url);
    if(!s) return 'TIDAK tersimpan: kontak ini baru saja dihapus pengguna lain.';
    s.judul = judulSosmed({ platform: s.platform, judul: nilai });
    return '';
  }, 'Judul kontak diperbarui.');
  renderSosmed();
}
async function tambahSosmed(){
  const platform = $('sosPlatform').value;
  const isian = $('sosUrl').value.trim();
  const url = platform === 'whatsapp' ? waLink(isian) : urlAman(isian);

  let pesan = '';
  if(sosmedData.length >= MAX_SOSMED) pesan = `Maksimal ${MAX_SOSMED} tautan. Hapus salah satu dulu.`;
  else if(!isian) pesan = 'Tautan wajib diisi.';
  else if(!url) pesan = platform === 'whatsapp'
    ? 'Isi nomor WhatsApp (mis. 081234567890) atau tautan https://.'
    : 'Tautan harus diawali http:// atau https://';
  else if(sosmedData.some(s => s.url === url)) pesan = 'Tautan ini sudah ada.';

  tampilTeks('err-sos', pesan);
  if(pesan) return;

  const baru = { platform, judul: judulSosmed({ platform, judul: $('sosJudul').value }), url };
  const ok = await simpan(() => {
    if(sosmedData.some(s => s.url === url)) return 'TIDAK tersimpan: tautan ini baru saja ditambahkan pengguna lain.';
    if(sosmedData.length >= MAX_SOSMED) return `TIDAK tersimpan: sudah ${MAX_SOSMED} tautan (pengguna lain baru menambah). Hapus salah satu dulu.`;
    sosmedData.push(baru);
    return '';
  }, 'Kontak ditambahkan.');
  if(ok){
    $('sosUrl').value = '';
    $('sosJudul').value = '';
  }
  renderSosmed();
}
async function hapusSosmed(i){
  const s = sosmedData[i];
  if(!s) return;
  if(!await tanya({ jenis: 'bahaya', judul: `Hapus kontak "${judulSosmed(s)}"?`, pesan: s.url + '\n\nLangsung hilang dari situs publik.', ya: 'Hapus' })) return;
  await simpan(() => { sosmedData = sosmedData.filter(x => x.url !== s.url); return ''; }, 'Kontak dihapus.');
  renderSosmed();
}

const fieldId = (porsi, key) => `f${porsi}${key.charAt(0).toUpperCase()}${key.slice(1)}`;

// Cells are emitted column by column and the CSS grid lays them out as rows, so Tab and Android's "Next" walk down each portion natively
function buildGiziRows(){
  const nama = key => {
    const { kode, label, unit } = GIZI_LABELS[key];
    return `<span><strong>${kode}</strong> ${label} <span class="none">(${unit})</span>${GIZI_WAJIB.includes(key) ? ' <span class="wajib">*</span>' : ''}</span>`;
  };
  const input = porsi => key => {
    const { label, unit } = GIZI_LABELS[key];
    return `<input type="text" inputmode="decimal" autocomplete="off" class="mini-input" id="${fieldId(porsi,key)}" aria-label="${label} porsi ${porsi.toLowerCase()} (${unit})">`;
  };
  $('giziRows').innerHTML = [['Zat Gizi', nama], ['Besar', input('Besar')], ['Kecil', input('Kecil')]]
    .flatMap(([judul, isi]) => [`<div class="kepala">${judul}</div>`, ...GIZI_FIELDS.map(key => `<div>${isi(key)}</div>`)]).join('');
}
function fillGizi(porsi, g){
  GIZI_FIELDS.forEach(key => {
    const el = $(fieldId(porsi,key));
    el.value = g[key] || '';
    el.removeAttribute('aria-invalid');
  });
}
const readGizi = porsi => Object.fromEntries(GIZI_FIELDS.map(key => [key, Number(bacaGizi($(fieldId(porsi,key)).value)) || 0]));
function cekIsianGizi(){
  const kurang = [], salah = [];
  ['Besar','Kecil'].forEach(porsi => GIZI_FIELDS.forEach(key => {
    const el = $(fieldId(porsi,key)), v = bacaGizi(el.value);
    const daftar = Number.isNaN(v) ? salah : GIZI_WAJIB.includes(key) && !(v > 0) ? kurang : null;
    if(daftar) daftar.push(`${GIZI_LABELS[key].label} ${porsi.toLowerCase()}`);
    el.setAttribute('aria-invalid', !!daftar);
  }));
  return [kurang.length && `Belum diisi (harus lebih dari 0): ${kurang.join(', ')}.`,
          salah.length && `Bukan angka: ${salah.join(', ')}.`].filter(Boolean).join(' ');
}

function cekKonsistensiGizi(){
  const makro = ['Besar','Kecil'].map(porsi => ({ porsi, g: readGizi(porsi) }));
  tampilTeks('giziHitung', makro.some(x => makroLengkap(x.g))
    ? 'Energi dari makro: ' + makro.map(x => `${x.porsi} ${makroLengkap(x.g) ? Math.round(kaloriDariMakro(x.g) * 10) / 10 + ' kkal' : 'belum lengkap'}`).join(' · ') : '');
  const pesan = ['Besar','Kecil']
    .map(porsi => ({ porsi, keluhan: periksaKalori(readGizi(porsi)) }))
    .filter(x => x.keluhan)
    .map(x => `Porsi ${x.porsi}: ${x.keluhan}.`);
  tampilTeks('giziWarning', pesan.length ? `Periksa lagi - angkanya tidak cocok. ${pesan.join(' ')} Sering terjadi karena kolom Lemak dan Karbohidrat tertukar.` : '');
}
function pesanErrorTanggal(){
  const t = $('fTanggal').value;
  if(!t) return 'Tanggal menu wajib diisi';
  if(tanggalDipakai(menuData, t, editingId))
    return `Tanggal ${formatTanggal(t)} sudah dipakai menu lain - satu tanggal hanya boleh satu menu.`;
  return '';
}
const tampilkanErrorTanggal = pesan => tampilTeks('err-fTanggal', pesan);
function setHariIni(){
  $('fTanggal').value = hariIni();
  tampilkanErrorTanggal(pesanErrorTanggal());
}

const MAX_IMG_WIDTH = 800;
const TANDA_FOTO = [[0xFF, 0xD8, 0xFF], [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]];
let fotoBaru = null;
function aturPratinjau(src){
  const p = $('fGambarPreview');
  if(p.src.startsWith('blob:')) URL.revokeObjectURL(p.src);
  p.src = src;
  p.style.display = src ? 'block' : 'none';
  $('fGambarTeks').textContent = src ? 'Ganti foto' : 'Pilih foto';
}
function tolakFoto(){
  $('fGambar').value = '';
  fotoBaru = null;
  aturPratinjau(gambarSrc({ gambar: $('fGambar').dataset.path }));
  beritahu('Foto tidak bisa dipakai', 'Pilih foto berformat JPG, JPEG, atau PNG.');
}
async function previewImage(file){
  if(!file) return;
  const masihDipilih = () => $('fGambar').files[0] === file;
  const awal = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if(!masihDipilih()) return;
  if(!TANDA_FOTO.some(t => t.every((x, i) => awal[i] === x))) return tolakFoto();
  const img = new Image(), sumber = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(sumber);
    if(!masihDipilih()) return;
    const scale = Math.min(1, MAX_IMG_WIDTH / img.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if(!masihDipilih()) return;
      if(!blob) return tolakFoto();
      fotoBaru = blob;
      aturPratinjau(URL.createObjectURL(blob));
    }, 'image/jpeg', 0.8);
  };
  img.onerror = () => { URL.revokeObjectURL(sumber); if(masihDipilih()) tolakFoto(); };
  img.src = sumber;
}

function openModal(id){
  const m = id ? menuData.find(x => x.id === id)
              : {nama:'', tanggal:'', gambar:'', deskripsi:'', gizi:{besar:emptyPorsi(), kecil:emptyPorsi()}};
  if(!m) return beritahu('Menu tidak ditemukan', 'Menu ini baru saja dihapus dari perangkat lain.');
  editingId = id || null;
  $('modalTitle').textContent = id ? 'Edit Menu' : 'Tambah Menu';
  $('fTanggal').value = m.tanggal || '';
  $('fNama').value = m.nama;
  fillGizi('Besar', m.gizi.besar);
  fillGizi('Kecil', m.gizi.kecil);
  $('fDeskripsi').value = m.deskripsi || '';
  $('fGambar').value = '';
  fotoBaru = null;
  $('fGambar').dataset.path = m.gambar || '';
  aturPratinjau(gambarSrc(m));
  document.querySelectorAll('.error-msg').forEach(e => e.style.display = 'none');
  cekKonsistensiGizi();
  $('modalForm').classList.add('open');
  formAwal = isiForm();
}
let formAwal = '';
const isiForm = () => JSON.stringify([...$('modalForm').querySelectorAll('input:not([type=file]), textarea')].map(e => e.value)
                                     .concat(fotoBaru ? '1' : ''));
function closeModal(){ $('modalForm').classList.remove('open'); }
async function tutupForm(){
  if(isiForm() !== formAwal && !await tanya({ jenis: 'bahaya', judul: 'Buang perubahan?',
    pesan: 'Isian di form ini belum disimpan dan akan hilang.', ya: 'Buang', tidak: 'Lanjut mengisi' })) return;
  closeModal();
}

async function saveForm(){
  const tanggal = $('fTanggal').value;
  const nama = $('fNama').value.trim();
  const errGizi = cekIsianGizi();
  const errTanggal = pesanErrorTanggal();

  tampilkanErrorTanggal(errTanggal);
  $('err-fNama').style.display = nama ? 'none' : 'block';
  tampilTeks('err-fGizi', errGizi);
  if(errTanggal || !nama) return;
  if(errGizi) return $('giziRows').querySelector('[aria-invalid=true]').focus();

  if(editingId && !menuData.some(x => x.id === editingId)){
    if(!await tanya({ jenis: 'bahaya', judul: 'Menu ini sudah dihapus',
      pesan: 'Menu yang sedang Anda edit sudah dihapus dari perangkat/tab lain. Simpan isian ini sebagai menu baru?',
      ya: 'Simpan sebagai baru' })) return;
    editingId = null;
    if(pesanErrorTanggal()) return tampilkanErrorTanggal(pesanErrorTanggal());
  }

  const tombol = $('simpanBtn');
  tombol.disabled = true;
  tombol.textContent = 'Menyimpan...';
  try{
    let gambar = $('fGambar').dataset.path || '';
    if(fotoBaru){
      const namaBerkas = namaBerkasGambar(tanggal);
      status('Mengunggah foto...');
      await unggahFoto(namaBerkas, fotoBaru, sesi);
      gambar = namaBerkas;
      $('fGambar').dataset.path = gambar;
      fotoBaru = null;
    }

    const record = {
      tanggal, nama, gambar,
      deskripsi: $('fDeskripsi').value.trim(),
      gizi: { besar: readGizi('Besar'), kecil: readGizi('Kecil') }
    };
    const id = editingId || Date.now();
    const ok = await simpan(() => {
      if(tanggalDipakai(menuData, tanggal, id)) {
        return `TIDAK tersimpan: tanggal ${formatTanggal(tanggal)} baru saja dipakai menu lain oleh pengguna lain. Ganti tanggalnya lalu Simpan lagi.`;
      }
      const ada = menuData.find(x => x.id === id);
      if(editingId && !ada) return 'TIDAK tersimpan: menu ini baru saja dihapus pengguna lain. Klik Simpan lagi untuk menyimpannya sebagai menu baru.';
      if(ada) Object.assign(ada, record);
      else menuData.push({ id, ...record });
      return '';
    }, 'Menu tersimpan dan sudah tayang.');
    if(ok) closeModal();
    refresh();
  }catch(e){
    if(e.status === 401) return sesiBerakhir();
    status('GAGAL: ' + e.message, 'bahaya');
  }finally{
    tombol.disabled = false;
    tombol.textContent = 'Simpan';
  }
}

const waktu = t => new Date(t).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const jam = t => new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
function lalu(t){
  const menit = (Date.now() - new Date(t)) / 60000;
  return menit < 1 ? 'baru saja' : menit < 60 ? `${Math.floor(menit)} menit lalu`
       : menit < 1440 ? `${Math.floor(menit / 60)} jam lalu` : waktu(t);
}
const tempat = e => [e.ip, e.lokasi, e.perangkat].filter(Boolean).join(' · ');
const chipPeran = p => p === 'super' ? '<span class="chip emas">Super Admin</span>' : '<span class="chip">Admin</span>';

let aktivitas = [];
let aktivitasDimuat = 0;
const KUNCI_DILIHAT = 'mbg_notif_dilihat';
async function muatAktivitas(paksa){
  if(!superAdmin() || (!paksa && Date.now() - aktivitasDimuat < 60000)) return;
  aktivitasDimuat = Date.now();
  try{
    aktivitas = tandaiTertimpa(await api('/aktivitas'));
  }catch(e){
    if(!$('kartuNotif').hidden) $('notifIsi').innerHTML = `<p class="none notif-kosong">Gagal memuat: ${esc(e.message)}</p>`;
    return;
  }
  renderNotif();
}
function tandaiTertimpa(daftar){
  const menang = new Map();
  daftar.forEach(a => { const k = String(a.d); if(menang.has(k)) a.tertimpa = menang.get(k); else menang.set(k, a); });
  return daftar;
}
const KATA_AKSI = { tambah: 'menambah', ubah: 'mengubah', hapus: 'menghapus' };
const IKON_AKSI = { tambah: '+', ubah: '✎', hapus: '−' };
const labelAktivitas = i => i.o === 'menu' ? `${i.tg ? formatTanggal(i.tg) : 'Tanpa tanggal'} · ${i.nm}` : i.nm;
function itemNotif(a){
  const x = (a.x || []).slice(0, 4);
  const jenis = x.length && x.every(i => i.k === x[0].k) ? x[0].k : 'ubah';
  return `<div class="notif-item ${jenis}">
    <span class="notif-ikon" aria-hidden="true">${IKON_AKSI[jenis]}</span>
    <div class="notif-isi">
      <div class="notif-kepala"><strong>${esc(a.u)}</strong>${a.p === 'super' ? ' <span class="chip emas">Super Admin</span>' : ''}
        <span class="notif-waktu" title="${esc(waktu(a.t))}">${esc(lalu(a.t))}</span></div>
      ${a.c ? `<div class="notif-catatan">${esc(a.c)}</div>` : ''}
      ${x.map(i => `<div class="notif-baris"><span class="notif-kata ${esc(i.k)}">${KATA_AKSI[i.k] || esc(i.k)} ${esc(i.o)}</span> ${esc(labelAktivitas(i))}${i.x ? `<small>${esc(i.x)}</small>` : ''}</div>`).join('')}
      ${a.n > x.length ? `<div class="notif-baris none">+ ${angka(a.n - x.length)} perubahan lain</div>` : ''}
      ${a.tertimpa ? `<div class="notif-peringatan">⚠ Kemungkinan tertimpa perubahan ${esc(a.tertimpa.u)} (${esc(jam(a.tertimpa.t))}) yang disimpan hampir bersamaan dari lokasi lain. Periksa, ulangi bila hilang.</div>` : ''}
    </div>
  </div>`;
}
function renderNotif(){
  let dilihat = 0;
  try{ dilihat = Number(localStorage.getItem(KUNCI_DILIHAT) || 0); }catch(e){}
  const baru = aktivitas.filter(a => Date.parse(a.t) > dilihat && a.u !== pengguna?.username).length;
  $('notifLencana').hidden = !baru;
  $('notifLencana').textContent = baru > 9 ? '9+' : baru;
  $('notifTombol').setAttribute('aria-label', baru ? `Aktivitas terbaru, ${baru} baru` : 'Aktivitas terbaru');
  $('notifIsi').innerHTML = aktivitas.slice(0, 10).map(itemNotif).join('')
    || '<p class="none notif-kosong">Belum ada aktivitas.</p>';
}
function tutupNotif(){
  $('kartuNotif').hidden = true;
  $('notifTombol').setAttribute('aria-expanded', 'false');
}
async function bukaNotif(){
  if(!$('kartuNotif').hidden) return tutupNotif();
  $('akun').open = false;
  $('kartuNotif').hidden = false;
  $('notifTombol').setAttribute('aria-expanded', 'true');
  renderNotif();
  await muatAktivitas(true);
  const terbaru = Math.max(0, ...aktivitas.map(a => Date.parse(a.t) || 0));
  try{ if(terbaru) localStorage.setItem(KUNCI_DILIHAT, terbaru); }catch(e){}
  renderNotif();
}

const JUDUL_TAB = { pengguna: 'Kelola Pengguna', sesi: 'Sesi Aktif', riwayat: 'Riwayat Login', pulih: 'Titik Pulih Harian' };
let tabAktif = '';
let daftarPenggunaTerakhir = [];
let riwayatTerakhir = [];
const bukaPanel = tab => { $('panel').classList.add('open'); gantiTab(tab); };
const tutupPanel = () => $('panel').classList.remove('open');
async function gantiTab(tab){
  if(!superAdmin()) tab = 'riwayat';
  tabAktif = tab;
  $('panelJudul').textContent = superAdmin() ? JUDUL_TAB[tab] : 'Riwayat Login Saya';
  $('panelTab').querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
  $('panelIsi').innerHTML = '<p class="none">Memuat...</p>';
  let html;
  try{ html = await ISI_TAB[tab](); }
  catch(e){ html = `<p class="error-msg tampil">Gagal memuat: ${esc(e.message)}</p>`; }
  if(tabAktif === tab) $('panelIsi').innerHTML = html;
}
const statusPengguna = p => !p.aktif ? '<span class="chip mati">Nonaktif</span>'
  : p.kunciSampai > Date.now() ? `<span class="chip bahaya">Terkunci s/d ${esc(jam(p.kunciSampai))}</span>` : '<span class="chip ok">Aktif</span>';
function barisPengguna(p){
  const saya = p.id === pengguna.id;
  const terkunci = p.kunciSampai > Date.now();
  return `<div class="item-panel" data-id="${esc(p.id)}">
    <div class="item-utama">
      <strong>${esc(p.username)}</strong> ${chipPeran(p.peran)} ${statusPengguna(p)}${saya ? ' <span class="chip">Anda</span>' : ''}
      <small>${p.terakhir ? `Login terakhir ${esc(waktu(p.terakhir.t))} · ${esc(tempat(p.terakhir))}` : 'Belum pernah login'}</small>
    </div>
    <div class="item-aksi">
      <button type="button" class="btn ghost small" data-aksi="nama">Ganti username</button>
      <button type="button" class="btn ghost small" data-aksi="sandi">${saya ? 'Ganti password' : 'Reset password'}</button>
      ${terkunci ? '<button type="button" class="btn ghost small" data-aksi="buka">Buka kunci</button>' : ''}
      ${p.peran === 'super' ? '' : p.aktif
        ? '<button type="button" class="btn danger small" data-aksi="nonaktif">Nonaktifkan</button>'
        : '<button type="button" class="btn small" data-aksi="aktif">Aktifkan</button>'}
    </div>
  </div>`;
}
const HASIL_LOGIN = {
  masuk: ['Berhasil masuk', 'ok'], salah: ['Password salah', 'bahaya'], kunci: ['Salah 5×, akun dikunci 1 jam', 'bahaya'],
  keluar: ['Logout', ''], paksa: ['Dipaksa keluar', 'bahaya'], reset: ['Password diatur ulang', 'emas']
};
function barisRiwayat(e){
  const [label, kelas] = HASIL_LOGIN[e.h] || [e.h, ''];
  return `<div class="item-panel">
    <div class="item-utama">
      <span class="chip ${kelas}">${esc(label)}</span> <strong>${esc(e.u)}</strong> <span class="none">${esc(waktu(e.t))}</span>
      <small>${e.oleh ? 'oleh ' + esc(e.oleh) : esc(tempat(e)) || '-'}</small>
    </div>
  </div>`;
}
function renderRiwayat(){
  const siapa = $('filterRiwayat')?.value || '';
  const log = riwayatTerakhir.filter(e => !siapa || e.u === siapa).slice(0, 100);
  $('daftarRiwayat').innerHTML = log.map(barisRiwayat).join('') || '<p class="none">Belum ada riwayat.</p>';
}
const ISI_TAB = {
  async pengguna(){
    daftarPenggunaTerakhir = await api('/pengguna');
    return `<div class="form-pengguna">
      <div><label for="baruUsername">Username admin baru</label>
        <input type="text" id="baruUsername" maxlength="40" placeholder="mis. nama.staf" autocomplete="off" autocapitalize="none" spellcheck="false"></div>
      <div><label for="baruPassword">Password (min. 10 karakter)</label>
        <input type="text" id="baruPassword" autocomplete="off" autocapitalize="none" spellcheck="false"></div>
      <button type="button" class="btn" data-aksi="tambah">+ Tambah Admin</button>
    </div>
    <div class="error-msg" id="errPengguna"></div>
    <p class="none catatan">Admin bisa tambah/edit/hapus menu &amp; kontak. Akun baru, password baru, dan penonaktifan berlaku di semua lokasi paling lambat ±1 menit.</p>
    <div class="daftar-panel">${daftarPenggunaTerakhir.map(barisPengguna).join('')}</div>`;
  },
  async sesi(){
    const d = await api('/sesi');
    return `<p class="none rapat">Sesi berlaku 12 jam sejak login. Paksa keluar berlaku paling lambat ±1 menit.</p>
    <div class="daftar-panel">${d.map(s => `<div class="item-panel" data-id="${esc(s.id)}">
      <div class="item-utama">
        <strong>${esc(s.username)}</strong> ${chipPeran(s.peran)}${s.sesiIni ? ' <span class="chip ok">Sesi ini</span>' : ''}
        <small>Masuk ${esc(waktu(s.dibuat))} · ${esc(tempat(s))}</small>
      </div>
      <div class="item-aksi">${s.sesiIni ? '' : '<button type="button" class="btn danger small" data-aksi="paksa">Paksa keluar</button>'}</div>
    </div>`).join('') || '<p class="none">Tidak ada sesi aktif.</p>'}</div>`;
  },
  async riwayat(){
    riwayatTerakhir = await api('/riwayat');
    const nama = [...new Set(riwayatTerakhir.map(e => e.u))].sort();
    return (superAdmin() ? `<div class="filter-riwayat"><label for="filterRiwayat">Tampilkan</label>
      <select id="filterRiwayat"><option value="">Semua pengguna</option>${nama.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}</select></div>` : '')
      + `<p class="none catatan">IP menunjukkan jaringan, bukan orang; lokasi dari IP hanya perkiraan.</p>
      <div class="daftar-panel" id="daftarRiwayat">${riwayatTerakhir.slice(0, 100).map(barisRiwayat).join('') || '<p class="none">Belum ada riwayat.</p>'}</div>`;
  },
  async pulih(){
    const d = await api('/titik');
    return `<p class="none rapat">Setiap hari, sebelum perubahan pertama, server menyimpan kondisi data saat itu (disimpan 8 hari). Pakai bila menu terhapus/rusak karena kesalahan. Foto tidak terpengaruh.</p>
    <div class="daftar-panel">${d.map(t => `<div class="item-panel" data-id="${esc(t.tanggal)}">
      <div class="item-utama">
        <strong>Kondisi awal ${esc(formatTanggal(t.tanggal))}</strong>
        <small>${angka(t.menu)} menu · ${angka(t.kontak)} kontak${t.versi ? ' · terakhir diubah ' + esc(waktu(t.versi)) : ''}</small>
      </div>
      <div class="item-aksi"><button type="button" class="btn ghost small" data-aksi="pulih">Pulihkan</button></div>
    </div>`).join('') || '<p class="none">Belum ada titik pulih. Titik pertama dibuat otomatis saat ada perubahan berikutnya.</p>'}</div>`;
  }
};

const cekUsername = u => /^[a-z0-9][a-z0-9._@-]{2,39}$/.test(u.trim().toLowerCase())
  ? '' : 'Username 3-40 karakter: huruf, angka, titik, @, _ atau - (diawali huruf/angka).';
const cekPassword = p => p.length >= 10 ? '' : 'Password minimal 10 karakter.';
const penggunaDari = id => daftarPenggunaTerakhir.find(p => p.id === id);
const passwordLama = async () => {
  const x = await tanya({ judul: 'Konfirmasi password Anda', pesan: 'Demi keamanan, ketik password Anda saat ini.', ya: 'Lanjut',
    isian: { label: 'Password saat ini', tipe: 'password', cek: v => v ? '' : 'Wajib diisi.' } });
  return x && kunciDari(x);
};
async function ubahPengguna(id, isi, pesan){
  const r = await api(`/pengguna/${id}`, { method: 'PUT', body: isi });
  if(r.keluar) return sesiBerakhir('Password Anda sudah diganti. Silakan login dengan password baru.');
  if(id === pengguna.id) terapkanPengguna({ ...pengguna, ...r.pengguna });
  if(pesan) await beritahu(pesan[0], pesan[1], 'ok');
  gantiTab('pengguna');
}
const AKSI_PANEL = {
  async tambah(){
    const username = $('baruUsername').value.trim().toLowerCase();
    const password = $('baruPassword').value;
    const galat = cekUsername(username) || cekPassword(password)
      || (daftarPenggunaTerakhir.some(p => p.username === username) ? 'Username sudah dipakai.' : '');
    tampilTeks('errPengguna', galat);
    if(galat) return;
    await api('/pengguna', { method: 'POST', body: { username, kunci: await kunciDari(password) } });
    await beritahu('Admin ditambahkan', `Username: ${username}\n\nSampaikan username dan password yang Anda ketik kepada yang bersangkutan. Akun bisa dipakai paling lambat ±1 menit lagi.`, 'ok');
    gantiTab('pengguna');
  },
  async nama(id){
    const p = penggunaDari(id);
    const baru = await tanya({ judul: 'Ganti username', pesan: `Username sekarang: ${p.username}\nRiwayat login tetap tersambung.`, ya: 'Simpan',
      isian: { label: 'Username baru', nilai: p.username, cek: u => cekUsername(u) || (u.trim().toLowerCase() === p.username ? 'Belum diubah.' : '') } });
    if(!baru) return;
    const isi = { username: baru.trim().toLowerCase() };
    if(id === pengguna.id && !(isi.kunciLama = await passwordLama())) return;
    await ubahPengguna(id, isi);
  },
  async sandi(id){
    const p = penggunaDari(id);
    if(id === pengguna.id){
      const kunciLama = await passwordLama();
      if(!kunciLama) return;
      const baru = await tanya({ judul: 'Ganti password Anda', pesan: 'Setelah diganti, Anda perlu login ulang.', ya: 'Lanjut',
        isian: { label: 'Password baru', tipe: 'password', cek: cekPassword } });
      if(!baru) return;
      const ulang = await tanya({ judul: 'Ulangi password baru', ya: 'Ganti password',
        isian: { label: 'Ketik sekali lagi', tipe: 'password', cek: x => x === baru ? '' : 'Belum sama dengan password baru.' } });
      if(ulang) await ubahPengguna(id, { kunci: await kunciDari(baru), kunciLama });
      return;
    }
    const baru = await tanya({ judul: `Reset password ${p.username}`, ya: 'Reset password',
      pesan: 'Semua sesi pengguna ini langsung diputus. Sampaikan password baru kepadanya.',
      isian: { label: 'Password baru', cek: cekPassword } });
    if(baru) await ubahPengguna(id, { kunci: await kunciDari(baru) },
      ['Password direset', `Password baru untuk ${p.username} sudah aktif (paling lambat ±1 menit di semua lokasi).`]);
  },
  buka: id => ubahPengguna(id, { bukaKunci: true }),
  aktif: id => ubahPengguna(id, { aktif: true }),
  async nonaktif(id){
    const p = penggunaDari(id);
    if(await tanya({ jenis: 'bahaya', judul: `Nonaktifkan ${p.username}?`, ya: 'Nonaktifkan',
      pesan: 'Pengguna ini langsung dikeluarkan dan tidak bisa login sampai diaktifkan lagi. Riwayatnya tetap tersimpan.' })) {
      await ubahPengguna(id, { aktif: false });
    }
  },
  async paksa(id){
    if(!await tanya({ jenis: 'bahaya', judul: 'Paksa keluar sesi ini?', ya: 'Paksa keluar',
      pesan: 'Perangkat itu harus login ulang. Perubahan yang belum disimpan di sana akan hilang.' })) return;
    await api(`/sesi/${encodeURIComponent(id)}`, { method: 'DELETE' });
    gantiTab('sesi');
  },
  async pulih(tgl){
    const d = await api(`/titik/${tgl}`);
    tutupPanel();
    await gantiSemuaData(normalizeList(d.menus), normalizeSosmed(d.sosmed), `titik pulih ${formatTanggal(tgl)}`,
      `Data dipulihkan ke kondisi awal ${formatTanggal(tgl)}.`, `Pulihkan titik ${tgl}`);
  }
};
$('panelIsi').addEventListener('click', async e => {
  const b = e.target.closest('[data-aksi]');
  if(!b || b.disabled) return;
  b.disabled = true;
  try{ await AKSI_PANEL[b.dataset.aksi](b.closest('[data-id]')?.dataset.id); }
  catch(err){ if(err.status !== 401) await beritahu('Gagal', err.message, 'bahaya'); }
  finally{ b.disabled = false; }
});
$('panelIsi').addEventListener('change', e => { if(e.target.id === 'filterRiwayat') renderRiwayat(); });
$('panelTab').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if(b) gantiTab(b.dataset.tab); });
$('panel').addEventListener('click', e => { if(e.target === $('panel')) tutupPanel(); });

// data-klik / data-ubah replace inline handlers so CSP can drop 'unsafe-inline'
const KLIK = {
  login: tryLogin, mata: (_, b) => lihatPassword(b), notif: bukaNotif, aktivitas: () => muatAktivitas(true),
  muat: muatDariServer, cadangkan: exportData, pulihkan: () => $('importFile').click(), tambah: () => openModal(),
  panel: bukaPanel, logout, batalPilih, hapusTerpilih: () => hapusMenu([...dipilih]), lagi: () => { jumlahTampil += PER_HALAMAN; render(); },
  sosTambah: tambahSosmed, hariIni: setHariIni, batal: tutupForm, simpan: saveForm, tutupPanel,
  dlgTidak: () => $('dlg').close(), dlgYa: () => $('dlg').close('ya'),
  edit: id => openModal(Number(id)), hapus: id => hapusMenu([Number(id)]), sosHapus: i => hapusSosmed(Number(i))
};
const UBAH = {
  impor: el => importData(el.files[0]), foto: el => previewImage(el.files[0]), pilihSemua: el => pilihSemua(el.checked),
  pilih: el => pilih(Number(el.value), el), judulSosmed: el => ubahJudulSosmed(Number(el.dataset.arg), el.value)
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-klik]');
  if(b) KLIK[b.dataset.klik](b.dataset.arg, b);
});
document.addEventListener('change', e => { const f = UBAH[e.target.dataset.ubah]; if(f) f(e.target); });
$('giziRows').addEventListener('input', e => {
  // works on Android too (keydown/beforeinput don't); separators stay, so a pasted "1.234,5" is reported instead of silently becoming another number
  const el = e.target, buang = s => s.replace(/[^\d.,]/g, '');
  if(buang(el.value) !== el.value){
    const kursor = buang(el.value.slice(0, el.selectionStart)).length;
    el.value = buang(el.value);
    el.setSelectionRange(kursor, kursor);
  }
  cekKonsistensiGizi();
  if($('err-fGizi').style.display === 'block') tampilTeks('err-fGizi', cekIsianGizi());
});
$('giziRows').addEventListener('change', e => {   // on leaving the field: "18,6" is shown as the 18.6 that gets saved
  const v = bacaGizi(e.target.value);
  if(v !== '' && !Number.isNaN(v)) e.target.value = v;
});
$('loginUsername').addEventListener('keydown', e => { if(e.key === 'Enter') $('loginPassword').focus(); });
$('loginPassword').addEventListener('keydown', e => { if(e.key === 'Enter') tryLogin(); });

$('search').addEventListener('input', renderDariAwal);
$('filterBulan').addEventListener('change', renderDariAwal);
document.addEventListener('visibilitychange', () => {
  if(document.hidden) return sembunyikanPassword();
  if($('appScreen').style.display !== 'block' || $('modalForm').classList.contains('open') || $('dlg').open) return;
  cekSesi();
  muatAktivitas();
  muatDariServer();
});
$('dlg').addEventListener('click', e => { if(e.target === $('dlg')) $('dlg').close(); });
$('fTanggal').addEventListener('change', () => {
  tampilkanErrorTanggal($('fTanggal').value ? pesanErrorTanggal() : '');
});
$('akun').addEventListener('toggle', () => { if($('akun').open){ isiInfoAkun(); tutupNotif(); } });
$('akun').querySelectorAll('.akun-item').forEach(el => el.addEventListener('click', () => { $('akun').open = false; }));
document.addEventListener('click', e => {
  if($('akun').open && !$('akun').contains(e.target)) $('akun').open = false;
  if(!$('kartuNotif').hidden && !$('notif').contains(e.target)) tutupNotif();
});
document.addEventListener('keydown', e => {
  if(e.key !== 'Escape' || $('dlg').open) return;
  if($('akun').open){ $('akun').open = false; $('akun').querySelector('summary').focus(); }
  else if(!$('kartuNotif').hidden){ tutupNotif(); $('notifTombol').focus(); }
  else if($('panel').classList.contains('open')) tutupPanel();
  else if($('modalForm').classList.contains('open')){ e.preventDefault(); tutupForm(); }
});
buildGiziRows();
sembunyikanPassword();
$('sosPlatform').innerHTML = PLATFORM_LIST.map(p => `<option value="${p}">${PLATFORM_NAMA[p]}</option>`).join('');
try{
  const pesan = sessionStorage.getItem('mbg_pesan_login');
  if(pesan){ tampilTeks('loginError', pesan); sessionStorage.removeItem('mbg_pesan_login'); }
}catch(e){}
// verify the stored session before showing anything; 401 -> api() reloads to login
if(sesi) api('/auth/saya').then(d => { terimaSaya(d); showApp(); }, e => { if(e.status !== 401) showApp(); });
