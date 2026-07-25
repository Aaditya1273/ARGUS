"""Enterprise WebSocket transport layer.

Features:
- Secure authentication (API key, JWT token)
- Automatic reconnection with exponential backoff
- Protocol version negotiation
- Ping/pong keepalive
- Connection health monitoring
- Graceful shutdown
"""

from __future__ import annotations

import json
import logging
import random
import threading
import time
from enum import Enum
from typing import Optional, Callable, Dict, Any, List
from dataclasses import dataclass

import websocket

from ._version import PROTOCOL_VERSION, MIN_SUPPORTED_PROTOCOL
from .config import RetryConfig

logger = logging.getLogger(__name__)


class ConnectionState(Enum):
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    RECONNECTING = "reconnecting"
    DISCONNECTING = "disconnecting"
    CLOSED = "closed"


@dataclass
class ConnectionInfo:
    """Current connection information."""
    state: ConnectionState = ConnectionState.DISCONNECTED
    endpoint: str = ""
    agent_id: str = ""
    protocol_version: str = PROTOCOL_VERSION
    server_version: str = ""
    connected_at: Optional[float] = None
    reconnect_count: int = 0
    last_error: Optional[str] = None
    rtt_ms: Optional[float] = None


class TransportError(Exception):
    """Base transport error."""
    pass


class AuthenticationError(TransportError):
    """Authentication failure."""
    pass


class ProtocolMismatchError(TransportError):
    """Protocol version mismatch."""
    pass


class ConnectionTimeoutError(TransportError):
    """Connection timeout."""
    pass


class EnterpriseTransport:
    """Enterprise-grade WebSocket transport with auth, reconnect, and health monitoring."""

    def __init__(
        self,
        endpoint: str,
        agent_id: str,
        api_key: Optional[str] = None,
        auth_token: Optional[str] = None,
        retry_config: Optional[RetryConfig] = None,
        connect_timeout: float = 10.0,
        ping_interval: float = 30.0,
        ping_timeout: float = 10.0,
        max_message_size: int = 4 * 1024 * 1024,
    ):
        self.endpoint = endpoint
        self.agent_id = agent_id
        self.api_key = api_key
        self.auth_token = auth_token
        self.retry_config = retry_config or RetryConfig()
        self.connect_timeout = connect_timeout
        self.ping_interval = ping_interval
        self.ping_timeout = ping_timeout
        self.max_message_size = max_message_size

        self._ws: Optional[websocket.WebSocketApp] = None
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._should_reconnect = True

        self.info = ConnectionInfo(
            endpoint=endpoint,
            agent_id=agent_id,
        )

        # Callbacks
        self.on_connected: List[Callable] = []
        self.on_disconnected: List[Callable] = []
        self.on_reconnecting: List[Callable] = []
        self.on_message: List[Callable[[Dict[str, Any]], None]] = []
        self.on_error: List[Callable[[Exception], None]] = []

    def _build_url(self) -> str:
        """Build WebSocket URL with authentication parameters."""
        import urllib.parse

        params = {
            "agent_id": self.agent_id,
            "protocol_version": PROTOCOL_VERSION,
        }
        if self.api_key:
            params["api_key"] = self.api_key
        if self.auth_token:
            params["auth_token"] = self.auth_token

        query = urllib.parse.urlencode(params)
        base = self.endpoint.rstrip("/")
        return f"{base}/api/v1/argus/agent-ws?{query}"

    def _calculate_backoff(self, attempt: int) -> float:
        """Calculate exponential backoff with jitter."""
        cfg = self.retry_config
        backoff = min(
            cfg.initial_backoff * (cfg.backoff_multiplier ** attempt),
            cfg.max_backoff,
        )
        jitter = backoff * cfg.jitter * random.uniform(-1, 1)
        return max(0.1, backoff + jitter)

    def connect(self) -> None:
        """Establish connection to the control plane."""
        if self.info.state == ConnectionState.CONNECTED:
            logger.debug("Already connected, skipping")
            return

        self._stop_event.clear()
        self._should_reconnect = True

        def _run():
            attempt = 0
            while self._should_reconnect and not self._stop_event.is_set():
                attempt += 1
                self.info.state = ConnectionState.CONNECTING
                self.info.reconnect_count = attempt - 1

                url = self._build_url()
                logger.info(
                    "Connecting to ARGUS control plane",
                    extra={
                        "endpoint": self.endpoint,
                        "agent_id": self.agent_id,
                        "attempt": attempt,
                    },
                )

                self._ws = websocket.WebSocketApp(
                    url,
                    header=self._build_headers(),
                    on_open=self._on_open,
                    on_message=self._on_message,
                    on_error=self._on_error,
                    on_close=self._on_close,
                    on_ping=self._on_ping,
                    on_pong=self._on_pong,
                )

                # Run connection with timeout
                self._ws.run_forever(
                    ping_interval=self.ping_interval,
                    ping_timeout=self.ping_timeout,
                    skip_utf8_validation=False,
                )

                if self._should_reconnect and not self._stop_event.is_set():
                    backoff = self._calculate_backoff(attempt)
                    logger.info(
                        f"Reconnecting in {backoff:.1f}s (attempt {attempt})",
                        extra={
                            "backoff": backoff,
                            "attempt": attempt,
                            "max_retries": self.retry_config.max_retries,
                        },
                    )

                    # Notify reconnecting
                    for cb in self.on_reconnecting:
                        try:
                            cb()
                        except Exception:
                            pass

                    self._stop_event.wait(backoff)

        self._thread = threading.Thread(target=_run, daemon=True, name="argus-ws")
        self._thread.start()

    def _build_headers(self) -> Dict[str, str]:
        """Build HTTP headers for authentication."""
        headers = {
            "X-Argus-Agent-ID": self.agent_id,
            "X-Argus-Protocol-Version": PROTOCOL_VERSION,
        }
        if self.api_key:
            headers["X-Argus-API-Key"] = self.api_key
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
        return headers

    @staticmethod
    def _parse_version(v: str) -> tuple:
        """Parse a version string into a comparable tuple."""
        parts = []
        for segment in v.split("."):
            try:
                parts.append(int(segment))
            except ValueError:
                parts.append(0)
        return tuple(parts)

    def _negotiate_protocol(self, server_version: Optional[str]) -> bool:
        """Negotiate protocol version with the server."""
        if server_version is None:
            return True  # Version check not supported

        # Check if server version is compatible
        server_parts = self._parse_version(server_version)
        min_parts = self._parse_version(MIN_SUPPORTED_PROTOCOL)

        # Compare versions
        if server_parts < min_parts:
            raise ProtocolMismatchError(
                f"Server protocol {server_version} is below minimum supported {MIN_SUPPORTED_PROTOCOL}"
            )

        self.info.server_version = server_version
        return True

    def _on_open(self, ws: websocket.WebSocketApp) -> None:
        """Handle WebSocket connection opened."""
        with self._lock:
            self.info.state = ConnectionState.CONNECTED
            self.info.connected_at = time.time()
            self.info.last_error = None

        logger.info(
            "Connected to ARGUS control plane",
            extra={
                "agent_id": self.agent_id,
                "endpoint": self.endpoint,
            },
        )

        # Send authentication handshake
        self.send({
            "type": "handshake",
            "protocol_version": PROTOCOL_VERSION,
            "agent_id": self.agent_id,
        })

        for cb in self.on_connected:
            try:
                cb()
            except Exception as e:
                logger.warning(f"Connected callback failed: {e}")

    def _on_message(self, ws: websocket.WebSocketApp, message: str) -> None:
        """Handle incoming WebSocket message."""
        try:
            data = json.loads(message)

            # Handle handshake response
            if data.get("type") == "handshake_ack":
                try:
                    self._negotiate_protocol(data.get("protocol_version"))
                except ProtocolMismatchError as e:
                    logger.error(f"Protocol negotiation failed: {e}")
                    self.disconnect()
                return

            # Handle protocol error
            if data.get("type") == "protocol_error":
                raise ProtocolMismatchError(data.get("message", "Protocol error"))

            # Dispatch to registered callbacks
            for cb in self.on_message:
                try:
                    cb(data)
                except Exception as e:
                    logger.warning(f"Message callback failed: {e}")

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse message: {e}")
        except ProtocolMismatchError as e:
            logger.error(f"Protocol mismatch: {e}")
            self.disconnect()

    def _on_error(self, ws: websocket.WebSocketApp, error: Exception) -> None:
        """Handle WebSocket error."""
        with self._lock:
            self.info.last_error = str(error)

        logger.error(f"WebSocket error: {error}")

        for cb in self.on_error:
            try:
                cb(error)
            except Exception:
                pass

    def _on_close(self, ws: websocket.WebSocketApp, close_status_code: int, close_msg: str) -> None:
        """Handle WebSocket connection closed."""
        with self._lock:
            self.info.state = ConnectionState.DISCONNECTED
            self.info.connected_at = None

        logger.info(
            "WebSocket connection closed",
            extra={
                "code": close_status_code,
                "message": close_msg,
            },
        )

        for cb in self.on_disconnected:
            try:
                cb()
            except Exception:
                pass

    def _on_ping(self, ws: websocket.WebSocketApp, data: bytes) -> None:
        """Handle WebSocket ping."""
        pass  # websocket-client handles pong automatically

    def _on_pong(self, ws: websocket.WebSocketApp, data: bytes) -> None:
        """Handle WebSocket pong."""
        # RTT would be tracked by storing ping send timestamps.
        # websocket-client auto-handles ping/pong, so this is a no-op.

    def send(self, data: Dict[str, Any]) -> bool:
        """Send a JSON message through the transport."""
        if self.info.state != ConnectionState.CONNECTED:
            logger.debug("Cannot send, not connected")
            return False

        try:
            message = json.dumps(data)
            self._ws.send(message)
            return True
        except Exception as e:
            logger.error(f"Failed to send message: {e}")
            return False

    def send_raw(self, data: str) -> bool:
        """Send a raw string message."""
        if self.info.state != ConnectionState.CONNECTED:
            return False
        try:
            self._ws.send(data)
            return True
        except Exception as e:
            logger.error(f"Failed to send raw message: {e}")
            return False

    def disconnect(self) -> None:
        """Gracefully disconnect from the control plane."""
        self._should_reconnect = False
        self._stop_event.set()

        if self._ws:
            try:
                self.info.state = ConnectionState.DISCONNECTING
                self._ws.close()
            except Exception as e:
                logger.debug(f"Error during close: {e}")

        self.info.state = ConnectionState.CLOSED

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)

    def wait_connected(self, timeout: Optional[float] = None) -> bool:
        """Wait until connected or timeout."""
        start = time.time()
        while self.info.state != ConnectionState.CONNECTED:
            if timeout and (time.time() - start) > timeout:
                return False
            time.sleep(0.1)
        return True

    @property
    def is_connected(self) -> bool:
        """Check if currently connected."""
        return self.info.state == ConnectionState.CONNECTED

    @property
    def is_closed(self) -> bool:
        """Check if transport is permanently closed."""
        return self.info.state == ConnectionState.CLOSED
