# Stream Tester

[![Shaka Player](https://img.shields.io/badge/Powered%20by-Shaka%20Player-blue)](https://github.com/shaka-project/shaka-player)
[![Version](https://img.shields.io/badge/Shaka%20Player-v4.16.2-blue)](https://github.com/shaka-project/shaka-player/releases/tag/v4.16.2)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A user-friendly web application for testing and streaming video content, powered by the robust Shaka Player. This tool simplifies the process of playing M3U playlists and manually testing HLS and DRM-protected MPEG-DASH streams.

## ✨ Features

-   **Multiple Input Modes:** Easily switch between loading playlists or inputting stream data manually.
-   **📂 Automatic M3U Upload:** Select an `.m3u` file and watch it load instantly—no extra clicks needed.
-   **🔗 M3U by URL:** Load and play playlists from a remote URL.
-   **Smart M3U Parsing:** Automatically detects and configures DRM settings (`license_key`, `license_type`) from `#KODIPROP` tags in your playlist.
-   **📺 Sample Streams:** Includes a pre-configured list of sample streams for quick testing.
-   **✍️ Advanced Manual Input:** Test individual streams with support for:
    -   `.m3u8` (HLS)
    -   `.mpd` (MPEG-DASH)
    -   **Advanced DRM Support:** Test protected MPEG-DASH streams using either a **License Server URL** (e.g., Widevine) or a **ClearKey KID/Key pair**.
-   **📱 Responsive Design:** A clean and adaptive interface that works seamlessly on both desktop and mobile devices.

## 🚀 How to Use

The player is designed to be intuitive. Here’s how to get started:

### 1. Load a Playlist

1.  Ensure you are in **Playlist** mode.
2.  Use the **Source** dropdown to choose your desired method:
    *   **Upload:** To use your own M3U file.
        *   Click the **`+`** button and select an `.m3u` file from your device. The playlist will load automatically.
    *   **URL Input:**
        *   Paste the URL of your M3U playlist into the input field and click **Load Playlist**.
    *   **Samples:** To select from a list of pre-loaded channels for quick testing.
3.  Once loaded, select a channel from the **Select Channel** dropdown to begin playback.

### 2. Manual Input

1.  Switch to the **Manual** input mode.
2.  Enter the URL for your `.m3u8` (HLS) or `.mpd` (DASH) stream in the **Manifest URI** field.
3.  For **MPEG-DASH (.mpd) streams**, a DRM section will automatically appear. Use the **DRM Type** dropdown to select your protection method:

    *   **For License Server (e.g., Widevine):**
        1.  Select **License URL (com.widevine.alpha)**.
        2.  Paste the server URL into the **License Server URL** field.

    *   **For ClearKey:**
        1.  Select **ClearKey (org.w3.clearkey)**.
        2.  Enter the **Key ID (KID)** and the secret **Key** into their respective fields.

4.  Click **Load Manual Input** to start the stream.

#### Manual Input Examples

**Example 1: Encrypted MPEG-DASH with a License Server**
```
Manifest URI: https://storage.googleapis.com/shaka-demo-assets/angel-one-widevine/dash.mpd
DRM Type:     License URL (com.widevine.alpha)
License URL:  https://cwip-shaka-proxy.appspot.com/no_auth
```

**Example 2: Encrypted MPEG-DASH with ClearKey**
```
Manifest URI: https://storage.googleapis.com/shaka-demo-assets/sintel-clearkey/dash.mpd
DRM Type:     ClearKey (org.w3.clearkey)
Key ID (KID): dee271b3e6b3532791467a5344333a34
Key:          045d222b513438449c21d22e0380064d
```

## 🛠️ Technologies Used

This project is built with modern web technologies and relies on the excellent Shaka Player library for media playback.

-   **HTML5**
-   **CSS3** (with Custom Properties for theming)
-   **JavaScript** (ES6+)
-   **[Shaka Player](https://github.com/shaka-project/shaka-player):** An open-source JavaScript library for adaptive media formats (such as DASH and HLS) in a browser, without using plugins or Flash.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🧑🏻‍💻 Developer

![Project Dev](assets/project_dev_(horizontal_poster).png)
