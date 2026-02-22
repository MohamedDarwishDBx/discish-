from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, channel_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active[channel_id].add(websocket)

    def disconnect(self, channel_id: str, websocket: WebSocket) -> None:
        if channel_id in self.active:
            self.active[channel_id].discard(websocket)
            if not self.active[channel_id]:
                self.active.pop(channel_id, None)

    async def broadcast(self, channel_id: str, payload: dict) -> None:
        for websocket in list(self.active.get(channel_id, [])):
            try:
                await websocket.send_json(payload)
            except Exception:
                self.disconnect(channel_id, websocket)

    async def broadcast_except(
        self, channel_id: str, payload: dict, exclude: WebSocket
    ) -> None:
        for websocket in list(self.active.get(channel_id, [])):
            if websocket is exclude:
                continue
            try:
                await websocket.send_json(payload)
            except Exception:
                self.disconnect(channel_id, websocket)
