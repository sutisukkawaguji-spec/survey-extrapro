// ============================================================
// map-layers.js — Layer loading, styles, label/overview markers
// ============================================================
'use strict';

function getRandomColor() {
    const c = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f472b6'];
    return c[Math.floor(Math.random() * c.length)];
}

function getFeatureId(f) {
    return f.getProperty('id') || f.getProperty('ID') || f.getId();
}

/* ─── Master style update (called on zoom change, drag, state change) ─── */
function updateMapStyles() {
    if (!map) return;
    const zoom = map.getZoom();
    const showPins = zoom < 16;
    const isTargetFar = isNavigating && distanceToTarget > 500;

    Object.values(mapLayers).forEach(l => {
        const layerVisible = !!l.layer.getMap();
        l.layer.setStyle(f => {
            const id = getFeatureId(f);
            const isTarget = (targetFeature && f === targetFeature)
                || (selectedFeatureId && id && id.toString() === selectedFeatureId.toString());
            const record = surveyRecords.get(id ? id.toString() : null);
            const isDone = record && record.status === 'done';

            if (!layerVisible || (showPins && !isTarget))
                return { fillOpacity: 0, strokeOpacity: 0, clickable: true };

            if (isNavigating) {
                if (isTarget) {
                    if (isTargetFar) return { fillOpacity: 0, strokeOpacity: 0, clickable: true };
                    return { fillColor: isDone ? '#22c55e' : '#3b82f6', fillOpacity: 0.7, strokeColor: 'white', strokeWeight: 3, zIndex: 1000 };
                }
                return { fillColor: '#94a3b8', fillOpacity: 0.1, strokeColor: '#cbd5e1', strokeWeight: 0.5 };
            }
            if (isSurveyMode) {
                if (isTarget) return { fillColor: 'transparent', fillOpacity: 0, strokeColor: '#facc15', strokeWeight: 8, strokeOpacity: 1, zIndex: 1000 };
                return { fillColor: isDone ? '#22c55e' : '#94a3b8', fillOpacity: isDone ? 0.05 : 0.01, strokeColor: isDone ? '#22c55e' : '#cbd5e1', strokeOpacity: 0.1, strokeWeight: 1 };
            }
            // Normal mode — selected parcel has thicker border
            if (isTarget) return { fillColor: isDone ? '#22c55e' : l.color, fillOpacity: 0.55, strokeColor: '#facc15', strokeWeight: 4, zIndex: 900 };
            return { fillColor: isDone ? '#22c55e' : l.color, fillOpacity: 0.35, strokeColor: 'white', strokeWeight: 1.5, clickable: true };
        });
    });

    // Overview pins
    overviewMarkers.forEach(m => {
        const layer = mapLayers[m.layerId];
        const isTarget = targetFeature && getFeatureId(targetFeature) === m.featureId;
        const shouldShow = (showPins && layer && !!layer.layer.getMap())
            || (isNavigating && isTarget && isTargetFar);
        m.marker.setMap(shouldShow ? map : null);
        if (shouldShow) {
            const record = surveyRecords.get(m.featureId ? m.featureId.toString() : null);
            const isDone = record && record.status === 'done';
            const icon = m.marker.getIcon();
            icon.fillColor = isDone ? '#22c55e' : (layer ? layer.color : '#94a3b8');
            icon.scale = isTarget ? 12 : 8;
            icon.fillOpacity = isTarget ? 1 : 0.9;
            m.marker.setIcon(icon);
        }
    });

    // Label markers
    labelMarkers.forEach(m => {
        const layer = mapLayers[m.layerId];
        const isSelected = m.featureId && selectedFeatureId && m.featureId.toString() === selectedFeatureId.toString();
        const visible = layer && !!layer.layer.getMap() && !isNavigating && (zoom >= 16 || isSelected);
        m.marker.setMap(visible ? map : null);
    });
}

/* ─── Load a single GeoJSON layer ─── */
async function loadSingleLayer(idOrUrl, displayName) {
    if (!idOrUrl) return;
    try {
        const res = await AUTH.call('get_map_data', { id: idOrUrl });
        if (res.status !== 'success' || !res.data_string) {
            Swal.fire('ไม่สามารถโหลดแผนที่ได้', res.message || 'ไม่มีข้อมูล', 'warning');
            return;
        }

        let geojson;
        try { geojson = JSON.parse(res.data_string); }
        catch(e) { Swal.fire('Error', `${displayName}: JSON ไม่ถูกต้อง`, 'error'); return; }

        const layerId = 'layer_' + Math.random().toString(36).substr(2, 9);
        const color = getRandomColor();
        const dataLayer = new google.maps.Data();
        const features = dataLayer.addGeoJson(geojson);

        // Layer config (labelProps / searchProps)
        const libInfo = Array.isArray(mapLibrary) ? mapLibrary.find(m => m.url === idOrUrl || m.name === displayName) : null;
        let layerConfig = { labelProps: [], searchProps: [] };
        if (libInfo && libInfo.config) { try { layerConfig = JSON.parse(libInfo.config); } catch(e) {} }

        // Build overview pins and label markers
        features.forEach(f => {
            const b = new google.maps.LatLngBounds();
            if (!f.getGeometry()) return;
            f.getGeometry().forEachLatLng(p => b.extend(p));
            const center = b.getCenter();
            const fid = getFeatureId(f);

            // Overview pin
            const pin = new google.maps.Marker({
                position: center, map: null,
                icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: color, fillOpacity: 0.9, strokeColor: '#ffffff', strokeWeight: 2 },
                zIndex: 500
            });
            pin.addListener('click', () => {
                map.setZoom(18); map.setCenter(center);
                _handleFeatureClick(f, displayName, layerConfig);
            });
            overviewMarkers.push({ marker: pin, featureId: fid, layerId });

            // Label marker
            if (layerConfig.labelProps && layerConfig.labelProps.length > 0) {
                const labelText = layerConfig.labelProps.map(p => f.getProperty(p)).filter(Boolean).join(' ');
                if (labelText) {
                    const lm = new google.maps.Marker({
                        position: center, map: null,
                        icon: { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', size: new google.maps.Size(1,1) },
                        label: { text: labelText, color: 'white', fontSize: '11px', fontWeight: 'bold', className: 'map-label' },
                        clickable: false
                    });
                    labelMarkers.push({ marker: lm, featureId: fid, layerId });
                }
            }
        });

        // Polygon click
        dataLayer.addListener('click', event => {
            _handleFeatureClick(event.feature, displayName, layerConfig);
        });

        dataLayer.setMap(map);
        mapLayers[layerId] = { layer: dataLayer, name: displayName, color, url: idOrUrl };

        const bounds = new google.maps.LatLngBounds();
        dataLayer.forEach(f => { if (f.getGeometry()) f.getGeometry().forEachLatLng(p => bounds.extend(p)); });
        if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 50 });

        const navBtn = document.getElementById('btn-nav-nearest');
        if (navBtn) { navBtn.disabled = false; }

        updateMapStyles();
        updateLayerUI();
    } catch(e) {
        console.error('loadSingleLayer error', e);
        Swal.fire('Error', e.message, 'error');
    }
}

/* ─── Internal: handle parcel click (polygon or overview pin) ─── */
function _handleFeatureClick(f, displayName, layerConfig) {
    selectedFeatureId = getFeatureId(f);
    const b = new google.maps.LatLngBounds();
    if (f.getGeometry()) f.getGeometry().forEachLatLng(p => b.extend(p));
    selectedLocation = b.getCenter();
    currentFeatureForSheet = f;
    currentLayerNameForSheet = displayName;

    // Determine chip label text
    const labelVal = (layerConfig && layerConfig.labelProps && layerConfig.labelProps.length > 0)
        ? layerConfig.labelProps.map(p => f.getProperty(p)).filter(Boolean).join(' ')
        : (selectedFeatureId || 'แปลง');

    // Show floating button + chip (no full sheet yet)
    const sfa = document.getElementById('survey-floating-actions');
    sfa.style.display = 'flex';
    const startBtn = document.getElementById('btn-start-survey');
    startBtn.dataset.mode = 'start';
    startBtn.style.background = '#ea580c';
    startBtn.style.boxShadow = '0 8px 20px rgba(234,88,12,0.3)';
    startBtn.innerHTML = '<i class="fa-solid fa-clipboard-check"></i> <span>เริ่มสำรวจ</span>';

    showParcelChip(labelVal);
    updateMapStyles();
}

/* ─── Toggle layer visibility ─── */
function toggleLayer(id, visible) {
    if (mapLayers[id]) {
        mapLayers[id].layer.setMap(visible ? map : null);
        updateMapStyles();
    }
}

/* ─── Refresh survey record colours ─── */
async function refreshData() {
    try {
        const res = await AUTH.call('getSurveyRecords', { project_id: currentProject.id });
        if (res.status === 'success') {
            surveyRecords.clear();
            res.records.forEach(r => surveyRecords.set(r.feature_id.toString(), r));
            updateMapStyles();
            renderSurveyMarkers();
        }
    } catch(err) { console.error(err); }
}

/* ─── Render green dots for completed parcels ─── */
function renderSurveyMarkers() {
    recordMarkers.forEach(m => m.setMap(null));
    recordMarkers = [];
    surveyRecords.forEach((r, id) => {
        if (!r.lat || !r.lng) return;
        const m = new google.maps.Marker({
            position: { lat: r.lat, lng: r.lng },
            map: null,
            icon: { url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png' }
        });
        m.addListener('click', () => _showRecordPopup(r, id, m));
        m._featureId = id;
        recordMarkers.push(m);
    });
}

function _showRecordPopup(r, id, marker) {
    Swal.fire({
        title: 'บันทึกการสำรวจ',
        html: `<div class="text-left text-sm">
            <b>ผู้สำรวจ:</b> ${r.surveyor || r.username || '-'}<br>
            <b>บันทึก:</b> ${r.note || '-'}<br>
            ${r.photo_url ? `<img src="${r.photo_url}" class="mt-2 rounded-lg w-full">` : ''}
        </div>`,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-trash-can mr-1"></i> ลบข้อมูล',
        confirmButtonColor: '#ef4444',
        cancelButtonText: 'ปิด'
    }).then(async res => {
        if (!res.isConfirmed) return;
        showLoading(true, 'กำลังลบข้อมูล...');
        try {
            await AUTH.call('saveSurveyRecord', {
                project_id: currentProject.id, feature_id: id,
                username: user.username, status: 'deleted',
                note: '', photo_url: '', shapes: '[]'
            });
            await refreshData();
            marker.setMap(null);
            Swal.fire({ toast: true, position: 'top', icon: 'success', title: 'ลบข้อมูลแล้ว', timer: 1500, showConfirmButton: false });
        } catch(e) { Swal.fire('Error', e.message, 'error'); }
        finally { showLoading(false); }
    });
}
