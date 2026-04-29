// ============================================================
// map-survey.js — Survey workflow: toggle, expand, finish, drawing popup
// ============================================================
'use strict';

/* ─── Main toggle button handler ─── */
function handleSurveyToggle() {
    const btn = document.getElementById('btn-start-survey');
    if (btn.dataset.mode === 'finish') {
        handleFinishSurvey();
    } else {
        expandSurveyForm();
    }
}

/* ─── Enter survey mode (เริ่มสำรวจ) ─── */
function expandSurveyForm() {
    if (!currentFeatureForSheet) {
        openSheetForSelected();
        return;
    }
    // Open detail sheet if not already open
    if (!document.getElementById('sheet').classList.contains('active')) {
        openSurveySheet(currentFeatureForSheet, currentLayerNameForSheet);
    }

    // Switch button to "สำรวจเสร็จสิ้น"
    const btn = document.getElementById('btn-start-survey');
    btn.dataset.mode = 'finish';
    btn.style.background = '#10b981';
    btn.style.boxShadow = '0 8px 20px rgba(16,185,129,0.35)';
    btn.innerHTML = '<i class="fa-solid fa-flag-checkered"></i> <span>สำรวจเสร็จสิ้น</span>';

    // Enter survey drawing mode
    startSurveyMode(true);
}

/* ─── Exit survey mode (สำรวจเสร็จสิ้น) ─── */
async function handleFinishSurvey() {
    const note = document.getElementById('sheet-note').value;
    const primaryUser = document.getElementById('sheet-primary-user').value;
    const photoFile = document.getElementById('inp-photo').files[0];

    const shapes = collectCurrentShapes();
    const hasShapes = shapes.length > 0;

    // Nothing at all → warn
    if (!hasShapes && !note.trim() && !photoFile) {
        await Swal.fire({
            title: 'ยังไม่มีข้อมูลการสำรวจ',
            text: 'กรุณาปักหมุด, วาดรูป, หรือกรอกบันทึกก่อนบันทึกการสำรวจ',
            icon: 'warning', confirmButtonText: 'ตกลง'
        });
        return;
    }

    showLoading(true, 'กำลังบันทึกข้อมูลสำรวจ...');
    try {
        let photoUrl = '';
        const existing = surveyRecords.get(selectedFeatureId ? selectedFeatureId.toString() : '');
        if (existing) photoUrl = existing.photo_url || '';
        if (photoFile) photoUrl = await AUTH.uploadImage(photoFile);

        // lat/lng from first placed marker (not parcel centre)
        let saveLat = 0, saveLng = 0;
        const markerShape = shapes.find(s => s.type === 'marker');
        if (markerShape && markerShape.position) {
            saveLat = markerShape.position.lat;
            saveLng = markerShape.position.lng;
        }

        const surveyStatus = hasShapes ? 'done' : 'in_progress';

        const res = await AUTH.call('saveSurveyRecord', {
            project_id: currentProject.id,
            feature_id: selectedFeatureId,
            username: user.username,
            status: surveyStatus,
            lat: saveLat, lng: saveLng,
            photo_url: photoUrl,
            note: note,
            primary_user: primaryUser,
            shapes: JSON.stringify(shapes)
        });

        if (res.status === 'success') {
            await refreshData();
            closeSheet();
            deselectParcel();
            clearSurveyDrawings();
            showLoading(false);
            const msg = hasShapes ? 'เสร็จสิ้นการสำรวจแปลงนี้แล้ว! 🏁' : 'บันทึกหมายเหตุแล้ว (ยังไม่มีหมุด/รูปวาด)';
            Swal.fire({ toast: true, position: 'top', icon: 'success', title: msg, timer: 2500, showConfirmButton: false });
        } else {
            showLoading(false);
            Swal.fire('Error', res.message || 'บันทึกไม่สำเร็จ', 'error');
        }
    } catch(err) {
        showLoading(false);
        Swal.fire('Error', err.message, 'error');
    }
}

/* ─── Survey drawing mode (opens/closes drawing toolbar) ─── */
function startSurveyMode(active) {
    isSurveyMode = active;
    updateMapStyles();
    const bar = document.getElementById('drawing-bar');
    const btn = document.getElementById('btn-draw');
    if (active) {
        bar && bar.classList.add('active');
        btn && btn.classList.add('active');
    } else {
        bar && bar.classList.remove('active');
        btn && btn.classList.remove('active');
    }
}

/* ─── Collect shapes from active survey drawings ─── */
function collectCurrentShapes() {
    return activeSurveyDrawings.map(s => {
        const item = { type: s.type, photo: s.photo || '', note: s.note || '' };
        if (s.type === 'marker') item.position = { lat: s.getPosition().lat(), lng: s.getPosition().lng() };
        else if (s.type === 'polygon' || s.type === 'polyline') item.path = s.getPath().getArray().map(p => ({ lat: p.lat(), lng: p.lng() }));
        return item;
    });
}

/* ─── Clear only survey-mode drawings ─── */
function clearSurveyDrawings() {
    activeSurveyDrawings.forEach(s => s.setMap(null));
    activeSurveyDrawings = [];
}

/* ─── Survey-mode drawing popup (shown when marker/polygon placed) ─── */
function showSurveyShapePopup(shape) {
    // Pull parcel info from focused feature
    let parcelLabel = '', parcelKey = '';
    if (currentFeatureForSheet && currentLayerNameForSheet) {
        const libInfo = Array.isArray(mapLibrary) ? mapLibrary.find(m => m.name === currentLayerNameForSheet) : null;
        if (libInfo && libInfo.config) {
            try {
                const cfg = JSON.parse(libInfo.config);
                if (cfg.labelProps && cfg.labelProps.length > 0)
                    parcelLabel = cfg.labelProps.map(p => currentFeatureForSheet.getProperty(p)).filter(Boolean).join(' ');
                if (cfg.searchProps && cfg.searchProps.length > 0)
                    parcelKey = cfg.searchProps.map(p => currentFeatureForSheet.getProperty(p)).filter(Boolean).join(' ');
            } catch(e) {}
        }
    }

    const content = document.createElement('div');
    content.className = 'p-3 flex flex-col gap-2';
    content.style.minWidth = '230px';
    content.innerHTML = `
        <div class="text-[11px] font-bold text-blue-700 flex items-center gap-1 mb-1">
            <i class="fa-solid fa-map-pin"></i> <span>บันทึกการสำรวจ</span>
        </div>
        ${parcelLabel ? `<div class="text-[11px] bg-blue-50 rounded-lg px-3 py-2 text-blue-800 font-bold">แปลง: ${parcelLabel}</div>` : ''}
        ${parcelKey   ? `<div class="text-[11px] bg-gray-50 rounded-lg px-3 py-2 text-gray-600">คีย์: ${parcelKey}</div>` : ''}
        <textarea class="shape-note text-xs border rounded-lg px-2 py-1.5 resize-none" rows="2"
            placeholder="รายละเอียด / หมายเหตุ...">${shape.note || ''}</textarea>
        <div class="flex gap-2">
            <button class="camera-btn flex-1 bg-indigo-600 text-white px-2 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                <i class="fa-solid fa-camera"></i> ถ่ายภาพ
            </button>
            <button class="delete-btn bg-red-50 text-red-500 px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center border border-red-100">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
        <input type="file" class="shape-photo-input hidden" accept="image/*" capture="environment">
        ${shape.photo ? `<img src="${shape.photo}" class="w-full h-28 object-cover rounded-lg border shadow-sm mt-1">` : ''}
    `;

    // Note binding
    content.querySelector('.shape-note').addEventListener('input', e => { shape.note = e.target.value; });

    // Camera
    content.querySelector('.camera-btn').onclick = () => content.querySelector('.shape-photo-input').click();

    // Delete
    content.querySelector('.delete-btn').onclick = () => {
        shape.setMap(null);
        activeSurveyDrawings = activeSurveyDrawings.filter(s => s !== shape);
        infoWindow.close();
    };

    // Photo upload
    content.querySelector('.shape-photo-input').onchange = async e => {
        if (!e.target.files || !e.target.files[0]) return;
        showLoading(true, 'กำลังอัปโหลดภาพ...');
        try {
            shape.photo = await AUTH.uploadImage(e.target.files[0]);
            showSurveyShapePopup(shape); // refresh
        } catch(err) { Swal.fire('Error', 'อัปโหลดรูปไม่สำเร็จ', 'error'); }
        finally { showLoading(false); }
    };

    infoWindow.setContent(content);
    if (shape.getPosition) {
        infoWindow.open(map, shape);
    } else {
        const b = new google.maps.LatLngBounds();
        shape.getPath().forEach(p => b.extend(p));
        infoWindow.setPosition(b.getCenter());
        infoWindow.open(map);
    }
}
