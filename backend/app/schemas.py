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

    class Config:
        from_attributes = True


class ServerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)


class ServerOut(BaseModel):
    id: str
    name: str
    owner_id: str

    class Config:
        from_attributes = True


class ChannelCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    type: Literal["text", "voice"] = "text"


class ChannelOut(BaseModel):
    id: str
    server_id: str
    name: str
    type: str

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


class VoiceTokenRequest(BaseModel):
    channel_id: str


class VoiceTokenOut(BaseModel):
    token: str
    url: str
    room: str
    identity: str
    name: str
