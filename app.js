// Global error handlers for debugging
window.addEventListener('error', function (e) {
    alert('JS Error: ' + e.message + ' at ' + e.filename + ':' + e.lineno);
});
window.addEventListener('unhandledrejection', function (e) {
    alert('Unhandled Promise Rejection: ' + e.reason);
});

// --- Google Apps Script (GAS) Proxy Configuration ---
// แทนที่ URL ด้านล่างด้วย URL จริงของคุณที่ได้จากการ Deploy Google Apps Script (ไฟล์ cod.gs) เป็น Web App
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxYmkufBM6TGiY0TwSqI-Eq6RrTZBevQZqaBbs9IPZsAyBypBFXfvsXojkeVKcaoskb/exec';

// --- Supabase Connection & Configuration ---
let supabaseClient = null;
let supabaseUrl = 'https://mrcwgnlpgirokhqpuryc.supabase.co';
let supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yY3dnbmxwZ2lyb2tocXB1cnljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNTU5NzcsImV4cCI6MjA5NDgzMTk3N30.XagMxprQEYDmJrK5-nINujRIxiJxTEYdHfI8--h7c8k';

function initSupabase() {
    if (supabaseUrl && supabaseKey) {
        try {
            supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
            return true;
        } catch (e) {
            console.error("Supabase Client initialization error", e);
            return false;
        }
    }
    return false;
}

// --- Authentication & Session Handling ---
let authTab = 'login';

function showAuthOverlay(show) {
    const overlay = document.getElementById('auth-overlay');
    if (show) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

function switchAuthTab(tab) {
    try {
        authTab = tab;
        const tabLogin = document.getElementById('tab-login');
        const tabSignup = document.getElementById('tab-signup');
        const indicator = document.getElementById('auth-tab-indicator');
        const nameField = document.getElementById('name-field-container');
        const submitBtn = document.getElementById('btn-auth-submit');
        const authName = document.getElementById('auth-name');

        if (!tabLogin || !tabSignup || !nameField || !submitBtn || !authName) {
            console.error("Missing Auth UI elements in switchAuthTab");
            return;
        }

        // Reset password visibility state when switching tabs
        const passEl = document.getElementById('auth-password');
        const eyeIcon = document.getElementById('eye-icon');
        if (passEl) passEl.type = 'password';
        if (eyeIcon) {
            eyeIcon.classList.remove('fa-eye-slash');
            eyeIcon.classList.add('fa-eye');
        }

        if (tab === 'login') {
            tabLogin.classList.add('active');
            tabSignup.classList.remove('active');
            if (indicator) indicator.style.transform = 'translateX(0)';
            nameField.classList.add('hidden');
            authName.required = false;
            submitBtn.innerHTML = `<span>เข้าสู่ระบบ</span> <i class="fa-solid fa-arrow-right-to-bracket"></i>`;
        } else {
            tabLogin.classList.remove('active');
            tabSignup.classList.add('active');
            if (indicator) indicator.style.transform = 'translateX(100%)';
            nameField.classList.remove('hidden');
            authName.required = true;
            submitBtn.innerHTML = `<span>สมัครสมาชิก</span> <i class="fa-solid fa-user-plus"></i>`;
        }
    } catch (err) {
        console.error("switchAuthTab error:", err);
        alert("เกิดข้อผิดพลาดในการสลับแท็บ: " + err.message);
    }
}
window.switchAuthTab = switchAuthTab;
window._appSwitchAuthTab = switchAuthTab;

function prefillRememberMe() {
    const rememberMe = localStorage.getItem('survey_remember_me') === 'true';
    if (rememberMe) {
        const email = localStorage.getItem('survey_remember_email') || '';
        const password = localStorage.getItem('survey_remember_password') || '';
        const emailEl = document.getElementById('auth-email');
        const passEl = document.getElementById('auth-password');
        const remEl = document.getElementById('auth-remember');
        if (emailEl) emailEl.value = email;
        if (passEl) passEl.value = password;
        if (remEl) remEl.checked = true;
    }
}

function togglePasswordVisibility() {
    const passEl = document.getElementById('auth-password');
    const eyeIcon = document.getElementById('eye-icon');
    if (passEl && eyeIcon) {
        if (passEl.type === 'password') {
            passEl.type = 'text';
            eyeIcon.classList.remove('fa-eye');
            eyeIcon.classList.add('fa-eye-slash');
        } else {
            passEl.type = 'password';
            eyeIcon.classList.remove('fa-eye-slash');
            eyeIcon.classList.add('fa-eye');
        }
    }
}
window.togglePasswordVisibility = togglePasswordVisibility;

async function handleAuthSubmit(e) {
    e.preventDefault();
    if (!initSupabase()) {
        Swal.fire('ยังไม่ได้ตั้งค่าเชื่อมต่อ', 'กรุณาระบุ Anon Key ในซอร์สโค้ดเพื่อเริ่มต้นใช้งาน', 'warning');
        return;
    }

    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const display_name = document.getElementById('auth-name').value.trim();

    showLoading(true, authTab === 'login' ? 'กำลังเข้าสู่ระบบ...' : 'กำลังลงทะเบียนสมาชิก...');
    try {
        if (authTab === 'login') {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            if (data.user) {
                // Remember Me credentials persistence logic
                const rememberEl = document.getElementById('auth-remember');
                if (rememberEl && rememberEl.checked) {
                    localStorage.setItem('survey_remember_me', 'true');
                    localStorage.setItem('survey_remember_email', email);
                    localStorage.setItem('survey_remember_password', password);
                } else {
                    localStorage.removeItem('survey_remember_me');
                    localStorage.removeItem('survey_remember_email');
                    localStorage.removeItem('survey_remember_password');
                }
                await loadUserProfileAndData(data.user);
                Swal.fire({ toast: true, position: 'top', icon: 'success', title: 'ยินดีต้อนรับกลับเข้าสู่ระบบ', timer: 1500, showConfirmButton: false });
            }
        } else {
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: { display_name: display_name }
                }
            });
            if (error) throw error;
            if (data.user) {
                await loadUserProfileAndData(data.user);
                Swal.fire('ลงทะเบียนสำเร็จ', 'ยินดีต้อนรับสมาชิกใหม่ ระบบได้สร้างพื้นที่งานให้แล้ว', 'success');
            }
        }
    } catch (err) {
        Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
    } finally {
        showLoading(false);
    }
}
window.handleAuthSubmit = handleAuthSubmit;
window._appHandleAuthSubmit = handleAuthSubmit;

async function handleForgotPassword() {
    if (!initSupabase()) {
        Swal.fire('ยังไม่ได้ตั้งค่าเชื่อมต่อ', 'กรุณาระบุ Anon Key ในซอร์สโค้ดเพื่อเริ่มต้นใช้งาน', 'warning');
        return;
    }

    const emailInput = document.getElementById('auth-email').value.trim();

    const { value: email } = await Swal.fire({
        title: 'ลืมรหัสผ่าน',
        text: 'กรุณากรอกอีเมลของคุณเพื่อรับลิงก์ตั้งรหัสผ่านใหม่',
        input: 'email',
        inputValue: emailInput,
        inputPlaceholder: 'yourname@email.com',
        showCancelButton: true,
        confirmButtonText: 'ส่งลิงก์รีเซ็ต',
        cancelButtonText: 'ยกเลิก',
        inputValidator: (value) => {
            if (!value) {
                return 'กรุณากรอกอีเมล!';
            }
        }
    });

    if (email) {
        showLoading(true, 'กำลังส่งอีเมลรีเซ็ตรหัสผ่าน...');
        try {
            const redirectUrl = window.location.origin + window.location.pathname;
            const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
                redirectTo: redirectUrl
            });
            if (error) throw error;
            Swal.fire('ส่งสำเร็จ', 'ระบบได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณแล้ว กรุณาตรวจสอบกล่องจดหมาย (และอีเมลขยะ/Spam)', 'success');
        } catch (err) {
            Swal.fire('เกิดข้อผิดพลาด', err.message, 'error');
        } finally {
            showLoading(false);
        }
    }
}
window.handleForgotPassword = handleForgotPassword;
window._appHandleForgotPassword = handleForgotPassword;

async function checkAuthSession() {
    // ดักจับ hash ก่อนที่ initSupabase (supabase.createClient) จะเคลียร์ hash ออกจาก URL
    const isRecovery = window.location.hash.includes('type=recovery') || 
                       window.location.hash.includes('recovery') || 
                       window.location.search.includes('type=recovery');

    const hasAuthError = window.location.hash.includes('error=') || window.location.search.includes('error=');

    if (!initSupabase()) {
        showAuthOverlay(true);
        return;
    }

    showLoading(true, 'กำลังยืนยันตัวตน...');
    try {
        if (hasAuthError) {
            // ล้าง hash และ query parameters เพื่อไม่ให้ค้างบน URL
            const cleanUrl = window.location.href.split('#')[0].split('?')[0];
            window.history.replaceState(null, null, cleanUrl);
            
            showLoading(false);
            await Swal.fire({
                title: 'ลิงก์หมดอายุหรือผิดพลาด',
                text: 'ลิงก์รีเซ็ตรหัสผ่านนี้หมดอายุ หรืออาจจะเคยถูกใช้งานไปแล้ว (ลิงก์กู้คืนสามารถใช้งานได้เพียงครั้งเดียวเท่านั้น) กรุณากด "ลืมรหัสผ่าน?" หน้าเข้าสู่ระบบเพื่อรับลิงก์ใหม่อีกครั้งครับ',
                icon: 'error',
                confirmButtonText: 'ตกลง'
            });
            showAuthOverlay(true);
            return;
        }

        const { data: { session }, error } = await supabaseClient.auth.getSession();

        if (isRecovery && session && session.user) {
            // ล้าง hash และ query parameters เพื่อความปลอดภัยและป้องกันกล่องแจ้งเตือนทำงานซ้ำตอนรีเฟรช
            const cleanUrl = window.location.href.split('#')[0].split('?')[0];
            window.history.replaceState(null, null, cleanUrl);

            showLoading(false); // ปิดหน้าต่างโหลดชั่วคราว
            const { value: newPassword } = await Swal.fire({
                title: 'ตั้งรหัสผ่านใหม่',
                text: 'กรุณากรอกรหัสผ่านใหม่ที่คุณต้องการใช้งาน',
                input: 'password',
                inputPlaceholder: 'รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)',
                showCancelButton: false,
                confirmButtonText: 'บันทึกรหัสผ่านใหม่',
                allowOutsideClick: false,
                allowEscapeKey: false,
                inputValidator: (value) => {
                    if (!value) {
                        return 'กรุณากรอกรหัสผ่าน!';
                    }
                    if (value.length < 6) {
                        return 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร!';
                    }
                }
            });

            if (newPassword) {
                showLoading(true, 'กำลังอัปเดตรหัสผ่านใหม่...');
                const { error: updateError } = await supabaseClient.auth.updateUser({ password: newPassword });
                showLoading(false);
                if (updateError) {
                    await Swal.fire('ผิดพลาด', 'ไม่สามารถอัปเดตรหัสผ่านได้: ' + updateError.message, 'error');
                } else {
                    await Swal.fire('สำเร็จ', 'อัปเดตรหัสผ่านใหม่เรียบร้อยแล้ว ยินดีต้อนรับเข้าสู่ระบบ', 'success');
                }
            }
            showLoading(true, 'กำลังเข้าสู่ระบบ...');
        }

        if (session && session.user) {
            await loadUserProfileAndData(session.user);
        } else {
            showAuthOverlay(true);
        }
    } catch (e) {
        console.error("Auth session retrieval error", e);
        showAuthOverlay(true);
    } finally {
        showLoading(false);
    }
}

async function loadUserProfileAndData(authUser) {
    let profile = null;
    // ดึงข้อมูลโปรไฟล์ (และวนเช็คซ้ำเนื่องจากระบบ Database Trigger อาจจะบันทึกช้ากว่าเศษเสี้ยววินาที)
    for (let i = 0; i < 4; i++) {
        const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', authUser.id).maybeSingle();
        if (data) {
            profile = data;
            break;
        }
        await new Promise(r => setTimeout(r, 800));
    }

    if (profile) {
        currentUser = {
            id: authUser.id,
            email: authUser.email,
            name: profile.display_name || 'ผู้ใช้ทั่วไป',
            user_code: profile.user_code,
            team_id: profile.team_id,
            category: localStorage.getItem('survey_current_cat') || 'ทั่วไป'
        };

        // โหลดลิงก์แชร์ของ Google Drive เก่าที่กรอกไว้
        const oldUrl = localStorage.getItem('survey_geojson_drive_url') || '';
        document.getElementById('set-geojson-drive-url').value = oldUrl;

        updateUserInfo();
        showAuthOverlay(false);
        await syncJobsFromDB(true);
    } else {
        throw new Error("ระบบไม่สามารถสร้างโปรไฟล์ได้ในขณะนี้ กรุณาลองล็อกอินใหม่อีกครั้ง");
    }
}

async function handleLogout() {
    closeSettingsModal();
    showLoading(true, 'กำลังออกจากระบบ...');
    try {
        if (supabaseClient) await supabaseClient.auth.signOut();
    } catch (e) { }
    currentUser = { name: 'ผู้ใช้ทั่วไป', category: 'ทั่วไป' };
    dbJobs = [];
    markersGroup.clearLayers();
    updateUserInfo();
    showAuthOverlay(true);
    showLoading(false);
}

// --- Data Sync with Supabase ---
async function syncJobsFromDB(fitBounds = false) {
    if (!supabaseClient || !currentUser) return;
    showLoading(true, 'กำลังโหลดข้อมูลแปลงสำรวจ...');
    try {
        let allJobs = [];
        let from = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabaseClient
                .from('jobs')
                .select('*')
                .order('updated_at', { ascending: false })
                .range(from, from + limit - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                allJobs = allJobs.concat(data);
                from += data.length;
                if (data.length < limit) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }

        dbJobs = allJobs;

        // Scan data for unique categories and merge/register them (auto-pruning)
        const dbCategories = new Set(['ทั่วไป', 'ตรวจสอบ', 'เร่งด่วน']);
        dbJobs.forEach(j => {
            if (j.category) dbCategories.add(j.category);
        });
        if (currentUser && currentUser.category) {
            dbCategories.add(currentUser.category);
        }
        categories = Array.from(dbCategories);
        localStorage.setItem('survey_cats_v16', JSON.stringify(categories));

        updateUserInfo();
        renderImportedMapsList();

        updateAmphoeDropdown();
        renderMap(fitBounds);
    } catch (e) {
        console.error("Fetch jobs error", e);
        Swal.fire('โหลดจุดแผนที่ล้มเหลว', e.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function syncJobsSilently() {
    const isPmEditing = map && map.pm && (map.pm.globalEditModeEnabled() || map.pm.globalDragModeEnabled() || map.pm.globalRotateModeEnabled() || map.pm.globalDrawModeEnabled());
    if (window.pendingNewShapes.length > 0 || window.pendingGeomanUpdates.size > 0 || isPmEditing) return;
    if (!supabaseClient || !currentUser || isNavigating || isMapClickBlocked) return;
    try {
        let allJobs = [];
        let from = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabaseClient
                .from('jobs')
                .select('*')
                .order('updated_at', { ascending: false })
                .range(from, from + limit - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                allJobs = allJobs.concat(data);
                from += data.length;
                if (data.length < limit) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
        }

        const data = allJobs;

        if (data) {
            // ป้องกันการล้างข้อมูลที่กำลังพิมพ์หรือรูปถ่ายพรีวิวที่กำลังเลือกค้างอยู่ขณะซิงค์ในพื้นหลัง (Background Sync)
            if (selectedJobId) {
                const localJob = findJobById(selectedJobId);
                const dbJobIndex = data.findIndex(j => j.id === selectedJobId);
                const btnSave = document.getElementById('btn-save');
                const isEditing = btnSave && !btnSave.classList.contains('hidden');

                if (localJob && dbJobIndex !== -1 && isEditing) {
                    data[dbJobIndex].properties = {
                        ...data[dbJobIndex].properties,
                        images: localJob.properties.images,
                        name: document.getElementById('sheet-name').value,
                        note: document.getElementById('sheet-note').value
                    };
                }
            }

            dbJobs = data;

            // Scan data for unique categories and merge/register them (auto-pruning)
            const dbCategories = new Set(['ทั่วไป', 'ตรวจสอบ', 'เร่งด่วน']);
            dbJobs.forEach(j => {
                if (j.category) dbCategories.add(j.category);
            });
            if (currentUser && currentUser.category) {
                dbCategories.add(currentUser.category);
            }
            const oldLength = categories.length;
            categories = Array.from(dbCategories);
            if (categories.length !== oldLength) {
                localStorage.setItem('survey_cats_v16', JSON.stringify(categories));
                updateUserInfo();
            }
            renderImportedMapsList();

            renderMap(false);
            if (selectedJobId) {
                const currentOpenJob = findJobById(selectedJobId);
                if (currentOpenJob) {
                    const nameActive = document.activeElement === document.getElementById('sheet-name');
                    const noteActive = document.activeElement === document.getElementById('sheet-note');
                    const btnSave = document.getElementById('btn-save');
                    const isEditing = btnSave && !btnSave.classList.contains('hidden');

                    if (!nameActive && !noteActive && !isEditing) {
                        openSheetSilently(currentOpenJob);
                    }
                }
            }
        }
    } catch (e) {
        console.error("Silent sync error", e);
    }
}

async function saveJobToSupabase(job) {
    if (!supabaseClient || !currentUser) return;
    const { error } = await supabaseClient
        .from('jobs')
        .upsert({
            id: job.id,
            team_id: currentUser.team_id,
            lat: job.lat,
            lng: job.lng,
            geometry: job.geometry,
            status: job.status,
            category: job.category,
            properties: job.properties,
            updated_at: new Date().toISOString()
        });

    if (error) throw error;
}

async function deleteJobFromSupabase(id) {
    if (!supabaseClient) return;
    const { error } = await supabaseClient
        .from('jobs')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

async function clearAllSupabaseJobs() {
    if (!supabaseClient || !currentUser) return;
    const { error } = await supabaseClient
        .from('jobs')
        .delete()
        .eq('team_id', currentUser.team_id);

    if (error) throw error;
}

// --- Global State Variables ---
let map, userMarker, routingControl;
let dbJobs = [], markersGroup;
let selectedJobId = null, lastSelectedJobId = null, currentUser = { name: 'ผู้ใช้ทั่วไป', category: 'ทั่วไป' }, categories = ['ทั่วไป', 'ตรวจสอบ', 'เร่งด่วน'];
let viewMode = 'original', isNavigating = false, isFollowing = false;
let recognition = null, isVoiceActive = false, isVoiceMuted = false;
let speechSynth = window.speechSynthesis;
let isSpeechEnabled = localStorage.getItem('survey_speech_enabled') !== 'false';
let navInterval = null;
let markerJustClicked = false;
let isMapClickBlocked = false;
let justDeletedJobId = null;
window.imagesToDeleteFromCloud = [];
window.originalImagesBackup = [];
window.pendingGeomanUpdates = new Map();
window.pendingNewShapes = [];

// --- Helper functions for hand-drawn shapes and area calculations ---

function findJobById(id) {
    if (!id) return null;
    let job = dbJobs.find(j => j.id === id);
    if (!job && window.pendingNewShapes) {
        job = window.pendingNewShapes.find(j => j.id === id);
    }
    return job;
}
window.findJobById = findJobById;

function getFlatCoordinates(layer) {
    try {
        const geojson = layer.toGeoJSON();
        if (geojson && geojson.geometry) {
            if (geojson.geometry.type === 'Polygon') {
                return geojson.geometry.coordinates[0];
            } else if (geojson.geometry.type === 'MultiPolygon') {
                return geojson.geometry.coordinates[0][0];
            }
        }
    } catch (e) {
        console.error("Error in getFlatCoordinates", e);
    }
    try {
        if (typeof layer.getLatLngs === 'function') {
            let latlngs = layer.getLatLngs();
            if (Array.isArray(latlngs[0])) {
                latlngs = latlngs[0];
            }
            return latlngs.map(ll => [ll.lng, ll.lat]);
        }
    } catch (e) {
        console.error("Fallback getFlatCoordinates failed", e);
    }
    return [];
}

function calculatePolygonAreaInSqm(coords) {
    if (!coords || coords.length < 3) return 0;
    
    let pts = [...coords];
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
        pts.push(first);
    }
    
    let area = 0;
    const R = 6378137; // Earth radius in meters
    
    for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i];
        const p2 = pts[i + 1];
        
        const lat1 = p1[1] * Math.PI / 180;
        const lat2 = p2[1] * Math.PI / 180;
        const lng1 = p1[0] * Math.PI / 180;
        const lng2 = p2[0] * Math.PI / 180;
        
        area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    
    area = Math.abs(area * R * R / 2.0);
    return area;
}

function calculateCircleAreaInSqm(radius) {
    return Math.PI * radius * radius;
}

function formatThaiArea(sqm) {
    if (!sqm || isNaN(sqm) || sqm <= 0) return '-';
    const totalSqWa = sqm / 4.0;
    const rai = Math.floor(totalSqWa / 400);
    const remainingSqWaAfterRai = totalSqWa % 400;
    const ngan = Math.floor(remainingSqWaAfterRai / 100);
    const wa = remainingSqWaAfterRai % 100;
    
    let parts = [];
    if (rai > 0) parts.push(`${rai} ไร่`);
    if (ngan > 0 || rai > 0) parts.push(`${ngan} งาน`);
    const roundedWa = Math.round(wa * 10) / 10;
    parts.push(`${roundedWa} ตร.ว.`);
    
    return parts.join(' ') + ` (${Math.round(sqm).toLocaleString()} ตร.ม.)`;
}


// Override Swal.fire to prevent overlapping/frozen alerts, especially on iOS Safari
if (window.Swal) {
    const originalSwalFire = Swal.fire.bind(Swal);
    Swal.fire = function (...args) {
        try {
            if (Swal.isVisible()) {
                Swal.close();
                // Wait for close animation to finish before opening new dialog
                return new Promise((resolve) => {
                    setTimeout(() => {
                        originalSwalFire(...args).then(resolve);
                    }, 150);
                });
            }
        } catch (e) { }
        return originalSwalFire(...args);
    };
}

let showPinLabels = localStorage.getItem('survey_show_labels') !== 'false';
const cloudinaryCloudName = 'dsi3g3dix';
const cloudinaryUploadPreset = 'survey-extrapro';
let isGpsActive = false;
let gpsWatchId = null;

let maps, currentBaseMap = 'hybrid';

async function startApp() {
    // โหลดหมวดหมู่จากความจำเดิม (ถ้ามี)
    try {
        const c = localStorage.getItem('survey_cats_v16');
        if (c) categories = JSON.parse(c);
    } catch (e) { }

    initApp();
    prefillRememberMe();
    await checkAuthSession();

    // เริ่ม Polling ข้อมูลในทีมเงียบ ๆ ทุก 10 วินาที
    setInterval(syncJobsSilently, 10000);
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(startApp, 0);
} else {
    window.addEventListener('load', () => setTimeout(startApp, 0));
}

function showLoading(s, t) {
    document.getElementById('loading-overlay').style.display = s ? 'flex' : 'none';
    if (t) document.getElementById('loading-text').innerText = t;
}

function initApp() {
    // Initialize Leaflet objects here (safely inside a function, not at parse time)
    markersGroup = L.layerGroup();
    maps = {
        street: L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 20 }),
        hybrid: L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { maxZoom: 20 })
    };

    map = L.map('map', { zoomControl: false, attributionControl: false }).setView([13.7, 100.5], 6);
    maps.hybrid.addTo(map);
    markersGroup.addTo(map);

    startGpsTracking();

    map.on('dragstart', () => { if (isFollowing) toggleGPSFollow(false); });

    map.on('click', () => {
        if (markerJustClicked) {
            markerJustClicked = false;
            return;
        }
        const res = document.getElementById('search-results');
        if (res) res.classList.remove('active');
        if (!isNavigating && selectedJobId) {
            closeSheet();
        }
    });

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        const searchInp = document.getElementById('inp-search');
        const searchRes = document.getElementById('search-results');
        if (searchInp && searchRes && !searchInp.contains(e.target) && !searchRes.contains(e.target)) {
            searchRes.classList.remove('active');
        }
    });

    // Initialize label toggle button visual state
    const btn = document.getElementById('btn-label');
    if (btn) {
        if (showPinLabels) {
            btn.classList.add('bg-blue-50', 'text-blue-600');
        } else {
            btn.classList.remove('bg-blue-50', 'text-blue-600');
            btn.classList.add('text-gray-400');
        }
    }

    // Initialize Leaflet Geoman Controls
    if (map.pm) {
        map.pm.addControls({
            position: 'bottomright',
            drawMarker: true,
            drawCircle: true,
            drawRectangle: true,
            drawPolygon: true,
            drawPolyline: false,
            drawCircleMarker: false,
            editMode: true,
            dragMode: true,
            rotateMode: true,
            removalMode: true,
            drawText: false,
            cutPolygon: false
        });

        // ตั้งค่าภาษาไทยสำหรับเครื่องมือวาด Geoman (รองรับคำแปลบางส่วนของ Geoman)
        map.pm.setLang('th');

        // กำหนดค่าการวาดและการเลือกจุด (Snapping) ให้เหมาะสมกับ iPad/ปากกา Stylus และนิ้วมือ
        map.pm.setGlobalOptions({
            snappable: true,
            snapDistance: 25, // เพิ่มระยะ Snap เป็น 25px ช่วยให้ปากกา/นิ้วแตะโดนง่ายขึ้น
            templineStyle: {
                color: '#2563eb',
                weight: 4 // เส้นไกด์ตอนวาดหนาขึ้น เห็นได้ชัดเจนใต้หัวปากกาหรือนิ้วมือ
            },
            hintlineStyle: {
                color: '#10b981',
                weight: 3,
                dashArray: [5, 5]
            },
            pathOptions: {
                color: '#2563eb',
                fillColor: '#2563eb',
                fillOpacity: 0.2,
                weight: 4
            }
        });

        // ดักจับเหตุการณ์การปิดโหมดแก้ไขระดับแผนที่เพื่อประมวลผลการเซฟสะสม
        map.on('pm:globaleditmodetoggled', (e) => {
            showPendingActionsBar();
        });
        map.on('pm:globaldragmodetoggled', (e) => {
            showPendingActionsBar();
        });
        map.on('pm:globalrotatemodetoggled', (e) => {
            showPendingActionsBar();
        });

        // ดักจับเมื่อมีการลบเลเยอร์ด้วยเครื่องมือลบของ Geoman
        map.on('pm:remove', async (e) => {
            const removedLayer = e.layer;
            const jobId = removedLayer.jobId;
            if (jobId) {
                const job = findJobById(jobId);
                if (job) {
                    selectedJobId = jobId;
                    await deleteJob();
                    // หากไม่ได้ทำการลบจริง (เช่น กดยกเลิก) ให้แสดงผลแผนที่ใหม่เพื่อคืนค่าเลเยอร์กลับมา
                    if (findJobById(jobId)) {
                        if (job.properties && job.properties.is_temp === true) {
                            removedLayer.addTo(map);
                        } else {
                            renderMap();
                        }
                    }
                }
            }
        });

        map.on('pm:create', (e) => {
            const layer = e.layer;
            const shape = e.shape; // 'Marker', 'Rectangle', 'Polygon', 'Circle'

            let geometry = {};
            let lat = 0;
            let lng = 0;
            let isCircle = false;
            let radius = 0;

            if (shape === 'Circle') {
                const center = layer.getLatLng();
                lat = center.lat;
                lng = center.lng;
                isCircle = true;
                radius = layer.getRadius();
                geometry = {
                    type: 'Point',
                    coordinates: [lng, lat]
                };
            } else if (shape === 'Marker') {
                const pos = layer.getLatLng();
                lat = pos.lat;
                lng = pos.lng;
                geometry = {
                    type: 'Point',
                    coordinates: [lng, lat]
                };
            } else {
                // Rectangle หรือ Polygon
                geometry = layer.toGeoJSON().geometry;
                const bounds = layer.getBounds();
                const center = bounds.getCenter();
                lat = center.lat;
                lng = center.lng;
            }

            const tempJobId = 'drawn_temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            layer.jobId = tempJobId;

            // Calculate area
            let areaSqm = 0;
            if (isCircle) {
                areaSqm = calculateCircleAreaInSqm(radius);
            } else if (shape === 'Polygon' || shape === 'Rectangle') {
                const coords = getFlatCoordinates(layer);
                areaSqm = calculatePolygonAreaInSqm(coords);
            }
            const formattedArea = areaSqm > 0 ? formatThaiArea(areaSqm) : '-';

            const tempJob = {
                id: tempJobId,
                team_id: currentUser ? currentUser.team_id : null,
                lat: lat,
                lng: lng,
                geometry: geometry,
                status: 'done',
                category: currentUser ? currentUser.category : 'ทั่วไป',
                properties: {
                    name: `แปลงวาดใหม่ (${shape})`,
                    note: '',
                    images: [],
                    area: formattedArea,
                    is_temp: true,
                    amphoe: 'วาดเอง',
                    tambon: 'แปลงชั่วคราว',
                    is_circle: isCircle,
                    radius: radius,
                    is_custom_draw: true
                },
                layer: layer,
                shape: shape
            };

            window.pendingNewShapes.push(tempJob);

            // Bind geoman events on this new layer to track further background updates
            bindGeomanEvents(layer, tempJobId);

            // Bind temporary label
            layer.bindTooltip('แปลงใหม่ (ยังไม่บันทึก)', {
                permanent: true,
                direction: 'top',
                className: 'job-label job-label-pending font-bold animate-pulse',
                offset: [0, -10]
            });

            // Bind click event to open sheet immediately
            layer.on('click', () => {
                const isPmActive = map && map.pm && (
                    map.pm.globalEditModeEnabled() || 
                    map.pm.globalDragModeEnabled() || 
                    map.pm.globalRotateModeEnabled() || 
                    map.pm.globalDrawModeEnabled() ||
                    map.pm.globalRemovalModeEnabled()
                );
                if (isPmActive) return;
                
                markerJustClicked = true;
                openSheet(tempJob);
            });

            showPendingActionsBar();
        });

        // Load PM settings from localStorage
        const enablePm = localStorage.getItem('survey_enable_pm') === 'true';
        const chkEnablePm = document.getElementById('chk-enable-pm');
        if (chkEnablePm) chkEnablePm.checked = enablePm;

        // Load Speech Enable setting from localStorage
        const isEnabled = localStorage.getItem('survey_speech_enabled') !== 'false';
        const chkEnableSpeech = document.getElementById('chk-enable-speech');
        if (chkEnableSpeech) chkEnableSpeech.checked = isEnabled;
        const btnTogglePm = document.getElementById('btn-toggle-pm');
        if (enablePm) {
            if (btnTogglePm) btnTogglePm.classList.remove('hidden');
            toggleGeomanToolbar(true);
        } else {
            if (btnTogglePm) btnTogglePm.classList.add('hidden');
            toggleGeomanToolbar(false);
        }
    }
}

function startGpsTracking() {
    if (!navigator || !navigator.geolocation) {
        isGpsActive = false;
        updateGpsStatus();
        console.warn("Geolocation is not supported by this browser.");
        return;
    }

    try {
        if (gpsWatchId) navigator.geolocation.clearWatch(gpsWatchId);

        gpsWatchId = navigator.geolocation.watchPosition(p => {
            isGpsActive = true;
            updateGpsStatus();
            const latlng = [p.coords.latitude, p.coords.longitude];
            if (!userMarker) {
                userMarker = L.marker(latlng, {
                    icon: L.divIcon({ className: 'bg-blue-500 w-4 h-4 rounded-full border-2 border-white shadow' }),
                    pmIgnore: true
                }).addTo(map);
            } else {
                userMarker.setLatLng(latlng);
            }
            if (isFollowing && !isNavigating) map.setView(latlng, 18);
        }, e => {
            isGpsActive = false;
            updateGpsStatus();
            console.error("GPS Watch error", e);
        }, { enableHighAccuracy: true });
    } catch (err) {
        console.error("Failed to start GPS tracking:", err);
        isGpsActive = false;
        updateGpsStatus();
    }
}

function updateGpsStatus() {
    const el = document.getElementById('profile-gps-status');
    if (!el) return;
    if (isGpsActive) {
        el.innerHTML = '<span class="inline-flex items-center text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full"><i class="fa-solid fa-circle text-[6px] mr-1 animate-pulse"></i> ใช้งานได้</span>';
    } else {
        el.innerHTML = '<span class="inline-flex items-center text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full"><i class="fa-solid fa-circle text-[6px] mr-1"></i> ไม่ได้รับอนุญาต / ปิดอยู่</span>';
    }
}

function resetGps() {
    showLoading(true, 'กำลังเปิดขอสิทธิ์ GPS อีกครั้ง...');

    if (!navigator || !navigator.geolocation) {
        showLoading(false);
        Swal.fire('ข้อผิดพลาด', 'อุปกรณ์ของคุณไม่รองรับ GPS หรือไม่ได้เปิดใช้งานตำแหน่งที่ตั้ง', 'error');
        return;
    }

    try {
        if (gpsWatchId) {
            navigator.geolocation.clearWatch(gpsWatchId);
            gpsWatchId = null;
        }

        if (userMarker) {
            map.removeLayer(userMarker);
            userMarker = null;
        }

        navigator.geolocation.getCurrentPosition(p => {
            isGpsActive = true;
            updateGpsStatus();
            const latlng = [p.coords.latitude, p.coords.longitude];

            userMarker = L.marker(latlng, {
                icon: L.divIcon({ className: 'bg-blue-500 w-4 h-4 rounded-full border-2 border-white shadow' })
            }).addTo(map);

            map.setView(latlng, 17);
            isFollowing = true;
            const btnGps = document.getElementById('btn-gps');
            if (btnGps) {
                btnGps.classList.add('bg-blue-50', 'text-blue-600');
                btnGps.classList.remove('text-gray-400');
            }
            showLoading(false);
            Swal.fire({
                icon: 'success',
                title: 'เชื่อมต่อ GPS สำเร็จ',
                text: 'ตำแหน่งของคุณอัปเดตบนแผนที่เรียบร้อยแล้ว',
                timer: 2000,
                showConfirmButton: false
            });
            startGpsTracking();
        }, err => {
            isGpsActive = false;
            updateGpsStatus();
            showLoading(false);
            let errMsg = 'กรุณาตรวจสอบว่าเปิดระบุตำแหน่งบนอุปกรณ์แล้ว';
            if (err.code === 1) {
                errMsg = 'สิทธิ์ระบุตำแหน่งถูกปฏิเสธ กรุณากดรูปแม่กุญแจ (Padlock) ที่แถบที่อยู่เว็บ (URL Bar) และเลือก "อนุญาต" ตำแหน่ง (Location) จากนั้นลองกดรีเซ็ตอีกครั้ง';
            }
            Swal.fire({
                icon: 'warning',
                title: 'เชื่อมต่อ GPS ไม่สำเร็จ',
                text: errMsg,
                confirmButtonText: 'รับทราบ',
                confirmButtonColor: '#3b82f6'
            });
            startGpsTracking();
        }, { enableHighAccuracy: true, timeout: 10000 });
    } catch (err) {
        showLoading(false);
        console.error("Failed to reset GPS:", err);
        Swal.fire('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการขอสิทธิ์ GPS: ' + err.message, 'error');
    }
}

function updateUserInfo() {
    document.getElementById('user-display').innerText = currentUser.name;
    document.getElementById('profile-display-name').innerText = currentUser.name;
    document.getElementById('profile-email').innerText = currentUser.email || '-';
    document.getElementById('profile-user-code').innerText = currentUser.user_code || '------';

    // Populate profile category select dropdown (only reading from active imported map categories)
    const selProfileCat = document.getElementById('sel-profile-category');
    if (selProfileCat) {
        selProfileCat.innerHTML = '';

        let activeCats = Array.from(new Set(dbJobs.map(j => j.category).filter(Boolean)));
        if (!activeCats.includes('ทั่วไป')) {
            activeCats.push('ทั่วไป');
        }
        const currentCat = currentUser.category || 'ทั่วไป';
        if (!activeCats.includes(currentCat)) {
            activeCats.push(currentCat);
        }

        activeCats.sort();

        activeCats.forEach(cat => {
            selProfileCat.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
        selProfileCat.value = currentCat;
    }

    const catInput = document.getElementById('inp-profile-category');
    if (catInput) {
        catInput.value = '';
        catInput.classList.add('hidden');
    }

    updateGpsStatus();
}

function saveProfileCategory() {
    const selProfileCat = document.getElementById('sel-profile-category');
    if (!selProfileCat) return;

    const newCat = selProfileCat.value;
    if (!newCat) {
        Swal.fire('คำเตือน', 'กรุณาระบุหรือเลือกประเภทงาน/โครงการที่กำลังสำรวจ', 'warning');
        return;
    }

    localStorage.setItem('survey_current_cat', newCat);
    currentUser.category = newCat;

    updateUserInfo();
    updateCounter();

    // Sync from database and re-draw markers with the new category
    syncJobsFromDB();

    Swal.fire({
        toast: true,
        position: 'top',
        icon: 'success',
        title: `สลับประเภทงานเป็น: ${newCat}`,
        timer: 1500,
        showConfirmButton: false
    });
}


function updateCounter() {
    const catJobs = dbJobs.filter(j => j.category === currentUser.category);
    const doneCount = catJobs.filter(j => j.status === 'done').length;
    document.getElementById('job-counter').innerText = `${doneCount}/${catJobs.length}`;
}
function toggleGPSFollow(state) {
    isFollowing = (state !== undefined) ? state : !isFollowing;
    const btn = document.getElementById('btn-gps');
    if (isFollowing) {
        btn.classList.add('active-gps');
        if (userMarker) {
            map.setView(userMarker.getLatLng(), 18);
            Swal.fire({ toast: true, position: 'top', icon: 'info', title: 'ติดตามตำแหน่ง', timer: 1000, showConfirmButton: false });
        } else {
            Swal.fire('รอ GPS...', '', 'info');
        }
    } else {
        btn.classList.remove('active-gps');
    }
}

function initVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return false;

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'th-TH';

    recognition.onstart = () => {
        isVoiceActive = true;
        updateVoiceControlUI(isVoiceMuted ? 'muted' : true);
    };
    recognition.onend = () => {
        if (isVoiceActive) {
            try { recognition.start(); } catch (e) { console.error("Speech Recognition restart failed:", e); }
        } else {
            updateVoiceControlUI(false);
        }
    };
    recognition.onerror = (event) => {
        console.error("Speech Recognition error:", event.error);
        if (event.error === 'not-allowed') {
            isVoiceActive = false;
            updateVoiceControlUI(false);
            Swal.fire('การสั่งการด้วยเสียง', 'สิทธิ์ไมโครโฟนถูกปฏิเสธ กรุณาอนุญาตให้ใช้งานไมโครโฟน', 'warning');
        }
    };
    recognition.onresult = (event) => {
        const resultIndex = event.resultIndex;
        const transcript = event.results[resultIndex][0].transcript.toLowerCase().trim();
        console.log("Speech recognized: ", transcript);
        handleVoiceCommand(transcript);
    };
    return true;
}

let activeUtterances = [];

function parseNumber(text) {
    if (!text) return null;
    const digits = text.match(/\d+/);
    if (digits) {
        return parseInt(digits[0], 10);
    }
    const thaiWords = {
        "หนึ่ง": 1, "สอง": 2, "สาม": 3, "สี่": 4, "ห้า": 5,
        "หก": 6, "เจ็ด": 7, "แปด": 8, "เก้า": 9, "สิบ": 10,
        "สิบเอ็ด": 11, "สิบสอง": 12, "สิบสาม": 13, "สิบสี่": 14,
        "สิบห้า": 15, "สิบหก": 16, "สิบเจ็ด": 17, "สิบแปด": 18,
        "สิบเก้า": 19, "ยี่สิบ": 20, "ยี่สิบเอ็ด": 21, "ยี่สิบสอง": 22,
        "ยี่สิบสาม": 23, "ยี่สิบสี่": 24, "ยี่สิบห้า": 25, "ยี่สิบหก": 26,
        "ยี่สิบเจ็ด": 27, "ยี่สิบแปด": 28, "ยี่สิบเก้า": 29, "สามสิบ": 30,
        "สามสิบเอ็ด": 31, "สามสิบสอง": 32, "สามสิบสาม": 33, "สามสิบสี่": 34,
        "สามสิบห้า": 35, "สามสิบหก": 36, "สามสิบเจ็ด": 37, "สามสิบแปด": 38,
        "สามสิบเก้า": 39, "สี่สิบ": 40, "สี่สิบเอ็ด": 41, "สี่สิบสอง": 42,
        "สี่สิบสาม": 43, "สี่สิบสี่": 44, "สี่สิบห้า": 45, "สี่สิบหก": 46,
        "สี่สิบเจ็ด": 47, "สี่สิบแปด": 48, "สี่สิบเก้า": 49, "ห้าสิบ": 50
    };
    const sortedWords = Object.keys(thaiWords).sort((a, b) => b.length - a.length);
    for (const word of sortedWords) {
        if (text.includes(word)) {
            return thaiWords[word];
        }
    }
    return null;
}

function stopReadingSequence() {
    activeUtterances = [];
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    const container = document.getElementById('swal-raw-data-container');
    if (container) {
        const trs = container.querySelectorAll('tr');
        trs.forEach(tr => {
            tr.classList.remove('bg-yellow-100', 'font-semibold');
        });
    }
}

function startReadingSequence(rows, startLine, countLines) {
    stopReadingSequence();

    const container = document.getElementById('swal-raw-data-container');
    const trs = container ? container.querySelectorAll('tr') : [];

    for (let i = 0; i < countLines; i++) {
        const rowIndex = startLine - 1 + i;
        if (rowIndex >= rows.length) break;
        const row = rows[rowIndex];
        const cleanKey = row.key.replace(/_/g, ' ');
        const textToSpeak = `บรรทัดที่ ${rowIndex + 1}: ${cleanKey} คือ ${row.value}`;

        const u = new SpeechSynthesisUtterance(textToSpeak);
        u.lang = 'th-TH';

        activeUtterances.push(u);

        const trElement = trs[rowIndex];

        u.onstart = () => {
            trs.forEach(tr => tr.classList.remove('bg-yellow-100', 'font-semibold'));
            if (trElement) {
                trElement.classList.add('bg-yellow-100', 'font-semibold');
                trElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        };

        u.onend = () => {
            if (trElement) {
                trElement.classList.remove('bg-yellow-100', 'font-semibold');
            }
            const index = activeUtterances.indexOf(u);
            if (index > -1) {
                activeUtterances.splice(index, 1);
            }
        };

        u.onerror = () => {
            if (trElement) {
                trElement.classList.remove('bg-yellow-100', 'font-semibold');
            }
            const index = activeUtterances.indexOf(u);
            if (index > -1) {
                activeUtterances.splice(index, 1);
            }
        };

        window.speechSynthesis.speak(u);
    }
}

function isLatLngInJob(latlng, job) {
    if (!latlng || !job) return false;
    const lat = Number(latlng.lat);
    const lng = Number(latlng.lng);
    if (isNaN(lat) || isNaN(lng)) return false;

    // 1. Circle check
    if (job.properties && job.properties.is_circle && job.properties.radius) {
        if (map) {
            const distance = map.distance([lat, lng], [Number(job.lat), Number(job.lng)]);
            return distance <= Number(job.properties.radius);
        }
    }

    // 2. Polygon / MultiPolygon check
    if (job.geometry && (job.geometry.type === 'Polygon' || job.geometry.type === 'MultiPolygon')) {
        const type = job.geometry.type;
        const coords = job.geometry.coordinates;

        const rayCast = (x, y, vs) => {
            let inside = false;
            for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
                const xi = Number(vs[i][0]), yi = Number(vs[i][1]);
                const xj = Number(vs[j][0]), yj = Number(vs[j][1]);
                const intersect = ((yi > y) !== (yj > y))
                    && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        };

        if (type === 'Polygon') {
            if (coords && coords[0]) {
                return rayCast(lng, lat, coords[0]);
            }
        } else if (type === 'MultiPolygon') {
            for (let p = 0; p < coords.length; p++) {
                const polygonCoords = coords[p];
                if (polygonCoords && polygonCoords[0]) {
                    if (rayCast(lng, lat, polygonCoords[0])) {
                        return true;
                    }
                }
            }
        }
    }

    // 3. Point check (if user is within 15 meters)
    if (job.geometry && job.geometry.type === 'Point') {
        if (map) {
            const distance = map.distance([lat, lng], [Number(job.lat), Number(job.lng)]);
            return distance <= 15;
        }
    }

    return false;
}

function findJobContainingUser() {
    if (!userMarker) return null;
    const latlng = userMarker.getLatLng();
    const activeJobs = getFilteredJobs();
    for (let i = 0; i < activeJobs.length; i++) {
        if (isLatLngInJob(latlng, activeJobs[i])) {
            return activeJobs[i];
        }
    }
    for (let i = 0; i < dbJobs.length; i++) {
        if (isLatLngInJob(latlng, dbJobs[i])) {
            return dbJobs[i];
        }
    }
    return null;
}

async function handleVoiceCommand(transcript) {
    const cleanTranscript = transcript.replace(/\s+/g, '');

    const isUnmute = cleanTranscript.includes("unmutemic") || cleanTranscript.includes("unmutevoice") || cleanTranscript.includes("เปิดไมค์") || cleanTranscript.includes("เปิดไม");
    if (isVoiceMuted) {
        if (isUnmute) {
            isVoiceMuted = false;
            updateVoiceControlUI(true);
            speak("เปิดไมค์");
        }
        return;
    }

    const isMute = !cleanTranscript.includes("เปิด") && !cleanTranscript.includes("open") && (
                   cleanTranscript.includes("mutemic") || cleanTranscript.includes("mutevoice") || cleanTranscript.includes("standbyvoice") || cleanTranscript.includes("ปิดไมค์") || cleanTranscript.includes("ปิดไม")
    );
    if (isMute) {
        isVoiceMuted = true;
        updateVoiceControlUI('muted');
        speak("ปิดไมค์");
        return;
    }

    if (window.Swal && Swal.isVisible()) {
        const isStopReading = cleanTranscript.includes("หยุดอ่าน") || cleanTranscript.includes("หยุดพูด") || (cleanTranscript === "หยุด" && document.getElementById('swal-raw-data-container'));
        if (isStopReading) {
            stopReadingSequence();
            speak("หยุดอ่าน", true);
            return;
        }

        const isReadDetails = cleanTranscript.includes("อ่านรายละเอียด") || cleanTranscript.includes("อ่านข้อมูลดิบ") || cleanTranscript.includes("อ่านข้อมูล") || cleanTranscript.includes("อ่านตาราง") || cleanTranscript.includes("อ่านทั้งหมด");
        const isReadLine = cleanTranscript.includes("อ่านบรรทัดที่") || cleanTranscript.includes("อ่านตั้งแต่บรรทัดที่");

        if (isReadDetails || isReadLine) {
            const job = findJobById(selectedJobId || lastSelectedJobId);
            if (job) {
                const container = document.getElementById('swal-raw-data-container');
                if (container) {
                    const sortedKeys = Object.keys(job.properties).sort();
                    const rows = [];
                    sortedKeys.forEach(k => {
                        if (k !== 'images' && k !== 'name' && k !== 'note' && k !== 'date' && k !== 'search_field' && k !== 'amphoe' && k !== 'tambon' && k !== 'area') {
                            const val = typeof job.properties[k] === 'object' ? JSON.stringify(job.properties[k]) : job.properties[k];
                            rows.push({ key: k, value: val !== undefined && val !== null ? val : '-' });
                        }
                    });

                    if (rows.length > 0) {
                        let startLine = 1;
                        let countLines = rows.length;

                        if (isReadLine) {
                            const lineIdx = cleanTranscript.indexOf("บรรทัดที่");
                            if (lineIdx !== -1) {
                                const afterLine = cleanTranscript.substring(lineIdx + "บรรทัดที่".length);
                                const parsedStart = parseNumber(afterLine);
                                if (parsedStart !== null) {
                                    startLine = parsedStart;
                                }
                            }

                            const toIdx = cleanTranscript.indexOf("ถึง");
                            if (toIdx !== -1) {
                                const afterTo = cleanTranscript.substring(toIdx + "ถึง".length);
                                const endLine = parseNumber(afterTo);
                                if (endLine !== null && endLine >= startLine) {
                                    countLines = endLine - startLine + 1;
                                }
                            } else {
                                const countIdx = cleanTranscript.indexOf("จำนวน");
                                if (countIdx !== -1) {
                                    const afterCount = cleanTranscript.substring(countIdx + "จำนวน".length);
                                    const parsedCount = parseNumber(afterCount);
                                    if (parsedCount !== null) {
                                        countLines = parsedCount;
                                    }
                                } else {
                                    if (cleanTranscript.includes("อ่านตั้งแต่")) {
                                        countLines = rows.length - startLine + 1;
                                    } else {
                                        countLines = 1;
                                    }
                                }
                            }
                        }

                        if (startLine < 1 || startLine > rows.length) {
                            speak(`ไม่มีบรรทัดที่ ${startLine}`, true);
                            return;
                        }

                        countLines = Math.min(countLines, rows.length - startLine + 1);
                        if (countLines <= 0) {
                            speak("จำนวนบรรทัดไม่ถูกต้อง", true);
                            return;
                        }

                        startReadingSequence(rows, startLine, countLines);
                    } else {
                        speak("ไม่มีข้อมูลให้อ่าน", true);
                    }
                }
            }
            return;
        }

        const isScrollDown = cleanTranscript.includes("เลื่อนลง") || (cleanTranscript.includes("ลง") && !cleanTranscript.includes("ตกลง")) || cleanTranscript.includes("scrolldown");
        const isScrollUp = cleanTranscript.includes("เลื่อนขึ้น") || cleanTranscript.includes("ขึ้น") || cleanTranscript.includes("scrollup");
        if (isScrollDown) {
            const container = document.getElementById('swal-raw-data-container');
            if (container) {
                container.scrollBy({ top: 200, behavior: 'smooth' });
                speak("เลื่อนลง");
                return;
            }
        } else if (isScrollUp) {
            const container = document.getElementById('swal-raw-data-container');
            if (container) {
                container.scrollBy({ top: -200, behavior: 'smooth' });
                speak("เลื่อนขึ้น");
                return;
            }
        }

        const isConfirm = cleanTranscript.includes("ตกลง") || cleanTranscript.includes("ยืนยัน") || cleanTranscript.includes("เอาเลย") || cleanTranscript.includes("ลบเลย") || cleanTranscript.includes("ใช่") || cleanTranscript.includes("ok") || cleanTranscript.includes("confirm");
        const isCancel = cleanTranscript.includes("ยกเลิก") || cleanTranscript.includes("ไม่ลบ") || cleanTranscript.includes("ไม่") || cleanTranscript.includes("cancel") || cleanTranscript.includes("close") || cleanTranscript.includes("ปิด");
        if (isConfirm) {
            Swal.clickConfirm();
            speak("ตกลง");
        } else if (isCancel) {
            Swal.clickCancel();
            speak("ยกเลิก");
        }
        return;
    }

    const isSave = cleanTranscript.includes("savesurvey") || cleanTranscript.includes("เซฟเซอร์เวย์") || cleanTranscript.includes("เซฟเซอเวย์") || cleanTranscript.includes("บันทึกข้อมูล") || 
                   (cleanTranscript.includes("บันทึก") && !cleanTranscript.includes("เปิดบันทึก") && !cleanTranscript.includes("ปิดบันทึก") && !cleanTranscript.includes("ปิดกล่องบันทึก") && !cleanTranscript.includes("ลบบันทึก") && !cleanTranscript.includes("ลบการบันทึก"));

    const isNext = cleanTranscript.includes("nextpoint") || cleanTranscript.includes("nexpoint") || cleanTranscript.includes("แปลงถัดไป") || cleanTranscript.includes("จุดถัดไป") || cleanTranscript.includes("เน็กพอยต์") || cleanTranscript.includes("เน็กซ์พอยต์");
    const isCancelNav = cleanTranscript.includes("cancelnavigation") || cleanTranscript.includes("stopnavigation") || cleanTranscript.includes("cancelroute") || cleanTranscript.includes("ยกเลิกการนำทาง") || cleanTranscript.includes("ยกเลิกนำทาง") || cleanTranscript.includes("หยุดนำทาง");
    const isDeleteSurvey = cleanTranscript.includes("deletesurvey") || cleanTranscript.includes("deleterecord") || cleanTranscript.includes("ลบการบันทึก") || cleanTranscript.includes("ลบบันทึก") || cleanTranscript.includes("ลบข้อมูลสำรวจ");

    const isShowLabels = cleanTranscript.includes("showlabel") || cleanTranscript.includes("showlabels") || cleanTranscript.includes("openlabel") || cleanTranscript.includes("openlabels") || cleanTranscript.includes("turnonlabel") || cleanTranscript.includes("turnonlabels") || cleanTranscript.includes("เปิดป้ายชื่อ") || cleanTranscript.includes("แสดงป้ายชื่อ") || cleanTranscript.includes("เปิดป้าย") || cleanTranscript.includes("แสดงป้าย");
    const isHideLabels = !cleanTranscript.includes("เปิด") && !cleanTranscript.includes("open") && (cleanTranscript.includes("hidelabel") || cleanTranscript.includes("hidelabels") || cleanTranscript.includes("closelabel") || cleanTranscript.includes("closelabels") || cleanTranscript.includes("turnofflabel") || cleanTranscript.includes("turnofflabels") || cleanTranscript.includes("ปิดป้ายชื่อ") || cleanTranscript.includes("ซ่อนป้ายชื่อ") || cleanTranscript.includes("ปิดป้าย") || cleanTranscript.includes("ซ่อนป้าย"));

    const isShowPlot = cleanTranscript.includes("showplot") || cleanTranscript.includes("showplots") || cleanTranscript.includes("showboundary") || cleanTranscript.includes("showboundaries") || cleanTranscript.includes("plotmode") || cleanTranscript.includes("แสดงรูปแปลง") || cleanTranscript.includes("แสดงขอบเขตแปลง") || cleanTranscript.includes("แสดงแปลง") || cleanTranscript.includes("โหมดแปลง");
    const isShowPin = cleanTranscript.includes("showpin") || cleanTranscript.includes("showpins") || cleanTranscript.includes("showmarker") || cleanTranscript.includes("showmarkers") || cleanTranscript.includes("pinmode") || cleanTranscript.includes("แสดงหมุด") || cleanTranscript.includes("โหมดหมุด") || cleanTranscript.includes("ปักหมุด") || cleanTranscript.includes("สั่งแสดงหมุด") || cleanTranscript.includes("แสดงหมุดแผนที่");
    const isToggleBaseMap = cleanTranscript.includes("switchmap") || cleanTranscript.includes("changemap") || cleanTranscript.includes("togglemap") || cleanTranscript.includes("switchbasemap") || cleanTranscript.includes("togglebasemap") || cleanTranscript.includes("สลับแผนที่") || cleanTranscript.includes("เปลี่ยนแผนที่") || cleanTranscript.includes("สลับแผนที่ฐาน") || cleanTranscript.includes("เปลี่ยนแผนที่ฐาน");
    const isShowDetails = cleanTranscript.includes("showdetail") || cleanTranscript.includes("showdetails") || cleanTranscript.includes("opendetail") || cleanTranscript.includes("opendetails") || cleanTranscript.includes("ขอดูรายละเอียด") || cleanTranscript.includes("ของดูรายละเอียด") || cleanTranscript.includes("ดูรายละเอียด");

    const isClearNote = cleanTranscript.includes("clearnote") || cleanTranscript.includes("clearnotes") || cleanTranscript.includes("clearalltext") || cleanTranscript.includes("cleartext") || cleanTranscript.includes("ลบข้อความทั้งหมด") || cleanTranscript.includes("ลบหมายเหตุทั้งหมด") || cleanTranscript.includes("ลบข้อความ") || cleanTranscript.includes("ลบหมายเหตุ") || cleanTranscript.includes("ลบทั้งหมด") || cleanTranscript.includes("ล้างข้อความทั้งหมด") || cleanTranscript.includes("ล้างข้อความ") || cleanTranscript.includes("เคลียร์ข้อความทั้งหมด") || cleanTranscript.includes("เคลียร์ข้อความ") || cleanTranscript.includes("เคลียร์โน้ต") || cleanTranscript.includes("ลบโน้ต");
    const isCloseSheet = !cleanTranscript.includes("เปิด") && !cleanTranscript.includes("open") && (cleanTranscript.includes("closesheet") || cleanTranscript.includes("closedetails") || cleanTranscript.includes("closedetail") || cleanTranscript.includes("closebox") || cleanTranscript.includes("closewindow") || cleanTranscript.includes("cancel") || cleanTranscript.includes("ปิดบันทึก") || cleanTranscript.includes("ปิดกล่องบันทึก") || cleanTranscript.includes("ปิดกล่อง") || cleanTranscript.includes("ปิดรายละเอียด") || cleanTranscript.includes("ปิดหน้าต่าง") || cleanTranscript.includes("ยกเลิกบันทึก") || cleanTranscript.includes("ยกเลิกรายละเอียด") || (cleanTranscript.includes("ปิด") && !cleanTranscript.includes("ปิดป้ายชื่อ") && !cleanTranscript.includes("ปิดป้าย") && !cleanTranscript.includes("ปิดระบบ")) || (cleanTranscript.includes("ยกเลิก") && !cleanTranscript.includes("ยกเลิกการนำทาง") && !cleanTranscript.includes("ยกเลิกนำทาง")));
    const isFocusSearch = !cleanTranscript.includes("ลบ") && !cleanTranscript.includes("ล้าง") && (cleanTranscript.includes("ค้นหา") || cleanTranscript.includes("ช่องค้นหา") || cleanTranscript.includes("เปิดค้นหา") || cleanTranscript.includes("search"));
    const isNavigateSearchItem = (cleanTranscript.includes("รายการที่") || cleanTranscript.includes("รายการ")) && cleanTranscript.includes("เดินทาง");

    const isSurvey = !isSave && !isNext && !isCancelNav && !isDeleteSurvey && !isShowLabels && !isHideLabels && !isShowPlot && !isShowPin && !isToggleBaseMap && !isShowDetails && !isClearNote && !isCloseSheet && !isFocusSearch && !isNavigateSearchItem && (cleanTranscript.includes("survey") || cleanTranscript.includes("สำรวจ") || cleanTranscript.includes("เปิดบันทึก") || cleanTranscript.includes("เซอร์เวย์") || cleanTranscript.includes("เซอเวย์") || cleanTranscript.includes("เสวย"));

    if (isSurvey) {
        let job = null;
        if (isNavigating) {
            job = findJobById(selectedJobId);
        } else {
            if (userMarker) {
                job = findJobContainingUser();
            }
            if (!job) {
                job = findJobById(selectedJobId);
            } else {
                if (selectedJobId !== job.id) {
                    openSheet(job);
                }
            }
        }

        if (job) {
            const sheet = document.getElementById('sheet');
            if (sheet) { sheet.classList.remove('minimized'); sheet.classList.add('active'); }
            const noteInput = document.getElementById('sheet-note');
            if (noteInput) {
                if (noteInput.disabled) enableEdit();
                noteInput.focus();
                noteInput.selectionStart = noteInput.selectionEnd = noteInput.value.length;
            }
            speak("เปิดกล่องบันทึกข้อมูล พร้อมบันทึกหมายเหตุ");
        } else {
            speak("กรุณาเลือกแปลงที่ดินก่อน");
        }
    } else if (isSave) {
        const job = findJobById(selectedJobId);
        if (job) {
            const btnSave = document.getElementById('btn-save');
            if (btnSave && !btnSave.classList.contains('hidden')) { speak("บันทึกข้อมูลเรียบร้อย"); saveData(); } else speak("ไม่สามารถบันทึกได้ในโหมดนี้");
        } else {
            speak("ไม่มีข้อมูลให้บันทึก");
        }
    } else if (isCloseSheet) {
        if (selectedJobId) { speak("ปิดกล่องบันทึกข้อมูล"); closeSheet(); } else speak("ไม่มีกล่องบันทึกเปิดอยู่");
    } else if (isNext) {
        await routeToNextPoint();
    } else if (isCancelNav) {
        if (isNavigating) { speak("ยกเลิกการนำทางเรียบร้อย"); await stopNav(); } else speak("ไม่ได้อยู่ในโหมดนำทาง");
    } else if (isDeleteSurvey) {
        const job = findJobById(selectedJobId);
        if (job) { speak("เปิดกล่องข้อยืนยันการลบ"); await deleteSurveyData(); } else speak("กรุณาเลือกแปลงที่ดินที่ต้องการลบข้อมูลก่อน");
    } else if (isClearNote) {
        const noteInput = document.getElementById('sheet-note');
        const searchInput = document.getElementById('inp-search');
        if (searchInput && document.activeElement === searchInput) {
            searchInput.value = '';
            doSearch();
            speak("ลบข้อความ");
        } else if (noteInput && !noteInput.disabled) {
            speak("คุณต้องการลบข้อความทั้งหมดใช่หรือไม่");
            const confirm = await Swal.fire({
                title: 'ลบข้อความทั้งหมด?', text: 'คุณต้องการลบข้อความหมายเหตุทั้งหมดใช่หรือไม่?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: 'ลบทั้งหมด', cancelButtonText: 'ยกเลิก'
            });
            if (confirm.isConfirmed) {
                noteInput.value = '';
                noteInput.dispatchEvent(new Event('input'));
                noteInput.focus();
                speak("ลบข้อความทั้งหมดเรียบร้อย");
            } else { speak("ยกเลิกการลบข้อความ"); }
        } else { speak("ไม่มีกล่องข้อความให้ลบ"); }
    } else if (isShowLabels) {
        if (!showPinLabels) togglePinLabels();
        speak("เปิดป้าย");
    } else if (isHideLabels) {
        if (showPinLabels) togglePinLabels();
        speak("ปิดป้าย");
    } else if (isShowPlot) {
        if (viewMode !== 'original') { viewMode = 'original'; document.getElementById('btn-view').innerHTML = '<i class="fa-solid fa-draw-polygon"></i>'; renderMap(); speak("แสดงขอบเขตแปลงที่ดิน"); } else speak("แสดงขอบเขตแปลงอยู่แล้ว");
    } else if (isShowPin) {
        if (viewMode !== 'pin') { viewMode = 'pin'; document.getElementById('btn-view').innerHTML = '<i class="fa-solid fa-map-pin"></i>'; renderMap(); speak("แสดงหมุด"); } else speak("แสดงหมุดอยู่แล้ว");
    } else if (isToggleBaseMap) {
        toggleBaseMap();
        const mapType = currentBaseMap === 'hybrid' ? 'แผนที่ดาวเทียม' : 'แผนที่ถนน';
        speak("สลับแผนที่ฐานเป็น" + mapType);
    } else if (isShowDetails) {
        const jobId = selectedJobId || lastSelectedJobId;
        const job = findJobById(jobId);
        if (job) {
            selectedJobId = job.id;
            viewJsonData();
            speak("แสดงข้อมูลดิบ");
        } else {
            speak("กรุณาเลือกแปลงที่ดินก่อน");
        }
    } else if (isFocusSearch) {
        const searchInput = document.getElementById('inp-search');
        if (searchInput) { searchInput.focus(); searchInput.select(); speak("ค้นหา"); }
    } else if (isNavigateSearchItem) {
        let targetIndex = -1;
        if (cleanTranscript.includes("หนึ่ง") || cleanTranscript.includes("1")) targetIndex = 0;
        else if (cleanTranscript.includes("สอง") || cleanTranscript.includes("2")) targetIndex = 1;
        else if (cleanTranscript.includes("สาม") || cleanTranscript.includes("3")) targetIndex = 2;
        else if (cleanTranscript.includes("สี่") || cleanTranscript.includes("4")) targetIndex = 3;
        else if (cleanTranscript.includes("ห้า") || cleanTranscript.includes("5")) targetIndex = 4;
        else if (cleanTranscript.includes("หก") || cleanTranscript.includes("6")) targetIndex = 5;
        else if (cleanTranscript.includes("เจ็ด") || cleanTranscript.includes("7")) targetIndex = 6;
        else if (cleanTranscript.includes("แปด") || cleanTranscript.includes("8")) targetIndex = 7;
        else if (cleanTranscript.includes("เก้า") || cleanTranscript.includes("9")) targetIndex = 8;
        else if (cleanTranscript.includes("สิบ") || cleanTranscript.includes("10")) targetIndex = 9;

        if (targetIndex >= 0) {
            const hits = getFilteredJobs();
            if (hits && hits.length > targetIndex) {
                const j = hits[targetIndex];
                selectedJobId = j.id;
                openSheet(j);
                const resultsEl = document.getElementById('search-results');
                if (resultsEl) resultsEl.classList.remove('active');
                const searchInput = document.getElementById('inp-search');
                if (searchInput) {
                    searchInput.value = '';
                    searchInput.blur();
                }
                speak(`เดินทางไปยังรายการที่ ${targetIndex + 1}`);
                await startNav();
            } else {
                speak(`ไม่พบรายการที่ ${targetIndex + 1} ในผลการค้นหา`);
            }
        } else {
            speak("กรุณาระบุลำดับรายการให้ถูกต้อง");
        }
    } else {
        const noteInput = document.getElementById('sheet-note');
        const searchInput = document.getElementById('inp-search');
        const sheet = document.getElementById('sheet');
        const isSheetActive = sheet && sheet.classList.contains('active') && !sheet.classList.contains('minimized');
        if (searchInput && document.activeElement === searchInput) {
            const startVal = searchInput.value.trim();
            searchInput.value = startVal ? (startVal + " " + transcript) : transcript;
            doSearch();
            speak("ค้นหา " + transcript);
        } else if (noteInput && !noteInput.disabled && (document.activeElement === noteInput || isSheetActive)) {
            const startVal = noteInput.value.trim();
            noteInput.value = startVal ? (startVal + " " + transcript) : transcript;
            noteInput.dispatchEvent(new Event('input'));
            speak("จดบันทึกเรียบร้อย");
        }
    }
}

async function routeToNextPoint() {
    if (!userMarker) {
        speak("จีพีเอสไม่พร้อมใช้งาน");
        return Swal.fire('รอ GPS', '', 'info');
    }
    const filteredJobs = getFilteredJobs().filter(j => j.status !== 'done' && j.status !== 'navigating' && j.id !== selectedJobId);
    if (filteredJobs.length === 0) {
        speak("ไม่มีงานค้างแล้ว");
        return Swal.fire('ยอดเยี่ยม', 'ไม่มีงานค้างในพื้นที่นี้', 'success');
    }
    let min = Infinity, near = null;
    const u = userMarker.getLatLng();
    filteredJobs.forEach(j => {
        const lat = Number(j.lat);
        const lng = Number(j.lng);
        if (!isNaN(lat) && !isNaN(lng)) {
            const d = map.distance(u, L.latLng(lat, lng));
            if (d < min) {
                min = d;
                near = j;
            }
        }
    });
    if (near) {
        selectedJobId = near.id;
        map.setView([near.lat, near.lng], Math.max(map.getZoom(), 16));
        const sheet = document.getElementById('sheet');
        if (sheet) {
            sheet.classList.remove('minimized');
            sheet.classList.add('active');
        }
        renderMap();
        speak("กำลังนำทางไปยังจุดถัดไป");
        startNav();
    }
}

function toggleVoiceControl() {
    if (!recognition) {
        const success = initVoiceRecognition();
        if (!success) {
            Swal.fire('การสั่งการด้วยเสียง', 'ไม่รองรับ Web Speech API ในเบราว์เซอร์นี้', 'error');
            return;
        }
    }

    if (isVoiceActive) {
        isVoiceActive = false;
        isVoiceMuted = false;
        try {
            recognition.stop();
        } catch (e) {}
        speak("ปิดระบบสั่งงานด้วยเสียง");
    } else {
        isVoiceActive = true;
        isVoiceMuted = false;
        try {
            recognition.start();
            speak("เปิดระบบสั่งงานด้วยเสียง");
        } catch (e) {
            console.error("Speech Recognition start error:", e);
            isVoiceActive = false;
        }
    }
}

function updateVoiceControlUI(active) {
    const btn = document.getElementById('btn-voice');
    if (!btn) return;
    if (active === true) {
        btn.classList.remove('bg-white', 'text-gray-400', 'bg-amber-500', 'border-amber-500');
        btn.classList.add('bg-red-500', 'text-white', 'animate-pulse', 'border-red-500');
        btn.innerHTML = '<i class="fa-solid fa-microphone"></i>';
    } else if (active === 'muted') {
        btn.classList.remove('bg-white', 'text-gray-400', 'bg-red-500', 'animate-pulse', 'border-red-500');
        btn.classList.add('bg-amber-500', 'text-white', 'border-amber-500');
        btn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
    } else {
        btn.classList.remove('bg-red-500', 'bg-amber-500', 'text-white', 'animate-pulse', 'border-red-500', 'border-amber-500');
        btn.classList.add('bg-white', 'text-gray-400');
        btn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
    }
}

async function deleteSurveyData() {
    const job = findJobById(selectedJobId);
    if (!job) return;

    const hasImages = job.properties && job.properties.images && job.properties.images.length > 0;

    let htmlContent = `
        <div class="text-sm text-gray-600 text-left space-y-2">
            <p>ระบบจะลบผลการสำรวจ (หมายเหตุ, รูปถ่าย, วันที่) และคืนค่าสถานะแปลงนี้ให้เป็น <b>"รอการตรวจสอบ"</b></p>
            <p class="text-red-500 font-bold">* แปลงที่ดินจะยังคงแสดงอยู่บนแผนที่ตามปกติ</p>
    `;

    if (hasImages) {
        htmlContent += `
            <div class="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2">
                <input type="checkbox" id="swal-delete-cloud-images" class="w-4 h-4 rounded text-red-650 focus:ring-red-500 cursor-pointer">
                <label for="swal-delete-cloud-images" class="text-xs font-bold text-gray-700 cursor-pointer select-none">
                    ลบรูปภาพทั้งหมด (${job.properties.images.length} รูป) ออกจาก Cloudinary ด้วย
                </label>
            </div>
        `;
    }

    htmlContent += `</div>`;

    const result = await Swal.fire({
        title: 'ลบข้อมูลการสำรวจ?',
        html: htmlContent,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ยืนยันการลบข้อมูลสำรวจ',
        cancelButtonText: 'ยกเลิก',
        preConfirm: () => {
            const chk = document.getElementById('swal-delete-cloud-images');
            return {
                deleteFromCloud: chk ? chk.checked : false
            };
        }
    });

    if (result.isConfirmed) {
        const deleteFromCloud = (result.value && result.value.deleteFromCloud) || false;

        justDeletedJobId = job.id;
        selectedJobId = null;
        isMapClickBlocked = true;
        closeSheet();

        showLoading(true, 'กำลังลบผลการสำรวจ...');
        try {
            if (deleteFromCloud && hasImages) {
                await Promise.all(job.properties.images.map(async (img) => {
                    const publicId = img ? (img.public_id || getPublicIdFromUrl(typeof img === 'string' ? img : img.url)) : null;
                    if (publicId) {
                        try {
                            await fetch(GAS_URL + "?publicId=" + encodeURIComponent(publicId), { mode: 'no-cors' });
                        } catch (err) {
                            console.error("ลบ Cloudinary พลาด:", err);
                        }
                    }
                }));
            }

            job.status = 'waiting';
            job.properties.note = '';
            job.properties.date = '';
            job.properties.images = [];

            await saveJobToSupabase(job);
            renderMap();
            showLoading(false);

            await Swal.fire({ toast: true, icon: 'success', title: 'ลบผลการสำรวจและคืนค่าสถานะแล้ว', timer: 1500, showConfirmButton: false });
        } catch (e) {
            showLoading(false);
            Swal.fire('ทำรายการไม่สำเร็จ', e.message, 'error');
        } finally {
            setTimeout(() => {
                justDeletedJobId = null;
                isMapClickBlocked = false;
            }, 2000);
        }
    }
}

function getFilteredJobs() {
    const search = document.getElementById('inp-search').value.toLowerCase().trim();
    const amphoe = document.getElementById('sel-amphoe').value;
    const tambon = document.getElementById('sel-tambon').value;

    return dbJobs.filter(j => {
        const matchCat = j.category === currentUser.category;
        const p = j.properties || {};
        const txt = search;

        let matchS = txt === "";

        if (!matchS) {
            // =========================================================
            // 🎯 กำหนดจุดค้นหาตรงนี้ (ผมแยกตัวแปรมาให้ดูและแก้ง่ายๆ ครับ)
            // =========================================================

            // 1. ค้นหาจาก ไอดี / ชื่อแปลง (หมวด 0)
            const findName = (p.name || "").toString().toLowerCase().includes(txt);

            // 2. ค้นหาจาก ช่องเชื่อมโยงค้นหา (หมวด 1)
            const findSearchField = (p.search_field || "").toString().toLowerCase().includes(txt);

            // 3. ค้นหาจาก หมายเหตุ (note)
            const findNote = (p.note || "").toString().toLowerCase().includes(txt);

            // ถ้าเจอคำค้นหาในช่องใดช่องหนึ่ง ให้ถือว่าค้นหาเจอ 
            // (ถ้าคุณไม่อยากให้หาในหมายเหตุ ให้ลบ || findNote ออกได้เลยครับ)
            if (findName || findSearchField || findNote) {
                matchS = true;
            }
        }

        const valA = (p.amphoe || p.AMPH_NAME || p.AMPHOE || p.district || "").toString().trim();
        const valT = (p.tambon || p.TUMB_NAME || p.TAMBON || p.subdistrict || "").toString().trim();
        const matchA = amphoe === "" || valA === amphoe;
        const matchT = tambon === "" || valT === tambon;

        return matchCat && matchS && matchA && matchT;
    });
}

function bindGeomanEvents(layer, jobId) {
    if (!layer) return;

    const bindToSingleLayer = (l) => {
        // จำกัดไม่ให้ทำการหมุนบน Marker และ Circle เพื่อเลี่ยงข้อผิดพลาด
        const isMarker = l instanceof L.Marker || (typeof l.getLatLng === 'function' && typeof l.getBounds !== 'function');
        const isCircle = typeof l.getRadius === 'function';
        if (isMarker || isCircle) {
            if (l.pm) {
                l.pm.setOptions({ allowRotation: false });
            }
        }

        // ดักจับเหตุการณ์การแก้ไข ย้าย และหมุน
        l.on('pm:edit', () => { queueGeomanUpdate(l, jobId); showPendingActionsBar(); });
        l.on('pm:dragend', () => { queueGeomanUpdate(l, jobId); showPendingActionsBar(); });
        l.on('pm:rotateend', () => { queueGeomanUpdate(l, jobId); showPendingActionsBar(); });
        l.on('pm:revert', () => { dequeueGeomanUpdate(jobId); showPendingActionsBar(); });
    };

    if (typeof layer.eachLayer === 'function') {
        layer.eachLayer(sub => {
            bindToSingleLayer(sub);
        });
    } else {
        bindToSingleLayer(layer);
    }
}

// --- คิวจัดการเก็บพิกัดที่มีการขยับ/แก้ไขชั่วคราว ---
function queueGeomanUpdate(l, jobId) {
    let lat = 0;
    let lng = 0;
    let geometry = {};
    let isCircle = false;
    let radius = 0;

    if (typeof l.getRadius === 'function') {
        // Circle (วงกลม)
        const center = l.getLatLng();
        lat = center.lat;
        lng = center.lng;
        isCircle = true;
        radius = l.getRadius();
        geometry = {
            type: 'Point',
            coordinates: [lng, lat]
        };
    } else if (l instanceof L.Marker || (typeof l.getLatLng === 'function' && typeof l.getBounds !== 'function')) {
        // Marker (จุดพิกัด)
        const pos = l.getLatLng();
        lat = pos.lat;
        lng = pos.lng;
        geometry = {
            type: 'Point',
            coordinates: [lng, lat]
        };
    } else if (typeof l.getBounds === 'function') {
        // Polygon หรือ Rectangle (รูปแปลงสี่เหลี่ยม/หลายเหลี่ยม)
        geometry = l.toGeoJSON().geometry;
        const bounds = l.getBounds();
        const center = bounds.getCenter();
        lat = center.lat;
        lng = center.lng;
    }

    window.pendingGeomanUpdates.set(jobId, { lat, lng, geometry, isCircle, radius });

    // Calculate new area and update job object properties in-place
    let newAreaFormatted = '-';
    if (isCircle) {
        const areaSqm = calculateCircleAreaInSqm(radius);
        newAreaFormatted = formatThaiArea(areaSqm);
    } else if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
        const coords = getFlatCoordinates(l);
        const areaSqm = calculatePolygonAreaInSqm(coords);
        newAreaFormatted = formatThaiArea(areaSqm);
    }

    const job = findJobById(jobId);
    if (job) {
        job.lat = lat;
        job.lng = lng;
        job.geometry = geometry;
        if (!job.properties) job.properties = {};
        if (isCircle) {
            job.properties.is_circle = true;
            job.properties.radius = radius;
        }
        job.properties.area = newAreaFormatted;
    }

    // Update bottom sheet area input real-time if sheet is open for this shape
    if (selectedJobId === jobId) {
        const areaInput = document.getElementById('sheet-area');
        if (areaInput) {
            areaInput.value = newAreaFormatted;
        }
    }
}

function dequeueGeomanUpdate(jobId) {
    if (window.pendingGeomanUpdates) {
        window.pendingGeomanUpdates.delete(jobId);
    }
}

async function savePendingGeomanUpdates() {
    if (!window.pendingGeomanUpdates || window.pendingGeomanUpdates.size === 0) return;

    const updates = Array.from(window.pendingGeomanUpdates.entries());
    window.pendingGeomanUpdates.clear(); // ล้างคิวทันทีเพื่อป้องกันการบันทึกซ้อน

    showLoading(true, 'กำลังบันทึกการเปลี่ยนแปลงรูปแปลง...');
    try {
        for (const [jobId, data] of updates) {
            const job = dbJobs.find(x => x.id === jobId);
            if (job) {
                job.lat = data.lat;
                job.lng = data.lng;
                job.geometry = data.geometry;
                if (!job.properties) job.properties = {};
                if (data.isCircle) {
                    job.properties.is_circle = true;
                    job.properties.radius = data.radius;
                }
                await saveJobToSupabase(job);
            }
        }
        Swal.fire({ toast: true, icon: 'success', title: 'บันทึกการเปลี่ยนแปลงรูปแปลงสำเร็จ', timer: 1500, showConfirmButton: false });
    } catch (err) {
        console.error("Geoman pending update error:", err);
        Swal.fire('เกิดข้อผิดพลาด', 'บันทึกล้มเหลว: ' + err.message, 'error');
        renderMap(); // โหลดพิกัดเดิมกลับมา
    } finally {
        showLoading(false);
    }
}

function toggleGeomanToolbar(show) {
    const container = document.querySelector('.leaflet-bottom.leaflet-right');
    const toolbars = document.querySelectorAll('.leaflet-pm-toolbar');
    const btn = document.getElementById('btn-toggle-pm');

    // If controls are not yet generated in the DOM, retry up to 15 times (1.5 seconds total)
    if (!container || toolbars.length === 0) {
        if (!window.pmToggleRetryCount) window.pmToggleRetryCount = 0;
        if (window.pmToggleRetryCount < 15) {
            window.pmToggleRetryCount++;
            setTimeout(() => toggleGeomanToolbar(show), 100);
        }
        return;
    }
    // Reset retry count once found
    window.pmToggleRetryCount = 0;

    let isCurrentlyHidden = false;
    if (container) {
        isCurrentlyHidden = container.classList.contains('pm-hidden');
    } else if (toolbars.length > 0) {
        isCurrentlyHidden = toolbars[0].classList.contains('hidden');
    }

    let shouldHide = show !== undefined ? !show : !isCurrentlyHidden;

    if (container) {
        if (shouldHide) {
            container.classList.add('pm-hidden');
        } else {
            container.classList.remove('pm-hidden');
        }
    }

    toolbars.forEach(toolbar => {
        if (shouldHide) {
            toolbar.classList.add('hidden');
        } else {
            toolbar.classList.remove('hidden');
        }
    });

    if (shouldHide) {
        // ทำการซ่อนเครื่องมือ
        if (btn) {
            btn.classList.remove('bg-purple-600', 'text-white');
            btn.classList.add('bg-white', 'text-purple-600');
            btn.innerHTML = '<i class="fa-solid fa-pen-ruler"></i>';
        }
        // สั่งปิดโหมดทำงานทั้งหมดของ Geoman ซึ่งจะกระตุ้นการบันทึกคิวชั่วคราวโดยอัตโนมัติ
        if (map && map.pm) {
            map.pm.disableGlobalEditMode();
            map.pm.disableGlobalDragMode();
            map.pm.disableGlobalRotateMode();
            map.pm.disableGlobalRemovalMode();
            if (map.pm.Draw) map.pm.Draw.disable();
        }
    } else {
        // แสดงเครื่องมือ
        if (btn) {
            btn.classList.add('bg-purple-600', 'text-white');
            btn.classList.remove('bg-white', 'text-purple-600');
            btn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        }
    }
}
window.toggleGeomanToolbar = toggleGeomanToolbar;

function togglePMEnabledSetting(enabled) {
    localStorage.setItem('survey_enable_pm', enabled ? 'true' : 'false');
    const chk = document.getElementById('chk-enable-pm');
    if (chk) chk.checked = enabled;
    const btnTogglePm = document.getElementById('btn-toggle-pm');
    if (enabled) {
        if (btnTogglePm) btnTogglePm.classList.remove('hidden');
        toggleGeomanToolbar(true);
    } else {
        if (btnTogglePm) btnTogglePm.classList.add('hidden');
        toggleGeomanToolbar(false);
    }
}
window.togglePMEnabledSetting = togglePMEnabledSetting;

function toggleSpeechEnableSetting(enabled) {
    localStorage.setItem('survey_speech_enabled', enabled ? 'true' : 'false');
    isSpeechEnabled = enabled;
    const chk = document.getElementById('chk-enable-speech');
    if (chk) chk.checked = enabled;
}
window.toggleSpeechEnableSetting = toggleSpeechEnableSetting;

function showPendingActionsBar() {
    const bar = document.getElementById('pending-actions-bar');
    if (!bar) return;
    
    const newCount = window.pendingNewShapes ? window.pendingNewShapes.length : 0;
    const editCount = window.pendingGeomanUpdates ? Array.from(window.pendingGeomanUpdates.keys()).filter(key => !key.startsWith('drawn_temp_')).length : 0;
    
    if (newCount > 0 || editCount > 0) {
        bar.classList.remove('hidden');
        const textEl = document.getElementById('pending-actions-text');
        if (textEl) {
            textEl.innerText = `วาดใหม่: ${newCount} | แก้ไข: ${editCount}`;
        }
    } else {
        bar.classList.add('hidden');
    }
}
window.showPendingActionsBar = showPendingActionsBar;

async function cancelAllPendingChanges() {
    const result = await Swal.fire({
        title: 'ยืนยันการยกเลิก?',
        text: 'การวาดและแก้ไขรูปแปลงทั้งหมดที่ยังไม่ได้บันทึกจะถูกล้างออก',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'ใช่, ยกเลิกทั้งหมด',
        cancelButtonText: 'ปิด'
    });

    if (!result.isConfirmed) return;

    if (window.pendingNewShapes && window.pendingNewShapes.length > 0) {
        window.pendingNewShapes.forEach(item => {
            if (item.layer) {
                if (map && item.layer.pm && typeof item.layer.pm.disable === 'function') {
                    item.layer.pm.disable();
                }
                map.removeLayer(item.layer);
            }
        });
    }

    window.pendingNewShapes = [];
    if (window.pendingGeomanUpdates) {
        window.pendingGeomanUpdates.clear();
    }

    if (map && map.pm) {
        map.pm.disableGlobalEditMode();
        map.pm.disableGlobalDragMode();
        map.pm.disableGlobalRotateMode();
        map.pm.disableGlobalRemovalMode();
        if (map.pm.Draw) map.pm.Draw.disable();
    }

    renderMap();
    showPendingActionsBar();

    Swal.fire({
        toast: true,
        position: 'top',
        icon: 'info',
        title: 'ยกเลิกการเปลี่ยนแปลงทั้งหมดแล้ว',
        timer: 1500,
        showConfirmButton: false
    });
}
window.cancelAllPendingChanges = cancelAllPendingChanges;

async function saveAllPendingChanges() {
    const newCount = window.pendingNewShapes ? window.pendingNewShapes.length : 0;
    const editCount = window.pendingGeomanUpdates ? Array.from(window.pendingGeomanUpdates.keys()).filter(key => !key.startsWith('drawn_temp_')).length : 0;

    if (newCount === 0 && editCount === 0) {
        Swal.fire('ไม่มีข้อมูลที่เปลี่ยนแปลง', '', 'info');
        return;
    }

    if (map && map.pm) {
        map.pm.disableGlobalEditMode();
        map.pm.disableGlobalDragMode();
        map.pm.disableGlobalRotateMode();
        map.pm.disableGlobalRemovalMode();
        if (map.pm.Draw) map.pm.Draw.disable();
    }

    const newJobsToSave = [];
    const existingJobsToUpdate = [];

    const collectedDetails = [];
    for (let i = 0; i < newCount; i++) {
        const shape = window.pendingNewShapes[i];
        
        if (shape.layer) {
            if (typeof shape.layer.getBounds === 'function') {
                map.fitBounds(shape.layer.getBounds(), { padding: [100, 100] });
            } else if (typeof shape.layer.getLatLng === 'function') {
                map.setView(shape.layer.getLatLng(), 17);
            }
        }

        let optionsHtml = '';
        categories.forEach(cat => {
            optionsHtml += `<option value="${cat}" ${cat === currentUser.category ? 'selected' : ''}>${cat}</option>`;
        });

        const { value: formValues } = await Swal.fire({
            title: `ระบุข้อมูลแปลงใหม่ (${i + 1}/${newCount})`,
            html: `
                <div class="text-left space-y-3">
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">ชื่อแปลง / เลขทะเบียน</label>
                        <input id="swal-job-name" class="swal2-input w-full m-0 px-3 py-2 text-sm border rounded-xl" placeholder="เช่น แปลง 101" style="box-sizing:border-box; height:auto; margin:0;" value="แปลงใหม่ ${i+1}">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">รายละเอียด / หมายเหตุ</label>
                        <textarea id="swal-job-note" class="swal2-textarea w-full m-0 px-3 py-2 text-sm border rounded-xl" placeholder="เช่น รายละเอียดแปลง" style="box-sizing:border-box; height:60px; margin:0;"></textarea>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1">ประเภทงาน / โครงการ</label>
                        <select id="swal-job-category" class="swal2-select w-full m-0 px-3 py-2 text-sm border rounded-xl" style="box-sizing:border-box; height:auto; margin:0; width:100%;">
                            ${optionsHtml}
                        </select>
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            cancelButtonText: 'ยกเลิกการบันทึกทั้งหมด',
            confirmButtonText: 'ถัดไป',
            confirmButtonColor: '#2563eb',
            cancelButtonColor: '#ef4444',
            preConfirm: () => {
                const name = document.getElementById('swal-job-name').value.trim();
                const note = document.getElementById('swal-job-note').value.trim();
                const category = document.getElementById('swal-job-category').value;
                if (!name) {
                    Swal.showValidationMessage('กรุณาระบุชื่อแปลง');
                    return false;
                }
                return { name, note, category };
            }
        });

        if (!formValues) {
            Swal.fire({
                icon: 'info',
                title: 'ยกเลิกการบันทึกชั่วคราว',
                text: 'การบันทึกถูกระงับ ข้อมูลการวาดบนแผนที่ยังไม่ถูกลบ'
            });
            return;
        }

        collectedDetails.push(formValues);
    }

    for (let i = 0; i < newCount; i++) {
        const shape = window.pendingNewShapes[i];
        const formValues = collectedDetails[i];

        if (shape.layer) {
            map.removeLayer(shape.layer);
        }

        let finalLat = shape.lat;
        let finalLng = shape.lng;
        let finalGeometry = shape.geometry;
        let finalRadius = shape.radius;

        if (window.pendingGeomanUpdates.has(shape.id)) {
            const up = window.pendingGeomanUpdates.get(shape.id);
            finalLat = up.lat;
            finalLng = up.lng;
            finalGeometry = up.geometry;
            finalRadius = up.radius;
            window.pendingGeomanUpdates.delete(shape.id);
        }

        const finalId = 'custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9) + '_' + i;

        const properties = {
            name: formValues.name,
            note: formValues.note,
            date: new Date().toISOString().split('T')[0],
            is_custom_draw: true,
            navigator_id: null,
            navigator_name: null,
            images: []
        };
        if (shape.properties && shape.properties.is_circle) {
            properties.is_circle = true;
            properties.radius = finalRadius;
        }

        newJobsToSave.push({
            id: finalId,
            team_id: currentUser.team_id,
            lat: finalLat,
            lng: finalLng,
            geometry: finalGeometry,
            status: 'done',
            category: formValues.category,
            properties: properties,
            updated_at: new Date().toISOString()
        });
    }

    const updates = Array.from(window.pendingGeomanUpdates.entries());
    for (const [jobId, data] of updates) {
        const job = dbJobs.find(x => x.id === jobId);
        if (job) {
            job.lat = data.lat;
            job.lng = data.lng;
            job.geometry = data.geometry;
            if (!job.properties) job.properties = {};
            if (data.isCircle) {
                job.properties.is_circle = true;
                job.properties.radius = data.radius;
            }
            job.updated_at = new Date().toISOString();
            existingJobsToUpdate.push(job);
        }
    }

    showLoading(true, 'กำลังบันทึกข้อมูลรูปแปลงทั้งหมด...');
    try {
        const allSaves = [];
        
        newJobsToSave.forEach(j => {
            allSaves.push(saveJobToSupabase(j));
        });

        existingJobsToUpdate.forEach(j => {
            allSaves.push(saveJobToSupabase(j));
        });

        await Promise.all(allSaves);

        window.pendingNewShapes = [];
        window.pendingGeomanUpdates.clear();

        await syncJobsFromDB();
        showPendingActionsBar();

        Swal.fire({
            icon: 'success',
            title: 'บันทึกข้อมูลเรียบร้อยแล้ว',
            text: `บันทึกรูปแปลงใหม่ ${newJobsToSave.length} รายการ และอัปเดตพิกัด ${existingJobsToUpdate.length} รายการ`,
            timer: 2500,
            showConfirmButton: true
        });
    } catch (err) {
        console.error("Save all pending error:", err);
        Swal.fire('บันทึกล้มเหลว', 'เกิดข้อผิดพลาดในการบันทึก: ' + err.message, 'error');
        renderMap();
    } finally {
        showLoading(false);
    }
}
window.saveAllPendingChanges = saveAllPendingChanges;

function renderMap(fitBounds = false) {
    // ปิดการใช้งาน Geoman บน layer เดิมเพื่อป้องกันจุดยอดค้าง (orphaned helper markers)
    markersGroup.eachLayer(layer => {
        if (layer.pm && typeof layer.pm.disable === 'function') {
            layer.pm.disable();
        }
        if (typeof layer.eachLayer === 'function') {
            layer.eachLayer(sub => {
                if (sub.pm && typeof sub.pm.disable === 'function') {
                    sub.pm.disable();
                }
            });
        }
    });

    markersGroup.clearLayers();
    const filtered = getFilteredJobs();
    const group = L.featureGroup();
    filtered.slice(0, 1500).forEach(job => {
        let layer;
        let color = job.status === 'done' ? '#10b981' : (job.status === 'navigating' ? '#f97316' : '#ef4444');
        let fill = job.status === 'done' ? 0.4 : 0.2;
        if (viewMode === 'original' && job.geometry) {
            if (job.geometry.type.includes('Polygon')) {
                layer = L.geoJSON(job.geometry, { style: { color: color, weight: 2, fillOpacity: fill, className: job.status === 'navigating' ? 'job-navigating-pulse' : '' } });
            } else if (job.properties && job.properties.is_circle && job.properties.radius) {
                layer = L.circle([job.lat, job.lng], {
                    radius: job.properties.radius,
                    color: color,
                    weight: 2,
                    fillOpacity: fill,
                    className: job.status === 'navigating' ? 'job-navigating-pulse' : ''
                });
            } else {
                let iconUrl = job.status === 'done'
                    ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png'
                    : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png';
                let mClassName = '';
                if (job.status === 'navigating') {
                    iconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png';
                    mClassName = 'job-navigating-pulse';
                }
                layer = L.marker([job.lat, job.lng], {
                    icon: L.icon({ iconUrl, iconSize: [25, 41], iconAnchor: [12, 41], className: mClassName })
                });
            }
        } else {
            let iconUrl = job.status === 'done'
                ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png'
                : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png';
            let mClassName = '';
            if (job.status === 'navigating') {
                iconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png';
                mClassName = 'job-navigating-pulse';
            }
            layer = L.marker([job.lat, job.lng], {
                icon: L.icon({ iconUrl, iconSize: [25, 41], iconAnchor: [12, 41], className: mClassName })
            });
        }
        if (layer) {
            layer.jobId = job.id;
            // คัดลอก jobId ไปยัง sublayers หากเป็น LayerGroup
            if (typeof layer.eachLayer === 'function') {
                layer.eachLayer(sub => {
                    sub.jobId = job.id;
                });
            }
            // ผูกเหตุการณ์การวาด/แก้ไขย้ายสำหรับ Geoman
            bindGeomanEvents(layer, job.id);
            if (isNavigating && job.id !== selectedJobId) {
                layer.on('add', () => {
                    if (typeof layer.getElement === 'function') {
                        layer.getElement()?.classList.add('dimmed-layer');
                    } else if (typeof layer.setStyle === 'function') {
                        layer.setStyle({ opacity: 0.15, fillOpacity: 0.05 });
                    } else if (typeof layer.eachLayer === 'function') {
                        layer.eachLayer(sub => {
                            if (typeof sub.getElement === 'function') {
                                sub.getElement()?.classList.add('dimmed-layer');
                            } else if (typeof sub.setStyle === 'function') {
                                sub.setStyle({ opacity: 0.15, fillOpacity: 0.05 });
                            }
                        });
                    }
                });
            }

            // Bind Tooltip Label according to navigation state
            let labelClass = 'job-label';
            if (job.status === 'done') {
                labelClass += ' job-label-done';
            } else if (job.id === selectedJobId && isNavigating) {
                labelClass += ' job-label-navigating';
            } else {
                labelClass += ' job-label-pending';
            }

            if ((isNavigating && job.id === selectedJobId) || (!isNavigating && showPinLabels)) {
                layer.bindTooltip(job.properties.name || 'ไม่มีชื่อ', {
                    permanent: true,
                    direction: 'top',
                    className: labelClass,
                    offset: [0, -10]
                });
            }

            layer.on('click', () => {
                const isPmActive = map && map.pm && (
                    map.pm.globalEditModeEnabled() || 
                    map.pm.globalDragModeEnabled() || 
                    map.pm.globalRotateModeEnabled() || 
                    map.pm.globalDrawModeEnabled() ||
                    map.pm.globalRemovalModeEnabled()
                );
                if (isPmActive) return;

                markerJustClicked = true;
                openSheet(job);
            });
            markersGroup.addLayer(layer);
            group.addLayer(layer);
        }
    });
    if (fitBounds && filtered.length > 0) {
        try {
            map.fitBounds(group.getBounds(), { padding: [50, 50] });
        } catch (e) { }
    }
    updateCounter();
}

function speak(text, force = false) {
    if (!isSpeechEnabled && !force) return;
    if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'th-TH';
        speechSynth.speak(u);
    }
}

async function startNav() {
    if (!userMarker) return Swal.fire('GPS ไม่พร้อม', '', 'warning');
    const job = findJobById(selectedJobId);
    if (!job) return;

    // ตรวจสอบคิวความขัดแย้งการล๊อกเป้าหมายชนกัน (Concurrency lock check)
    if (supabaseClient && currentUser) {
        showLoading(true, 'กำลังตรวจสอบคิวการเดินทาง...');
        try {
            const { data, error } = await supabaseClient
                .from('jobs')
                .select('status, properties')
                .eq('id', job.id)
                .maybeSingle();

            if (!error && data) {
                const dbStatus = data.status;
                const dbProps = data.properties || {};
                if (dbStatus === 'navigating' && dbProps.navigator_id && dbProps.navigator_id !== currentUser.id) {
                    showLoading(false);
                    Swal.fire({
                        title: 'มีเพื่อนร่วมทีมกำลังเดินทางแล้ว',
                        text: `${dbProps.navigator_name || 'เพื่อนร่วมทีม'} ได้สิทธิ์เดินทางไปที่แปลงนี้ก่อนหน้าคุณแล้ว`,
                        icon: 'warning',
                        confirmButtonText: 'ตกลง'
                    });
                    // ปิดหน้าต่างและซิงค์ใหม่
                    closeSheet();
                    await syncJobsSilently();
                    return;
                }
            }
        } catch (err) {
            console.error("Concurrent navigation check failed", err);
        } finally {
            showLoading(false);
        }
    }

    viewMode = 'pin';
    document.getElementById('btn-view').innerHTML = '<i class="fa-solid fa-map-pin"></i>';

    isNavigating = true;
    job.prevStatus = (job.status === 'navigating') ? 'waiting' : job.status;
    job.status = 'navigating';
    if (!job.properties) job.properties = {};
    job.properties.navigator_id = currentUser.id;
    job.properties.navigator_name = currentUser.name;

    try {
        await saveJobToSupabase(job);
    } catch (e) {
        console.error("Failed to save navigation state to Supabase", e);
    }

    renderMap();
    map.fitBounds(L.latLngBounds([userMarker.getLatLng(), [job.lat, job.lng]]), { padding: [100, 100] });

    document.getElementById('btn-nav-start').classList.add('hidden');
    document.getElementById('btn-nav-cancel').classList.remove('hidden');
    document.getElementById('sheet').classList.add('minimized');

    if (routingControl) {
        try { map.removeControl(routingControl); } catch (e) { }
    }
    try {
        routingControl = L.Routing.control({
            waypoints: [userMarker.getLatLng(), L.latLng(job.lat, job.lng)],
            createMarker: () => null,
            lineOptions: { styles: [{ color: '#2563eb', weight: 6, opacity: 0.9 }] },
            show: false,
            addWaypoints: false
        }).addTo(map);
        const initialDistance = map.distance(userMarker.getLatLng(), [job.lat, job.lng]);
        let distText = "";
        if (initialDistance >= 1000) {
            distText = `ระยะทางประมาณ ${(initialDistance / 1000).toFixed(1)} กิโลเมตร`;
        } else {
            distText = `ระยะทางประมาณ ${Math.round(initialDistance)} เมตร`;
        }
        speak(`เริ่มการนำทาง ${distText}`);

        if (navInterval) clearInterval(navInterval);
        let lastSpokenTime = Date.now();
        navInterval = setInterval(async () => {
            if (!userMarker) return;
            const d = map.distance(userMarker.getLatLng(), [job.lat, job.lng]);

            // Auto-switch to parcel boundaries (original view mode) if within 500 meters
            if (d < 500 && viewMode !== 'original') {
                viewMode = 'original';
                document.getElementById('btn-view').innerHTML = '<i class="fa-solid fa-map-pin"></i>';
                renderMap();
                speak("เข้าสู่ระยะห้าร้อยเมตร แสดงขอบเขตแปลงสำรวจอัตโนมัติ");
            }

            if (d < 100) {
                speak("ถึงที่หมายแล้ว");
                await stopNav();
                document.getElementById('sheet').classList.remove('minimized');
                document.getElementById('sheet').classList.add('active');
                Swal.fire({ toast: true, icon: 'success', title: 'ถึงแล้ว!', text: 'กรอกข้อมูลได้เลย', timer: 2000, showConfirmButton: false });
            } else {
                // Periodically speak distance (every 30 seconds)
                const now = Date.now();
                if (now - lastSpokenTime >= 30000) {
                    lastSpokenTime = now;
                    if (d >= 1000) {
                        speak(`เหลือระยะทางอีก ${(d / 1000).toFixed(1)} กิโลเมตร`);
                    } else {
                        speak(`เหลือระยะทางอีก ${Math.round(d)} เมตร`);
                    }
                }
            }
        }, 3000);
    } catch (e) { }
}

async function stopNav(skipDbSaveForJobId = null) {
    isNavigating = false;
    if (routingControl) {
        try { map.removeControl(routingControl); } catch (e) { }
    }
    routingControl = null;
    if (navInterval) clearInterval(navInterval);
    document.getElementById('btn-nav-start').classList.remove('hidden');
    document.getElementById('btn-nav-cancel').classList.add('hidden');

    // Fail-safe sweep for all jobs in local memory
    if (currentUser) {
        const promises = [];
        dbJobs.forEach(j => {
            if (j.status === 'navigating' && j.properties && j.properties.navigator_id === currentUser.id) {
                if (skipDbSaveForJobId && j.id === skipDbSaveForJobId) {
                    return;
                }
                j.status = 'waiting';
                j.properties.navigator_id = null;
                j.properties.navigator_name = null;
                promises.push(saveJobToSupabase(j).catch(err => console.error("Failed to save reset state for job " + j.id, err)));
            }
        });
        if (promises.length > 0) {
            await Promise.all(promises);
        }
    }

    const job = findJobById(selectedJobId);
    if (job && (!skipDbSaveForJobId || job.id !== skipDbSaveForJobId)) {
        let targetStatus = job.prevStatus || 'waiting';
        if (targetStatus === 'navigating') {
            targetStatus = 'waiting';
        }
        job.status = targetStatus;
        if (!job.properties) job.properties = {};
        job.properties.navigator_id = null;
        job.properties.navigator_name = null;
        try {
            await saveJobToSupabase(job);
        } catch (e) {
            console.error("Failed to save stop navigation state to Supabase", e);
        }
    }
    renderMap();
}

function openSheet(job) {
    if (isMapClickBlocked) return;
    if (justDeletedJobId && job.id === justDeletedJobId) return;

    selectedJobId = job.id;
    lastSelectedJobId = job.id;
    window.imagesToDeleteFromCloud = [];
    window.originalImagesBackup = job.properties.images ? JSON.parse(JSON.stringify(job.properties.images)) : [];

    const p = job.properties;
    document.getElementById('sheet-title').innerText = p.name || 'รายละเอียด';
    document.getElementById('sheet-meta').innerText = `${p.amphoe || p.AMPH_NAME || '-'} / ${p.tambon || p.TUMB_NAME || '-'}`;
    document.getElementById('sheet-name').value = p.name || '';
    document.getElementById('sheet-note').value = p.note || '';

    if (document.getElementById('sheet-area')) {
        document.getElementById('sheet-area').value = p.area || '-';
    }
    if (document.getElementById('sheet-source')) {
        document.getElementById('sheet-source').value = p.import_source || '-';
    }

    const btnSave = document.getElementById('btn-save');
    const btnEdit = document.getElementById('btn-edit');
    const btnNavStart = document.getElementById('btn-nav-start');
    const btnNavCancel = document.getElementById('btn-nav-cancel');
    const btnDelete = document.getElementById('btn-delete-job');
    const navWarning = document.getElementById('sheet-nav-warning');
    const navWarningText = document.getElementById('sheet-nav-warning-text');

    const isNavByOther = job.status === 'navigating' && p.navigator_id && p.navigator_id !== currentUser.id;
    const isDone = job.status === 'done';
    const isTemp = p && p.is_temp === true;

    if (isNavByOther) {
        // Locked by another user
        if (navWarning && navWarningText) {
            navWarningText.innerText = `🔴 ${p.navigator_name || 'เพื่อนร่วมทีม'} กำลังนำทางไปยังแปลงนี้ (ไม่อนุญาตให้แก้ไข/เลือก)`;
            navWarning.classList.remove('hidden');
        }
        btnNavStart.classList.add('hidden');
        btnNavCancel.classList.add('hidden');
        btnSave.classList.add('hidden');
        btnEdit.classList.add('hidden');
        if (btnDelete) btnDelete.classList.add('hidden');
        toggleInputs(false);
        renderImageGallery(p.images || [], false);
    } else if (isTemp) {
        if (navWarning) navWarning.classList.add('hidden');
        btnNavStart.classList.add('hidden');
        btnNavCancel.classList.add('hidden');
        btnSave.classList.remove('hidden');
        btnEdit.classList.add('hidden');
        if (btnDelete) {
            btnDelete.classList.remove('hidden');
            btnDelete.innerHTML = '<i class="fa-solid fa-trash-can"></i> ยกเลิกการวาด / ลบ';
            btnDelete.className = 'w-full bg-red-600 text-white py-3 rounded-xl text-sm font-bold mt-2 flex items-center justify-center gap-2 hover:bg-red-700 transition duration-200';
        }
        toggleInputs(true);
        renderImageGallery(p.images || [], true);
    } else {
        // Not locked by others
        if (navWarning) navWarning.classList.add('hidden');

        // Hide delete button if it's not done (i.e. waiting/navigating) and not custom draw (custom draw is always status=done but deletable)
        if (btnDelete) {
            if (isDone || (p && p.is_custom_draw)) {
                btnDelete.classList.remove('hidden');
                // Customize label and styling for custom draw
                if (p && p.is_custom_draw) {
                    btnDelete.innerHTML = '<i class="fa-solid fa-trash-can"></i> ลบข้อมูลรูปแปลง/หมุด';
                    btnDelete.className = 'w-full bg-red-600 text-white py-3 rounded-xl text-sm font-bold mt-2 flex items-center justify-center gap-2 hover:bg-red-700 transition duration-200';
                } else {
                    btnDelete.innerHTML = '<i class="fa-solid fa-trash-can"></i> ลบรายการนี้';
                    btnDelete.className = 'w-full bg-red-50 text-red-500 py-3 rounded-xl text-sm font-bold mt-2 flex items-center justify-center gap-2';
                }
            } else {
                btnDelete.classList.add('hidden');
            }
        }

        if (isDone) {
            btnSave.classList.add('hidden');
            btnEdit.classList.remove('hidden');
            btnNavStart.classList.add('hidden');
            btnNavCancel.classList.add('hidden');
            toggleInputs(false);
            renderImageGallery(p.images || [], false);
        } else {
            btnSave.classList.remove('hidden');
            btnEdit.classList.add('hidden');

            const isNavByMe = isNavigating && job.id === selectedJobId;
            if (isNavByMe) {
                btnNavStart.classList.add('hidden');
                btnNavCancel.classList.remove('hidden');
            } else {
                btnNavStart.classList.remove('hidden');
                btnNavCancel.classList.add('hidden');
            }

            toggleInputs(true);
            renderImageGallery(p.images || [], true);
        }
    }

    document.getElementById('fab-container').classList.add('sheet-open');
    document.getElementById('map').classList.add('sheet-open');
    const sheet = document.getElementById('sheet');
    sheet.classList.remove('minimized');
    sheet.classList.add('active');
    sheet.style.transform = '';

    if (!isNavigating) map.flyTo([job.lat, job.lng], Math.max(map.getZoom(), 16));
}

function toggleInputs(enabled) {
    document.getElementById('sheet-name').disabled = !enabled;
    document.getElementById('sheet-note').disabled = !enabled;

    const btnCamera = document.getElementById('btn-camera');
    if (btnCamera) btnCamera.disabled = !enabled;
}

function openSheetSilently(job) {
    const p = job.properties;
    document.getElementById('sheet-title').innerText = p.name || 'รายละเอียด';
    document.getElementById('sheet-meta').innerText = `${p.amphoe || p.AMPH_NAME || '-'} / ${p.tambon || p.TUMB_NAME || '-'}`;

    const nameEl = document.getElementById('sheet-name');
    const noteEl = document.getElementById('sheet-note');
    if (document.activeElement !== nameEl) nameEl.value = p.name || '';
    if (document.activeElement !== noteEl) noteEl.value = p.note || '';

    if (document.getElementById('sheet-area')) {
        document.getElementById('sheet-area').value = p.area || '-';
    }

    const btnSave = document.getElementById('btn-save');
    const btnEdit = document.getElementById('btn-edit');
    const btnNavStart = document.getElementById('btn-nav-start');
    const btnNavCancel = document.getElementById('btn-nav-cancel');
    const btnDelete = document.getElementById('btn-delete-job');
    const navWarning = document.getElementById('sheet-nav-warning');
    const navWarningText = document.getElementById('sheet-nav-warning-text');

    const isNavByOther = job.status === 'navigating' && p.navigator_id && p.navigator_id !== currentUser.id;
    const isDone = job.status === 'done';
    const isTemp = p && p.is_temp === true;

    if (isNavByOther) {
        if (navWarning && navWarningText) {
            navWarningText.innerText = `🔴 ${p.navigator_name || 'เพื่อนร่วมทีม'} กำลังนำทางไปยังแปลงนี้ (ไม่อนุญาตให้แก้ไข/เลือก)`;
            navWarning.classList.remove('hidden');
        }
        btnNavStart.classList.add('hidden');
        btnNavCancel.classList.add('hidden');
        btnSave.classList.add('hidden');
        btnEdit.classList.add('hidden');
        if (btnDelete) btnDelete.classList.add('hidden');
        toggleInputs(false);
        renderImageGallery(p.images || [], false);
    } else if (isTemp) {
        if (navWarning) navWarning.classList.add('hidden');
        btnNavStart.classList.add('hidden');
        btnNavCancel.classList.add('hidden');
        btnSave.classList.remove('hidden');
        btnEdit.classList.add('hidden');
        if (btnDelete) {
            btnDelete.classList.remove('hidden');
            btnDelete.innerHTML = '<i class="fa-solid fa-trash-can"></i> ยกเลิกการวาด / ลบ';
            btnDelete.className = 'w-full bg-red-600 text-white py-3 rounded-xl text-sm font-bold mt-2 flex items-center justify-center gap-2 hover:bg-red-700 transition duration-200';
        }
        toggleInputs(true);
        renderImageGallery(p.images || [], true);
    } else {
        if (navWarning) navWarning.classList.add('hidden');

        if (btnDelete) {
            btnDelete.classList.remove('hidden');
            if (p && p.is_custom_draw) {
                btnDelete.innerHTML = '<i class="fa-solid fa-trash-can"></i> ลบข้อมูลรูปแปลง/หมุด';
                btnDelete.className = 'w-full bg-red-600 text-white py-3 rounded-xl text-sm font-bold mt-2 flex items-center justify-center gap-2 hover:bg-red-700 transition duration-200';
            } else {
                btnDelete.innerHTML = '<i class="fa-solid fa-trash-can"></i> ลบรายการนี้';
                btnDelete.className = 'w-full bg-red-50 text-red-500 py-3 rounded-xl text-sm font-bold mt-2 flex items-center justify-center gap-2';
            }
        }

        if (isDone) {
            btnSave.classList.add('hidden');
            btnEdit.classList.remove('hidden');
            btnNavStart.classList.add('hidden');
            btnNavCancel.classList.add('hidden');
            toggleInputs(false);
            renderImageGallery(p.images || [], false);
        } else {
            btnSave.classList.remove('hidden');
            btnEdit.classList.add('hidden');

            const isNavByMe = isNavigating && job.id === selectedJobId;
            if (isNavByMe) {
                btnNavStart.classList.add('hidden');
                btnNavCancel.classList.remove('hidden');
            } else {
                btnNavStart.classList.remove('hidden');
                btnNavCancel.classList.add('hidden');
            }

            toggleInputs(true);
            renderImageGallery(p.images || [], true);
        }
    }
}

function enableEdit() {
    toggleInputs(true);
    document.getElementById('btn-save').classList.remove('hidden');
    document.getElementById('btn-edit').classList.add('hidden');

    const job = findJobById(selectedJobId);
    if (job) {
        window.imagesToDeleteFromCloud = [];
        window.originalImagesBackup = job.properties.images ? JSON.parse(JSON.stringify(job.properties.images)) : [];
        const images = job.properties.images || [];
        renderImageGallery(images, true);
    }
}

function closeSheet(e) {
    if (e) e.stopPropagation();

    if (selectedJobId) {
        const job = findJobById(selectedJobId);
        if (job) {
            const btnSave = document.getElementById('btn-save');
            const isEditing = btnSave && !btnSave.classList.contains('hidden');
            if (isEditing && window.originalImagesBackup) {
                if (job.properties.images) {
                    job.properties.images.forEach(img => {
                        if (img && img.isTemp && img.url && img.url.startsWith('blob:')) {
                            URL.revokeObjectURL(img.url);
                        }
                    });
                }
                job.properties.images = JSON.parse(JSON.stringify(window.originalImagesBackup));
            }
        }
    }

    document.getElementById('sheet').classList.remove('active');
    document.getElementById('sheet').classList.remove('minimized');
    document.getElementById('fab-container').classList.remove('sheet-open');
    document.getElementById('map').classList.remove('sheet-open');
    if (isNavigating) stopNav();
    selectedJobId = null;
    window.imagesToDeleteFromCloud = [];
    window.originalImagesBackup = [];

    // Clear UI inputs when closing sheet
    document.getElementById('sheet-name').value = '';
    document.getElementById('sheet-note').value = '';
    renderImageGallery([], false);
}


function toggleSheetSize() {
    document.getElementById('sheet').classList.toggle('minimized');
}

async function findNearestNewJob() {
    if (!userMarker) return Swal.fire('รอ GPS', '', 'info');

    if (isNavigating) {
        const result = await Swal.fire({
            title: 'ยกเลิกเส้นทางเดิม?',
            text: 'คุณกำลังนำทางอยู่ ต้องการยกเลิกเส้นทางเดิมเพื่อค้นหาและนำทางไปยังแปลงที่อยู่ใกล้ที่สุดใหม่หรือไม่?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'ยกเลิกเส้นทางเดิม',
            cancelButtonText: 'นำทางต่อ',
            allowOutsideClick: false
        });
        if (!result.isConfirmed) {
            return;
        }
        await stopNav();
    }

    const filteredJobs = getFilteredJobs().filter(j => j.status !== 'done' && j.status !== 'navigating' && j.id !== selectedJobId);
    if (filteredJobs.length === 0) return Swal.fire('ยอดเยี่ยม', 'ไม่มีงานค้างในพื้นที่นี้', 'success');
    let min = Infinity, near = null;
    const u = userMarker.getLatLng();
    filteredJobs.forEach(j => {
        const lat = Number(j.lat);
        const lng = Number(j.lng);
        if (!isNaN(lat) && !isNaN(lng)) {
            const d = map.distance(u, L.latLng(lat, lng));
            if (d < min) { min = d; near = j; }
        }
    });
    if (near) {
        openSheet(near);
        await startNav();
    }
}

function viewJsonData() {
    const job = findJobById(selectedJobId);
    if (!job) return;

    const sheet = document.getElementById('sheet');
    const fabContainer = document.getElementById('fab-container');
    const wasMinimized = sheet.classList.contains('minimized');
    const wasActive = sheet.classList.contains('active');

    // Slide details sheet out of view completely & lower z-index so it doesn't overlay Swal modal
    sheet.classList.remove('active');
    sheet.style.zIndex = '1000';
    if (fabContainer) fabContainer.classList.remove('sheet-open');

    let html = '<div id="swal-raw-data-container" class="text-left text-xs max-h-[60vh] overflow-y-auto"><table class="w-full border-collapse border border-gray-200 rounded-xl overflow-hidden">';
    const sortedKeys = Object.keys(job.properties).sort();
    sortedKeys.forEach(k => {
        if (k !== 'images' && k !== 'name' && k !== 'note' && k !== 'date' && k !== 'search_field' && k !== 'amphoe' && k !== 'tambon' && k !== 'area') {
            const val = typeof job.properties[k] === 'object' ? JSON.stringify(job.properties[k]) : job.properties[k];
            html += `
                        <tr class="border-b border-gray-150 hover:bg-gray-50">
                            <td class="font-bold p-2.5 text-gray-500 bg-gray-100/50 w-1/3 border-r border-gray-150">${k}</td>
                            <td class="p-2.5 text-gray-800 break-all">${val !== undefined && val !== null ? val : '-'}</td>
                        </tr>
                    `;
        }
    });
    html += '</table></div>';

    Swal.fire({
        title: 'ข้อมูลต้นฉบับ (ทั้งหมด)',
        html: html,
        width: '90%',
        confirmButtonText: 'ปิด',
        confirmButtonColor: '#4b5563',
        allowOutsideClick: false,
        didClose: () => {
            stopReadingSequence();
        }
    }).then(() => {
        // Restore sheet state and default z-index
        sheet.style.zIndex = '';
        if (wasActive) {
            sheet.classList.add('active');
            if (fabContainer) fabContainer.classList.add('sheet-open');
        }
        if (wasMinimized) {
            sheet.classList.add('minimized');
        } else {
            sheet.classList.remove('minimized');
        }
    });
}

let tempImportFeatures = [];
let onConfirmImportCallback = null;

function toggleImportCategoryInput() {
    const select = document.getElementById('import-category-select');
    const input = document.getElementById('import-category-custom');
    if (select && input) {
        if (select.value === 'CUSTOM_NEW') {
            input.classList.remove('hidden');
            input.focus();
        } else {
            input.classList.add('hidden');
        }
    }
}
window.toggleImportCategoryInput = toggleImportCategoryInput;

async function deleteImportCategory() {
    const select = document.getElementById('import-category-select');
    if (!select) return;
    const catToDelete = select.value;

    if (catToDelete === 'CUSTOM_NEW') {
        Swal.fire('แจ้งเตือน', 'ไม่สามารถลบตัวเลือกประเภทงานใหม่ได้', 'warning');
        return;
    }
    if (['ทั่วไป', 'ตรวจสอบ', 'เร่งด่วน'].includes(catToDelete)) {
        Swal.fire('แจ้งเตือน', `ไม่สามารถลบประเภทงานเริ่มต้น "${catToDelete}" ได้`, 'warning');
        return;
    }

    // Check if there are maps/jobs in dbJobs with this category
    const inUse = dbJobs.some(j => j.category === catToDelete);
    if (inUse) {
        Swal.fire({
            icon: 'error',
            title: 'ไม่สามารถลบได้',
            text: `ประเภทงาน "${catToDelete}" มีแปลงแผนที่นำเข้าใช้อยู่ในระบบ กรุณาลบข้อมูลแผนที่นำเข้าประเภทนี้ออกก่อนลบประเภทงาน`,
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#ef4444'
        });
        return;
    }

    // Confirm delete
    const result = await Swal.fire({
        title: 'ยืนยันการลบประเภทงาน?',
        text: `คุณต้องการลบประเภทงาน "${catToDelete}" ออกจากรายการตัวเลือกตัวเลือกลิสต์ใช่หรือไม่?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'ลบข้อมูล',
        cancelButtonText: 'ยกเลิก'
    });

    if (!result.isConfirmed) return;

    // Delete from categories
    categories = categories.filter(c => c !== catToDelete);
    localStorage.setItem('survey_cats_v16', JSON.stringify(categories));

    // Re-populate import mapping category list
    const catSelect = document.getElementById('import-category-select');
    if (catSelect) {
        catSelect.innerHTML = '';
        categories.forEach(cat => {
            catSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
        catSelect.innerHTML += '<option value="CUSTOM_NEW">-- พิมพ์ระบุประเภทงานใหม่ --</option>';
        catSelect.value = categories[0] || 'ทั่วไป';
        toggleImportCategoryInput();
    }

    // Update profile UI because active category selection list could have changed
    updateUserInfo();

    Swal.fire({
        toast: true,
        position: 'top',
        icon: 'success',
        title: `ลบประเภทงาน "${catToDelete}" สำเร็จ`,
        timer: 1500,
        showConfirmButton: false
    });
}
window.deleteImportCategory = deleteImportCategory;


function toggleProfileCategoryInput() {
    const select = document.getElementById('sel-profile-category');
    const input = document.getElementById('inp-profile-category');
    if (select && input) {
        if (select.value === 'CUSTOM_NEW') {
            input.classList.remove('hidden');
            input.focus();
        } else {
            input.classList.add('hidden');
        }
    }
}
window.toggleProfileCategoryInput = toggleProfileCategoryInput;

function showFieldMapping(feats, onConfirm) {
    closeSettingsModal();
    tempImportFeatures = feats;
    onConfirmImportCallback = onConfirm;

    // Extract all keys
    const allKeys = new Set();
    feats.forEach(f => {
        const p = f.properties || f;
        Object.keys(p).forEach(k => {
            if (typeof p[k] !== 'object') allKeys.add(k);
        });
    });
    const keysArray = Array.from(allKeys).sort();

    const fields = ['id', 'search', 'amphoe', 'tambon', 'area', 'note', 'status'];
    fields.forEach(f => {
        const select = document.getElementById(`map-field-${f}`);
        if (select) {
            select.innerHTML = '<option value="">-- ไม่ระบุ (ข้าม) --</option>';
            keysArray.forEach(k => {
                select.innerHTML += `<option value="${k}">${k}</option>`;
            });
        }
    });

    // Populate category select dropdown
    const catSelect = document.getElementById('import-category-select');
    if (catSelect) {
        catSelect.innerHTML = '';
        categories.forEach(cat => {
            catSelect.innerHTML += `<option value="${cat}">${cat}</option>`;
        });
        catSelect.innerHTML += '<option value="CUSTOM_NEW">-- พิมพ์ระบุประเภทงานใหม่ --</option>';
        catSelect.value = currentUser.category || categories[0] || 'ทั่วไป';
    }

    const customInput = document.getElementById('import-category-custom');
    if (customInput) {
        customInput.value = '';
        customInput.classList.add('hidden');
    }

    // Set default selections
    const idSel = document.getElementById('map-field-id');
    const searchSel = document.getElementById('map-field-search');
    const amphoeSel = document.getElementById('map-field-amphoe');
    const tambonSel = document.getElementById('map-field-tambon');
    const areaSel = document.getElementById('map-field-area');
    const noteSel = document.getElementById('map-field-note');
    const statusSel = document.getElementById('map-field-status');

    // Reset values first
    if (idSel) idSel.value = "";
    if (searchSel) searchSel.value = "";
    if (amphoeSel) amphoeSel.value = "";
    if (tambonSel) tambonSel.value = "";
    if (areaSel) areaSel.value = "";
    if (noteSel) noteSel.value = "";
    if (statusSel) statusSel.value = "";

    // Auto-detect best match
    keysArray.forEach(k => {
        const lower = k.toLowerCase();
        if (idSel && !idSel.value && (lower.includes('id') || lower.includes('reg') || lower.includes('name') || lower.includes('ทะเบียน'))) {
            idSel.value = k;
        }
        if (searchSel && !searchSel.value && (lower.includes('name') || lower.includes('desc') || lower.includes('remark') || lower.includes('ชื่อ') || lower.includes('หมายเหตุ'))) {
            searchSel.value = k;
        }
        if (amphoeSel && !amphoeSel.value && (lower.includes('amphoe') || lower.includes('amp') || lower.includes('อ.') || lower.includes('อำเภอ'))) {
            amphoeSel.value = k;
        }
        if (tambonSel && !tambonSel.value && (lower.includes('tambon') || lower.includes('tum') || lower.includes('ต.') || lower.includes('ตำบล'))) {
            tambonSel.value = k;
        }
        if (areaSel && !areaSel.value && (lower.includes('area') || lower.includes('size') || lower.includes('rai') || lower.includes('เนื้อที่'))) {
            areaSel.value = k;
        }
        if (noteSel && !noteSel.value && (lower.includes('note') || lower.includes('remark') || lower.includes('ข้อความ') || lower.includes('รายละเอียด') || lower.includes('comment'))) {
            noteSel.value = k;
        }
        if (statusSel && !statusSel.value && (lower.includes('status') || lower.includes('state') || lower.includes('สถานะ'))) {
            statusSel.value = k;
        }
    });

    // Show modal
    document.getElementById('import-mapping-modal').classList.add('active');
}

function closeImportMappingModal() {
    document.getElementById('import-mapping-modal').classList.remove('active');
    tempImportFeatures = [];
    onConfirmImportCallback = null;
}

// Set up Event Listener for Confirm Import
if (document.getElementById('btn-confirm-import')) {
    document.getElementById('btn-confirm-import').onclick = async () => {
        const mappedId = document.getElementById('map-field-id').value;
        const mappedSearch = document.getElementById('map-field-search').value;
        const mappedAmphoe = document.getElementById('map-field-amphoe').value;
        const mappedTambon = document.getElementById('map-field-tambon').value;
        const mappedArea = document.getElementById('map-field-area').value;
        const mappedNote = document.getElementById('map-field-note').value;
        const mappedStatus = document.getElementById('map-field-status').value;

        // Retrieve and validate selected category
        const chosenCategorySelect = document.getElementById('import-category-select').value;
        const chosenCategoryCustom = document.getElementById('import-category-custom').value.trim();
        let targetCategory = chosenCategorySelect;
        if (chosenCategorySelect === 'CUSTOM_NEW') {
            if (!chosenCategoryCustom) {
                Swal.fire('ข้อมูลไม่ครบ', 'กรุณาระบุประเภทงานใหม่', 'warning');
                return;
            }
            targetCategory = chosenCategoryCustom;
        }

        // Add custom category to system list if it is new
        if (targetCategory && !categories.includes(targetCategory)) {
            categories.push(targetCategory);
            localStorage.setItem('survey_cats_v16', JSON.stringify(categories));
        }

        document.getElementById('import-mapping-modal').classList.remove('active');

        if (onConfirmImportCallback) {
            await onConfirmImportCallback({
                idKey: mappedId,
                searchKey: mappedSearch,
                amphoeKey: mappedAmphoe,
                tambonKey: mappedTambon,
                areaKey: mappedArea,
                noteKey: mappedNote,
                statusKey: mappedStatus,
                targetCategory: targetCategory
            });
        }
    };
}

async function importData(input) {
    const file = input.files[0];
    if (!file) return;
    showLoading(true, 'กำลังอ่านไฟล์และนำเข้า...');
    const r = new FileReader();
    r.onload = async (e) => {
        try {
            let raw = e.target.result.trim();
            if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
            const json = JSON.parse(raw);
            let feats = (json.type === "FeatureCollection") ? json.features : (Array.isArray(json) ? json : [json]);

            showLoading(false);
            showFieldMapping(feats, async (mapping) => {
                showLoading(true, `กำลังเขียน ${feats.length} รายการลงคลาวด์ Supabase...`);
                let count = 0;
                for (let f of feats) {
                    const p = f.properties || f;
                    let geom = f.geometry;
                    if (!geom && (f.lat || p.lat)) geom = { type: 'Point', coordinates: [parseFloat(f.lng || p.lng), parseFloat(f.lat || p.lat)] };
                    if (!geom) continue;
                    let lat, lng;
                    if (geom.type === 'Point') {
                        lng = geom.coordinates[0];
                        lat = geom.coordinates[1];
                    } else {
                        try {
                            const l = L.geoJSON(geom);
                            const c = l.getBounds().getCenter();
                            lat = c.lat;
                            lng = c.lng;
                        } catch (err) {
                            continue;
                        }
                    }

                    const idRaw = mapping.idKey && p[mapping.idKey] !== undefined && p[mapping.idKey] !== null ? p[mapping.idKey] : '';
                    const idValue = idRaw.toString().trim();
                    const nameVal = idValue || 'นำเข้า';
                    const searchVal = mapping.searchKey && p[mapping.searchKey] !== undefined && p[mapping.searchKey] !== null ? p[mapping.searchKey].toString().trim() : '';
                    const amphoeVal = mapping.amphoeKey && p[mapping.amphoeKey] !== undefined && p[mapping.amphoeKey] !== null ? p[mapping.amphoeKey].toString().trim() : '';
                    const tambonVal = mapping.tambonKey && p[mapping.tambonKey] !== undefined && p[mapping.tambonKey] !== null ? p[mapping.tambonKey].toString().trim() : '';
                    const areaVal = mapping.areaKey && p[mapping.areaKey] !== undefined && p[mapping.areaKey] !== null ? p[mapping.areaKey].toString().trim() : '';
                    const noteVal = mapping.noteKey && p[mapping.noteKey] !== undefined && p[mapping.noteKey] !== null ? p[mapping.noteKey].toString().trim() : '';
                    const statusVal = mapping.statusKey && p[mapping.statusKey] !== undefined && p[mapping.statusKey] !== null ? p[mapping.statusKey].toString().trim() : '';

                    // Check duplicate first to keep status/notes/photos if already exists
                    const cleanSource = (file.name || 'อัปโหลดไฟล์').replace(/[^a-zA-Z0-9_\u0e00-\u0e7f]/g, '_');
                    const targetCategory = mapping.targetCategory || currentUser.category || 'ทั่วไป';
                    const finalId = targetCategory + '_' + cleanSource + '_' + (idValue || 'IMP_' + Math.random().toString(36).substr(2, 9));
                    const existing = dbJobs.find(x => x.id === finalId);

                    let finalStatus = 'waiting';
                    if (statusVal) {
                        const s = statusVal.toLowerCase();
                        if (s === 'done' || s === 'เสร็จสิ้น' || s === 'เสร็จ' || s === 'สำเร็จ' || s === '1' || s === 'yes' || s === 'true') {
                            finalStatus = 'done';
                        } else if (s === 'checking' || s === 'ตรวจสอบ') {
                            finalStatus = 'checking';
                        } else {
                            finalStatus = 'waiting';
                        }
                    } else if (existing) {
                        finalStatus = existing.status;
                    } else if (noteVal) {
                        finalStatus = 'done';
                    }

                    const finalNote = noteVal || (existing ? existing.properties.note : (p.REMARK || p.note || ''));

                    let finalDate = existing && existing.properties.date ? existing.properties.date : '';
                    if (finalStatus === 'done' && !finalDate) {
                        finalDate = new Date().toISOString().split('T')[0];
                    }

                    const job = {
                        id: finalId,
                        lat,
                        lng,
                        geometry: geom,
                        status: finalStatus,
                        category: mapping.targetCategory || currentUser.category || 'ทั่วไป',
                        properties: {
                            ...p,
                            name: nameVal,
                            import_source: file.name || 'อัปโหลดไฟล์',
                            note: finalNote,
                            images: existing ? existing.properties.images : [],
                            search_field: searchVal,
                            amphoe: amphoeVal,
                            tambon: tambonVal,
                            area: areaVal,
                            date: finalDate
                        }
                    };
                    await saveJobToSupabase(job);
                    count++;
                }

                // Update active category
                const targetCategory = mapping.targetCategory || currentUser.category || 'ทั่วไป';
                currentUser.category = targetCategory;
                localStorage.setItem('survey_current_cat', targetCategory);

                // Update category lists in memory
                if (targetCategory && !categories.includes(targetCategory)) {
                    categories.push(targetCategory);
                    localStorage.setItem('survey_cats_v16', JSON.stringify(categories));
                }

                // Prefill the profile category input
                const inpProfileCat = document.getElementById('inp-profile-category');
                if (inpProfileCat) inpProfileCat.value = targetCategory;

                Swal.fire('สำเร็จ', `นำเข้าแปลงที่ดินสำเร็จ ${count} รายการ`, 'success');
                await syncJobsFromDB();
            });
        } catch (err) {
            Swal.fire('เกิดข้อผิดพลาดในการโหลดไฟล์', err.message, 'error');
        } finally {
            showLoading(false);
        }
    };
    r.readAsText(file);
    input.value = '';
}

async function saveData() {
    const job = findJobById(selectedJobId);
    if (!job) return;

    if (isNavigating) await stopNav(selectedJobId);

    showLoading(true, 'กำลังอัปโหลดรูปภาพและบันทึกข้อมูล...');
    try {
        // --- ส่วนที่ 1: ตรวจสอบและอัปโหลดรูปภาพใหม่ (ที่มีสถานะ isTemp) ---
        if (job.properties.images && job.properties.images.length > 0) {
            for (let i = 0; i < job.properties.images.length; i++) {
                let img = job.properties.images[i];

                if (img.isTemp && img.file) {
                    const formData = new FormData();
                    formData.append('file', img.file);
                    formData.append('upload_preset', cloudinaryUploadPreset);

                    const url = `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`;
                    const res = await fetch(url, { method: 'POST', body: formData });

                    if (!res.ok) throw new Error('อัปโหลดภาพไปยังคลาวด์ล้มเหลว');

                    const data = await res.json();

                    // เปลี่ยนจากรูปชั่วคราว ให้เป็นรูปจริงที่มีลิงก์จาก Cloudinary
                    job.properties.images[i] = {
                        url: data.secure_url,
                        public_id: data.public_id,
                        delete_token: data.delete_token,
                        uploadedAt: Date.now()
                    };
                }
            }
        }

        // --- ส่วนที่ 1.5: ลบรูปภาพที่ผู้ใช้สั่งลบออกจาก Cloudinary ---
        if (window.imagesToDeleteFromCloud && window.imagesToDeleteFromCloud.length > 0) {
            await Promise.all(window.imagesToDeleteFromCloud.map(async (publicId) => {
                try {
                    await fetch(GAS_URL + "?publicId=" + encodeURIComponent(publicId), { mode: 'no-cors' });
                } catch (err) {
                    console.error("ลบภาพจากคลาวด์ไม่สำเร็จ:", publicId, err);
                }
            }));
            window.imagesToDeleteFromCloud = []; // เคลียร์คิวการลบ
        }

        // --- ส่วนที่ 2: บันทึกข้อมูลข้อความลงฐานข้อมูล Supabase ---
        const isTemp = job.properties && job.properties.is_temp === true;
        const nameVal = document.getElementById('sheet-name').value;
        const noteVal = document.getElementById('sheet-note').value;
        const hasNote = noteVal && noteVal.trim() !== "";
        const hasImages = job.properties && job.properties.images && job.properties.images.length > 0;
        const hasNoteOrImages = hasNote || hasImages;

        if (isTemp) {
            // Generate a permanent ID
            const permanentId = 'custom_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            
            // Build permanent job object
            const savedJob = {
                id: permanentId,
                team_id: currentUser.team_id,
                lat: job.lat,
                lng: job.lng,
                geometry: job.geometry,
                status: hasNoteOrImages ? 'done' : 'waiting',
                category: currentUser.category,
                properties: {
                    name: nameVal || `แปลงวาดใหม่`,
                    note: noteVal || '',
                    date: hasNoteOrImages ? new Date().toISOString().split('T')[0] : '',
                    is_custom_draw: true,
                    navigator_id: null,
                    navigator_name: null,
                    images: job.properties.images || [],
                    area: job.properties.area || '-',
                    amphoe: 'วาดเอง',
                    tambon: 'แปลงชั่วคราว'
                }
            };

            if (job.properties.is_circle) {
                savedJob.properties.is_circle = true;
                savedJob.properties.radius = job.properties.radius;
            }

            await saveJobToSupabase(savedJob);

            // Remove temporary layer from map
            if (job.layer) {
                if (map && job.layer.pm && typeof job.layer.pm.disable === 'function') {
                    job.layer.pm.disable();
                }
                map.removeLayer(job.layer);
            }

            // Remove from local queues
            const newShapeIndex = window.pendingNewShapes.findIndex(x => x.id === job.id);
            if (newShapeIndex !== -1) {
                window.pendingNewShapes.splice(newShapeIndex, 1);
            }
            window.pendingGeomanUpdates.delete(job.id);

            // Fetch latest data and sync map
            await syncJobsFromDB();
            closeSheet();
            showPendingActionsBar();
        } else {
            job.status = hasNoteOrImages ? 'done' : 'waiting';
            job.properties.name = nameVal;
            job.properties.note = noteVal;
            job.properties.date = hasNoteOrImages ? new Date().toISOString().split('T')[0] : '';
            job.properties.navigator_id = null;
            job.properties.navigator_name = null;
            job.updated_at = new Date().toISOString();

            await saveJobToSupabase(job);

            renderMap();
            closeSheet();
        }

        Swal.fire({ toast: true, icon: 'success', title: 'บันทึกข้อมูลเรียบร้อย', timer: 1500, showConfirmButton: false });
    } catch (e) {
        console.error("Save Data Error:", e);
        Swal.fire('บันทึกล้มเหลว', e.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteJob() {
    const job = findJobById(selectedJobId);
    if (!job) return;

    // Check if temporary drawn shape
    if (job.properties && job.properties.is_temp === true) {
        const confirm = await Swal.fire({
            title: 'ยืนยันการลบรูปแปลงที่วาดใหม่?',
            text: 'คุณต้องการลบหรือยกเลิกการวาดรูปแปลงนี้ใช่หรือไม่?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'ยืนยันการลบ',
            cancelButtonText: 'ยกเลิก'
        });

        if (!confirm.isConfirmed) return;

        // Revoke temporary image blobs
        if (job.properties.images) {
            job.properties.images.forEach(img => {
                if (img && img.isTemp && img.url && img.url.startsWith('blob:')) {
                    URL.revokeObjectURL(img.url);
                }
            });
        }
        // Remove layer from map
        if (job.layer) {
            if (map && job.layer.pm && typeof job.layer.pm.disable === 'function') {
                job.layer.pm.disable();
            }
            map.removeLayer(job.layer);
        }
        // Remove from pending queues
        const newShapeIndex = window.pendingNewShapes.findIndex(x => x.id === job.id);
        if (newShapeIndex !== -1) {
            window.pendingNewShapes.splice(newShapeIndex, 1);
        }
        window.pendingGeomanUpdates.delete(job.id);

        closeSheet();
        showPendingActionsBar();
        Swal.fire({ toast: true, icon: 'success', title: 'ยกเลิกการวาดเรียบร้อย', timer: 1500, showConfirmButton: false });
        return;
    }

    // Check if custom drawn item
    if (job.properties && job.properties.is_custom_draw === true) {
        const hasImages = job.properties.images && job.properties.images.length > 0;
        const confirm = await Swal.fire({
            title: 'ยืนยันลบข้อมูลรูปแปลง/หมุด?',
            text: 'ระบบจะลบข้อมูลรูปแปลง/หมุด และรูปถ่ายทั้งหมดออกจากระบบอย่างถาวร',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            confirmButtonText: 'ยืนยันการลบถาวร',
            cancelButtonText: 'ยกเลิก'
        });

        if (confirm.isConfirmed) {
            justDeletedJobId = job.id;
            selectedJobId = null;
            isMapClickBlocked = true;
            closeSheet();

            showLoading(true, 'กำลังลบข้อมูลรูปแปลง/หมุด...');
            try {
                // 1. Delete images from Cloudinary
                if (hasImages) {
                    await Promise.all(job.properties.images.map(async (img) => {
                        const publicId = img ? (img.public_id || getPublicIdFromUrl(typeof img === 'string' ? img : img.url)) : null;
                        if (publicId) {
                            try {
                                await fetch(GAS_URL + "?publicId=" + encodeURIComponent(publicId), { mode: 'no-cors' });
                            } catch (err) {
                                console.error("ลบ Cloudinary พลาด:", err);
                            }
                        }
                    }));
                }

                // 2. Delete row from Supabase
                await deleteJobFromSupabase(job.id);

                // 3. Remove from dbJobs
                const jobIndex = dbJobs.findIndex(j => j.id === job.id);
                if (jobIndex !== -1) {
                    dbJobs.splice(jobIndex, 1);
                }

                // 4. Render map
                renderMap();
                showLoading(false);
                await Swal.fire({ toast: true, icon: 'success', title: 'ลบข้อมูลรูปแปลง/หมุดเรียบร้อยแล้ว', timer: 1500, showConfirmButton: false });
            } catch (e) {
                showLoading(false);
                Swal.fire('ล้มเหลวในการลบข้อมูล', e.message, 'error');
            } finally {
                setTimeout(() => {
                    justDeletedJobId = null;
                    isMapClickBlocked = false;
                }, 2000);
            }
        }
        return;
    }

    if (job.status === 'done') {
        await deleteSurveyData();
    } else {
        Swal.fire({
            icon: 'error',
            title: 'ไม่สามารถลบได้',
            text: 'ไม่สามารถลบแปลงที่ดินที่นำเข้าออกจากระบบได้',
            confirmButtonText: 'ตกลง',
            confirmButtonColor: '#ef4444'
        });
        return;
    }
}

function navGoogle() {
    const j = findJobById(selectedJobId);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${j.lat},${j.lng}`, '_blank');
}

function updateAmphoeDropdown() {
    const s = new Set();
    dbJobs.filter(j => j.category === currentUser.category).forEach(j => {
        const p = j.properties || {};
        const a = (p.amphoe || p.AMPH_NAME || p.AMPHOE || p.district || "").toString().trim();
        if (a) s.add(a);
    });
    const el = document.getElementById('sel-amphoe');
    el.innerHTML = '<option value="">อ.ทั้งหมด</option>';
    Array.from(s).sort().forEach(a => el.innerHTML += `<option value="${a}">${a}</option>`);
    document.getElementById('sel-tambon').innerHTML = '<option value="">ต.ทั้งหมด</option>';
}

function onAmphoeChange() {
    const v = document.getElementById('sel-amphoe').value;
    const s = new Set();
    dbJobs.filter(j => {
        const p = j.properties || {};
        const a = (p.amphoe || p.AMPH_NAME || p.AMPHOE || p.district || "").toString().trim();
        return j.category === currentUser.category && a === v;
    }).forEach(j => {
        const p = j.properties || {};
        const t = (p.tambon || p.TUMB_NAME || p.TAMBON || p.subdistrict || "").toString().trim();
        if (t) s.add(t);
    });
    const el = document.getElementById('sel-tambon');
    el.innerHTML = '<option value="">ต.ทั้งหมด</option>';
    Array.from(s).sort().forEach(t => el.innerHTML += `<option value="${t}">${t}</option>`);
    renderMap(true);
}

function filterMap() { renderMap(true); }

function toggleViewMode() {
    viewMode = viewMode === 'original' ? 'pin' : 'original';
    document.getElementById('btn-view').innerHTML = viewMode === 'pin'
        ? '<i class="fa-solid fa-map-pin"></i>'
        : '<i class="fa-solid fa-draw-polygon"></i>';
    renderMap();
}

function toggleBaseMap() {
    map.removeLayer(maps[currentBaseMap]);
    currentBaseMap = currentBaseMap === 'hybrid' ? 'street' : 'hybrid';
    map.addLayer(maps[currentBaseMap]);
}

// --- Premium Settings Modal Logic ---
function openToolsMenu() {
    const modal = document.getElementById('custom-settings-modal');
    modal.classList.add('active');

    switchSettingsTab('profile');
}

function closeSettingsModal(e) {
    const modal = document.getElementById('custom-settings-modal');
    modal.classList.remove('active');
}

let activeSettingsTab = 'profile';
function switchSettingsTab(tab) {
    activeSettingsTab = tab;
    const tabs = ['profile', 'geojson', 'voice'];
    tabs.forEach(t => {
        const btn = document.getElementById(`stab-${t}`);
        const content = document.getElementById(`scontent-${t}`);
        if (t === tab) {
            btn.classList.add('active');
            content.classList.remove('hidden');
        } else {
            btn.classList.remove('active');
            content.classList.add('hidden');
        }
    });

    if (tab === 'profile') {
        loadTeamMembers();
    } else if (tab === 'geojson') {
        renderImportedMapsList();
    }
}

function copyUserCode() {
    const code = document.getElementById('profile-user-code').innerText;
    navigator.clipboard.writeText(code).then(() => {
        Swal.fire({ toast: true, position: 'top', icon: 'success', title: 'คัดลอกรหัสเข้าคลิปบอร์ดแล้ว', timer: 1500, showConfirmButton: false });
    });
}

// --- Team Collaboration Logic ---
async function loadTeamMembers() {
    if (!supabaseClient || !currentUser) return;
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('id, email, display_name, user_code')
            .eq('team_id', currentUser.team_id);

        if (error) throw error;

        const listEl = document.getElementById('team-members-list');
        listEl.innerHTML = '';

        data.forEach(m => {
            const isSelf = m.id === currentUser.id;
            const isOwner = currentUser.team_id === currentUser.id;

            let actionBtn = '';
            if (isSelf) {
                actionBtn = `<span class="text-[9px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">คุณ (หัวหน้า)</span>`;
                if (currentUser.team_id !== currentUser.id) {
                    actionBtn = `<span class="text-[9px] bg-green-100 text-green-800 px-2 py-0.5 rounded font-bold">คุณ</span>`;
                }
            } else if (isOwner) {
                actionBtn = `<button onclick="removeTeamMember('${m.id}')" class="text-[10px] text-red-500 hover:text-red-700 font-bold"><i class="fa-solid fa-user-minus"></i> ลบ</button>`;
            }

            listEl.innerHTML += `
                        <div class="flex items-center justify-between p-2 border border-gray-100 rounded-xl bg-gray-50/50">
                            <div>
                                <div class="text-xs font-bold text-gray-850">${m.display_name || 'ผู้ใช้ร่วมกัน'}</div>
                                <div class="text-[10px] text-gray-400">${m.email} (${m.user_code})</div>
                            </div>
                            <div class="flex items-center gap-1">${actionBtn}</div>
                        </div>`;
        });

        if (data.length <= 1) {
            listEl.innerHTML += `<div class="text-[11px] text-gray-400 text-center py-3">ยังไม่มีสมาชิกอื่นในทีมสำรวจนี้</div>`;
        }
    } catch (e) {
        console.error("Load team members error", e);
    }
}

async function addTeamMemberByCode() {
    const code = document.getElementById('inp-add-member-code').value.trim();
    if (!code) return Swal.fire('กรุณาระบุรหัส', 'ใส่รหัสของสมาชิกที่ต้องการร่วมสำรวจด้วยกัน', 'warning');
    if (code === currentUser.user_code) return Swal.fire('ผิดพลาด', 'คุณไม่สามารถเพิ่มตัวคุณเองได้', 'warning');

    showLoading(true, 'กำลังหาข้อมูลสมาชิก...');
    try {
        // ค้นหาผู้ใช้อื่นที่มี user_code นี้
        const { data: member, error: findErr } = await supabaseClient
            .from('profiles')
            .select('id, display_name')
            .eq('user_code', code)
            .single();

        if (findErr || !member) {
            throw new Error('ไม่พบข้อมูลรหัสสมาชิกนี้ กรุณาตรวจสอบรหัสของเพื่อนคุณอีกครั้ง');
        }

        // อัปเดต team_id ของเขาให้มาเป็นทีมเรา
        const { error: updErr } = await supabaseClient
            .from('profiles')
            .update({ team_id: currentUser.team_id })
            .eq('id', member.id);

        if (updErr) throw updErr;

        document.getElementById('inp-add-member-code').value = '';
        Swal.fire('สำเร็จ', `เพิ่มคุณ ${member.display_name} เข้าทีมสำรวจร่วมกันแล้ว`, 'success');
        await loadTeamMembers();
    } catch (e) {
        Swal.fire('ล้มเหลว', e.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function leaveTeam() {
    if (currentUser.team_id === currentUser.id) {
        return Swal.fire('แจ้งเตือน', 'คุณกำลังทำงานคนเดียว (เป็นหัวหน้าทีมของตัวเอง)', 'info');
    }

    Swal.fire({
        title: 'ออกจากทีมสำรวจ?',
        text: 'คุณจะไม่เห็นจุดบนแผนที่ของทีมนี้ และระบบจะรีเซ็ตห้องทำงานส่วนตัวให้คุณใหม่',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444'
    }).then(async (r) => {
        if (r.isConfirmed) {
            showLoading(true, 'กำลังดึงข้อมูลออกจากทีม...');
            try {
                const { error } = await supabaseClient
                    .from('profiles')
                    .update({ team_id: currentUser.id })
                    .eq('id', currentUser.id);

                if (error) throw error;

                currentUser.team_id = currentUser.id;
                Swal.fire('สำเร็จ', 'ออกจากทีมและสร้างห้องทำงานคนเดียวแล้ว', 'success');
                await loadTeamMembers();
                await syncJobsFromDB();
            } catch (err) {
                Swal.fire('ออกจากทีมล้มเหลว', err.message, 'error');
            } finally {
                showLoading(false);
            }
        }
    });
}

async function removeTeamMember(id) {
    Swal.fire({
        title: 'ยืนยันความปลอดภัย',
        text: 'กรุณากรอกรหัสผ่านบัญชีของคุณเพื่อยืนยันการลบสมาชิกออกจากทีม',
        input: 'password',
        inputPlaceholder: 'รหัสผ่านของคุณ',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ยืนยันรหัสผ่านเพื่อลบ',
        cancelButtonText: 'ยกเลิก',
        inputAttributes: {
            autocapitalize: 'off',
            autocorrect: 'off'
        }
    }).then(async (result) => {
        if (result.isConfirmed) {
            const password = result.value;
            if (!password) {
                return Swal.fire('ผิดพลาด', 'กรุณากรอกรหัสผ่านเพื่อดำเนินการต่อ', 'error');
            }

            showLoading(true, 'กำลังตรวจสอบความถูกต้อง...');
            try {
                const currentEmail = currentUser.email;
                if (!currentEmail) throw new Error("ไม่พบอีเมลผู้ใช้งานปัจจุบัน");

                const { error: authError } = await supabaseClient.auth.signInWithPassword({
                    email: currentEmail,
                    password: password
                });

                if (authError) throw new Error("รหัสผ่านไม่ถูกต้อง");

                showLoading(true, 'กำลังลบสมาชิกออกจากกลุ่ม...');
                const { error } = await supabaseClient
                    .from('profiles')
                    .update({ team_id: id })
                    .eq('id', id);

                if (error) throw error;

                Swal.fire('สำเร็จ', 'นำผู้ใช้งานออกจากกลุ่มสำรวจแล้ว', 'success');
                await loadTeamMembers();
            } catch (err) {
                Swal.fire('การลบสมาชิกล้มเหลว', err.message, 'error');
            } finally {
                showLoading(false);
            }
        }
    });
}

// --- Dropbox Direct Download URL & Import GeoJSON ---
function getDropboxDirectLink(url) {
    // Check for Dropbox link and convert to raw download link
    if (url.includes('dropbox.com')) {
        return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
    }
    return url;
}

async function importFromCloudLink() {
    const url = document.getElementById('set-geojson-drive-url').value.trim();
    if (!url) return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาวางลิงก์แชร์ของ Dropbox', 'warning');

    const directUrl = getDropboxDirectLink(url);
    showLoading(true, 'กำลังเชื่อมโยงและดาวน์โหลดข้อมูลจาก Dropbox...');
    try {
        localStorage.setItem('survey_geojson_drive_url', url);

        const response = await fetch(directUrl);
        if (!response.ok) throw new Error("ไม่สามารถดาวน์โหลดไฟล์ได้ ตรวจสอบสิทธิ์ให้เป็น 'ทุกคนที่มีลิงก์มีสิทธิ์อ่าน'");

        const json = await response.json();
        let feats = (json.type === "FeatureCollection") ? json.features : (Array.isArray(json) ? json : [json]);

        showLoading(false);
        showFieldMapping(feats, async (mapping) => {
            showLoading(true, `กำลังเขียน ${feats.length} รายการลงคลาวด์ Supabase...`);
            let imported = 0;

            let cleanSource = 'dropbox';
            try {
                const urlObj = new URL(url);
                const pathParts = urlObj.pathname.split('/');
                cleanSource = pathParts[pathParts.length - 1] || 'dropbox';
            } catch (e) { }
            cleanSource = cleanSource.replace(/[^a-zA-Z0-9_\u0e00-\u0e7f]/g, '_') || 'dropbox';

            for (let f of feats) {
                const p = f.properties || f;
                let geom = f.geometry;
                if (!geom && (f.lat || p.lat)) geom = { type: 'Point', coordinates: [parseFloat(f.lng || p.lng), parseFloat(f.lat || p.lat)] };
                if (!geom) continue;

                let lat, lng;
                if (geom.type === 'Point') {
                    lng = geom.coordinates[0];
                    lat = geom.coordinates[1];
                } else {
                    try {
                        const l = L.geoJSON(geom);
                        const c = l.getBounds().getCenter();
                        lat = c.lat;
                        lng = c.lng;
                    } catch (err) {
                        continue;
                    }
                }

                const idRaw = mapping.idKey && p[mapping.idKey] !== undefined && p[mapping.idKey] !== null ? p[mapping.idKey] : '';
                const idValue = idRaw.toString().trim();
                const nameVal = idValue || 'นำเข้า';
                const searchVal = mapping.searchKey && p[mapping.searchKey] !== undefined && p[mapping.searchKey] !== null ? p[mapping.searchKey].toString().trim() : '';
                const amphoeVal = mapping.amphoeKey && p[mapping.amphoeKey] !== undefined && p[mapping.amphoeKey] !== null ? p[mapping.amphoeKey].toString().trim() : '';
                const tambonVal = mapping.tambonKey && p[mapping.tambonKey] !== undefined && p[mapping.tambonKey] !== null ? p[mapping.tambonKey].toString().trim() : '';
                const areaVal = mapping.areaKey && p[mapping.areaKey] !== undefined && p[mapping.areaKey] !== null ? p[mapping.areaKey].toString().trim() : '';
                const noteVal = mapping.noteKey && p[mapping.noteKey] !== undefined && p[mapping.noteKey] !== null ? p[mapping.noteKey].toString().trim() : '';
                const statusVal = mapping.statusKey && p[mapping.statusKey] !== undefined && p[mapping.statusKey] !== null ? p[mapping.statusKey].toString().trim() : '';

                // Check duplicate first
                const targetCategory = mapping.targetCategory || currentUser.category || 'ทั่วไป';
                const finalId = targetCategory + '_' + cleanSource + '_' + (idValue || 'GD_' + Math.random().toString(36).substr(2, 9));
                const existing = dbJobs.find(x => x.id === finalId);

                let finalStatus = 'waiting';
                if (statusVal) {
                    const s = statusVal.toLowerCase();
                    if (s === 'done' || s === 'เสร็จสิ้น' || s === 'เสร็จ' || s === 'สำเร็จ' || s === '1' || s === 'yes' || s === 'true') {
                        finalStatus = 'done';
                    } else if (s === 'checking' || s === 'ตรวจสอบ') {
                        finalStatus = 'checking';
                    } else {
                        finalStatus = 'waiting';
                    }
                } else if (existing) {
                    finalStatus = existing.status;
                } else if (noteVal) {
                    finalStatus = 'done';
                }

                const finalNote = noteVal || (existing ? existing.properties.note : (p.REMARK || p.note || ''));

                let finalDate = existing && existing.properties.date ? existing.properties.date : '';
                if (finalStatus === 'done' && !finalDate) {
                    finalDate = new Date().toISOString().split('T')[0];
                }

                const job = {
                    id: finalId,
                    lat,
                    lng,
                    geometry: geom,
                    status: finalStatus,
                    category: targetCategory,
                    properties: {
                        ...p,
                        name: nameVal,
                        import_source: url,
                        note: finalNote,
                        images: existing ? existing.properties.images : [],
                        search_field: searchVal,
                        amphoe: amphoeVal,
                        tambon: tambonVal,
                        area: areaVal,
                        date: finalDate
                    }
                };
                await saveJobToSupabase(job);
                imported++;
            }

            // Update active category
            const targetCategory = mapping.targetCategory || currentUser.category || 'ทั่วไป';
            currentUser.category = targetCategory;
            localStorage.setItem('survey_current_cat', targetCategory);

            // Update category lists in memory
            if (targetCategory && !categories.includes(targetCategory)) {
                categories.push(targetCategory);
                localStorage.setItem('survey_cats_v16', JSON.stringify(categories));
            }

            // Prefill the profile category input
            const inpProfileCat = document.getElementById('inp-profile-category');
            if (inpProfileCat) inpProfileCat.value = targetCategory;

            Swal.fire('นำเข้าสำเร็จ', `เชื่อมโยงและนำเข้าข้อมูลสำเร็จ ${imported} แปลงแผนที่`, 'success');
            await syncJobsFromDB();
            closeSettingsModal();
        });
    } catch (err) {
        console.error("GeoJSON Google Drive Error", err);
        Swal.fire({
            title: 'ดึงข้อมูลไม่สำเร็จ',
            html: `<div class="text-left text-xs space-y-2">
                        <p class="font-bold text-red-500">ผิดพลาด: ${err.message}</p>
                        <p class="font-bold">ขั้นตอนการแชร์ Google Drive:</p>
                        <ol class="list-decimal pl-4 space-y-1">
                            <li>คลิกขวาที่ไฟล์ .geojson ใน Google Drive -> เลือก <b>แชร์ (Share)</b></li>
                            <li>ในส่วนการเข้าถึงทั่วไป ปรับเป็น <b>ทุกคนที่มีลิงก์ (Anyone with link)</b></li>
                            <li>คัดลอกลิงก์นั้นมาวางลงในช่องนี้</li>
                        </ol>
                    </div>`,
            icon: 'error'
        });
    } finally {
        showLoading(false);
    }
}

function renderImportedMapsList() {
    const listDiv = document.getElementById('imported-maps-list');
    if (!listDiv) return;

    if (!currentUser) {
        listDiv.innerHTML = '<div class="text-[11px] text-gray-400 text-center py-3">กรุณาเข้าสู่ระบบ</div>';
        return;
    }

    // Group jobs in dbJobs by both category and import_source
    const importJobs = dbJobs.filter(j => j.properties && j.properties.import_source);

    // Grouping
    const groups = {};
    importJobs.forEach(job => {
        const cat = job.category || 'ทั่วไป';
        const src = job.properties.import_source;
        const key = `${cat}|||${src}`;
        if (!groups[key]) {
            groups[key] = {
                category: cat,
                source: src,
                count: 0
            };
        }
        groups[key].count++;
    });

    const sources = Object.values(groups);

    if (sources.length === 0) {
        listDiv.innerHTML = '<div class="text-[11px] text-gray-400 text-center py-3">ไม่มีข้อมูลการนำเข้า</div>';
        return;
    }

    let html = '';
    sources.forEach(group => {
        let displayName = group.source;
        if (displayName.startsWith('http://') || displayName.startsWith('https://')) {
            try {
                const urlObj = new URL(displayName);
                displayName = 'Dropbox: ' + urlObj.pathname.split('/').pop();
            } catch (e) {
                displayName = 'Link: ' + displayName.substring(0, 30) + '...';
            }
        }

        const escapedSource = group.source.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const escapedCategory = group.category.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

        html += `
            <div class="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition">
                <div class="min-w-0 flex-1">
                    <p class="text-xs font-bold text-gray-700 truncate" title="${group.source}">${displayName}</p>
                    <div class="flex flex-wrap items-center gap-1.5 mt-1">
                        <span class="inline-flex items-center text-[9px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                            ประเภทงาน: ${group.category}
                        </span>
                        <span class="text-[10px] text-gray-500">${group.count} แปลงแผนที่</span>
                    </div>
                </div>
                <button onclick="deleteImportedMap('${escapedSource}', '${escapedCategory}')"
                    class="text-xs text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition ml-2 flex-shrink-0"
                    title="ลบข้อมูลการนำเข้านี้">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
    });

    listDiv.innerHTML = html;
}

async function deleteImportedMap(source, category) {
    if (!supabaseClient || !currentUser) return;

    const targetJobs = dbJobs.filter(j => j.category === category && j.properties && j.properties.import_source === source);
    if (targetJobs.length === 0) return;

    const result = await Swal.fire({
        title: 'ยืนยันการลบแผนที่นำเข้า?',
        text: `แปลงที่ดินทั้งหมด ${targetJobs.length} รายการ จากแหล่งข้อมูล "${source}" (ประเภทงาน: ${category}) จะถูกลบถาวรจากฐานข้อมูล รวมทั้งรูปภาพบันทึกต่างๆ (ถ้ามี)`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'ลบข้อมูล',
        cancelButtonText: 'ยกเลิก'
    });

    if (!result.isConfirmed) return;

    const pwdResult = await Swal.fire({
        title: 'ยืนยันความปลอดภัย',
        text: 'กรุณากรอกรหัสผ่านบัญชีของคุณเพื่อยืนยันการลบแผนที่นำเข้า',
        input: 'password',
        inputPlaceholder: 'รหัสผ่านของคุณ',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'ยืนยันรหัสผ่านเพื่อลบ',
        cancelButtonText: 'ยกเลิก',
        inputAttributes: {
            autocapitalize: 'off',
            autocorrect: 'off'
        }
    });

    if (!pwdResult.isConfirmed) return;

    const password = pwdResult.value;
    if (!password) {
        return Swal.fire('ผิดพลาด', 'กรุณากรอกรหัสผ่านเพื่อดำเนินการต่อ', 'error');
    }

    showLoading(true, 'กำลังตรวจสอบความถูกต้อง...');
    try {
        const currentEmail = currentUser.email;
        if (!currentEmail) throw new Error("ไม่พบอีเมลผู้ใช้งานปัจจุบัน");

        const { error: authError } = await supabaseClient.auth.signInWithPassword({
            email: currentEmail,
            password: password
        });

        if (authError) throw new Error("รหัสผ่านไม่ถูกต้อง");
    } catch (e) {
        showLoading(false);
        return Swal.fire('ทำรายการไม่สำเร็จ', e.message, 'error');
    }

    showLoading(true, 'กำลังลบแผนที่นำเข้า...');

    try {
        const batchIds = targetJobs.map(j => j.id);

        const imagesToDelete = [];
        targetJobs.forEach(job => {
            if (job.properties && job.properties.images && Array.isArray(job.properties.images)) {
                job.properties.images.forEach(img => {
                    const publicId = img ? (img.public_id || getPublicIdFromUrl(typeof img === 'string' ? img : img.url)) : null;
                    if (publicId) {
                        imagesToDelete.push(publicId);
                    }
                });
            }
        });

        const { error } = await supabaseClient
            .from('jobs')
            .delete()
            .eq('category', category)
            .eq('properties->>import_source', source)
            .eq('team_id', currentUser.team_id);

        if (error) throw error;

        if (imagesToDelete.length > 0) {
            imagesToDelete.forEach(publicId => {
                fetch(GAS_URL + "?publicId=" + encodeURIComponent(publicId), { mode: 'no-cors' })
                    .catch(err => console.error("Cloudinary deletion failed on background:", err));
            });
        }

        showLoading(false);
        Swal.fire('ลบข้อมูลเรียบร้อย', `ลบแปลงที่ดินและรูปภาพทั้งหมด ${targetJobs.length} รายการออกแล้ว`, 'success');

        await syncJobsFromDB();
        renderImportedMapsList();
    } catch (e) {
        showLoading(false);
        console.error("Delete imported map error", e);
        Swal.fire('ลบล้มเหลว', e.message, 'error');
    }
}

// --- Database & Category Modifiers ---
function addCat() {
    Swal.fire({ input: 'text', title: 'เพิ่มหมวดใหม่' }).then(r => {
        if (r.value) {
            categories.push(r.value);
            localStorage.setItem('survey_cats_v16', JSON.stringify(categories));
            openToolsMenu();
        }
    });
}

function clearAll() {
    Swal.fire({
        title: 'ยืนยันล้างข้อมูลทั้งหมด?',
        text: 'จุดและข้อมูลแผนที่ในทีมของคุณจะถูกลบออกจากฐานข้อมูลคลาวด์ถาวร',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'red'
    }).then(async (r) => {
        if (r.isConfirmed) {
            showLoading(true, 'กำลังเคลียร์ข้อมูล...');
            try {
                await clearAllSupabaseJobs();
                dbJobs = [];
                renderMap();
                closeSettingsModal();
                Swal.fire('ล้างข้อมูลสำเร็จ', 'แผนที่ว่างเปล่าเรียบร้อย', 'success');
            } catch (e) {
                Swal.fire('ล้างข้อมูลไม่สำเร็จ', e.message, 'error');
            } finally {
                showLoading(false);
            }
        }
    });
}

let calCurrentDate = new Date();
let calSelectedDate = null;
let calActiveMode = 'excel'; // 'excel' or 'report'

function getDatesWithData() {
    const data = dbJobs.filter(j => j.category === currentUser.category && j.status === 'done');
    const dates = new Map();
    data.forEach(j => {
        const d = j.properties.date || (j.updated_at ? j.updated_at.split('T')[0] : '');
        if (d) {
            dates.set(d, (dates.get(d) || 0) + 1);
        }
    });
    return dates;
}

function openExportCalendarModal(mode) {
    closeSettingsModal();
    calActiveMode = mode;
    calSelectedDate = null;
    calCurrentDate = new Date(); // Reset to today's month

    const titleEl = document.getElementById('export-calendar-title');
    if (titleEl) {
        titleEl.innerHTML = mode === 'excel'
            ? '<i class="fa-solid fa-file-excel text-green-600"></i> เลือกวันในการออก Excel'
            : '<i class="fa-solid fa-file-invoice text-blue-600"></i> เลือกวันในการออกรายงาน';
    }

    const actionContainer = document.getElementById('cal-action-container');
    if (actionContainer) actionContainer.classList.add('hidden');

    renderExportCalendar();
    document.getElementById('export-calendar-modal').classList.add('active');
}

function closeExportCalendarModal() {
    document.getElementById('export-calendar-modal').classList.remove('active');
    openToolsMenu();
}

function navigateExportCalendar(direction) {
    calCurrentDate.setMonth(calCurrentDate.getMonth() + direction);
    renderExportCalendar();
}

function renderExportCalendar() {
    const year = calCurrentDate.getFullYear();
    const month = calCurrentDate.getMonth();

    const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];

    const monthYearEl = document.getElementById('cal-month-year');
    if (monthYearEl) {
        monthYearEl.innerText = `${thaiMonths[month]} ${year + 543}`;
    }

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const grid = document.getElementById('cal-days-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const datesWithData = getDatesWithData();

    // Render empty cells for leading blank days
    for (let i = 0; i < firstDay; i++) {
        grid.innerHTML += `<div class="cal-day cal-day-empty"></div>`;
    }

    // Render days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasData = datesWithData.has(dateStr);
        const isSelected = calSelectedDate === dateStr;

        let classes = "cal-day ";
        let onClickAttr = "";

        if (isSelected) {
            classes += "cal-day-selected";
            onClickAttr = `onclick="selectExportDate('${dateStr}')"`;
        } else if (hasData) {
            classes += "cal-day-has-data";
            onClickAttr = `onclick="selectExportDate('${dateStr}')"`;
        } else {
            classes += "cal-day-disabled";
        }

        grid.innerHTML += `<div class="${classes}" ${onClickAttr}>${day}</div>`;
    }
}

function selectExportDate(dateStr) {
    calSelectedDate = dateStr;

    // Format for display
    const parts = dateStr.split('-');
    const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const count = getDatesWithData().get(dateStr) || 0;
    const displayStr = `${parseInt(parts[2])} ${thaiMonths[parseInt(parts[1]) - 1]} ${parseInt(parts[0]) + 543} (จำนวน ${count} รายการ)`;

    const displayEl = document.getElementById('cal-selected-display');
    if (displayEl) displayEl.innerText = displayStr;

    const actionContainer = document.getElementById('cal-action-container');
    if (actionContainer) actionContainer.classList.remove('hidden');

    renderExportCalendar();
}

function confirmExportCalendar(exportAll = false) {
    let data = [];
    if (exportAll) {
        data = dbJobs.filter(j => j.category === currentUser.category && j.status === 'done');
        if (data.length === 0) {
            return Swal.fire('ไม่มีข้อมูล', 'ไม่มีข้อมูลงานเสร็จสิ้นเพื่อส่งออก', 'warning');
        }
    } else {
        if (!calSelectedDate) {
            return Swal.fire('กรุณาเลือกวัน', 'คุณยังไม่ได้เลือกวันที่ต้องการส่งออก', 'warning');
        }
        data = dbJobs.filter(j => {
            const d = j.properties.date || (j.updated_at ? j.updated_at.split('T')[0] : '');
            return j.category === currentUser.category && j.status === 'done' && d === calSelectedDate;
        });
        if (data.length === 0) {
            return Swal.fire('ไม่มีข้อมูล', 'ไม่มีข้อมูลงานเสร็จสิ้นในวันที่เลือก', 'warning');
        }
    }

    closeExportCalendarModal();

    if (calActiveMode === 'excel') {
        const suffix = exportAll ? 'ALL' : calSelectedDate;
        const f = `SURVEY_${currentUser.category}_${suffix}`;
        const r = data.map(j => ({
            ID: j.id,
            Name: j.properties.name,
            Tambon: j.properties.tambon || j.properties.TUMB_NAME || '',
            Amphoe: j.properties.amphoe || j.properties.AMPH_NAME || '',
            Area: j.properties.area || '',
            Note: j.properties.note,
            Lat: j.lat,
            Lng: j.lng,
            Date: j.properties.date || (j.updated_at ? j.updated_at.split('T')[0] : '')
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(r), "Data");
        XLSX.writeFile(wb, f + '.xlsx');
    } else {
        generateReport(data);
    }
}

function generateReport(jobs) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        return Swal.fire('ป๊อปอัปถูกบล็อก', 'กรุณาอนุญาตให้เปิดหน้าต่างป๊อปอัปสำหรับเว็บไซต์นี้', 'warning');
    }

    let html = `
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <title>รายงานการสำรวจตรวจสอบที่ราชพัสดุ</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
        body {
            font-family: 'Sarabun', sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f3f4f6;
            color: #1f2937;
        }
        .page {
            background-color: #ffffff;
            width: 210mm;
            min-height: 297mm;
            padding: 20mm;
            margin: 10mm auto;
            box-sizing: border-box;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            border-radius: 8px;
            page-break-after: always;
            break-after: page;
            display: flex;
            flex-direction: column;
        }
        @media print {
            body {
                background-color: #ffffff;
                margin: 0;
                padding: 0;
            }
            .page {
                width: auto;
                min-height: auto;
                margin: 0;
                padding: 10mm;
                box-shadow: none;
                border-radius: 0;
            }
            .no-print {
                display: none !important;
            }
        }
        .header {
            text-align: center;
            font-size: 22px;
            font-weight: bold;
            color: #1e3a8a;
            border-bottom: 3px double #3b82f6;
            padding-bottom: 12px;
            margin-bottom: 25px;
        }
        .image-gallery {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-bottom: 25px;
        }
        .image-card {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            overflow: hidden;
            background-color: #f9fafb;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .image-card img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            display: block;
        }
        .no-images {
            grid-column: span 2;
            text-align: center;
            padding: 30px;
            color: #9ca3af;
            border: 2px dashed #e5e7eb;
            border-radius: 12px;
            font-size: 14px;
        }
        .section-title {
            font-size: 16px;
            font-weight: bold;
            color: #1e3a8a;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 6px;
            margin-bottom: 15px;
            margin-top: 15px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: 180px 1fr;
            row-gap: 12px;
            column-gap: 15px;
            font-size: 14px;
            line-height: 1.6;
        }
        .info-label {
            font-weight: bold;
            color: #4b5563;
        }
        .info-value {
            color: #111827;
            word-break: break-word;
        }
        .footer {
            margin-top: auto;
            text-align: right;
            font-size: 11px;
            color: #9ca3af;
            border-top: 1px solid #f3f4f6;
            padding-top: 10px;
        }
        /* Close Button Styles */
        .close-btn-container {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
        }
        .close-report-btn {
            display: flex;
            align-items: center;
            gap: 8px;
            background-color: #ffffff;
            color: #1f2937;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 10px 20px;
            font-size: 14px;
            font-weight: bold;
            font-family: 'Sarabun', sans-serif;
            cursor: pointer;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 10px 15px -3px rgba(0, 0, 0, 0.05);
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .close-report-btn:hover {
            background-color: #f9fafb;
            color: #ef4444;
            border-color: #fca5a5;
            transform: translateY(-2px);
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
        }
        .close-report-btn:active {
            transform: translateY(0);
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        .close-icon {
            width: 18px;
            height: 18px;
            stroke-width: 2.5;
        }
    </style>
</head>
<body>
    <div class="no-print close-btn-container">
        <button onclick="window.close()" class="close-report-btn">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="close-icon">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            กลับหน้าแผนที่
        </button>
    </div>
`;

    jobs.forEach((j, index) => {
        const name = j.properties.name || '(ไม่มีชื่อแปลง)';
        const note = j.properties.note || '(ไม่มีรายละเอียดบันทึก)';
        const date = j.properties.date || (j.updated_at ? j.updated_at.split('T')[0] : '-');
        const amphoe = j.properties.amphoe || j.properties.AMPH_NAME || '-';
        const tambon = j.properties.tambon || j.properties.TUMB_NAME || '-';
        const area = j.properties.area || '-';
        const images = j.properties.images || [];

        let imagesHtml = '';
        const parsedImages = typeof images === 'string' ? (() => { try { return JSON.parse(images); } catch (e) { return []; } })() : images;
        if (Array.isArray(parsedImages) && parsedImages.length > 0) {
            imagesHtml = '<div class="image-gallery">';
            parsedImages.forEach(img => {
                let url = '';
                if (img) {
                    if (typeof img === 'string') {
                        if (img.startsWith('{')) {
                            try {
                                const parsed = JSON.parse(img);
                                url = parsed.url || parsed.secure_url || '';
                            } catch (e) {
                                url = img;
                            }
                        } else {
                            url = img;
                        }
                    } else if (typeof img === 'object') {
                        url = img.url || img.secure_url || '';
                    }
                }
                if (url) {
                    imagesHtml += `
                                <div class="image-card">
                                    <img src="${url}" alt="ภาพถ่ายสำรวจ">
                                </div>
                            `;
                }
            });
            imagesHtml += '</div>';
        } else {
            imagesHtml = `
                        <div class="no-images">
                            ไม่มีภาพถ่ายประกอบ
                        </div>
                    `;
        }

        html += `
    <div class="page">
        <div class="header">รายงานการสำรวจตรวจสอบที่ราชพัสดุ</div>
        
        <div class="section-title">📷 ภาพถ่ายจากการสำรวจ</div>
        ${imagesHtml}
        
        <div class="section-title">📝 รายละเอียดการสำรวจ</div>
        <div class="info-grid">
            <div class="info-label">ชื่อแปลง / เลขทะเบียนที่ดิน:</div>
            <div class="info-value" style="font-weight: bold;">${name}</div>
            
            <div class="info-label">ตำบล:</div>
            <div class="info-value">${tambon}</div>
            
            <div class="info-label">อำเภอ:</div>
            <div class="info-value">${amphoe}</div>
            
            <div class="info-label">เนื้อที่แปลงที่ดิน:</div>
            <div class="info-value">${area}</div>
            
            <div class="info-label">พิกัดทางภูมิศาสตร์:</div>
            <div class="info-value">Latitude: ${j.lat}, Longitude: ${j.lng}</div>
            
            <div class="info-label">หมวดหมู่งาน:</div>
            <div class="info-value">${j.category}</div>
            
            <div class="info-label">วันที่ดำเนินการสำรวจ:</div>
            <div class="info-value">${date}</div>
            
            <div class="info-label">บันทึกเพิ่มเติม:</div>
            <div class="info-value">${note}</div>
        </div>
        
        <div class="footer">
            หน้า ${index + 1} จาก ${jobs.length} | สร้างโดยระบบจัดเก็บข้อมูล Smart Survey
        </div>
    </div>
                `;
    });

    html += `
    <script>
        window.onload = function() {
            window.print();
        }
    <\/script>
</body>
</html>
`;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
}

function download(c, n, m) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([c], { type: m }));
    a.download = n;
    a.click();
}

function doSearch() {
    renderMap();
    const searchVal = document.getElementById('inp-search').value.trim();
    const res = document.getElementById('search-results');
    res.innerHTML = '';

    if (searchVal === '') {
        res.classList.remove('active');
        return;
    }

    const hits = getFilteredJobs();
    if (hits.length > 0) res.classList.add('active');
    else res.classList.remove('active');

    hits.slice(0, 10).forEach(j => {
        const name = j.properties.name || '(ไม่มีชื่อแปลง)';
        const searchField = j.properties.search_field || ''; // 🎯 ดึงข้อมูลช่องเชื่อมโยงมาด้วย
        const note = j.properties.note || '';

        res.innerHTML += `
            <div class="p-3 border-b cursor-pointer hover:bg-gray-50" onclick="openSheetFromSearch('${j.id}')">
                <div class="text-sm font-bold text-gray-800">${name}</div>
                
                ${searchField ? `<div class="text-xs font-bold text-blue-600 mt-0.5"><i class="fa-solid fa-magnifying-glass text-[10px]"></i> ${searchField}</div>` : ''}
                
                ${note ? `<div class="text-[10px] text-gray-500 truncate mt-0.5">${note}</div>` : ''}
            </div>`;
    });
}

function openSheetFromSearch(id) {
    const j = findJobById(id);
    if (j) {
        openSheet(j);
        document.getElementById('sheet').classList.add('minimized');
        document.getElementById('search-results').classList.remove('active');
        document.getElementById('inp-search').value = '';
        if (userMarker) {
            map.fitBounds(L.latLngBounds([userMarker.getLatLng(), [j.lat, j.lng]]), { padding: [80, 80] });
        }
    }
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => console.log('PWA Ready!', reg))
            .catch(err => console.log('PWA Failed', err));
    });
}

// --- Pin Labels Toggle & Cloudinary Upload Logic ---
function togglePinLabels() {
    showPinLabels = !showPinLabels;
    localStorage.setItem('survey_show_labels', showPinLabels);

    const btn = document.getElementById('btn-label');
    if (btn) {
        if (showPinLabels) {
            btn.classList.add('bg-blue-50', 'text-blue-600');
            btn.classList.remove('text-gray-400');
        } else {
            btn.classList.remove('bg-blue-50', 'text-blue-600');
            btn.classList.add('text-gray-400');
        }
    }

    renderMap();
    Swal.fire({ toast: true, icon: 'success', title: showPinLabels ? 'เปิดแสดงป้ายชื่อ' : 'ปิดแสดงป้ายชื่อ', timer: 1500, showConfirmButton: false });
}



function renderImageGallery(images, editable) {
    const container = document.getElementById('image-gallery-container');
    if (!container) return;
    container.innerHTML = '';

    // แปลงหากข้อมูลถูกบันทึกเป็น string
    if (typeof images === 'string') {
        try { images = JSON.parse(images); } catch (e) { images = []; }
    }

    if (!Array.isArray(images) || images.length === 0) {
        container.innerHTML = `<div class="text-xs text-gray-400 flex items-center justify-center w-full py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <i class="fa-solid fa-image mr-1"></i> ยังไม่มีรูปถ่ายแปลงสำรวจ
                </div>`;
        return;
    }

    images.forEach((img, idx) => {
        let url = '';
        if (img) {
            if (typeof img === 'string') {
                if (img.startsWith('{')) {
                    try {
                        const parsed = JSON.parse(img);
                        url = parsed.url || parsed.secure_url || '';
                    } catch (e) {
                        url = img;
                    }
                } else {
                    url = img;
                }
            } else if (typeof img === 'object') {
                url = img.url || img.secure_url || '';
            }
        }

        if (!url) return;

        const card = document.createElement('div');
        card.className = 'relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-gray-200 shadow-sm cursor-pointer bg-gray-100 transition duration-200';

        const imgEl = document.createElement('img');
        imgEl.src = url;
        imgEl.className = 'w-full h-full object-cover';
        card.appendChild(imgEl);

        const handleView = (e) => {
            e.stopPropagation();
            e.preventDefault();
            viewFullScreenImage(images, idx);
        };
        card.addEventListener('click', handleView);
        card.addEventListener('touchend', handleView);

        if (editable) {
            const deleteBtn = document.createElement('div');
            deleteBtn.className = 'absolute top-1 right-1 z-20 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow hover:bg-red-600 transition transform hover:scale-110';
            deleteBtn.innerHTML = '<i class="fa-solid fa-xmark text-[10px]"></i>';

            const handleDelete = (e) => {
                e.stopPropagation();
                e.preventDefault();

                const job = findJobById(selectedJobId);
                if (!job || !job.properties.images) return;

                const imageToDel = job.properties.images[idx];
                if (imageToDel) {
                    if (imageToDel.isTemp) {
                        if (imageToDel.url && imageToDel.url.startsWith('blob:')) {
                            URL.revokeObjectURL(imageToDel.url);
                        }
                    } else {
                        const publicId = imageToDel.public_id || getPublicIdFromUrl(typeof imageToDel === 'string' ? imageToDel : imageToDel.url);
                        if (publicId) {
                            window.imagesToDeleteFromCloud.push(publicId);
                        }
                    }
                    job.properties.images.splice(idx, 1);

                    toggleInputs(true);
                    document.getElementById('btn-save').classList.remove('hidden');
                    document.getElementById('btn-edit').classList.add('hidden');

                    renderImageGallery(job.properties.images, true);
                }
            };

            deleteBtn.addEventListener('click', handleDelete);
            deleteBtn.addEventListener('touchend', handleDelete);
            card.appendChild(deleteBtn);
        }

        container.appendChild(card);
    });
}

function getPublicIdFromUrl(url) {
    if (!url || typeof url !== 'string') return null;
    try {
        const parts = url.split('/image/upload/');
        if (parts.length < 2) return null;
        const pathAfterUpload = parts[1];
        const pathParts = pathAfterUpload.split('/');
        if (pathParts[0].match(/^v\d+$/)) {
            pathParts.shift();
        }
        const remaining = pathParts.join('/');
        const lastDotIdx = remaining.lastIndexOf('.');
        if (lastDotIdx !== -1) {
            return remaining.substring(0, lastDotIdx);
        }
        return remaining;
    } catch (e) {
        console.error("Error parsing public id from URL:", e);
        return null;
    }
}

let currentGalleryImages = [];
let currentGalleryIndex = 0;
let selectedImagesToDelete = [];

function viewFullScreenImage(data, startIndex = 0) {
    const formattedData = Array.isArray(data) ? data.map(item => {
        if (typeof item === 'string') return { url: item };
        return item;
    }) : [{ url: data }];

    currentGalleryImages = formattedData;
    currentGalleryIndex = startIndex;
    showGallerySwal();
}

function showGallerySwal() {
    const img = currentGalleryImages[currentGalleryIndex];
    if (!img) return;
    const url = img.url || img;

    const hasPrev = currentGalleryIndex > 0;
    const hasNext = currentGalleryIndex < currentGalleryImages.length - 1;

    Swal.fire({
        showCloseButton: true,
        closeButtonHtml: '<i class="fa-solid fa-times"></i>',
        html: `
            <div class="relative flex items-center justify-center w-full h-[70vh]">
                ${hasPrev ? `<button onclick="prevGalleryImage()" class="absolute left-2 z-[9999] w-10 h-10 bg-black/50 text-white rounded-full hover:bg-black/80 transition flex items-center justify-center"><i class="fa-solid fa-chevron-left"></i></button>` : ''}
                <img src="${url}" class="max-h-full max-w-full object-contain" />
                ${hasNext ? `<button onclick="nextGalleryImage()" class="absolute right-2 z-[9999] w-10 h-10 bg-black/50 text-white rounded-full hover:bg-black/80 transition flex items-center justify-center"><i class="fa-solid fa-chevron-right"></i></button>` : ''}
            </div>
            <div class="text-white mt-2 font-bold">${currentGalleryIndex + 1} / ${currentGalleryImages.length}</div>
        `,
        showConfirmButton: false,
        background: 'transparent',
        width: '100vw',
        padding: '0',
        customClass: {
            closeButton: 'text-white hover:text-red-500'
        }
    });
}

function prevGalleryImage() { if (currentGalleryIndex > 0) { currentGalleryIndex--; showGallerySwal(); } }
function nextGalleryImage() { if (currentGalleryIndex < currentGalleryImages.length - 1) { currentGalleryIndex++; showGallerySwal(); } }

function compressImage(file, targetWidth = 800, quality = 0.75) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // ย่อขนาดโดยคงสัดส่วนเดิม (Maintain aspect ratio)
                if (width > targetWidth) {
                    height = Math.round((height * targetWidth) / width);
                    width = targetWidth;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    if (blob) {
                        const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve(compressedFile);
                    } else {
                        reject(new Error("Canvas toBlob failed"));
                    }
                }, 'image/jpeg', quality);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
}

function triggerCamera() {
    const job = findJobById(selectedJobId);
    if (!job) return;
    const images = job.properties.images || [];
    if (images.length >= 6) {
        return Swal.fire('อัปโหลดครบกำหนด', 'สามารถอัปโหลดได้สูงสุด 6 รูปเท่านั้น', 'warning');
    }

    if (!cloudinaryCloudName || !cloudinaryUploadPreset) {
        return Swal.fire(
            'กรุณาตั้งค่า Cloudinary',
            'ต้องกรอกข้อมูล Cloud Name และ Upload Preset ในหน้าต่างตั้งค่าก่อนใช้งาน',
            'warning'
        );
    }

    document.getElementById('camera-file-input').click();
}

async function handleImageUpload(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const job = findJobById(selectedJobId);
    if (!job) return;
    if (!job.properties.images) job.properties.images = [];

    const originalInput = document.getElementById('camera-file-input');

    Swal.fire({
        title: 'กำลังบีบอัดรูปภาพ...',
        text: 'กรุณารอสักครู่',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        for (let file of files) {
            if (job.properties.images.length >= 6) {
                Swal.fire('ข้อจำกัด', 'สามารถอัปโหลดได้สูงสุด 6 รูปเท่านั้น', 'warning');
                break;
            }

            // บีบอัดภาพด้วย Canvas เป็นขนาดกว้าง 800px
            const compressedFile = await compressImage(file, 800, 0.75);
            const tempUrl = URL.createObjectURL(compressedFile);

            job.properties.images.push({
                url: tempUrl,
                isTemp: true,
                file: compressedFile
            });
        }
        Swal.close();

        // เมื่อเพิ่มภาพ ให้เปลี่ยนสถานะแถบข้อมูลเป็นโหมดแก้ไข (แสดงปุ่มบันทึก)
        toggleInputs(true);
        document.getElementById('btn-save').classList.remove('hidden');
        document.getElementById('btn-edit').classList.add('hidden');
    } catch (err) {
        console.error("Compression error:", err);
        Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถบีบอัดรูปภาพได้: ' + err.message, 'error');
    }

    renderImageGallery(job.properties.images, true);
    originalInput.value = '';
}

function showGalleryUploadingPlaceholder() {
    const container = document.getElementById('image-gallery-container');
    if (!container) return;

    const card = document.createElement('div');
    card.className = 'flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-gray-200 shadow-sm flex flex-col items-center justify-center bg-gray-50 relative';
    card.innerHTML = `
                <div class="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                <span class="text-[9px] text-gray-500 mt-1">กำลังโหลด...</span>
            `;

    // Clear any dashed border placeholder first
    const noImagesEl = container.querySelector('.border-dashed');
    if (noImagesEl) {
        container.innerHTML = '';
    }
    container.appendChild(card);
}



// Export handlers to window for inline HTML event listener compatibility
window.handleAuthSubmit = handleAuthSubmit;
window.togglePinLabels = togglePinLabels;
window.syncJobsFromDB = syncJobsFromDB;
window.toggleViewMode = toggleViewMode;
window.toggleBaseMap = toggleBaseMap;
window.doSearch = doSearch;
window.onAmphoeChange = onAmphoeChange;
window.filterMap = filterMap;
window.importData = importData;
window.openToolsMenu = openToolsMenu;
window.findNearestNewJob = findNearestNewJob;
window.toggleGPSFollow = toggleGPSFollow;
window.viewJsonData = viewJsonData;
window.saveData = saveData;
window.enableEdit = enableEdit;
window.deleteJob = deleteJob;
window.navGoogle = navGoogle;
window.startNav = startNav;
window.stopNav = stopNav;
window.closeSheet = closeSheet;
window.toggleSheetSize = toggleSheetSize;
window.closeSettingsModal = closeSettingsModal;
window.switchSettingsTab = switchSettingsTab;
window.copyUserCode = copyUserCode;
window.addCat = addCat;
window.clearAll = clearAll;
window.triggerCamera = triggerCamera;
window.handleImageUpload = handleImageUpload;
window.resetGps = resetGps;
window.openSheetFromSearch = openSheetFromSearch;
window.handleLogout = handleLogout;
window.openExportCalendarModal = openExportCalendarModal;
window.closeExportCalendarModal = closeExportCalendarModal;
window.navigateExportCalendar = navigateExportCalendar;
window.selectExportDate = selectExportDate;
window.confirmExportCalendar = confirmExportCalendar;
window.closeImportMappingModal = closeImportMappingModal;
window.viewFullScreenImage = viewFullScreenImage;
window.prevGalleryImage = prevGalleryImage;
window.nextGalleryImage = nextGalleryImage;
window.renderImportedMapsList = renderImportedMapsList;
window.deleteImportedMap = deleteImportedMap;
window.saveProfileCategory = saveProfileCategory;
window.toggleVoiceControl = toggleVoiceControl;
window.deleteSurveyData = deleteSurveyData;

