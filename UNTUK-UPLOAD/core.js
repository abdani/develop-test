
const API = 'https://nilaigizi-api.daniabdani1.workers.dev';

const MAX_SOSMED = 10;

const GIZI_LABELS = {
  kalori:      { kode: 'E', label: 'Energi',      unit: 'kkal' },
  protein:     { kode: 'P', label: 'Protein',     unit: 'g' },
  lemak:       { kode: 'L', label: 'Lemak',       unit: 'g' },
  karbohidrat: { kode: 'K', label: 'Karbohidrat', unit: 'g' },
  serat:       { kode: 'S', label: 'Serat',       unit: 'g' }
};
const GIZI_FIELDS = Object.keys(GIZI_LABELS);
const GIZI_WAJIB = ['kalori','protein','karbohidrat','lemak'];

const NAMA_BULAN = ['Januari','Februari','Maret','April','Mei','Juni',
                    'Juli','Agustus','September','Oktober','November','Desember'];

const $ = id => document.getElementById(id);
const tampilTeks = (id, teks) => { $(id).textContent = teks; $(id).style.display = teks ? 'block' : 'none'; };
const esc = str => String(str).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

const angka = v => Number.isFinite(Number(v)) ? Number(v) : 0;
// Numeric input: comma or point as decimal mark ("18,6" = 18.6). '' when blank, NaN when not a plain positive decimal
const bacaGizi = s => { const t = String(s).trim().replace(',', '.'); return t === '' ? '' : /^(\d+\.?\d*|\.\d+)$/.test(t) ? Number(t) : NaN; };

function hariIni(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
const NAMA_HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const namaHari = t => NAMA_HARI[new Date(t + 'T00:00:00Z').getUTCDay()] || '';
function formatTanggal(t){
  if(!t || typeof t !== 'string') return '';
  const [y, m, d] = t.split('-');
  const hari = namaHari(t);
  return `${hari ? hari + ', ' : ''}${Number(d)} ${NAMA_BULAN[Number(m)-1]} ${y}`;
}
const tanggalPendek = t => formatTanggal(t).replace(/^(\w{3})\w*,/, '$1,').replace(/ (\w{3})\w* (\d{4})$/, ' $1 $2');
const bulanKey = t => (t || '').slice(0, 7);
function labelBulan(key){
  const [y, m] = key.split('-');
  return `${NAMA_BULAN[Number(m)-1]} ${y}`;
}

const urutTerbaru = list => [...list].sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));

const pilihUtama = (urut, hari = hariIni()) => urut.find(m => m.tanggal && m.tanggal <= hari) || urut[0];

const daftarBulan = list =>
  [...new Set(list.map(m => bulanKey(m.tanggal)).filter(Boolean))].sort().reverse();

function tanggalGanda(list){
  const hitung = {};
  list.forEach(m => { if(m.tanggal) hitung[m.tanggal] = (hitung[m.tanggal] || 0) + 1; });
  return Object.keys(hitung).filter(t => hitung[t] > 1).sort();
}
const tanggalDipakai = (list, tanggal, kecualiId = null) =>
  !!tanggal && list.some(m => m.tanggal === tanggal && m.id !== kecualiId);

const simpananTanggal = new Map();
function teksTanggal(t){
  if(!t) return '';
  if(!simpananTanggal.has(t))
    simpananTanggal.set(t, `${formatTanggal(t)} ${t} ${t.split('-').reverse().join('/')}`.toLowerCase());
  return simpananTanggal.get(t);
}
const kataCari = input => input.value.toLowerCase().split(/\s+/).filter(Boolean);
function cocokCari(m, kata){
  if(!kata.length) return true;
  const teks = [m.nama, m.deskripsi].map(x => String(x || '')).join('\n').toLowerCase() + '\n' + teksTanggal(m.tanggal);
  return kata.every(k => teks.includes(k));
}

const cocokBulan = (m, filter) =>
  !filter || (filter === '-' ? !m.tanggal : bulanKey(m.tanggal) === filter);

function isiPilihanBulan(select, list){
  const dipilih = select.value;
  const opsi = ['<option value="">Semua Bulan</option>']
    .concat(daftarBulan(list).map(b => `<option value="${esc(b)}">${esc(labelBulan(b))}</option>`));
  if(list.some(m => !m.tanggal)) opsi.push('<option value="-">Tanpa tanggal</option>');
  select.innerHTML = opsi.join('');
  if([...select.options].some(o => o.value === dipilih)) select.value = dipilih;
}

const emptyPorsi = () => Object.fromEntries(GIZI_FIELDS.map(f => [f, 0]));

const kaloriDariMakro = g => 4 * angka(g.protein) + 4 * angka(g.karbohidrat) + 9 * angka(g.lemak);
// an unfilled or invalid macro counts as 0: the sum is only meaningful (and comparable) once all three are in
const makroLengkap = g => [g.protein, g.karbohidrat, g.lemak].every(x => angka(x) > 0);

function periksaKalori(g){
  const tertulis = angka(g.kalori);
  if(tertulis <= 0 || !makroLengkap(g)) return '';
  const hitung = kaloriDariMakro(g);
  if(Math.abs(hitung - tertulis) / tertulis <= 0.15) return '';
  return `energi tertulis ${tertulis} kkal, tetapi dari protein/karbohidrat/lemak hasilnya ${Math.round(hitung)} kkal`;
}

function normalizeGizi(g){
  if(g && g.besar && g.kecil) return g;
  return g ? { besar: {...g}, kecil: {...g} } : { besar: emptyPorsi(), kecil: emptyPorsi() };
}
const namaBerkasGambar = tanggal => `${tanggal}-${Date.now()}.jpg`;

const gambarSrc = m => {
  const g = String(m.gambarData || m.gambar || '');
  if (!g || g.startsWith('data:') || g.startsWith('http')) return g;
  const berkas = g.split('/').pop();
  return `${API}/img/${berkas}`;
};

const FOTO_KOSONG = '<div class="foto-kosong"><svg viewBox="0 0 120 84" aria-hidden="true">'
  + '<rect x="2" y="2" width="116" height="80" rx="14" fill="#fff" stroke="#e6cf93" stroke-width="3"/>'
  + '<rect x="12" y="12" width="28" height="24" rx="6" fill="#b7d7a0"/><rect x="46" y="12" width="28" height="24" rx="6" fill="#e9b0a4"/>'
  + '<rect x="80" y="12" width="28" height="24" rx="6" fill="#f4d58d"/><rect x="12" y="42" width="62" height="30" rx="7" fill="#fbf6ea" stroke="#ecdcb6" stroke-width="2"/>'
  + '<rect x="80" y="42" width="28" height="30" rx="6" fill="#e8c38a"/></svg><span>Foto belum tersedia</span></div>';
const fotoMenu = (m, atribut = '') => gambarSrc(m)
  ? `<img src="${esc(gambarSrc(m))}" alt="" ${atribut} data-foto>` : FOTO_KOSONG;
// error does not bubble: capture phase replaces broken menu photos without inline onerror (CSP)
document.addEventListener('error', e => { if(e.target.matches && e.target.matches('img[data-foto]')) e.target.outerHTML = FOTO_KOSONG; }, true);

const untukPublikasi =list => list.map(({ gambarData, ...sisa }) => sisa);

const normalizeList = list => {
  const dipakai = new Set();
  let idBaru = Date.now();
  return (Array.isArray(list) ? list : []).filter(m => m && typeof m === 'object').map(m => {
    const g = String(m.gambar || '');
    const lama = g.startsWith('data:');
    let id = Number(m.id);
    if(!Number.isSafeInteger(id) || id <= 0 || dipakai.has(id)){
      while(dipakai.has(idBaru)) idBaru++;
      id = idBaru;
    }
    dipakai.add(id);
    return {
      ...m,
      id,
      nama: String(m.nama || ''),
      tanggal: /^\d{4}-\d{2}-\d{2}$/.test(m.tanggal) ? m.tanggal : '',
      gambar: lama ? '' : g,
      gambarData: m.gambarData || (lama ? g : ''),
      gizi: normalizeGizi(m.gizi)
    };
  });
};

const IKON_SOSMED = {
  tiktok:    '<rect width="24" height="24" rx="6" fill="#111"/><text x="12" y="17.5" text-anchor="middle" font-size="15" fill="#fff" font-family="Roboto,Arial,sans-serif">&#9834;</text>',
  instagram: '<rect width="24" height="24" rx="6" fill="#E4405F"/><rect x="5.6" y="5.6" width="12.8" height="12.8" rx="4" fill="none" stroke="#fff" stroke-width="1.7"/><circle cx="12" cy="12" r="3.1" fill="none" stroke="#fff" stroke-width="1.7"/><circle cx="16.3" cy="7.7" r="1" fill="#fff"/>',
  facebook:  '<rect width="24" height="24" rx="6" fill="#1877F2"/><text x="12" y="17.6" text-anchor="middle" font-size="15" font-weight="700" fill="#fff" font-family="Roboto,Arial,sans-serif">f</text>',
  whatsapp:  '<rect width="24" height="24" rx="6" fill="#25D366"/><path d="M6.4 17.6l.8-2.6a5.6 5.6 0 1 1 2.1 1.9l-2.9.7z" fill="#fff"/>',
  youtube:   '<rect width="24" height="24" rx="6" fill="#FF0000"/><polygon points="9.6,7.9 16.8,12 9.6,16.1" fill="#fff"/>',
  website:   '<rect width="24" height="24" rx="6" fill="#7a1420"/><circle cx="12" cy="12" r="6.2" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M5.8 12h12.4" stroke="#fff" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="2.9" ry="6.2" fill="none" stroke="#fff" stroke-width="1.5"/>'
};
const PLATFORM_NAMA = {
  tiktok:'TikTok', instagram:'Instagram', facebook:'Facebook',
  whatsapp:'WhatsApp', youtube:'YouTube', website:'Website'
};
const PLATFORM_LIST = Object.keys(PLATFORM_NAMA);
const ikonSosmed = platform =>
  `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">${IKON_SOSMED[platform] || ''}</svg>`;

const urlAman = u => /^https?:\/\//i.test(String(u || '').trim()) ? String(u).trim() : '';

function waLink(input){
  const teks = String(input || '').trim();
  if(/^https?:\/\//i.test(teks)) return urlAman(teks);
  const digit = teks.replace(/\D/g, '');
  if(!digit) return '';
  const nomor = digit.startsWith('62') ? digit
              : digit.startsWith('0')  ? '62' + digit.slice(1)
              : digit.startsWith('8')  ? '62' + digit
              : digit;
  return 'https://wa.me/' + nomor;
}
const judulSosmed = s => String(s.judul || '').trim().slice(0, 40) || PLATFORM_NAMA[s.platform] || '';

const normalizeSosmed = list => (Array.isArray(list) ? list : [])
  .filter(s => s && PLATFORM_NAMA[s.platform] && urlAman(s.url))
  .map(s => ({ platform: s.platform, judul: judulSosmed(s), url: urlAman(s.url) }))
  .slice(0, MAX_SOSMED);

const publishedMenus = () => normalizeList(typeof MENU_DATA !== 'undefined' ? JSON.parse(JSON.stringify(MENU_DATA)) : []);
const publishedSosmed = () => normalizeSosmed(typeof SOSMED_DATA !== 'undefined' ? SOSMED_DATA : []);

function ambilArray(teks, nama){
  const cocok = String(teks).match(new RegExp(nama + '\\s*=\\s*(\\[\\]|\\[[\\s\\S]*?\\n\\])\\s*;'));
  return cocok ? JSON.parse(cocok[1]) : null;
}

async function ambilDariServer(minta = fetch(`${API}/data`, { cache: 'no-store' })){
  const r = await minta;
  if(!r.ok) throw new Error('Server menjawab ' + r.status);
  const d = await r.json();
  return { menus: normalizeList(d.menus), sosmed: normalizeSosmed(d.sosmed), diperbarui: d.diperbarui || null };
}

async function wajibOk(r, gagal){
  if(r.ok) return r.json();
  const e = new Error((await r.json().catch(() => ({}))).error || `${gagal} (${r.status})`);
  e.status = r.status;
  throw e;
}

const simpanKeServer = async (menus, sosmed, token, dasar, catatan) => wajibOk(await fetch(`${API}/data`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ menus: untukPublikasi(menus), sosmed, dasar, catatan })
}), 'Gagal menyimpan');

const unggahFoto = async (namaBerkas, blob, token) => wajibOk(await fetch(`${API}/img/${encodeURIComponent(namaBerkas)}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'image/jpeg', 'Authorization': `Bearer ${token}` },
  body: blob
}), 'Gagal mengunggah foto');
