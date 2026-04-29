// ============================================================
// map-drawing.js — Drawing manager, general drawings, GPS, navigation
// ============================================================
'use strict';

/* ─── Drawing toolbar toggle ─── */
function toggleDrawingBar() {
    document.getElementById('btn-draw').classList.toggle('active');
    document.getElementById('drawing-bar').classList.toggle('active');
}

function setDrawingMode(mode) {
    if (currentDrawingMode === mode) mode = null;
    currentDrawingMode = mode;
    document.querySelectorAll('.draw-btn').forEach(b => b.classList.remove('active'));
    if (!mode) { drawingManager.setDrawingMode(null); return; }
    document.getElementById('draw-' + mode).classList.add('active');
    const gMode = mode === 'marker'   ? google.maps.drawing.OverlayType.MARKER
                : mode === 'polygon'  ? google.maps.drawing.OverlayType.POLYGON
                : mode === 'polyline' ? google.maps.drawing.OverlayType.POLYLINE : null;
    drawingManager.setDrawingMode(gMode);
}

/* ─── Setup drawing manager ─── */
function setupDrawingManager() {
    drawingManager = new google.maps.drawing.DrawingManager({
        drawingControl: false,
        markerOptions:  { icon: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' },
        polygonOptions: { fillColor: '#2563eb', fillOpacity: 0.3, strokeWeight: 2, strokeColor: '#2563eb' }
    });
    drawingManager.setMap(map);

    google.maps.event.addListener(drawingManager, 'overlaycomplete', async event => {
        const shape = event.overlay;
        shape.type = event.type;
        setDrawingMode(null);

        // ── Survey mode: add to activeSurveyDrawings ──
        if (isSurveyMode) {
            activeSurveyDrawings.push(shape);
            showSurveyShapePopup(shape);
            shape.addListener('click', () => showSurveyShapePopup(shape));
            return;
        }

        // ── General drawing mode ──
        let areaText = '';
        if (event.type === 'polygon') {
            const sqm  = google.maps.geometry.spherical.computeArea(shape.getPath());
            const sqwa = sqm / 4;
            const rai  = Math.floor(sqwa / 400);
            const ngan = Math.floor((sqwa % 400) / 100);
            areaText   = `\nเนื้อที่ประมาณ: ${rai} ไร่ ${ngan} งาน ${(sqwa % 100).toFixed(1)} วา`;
        }

        const { value: form } = await Swal.fire({
            title: 'บันทึกข้อมูลการวาด',
            html: `
                <input id="draw-name" class="swal2-input" placeholder="ชื่อแปลง / เลขที่ดิน">
                <textarea id="draw-note" class="swal2-textarea" placeholder="รายละเอียด/หมายเหตุ">${areaText}</textarea>
                <input type="file" id="draw-photo" class="swal2-file" accept="image/*">
            `,
            showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ลบ',
            preConfirm: () => ({
                name:  document.getElementById('draw-name').value,
                note:  document.getElementById('draw-note').value,
                photo: document.getElementById('draw-photo').files[0]
            })
        });

        if (form) {
            showLoading(true, 'กำลังบันทึก...');
            let photoUrl = '';
            if (form.photo) photoUrl = await AUTH.uploadImage(form.photo);
            shape.details = { name: form.name, note: form.note, photo: photoUrl };
            shape.addListener('click', () => _showGeneralShapePopup(shape, event.type));
            drawnItems.push(shape);
            saveDrawnItemsToProject();
            showLoading(false);
            Swal.fire({ toast: true, position: 'top', icon: 'success', title: 'บันทึกรูปวาดแล้ว', timer: 2000, showConfirmButton: false });
        } else {
            shape.setMap(null);
        }
    });
}

function _showGeneralShapePopup(shape, type) {
    const d = shape.details || {};
    const content = `<div class="p-3 text-xs">
        <b class="text-blue-600 text-sm">${d.name || 'รูปวาด'}</b><br>
        <div class="mt-2 text-gray-600">${(d.note || '').replace(/\n/g, '<br>')}</div>
        ${d.photo ? `<img src="${d.photo}" class="mt-2 rounded-lg w-full shadow-sm">` : ''}
        <button onclick="deleteDrawnItem(this._shape)" class="mt-2 w-full bg-red-50 text-red-500 text-xs py-1.5 rounded-lg border border-red-100">
            <i class="fa-solid fa-trash mr-1"></i> ลบรูปวาดนี้
        </button>
    </div>`;
    infoWindow.setContent(content);
    if (type === 'marker') infoWindow.open(map, shape);
    else {
        const b = new google.maps.LatLngBounds();
        shape.getPath().forEach(p => b.extend(p));
        infoWindow.setPosition(b.getCenter());
        infoWindow.open(map);
    }
    // attach shape ref so delete button can access it
    setTimeout(() => {
        const btn = document.querySelector('.gm-style-iw button.mt-2');
        if (btn) btn._shape = shape;
    }, 100);
}

function deleteDrawnItem(shape) {
    if (!shape) return;
    shape.setMap(null);
    drawnItems = drawnItems.filter(s => s !== shape);
    infoWindow.close();
    saveDrawnItemsToProject();
}

/* ─── Save/restore general drawings ─── */
function saveDrawnItemsToProject() {
    const data = drawnItems.map(item => {
        let type = 'marker', coords = [];
        if (item instanceof google.maps.Polygon) {
            type = 'polygon'; item.getPath().forEach(p => coords.push({ lat: p.lat(), lng: p.lng() }));
        } else if (item instanceof google.maps.Polyline) {
            type = 'polyline'; item.getPath().forEach(p => coords.push({ lat: p.lat(), lng: p.lng() }));
        } else {
            coords = { lat: item.getPosition().lat(), lng: item.getPosition().lng() };
        }
        return { type, coords, details: item.details };
    });
    currentProject.data = data;
    localStorage.setItem('survey_current_project_info', JSON.stringify(currentProject));
    AUTH.call('saveProject', currentProject).catch(e => console.error('Auto-save failed', e));
}

function restoreDrawnItems() {
    if (!currentProject.data) return;
    currentProject.data.forEach(item => {
        let shape;
        if (item.type === 'marker') {
            shape = new google.maps.Marker({ position: item.coords, map, icon: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' });
        } else if (item.type === 'polygon') {
            shape = new google.maps.Polygon({ paths: item.coords, map, fillColor: '#2563eb', fillOpacity: 0.3, strokeWeight: 2, strokeColor: '#2563eb' });
        } else if (item.type === 'polyline') {
            shape = new google.maps.Polyline({ path: item.coords, map, strokeColor: '#2563eb', strokeWeight: 2 });
        }
        if (shape) {
            shape.type = item.type;
            shape.details = item.details;
            shape.addListener('click', () => _showGeneralShapePopup(shape, item.type));
            drawnItems.push(shape);
        }
    });
}

function clearDrawings(clearPersistent = true) {
    clearSurveyDrawings();
    if (clearPersistent) { drawnItems.forEach(s => s.setMap(null)); drawnItems = []; }
}

/* ─── GPS ─── */
function setupGPS() {
    if (!navigator.geolocation) return;
    navigator.geolocation.watchPosition(p => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        if (!userMarker) {
            userMarker = new google.maps.Marker({
                position: pos, map,
                icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#2563eb', fillOpacity: 1, strokeColor: 'white', strokeWeight: 2 }
            });
        } else userMarker.setPosition(pos);
        if (isFollowing) map.setCenter(pos);

        // Auto-prompt at 500m
        if (isNavigating && targetFeature) {
            const endLoc = directionsRenderer.getDirections()?.routes[0]?.legs[0]?.end_location;
            if (endLoc) {
                const newDist = google.maps.geometry.spherical.computeDistanceBetween(new google.maps.LatLng(pos), endLoc);
                const wasFar = distanceToTarget > 500;
                distanceToTarget = newDist;
                if (wasFar && newDist <= 500 && !isSurveyMode) {
                    _showSurveyPrompt();
                    updateMapStyles();
                }
            }
        }
    }, null, { enableHighAccuracy: true });
}

function toggleGPSFollow() {
    isFollowing = !isFollowing;
    const btn = document.getElementById('btn-gps-native');
    if (btn) btn.classList.toggle('active', isFollowing);
    if (isFollowing && userMarker) { map.setCenter(userMarker.getPosition()); map.setZoom(18); }
}

let _surveyPromptShown = false;
function _showSurveyPrompt() {
    if (_surveyPromptShown) return;
    _surveyPromptShown = true;
    Swal.fire({
        title: 'เข้าใกล้แปลงเป้าหมาย',
        text: 'คุณอยู่ในระยะ 500 ม. ต้องการเริ่มสำรวจ?',
        icon: 'info', showCancelButton: true,
        confirmButtonText: 'เริ่มสำรวจ', cancelButtonText: 'นำทางต่อ'
    }).then(r => { if (r.isConfirmed) expandSurveyForm(); else _surveyPromptShown = false; });
}

/* ─── Navigation to nearest unsurveyed parcel ─── */
function navigateToNearest() {
    if (!userMarker) return Swal.fire('Error', 'ไม่พบตำแหน่ง GPS', 'error');
    const userPos = userMarker.getPosition();
    let nearest = null, nearestFeature = null, nearestName = '', minD = Infinity;

    Object.values(mapLayers).forEach(l => {
        l.layer.forEach(f => {
            const id = getFeatureId(f);
            if (surveyRecords.has(id ? id.toString() : null)) return;
            const b = new google.maps.LatLngBounds();
            if (!f.getGeometry()) return;
            f.getGeometry().forEachLatLng(p => b.extend(p));
            const c = b.getCenter();
            const d = google.maps.geometry.spherical.computeDistanceBetween(userPos, c);
            if (d < minD) { minD = d; nearest = c; nearestFeature = f; nearestName = l.name; }
        });
    });

    if (!nearest) { Swal.fire('สำเร็จ', 'สำรวจครบทุกแปลงแล้ว!', 'success'); return; }

    Swal.fire({
        title: 'นำทางแปลงใกล้สุด',
        text: `ห่าง ${Math.round(minD)} ม. — ${nearestName}`,
        icon: 'question', showCancelButton: true,
        confirmButtonText: 'นำทาง', cancelButtonText: 'ยกเลิก'
    }).then(r => {
        if (!r.isConfirmed) return;
        isNavigating = true;
        targetFeature = nearestFeature;
        selectedFeatureId = getFeatureId(nearestFeature);
        surveyPromptShown = false;
        distanceToTarget = minD;
        updateMapStyles();

        directionsService.route({
            origin: userPos,
            destination: nearest,
            travelMode: google.maps.TravelMode.DRIVING
        }, (result, status) => {
            if (status === 'OK') {
                directionsRenderer.setDirections(result);
                document.getElementById('btn-nav-clear').classList.remove('hidden');
                Swal.fire({ toast: true, position: 'top', icon: 'info', title: `นำทางไปยัง ${nearestName}`, timer: 3000, showConfirmButton: false });
            } else {
                Swal.fire('Error', 'คำนวณเส้นทางไม่ได้', 'error');
            }
        });
    });
}

function clearNavigation() {
    if (directionsRenderer) directionsRenderer.setDirections({ routes: [] });
    isNavigating = false; isSurveyMode = false;
    targetFeature = null; surveyPromptShown = false;
    distanceToTarget = Infinity;
    _surveyPromptShown = false;
    updateMapStyles();
    document.getElementById('btn-nav-clear').classList.add('hidden');
}

/* ─── Search ─── */
function handleSearch(query) {
    const resultsDiv = document.getElementById('search-results');
    if (!query || query.length < 2) { resultsDiv.classList.add('hidden'); return; }

    let html = '';
    Object.keys(mapLayers).forEach(layerId => {
        const l = mapLayers[layerId];
        const libInfo = Array.isArray(mapLibrary) ? mapLibrary.find(m => m.url === l.url || m.name === l.name) : null;
        let searchProps = [];
        if (libInfo && libInfo.config) { try { searchProps = JSON.parse(libInfo.config).searchProps || []; } catch(e) {} }

        l.layer.forEach(f => {
            const matched = searchProps.some(p => String(f.getProperty(p) || '').toLowerCase().includes(query.toLowerCase()));
            if (!matched) return;
            const label = searchProps.map(p => f.getProperty(p)).filter(Boolean).join(' ') || 'แปลง';
            html += `<div class="search-item" onclick="goToFeature('${layerId}','${getFeatureId(f)}')">
                <i class="fa-solid fa-map-location-dot text-blue-500"></i>
                <div class="flex-1">
                    <div class="text-[10px] font-bold">${label}</div>
                    <div class="text-[8px] text-gray-400">${l.name}</div>
                </div>
            </div>`;
        });
    });

    if (!autocompleteService) { resultsDiv.innerHTML = html; resultsDiv.classList.toggle('hidden', !html); return; }
    autocompleteService.getPlacePredictions({ input: query, bounds: map.getBounds() }, predictions => {
        (predictions || []).forEach(p => {
            html += `<div class="search-item" onclick="goToPlace('${p.place_id}')">
                <i class="fa-solid fa-location-dot text-red-500"></i>
                <div class="flex-1">
                    <div class="text-[10px] font-bold">${p.structured_formatting.main_text}</div>
                    <div class="text-[8px] text-gray-400">${p.structured_formatting.secondary_text}</div>
                </div>
            </div>`;
        });
        resultsDiv.innerHTML = html;
        resultsDiv.classList.toggle('hidden', !html);
    });
}

window.goToFeature = (layerId, featureId) => {
    const l = mapLayers[layerId]; if (!l) return;
    l.layer.forEach(f => {
        if (String(getFeatureId(f)) === String(featureId)) {
            const b = new google.maps.LatLngBounds();
            if (f.getGeometry()) f.getGeometry().forEachLatLng(p => b.extend(p));
            map.fitBounds(b);
            selectedFeatureId = featureId;
            selectedLocation = b.getCenter();
            const libInfo = Array.isArray(mapLibrary) ? mapLibrary.find(m => m.name === l.name) : null;
            let cfg = { labelProps: [], searchProps: [] };
            if (libInfo && libInfo.config) { try { cfg = JSON.parse(libInfo.config); } catch(e) {} }
            _handleFeatureClick(f, l.name, cfg);
            document.getElementById('search-results').classList.add('hidden');
            document.getElementById('pac-input').value = '';
        }
    });
};

window.goToPlace = (placeId) => {
    if (!placesService) return;
    placesService.getDetails({ placeId }, (place, status) => {
        if (status === 'OK' && place.geometry) {
            if (place.geometry.viewport) map.fitBounds(place.geometry.viewport);
            else { map.setCenter(place.geometry.location); map.setZoom(17); }
            document.getElementById('search-results').classList.add('hidden');
            document.getElementById('pac-input').value = '';
        }
    });
};
