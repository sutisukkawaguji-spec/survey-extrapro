// Shared Authentication & Utility Functions
const AUTH = {
    check() {
        const user = localStorage.getItem('survey_profile_v16');
        if (!user) {
            window.location.href = 'index.html';
            return null;
        }
        const parsed = JSON.parse(user);
        if (!parsed.isLoggedIn) {
            window.location.href = 'index.html';
            return null;
        }
        return parsed;
    },
    
    logout() {
        localStorage.removeItem('survey_profile_v16');
        window.location.href = 'index.html';
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
        overlay.innerHTML = `
            <div class="flex flex-col items-center">
                <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
                <div id="loading-text" class="text-white font-bold text-center">${text}</div>
            </div>
        `;
        overlay.style = "position:fixed; inset:0; z-index:9999; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.7);";
        document.body.appendChild(overlay);
    }
    document.getElementById('loading-text').innerText = text;
    overlay.style.display = show ? 'flex' : 'none';
}
