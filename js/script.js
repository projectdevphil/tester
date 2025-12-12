document.addEventListener('DOMContentLoaded', initApp);

// --- GLOBAL VARIABLES ---
let player;
let ui;
let playlistData = [];
let defaultStreamsData = {}; 

// --- DOM ELEMENTS ---
const header = document.querySelector('header');
const video = document.getElementById('video');
const videoContainer = document.getElementById('video-container');
const errorDisplay = document.getElementById('error-display');
const channelNameDisplay = document.getElementById('channel-name-display');

// Menu
const menuBtn = document.getElementById('menu-btn');
const floatingMenu = document.getElementById('floating-menu');

// Switcher & Modes
const inputModeSwitcher = document.querySelector('.input-mode-switcher');
const modeBtns = document.querySelectorAll('.input-mode-switcher button');
const addModeContainer = document.getElementById('add-mode-container');
const manualModeContainer = document.getElementById('manual-mode-container');

// Inputs - Playlist
const sourceSelector = document.getElementById('sourceSelector');
const playlistInputs = document.getElementById('playlist-inputs');
const m3uLinkInput = document.getElementById('m3uLink');
const m3uFileInput = document.getElementById('m3uFile');
const uploadM3uButton = document.getElementById('upload-m3u-button');
const loadPlaylistButton = document.getElementById('loadPlaylistButton');
const channelSelector = document.getElementById('channelSelector');

// Inputs - Manual
const manifestUriInput = document.getElementById('manifestUri');
const loadManualButton = document.getElementById('loadButton');

// DRM Fields
const drmFieldsContainer = document.querySelector('.drm-fields');
const licenseTypeSelect = document.getElementById('licenseTypeSelect');
const licenseUrlContainer = document.getElementById('license-url-container');
const licenseServerUrlInput = document.getElementById('licenseServerUrl');
const clearkeyContainer = document.getElementById('clearkey-container');
const k1Input = document.getElementById('k1');
const k2Input = document.getElementById('k2');

// --- INITIALIZATION ---
function initApp() {
    setupUI();
    setupPlayerEventListeners();
    
    // Install Shaka Polyfills
    shaka.polyfill.installAll();
    
    if (shaka.Player.isBrowserSupported()) {
        initPlayer();
        handleRouting(); // Check URL for mode (manual/playlist)
        fetchDefaultStreams(); // Load samples
        renderMenu(); // Inject menu items
    } else {
        showError('Browser not supported by Shaka Player');
    }
}

// --- UI SETUP & INTERACTION ---
function setupUI() {
    // 1. Header Scroll Effect (Litestream Style)
    window.addEventListener('scroll', () => {
        if (window.scrollY > 10) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // 2. Floating Menu Toggle
    if (menuBtn && floatingMenu) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            floatingMenu.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!floatingMenu.contains(e.target) && !menuBtn.contains(e.target)) {
                floatingMenu.classList.remove('active');
            }
        });
    }

    // 3. Mode Switcher (Sliding Animation)
    modeBtns.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            modeBtns.forEach(b => b.classList.remove('active'));
            // Add to clicked
            btn.classList.add('active');
            
            // Switch Mode logic
            if (index === 0) {
                switchInputMode('playlist');
            } else {
                switchInputMode('manual');
            }
        });
    });

    // 4. File Input Trigger
    if (uploadM3uButton && m3uFileInput) {
        uploadM3uButton.addEventListener('click', () => {
            m3uFileInput.click();
        });
    }

    // 5. Static Page Protection (Context Menu)
    const protectedElements = document.querySelectorAll('img, a');
    protectedElements.forEach(el => {
        el.addEventListener('contextmenu', e => e.preventDefault());
    });
}

function renderMenu() {
    if (floatingMenu) {
        floatingMenu.innerHTML = `
        <ul>
            <li>
                <a href="https://litestream-iptv.vercel.app/home" target="_blank">
                    <span class="material-symbols-rounded">sensors</span>
                    <span>Litestream</span>
                </a>
            </li>
            <li>
                <a href="about">
                    <span class="material-symbols-rounded">info</span>
                    <span>About Us</span>
                </a>
            </li>
            <li>
                <a href="how-to-use">
                    <span class="material-symbols-rounded">help_center</span>
                    <span>How to Use</span>
                </a>
            </li>
            <li>
                <a href="feedback">
                    <span class="material-symbols-rounded">feedback</span>
                    <span>Feedback</span>
                </a>
            </li>
        </ul>`;
    }
}

function switchInputMode(mode, pushState = true) {
    const isPlaylist = mode === 'playlist';
    
    // UI Visibility
    addModeContainer.style.display = isPlaylist ? 'block' : 'none';
    manualModeContainer.style.display = isPlaylist ? 'none' : 'block';
    
    // Update Button State
    modeBtns[0].classList.toggle('active', isPlaylist);
    modeBtns[1].classList.toggle('active', !isPlaylist);

    // Update Slider Position (CSS Variable)
    // 0 = 5px, 1 = ~50%
    const slidePos = isPlaylist ? '5px' : 'calc(50% + 2.5px)';
    inputModeSwitcher.style.setProperty('--slide-pos', slidePos);

    // URL Routing Update
    if (pushState) {
        const newRoute = isPlaylist ? 'playlist' : 'manual';
        // Basic routing simulation for GitHub Pages compatibility
        const url = new URL(window.location);
        url.searchParams.set('mode', newRoute);
        window.history.pushState({ mode: mode }, '', url);
    }
}

function handleRouting() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    
    if (mode === 'manual') {
        switchInputMode('manual', false);
    } else {
        switchInputMode('playlist', false);
    }
}

function initPlayer() {
    player = new shaka.Player(video);
    ui = new shaka.ui.Overlay(player, videoContainer, video);
    player.addEventListener('error', onError);
}

async function loadStream(displayName = 'Manual Stream') {
    const manifestUri = manifestUriInput.value.trim();
    
    errorDisplay.style.display = 'none';
    if (!manifestUri) {
        showError('Manifest URI is required.');
        return;
    }

    channelNameDisplay.textContent = `Loading: ${displayName}...`;

    // Configure DRM
    const config = { drm: {} };
    const selectedDrmType = licenseTypeSelect.value;
    const isMpd = manifestUri.toLowerCase().includes('.mpd');

    if (isMpd && selectedDrmType !== 'none') {
        if (selectedDrmType === 'com.widevine.alpha') {
            const licenseServer = licenseServerUrlInput.value.trim();
            if (licenseServer) {
                config.drm.servers = { 'com.widevine.alpha': licenseServer };
            }
        } else if (selectedDrmType === 'org.w3.clearkey') {
            const kid = k1Input.value.trim();
            const key = k2Input.value.trim();
            if (kid && key) {
                config.drm.clearKeys = { [kid]: key };
            }
        }
    }

    player.configure(config);

    try {
        await player.load(manifestUri);
        channelNameDisplay.textContent = displayName;
    } catch (e) {
        onError({ detail: e });
        channelNameDisplay.textContent = 'Failed to load stream';
    }
}

// --- DATA & PARSING ---

async function fetchDefaultStreams() {
    try {
        // Ensure this file exists in your project structure
        const response = await fetch('js/getChannels.js'); 
        if (response.ok) {
            defaultStreamsData = await response.json();
            if (sourceSelector && sourceSelector.value === 'default') {
                populateDefaultChannels();
            }
        }
    } catch (e) {
        console.warn('Default channels not found or failed to load.');
    }
}

async function handlePlaylistLoad() {
    let m3uData = '';
    errorDisplay.style.display = 'none';
    
    const file = m3uFileInput.files[0];
    const link = m3uLinkInput.value.trim();

    try {
        if (link) {
            // Basic check to see if user just typed a URL but didn't click upload button for file
            const response = await fetch(link);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            m3uData = await response.text();
        } else if (file) {
            m3uData = await file.text();
            // Update text input for visual feedback
            m3uLinkInput.value = file.name;
        } else {
            showError('Please enter an M3U link or upload a file.');
            return;
        }
        
        playlistData = parseM3U(m3uData);
        populatePlaylistChannels();
    } catch (e) {
        showError(`Failed to load playlist: ${e.message}`);
    }
}

function parseM3U(data) {
    const lines = data.split('\n');
    const channels = [];
    let currentChannel = {};

    for (const line of lines) {
        const trimmedLine = line.trim();
        
        if (trimmedLine.startsWith('#EXTINF:')) {
            const info = trimmedLine.split(/,(.*)/s);
            currentChannel.name = info[1]?.trim() || 'Unknown Channel';
        } 
        // Handle Kodi Props for DRM
        else if (trimmedLine.startsWith('#KODIPROP:inputstream.adaptive.license_type=')) {
            const type = trimmedLine.split('=')[1]?.trim();
            currentChannel.licenseType = (type.toLowerCase() === 'clearkey') ? 'org.w3.clearkey' : type;
        } 
        else if (trimmedLine.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
            const keyData = trimmedLine.split('=').slice(1).join('=');
            processLicenseKey(keyData, currentChannel);
        } 
        // URL
        else if (trimmedLine && !trimmedLine.startsWith('#')) {
            currentChannel.url = trimmedLine;
            channels.push(currentChannel);
            currentChannel = {}; // Reset
        }
    }
    return channels;
}

function processLicenseKey(keyData, channel) {
    // 1. JSON Format
    if (keyData.trim().startsWith('{')) {
        try {
            const parsedJson = JSON.parse(keyData);
            if (parsedJson.keys && parsedJson.keys.length > 0) {
                const keyInfo = parsedJson.keys[0];
                if (keyInfo.k && keyInfo.kid) {
                    channel.k2 = base64UrlToHex(keyInfo.k);
                    channel.k1 = base64UrlToHex(keyInfo.kid);
                    channel.licenseType = 'org.w3.clearkey';
                }
            }
        } catch (e) { console.error('JSON Parse Error', e); }
    } 
    // 2. HTTP URL
    else if (keyData.includes('http://') || keyData.includes('https://')) {
        channel.licenseKey = keyData.trim();
    } 
    // 3. ClearKey Format (kid:key)
    else {
        const keyParts = keyData.split(':');
        if (keyParts.length === 2) {
            channel.k1 = keyParts[0].trim();
            channel.k2 = keyParts[1].trim();
        }
    }
}

function base64UrlToHex(base64Url) {
    try {
        let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        const raw = atob(base64);
        let hex = '';
        for (let i = 0; i < raw.length; i++) {
            hex += raw.charCodeAt(i).toString(16).padStart(2, '0');
        }
        return hex;
    } catch (e) {
        return null;
    }
}

// --- UI POPULATION ---

function populatePlaylistChannels() {
    channelSelector.innerHTML = '<option value="">-- Select a channel --</option>';
    if (playlistData.length > 0) {
        playlistData.forEach((channel, index) => {
            const option = new Option(channel.name, `playlist_${index}`);
            channelSelector.appendChild(option);
        });
        alert(`${playlistData.length} channels loaded.`);
    } else {
        showError('No channels found in playlist.');
    }
}

function populateDefaultChannels() {
    channelSelector.innerHTML = '<option value="">-- Select a Sample Stream --</option>';
    Object.keys(defaultStreamsData).forEach(channelKey => {
        const displayName = channelKey.replace(/_/g, ' '); 
        const option = new Option(displayName, `default_${channelKey}`);
        channelSelector.appendChild(option);
    });
}

function onChannelSelect(event) {
    const selectedValue = event.target.value;
    if (!selectedValue) return;

    let channel;
    let displayName;

    // Determine Source
    if (selectedValue.startsWith('playlist_')) {
        const index = parseInt(selectedValue.substring(9), 10);
        channel = playlistData[index];
        displayName = channel.name;
    } else if (selectedValue.startsWith('default_')) {
        const key = selectedValue.substring(8);
        channel = defaultStreamsData[key];
        displayName = key.replace(/_/g, ' ');
    }

    if (channel) {
        // Autofill Manual Fields for visibility/debugging
        manifestUriInput.value = channel.url || '';
        
        // Reset DRM fields
        k1Input.value = '';
        k2Input.value = '';
        licenseServerUrlInput.value = '';
        licenseTypeSelect.value = 'none';

        // Auto-configure DRM based on parsed data
        if (channel.licenseType === 'org.w3.clearkey' || (channel.k1 && channel.k2)) {
            licenseTypeSelect.value = 'org.w3.clearkey';
            k1Input.value = channel.k1 || '';
            k2Input.value = channel.k2 || '';
        } else if (channel.licenseKey) {
            licenseTypeSelect.value = channel.licenseType || 'com.widevine.alpha';
            licenseServerUrlInput.value = channel.licenseKey;
        }

        updateDrmFieldVisibility();
        loadStream(displayName);
    }
}

// --- EVENT HANDLERS ---

function handleSourceChange(event) {
    const val = event.target.value;
    channelSelector.innerHTML = '<option value="">-- Select a source first --</option>';
    
    if (val === 'default') {
        playlistInputs.style.display = 'none';
        populateDefaultChannels();
    } else {
        playlistInputs.style.display = 'block';
        if (playlistData.length > 0) populatePlaylistChannels();
    }
}

function updateDrmFieldVisibility() {
    // 1. Show DRM block if .mpd
    const isMpd = manifestUriInput.value.toLowerCase().includes('.mpd');
    if (drmFieldsContainer) {
        // Only auto-hide/show in Manual mode, or strictly based on URI
        // For better UX, we usually keep it visible in manual mode if selected
    }

    // 2. Show specific fields based on Type
    const selectedType = licenseTypeSelect.value;
    const isWidevine = selectedType === 'com.widevine.alpha';
    const isClearKey = selectedType === 'org.w3.clearkey';

    if (licenseUrlContainer) licenseUrlContainer.style.display = isWidevine ? 'block' : 'none';
    if (clearkeyContainer) clearkeyContainer.style.display = isClearKey ? 'block' : 'none';
}

function showError(message) {
    if (errorDisplay) {
        errorDisplay.textContent = message;
        errorDisplay.style.display = 'block';
        setTimeout(() => errorDisplay.style.display = 'none', 5000);
    } else {
        console.error(message);
    }
}

function onError(event) {
    const error = event.detail;
    showError(`Error ${error.code}: ${error.message || 'Unknown Error'}`);
    console.error('Shaka Error:', error);
}

function setupPlayerEventListeners() {
    if (loadPlaylistButton) loadPlaylistButton.addEventListener('click', handlePlaylistLoad);
    if (loadManualButton) loadManualButton.addEventListener('click', () => loadStream());
    if (channelSelector) channelSelector.addEventListener('change', onChannelSelect);
    
    if (sourceSelector) sourceSelector.addEventListener('change', handleSourceChange);
    
    // Inputs listeners for visibility logic
    if (manifestUriInput) manifestUriInput.addEventListener('input', updateDrmFieldVisibility);
    if (licenseTypeSelect) licenseTypeSelect.addEventListener('change', updateDrmFieldVisibility);
    if (m3uFileInput) m3uFileInput.addEventListener('change', handlePlaylistLoad);
}
