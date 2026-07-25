"""Enterprise configuration management for the ARGUS SDK.

Supports configuration via:
- Environment variables (ARGUS_* prefix)
- YAML/JSON config files
- Programmatic configuration
- Dynamic updates with validation
"""

from __future__ import annotations

import os
import json
import threading
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from pathlib import Path


@dataclass
class RetryConfig:
    """Retry strategy configuration."""
    max_retries: int = 5
    initial_backoff: float = 1.0
    max_backoff: float = 60.0
    backoff_multiplier: float = 2.0
    jitter: float = 0.1
    retry_on_timeout: bool = True
    retry_on_connection_error: bool = True
    retry_on_rate_limit: bool = True


@dataclass
class WebSocketConfig:
    """WebSocket transport configuration."""
    endpoint: str = "ws://localhost:8080"
    connect_timeout: float = 10.0
    read_timeout: float = 30.0
    write_timeout: float = 10.0
    ping_interval: float = 30.0
    ping_timeout: float = 10.0
    max_message_size: int = 4 * 1024 * 1024  # 4MB
    agent_id: str = "default-agent"
    api_key: Optional[str] = None
    auth_token: Optional[str] = None


@dataclass
class TelemetryConfig:
    """OpenTelemetry configuration."""
    service_name: str = "argus-agent"
    otlp_endpoint: str = "http://localhost:4317"
    otlp_headers: Dict[str, str] = field(default_factory=dict)
    insecure: bool = True
    sample_rate: float = 1.0
    export_interval_ms: int = 5000
    export_timeout_ms: int = 30000
    max_export_batch_size: int = 512
    enabled: bool = True
    resource_attributes: Dict[str, str] = field(default_factory=dict)


@dataclass
class BatchingConfig:
    """Event batching configuration."""
    max_batch_size: int = 100
    flush_interval_ms: float = 1000.0
    max_queue_size: int = 10000
    flush_on_shutdown: bool = True


@dataclass
class SDKConfig:
    """Top-level SDK configuration."""
    websocket: WebSocketConfig = field(default_factory=WebSocketConfig)
    telemetry: TelemetryConfig = field(default_factory=TelemetryConfig)
    retry: RetryConfig = field(default_factory=RetryConfig)
    batching: BatchingConfig = field(default_factory=BatchingConfig)
    debug: bool = False
    budget_limit: float = 0.0
    auto_reconnect: bool = True
    auto_instrument: bool = True

    @classmethod
    def from_env(cls) -> "SDKConfig":
        """Create configuration from environment variables."""
        config = cls()

        # WebSocket
        config.websocket.endpoint = os.environ.get(
            "ARGUS_WS_ENDPOINT", config.websocket.endpoint
        )
        config.websocket.agent_id = os.environ.get(
            "ARGUS_AGENT_ID", config.websocket.agent_id
        )
        config.websocket.api_key = os.environ.get("ARGUS_API_KEY")
        config.websocket.auth_token = os.environ.get("ARGUS_AUTH_TOKEN")

        # Telemetry
        config.telemetry.service_name = os.environ.get(
            "ARGUS_SERVICE_NAME", config.telemetry.service_name
        )
        config.telemetry.otlp_endpoint = os.environ.get(
            "ARGUS_OTLP_ENDPOINT", config.telemetry.otlp_endpoint
        )
        config.telemetry.sample_rate = float(
            os.environ.get("ARGUS_SAMPLE_RATE", str(config.telemetry.sample_rate))
        )

        # Budget
        config.budget_limit = float(
            os.environ.get("ARGUS_BUDGET_LIMIT", str(config.budget_limit))
        )
        config.debug = os.environ.get("ARGUS_DEBUG", "false").lower() == "true"

        return config

    @classmethod
    def from_file(cls, path: str) -> "SDKConfig":
        """Load configuration from a JSON or YAML file."""
        p = Path(path)
        if not p.exists():
            raise FileNotFoundError(f"Config file not found: {path}")

        raw = p.read_text()
        if p.suffix in (".json",):
            data = json.loads(raw)
        elif p.suffix in (".yaml", ".yml"):
            try:
                import yaml
                data = yaml.safe_load(raw)
            except ImportError:
                raise ImportError("PyYAML is required to load YAML config files")
        else:
            raise ValueError(f"Unsupported config file format: {p.suffix}")

        return cls.from_dict(data)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SDKConfig":
        """Create configuration from a dictionary."""
        config = cls()
        if "websocket" in data:
            for k, v in data["websocket"].items():
                if hasattr(config.websocket, k):
                    setattr(config.websocket, k, v)
        if "telemetry" in data:
            for k, v in data["telemetry"].items():
                if hasattr(config.telemetry, k):
                    setattr(config.telemetry, k, v)
        if "retry" in data:
            for k, v in data["retry"].items():
                if hasattr(config.retry, k):
                    setattr(config.retry, k, v)
        if "batching" in data:
            for k, v in data["batching"].items():
                if hasattr(config.batching, k):
                    setattr(config.batching, k, v)
        config.budget_limit = data.get("budget_limit", config.budget_limit)
        config.debug = data.get("debug", config.debug)
        config.auto_reconnect = data.get("auto_reconnect", config.auto_reconnect)
        return config

    def validate(self) -> None:
        """Validate configuration values."""
        if self.websocket.connect_timeout <= 0:
            raise ValueError("connect_timeout must be positive")
        if self.retry.max_retries < 0:
            raise ValueError("max_retries cannot be negative")
        if not 0 < self.telemetry.sample_rate <= 1.0:
            raise ValueError("sample_rate must be in (0, 1]")
        if self.budget_limit < 0:
            raise ValueError("budget_limit cannot be negative")


# Global configuration singleton with thread safety
_config_lock = threading.Lock()
_global_config: Optional[SDKConfig] = None


def get_config() -> SDKConfig:
    """Get the global SDK configuration."""
    global _global_config
    if _global_config is None:
        with _config_lock:
            if _global_config is None:  # Double-checked locking
                _global_config = SDKConfig.from_env()
    return _global_config


def set_config(config: SDKConfig) -> None:
    """Set the global SDK configuration."""
    global _global_config
    config.validate()
    with _config_lock:
        _global_config = config
