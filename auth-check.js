// Shared Authentication & Utility Functions
const AUTH = {
    get client() {
        if (this._client) return this._client;
        try {
            if (typeof supabase !== 'undefined' && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY && CONFIG.SUPABASE_KEY !== 'your-anon-key') {
                const cleanUrl = CONFIG.SUPABASE_URL.replace(/\/rest\/v1\/?$/, '');
                this._client = supabase.createClient(cleanUrl, CONFIG.SUPABASE_KEY);
                return this._client;
            }
        } catch (e) { console.error("Supabase Client Init Error:", e); }
        return null;
    },
    _client: null,

    check() {
        const user = localStorage.getItem('survey_user_session');
        if (!user) {
            window.location.href = 'index.html';
            return null;
        }
        try {
            const parsed = JSON.parse(user);
            if (!parsed || !parsed.username) {
                window.location.href = 'index.html';
                return null;
            }
            return parsed;
        } catch (e) {
            window.location.href = 'index.html';
            return null;
        }
    },
    
    logout() {
        localStorage.removeItem('survey_user_session');
        window.location.href = 'index.html';
    },

    // New: Supabase Direct Methods
    async sb_login(username, password) {
        // Simple authentication using a 'users' table (as requested: easy way)
        const { data, error } = await this.client
            .from('users')
            .select('*')
            .eq('username', username.toLowerCase())
            .eq('password', password)
            .single();
        
        if (error || !data) throw new Error("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
        return { status: 'success', user: { ...data, isLoggedIn: true } };
    },

    async sb_register(username, password, name, province) {
        const { data, error } = await this.client
            .from('users')
            .insert([{ username: username.toLowerCase(), password, name, province, role: 'staff' }]);
        
        if (error) throw new Error("ลงทะเบียนล้มเหลว: " + error.message);
        return { status: 'success' };
    },

    async sb_getProjects(username) {
        const u = username.toLowerCase();
        // Get projects where user is owner or in shared_with
        const { data, error } = await this.client
            .from('projects')
            .select('*')
            .or(`owner.eq.${u},shared_with.ilike.%${u}%`);
        
        if (error) throw new Error("ดึงข้อมูลโครงการล้มเหลว: " + error.message);
        return { status: 'success', projects: data.map(p => ({
            ...p,
            projectName: p.project_name,
            sharedWith: p.shared_with ? p.shared_with.split(',') : [],
            mapUrl: p.map_url
        })) };
    },

    async sb_saveProject(p) {
        const payload = {
            project_name: p.projectName,
            owner: p.username,
            province: p.province,
            shared_with: p.sharedWith.join(','),
            map_url: p.mapUrl,
            data: p.data || []
        };
        
        let query;
        if (p.id) {
            query = this.client.from('projects').update(payload).eq('id', p.id);
        } else {
            query = this.client.from('projects').insert([payload]);
        }
        
        const { data, error } = await query;
        if (error) throw new Error("บันทึกโครงการล้มเหลว: " + error.message);
        return { status: 'success' };
    },

    async sb_getSurveyRecords(projectId) {
        let query = this.client.from('survey_records').select('*');
        if (projectId !== 'ALL') {
            query = query.eq('project_id', projectId);
        }
        
        const { data, error } = await query;
        if (error) throw new Error("ดึงข้อมูลการสำรวจล้มเหลว: " + error.message);
        return { status: 'success', records: data.map(r => ({
            ...r,
            feature_id: r.feature_id,
            photo_url: r.photo_url,
            date: r.created_at.split('T')[0]
        })) };
    },

    async sb_saveSurveyRecord(p) {
        const payload = {
            project_id: p.project_id,
            feature_id: p.feature_id,
            surveyor: p.username,
            status: p.status || 'done',
            lat: p.lat,
            lng: p.lng,
            photo_url: p.photo_url,
            note: p.note
        };
        
        // Upsert logic
        const { data, error } = await this.client
            .from('survey_records')
            .upsert(payload, { onConflict: 'project_id,feature_id' });
        
        if (error) throw new Error("บันทึกการสำรวจล้มเหลว: " + error.message);
        return { status: 'success' };
    },

    async sb_deleteProject(id) {
        // Delete survey records first (optional, but good practice if not on cascade)
        await this.client.from('survey_records').delete().eq('project_id', id);
        
        // Delete the project
        const { data, error } = await this.client
            .from('projects')
            .delete()
            .eq('id', id);
        
        if (error) throw new Error("ลบโครงการล้มเหลว: " + error.message);
        return { status: 'success' };
    },

    async sb_getMapLibrary() {
        const { data, error } = await this.client.from('map_library').select('*');
        if (error) throw new Error("ดึงคลังแผนที่ล้มเหลว: " + error.message);
        return { status: 'success', maps: data };
    },

    async sb_saveMapToLibrary(p) {
        const { data, error } = await this.client
            .from('map_library')
            .upsert({ name: p.name, url: p.url }, { onConflict: 'name' });
        
        if (error) throw new Error("บันทึกคลังแผนที่ล้มเหลว: " + error.message);
        return { status: 'success' };
    },

    async sb_deleteMapFromLibrary(name) {
        const { data, error } = await this.client
            .from('map_library')
            .delete()
            .eq('name', name);
        
        if (error) throw new Error("ลบแผนที่ล้มเหลว: " + error.message);
        return { status: 'success' };
    },

    async call(action, data = {}) {
        // Automatically decide between Supabase and GAS
        if (this.client && CONFIG.SUPABASE_KEY && CONFIG.SUPABASE_KEY !== 'your-anon-key') {
            try {
                switch(action) {
                    case 'login': return await this.sb_login(data.username, data.password);
                    case 'register': return await this.sb_register(data.username, data.password, data.name, data.province);
                    case 'getProjects': return await this.sb_getProjects(data.username);
                    case 'getStaff': return await this.sb_getStaff(data.province, data.excludeUser);
                    case 'saveProject': return await this.sb_saveProject(data);
                    case 'getSurveyRecords': return await this.sb_getSurveyRecords(data.project_id);
                    case 'saveSurveyRecord': return await this.sb_saveSurveyRecord(data);
                    case 'getMapLibrary': return await this.sb_getMapLibrary();
                    case 'saveMapToLibrary': return await this.sb_saveMapToLibrary(data);
                    case 'deleteMapFromLibrary': return await this.sb_deleteMapFromLibrary(data.name);
                    case 'deleteProject': return await this.sb_deleteProject(data.id);
                    case 'getConfig': 
                        return { status: 'success', config: { GOOGLE_MAPS_KEY: CONFIG.GOOGLE_MAPS_KEY } };
                    case 'get_map_data':
                    case 'fetchExternalMap':
                    case 'get_map_list':
                        // บังคับใช้ GAS เสมอสำหรับการดึงแผนที่ เพื่อแก้ปัญหา CORS
                        if (CONFIG.GAS_URL) {
                            return await this.callGAS(action, data);
                        } else {
                            throw new Error("ฟีเจอร์การดึงแผนที่จำเป็นต้องใช้ GAS (Google Apps Script) โปรดระบุ GAS_URL ใน config.js");
                        }
                    default: 
                        throw new Error("Action [" + action + "] นี้ไม่รองรับในโหมด No-GAS (Supabase Direct)");
                }
            } catch (err) {
                console.error("Supabase/Direct Error:", err);
                throw err;
            }
        } else {
            // No Supabase, try GAS if URL exists
            if (CONFIG.GAS_URL) return await this.callGAS(action, data);
            throw new Error("ไม่ได้กำหนดค่า Supabase หรือ GAS URL ใน config.js");
        }
    },

    async sb_getStaff(province, excludeUser) {
        const { data, error } = await this.client
            .from('users')
            .select('username, name')
            .eq('province', province)
            .neq('username', excludeUser);
        
        if (error) throw new Error("ดึงข้อมูลเพื่อนร่วมงานล้มเหลว: " + error.message);
        return { status: 'success', staff: data };
    },

    async callGAS(action, data = {}) {
        if (!CONFIG.GAS_URL || !CONFIG.GAS_URL.startsWith('https://script.google.com')) {
            throw new Error("ลิงก์ GAS URL ใน config.js ไม่ถูกต้อง");
        }
        
        const body = JSON.stringify({ action, ...data });
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 seconds

        try {
            const response = await fetch(CONFIG.GAS_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: body,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`เซิร์ฟเวอร์ตอบกลับผิดพลาด (${response.status})`);
            }
            
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error("Non-JSON response:", text);
                throw new Error("เซิร์ฟเวอร์ไม่ได้ส่งค่ากลับเป็น JSON (กรุณาเช็คการ Deploy GAS)");
            }
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                throw new Error("หมดเวลาการเชื่อมต่อ (Timeout) กรุณาตรวจสอบอินเทอร์เน็ต");
            }
            throw err;
        }
    },

    async uploadImage(file) {
        if (!CONFIG.CLOUDINARY || !CONFIG.CLOUDINARY.CLOUD_NAME) {
            throw new Error("Cloudinary configuration missing");
        }
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CONFIG.CLOUDINARY.UPLOAD_PRESET);
        
        try {
            const response = await fetch(`https://api.cloudinary.com/v1_1/${CONFIG.CLOUDINARY.CLOUD_NAME}/image/upload`, {
                method: 'POST',
                body: formData
            });
            if (!response.ok) throw new Error("Upload failed");
            const data = await response.json();
            return data.secure_url;
        } catch (err) {
            console.error("Cloudinary Upload Error:", err);
            throw err;
        }
    }
};

function showLoading(show, text = 'กำลังประมวลผล...') {
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        document.body.appendChild(overlay);
    }
    
    // บังคับสร้างเนื้อหาใหม่หากยังไม่มี loading-text
    if (!document.getElementById('loading-text')) {
        overlay.innerHTML = `
            <div class="flex flex-col items-center">
                <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
                <div id="loading-text" class="text-white font-bold text-center">${text}</div>
            </div>
        `;
        overlay.style = "position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.7); pointer-events:all;";
    } else {
        document.getElementById('loading-text').innerText = text;
    }
    
    overlay.style.display = show ? 'flex' : 'none';
}
