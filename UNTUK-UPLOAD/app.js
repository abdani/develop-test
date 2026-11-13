let menus = [];

function barisGizi(m){
  return GIZI_FIELDS.map(key => {
    const { label, unit } = GIZI_LABELS[key];
    return `<tr>
      <td>${label}</td>
      <td>${angka(m.gizi.besar[key])} ${unit}</td>
      <td>${angka(m.gizi.kecil[key])} ${unit}</td>
    </tr>`;
  }).join('');
}

function card(m){
  const g = m.gizi.besar;
  return `
    <div class="card" data-id="${angka(m.id)}">
      <div class="thumb">${fotoMenu(m, 'loading="lazy" decoding="async" fetchpriority="low"')}</div>
      <div class="body">
        <span class="badge">${m.tanggal ? `<span class="tgl-panjang">${esc(formatTanggal(m.tanggal))}</span><span class="tgl-pendek">${esc(tanggalPendek(m.tanggal))}</span>` : 'Tanpa tanggal'}</span>
        <h3>${esc(m.nama)}</h3>
        <span class="cap">Porsi Besar</span>
        <div class="gizi-row">
          <div><strong>${angka(g.kalori)}</strong>kkal</div>
          <div><strong>${angka(g.protein)}</strong>protein</div>
          <div><strong>${angka(g.karbohidrat)}</strong>karbo</div>
          <div><strong>${angka(g.lemak)}</strong>lemak</div>
        </div>
        <p class="desc">${esc(m.deskripsi || '')}</p>
        <button class="btn ghost small">Lihat Detail</button>
      </div>
    </div>`;
}

function tampilkanUtama(m, disaring){
  $('featuredTitle').textContent = m.tanggal === hariIni() ? 'Menu Hari Ini' : disaring ? 'Hasil Teratas' : 'Menu Terbaru';
  $('featuredTanggal').textContent = m.tanggal ? formatTanggal(m.tanggal) : 'Tanggal belum diisi';
  $('featuredThumb').innerHTML = fotoMenu(m, 'fetchpriority="high"');
  $('featuredNama').textContent = m.nama;
  $('featuredDesc').textContent = m.deskripsi || '';
  $('featuredGizi').innerHTML = barisGizi(m);
}

const PER_HALAMAN = 8;
let jumlahTampil = PER_HALAMAN;

function render(){
  const q = kataCari($('search'));
  const bulan = $('filterBulan').value;
  const rows = menus.filter(m => cocokCari(m, q) && cocokBulan(m, bulan));

  $('featured').style.display = rows.length ? 'block' : 'none';
  tampilTeks('emptyMsg', rows.length ? '' : menus.length ? 'Tidak ada menu yang cocok dengan pencarian/filter.' : 'Belum ada menu tersedia.');
  const utama = pilihUtama(rows);
  if(utama) tampilkanUtama(utama, q.length > 0 || !!bulan);

  const sisa = rows.filter(m => m !== utama);
  const terlihat = sisa.slice(0, jumlahTampil);
  $('gridTitle').style.display = sisa.length ? 'block' : 'none';
  $('menuGrid').innerHTML = terlihat.map(card).join('');

  const tersisa = sisa.length - terlihat.length;
  $('btnLagi').style.display = tersisa > 0 ? 'inline-block' : 'none';
  $('btnLagi').textContent = `Muat lebih banyak (${tersisa} menu lagi)`;
}
function renderDariAwal(){
  jumlahTampil = PER_HALAMAN;
  render();
}

function tampilkanSosmed(){
  $('kontak').style.display = sosmedData.length ? 'block' : 'none';
  $('sosmedBar').innerHTML = sosmedData.map(s => {
    const judul = esc(judulSosmed(s));
    return `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="${judul}">`
         + `${ikonSosmed(s.platform)}<span class="sos-judul">${judul}</span></a>`;
  }).join('');
}

let sosmedData = [];

function gambarUlang(){
  isiPilihanBulan($('filterBulan'), menus);
  render();
  tampilkanSosmed();
}

const AMBANG_CADANGAN_MS = 1200;
let terakhirMuat = 0;
let sudahAdaDataServer = false;

function muatData(pertamaKali){
  terakhirMuat = Date.now();
  let timer = null;
  if(pertamaKali){
    tampilTeks('emptyMsg', 'Memuat menu terbaru...');
    timer = setTimeout(pakaiBanSerep, AMBANG_CADANGAN_MS);
  }

  // dataAwal is the early fetch from the hashed <head> script; absent if that script was blocked
  ambilDariServer(pertamaKali && typeof dataAwal !== 'undefined' ? dataAwal : undefined)
    .then(d => {
      clearTimeout(timer);
      sudahAdaDataServer = true;
      menus = urutTerbaru(d.menus);
      sosmedData = d.sosmed;
      tampilTeks('draftNotice', '');
      gambarUlang();
    })
    .catch(e => {
      clearTimeout(timer);
      console.warn('Server tidak terjangkau:', e.message);
      pakaiBanSerep().then(dipakai => { if(dipakai) tampilTeks('draftNotice', 'Sedang menampilkan data cadangan - sambungan ke server bermasalah.'); });
    });
}

let banSerep = null;
const pakaiBanSerep = () => (banSerep = banSerep || new Promise(selesai => {
  const s = document.createElement('script');
  s.src = 'data.js';
  s.onload = s.onerror = selesai;
  document.head.append(s);
})).then(() => {
  if(sudahAdaDataServer) return false;
  menus = urutTerbaru(publishedMenus());
  sosmedData = publishedSosmed();
  gambarUlang();
  return true;
});

function showDetail(id){
  const m = menus.find(x => x.id === id);
  if(!m) return;
  $('detailThumb').innerHTML = fotoMenu(m);
  $('detailTanggal').textContent = m.tanggal ? formatTanggal(m.tanggal) : 'Tanggal belum diisi';
  $('detailNama').textContent = m.nama;
  $('detailDesc').textContent = m.deskripsi || '';
  $('detailGizi').innerHTML = barisGizi(m);
  fokusSebelum = document.activeElement;
  $('modalDetail').classList.add('open');
  $('modalDetail').firstElementChild.focus({ preventScroll: true });
}
let fokusSebelum = null;
function closeDetail(){
  if(!$('modalDetail').classList.contains('open')) return;
  $('modalDetail').classList.remove('open');
  if(fokusSebelum && fokusSebelum.focus) fokusSebelum.focus();
}
$('modalDetail').addEventListener('click', e => { if(e.target === e.currentTarget) closeDetail(); });
$('btnTutup').addEventListener('click', closeDetail);
$('btnLagi').addEventListener('click', () => { jumlahTampil += PER_HALAMAN; render(); });
$('menuGrid').addEventListener('click', e => {
  const c = e.target.closest('.card');
  if(c) showDetail(Number(c.getAttribute('data-id')));
});
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeDetail(); });

$('search').addEventListener('input', renderDariAwal);
$('filterBulan').addEventListener('change', renderDariAwal);
// KV can be ~60 s stale anyway: switching apps back and forth should not re-download every menu
document.addEventListener('visibilitychange', () => { if(!document.hidden && Date.now() - terakhirMuat >= 60000) muatData(false); });

muatData(true);
