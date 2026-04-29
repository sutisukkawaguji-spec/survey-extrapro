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
        const libInfo = Array.isArray(mapLibrary) ? mapLibrary.find(m => m.name === l.name) : null;
        let cfg = { labelProps: [], searchProps: [], filterProps: [] };
        if (libInfo && libInfo.config) { try { cfg = JSON.parse(libInfo.config); } catch(e) {} }
        const filterTag = cfg.filterProps && cfg.filterProps.length > 0
            ? `<span style="font-size:9px;background:#fef9c3;color:#854d0e;border-radius:6px;padding:2px 6px;font-weight:700;">กรองได้: ${cfg.filterProps.join(', ')}</span>`
            : '';
        list.innerHTML += `
            <div style="background:#f8fafc;border-radius:14px;padding:10px 12px;border:1px solid #e2e8f0;display:flex;align-items:center;gap:10px;">
                <div style="width:12px;height:12px;border-radius:50%;background:${l.color};flex-shrink:0"></div>
                <div style="flex:1;min-width:0;">
                    <div style="font-size:12px;font-weight:700;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${l.name}</div>
                    ${filterTag}
                </div>
                <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
                    <button onclick="openEditMapLibDialog('${l.name}')"
                        style="width:30px;height:30px;border-radius:9px;background:#eff6ff;border:none;color:#2563eb;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;"
                        title="แก้ไขการตั้งค่า">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <input type="checkbox" checked onchange="toggleLayer('${id}', this.checked)"
                        style="width:20px;height:20px;accent-color:#2563eb;cursor:pointer;">
                </div>
            </div>`;
    });
}

/* ─── Filter layer features by filterProps ─── */
function applyLayerFilter(query) {
    const q = (query || '').toLowerCase().trim();
    Object.keys(mapLayers).forEach(id => {
        const l = mapLayers[id];
        const libInfo = Array.isArray(mapLibrary) ? mapLibrary.find(m => m.name === l.name) : null;
        let filterProps = [];
        if (libInfo && libInfo.config) {
            try { filterProps = JSON.parse(libInfo.config).filterProps || []; } catch(e) {}
        }
        if (filterProps.length === 0) return; // no filter config → skip

        l.layer.setStyle(f => {
            if (!q) return null; // null = use default style
            const matched = filterProps.some(p =>
                String(f.getProperty(p) || '').toLowerCase().includes(q)
            );
            if (matched) return null; // show normally
            return { fillOpacity: 0, strokeOpacity: 0, clickable: false };
        });
    });
    if (!q) updateMapStyles(); // restore normal styles when cleared
}

/* ─── Open edit dialog for a Map Library entry (from map.html layer sheet) ─── */
async function openEditMapLibDialog(name) {
    const libInfo = Array.isArray(mapLibrary) ? mapLibrary.find(m => m.name === name) : null;
    if (!libInfo) return Swal.fire('Error', 'ไม่พบข้อมูลแผนที่', 'error');

    let cfg = { labelProps: [], searchProps: [], filterProps: [] };
    if (libInfo.config) { try { cfg = JSON.parse(libInfo.config); } catch(e) {} }

    // Load properties from the layer
    let props = [];
    try {
        const r = await AUTH.call('get_map_data', { id: libInfo.url });
        if (r.status === 'success' && r.data_string) {
            const gj = JSON.parse(r.data_string);
            const feat = (gj.features || [])[0];
            props = Object.keys((feat && feat.properties) || {});
        }
    } catch(e) {}

    if (props.length === 0) {
        return Swal.fire('คำเตือน', 'ไม่สามารถอ่านคอลัมน์ได้', 'warning');
    }

    let html = `
        <div style="text-align:left;font-size:12px;color:#64748b;margin-bottom:10px;">
            แผนที่: <b>${name}</b>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:4px;background:#f1f5f9;padding:8px 10px;font-size:10px;font-weight:700;color:#64748b;">
                <div>คอลัมน์</div>
                <div style="color:#2563eb">① ลาเบล</div>
                <div style="color:#16a34a">② ค้นหา</div>
                <div style="color:#d97706">③ กรอง</div>
            </div>
            <div style="max-height:200px;overflow-y:auto;">`;

    props.forEach(p => {
        html += `
            <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:4px;align-items:center;padding:7px 10px;border-top:1px solid #f1f5f9;">
                <div style="font-size:11px;font-weight:600;color:#334155;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p}</div>
                <div style="text-align:center;padding-right:6px;"><input type="checkbox" name="ep-label" value="${p}" ${cfg.labelProps.includes(p)?'checked':''} style="accent-color:#2563eb;width:16px;height:16px;cursor:pointer;"></div>
                <div style="text-align:center;padding-right:6px;"><input type="checkbox" name="ep-search" value="${p}" ${cfg.searchProps.includes(p)?'checked':''} style="accent-color:#16a34a;width:16px;height:16px;cursor:pointer;"></div>
                <div style="text-align:center;"><input type="checkbox" name="ep-filter" value="${p}" ${(cfg.filterProps||[]).includes(p)?'checked':''} style="accent-color:#d97706;width:16px;height:16px;cursor:pointer;"></div>
            </div>`;
    });
    html += `</div></div>`;

    const { value: result } = await Swal.fire({
        title: `<span style="font-size:15px">แก้ไขการตั้งค่า</span>`,
        html, width: '95vw', showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-save mr-1"></i> บันทึก',
        cancelButtonText: 'ยกเลิก',
        preConfirm: () => ({
            labels:   Array.from(document.querySelectorAll('input[name="ep-label"]:checked')).map(el => el.value),
            searches: Array.from(document.querySelectorAll('input[name="ep-search"]:checked')).map(el => el.value),
            filters:  Array.from(document.querySelectorAll('input[name="ep-filter"]:checked')).map(el => el.value)
        })
    });

    if (!result) return;
    showLoading(true, 'กำลังบันทึก...');
    try {
        const newCfg = { labelProps: result.labels, searchProps: result.searches, filterProps: result.filters };
        await AUTH.call('saveMapToLibrary', { name: libInfo.name, url: libInfo.url, config: JSON.stringify(newCfg) });
        // Update local mapLibrary cache
        const idx = mapLibrary.findIndex(m => m.name === name);
        if (idx >= 0) mapLibrary[idx].config = JSON.stringify(newCfg);
        updateLayerUI();
        showLoading(false);
        Swal.fire({ toast: true, position: 'top', icon: 'success', title: 'บันทึกแล้ว', timer: 1800, showConfirmButton: false });
    } catch(e) {
        showLoading(false);
        Swal.fire('Error', e.message, 'error');
    }
}

function toggleLayerSheet(open) {
    document.getElementById('layer-sheet').classList.toggle('active', open);
    if (!open) {
        // Clear filter when closing
        const fi = document.getElementById('layer-filter-input');
        if (fi) fi.value = '';
        applyLayerFilter('');
    }
}
