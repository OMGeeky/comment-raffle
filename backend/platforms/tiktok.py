import re
import random
import datetime
from typing import List, Optional
import requests
from backend.models import Comment
from backend.platforms.instagram import generate_mock_comments

# TikTok specific usernames and comments for extra flavor
TIKTOK_USERNAMES = [
    "hype_beast", "charlidfan", "hypehouse_watcher", "dance_queen",
    "vibes_only", "skater_boi", "aesthetics_99", "chef_tok",
    "pet_parent", "duet_me", "slowmo_king", "transition_god"
]

TIKTOK_COMMENTS = [
    "First! 🥇",
    "Here before this goes viral! 🚀",
    "The transition was so smooth 😳",
    "POV: you came to the comments to see if anyone else noticed that",
    "My last brain cell during exams 💀",
    "Can we talk about how good the lighting is?",
    "Do a duet with me please!!",
    "I've watched this 10 times already, help",
    "This deserves 1M views! 📈",
    "Can you pin this comment? 📌",
    "TikTok algorithm do your thing!",
    "No way you actually did that 😂",
    "Is this in slow motion or is it just me?",
    "Wait, how did you edit that part??",
    "Underrated creator right here!"
]

def extract_tiktok_video_id(url: str) -> Optional[str]:
    if not url:
        return None
    # Matches patterns like tiktok.com/@user/video/VIDEO_ID or vm.tiktok.com/VIDEO_ID
    # Example URL: https://www.tiktok.com/@creator/video/7123456789012345678
    match = re.search(r'video/(\d+)', url)
    if match:
        return match.group(1)
    
    # Check if the url itself is numeric (ID)
    if url.strip().isdigit():
        return url.strip()
        
    return None

def fetch_tiktok_comments(url: str, access_token: Optional[str]) -> List[Comment]:
    if not access_token:
        # Fallback to generating mock comments
        comments = []
        now = datetime.datetime.now(datetime.timezone.utc)
        for i in range(45):
            username = random.choice(TIKTOK_USERNAMES) + str(random.randint(10, 99))
            text = random.choice(TIKTOK_COMMENTS)
            likes = random.choices([0, random.randint(1, 100), random.randint(101, 5000), random.randint(5001, 50000)], weights=[20, 50, 20, 10])[0]
            offset_hours = random.randint(1, 72)
            pub_time = now - datetime.timedelta(hours=offset_hours)
            
            avatar_url = f"https://api.dicebear.com/7.x/pixel-art/svg?seed={username}"
            
            comments.append(Comment(
                id=f"tiktok_mock_{i}_{random.randint(1000, 9999)}",
                author=f"@{username}",
                author_avatar=avatar_url,
                text=text,
                likes=likes,
                published_at=pub_time.isoformat(),
                platform='tiktok'
            ))
        return comments

    video_id = extract_tiktok_video_id(url)
    if not video_id:
        raise ValueError("Could not extract a valid TikTok Video ID from the URL.")

    # Official TikTok Display API (v2) comment listing structure
    # Documentation: https://developers.tiktok.com/doc/display-api-video-comment
    api_url = "https://open.tiktokapis.com/v2/video/comment/list/"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "video_id": int(video_id),
        "cursor": 0,
        "max_count": 20
    }
    
    comments: List[Comment] = []
    
    try:
        response = requests.post(api_url, json=payload, headers=headers)
        data = response.json()
        
        if data.get('error', {}).get('code') != 'ok':
            error_msg = data.get('error', {}).get('message', 'Unknown TikTok API error')
            raise ValueError(f"TikTok API error: {error_msg}")
            
        has_more = True
        cursor = 0
        
        while has_more:
            comments_data = data.get('data', {}).get('comments', [])
            for item in comments_data:
                comment_id = item.get('id', '')
                text = item.get('text', '')
                username = item.get('user', {}).get('username', 'Anonymous')
                avatar = item.get('user', {}).get('avatar_url', '')
                likes = item.get('like_count', 0)
                published_at = datetime.datetime.fromtimestamp(item.get('create_time', 0), datetime.timezone.utc).isoformat()
                
                comments.append(Comment(
                    id=comment_id,
                    author=f"@{username}",
                    author_avatar=avatar or f"https://api.dicebear.com/7.x/pixel-art/svg?seed={username}",
                    text=text,
                    likes=likes,
                    published_at=published_at,
                    platform='tiktok'
                ))
            
            has_more = data.get('data', {}).get('has_more', False)
            if not has_more:
                break
                
            cursor = data.get('data', {}).get('cursor', 0)
            payload["cursor"] = cursor
            
            response = requests.post(api_url, json=payload, headers=headers)
            data = response.json()
            if data.get('error', {}).get('code') != 'ok':
                break
                
    except Exception as e:
        if "TikTok API error" in str(e):
            raise e
        raise ValueError(f"Error connecting to TikTok API: {str(e)}")
        
    return comments
