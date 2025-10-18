// =====================================================
// APP.JS - Preventivi ELIP v6.1-SB
// =====================================================

// =====================
// DATALIST + CATALOGO
// =====================
function buildDatalist() {
  let dl = document.getElementById('catalogCodes');
  if (!dl) {
    dl = document.createElement('datalist');
    dl.id = 'catalogCodes';
    document.body.appendChild(dl);
  }
  dl.innerHTML = '';
  const catalog = getCatalog();
  catalog.forEach(x => {
    const opt = document.createElement('option');
    opt.value = x.code;
    opt.label = `${x.code} - ${x.desc}`;
    dl.appendChild(opt);
  });
}

function getCatalog() {
  const data = localStorage.getItem('elip_catalog');
  if (data) return JSON.parse(data);
  return [
    { code: '01', desc: 'Avvolgimento indotto con recupero collettore', price: 100 },
    { code: '07', desc: 'Tornitura, smicatura ed equilibratura rotore', price: 80 },
    { code: '10', desc: 'Verniciatura protettiva', price: 50 },
  ];
}

// =====================
// RENDER TABELLA PREVENTIVO
// =====================
function renderPreventivo() {
  const body = document.getElementById('preventivoBody');
  body.innerHTML = '';
  const lines = JSON.parse(localStorage.getItem('elip_current_lines') || '[]');
  lines.forEach((l, idx) => {
    const tr = document.createElement('tr');
    tr.classList.add('line-row');
    tr.innerHTML = `
      <td><input type="text" class="form-control form-control-sm code-input" list="catalogCodes" value="${l.code || ''}" data-idx="${idx}"></td>
      <td><input type="text" class="form-control form-control-sm desc-input" value="${l.desc || ''}" data-idx="${idx}"></td>
      <td><input type="number" class="form-control form-control-sm price-input" value="${l.price || 0}" data-idx="${idx}"></td>
      <td><button class="btn btn-sm btn-danger" onclick="removeLine(${idx})">&times;</button></td>
    `;
    body.appendChild(tr);
  });
}

function addLine(code = '', desc = '', price = 0) {
  const lines = JSON.parse(localStorage.getItem('elip_current_lines') || '[]');
  lines.push({ code, desc, price });
  localStorage.setItem('elip_current_lines', JSON.stringify(lines));
  renderPreventivo();
}

function removeLine(idx) {
  const lines = JSON.parse(localStorage.getItem('elip_current_lines') || '[]');
  lines.splice(idx, 1);
  localStorage.setItem('elip_current_lines', JSON.stringify(lines));
  renderPreventivo();
}

// =====================
// EVENTI CATALOGO
// =====================
function renderCatalogList() {
  const list = document.getElementById('catalogList');
  const catalog = getCatalog();
  list.innerHTML = '';
  catalog.forEach(x => {
    const li = document.createElement('li');
    li.className = 'list-group-item';
    li.textContent = `${x.code} - ${x.desc}`;
    li.onclick = () => addLine(x.code, x.desc, x.price);
    list.appendChild(li);
  });
}

// =====================
// ARCHIVIO
// =====================
function renderArchiveLocal() {
  const tbody = document.getElementById('archBody');
  const archive = JSON.parse(localStorage.getItem('elip_archive') || '[]');
  tbody.innerHTML = '';
  archive.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r.numero || ''}</td>
      <td>${r.data_invio || ''}</td>
      <td>${r.cliente || ''}</td>
      <td>${r.articolo || ''}</td>
      <td>${r.ddt || ''}</td>
      <td>${(r.totale || 0).toFixed(2)} €</td>
      <td>${r.data_accettazione ? '✅' : '❌'}</td>
      <td>${r.data_scadenza || ''}</td>
      <td>${r.data_accettazione ? '<span class="badge bg-success">OK</span>' : '<span class="badge bg-danger">NO</span>'}</td>
      <td><button class="btn btn-sm btn-outline-primary" onclick="editPreventivo('${r.numero}')">Apri</button></td>
    `;
    tbody.appendChild(tr);
  });
}

// =====================
// INIZIALIZZAZIONE
// =====================
document.addEventListener('DOMContentLoaded', () => {
  buildDatalist();
  renderCatalogList();
  renderPreventivo();

  if (window.loadArchiveSupabase) {
    window.loadArchiveSupabase().then(renderArchiveLocal);
  } else {
    renderArchiveLocal();
  }

  // Pulsanti base
  document.getElementById('btnAddCustom').addEventListener('click', () => addLine('', '', 0));
  document.getElementById('btnReloadArch').addEventListener('click', renderArchiveLocal);
});
