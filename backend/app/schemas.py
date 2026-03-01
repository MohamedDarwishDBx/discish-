import datetime as dt
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=32)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    username: str
    email: EmailStr
    avatar_url: str | None = None
    bio: str | None = None
    banner_color: str | None = None

    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    username: str | None = Field(None, min_length=2, max_length=32)
    bio: str | None = Field(None, max_length=200)
    banner_color: str | None = Field(None, max_length=7)
    avatar_url: str | None = None


class ServerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)


class ServerUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class ServerOut(BaseModel):
    id: str
    name: str
    owner_id: str

    class Config:
        from_attributes = True


class ChannelCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    type: Literal["text", "voice"] = "text"


class ChannelUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class CategoryOut(BaseModel):
    id: str
    name: str
    position: int

    class Config:
        from_attributes = True


class ChannelOut(BaseModel):
    id: str
    server_id: str | None = None
    name: str
    type: str
    is_dm: bool = False
    category_id: str | None = None

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class MessageCreateWithAttachment(BaseModel):
    content: str = ""
    attachment_url: str | None = None
    attachment_name: str | None = None


class MessageUpdate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class ReactionSummary(BaseModel):
    emoji: str
    count: int
    users: list[str]


class MessageOut(BaseModel):
    id: str
    channel_id: str
    author_id: str
    content: str
    attachment_url: str | None = None
    attachment_name: str | None = None
    created_at: dt.datetime
    edited_at: dt.datetime | None = None
    reactions: list[ReactionSummary] = []

    class Config:
        from_attributes = True


class MemberOut(BaseModel):
    id: str
    username: str
    role: str

    class Config:
        from_attributes = True


class RoleUpdate(BaseModel):
    role: Literal["owner", "admin", "moderator", "member"]


class ReactionCreate(BaseModel):
    emoji: str = Field(min_length=1, max_length=32)


class ReactionOut(BaseModel):
    emoji: str
    count: int
    users: list[str]


class DMChannelCreate(BaseModel):
    recipient_id: str


class DMChannelOut(BaseModel):
    id: str
    recipient: UserOut

    class Config:
        from_attributes = True


class FriendshipOut(BaseModel):
    id: str
    user: UserOut  # the OTHER user
    status: str
    incoming: bool  # true if we are the addressee

    class Config:
        from_attributes = True


class VoiceTokenRequest(BaseModel):
    channel_id: str


class VoiceTokenOut(BaseModel):
    token: str
    url: str
    room: str
    identity: str
    name: str


class TimeoutCreate(BaseModel):
    user_id: str
    duration_minutes: int  # 5, 15, 60, 1440
    reason: str | None = None


class TimeoutOut(BaseModel):
    id: str
    server_id: str
    user_id: str
    username: str
    timed_out_by: str
    reason: str | None
    expires_at: str
    created_at: str
