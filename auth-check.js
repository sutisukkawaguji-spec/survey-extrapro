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
        if (!CONFIG.GAS_URL || CONFIG.GAS_URL.includes('YOUR_SCRIPT_ID')) {
            throw new Error("กรุณาตั้งค่า GAS_URL ใน config.js");
        }
        
        const body = JSON.stringify({ action, ...data });
        try {
            const response = await fetch(CONFIG.GAS_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: body
            });
            if (!response.ok) throw new Error("Network response was not ok");
            return await response.json();
        } catch (err) {
            console.error("GAS Error:", err);
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
            <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white mb-4"></div>
            <div id="loading-text" class="text-white font-bold">${text}</div>
        `;
        overlay.style = "position:fixed; inset:0; z-index:9999; display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(0,0,0,0.7);";
        document.body.appendChild(overlay);
    }
    document.getElementById('loading-text').innerText = text;
    overlay.style.display = show ? 'flex' : 'none';
}
