import datetime as dt
import uuid

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    memberships: Mapped[list["ServerMembership"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    messages: Mapped[list["Message"]] = relationship(back_populates="author")


class Server(Base):
    __tablename__ = "servers"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(80), index=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    channels: Mapped[list["Channel"]] = relationship(
        back_populates="server", cascade="all, delete-orphan"
    )
    memberships: Mapped[list["ServerMembership"]] = relationship(
        back_populates="server", cascade="all, delete-orphan"
    )


class ServerMembership(Base):
    __tablename__ = "server_memberships"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id"), primary_key=True
    )
    server_id: Mapped[str] = mapped_column(
        ForeignKey("servers.id"), primary_key=True
    )
    role: Mapped[str] = mapped_column(String(20), default="member")
    joined_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="memberships")
    server: Mapped["Server"] = relationship(back_populates="memberships")


class Channel(Base):
    __tablename__ = "channels"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    server_id: Mapped[str] = mapped_column(ForeignKey("servers.id"), index=True)
    name: Mapped[str] = mapped_column(String(80))
    type: Mapped[str] = mapped_column(String(20), default="text")
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    server: Mapped["Server"] = relationship(back_populates="channels")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="channel", cascade="all, delete-orphan"
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    channel_id: Mapped[str] = mapped_column(ForeignKey("channels.id"), index=True)
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    channel: Mapped["Channel"] = relationship(back_populates="messages")
    author: Mapped["User"] = relationship(back_populates="messages")
