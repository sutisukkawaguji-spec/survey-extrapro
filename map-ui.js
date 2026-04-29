// ============================================================
// map-ui.js — UI helpers: loading, chip, sheet, style updates
// ============================================================
'use strict';

/* ─── Loading overlay ─── */
function showLoading(show, text = '') {
    if (show) Swal.fire({ title: text, allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    else Swal.close();
}

/* ─── Parcel chip (shows selected parcel label) ─── */
function showParcelChip(labelText) {
    const chip = document.getElementById('parcel-chip');
    document.getElementById('chip-label').textContent = labelText;
    chip.style.display = 'flex';
}
function hideParcelChip() {
    const chip = document.getElementById('parcel-chip');
    if (chip) chip.style.display = 'none';
}

/* ─── Deselect parcel (X on chip) ─── */
function deselectParcel() {
    hideParcelChip();
    document.getElementById('survey-floating-actions').style.display = 'none';
    selectedFeatureId = null;
    currentFeatureForSheet = null;
    updateMapStyles();
}

/* ─── Open full detail sheet from chip "..." button ─── */
function openSheetForSelected() {
    if (!currentFeatureForSheet) return;
    openSurveySheet(currentFeatureForSheet, currentLayerNameForSheet);
}

/* ─── Survey Sheet ─── */
function openSurveySheet(f, layerName) {
    const props = [];
    const p = f.getProperty('properties') || {};

    // Pull label and key from layer config
    const libInfo = Array.isArray(mapLibrary) ? mapLibrary.find(m => m.name === layerName) : null;
    let cfg = { labelProps: [], searchProps: [] };
    if (libInfo && libInfo.config) { try { cfg = JSON.parse(libInfo.config); } catch(e) {} }

    // Summary cards
    const labelVal = (cfg.labelProps.length > 0)
        ? cfg.labelProps.map(k => f.getProperty(k)).filter(Boolean).join(' ')
        : (p['Land number'] || p['Land numbe'] || p.plot_no || p.Name || f.getProperty('Name') || selectedFeatureId || '-');
    const keyVal = cfg.searchProps.length > 0
        ? cfg.searchProps.map(k => f.getProperty(k)).filter(Boolean).join(' ') : '';

    document.getElementById('parcel-details').innerHTML = `
        <div class="detail-grid">
            <div class="detail-card">
                <div class="dc-label">แปลง (Label)</div>
                <div class="dc-value">${labelVal}</div>
            </div>
            <div class="detail-card">
                <div class="dc-label">คีย์ค้นหา</div>
                <div class="dc-value">${keyVal || '-'}</div>
            </div>
        </div>`;

    // Raw property rows
    let rawHtml = '';
    f.forEachProperty((v, k) => {
        if (typeof v !== 'object' && k !== 'properties')
            rawHtml += `<div class="raw-row"><span class="raw-key">${k}</span><span class="raw-val">${v}</span></div>`;
    });
    const rawEl = document.getElementById('parcel-raw');
    if (rawEl) rawEl.innerHTML = rawHtml || '<p style="font-size:12px;color:#94a3b8">ไม่มีข้อมูล</p>';
    document.getElementById('sheet-title').innerText = 'แปลง: ' + labelVal;
    currentFeatureForSheet = f;
    currentLayerNameForSheet = layerName;

    // Reset survey toggle button
    const startBtn = document.getElementById('btn-start-survey');
    startBtn.dataset.mode = 'start';
    startBtn.style.background = '#ea580c';
    startBtn.style.boxShadow = '0 8px 20px rgba(234,88,12,0.3)';
    startBtn.innerHTML = '<i class="fa-solid fa-clipboard-check"></i> <span>เริ่มสำรวจ</span>';
    document.getElementById('survey-floating-actions').style.display = 'flex';

    // Pre-fill note
    const r = selectedFeatureId ? surveyRecords.get(selectedFeatureId.toString()) : null;
    if (!r || !r.note) {
        const parts = cfg.searchProps.map(k => `${k}: ${f.getProperty(k) || '-'}`);
        document.getElementById('sheet-note').value = parts.join('\n');
    } else {
        document.getElementById('sheet-note').value = r.note;
    }
    document.getElementById('sheet-primary-user').value = '';
    if (cfg.searchProps.length > 0)
        document.getElementById('sheet-primary-user').value = f.getProperty(cfg.searchProps[0]) || '';

    document.getElementById('img-preview').style.display = 'none';
    if (r && r.photo_url) {
        document.getElementById('img-preview').src = r.photo_url;
        document.getElementById('img-preview').style.display = 'block';
    }
    document.getElementById('survey-form-container').classList.remove('hidden');
    document.getElementById('sheet').classList.add('active');
}

function closeSheet() {
    document.getElementById('sheet').classList.remove('active');
    document.getElementById('survey-floating-actions').style.display = 'none';
    document.getElementById('survey-form-container').classList.add('hidden');
    hideParcelChip();

    const btn = document.getElementById('btn-start-survey');
    btn.dataset.mode = 'start';
    btn.style.background = '#ea580c';
    btn.style.boxShadow = '0 8px 20px rgba(234,88,12,0.3)';
    btn.innerHTML = '<i class="fa-solid fa-clipboard-check"></i> <span>เริ่มสำรวจ</span>';

    startSurveyMode(false);
    selectedFeatureId = null;
    currentFeatureForSheet = null;

    recordMarkers.forEach(m => m.setMap(null));
    clearSurveyDrawings();
    updateMapStyles();
}

function previewPhoto(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = e => {
            const img = document.getElementById('img-preview');
            img.src = e.target.result;
            img.style.display = 'block';
        };
        reader.readAsDataURL(input.files[0]);
    }
}

/* ─── Layer list UI ─── */
function updateLayerUI() {
    const list = document.getElementById('layer-list-bottom');
    if (!list) return;
    list.innerHTML = '';
    Object.keys(mapLayers).forEach(id => {
        const l = mapLayers[id];
        list.innerHTML += `
            <label class="flex justify-between items-center p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 border border-gray-100 transition-all">
                <div class="flex items-center gap-3">
                    <div class="w-3 h-3 rounded-full" style="background-color:${l.color}"></div>
                    <span class="text-[12px] font-bold text-gray-700 truncate w-48">${l.name}</span>
                </div>
                <input type="checkbox" checked onchange="toggleLayer('${id}', this.checked)" class="w-5 h-5 accent-blue-600">
            </label>`;
    });
}

function toggleLayerSheet(open) {
    document.getElementById('layer-sheet').classList.toggle('active', open);
}
