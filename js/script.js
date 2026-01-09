document.addEventListener('DOMContentLoaded', initApp);

let player;
let ui;
let playlistData = [];
let defaultStreamsData = {}; 

const header = document.querySelector('header');
const video = document.getElementById('video');
const videoContainer = document.getElementById('video-container');
const errorDisplay = document.getElementById('error-display');
const channelNameDisplay = document.getElementById('channel-name-display');
const menuBtn = document.getElementById('menu-btn');
const floatingMenu = document.getElementById('floating-menu');
const inputModeSwitcher = document.querySelector('.input-mode-switcher');
const modeBtns = document.querySelectorAll('.input-mode-switcher button');
const addModeContainer = document.getElementById('add-mode-container');
const manualModeContainer = document.getElementById('manual-mode-container');
const sourceSelector = document.getElementById('sourceSelector');
const playlistInputs = document.getElementById('playlist-inputs');
const m3uLinkInput = document.getElementById('m3uLink');
const m3uFileInput = document.getElementById('m3uFile');
const uploadM3uButton = document.getElementById('upload-m3u-button');
const loadPlaylistButton = document.getElementById('loadPlaylistButton');
const channelSelector = document.getElementById('channelSelector');
const manifestUriInput = document.getElementById('manifestUri');
const loadManualButton = document.getElementById('loadButton');
const drmFieldsContainer = document.querySelector('.drm-fields');
const licenseTypeSelect = document.getElementById('licenseTypeSelect');
const licenseUrlContainer = document.getElementById('license-url-container');
const licenseServerUrlInput = document.getElementById('licenseServerUrl');
const clearkeyContainer = document.getElementById('clearkey-container');
const k1Input = document.getElementById('k1');
const k2Input = document.getElementById('k2');

function initApp() {
    setupUI();
    setupPlayerEventListeners();
    
    shaka.polyfill.installAll();
    
    if (shaka.Player.isBrowserSupported()) {
        initPlayer();
        handleRouting(); 
        fetchDefaultStreams(); 
        renderMenu(); 
    } else {
        showError('Browser not supported by Shaka Player');
    }
}

function setupUI() {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 10) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

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

    if (modeBtns.length > 0) {
        modeBtns.forEach((btn, index) => {
            btn.addEventListener('click', () => {
                modeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (index === 0) switchInputMode('playlist');
                else switchInputMode('manual');
            });
        });
    }

    if (uploadM3uButton && m3uFileInput) {
        uploadM3uButton.addEventListener('click', () => {
            m3uFileInput.click();
        });
    }

    const dropdownBtns = document.querySelectorAll('.dropdown-circle-btn');
    dropdownBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = btn.getAttribute('data-target');
            const selectEl = document.getElementById(targetId);
            
            if (selectEl && typeof selectEl.showPicker === 'function') {
                selectEl.showPicker(); 
            } else if (selectEl) {
                selectEl.focus(); 
            }
        });
    });

    const noContextMenuElements = document.querySelectorAll('.logo-link, .icon-link, .dropdown-circle-btn, .floating-menu, img, a');
    noContextMenuElements.forEach(el => {
        el.addEventListener('contextmenu', e => e.preventDefault());
    });
}

function renderMenu() {
    if (floatingMenu) {
        floatingMenu.innerHTML = `
        <ul>
            <li><a href="https://liveplay.vercel.app/home" target="_blank"><span class="material-symbols-rounded">smart_display</span> Liveplay</a></li>
            <li><a href="about-us"><span class="material-symbols-rounded">info</span> About Us</a></li>
            <li><a href="how-to-use"><span class="material-symbols-rounded">help_center</span> How to Use</a></li>
            <li><a href="feedback"><span class="material-symbols-rounded">feedback</span> Feedback</a></li>
        </ul>`;
        
        const links = floatingMenu.querySelectorAll('a');
        links.forEach(l => l.addEventListener('contextmenu', e => e.preventDefault()));
    }
}

function switchInputMode(mode, pushState = true) {
    const isPlaylist = mode === 'playlist';
    addModeContainer.style.display = isPlaylist ? 'block' : 'none';
    manualModeContainer.style.display = isPlaylist ? 'none' : 'block';
    
    if(modeBtns.length > 0) {
        modeBtns[0].classList.toggle('active', isPlaylist);
        modeBtns[1].classList.toggle('active', !isPlaylist);
    }

    const slidePos = isPlaylist ? '5px' : 'calc(50% + 2.5px)';
    if(inputModeSwitcher) inputModeSwitcher.style.setProperty('--slide-pos', slidePos);

    if (pushState) {
        const url = new URL(window.location);
        url.searchParams.set('mode', isPlaylist ? 'playlist' : 'manual');
        window.history.pushState({ mode: mode }, '', url);
    }
}

function handleRouting() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    if (mode === 'manual') switchInputMode('manual', false);
    else switchInputMode('playlist', false);
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

    const config = { drm: {} };
    const selectedDrmType = licenseTypeSelect.value;
    
    if (drmFieldsContainer.style.display !== 'none' && selectedDrmType !== 'none') {
        if (selectedDrmType === 'com.widevine.alpha') {
            const licenseServer = licenseServerUrlInput.value.trim();
            if (licenseServer) config.drm.servers = { 'com.widevine.alpha': licenseServer };
        } else if (selectedDrmType === 'org.w3.clearkey') {
            const kid = k1Input.value.trim();
            const key = k2Input.value.trim();
            if (kid && key) config.drm.clearKeys = { [kid]: key };
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

async function fetchDefaultStreams() {
    try {
        const response = await fetch('js/getChannels.js'); 
        if (response.ok) {
            defaultStreamsData = await response.json();
            if (sourceSelector && sourceSelector.value === 'default') populateDefaultChannels();
        }
    } catch (e) { console.warn('Default channels not loaded'); }
}

async function handlePlaylistLoad() {
    let m3uData = '';
    errorDisplay.style.display = 'none';
    const file = m3uFileInput.files[0];
    const link = m3uLinkInput.value.trim();

    try {
        if (link) {
            const response = await fetch(link);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            m3uData = await response.text();
        } else if (file) {
            m3uData = await file.text();
            m3uLinkInput.value = file.name;
        } else {
            showError('Please enter an M3U link or upload a file.');
            return;
        }
        playlistData = parseM3U(m3uData);
        populatePlaylistChannels();
    } catch (e) { showError(`Failed to load playlist: ${e.message}`); }
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
        } else if (trimmedLine.startsWith('#KODIPROP:inputstream.adaptive.license_type=')) {
            const type = trimmedLine.split('=')[1]?.trim();
            currentChannel.licenseType = (type.toLowerCase() === 'clearkey') ? 'org.w3.clearkey' : type;
        } else if (trimmedLine.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
            const keyData = trimmedLine.split('=').slice(1).join('=');
            processLicenseKey(keyData, currentChannel);
        } else if (trimmedLine && !trimmedLine.startsWith('#')) {
            currentChannel.url = trimmedLine;
            channels.push(currentChannel);
            currentChannel = {};
        }
    }
    return channels;
}

function processLicenseKey(keyData, channel) {
    if (keyData.trim().startsWith('{')) {
        try {
            const parsedJson = JSON.parse(keyData);
            if (parsedJson.keys?.[0]?.k && parsedJson.keys?.[0]?.kid) {
                channel.k2 = base64UrlToHex(parsedJson.keys[0].k);
                channel.k1 = base64UrlToHex(parsedJson.keys[0].kid);
                channel.licenseType = 'org.w3.clearkey';
            }
        } catch (e) {}
    } else if (keyData.includes('http://') || keyData.includes('https://')) {
        channel.licenseKey = keyData.trim();
    } else {
        const parts = keyData.split(':');
        if (parts.length === 2) {
            channel.k1 = parts[0].trim();
            channel.k2 = parts[1].trim();
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
    } catch (e) { return null; }
}

function populatePlaylistChannels() {
    channelSelector.innerHTML = '<option value="">Select a channel</option>';
    if (playlistData.length > 0) {
        playlistData.forEach((ch, i) => channelSelector.appendChild(new Option(ch.name, `playlist_${i}`)));
        alert(`${playlistData.length} channels loaded.`);
    } else { showError('No channels found.'); }
}

function populateDefaultChannels() {
    channelSelector.innerHTML = '<option value="">Select a Sample Stream</option>';
    Object.keys(defaultStreamsData).forEach(key => {
        channelSelector.appendChild(new Option(key.replace(/_/g, ' '), `default_${key}`));
    });
}

function onChannelSelect(event) {
    const val = event.target.value;
    if (!val) return;
    
    let channel, displayName;
    if (val.startsWith('playlist_')) {
        channel = playlistData[parseInt(val.substring(9))];
        displayName = channel.name;
    } else {
        channel = defaultStreamsData[val.substring(8)];
        displayName = val.substring(8).replace(/_/g, ' ');
    }

    if (channel) {
        manifestUriInput.value = channel.url || '';
        k1Input.value = ''; k2Input.value = ''; licenseServerUrlInput.value = ''; licenseTypeSelect.value = 'none';

        if (channel.licenseType === 'org.w3.clearkey' || (channel.k1 && channel.k2)) {
            licenseTypeSelect.value = 'org.w3.clearkey';
            k1Input.value = channel.k1 || '';
            k2Input.value = channel.k2 || '';
        } else if (channel.licenseKey) {
            licenseTypeSelect.value = channel.licenseType || 'com.widevine.alpha';
            licenseServerUrlInput.value = channel.licenseKey;
        }
        
        toggleDrmBlockVisibility();
        updateDrmFieldVisibility();
        loadStream(displayName);
    }
}

function handleSourceChange(event) {
    channelSelector.innerHTML = '<option value="">-- Select a source first --</option>';
    if (event.target.value === 'default') {
        playlistInputs.style.display = 'none';
        populateDefaultChannels();
    } else {
        playlistInputs.style.display = 'block';
        if (playlistData.length > 0) populatePlaylistChannels();
    }
}

function toggleDrmBlockVisibility() {
    const val = manifestUriInput.value.toLowerCase().trim();
    if (val.includes('.mpd')) {
        drmFieldsContainer.style.display = 'block';
    } else if (val.includes('.m3u8') || val.includes('.mp4')) {
        drmFieldsContainer.style.display = 'none';
    }
}

function updateDrmFieldVisibility() {
    const type = licenseTypeSelect.value;
    const isWidevine = type === 'com.widevine.alpha';
    const isClearKey = type === 'org.w3.clearkey';

    if (licenseUrlContainer) licenseUrlContainer.style.display = isWidevine ? 'block' : 'none';
    if (clearkeyContainer) clearkeyContainer.style.display = isClearKey ? 'block' : 'none';
}

function showError(msg) {
    if (errorDisplay) {
        errorDisplay.textContent = msg;
        errorDisplay.style.display = 'block';
        setTimeout(() => errorDisplay.style.display = 'none', 5000);
    } else console.error(msg);
}

function onError(e) {
    const err = e.detail;
    showError(`Error ${err.code}: ${err.message || 'Unknown'}`);
}

function setupPlayerEventListeners() {
    if (loadPlaylistButton) loadPlaylistButton.addEventListener('click', handlePlaylistLoad);
    if (loadManualButton) loadManualButton.addEventListener('click', () => loadStream());
    if (channelSelector) channelSelector.addEventListener('change', onChannelSelect);
    if (sourceSelector) sourceSelector.addEventListener('change', handleSourceChange);
    
    if (manifestUriInput) {
        manifestUriInput.addEventListener('input', toggleDrmBlockVisibility);
    }
    if (licenseTypeSelect) licenseTypeSelect.addEventListener('change', updateDrmFieldVisibility);
    if (m3uFileInput) m3uFileInput.addEventListener('change', handlePlaylistLoad);
}
