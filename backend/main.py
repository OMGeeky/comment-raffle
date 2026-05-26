import os
import re
import random
import datetime
from typing import Optional
import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

# Load env variables from .env file
load_dotenv()

from backend.models import Comment, FetchCommentsRequest, FetchCommentsResponse
from backend.platforms.youtube import fetch_youtube_comments
from backend.platforms.instagram import fetch_instagram_comments, generate_mock_comments
from backend.platforms.tiktok import fetch_tiktok_comments

# Read configurations
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

app = FastAPI(title="Comment Selector & Raffle API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# YouTube OAuth Redirect Endpoint
@app.get("/api/auth/youtube/login")
async def oauth_youtube_login(mode: str = "readonly"):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=400, 
            detail="Google OAuth Client ID is not configured on the server. Please check the .env file."
        )
    
    redirect_uri = "http://127.0.0.1:8000/api/auth/youtube/callback"
    
    if mode == "force-ssl":
        scope = "https://www.googleapis.com/auth/youtube.force-ssl"
    else:
        scope = "https://www.googleapis.com/auth/youtube.readonly"
    
    oauth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}"
        "&response_type=code"
        f"&scope={scope}"
        "&access_type=offline"
        "&prompt=consent"
    )
    return RedirectResponse(url=oauth_url)

# YouTube OAuth Callback Endpoint
@app.get("/api/auth/youtube/callback", response_class=HTMLResponse)
async def oauth_youtube_callback(code: Optional[str] = None, error: Optional[str] = None):
    if error:
        return f"""
        <!DOCTYPE html>
        <html>
        <head><title>Authentication Failed</title></head>
        <body style="font-family: sans-serif; background: #070610; color: #f3f4f6; text-align: center; padding-top: 50px;">
            <h2 style="color: #ef4444;">Authentication Error</h2>
            <p>{error}</p>
            <script>
                if (window.opener) {{
                    window.opener.postMessage({{ type: 'youtube_auth_error', error: '{error}' }}, '*');
                }}
                setTimeout(function() {{ window.close(); }}, 3000);
            </script>
        </body>
        </html>
        """
        
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code is missing.")
        
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth credentials are not configured on the server.")
        
    redirect_uri = "http://127.0.0.1:8000/api/auth/youtube/callback"
    token_url = "https://oauth2.googleapis.com/token"
    
    payload = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code"
    }
    
    try:
        response = requests.post(token_url, data=payload)
        token_data = response.json()
        
        if "error" in token_data:
            error_desc = token_data.get("error_description", token_data["error"])
            raise ValueError(error_desc)
            
        access_token = token_data.get("access_token")
        
        return f"""
        <!DOCTYPE html>
        <html>
        <head><title>Authentication Successful</title></head>
        <body style="font-family: sans-serif; background: #070610; color: #f3f4f6; text-align: center; padding-top: 50px;">
            <h2 style="color: #10b981;">Authentication Successful!</h2>
            <p>You can close this window now if it doesn't close automatically.</p>
            <script>
                if (window.opener) {{
                    window.opener.postMessage({{ type: 'youtube_auth_success', token: '{access_token}' }}, '*');
                }}
                window.close();
            </script>
        </body>
        </html>
        """
    except Exception as e:
        safe_error = str(e).replace("'", "\\'")
        return f"""
        <!DOCTYPE html>
        <html>
        <head><title>Authentication Failed</title></head>
        <body style="font-family: sans-serif; background: #070610; color: #f3f4f6; text-align: center; padding-top: 50px;">
            <h2 style="color: #ef4444;">Exchange Token Failed</h2>
            <p>{safe_error}</p>
            <script>
                if (window.opener) {{
                    window.opener.postMessage({{ type: 'youtube_auth_error', error: '{safe_error}' }}, '*');
                }}
                setTimeout(function() {{ window.close(); }}, 3500);
            </script>
        </body>
        </html>
        """

@app.post("/api/fetch-comments", response_model=FetchCommentsResponse)
async def api_fetch_comments(request: FetchCommentsRequest):
    try:
        # Check Demo Mode first
        if request.demo_mode:
            platform = request.platform if request.platform != 'manual' else 'youtube'
            comments = generate_mock_comments(platform, count=60)
            return FetchCommentsResponse(comments=comments, success=True)
            
        comments = []
        
        if request.platform == 'youtube':
            if not request.url:
                raise ValueError("YouTube video URL or Video ID is required.")
                
            api_key = request.api_key
            access_token = request.access_token
            is_shared_key = False
            
            # If no client key or token is passed, check for server-side key
            if not api_key and not access_token:
                default_key = os.getenv("DEFAULT_YOUTUBE_API_KEY")
                if default_key:
                    api_key = default_key
                    is_shared_key = True
                else:
                    raise ValueError(
                        "No credentials provided. Please Login with Google, "
                        "provide your own API Key in Settings, or toggle Demo Mode."
                    )
            
            comments = fetch_youtube_comments(
                request.url, 
                api_key=api_key, 
                access_token=access_token, 
                is_shared_key=is_shared_key
            )
            
        elif request.platform == 'instagram':
            # If no access token is provided, fall back to mock data but let client know it's a demo
            if not request.access_token:
                comments = generate_mock_comments('instagram', count=40)
            else:
                if not request.url:
                    raise ValueError("Instagram URL or Media ID is required.")
                comments = fetch_instagram_comments(request.url, request.access_token)
                
        elif request.platform == 'tiktok':
            # If no access token is provided, fall back to mock data
            if not request.access_token:
                comments = fetch_tiktok_comments(request.url, None)
            else:
                if not request.url:
                    raise ValueError("TikTok video URL or Video ID is required.")
                comments = fetch_tiktok_comments(request.url, request.access_token)
                
        elif request.platform == 'manual':
            if not request.manual_comments or not request.manual_comments.strip():
                raise ValueError("No comments provided in the text box.")
            
            lines = request.manual_comments.strip().split('\n')
            for i, line in enumerate(lines):
                line = line.strip()
                if not line:
                    continue
                
                # Check for format: @username: text OR username - text
                match = re.match(r'^@?([a-zA-Z0-9_.-]+)[:\-]\s*(.*)$', line)
                if match:
                    author = f"@{match.group(1)}"
                    text = match.group(2)
                else:
                    author = f"@user_{i+1}"
                    text = line
                
                comments.append(Comment(
                    id=f"manual_{i}_{random.randint(1000, 9999)}",
                    author=author,
                    author_avatar=f"https://api.dicebear.com/7.x/bottts/svg?seed={author}",
                    text=text,
                    likes=0,
                    published_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    platform='manual'
                ))
        else:
            raise ValueError(f"Unsupported platform: {request.platform}")
            
        return FetchCommentsResponse(comments=comments, success=True)
        
    except Exception as e:
        return FetchCommentsResponse(comments=[], success=False, error=str(e))

# Mount the static frontend directory.
# Note: Ensure the frontend directory exists before mounting.
os.makedirs("frontend", exist_ok=True)
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")

