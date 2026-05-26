# Comment Selector & Raffle Arena

A premium, modern, glassmorphic dark-themed Single Page Application (SPA) for fetching, filtering, and drawing winners from comments across multiple platforms (**YouTube**, **Instagram**, **TikTok**, or **Manual Paste**).

Built using a high-performance **FastAPI (Python)** backend and a responsive vanilla **HTML5/CSS3/JavaScript** frontend.

---

## Key Features

### 1. Multi-Platform Support
- **YouTube:** Page through comment threads dynamically using the official Google API. Supports multiple auth/credential types.
- **Instagram:** Connects to the Graph API for Instagram Business accounts (falls back to interactive mock data when credentials are not configured).
- **TikTok:** Integrates with the TikTok Display API (falls back to interactive mock data when credentials are not configured).
- **Manual Paste:** Paste raw comments (e.g., format `@username: text` or one comment text per line) to parse them directly.

### 2. Flexible YouTube Credentials & Security
- **Shared Server Key:** Administrators can host a global developer key on the backend. Visitors get to fetch comments using it without leaking any keys to their browser.
- **Google Sign-In (Safe):** Signs in via Google OAuth requesting the safe `youtube.readonly` scope. Perfect for fetching comments on the user's **own channel videos** with zero scary deletion warnings.
- **Google Sign-In (Broad):** Requests the broader `youtube.force-ssl` scope. Allows users to fetch comments on **any public video** on YouTube. Displays Google warnings, but includes direct audit links to this open-source repository for complete transparency.
- **Custom Key:** Allows users to paste their own Google Cloud Console YouTube Data API v3 key directly in the Advanced settings modal.

### 3. Smart Fetching & Deduplication
- **Cumulative Fetching:** Comments fetched from different URLs or platforms accumulate in memory. Switch between sources seamlessly to build a unified participant pool.
- **Automatic Deduplication:** Automatically ensures that duplicate fetches of the same video link or comments do not result in duplicate drawing entries.
- **Targeted Filters:**
  - Case-insensitive text/phrase filtering (e.g. searching for entry keywords like "giveaway" or "enter").
  - Minimum likes threshold.
  - "Unique Users Only" filter (ensures each user only gets one entry in the raffle, regardless of how many comments they left).
  - Source platform filter dropdown.

### 4. Interactive Drawing Arenas (Gamification)
- **Wheel of Fortune:** Responsive HTML5 Canvas-based rotating wheel that lists all matching comments. Employs realistic deceleration, high-DPI canvas scaling, and a physical pointer click indicator.
- **Slot Ticker:** Scrolling ticker list featuring realistic physics scroll/stop actions matching click tempos.
- **Magic Cards:** Interactive grid of 3D-flipping cards. Flipping a card reveals whether it holds a winning author profile or not. Automatically handles card limits to display only the selected number of winners.
- **Revelry & SFX:**
  - Programmatic Web Audio API synthesizers that dynamically sweep sound frequencies for tick and fanfare sounds on winner selections (avoids external asset downloads and loading latencies).
  - High-performance, full-screen particle canvas confetti engine.

### 5. Export Datasets
- Download filtered comments directly in **JSON** or **CSV** formats for archiving, record keeping, or offline raffles.

---

## Code Architecture

```
comment-selector/
├── backend/
│   ├── main.py              # FastAPI server, endpoints, CORS, OAuth login/callback, config router
│   ├── models.py            # Standardized Pydantic schemas (Comment, Fetch Requests/Responses)
│   └── platforms/
│       ├── youtube.py       # Paged fetching via Google APIs using tokens or developer keys
│       ├── instagram.py     # Instagram Business API routing & mock data generators
│       └── tiktok.py        # TikTok Display API handlers & mock data generators
├── frontend/
│   ├── index.html           # SPA markup, credentials picker, warnings, drawing views, settings modal
│   ├── style.css            # Dark mode glassmorphic styling, animations, responsive design
│   └── app.js               # Client controller (state, canvas draw, audio synth, storage cache, API triggers)
├── .env                     # Configuration file (ignored by git, host credentials here)
├── pyproject.toml           # Python package dependencies & lock metadata
└── README.md                # General documentation
```

---

## Prerequisites

- **Python** (version 3.10 or higher)
- **uv** (high-performance Python package installer)

---

## Getting Started

### 1. Clone & Set Up Directory
Navigate to the project directory in your terminal:
```bash
cd comment-selector
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
# Optional: Global server API key (shared rate-limit fallback)
DEFAULT_YOUTUBE_API_KEY=your_youtube_developer_key

# Required for Google Login:
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret

# Optional: Host address of the app. Set this if hosted publicly (e.g., https://my-app.com).
# Defaults to http://127.0.0.1:8000 for local development.
BASE_URL=http://127.0.0.1:8000

# Optional: Link to your public repository. If omitted, default code links point to https://github.com
GITHUB_URL=https://github.com/your-username/comment-selector
```

### 3. Install Dependencies & Start the Server
Start the development server using `uv`:
```bash
uv run uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Once started, open your web browser and navigate to:
**[http://127.0.0.1:8000](http://127.0.0.1:8000)**

---

## Platform API Key Setup Guide

### 1. YouTube API (Data API v3 & OAuth 2.0)
To configure YouTube fetching, you can set up a global Developer Key (for shared mode) and OAuth credentials (for Google Login) via the [Google Cloud Console](https://console.cloud.google.com):

#### Option A: Server-Side API Key (Shared Key Mode)
1. In the Google Cloud Console, select or create a project.
2. Search for the **YouTube Data API v3** in the API Library and click **Enable**.
3. Go to the **Credentials** tab on the sidebar.
4. Click **Create Credentials** -> **API Key**.
5. Save the generated key as `DEFAULT_YOUTUBE_API_KEY` in your server `.env` file (or paste it under "Custom Key" in the frontend settings).

#### Option B: Google Sign-in OAuth Credentials
1. Go to the **OAuth consent screen** setup in the Cloud Console.
2. Select your User Type (e.g. *External* or *Internal* for testing), fill in app metadata, and ensure you configure test users if your app is in Sandbox/Testing mode.
3. Enable the following scopes if prompted:
   - `.../auth/youtube.readonly` (for Safe Mode)
   - `.../auth/youtube.force-ssl` (for Broad Mode)
4. Go to **Credentials** -> **Create Credentials** -> **OAuth client ID**.
5. Select **Web application** as the Application Type.
6. Under **Authorized redirect URIs**, add exactly both of the following (Google treats `localhost` and `127.0.0.1` as distinct hosts, so both must be registered to prevent mismatch errors):
   - `http://localhost:8000/api/auth/youtube/callback`
   - `http://127.0.0.1:8000/api/auth/youtube/callback`
7. Click **Create** and copy the resulting **Client ID** and **Client Secret** into your `.env` file.
9. **IMPORTANT**: Make sure the `BASE_URL` defined in your `.env` matches the exact URL you use in your browser (e.g. if you navigate to `http://localhost:8000`, your `.env` file should have `BASE_URL=http://localhost:8000`).

---

### 2. Instagram API (Instagram Graph API)
To fetch comments from Instagram posts or reels, you need access credentials from the [Meta for Developers Portal](https://developers.facebook.com):

1. Set up a Facebook App in the Developer Portal.
2. Make sure you have a **Facebook Page** linked to an **Instagram Professional (Creator or Business) Account**.
3. In your Facebook App settings, add the **Instagram Graph API** product.
4. Generate a User Access Token or Page Access Token using the **Graph API Explorer** tool.
5. Ensure the token has the following permissions granted:
   - `instagram_basic`
   - `instagram_manage_comments`
   - `pages_show_list`
   - `pages_read_engagement`
6. Paste the generated Access Token into the **Instagram Access Token** field in the app settings modal (accessible via the gear icon in the top header).

---

### 3. TikTok API (TikTok Display API)
To fetch comments from TikTok videos, you need to configure access through the [TikTok Developers Portal](https://developers.tiktok.com):

1. Register as a TikTok developer and create an app on the console.
2. Add the **TikTok Login Kit** and activate comment retrieval scopes.
3. Configure your redirect URIs to handle authorization flows, and execute the token exchange to retrieve a TikTok user/client access token.
4. Paste the resulting access token into the **TikTok Access Token** field in the app settings modal.

---

## Hosting & Production Deployments

If you are hosting this application on a public server or custom domain (e.g. Render, Heroku, AWS, or your own VPS):

### 1. Update the `BASE_URL` Environment Variable
You **must** configure the `BASE_URL` environment variable to match your public domain address. This tells the FastAPI server where to direct users when initiating Google OAuth consent flows:
```env
BASE_URL=https://your-domain.com
```

### 2. Configure Google Cloud Console OAuth Settings
Google OAuth requires that you register the redirect URIs in the Google Cloud Console for the authentication flows to succeed:
1. In the [Google Cloud Console](https://console.cloud.google.com), open your project.
2. Go to **Credentials** -> Click your **OAuth Client ID**.
3. Under **Authorized redirect URIs**, add your production callback:
   - `https://your-domain.com/api/auth/youtube/callback`
4. Click **Save**.

### 3. HTTPS Requirement
Google OAuth 2.0 does not allow HTTP redirect URIs in production (except for `localhost`). Ensure your server has SSL/TLS certificates enabled (e.g., via Let's Encrypt, Cloudflare, or your hosting provider's automated SSL proxy).

---

## Verification & Interactive Mocking (Demo Mode)

If you do not have active API credentials or client IDs set up, you can still test every feature of the drawing animations, sound synthesizers, filters, and exporting:

1. Open the application in your browser.
2. Turn on **Demo Mode** by clicking the magic wand icon in the top header bar.
3. Select **YouTube**, **Instagram**, or **TikTok** and click **Fetch Comments** to populate the pool with 40-60 mock entries containing random comment texts, avatars, likes, and dates.
4. Go to **Draw Raffle** or **Export Data** to explore the fully functional drawing components and file download triggers.
