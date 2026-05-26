// Global App State
const state = {
    comments: [],
    filteredComments: [],
    drawnWinnersCount: 0,
    currentPlatform: 'youtube',
    demoMode: false,
    youtubeAuthMode: 'shared', // 'shared', 'oauth', 'custom'
    youtubeAccessToken: '',
    apiKeys: {
        youtube: '',
        instagram: '',
        tiktok: ''
    }
};

// Web Audio API Context lazy-loader
let audioCtx = null;

// Synthesize tick sound
function playTickSound() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        
        osc.type = 'triangle'; // Click sound
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.04);
        
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
    } catch (e) {
        console.warn("Web Audio API not supported or context blocked:", e);
    }
}

// Synthesize win fanfare/chime sound
function playWinSound() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        const now = audioCtx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5 arpeggio
        
        notes.forEach((freq, index) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + (index * 0.1));
            
            gain.gain.setValueAtTime(0.1, now + (index * 0.1));
            gain.gain.exponentialRampToValueAtTime(0.001, now + (index * 0.1) + 0.25);
            
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            
            osc.start(now + (index * 0.1));
            osc.stop(now + (index * 0.1) + 0.3);
        });
    } catch (e) {
        console.warn(e);
    }
}

// Custom Confetti Engine
class ConfettiEngine {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'confetti-canvas';
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.active = false;
        
        window.addEventListener('resize', () => {
            if (this.active) {
                this.canvas.width = window.innerWidth;
                this.canvas.height = window.innerHeight;
            }
        });
    }
    
    start() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.particles = [];
        this.active = true;
        
        const colors = ['#7c3aed', '#db2777', '#0284c7', '#10b981', '#fbbf24', '#f472b6'];
        
        for (let i = 0; i < 150; i++) {
            this.particles.push({
                x: window.innerWidth / 2 + (Math.random() - 0.5) * 50,
                y: window.innerHeight / 2 + (Math.random() - 0.5) * 50,
                vx: (Math.random() - 0.5) * 15,
                vy: (Math.random() - 0.7) * 15 - 5,
                r: Math.random() * 6 + 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 10,
                opacity: 1
            });
        }
        
        this.loop();
    }
    
    loop() {
        if (!this.active) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        let livingParticles = 0;
        
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.3; // Gravity
            p.vx *= 0.99;
            p.rotation += p.rotationSpeed;
            
            if (p.y > window.innerHeight) {
                p.opacity = 0;
            } else {
                livingParticles++;
            }
            
            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.rotation * Math.PI / 180);
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.opacity;
            // Draw square confetti
            this.ctx.fillRect(-p.r, -p.r, p.r * 2, p.r * 2);
            this.ctx.restore();
        });
        
        if (livingParticles > 0) {
            requestAnimationFrame(() => this.loop());
        } else {
            this.stop();
        }
    }
    
    stop() {
        this.active = false;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}

let confetti = null;
function triggerConfetti() {
    if (confetti) confetti.stop();
    confetti = new ConfettiEngine();
    confetti.start();
}

// Core App Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadApiKeys();
    setupEventListeners();
    updateUIForCurrentPlatform();
    fetchGithubUrl();
});

// Load Keys from localStorage
function loadApiKeys() {
    state.youtubeAccessToken = localStorage.getItem('youtube_access_token') || '';
    
    // Load YouTube auth type radio choice
    let storedAuthMode = localStorage.getItem('youtube_auth_mode');
    if (storedAuthMode === 'oauth') {
        storedAuthMode = 'oauth_readonly'; // upgrade old settings
    }
    if (storedAuthMode) {
        state.youtubeAuthMode = storedAuthMode;
        const radio = document.querySelector(`input[name="yt-auth-type"][value="${storedAuthMode}"]`);
        if (radio) radio.checked = true;
    }

    const keys = localStorage.getItem('raffle_api_keys');
    if (keys) {
        try {
            state.apiKeys = JSON.parse(keys);
            document.getElementById('key-youtube').value = state.apiKeys.youtube || '';
            document.getElementById('token-instagram').value = state.apiKeys.instagram || '';
            document.getElementById('token-tiktok').value = state.apiKeys.tiktok || '';
        } catch (e) {
            console.error("Error loading stored API Keys", e);
        }
    }
    
    updateYoutubeAuthUI();
}

// Save Keys to localStorage
function saveApiKeys() {
    state.apiKeys.youtube = document.getElementById('key-youtube').value.trim();
    state.apiKeys.instagram = document.getElementById('token-instagram').value.trim();
    state.apiKeys.tiktok = document.getElementById('token-tiktok').value.trim();
    
    localStorage.setItem('raffle_api_keys', JSON.stringify(state.apiKeys));
    closeModal('modal-settings');
    applyFilters();
}

// Clear Stored Keys
function clearApiKeys() {
    state.apiKeys = { youtube: '', instagram: '', tiktok: '' };
    document.getElementById('key-youtube').value = '';
    document.getElementById('token-instagram').value = '';
    document.getElementById('token-tiktok').value = '';
    localStorage.removeItem('raffle_api_keys');
    applyFilters();
}

// Event Listeners setup
function setupEventListeners() {
    // YouTube Auth radio buttons
    document.querySelectorAll('input[name="yt-auth-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            state.youtubeAuthMode = e.target.value;
            localStorage.setItem('youtube_auth_mode', state.youtubeAuthMode);
            updateYoutubeAuthUI();
        });
    });

    // YouTube Google login/logout buttons
    document.getElementById('yt-login-btn').addEventListener('click', loginWithGoogle);
    document.getElementById('yt-logout-btn').addEventListener('click', logoutFromGoogle);
    
    // Warning banner buttons
    document.getElementById('warn-login-btn').addEventListener('click', () => {
        const radio = document.querySelector('input[name="yt-auth-type"][value="oauth_force_ssl"]');
        if (radio) radio.checked = true;
        state.youtubeAuthMode = 'oauth_force_ssl';
        localStorage.setItem('youtube_auth_mode', 'oauth_force_ssl');
        updateYoutubeAuthUI();
        loginWithGoogle();
    });
    
    document.getElementById('warn-key-btn').addEventListener('click', () => {
        const radio = document.querySelector('input[name="yt-auth-type"][value="custom"]');
        if (radio) radio.checked = true;
        state.youtubeAuthMode = 'custom';
        localStorage.setItem('youtube_auth_mode', 'custom');
        updateYoutubeAuthUI();
        openModal('modal-settings');
    });

    // OAuth Message listener
    window.addEventListener('message', (e) => {
        if (e.data.type === 'youtube_auth_success') {
            state.youtubeAccessToken = e.data.token;
            localStorage.setItem('youtube_access_token', e.data.token);
            updateYoutubeAuthUI();
            showNotice("Successfully logged in with Google!");
            document.getElementById('rate-limit-warning').classList.add('hidden');
        } else if (e.data.type === 'youtube_auth_error') {
            alert("Google Login failed: " + e.data.error);
        }
    });

    // Platform switching tabs
    document.querySelectorAll('.platform-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            document.querySelectorAll('.platform-tab').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            
            state.currentPlatform = btn.dataset.platform;
            updateUIForCurrentPlatform();
        });
    });

    // Fetch button
    document.getElementById('fetch-btn').addEventListener('click', fetchComments);
    
    // Apply filters
    document.getElementById('apply-filters-btn').addEventListener('click', applyFilters);
    
    // Demo Mode toggle button
    document.getElementById('demo-toggle-btn').addEventListener('click', toggleDemoMode);

    // Settings Modal
    document.getElementById('settings-open-btn').addEventListener('click', () => openModal('modal-settings'));
    document.querySelectorAll('#modal-settings .modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => closeModal('modal-settings'));
    });
    document.getElementById('settings-save-btn').addEventListener('click', saveApiKeys);
    document.getElementById('settings-clear-btn').addEventListener('click', clearApiKeys);

    // Winner Announcement Modal
    document.getElementById('winner-close-btn').addEventListener('click', () => {
        closeModal('modal-winner');
        if (confetti) confetti.stop();
    });

    // Dashboard navigation tabs
    document.querySelectorAll('.dash-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            
            document.querySelectorAll('.dash-content-panel').forEach(p => p.classList.remove('active'));
            const targetPane = document.getElementById(`pane-${btn.dataset.tab}`);
            if (targetPane) targetPane.classList.add('active');
            
            // Special initialization if drawing view becomes active
            if (btn.dataset.tab === 'tab-draw') {
                initDrawingArena();
            }
        });
    });

    // Clear comment list
    document.getElementById('clear-list-btn').addEventListener('click', clearComments);
    const clearLeftBtn = document.getElementById('clear-left-btn');
    if (clearLeftBtn) clearLeftBtn.addEventListener('click', clearComments);

    // Draw buttons
    document.getElementById('spin-wheel-btn').addEventListener('click', runWheelRaffle);
    document.getElementById('roll-btn').addEventListener('click', runRollerRaffle);
    document.getElementById('reset-cards-btn').addEventListener('click', initMagicCardsGrid);

    // Draw Style change dropdown
    document.getElementById('draw-style').addEventListener('change', (e) => {
        document.querySelectorAll('.draw-stage').forEach(stage => stage.classList.remove('active'));
        document.getElementById(`stage-${e.target.value}`).classList.add('active');
        initDrawingArena();
    });

    // Winner slider display update
    const drawCount = document.getElementById('draw-count');
    const drawCountDisplay = document.getElementById('winner-count-display');
    drawCount.addEventListener('input', (e) => {
        drawCountDisplay.textContent = e.target.value;
    });

    // Data Exports
    document.getElementById('export-csv-btn').addEventListener('click', downloadCSV);
    document.getElementById('export-json-btn').addEventListener('click', downloadJSON);
    document.getElementById('copy-clipboard-btn').addEventListener('click', copyToClipboard);

    // Re-draw wheel on window resize if stage is active and not spinning
    window.addEventListener('resize', () => {
        const wheelStage = document.getElementById('stage-wheel');
        if (wheelStage && wheelStage.classList.contains('active') && !wheelState.isSpinning) {
            initWheelOfFortune();
        }
    });
}

// UI Platform Field Visibility Manager
function updateUIForCurrentPlatform() {
    document.querySelectorAll('.platform-inputs .input-group-wrapper').forEach(grp => {
        grp.classList.remove('active');
    });
    
    const targetGroup = document.getElementById(`input-group-${state.currentPlatform}`);
    if (targetGroup) targetGroup.classList.add('active');
    
    // Update fetch button text based on platform
    const textSpan = document.getElementById('fetch-btn-text');
    if (state.currentPlatform === 'manual') {
        textSpan.textContent = "Process Manual Comments";
    } else {
        textSpan.textContent = `Fetch ${state.currentPlatform.charAt(0).toUpperCase() + state.currentPlatform.slice(1)} Comments`;
    }
    
    if (state.currentPlatform === 'youtube') {
        updateYoutubeAuthUI();
    }
}

// YouTube Auth Mode UI Updater
function updateYoutubeAuthUI() {
    const oauthBox = document.getElementById('yt-oauth-box');
    const loginBtn = document.getElementById('yt-login-btn');
    const statusRow = document.getElementById('yt-oauth-status');
    const safeNotice = document.getElementById('yt-oauth-notice-safe');
    const broadNotice = document.getElementById('yt-oauth-notice-broad');
    
    const isOAuth = state.youtubeAuthMode === 'oauth_readonly' || state.youtubeAuthMode === 'oauth_force_ssl';
    
    if (isOAuth) {
        oauthBox.classList.remove('hidden');
        if (state.youtubeAccessToken) {
            loginBtn.classList.add('hidden');
            statusRow.classList.remove('hidden');
            if (safeNotice) safeNotice.classList.add('hidden');
            if (broadNotice) broadNotice.classList.add('hidden');
        } else {
            loginBtn.classList.remove('hidden');
            statusRow.classList.add('hidden');
            
            // Show appropriate notice based on selection
            if (state.youtubeAuthMode === 'oauth_readonly') {
                if (safeNotice) safeNotice.classList.remove('hidden');
                if (broadNotice) broadNotice.classList.add('hidden');
            } else {
                if (safeNotice) safeNotice.classList.add('hidden');
                if (broadNotice) broadNotice.classList.remove('hidden');
            }
        }
    } else {
        oauthBox.classList.add('hidden');
        if (safeNotice) safeNotice.classList.add('hidden');
        if (broadNotice) broadNotice.classList.add('hidden');
    }
}

// Google Login Popup Launcher
function loginWithGoogle() {
    const width = 500;
    const height = 650;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;
    
    const mode = state.youtubeAuthMode === 'oauth_force_ssl' ? 'force-ssl' : 'readonly';
    
    window.open(
        `/api/auth/youtube/login?mode=${mode}`,
        'youtube_oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
    );
}

// Fetch GitHub URL from server config and update DOM links dynamically
function fetchGithubUrl() {
    fetch('/api/config')
        .then(response => {
            if (!response.ok) throw new Error("Config endpoint failed");
            return response.json();
        })
        .then(data => {
            if (data && data.github_url) {
                document.querySelectorAll('.github-link').forEach(link => {
                    link.href = data.github_url;
                });
            }
        })
        .catch(err => {
            console.warn("Failed to load GitHub URL from server config, using default:", err);
        });
}

// Google Logout Handler
function logoutFromGoogle() {
    state.youtubeAccessToken = '';
    localStorage.removeItem('youtube_access_token');
    updateYoutubeAuthUI();
    showNotice("Logged out from Google Account.");
}

// Modal open/close helpers
function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
}

// Toggle Demo Mode visually
function toggleDemoMode() {
    state.demoMode = !state.demoMode;
    const btn = document.getElementById('demo-toggle-btn');
    if (state.demoMode) {
        btn.classList.add('active');
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
        // Add a demo banner or alert
        showNotice("Demo Mode Activated! Mock comments will be generated when you fetch.");
    } else {
        btn.classList.remove('active');
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
        showNotice("Demo Mode Deactivated. Real endpoints will be used.");
    }
}

// Show a temporary visual message in a toast-like notice
function showNotice(text) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.right = '24px';
    toast.style.background = 'rgba(124, 58, 237, 0.9)';
    toast.style.color = 'white';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '10px';
    toast.style.boxShadow = '0 8px 25px rgba(124,58,237,0.4)';
    toast.style.zIndex = '999';
    toast.style.backdropFilter = 'blur(10px)';
    toast.style.border = '1px solid rgba(255,255,255,0.2)';
    toast.style.fontFamily = 'var(--font-main)';
    toast.style.fontSize = '0.9rem';
    toast.style.fontWeight = '600';
    toast.textContent = text;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s ease';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

// Fetch comments network handler
async function fetchComments() {
    const fetchBtn = document.getElementById('fetch-btn');
    const spinner = document.getElementById('fetch-spinner');
    
    let url = '';
    let api_key = '';
    let access_token = '';
    let manual_comments = '';
    
    if (state.currentPlatform === 'youtube') {
        url = document.getElementById('url-youtube').value.trim();
        
        if (!state.demoMode && !url) {
            alert("Please enter a YouTube video URL or ID.");
            return;
        }
        
        if (state.youtubeAuthMode === 'custom') {
            api_key = state.apiKeys.youtube;
            if (!state.demoMode && !api_key) {
                openModal('modal-settings');
                alert("YouTube Data API Key is required. Please set it in Advanced Settings, or choose another credential option.");
                return;
            }
        } else if (state.youtubeAuthMode === 'oauth_readonly' || state.youtubeAuthMode === 'oauth_force_ssl') {
            access_token = state.youtubeAccessToken;
            if (!state.demoMode && !access_token) {
                alert("Please click 'Login with Google' first to authorize comment fetching.");
                return;
            }
        } else {
            // Shared mode: backend resolves using server env keys
            api_key = null;
            access_token = null;
        }
        
    } else if (state.currentPlatform === 'instagram') {
        url = document.getElementById('url-instagram').value.trim();
        access_token = state.apiKeys.instagram;
        if (!state.demoMode && !url) {
            alert("Please enter an Instagram post link or media ID.");
            return;
        }
    } else if (state.currentPlatform === 'tiktok') {
        url = document.getElementById('url-tiktok').value.trim();
        access_token = state.apiKeys.tiktok;
        if (!state.demoMode && !url) {
            alert("Please enter a TikTok video link or ID.");
            return;
        }
    } else if (state.currentPlatform === 'manual') {
        manual_comments = document.getElementById('manual-paste').value;
        if (!manual_comments.trim()) {
            alert("Please paste some comments into the box.");
            return;
        }
    }
    
    // Show spinner & disable button
    fetchBtn.disabled = true;
    spinner.classList.remove('hidden');
    
    const requestData = {
        platform: state.currentPlatform,
        url: url || null,
        api_key: api_key || null,
        access_token: access_token || null,
        demo_mode: state.demoMode,
        manual_comments: manual_comments || null
    };
    
    try {
        const response = await fetch('/api/fetch-comments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            const newComments = result.comments;
            const existingIds = new Set(state.comments.map(c => c.id));
            const uniqueNewComments = newComments.filter(c => !existingIds.has(c.id));
            
            state.comments = state.comments.concat(uniqueNewComments);
            
            showNotice(`Loaded ${result.comments.length} comments (${uniqueNewComments.length} new)!`);
            document.getElementById('rate-limit-warning').classList.add('hidden');
            applyFilters();
        } else {
            const err = result.error || '';
            if (err.includes('SHARED_RATE_LIMIT_EXCEEDED')) {
                const warningBanner = document.getElementById('rate-limit-warning');
                warningBanner.classList.remove('hidden');
                warningBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                alert(`Failed to fetch comments: ${result.error}`);
            }
        }
    } catch (e) {
        console.error("Network error fetching comments:", e);
        alert("Network communication error. Make sure the backend server is running.");
    } finally {
        fetchBtn.disabled = false;
        spinner.classList.add('hidden');
    }
}

// Apply Filters Logic
function applyFilters() {
    const filterText = document.getElementById('filter-text').value.trim();
    const caseSensitive = !document.getElementById('filter-case').checked;
    const minLikes = parseInt(document.getElementById('filter-likes').value) || 0;
    const sourcePlatform = document.getElementById('filter-platform').value;
    const uniqueUsersOnly = document.getElementById('filter-unique').checked;
    
    // Phase 1: Filter comments by text, likes, and source
    let tempComments = state.comments.filter(comment => {
        // Filter by likes
        if (comment.likes < minLikes) return false;
        
        // Filter by platform source
        if (sourcePlatform !== 'all' && comment.platform !== sourcePlatform) return false;
        
        // Filter by phrase
        if (filterText) {
            let targetText = comment.text;
            let query = filterText;
            if (!caseSensitive) {
                targetText = targetText.toLowerCase();
                query = query.toLowerCase();
            }
            if (!targetText.includes(query)) return false;
        }
        
        return true;
    });

    // Phase 2: Filter by unique users
    if (uniqueUsersOnly) {
        const seenUsers = new Set();
        tempComments = tempComments.filter(comment => {
            if (seenUsers.has(comment.author)) {
                return false;
            }
            seenUsers.add(comment.author);
            return true;
        });
    }

    state.filteredComments = tempComments;
    
    // Update metrics
    document.getElementById('metric-total').textContent = state.comments.length;
    document.getElementById('metric-filtered').textContent = state.filteredComments.length;
    
    // Redraw components
    renderCommentsList(filterText, caseSensitive);
    
    // Refresh drawing tabs if on drawing view
    const drawingActiveTab = document.querySelector('.dash-tab[data-tab="tab-draw"]').classList.contains('active');
    if (drawingActiveTab) {
        initDrawingArena();
    }
}

// Highlight word match helper
function highlightMatches(text, phrase, caseSensitive) {
    if (!phrase) return text;
    
    try {
        const escapedPhrase = phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const flags = caseSensitive ? 'g' : 'gi';
        const regex = new RegExp(`(${escapedPhrase})`, flags);
        return text.replace(regex, '<span class="highlighted-text">$1</span>');
    } catch (e) {
        return text;
    }
}

// Render list of comments on screen
function renderCommentsList(highlightPhrase, caseSensitive) {
    const container = document.getElementById('comments-container');
    container.innerHTML = '';
    
    document.getElementById('displayed-count').textContent = state.filteredComments.length;
    
    if (state.filteredComments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-regular fa-face-frown empty-icon"></i>
                <p>No comments matched your filter criteria.</p>
            </div>
        `;
        return;
    }
    
    state.filteredComments.forEach(comment => {
        const card = document.createElement('div');
        card.className = `comment-card comment-platform-${comment.platform}`;
        card.id = `comment-item-${comment.id}`;
        
        const dateStr = comment.published_at 
            ? new Date(comment.published_at).toLocaleString() 
            : 'Date unknown';
            
        const cleanText = highlightMatches(comment.text, highlightPhrase, caseSensitive);
        const avatarUrl = comment.author_avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${comment.author}`;
        
        card.innerHTML = `
            <img class="comment-avatar" src="${avatarUrl}" alt="${comment.author}">
            <div class="comment-content">
                <div class="comment-meta">
                    <span class="comment-author">${comment.author}</span>
                    <span class="comment-badge badge-${comment.platform}">${comment.platform}</span>
                </div>
                <div class="comment-text">${cleanText}</div>
                <div class="comment-footer">
                    <span><i class="fa-regular fa-thumbs-up"></i> ${comment.likes} Likes</span>
                    <span><i class="fa-regular fa-clock"></i> ${dateStr}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Clear Comments Reset
function clearComments() {
    if (confirm("Are you sure you want to clear all fetched comments?")) {
        state.comments = [];
        state.filteredComments = [];
        state.drawnWinnersCount = 0;
        
        document.getElementById('metric-total').textContent = '0';
        document.getElementById('metric-filtered').textContent = '0';
        document.getElementById('metric-winners').textContent = '0';
        
        renderCommentsList();
        initDrawingArena();
    }
}

// Drawing View Entrypoint Manager
function initDrawingArena() {
    const style = document.getElementById('draw-style').value;
    const countGroup = document.getElementById('draw-count-group');
    if (style === 'cards') {
        if (countGroup) countGroup.classList.remove('hidden');
    } else {
        if (countGroup) countGroup.classList.add('hidden');
    }
    
    if (style === 'wheel') {
        initWheelOfFortune();
    } else if (style === 'roller') {
        initSlotRoller();
    } else if (style === 'cards') {
        initMagicCardsGrid();
    }
}

// ==========================================
// DRAWING STYLE 1: CANVAS WHEEL OF FORTUNE
// ==========================================
let wheelState = {
    angle: 0,
    velocity: 0,
    isSpinning: false,
    entries: [],
    colors: []
};

function initWheelOfFortune() {
    const canvas = document.getElementById('wheel-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Reset state
    wheelState.isSpinning = false;
    wheelState.velocity = 0;
    
    const size = canvas.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    
    // Clean up scale transformations
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    
    if (state.filteredComments.length === 0) {
        drawEmptyWheel(ctx, size);
        return;
    }
    
    // Show all entries on the wheel
    wheelState.entries = [...state.filteredComments];
    
    // Generate slice colors
    const colorPalette = [
        '#7c3aed', '#6d28d9', '#5b21b6', // Purples
        '#db2777', '#c11f6d', '#9d174d', // Pinks
        '#0284c7', '#0369a1', '#075985', // Blues
        '#10b981', '#059669', '#065f46'  // Greens
    ];
    
    wheelState.colors = [];
    for (let i = 0; i < wheelState.entries.length; i++) {
        wheelState.colors.push(colorPalette[i % colorPalette.length]);
    }
    
    drawWheel(ctx, size);
}

function drawEmptyWheel(ctx, size) {
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 15;
    
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.stroke();
    
    ctx.fillStyle = '#6b7280';
    ctx.font = 'bold 16px Outfit';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NO COMMENTS MATCH FILTERS', cx, cy);
}

function drawWheel(ctx, size) {
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 16; // slightly more inner radius to leave space for highlighted slice protrusion
    const N = wheelState.entries.length;
    const sliceAngle = (Math.PI * 2) / N;
    
    // Determine currently active selected slice index facing right pointer (0 radians)
    const normalizedAngle = wheelState.angle % (Math.PI * 2);
    let targetLocalAngle = (0 - normalizedAngle) % (Math.PI * 2);
    if (targetLocalAngle < 0) {
        targetLocalAngle += Math.PI * 2;
    }
    const currentSelectedIdx = Math.floor(targetLocalAngle / sliceAngle) % N;
    
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(wheelState.angle);
    
    // Dynamically scale font size based on the number of slices and wheel size
    const fontSize = Math.max(5, Math.min(13, Math.round((size * 0.45) / N)));
    
    for (let i = 0; i < N; i++) {
        const startAng = i * sliceAngle;
        const endAng = startAng + sliceAngle;
        const isSelected = (i === currentSelectedIdx);
        const sliceRadius = isSelected ? r + 8 : r;
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, sliceRadius, startAng, endAng);
        ctx.fillStyle = wheelState.colors[i];
        ctx.fill();
        
        if (isSelected) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'; // draw overlay highlight
            ctx.fill();
        }
        
        ctx.lineWidth = isSelected ? 3 : (N > 50 ? 0.3 : 1);
        ctx.strokeStyle = isSelected ? 'var(--accent-pink)' : 'rgba(255, 255, 255, 0.15)';
        ctx.stroke();
        
        // Draw text only if font size is reasonably readable (above 5px)
        if (fontSize >= 5 && N <= 100) {
            ctx.save();
            ctx.rotate(startAng + sliceAngle / 2);
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            
            const activeFontSize = isSelected ? Math.max(13, fontSize * 1.5) : fontSize;
            ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.8)';
            ctx.font = isSelected ? `bold ${activeFontSize}px Outfit` : `500 ${activeFontSize}px Outfit`;
            
            // Truncate author username to fit on slice based on slice length
            let author = wheelState.entries[i].author;
            const maxChars = Math.max(5, Math.round(sliceRadius / (activeFontSize * 0.75)));
            if (author.length > maxChars) {
                author = author.substring(0, maxChars - 2) + '..';
            }
            ctx.fillText(author, sliceRadius - 15, 0);
            ctx.restore();
        }
    }
    
    // Draw center peg/pin
    ctx.restore();
    
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = '#0f0e20';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.stroke();
    
    // Draw center core inner logo
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.045, 0, Math.PI * 2);
    ctx.fillStyle = 'var(--primary)';
    ctx.fill();
}

function runWheelRaffle() {
    if (state.filteredComments.length === 0) {
        alert("No comments to select from!");
        return;
    }
    if (wheelState.isSpinning) return;
    
    // Trigger sound context wake-up on click gesture
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    wheelState.isSpinning = true;
    // Set random velocity
    wheelState.velocity = 0.4 + Math.random() * 0.3; // Angular speed
    
    const canvas = document.getElementById('wheel-canvas');
    const ctx = canvas.getContext('2d');
    
    const N = wheelState.entries.length;
    const sliceAngle = (Math.PI * 2) / N;
    
    const initialNormalizedAngle = wheelState.angle % (Math.PI * 2);
    let lastTickAngle = (0 - initialNormalizedAngle) % (Math.PI * 2);
    if (lastTickAngle < 0) {
        lastTickAngle += Math.PI * 2;
    }
    
    function spinAnimation() {
        const size = canvas.clientWidth;
        if (wheelState.velocity > 0.002) {
            wheelState.angle += wheelState.velocity;
            wheelState.velocity *= 0.997; // Apply friction decelerator (gentler slowdown)
            
            // Check if pointer passes a boundary (for sound tick)
            const normalizedAngle = wheelState.angle % (Math.PI * 2);
            let targetLocalAngle = (0 - normalizedAngle) % (Math.PI * 2);
            if (targetLocalAngle < 0) {
                targetLocalAngle += Math.PI * 2;
            }
            const currentSlice = Math.floor(targetLocalAngle / sliceAngle) % N;
            const lastSlice = Math.floor(lastTickAngle / sliceAngle) % N;
            
            if (currentSlice !== lastSlice) {
                playTickSound();
            }
            lastTickAngle = targetLocalAngle;
            
            drawWheel(ctx, size);
            requestAnimationFrame(spinAnimation);
        } else {
            wheelState.isSpinning = false;
            
            // Selection math:
            // Calculate absolute angle facing right pointer (which is at 0 radians)
            const normalizedAngle = wheelState.angle % (Math.PI * 2);
            let targetLocalAngle = (0 - normalizedAngle) % (Math.PI * 2);
            if (targetLocalAngle < 0) {
                targetLocalAngle += Math.PI * 2;
            }
            const winnerIdx = Math.floor(targetLocalAngle / sliceAngle) % N;
            
            const winnerComment = wheelState.entries[winnerIdx];
            
            // Draw one final static frame to make sure it looks completely halted
            drawWheel(ctx, size);
            
            // Wait 800ms before launching the winner reveal modal (creates anticipation and gives a sense of halt)
            setTimeout(() => {
                declareWinner(winnerComment);
            }, 800);
        }
    }
    
    spinAnimation();
}

// ==========================================
// DRAWING STYLE 2: SLOT RAFFLE ROLLER
// ==========================================
let rollerState = {
    isScrolling: false,
    items: [],
    winner: null
};

function initSlotRoller() {
    const track = document.getElementById('roller-track');
    track.innerHTML = '<div class="roller-item placeholder">Ready to roll...</div>';
    track.style.top = '0px';
    rollerState.isScrolling = false;
}

function runRollerRaffle() {
    if (state.filteredComments.length === 0) {
        alert("No comments to select from!");
        return;
    }
    if (rollerState.isScrolling) return;
    
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    rollerState.isScrolling = true;
    const track = document.getElementById('roller-track');
    track.innerHTML = '';
    
    // Pre-select winner from list
    const winnerIdx = Math.floor(Math.random() * state.filteredComments.length);
    const winner = state.filteredComments[winnerIdx];
    rollerState.winner = winner;
    
    // Create slot strip: 40 entries, leading up to the winner card
    const listLen = state.filteredComments.length;
    const rollStrip = [];
    
    for (let i = 0; i < 40; i++) {
        // Feed random comments
        const idx = Math.floor(Math.random() * listLen);
        rollStrip.push(state.filteredComments[idx]);
    }
    // Anchor winner card specifically at index 38 (near the end of scrolling)
    rollStrip[38] = winner;
    
    rollerState.items = rollStrip;
    
    // Render strip items in HTML
    rollStrip.forEach((comment, i) => {
        const item = document.createElement('div');
        item.className = 'roller-item';
        item.innerHTML = `
            <img class="roller-item-avatar" src="${comment.author_avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${comment.author}`}" alt="">
            <div class="roller-item-info">
                <span class="roller-item-user">${comment.author}</span>
                <span class="roller-item-text">${comment.text}</span>
            </div>
        `;
        track.appendChild(item);
    });
    
    // Set scrolling dynamics
    // Card height is 80px. Align indicator to center of slot at card index 38.
    // Index 38 offset is: (38 * 80) - (roller-viewport height (120px) / 2) + (card height (80px) / 2) = 38*80 - 60 + 40 = 3020 px
    const targetOffset = 38 * 80 - 20; // 3020px
    
    track.style.transition = 'none';
    track.style.top = '0px';
    
    const duration = 5000; // 5 seconds scroll duration
    const startTime = performance.now();
    let ticksSpanned = 0;
    
    function easeOutQuart(t) {
        return 1 - Math.pow(1 - t, 4);
    }
    
    function scrollFrame(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const currentY = targetOffset * easeOutQuart(progress);
        track.style.top = `-${currentY}px`;
        
        // Fire audio ticks as we cross item boundaries
        const currentItemIndex = Math.floor(currentY / 80);
        if (currentItemIndex > ticksSpanned) {
            playTickSound();
            ticksSpanned = currentItemIndex;
        }
        
        if (progress < 1) {
            requestAnimationFrame(scrollFrame);
        } else {
            // Make sure we are aligned precisely at the end
            track.style.top = `-${targetOffset}px`;
            setTimeout(() => {
                rollerState.isScrolling = false;
                declareWinner(winner);
            }, 300);
        }
    }
    
    // Trigger scroll animation
    requestAnimationFrame(scrollFrame);
}

// ==========================================
// DRAWING STYLE 3: MAGIC FLIPPING CARDS
// ==========================================
function initMagicCardsGrid() {
    const grid = document.getElementById('cards-grid');
    grid.innerHTML = '';
    
    if (state.filteredComments.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted); font-style:italic;">No comments available to draw.</p>';
        return;
    }
    
    // Pick the winner count
    const winnersCountInput = parseInt(document.getElementById('draw-count').value) || 1;
    const maxWinners = Math.min(winnersCountInput, state.filteredComments.length);
    
    // Shuffle all comments and pick winners
    const shuffled = [...state.filteredComments].sort(() => 0.5 - Math.random());
    const winnersList = shuffled.slice(0, maxWinners);
    
    // We deal exactly maxWinners cards total (no fails)
    const deck = winnersList.map(w => ({ comment: w, isWinner: true }));
    
    // Create card elements
    deck.forEach((cardData, index) => {
        const container = document.createElement('div');
        container.className = 'card-container';
        
        container.innerHTML = `
            <div class="card-inner">
                <div class="card-front">
                    <div class="card-pattern"><i class="fa-solid fa-gift"></i></div>
                    <span class="card-number">Card ${index + 1}</span>
                </div>
                <div class="card-back">
                    <img class="card-back-avatar" src="${cardData.comment.author_avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${cardData.comment.author}`}" alt="">
                    <span class="card-back-user">${cardData.comment.author}</span>
                    <span class="card-back-winner">👑 Winner!</span>
                </div>
            </div>
        `;
        
        container.addEventListener('click', () => {
            if (container.classList.contains('flipped')) return;
            
            playTickSound();
            container.classList.add('flipped');
            
            // Delay winner announcement modal for flip animation to finish
            setTimeout(() => {
                declareWinner(cardData.comment);
            }, 600);
        });
        
        grid.appendChild(container);
    });
}

// Winner Announcement orchestrator
function declareWinner(comment) {
    playWinSound();
    triggerConfetti();
    
    // Highlight winning row in the list view if it's rendered
    const listRow = document.getElementById(`comment-item-${comment.id}`);
    if (listRow) {
        listRow.classList.add('highlight-row');
        listRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Set text parameters in winner modal overlay
    document.getElementById('winner-name').textContent = comment.author;
    document.getElementById('winner-text').textContent = `"${comment.text}"`;
    document.getElementById('winner-avatar').src = comment.author_avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${comment.author}`;
    
    const iconClass = comment.platform === 'youtube' ? 'fa-brands fa-youtube' : 
                      comment.platform === 'instagram' ? 'fa-brands fa-instagram' :
                      comment.platform === 'tiktok' ? 'fa-brands fa-tiktok' : 'fa-solid fa-keyboard';
                      
    document.getElementById('winner-platform').innerHTML = `<i class="${iconClass}"></i> ${comment.platform}`;
    document.getElementById('winner-likes').innerHTML = `<i class="fa-regular fa-thumbs-up"></i> ${comment.likes} Likes`;
    
    openModal('modal-winner');
    
    // Add count
    state.drawnWinnersCount++;
    document.getElementById('metric-winners').textContent = state.drawnWinnersCount;
}

// ==========================================
// EXPORTS MANAGER & UTILITIES
// ==========================================

// Build CSV payload string
function convertToCSV(data) {
    const headers = ['id', 'author', 'text', 'likes', 'published_at', 'platform'];
    const csvRows = [headers.join(',')];
    
    data.forEach(item => {
        const values = headers.map(header => {
            let val = item[header] === null || item[header] === undefined ? '' : item[header];
            // Escape double quotes in text lines
            val = String(val).replace(/"/g, '""');
            return `"${val}"`;
        });
        csvRows.push(values.join(','));
    });
    
    return csvRows.join('\n');
}

// CSV trigger downloader
function downloadCSV() {
    if (state.filteredComments.length === 0) {
        alert("No comments to export.");
        return;
    }
    const csvContent = convertToCSV(state.filteredComments);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `comments_export_${state.currentPlatform}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    
    link.click();
    document.body.removeChild(link);
    showNotice("CSV download started!");
}

// JSON trigger downloader
function downloadJSON() {
    if (state.filteredComments.length === 0) {
        alert("No comments to export.");
        return;
    }
    const jsonContent = JSON.stringify(state.filteredComments, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `comments_export_${state.currentPlatform}_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    
    link.click();
    document.body.removeChild(link);
    showNotice("JSON download started!");
}

// Copy plain text lines to clipboard buffer
function copyToClipboard() {
    if (state.filteredComments.length === 0) {
        alert("No comments to copy.");
        return;
    }
    
    const formatted = state.filteredComments.map(comment => `${comment.author}: ${comment.text} (${comment.likes} likes, source: ${comment.platform})`).join('\n');
    
    navigator.clipboard.writeText(formatted).then(() => {
        showNotice("Comments list copied to clipboard!");
    }).catch(err => {
        console.error('Could not copy text to clipboard: ', err);
        alert("Failed to copy comments to clipboard.");
    });
}
