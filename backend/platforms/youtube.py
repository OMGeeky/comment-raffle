import re
import datetime
from typing import List, Optional
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.oauth2.credentials import Credentials
from backend.models import Comment

def extract_youtube_video_id(url: str) -> Optional[str]:
    if not url:
        return None
    # Regular expressions for YouTube URLs
    patterns = [
        r'(?:v=|\/v\/|embed\/|shorts\/|youtu\.be\/|\/embed\/|\/v=|^)([a-zA-Z0-9_-]{11})'
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    # Check if the URL itself is an 11-character video ID
    if len(url.strip()) == 11 and re.match(r'^[a-zA-Z0-9_-]{11}$', url.strip()):
        return url.strip()
    return None

def fetch_youtube_comments(
    url: str, 
    api_key: Optional[str] = None, 
    access_token: Optional[str] = None,
    is_shared_key: bool = False
) -> List[Comment]:
    if not api_key and not access_token:
        raise ValueError("YouTube API key or Google Login credentials are required.")
    
    video_id = extract_youtube_video_id(url)
    if not video_id:
        raise ValueError("Could not extract a valid YouTube video ID from the provided URL.")
    
    comments: List[Comment] = []
    
    try:
        if access_token:
            # Build service with OAuth credentials
            creds = Credentials(token=access_token)
            youtube = build('youtube', 'v3', credentials=creds)
        else:
            # Build service with API Key
            youtube = build('youtube', 'v3', developerKey=api_key)
        
        next_page_token = None
        limit = 1000  # Cap to prevent excessive API quota consumption
        
        while len(comments) < limit:
            request = youtube.commentThreads().list(
                part="snippet",
                videoId=video_id,
                maxResults=100,
                pageToken=next_page_token,
                textFormat="plainText"
            )
            response = request.execute()
            
            for item in response.get('items', []):
                snippet = item.get('snippet', {})
                top_comment = snippet.get('topLevelComment', {})
                comment_id = top_comment.get('id', '')
                comment_snippet = top_comment.get('snippet', {})
                
                # Extract fields
                author = comment_snippet.get('authorDisplayName', 'Anonymous')
                avatar = comment_snippet.get('authorProfileImageUrl', '')
                text = comment_snippet.get('textDisplay', '')
                likes = comment_snippet.get('likeCount', 0)
                published_at = comment_snippet.get('publishedAt', '')
                
                comments.append(Comment(
                    id=comment_id,
                    author=author,
                    author_avatar=avatar,
                    text=text,
                    likes=likes,
                    published_at=published_at,
                    platform='youtube'
                ))
            
            next_page_token = response.get('nextPageToken')
            if not next_page_token:
                break
                
    except HttpError as e:
        error_details = e.content.decode('utf-8') if hasattr(e, 'content') else str(e)
        if "keyInvalid" in error_details:
            raise ValueError("The provided YouTube API Key is invalid.")
        elif "quotaExceeded" in error_details or "rateLimitExceeded" in error_details:
            if is_shared_key:
                raise ValueError("SHARED_RATE_LIMIT_EXCEEDED: Shared API quota limit exceeded.")
            else:
                raise ValueError("YouTube API quota exceeded. Please sign in with Google or try again later.")
        elif "disabledComments" in error_details:
            raise ValueError("Comments are disabled on this video.")
        else:
            raise ValueError(f"YouTube API error: {e.reason if hasattr(e, 'reason') else str(e)}")
    except Exception as e:
        raise ValueError(f"Error fetching YouTube comments: {str(e)}")
        
    return comments[:limit]

