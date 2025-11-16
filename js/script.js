let player;
let ui;
let playlistData = [];
let defaultStreamsData = {}; 
let floatingMenu;

const video = document.getElementById('video');
const videoContainer = document.getElementById('video-container');
const errorDisplay = document.getElementById('error-display');
const manifestUriInput = document.getElementById('manifestUri');
const licenseServerUrlInput = document.getElementById('licenseServerUrl');
const licenseTypeSelect = document.getElementById('licenseTypeSelect');
const k1Input = document.getElementById('k1');
const k2Input = document.getElementById('k2');
const drmFieldsContainer = document.querySelector('.drm-fields');
const licenseUrlContainer = document.getElementById('license-url-container');
const clearkeyContainer = document.getElementById('clearkey-container');
const channelSelector = document.getElementById('channelSelector');
const channelNameDisplay = document.getElementById('channel-name-display');
const m3uLinkInput = document.getElementById('m3uLink');
const m3uFileInput = document.getElementById('m3uFile');
const uploadM3uButton = document.getElementById('upload-m3u-button');
const loadPlaylistButton = document.getElementById('loadPlaylistButton');
const loadManualButton = document.getElementById('loadButton');
const inputModeSwitcher = document.querySelector('.input-mode-switcher');
const addModeBtn = document.getElementById('add-mode-btn');
const manualModeBtn = document.getElementById('manual-mode-btn');
const addModeContainer = document.getElementById('add-mode-container');
const manualModeContainer = document.getElementById('manual-mode-container');
const sourceSelector = document.getElementById('sourceSelector');
const playlistInputs = document.getElementById('playlist-inputs');

// Menu Elements
const menuToggleBtn = document.getElementById('menu-toggle-btn');

function toggleDrmBlockVisibility() {
  const manifestUri = manifestUriInput.value.toLowerCase().trim();
  const isMpd = manifestUri.includes('.mpd');
  
  if (drmFieldsContainer) {
    drmFieldsContainer.style.display = isMpd ? 'block' : 'none';
  }
}

function updateDrmFieldVisibility() {
    const selectedType = licenseTypeSelect.value;
    const isWidevine = selectedType === 'com.widevine.alpha';
    const isNone = selectedType === 'none';

    if (licenseUrlContainer && clearkeyContainer) {
        licenseUrlContainer.style.display = isWidevine ? 'block' : 'none';
        clearkeyContainer.style.display = !isWidevine && !isNone ? 'block' : 'none';
    }
}

function handleRouting() {
  const redirectPath = sessionStorage.getItem('redirectPath');
  if (redirectPath) sessionStorage.removeItem('redirectPath');
  const currentPath = redirectPath || window.location.pathname;
  const pathSegments = currentPath.split('/').filter(Boolean);
  const isGitHubPages = window.location.hostname.includes('github.io');
  const effectivePath = isGitHubPages && pathSegments.length > 1 
    ? `/${pathSegments[pathSegments.length - 1]}` 
    : currentPath;

  if (effectivePath.toLowerCase().startsWith('/manual')) {
    switchInputMode('manual', false);
  } else {
    switchInputMode('playlist', false);
  }
}

function switchInputMode(mode, pushState = true) {
  const isPlaylist = mode === 'playlist';
  addModeContainer.style.display = isPlaylist ? 'block' : 'none';
  manualModeContainer.style.display = isPlaylist ? 'none' : 'block';
  addModeBtn.classList.toggle('active', isPlaylist);
  manualModeBtn.classList.toggle('active', !isPlaylist);
  updateSliderPosition();

  if (pushState) {
    const newRoute = isPlaylist ? 'playlist' : 'manual';
    const isGitHubPages = window.location.hostname.includes('github.io');
    const repoName = isGitHubPages ? `/${window.location.pathname.split('/')[1]}` : '';
    const finalPath = `${repoName}/${newRoute}`;
    if (window.location.pathname !== finalPath) {
      history.pushState({ mode: mode }, '', finalPath);
    }
  }
}

function initPlayer() {
  shaka.polyfill.installAll();
  if (shaka.Player.isBrowserSupported()) {
    player = new shaka.Player(video);
    ui = new shaka.ui.Overlay(player, videoContainer, video);
    player.addEventListener('error', onError);
  } else {
    showError('Your browser does not support Shaka Player.');
  }
}

async function loadStream(name) {
  const manifestUri = manifestUriInput.value.trim();
  const displayName = name || 'Manual Input';

  errorDisplay.style.display = 'none';
  if (!manifestUri) return alert('Manifest URI is required.');
  
  channelNameDisplay.textContent = `Loading: ${displayName}...`;

  const config = { drm: {} };
  const selectedDrmType = licenseTypeSelect.value;

  if (drmFieldsContainer.style.display === 'block' && selectedDrmType !== 'none') {
    if (selectedDrmType === 'com.widevine.alpha') {
      const licenseServerUrl = licenseServerUrlInput.value.trim();
      if (licenseServerUrl) {
        config.drm.servers = { [selectedDrmType]: licenseServerUrl };
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
    channelNameDisplay.textContent = `Failed to load: ${displayName}`;
  }
}

async function fetchDefaultStreams() {
    try {
        const response = await fetch('js/getChannels.js');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        defaultStreamsData = await response.json();
        if (sourceSelector && sourceSelector.value === 'default') {
            populateDefaultChannels();
        }
    } catch (e) {
        showError(`Failed to load default streams: ${e.message}`);
    }
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
    } else {
      return alert('Please enter an M3U link or upload a file first.');
    }
    playlistData = parseM3U(m3uData);
    populatePlaylistChannels();
  } catch (e) {
    showError(`Failed to load playlist: ${e.message}`);
  }
}

function base64UrlToHex(base64Url) {
  try {
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const raw = atob(base64);
    let hex = '';
    for (let i = 0; i < raw.length; i++) {
      hex += raw.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return hex;
  } catch (e) {
    console.error('Failed to decode base64 string:', base64Url, e);
    return null;
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
    } else if (trimmedLine.startsWith('#KODIPROP:inputstream.adaptive.license_type=')) {
      const type = trimmedLine.split('=')[1]?.trim();
      if (type.toLowerCase() === 'clearkey') {
        currentChannel.licenseType = 'org.w3.clearkey';
      } else {
        currentChannel.licenseType = type;
      }
    } else if (trimmedLine.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
      const keyData = trimmedLine.split('=').slice(1).join('=');
      
      if (keyData.trim().startsWith('{')) {
        try {
          const parsedJson = JSON.parse(keyData);
          if (parsedJson.keys && parsedJson.keys.length > 0) {
            const keyInfo = parsedJson.keys[0];
            if (keyInfo.k && keyInfo.kid) {
              currentChannel.k2 = base64UrlToHex(keyInfo.k);
              currentChannel.k1 = base64UrlToHex(keyInfo.kid);
              currentChannel.licenseType = 'org.w3.clearkey';
            }
          }
        } catch (e) {
          console.error('Failed to parse license_key JSON:', keyData, e);
        }
      }
      else if (keyData.includes('http://') || keyData.includes('https://')) {
        currentChannel.licenseKey = keyData.trim();
      } 
      else {
        const keyParts = keyData.split(':');
        if (keyParts.length === 2 && keyParts[0].trim() && keyParts[1].trim()) {
          currentChannel.k1 = keyParts[0].trim();
          currentChannel.k2 = keyParts[1].trim();
        }
      }
    } else if (trimmedLine && !trimmedLine.startsWith('#')) {
      currentChannel.url = trimmedLine;
      channels.push(currentChannel);
      currentChannel = {};
    }
  }
  return channels;
}

function populatePlaylistChannels() {
  channelSelector.innerHTML = '<option value="">-- Select a channel --</option>';
  if (playlistData.length > 0) {
    playlistData.forEach((channel, index) => {
      const option = new Option(channel.name, `playlist_${index}`);
      channelSelector.appendChild(option);
    });
    alert(`${playlistData.length} channels loaded. Please select one.`);
  } else {
    alert('No channels found or playlist is empty.');
  }
  
  m3uFileInput.value = '';
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

  if (selectedValue.startsWith('playlist_')) {
      const m3uIndex = parseInt(selectedValue.substring(9), 10);
      channel = playlistData[m3uIndex];
      displayName = channel.name;
  } else if (selectedValue.startsWith('default_')) {
      const streamKey = selectedValue.substring(8);
      channel = defaultStreamsData[streamKey];
      displayName = streamKey.replace(/_/g, ' ');
  }

  if (channel) {
    manifestUriInput.value = channel.url || '';
    
    if ((channel.licenseType === 'org.w3.clearkey' || (channel.k1 && channel.k2)) && channel.k1 && channel.k2) {
        licenseTypeSelect.value = 'org.w3.clearkey';
        k1Input.value = channel.k1;
        k2Input.value = channel.k2;
        licenseServerUrlInput.value = '';
    } else if (channel.licenseType && channel.licenseKey) {
        licenseTypeSelect.value = channel.licenseType;
        licenseServerUrlInput.value = channel.licenseKey;
        k1Input.value = '';
        k2Input.value = '';
    } else {
        licenseTypeSelect.value = 'none'; // Default to 'none'
        licenseServerUrlInput.value = '';
        k1Input.value = '';
        k2Input.value = '';
    }
    
    toggleDrmBlockVisibility();
    updateDrmFieldVisibility(); 
    loadStream(displayName);
  }
}

function handleSourceChange(event) {
    const selectedSource = event.target.value;
    channelSelector.innerHTML = '<option value="">-- Select a source first --</option>';
    if (selectedSource === 'default') {
        playlistInputs.style.display = 'none'; 
        populateDefaultChannels();
    } else { 
        playlistInputs.style.display = 'block';
        if (playlistData.length > 0) populatePlaylistChannels();
    }
}

function updateSliderPosition() {
  const activeButton = inputModeSwitcher.querySelector('button.active');
  if (activeButton) {
    inputModeSwitcher.style.setProperty('--slider-left', `${activeButton.offsetLeft}px`);
    inputModeSwitcher.style.setProperty('--slider-width', `${activeButton.offsetWidth}px`);
  }
}

function showError(message) {
  console.error(message);
  errorDisplay.textContent = message;
  errorDisplay.style.display = 'block';
}

function onError(event) {
  const error = event.detail;
  console.error('Shaka Player Error:', error);
  showError(`Error Code: ${error.code}\nCategory: ${error.category}`);
}

function createFloatingMenu() {
    const menu = document.createElement('nav');
    menu.id = 'floating-menu';
    menu.className = 'floating-menu';

    const menuItems = [
        { href: '/stream-tester/about', icon: 'info', text: 'About Us' },
        { href: '/stream-tester/how-to-use', icon: 'help_center', text: 'How to Use' },
        { href: '/stream-tester/feedback', icon: 'feedback', text: 'Feedback' }
    ];

    const ul = document.createElement('ul');

    menuItems.forEach(item => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = item.href;

        const iconSpan = document.createElement('span');
        iconSpan.className = 'material-symbols-rounded';
        iconSpan.textContent = item.icon;

        const textSpan = document.createElement('span');
        textSpan.textContent = item.text;

        a.appendChild(iconSpan);
        a.appendChild(textSpan);
        li.appendChild(a);
        ul.appendChild(li);
    });

    menu.appendChild(ul);
    document.body.appendChild(menu);
}

function toggleMenu() {
    if (floatingMenu) {
        floatingMenu.classList.toggle('active');
    }
}

function setupEventListeners() {
  uploadM3uButton.addEventListener('click', () => m3uFileInput.click());
  loadPlaylistButton.addEventListener('click', handlePlaylistLoad);
  loadManualButton.addEventListener('click', () => loadStream());
  channelSelector.addEventListener('change', onChannelSelect);
  addModeBtn.addEventListener('click', () => switchInputMode('playlist'));
  manualModeBtn.addEventListener('click', () => switchInputMode('manual'));
  window.addEventListener('resize', updateSliderPosition);
  window.addEventListener('popstate', handleRouting);
  manifestUriInput.addEventListener('input', toggleDrmBlockVisibility);
  licenseTypeSelect.addEventListener('change', updateDrmFieldVisibility);
  m3uFileInput.addEventListener('change', handlePlaylistLoad);
  
  if (sourceSelector) {
    sourceSelector.addEventListener('change', handleSourceChange);
  }

  // Menu event listeners
  if (menuToggleBtn && floatingMenu) {
      menuToggleBtn.addEventListener('click', (event) => {
          event.stopPropagation(); // Prevent this click from being caught by the window listener
          toggleMenu();
      });

      // Close the menu if clicked outside
      window.addEventListener('click', (event) => {
          if (floatingMenu.classList.contains('active') && !floatingMenu.contains(event.target)) {
              toggleMenu();
          }
      });
  }
}

function main() {
  createFloatingMenu();
  floatingMenu = document.getElementById('floating-menu');
  setupEventListeners();
  handleRouting(); 
  initPlayer();
  fetchDefaultStreams(); 
  toggleDrmBlockVisibility(); 
  updateDrmFieldVisibility();
}

document.addEventListener('DOMContentLoaded', main);
