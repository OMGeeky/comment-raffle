from pydantic import BaseModel
from typing import List, Optional

class Comment(BaseModel):
    id: str
    author: str
    author_avatar: Optional[str] = None
    text: str
    likes: int
    published_at: str
    platform: str  # 'youtube', 'instagram', 'tiktok', 'manual'

class FetchCommentsRequest(BaseModel):
    platform: str  # 'youtube', 'instagram', 'tiktok', 'manual'
    url: Optional[str] = None
    api_key: Optional[str] = None
    access_token: Optional[str] = None
    demo_mode: bool = False
    manual_comments: Optional[str] = None  # Raw string to be parsed on backend or frontend

class FetchCommentsResponse(BaseModel):
    comments: List[Comment]
    success: bool
    error: Optional[str] = None
