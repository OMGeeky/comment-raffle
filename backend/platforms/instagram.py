import re
import random
import datetime
from typing import List, Optional
import requests
from backend.models import Comment

# Mock data for generating comments in Demo Mode
MOCK_USERNAMES = [
    "travel_guru", "foodie_phoebe", "tech_linus", "fit_life_sara",
    "gamer_dude99", "pixel_artist", "nature_lover_9", "code_ninja",
    "music_is_life", "wanderlust_kate", "crypto_king", "bookworm_emily",
    "coffee_addict", "fitness_junkie", "design_dreamer", "science_geek"
]

MOCK_COMMENTS = [
    "This is absolutely amazing! 🔥 Keep it up!",
    "Wow, I need to try this ASAP! 😮",
    "Please let me win the raffle! I've been waiting for this 🤞🎁",
    "Shared this with my family, they loved it!",
    "Where is this filmed? The aesthetics are incredible.",
    "Can you share the link to the gear you used?",
    "First time watching your video and I'm already hooked! Subscribed.",
    "Is there a discount code for this? 💸",
    "I've been following you for years and you never disappoint!",
    "This ending caught me completely off guard 😂",
    "Unbelievable quality, what camera is this?",
    "Adding this to my bucket list right now! ✈️",
    "So inspiring! Thanks for sharing this.",
    "Count me in! Hope I get selected! 🍀",
    "Great explanation, very clear and concise.",
    "This is the content I signed up for. Quality work!"
]

def generate_mock_comments(platform: str, count: int = 50) -> List[Comment]:
    comments = []
    now = datetime.datetime.now(datetime.timezone.utc)
    for i in range(count):
        username = random.choice(MOCK_USERNAMES) + str(random.randint(10, 99))
        text = random.choice(MOCK_COMMENTS)
        likes = random.choices([0, random.randint(1, 10), random.randint(11, 100), random.randint(101, 500)], weights=[30, 40, 20, 10])[0]
        # Random time in the last 7 days
        offset_hours = random.randint(1, 168)
        pub_time = now - datetime.timedelta(hours=offset_hours)
        
        avatar_url = f"https://api.dicebear.com/7.x/adventurer/svg?seed={username}"
        
        comments.append(Comment(
            id=f"{platform}_mock_{i}_{random.randint(1000, 9999)}",
            author=f"@{username}",
            author_avatar=avatar_url,
            text=text,
            likes=likes,
            published_at=pub_time.isoformat(),
            platform=platform
        ))
    return comments

def extract_instagram_shortcode(url: str) -> Optional[str]:
    if not url:
        return None
    # Match shortcodes in instagram.com/p/SHORTCODE/ or instagram.com/reel/SHORTCODE/ or instagram.com/tv/SHORTCODE/
    match = re.search(r'instagram\.com/(?:p|reel|tv)/([a-zA-Z0-9_-]+)', url)
    if match:
        return match.group(1)
    # Check if the url itself is a shortcode
    if re.match(r'^[a-zA-Z0-9_-]+$', url.strip()):
        return url.strip()
    return None

def fetch_instagram_comments(url: str, access_token: Optional[str]) -> List[Comment]:
    if not access_token:
        # Fallback to generating mock data if credentials are not provided
        # The UI will let the user know this is demo/mock data
        return generate_mock_comments('instagram', 40)
        
    shortcode = extract_instagram_shortcode(url)
    if not shortcode:
        raise ValueError("Could not extract a valid Instagram shortcode/media ID from URL.")
    
    # Official API flow:
    # 1. We first need to get the media ID from the shortcode.
    # Note: Instagram Graph API requires querying through a Business account.
    # Often, the developer needs the exact media ID directly.
    # If the user enters a numeric ID as the URL, we use that.
    media_id = shortcode
    if not media_id.isdigit():
        # In a real business application, we might query:
        # GET /v19.0/instagram_business_account/media?fields=shortcode,id
        # and match the shortcode to retrieve the ID.
        # Since we don't have the business account ID, we assume the user might provide the media ID directly,
        # or we try a direct API request. We will attempt to fetch comments using the shortcode as media_id,
        # but clarify error messages if it fails.
        pass
        
    comments: List[Comment] = []
    api_url = f"https://graph.facebook.com/v19.0/{media_id}/comments"
    
    params = {
        "fields": "id,text,username,timestamp,like_count",
        "access_token": access_token,
        "limit": 100
    }
    
    try:
        response = requests.get(api_url, params=params)
        data = response.json()
        
        if "error" in data:
            error_msg = data["error"].get("message", "Unknown Facebook API error")
            raise ValueError(f"Instagram Graph API error: {error_msg}. (Make sure you provided a numeric Media ID instead of a shortcode if you are query direct media endpoints.)")
            
        while True:
            for item in data.get('data', []):
                comment_id = item.get('id', '')
                text = item.get('text', '')
                username = item.get('username', 'Anonymous')
                likes = item.get('like_count', 0)
                published_at = item.get('timestamp', '')
                
                avatar_url = f"https://api.dicebear.com/7.x/adventurer/svg?seed={username}"
                
                comments.append(Comment(
                    id=comment_id,
                    author=f"@{username}",
                    author_avatar=avatar_url,
                    text=text,
                    likes=likes,
                    published_at=published_at,
                    platform='instagram'
                ))
            
            # Pagination
            paging = data.get('paging', {})
            next_url = paging.get('next')
            if not next_url:
                break
                
            response = requests.get(next_url)
            data = response.json()
            if "error" in data:
                break
                
    except Exception as e:
        if "Instagram Graph API error" in str(e):
            raise e
        raise ValueError(f"Error connecting to Instagram Graph API: {str(e)}")
        
    return comments
