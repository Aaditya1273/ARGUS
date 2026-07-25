"""Agent state management with pause/resume/kill support."""

from __future__ import annotations

import logging
import threading
import time
from enum import Enum
from typing import Optional

logger = logging.getLogger(__name__)


class AgentStatus(Enum):
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    BLOCKED = "BLOCKED"
    DEAD = "DEAD"


class StateError(Exception):
    """Base state management error."""
    pass


class TerminatedException(StateError):
    """Raised when the agent has been forcefully terminated."""
    pass


class PausedException(StateError):
    """Raised when the agent is paused and an operation was attempted."""
    pass


class AgentStateMachine:
    """Thread-safe state machine for agent lifecycle management.

    States: RUNNING -> PAUSED -> RUNNING
            RUNNING -> DEAD (terminal)
            RUNNING -> BLOCKED -> RUNNING
            PAUSED -> DEAD (terminal)
    """

    def __init__(self, initial_status: AgentStatus = AgentStatus.RUNNING):
        self._status = initial_status
        self._lock = threading.RLock()
        self._pause_event = threading.Event()
        self._pause_event.set()  # Not paused initially
        self._termination_reason: Optional[str] = None
        self._status_changed = threading.Event()

    @property
    def status(self) -> AgentStatus:
        with self._lock:
            return self._status

    @property
    def is_running(self) -> bool:
        return self.status == AgentStatus.RUNNING

    @property
    def is_paused(self) -> bool:
        return self.status == AgentStatus.PAUSED

    @property
    def is_dead(self) -> bool:
        return self.status == AgentStatus.DEAD

    @property
    def is_blocked(self) -> bool:
        return self.status == AgentStatus.BLOCKED

    @property
    def termination_reason(self) -> Optional[str]:
        with self._lock:
            return self._termination_reason

    def pause(self, reason: str = "User requested pause") -> None:
        """Transition to PAUSED state."""
        with self._lock:
            if self._status == AgentStatus.DEAD:
                raise StateError("Cannot pause a terminated agent")
            self._status = AgentStatus.PAUSED
            self._pause_event.clear()
            self._status_changed.set()
            logger.info(f"Agent paused: {reason}")

    def resume(self) -> None:
        """Transition from PAUSED back to RUNNING."""
        with self._lock:
            if self._status != AgentStatus.PAUSED:
                raise StateError(f"Cannot resume agent in {self._status.value} state")
            self._status = AgentStatus.RUNNING
            self._pause_event.set()
            self._status_changed.set()
            logger.info("Agent resumed")

    def kill(self, reason: str = "Forcefully terminated by control plane") -> None:
        """Transition to DEAD (terminal) state."""
        with self._lock:
            self._status = AgentStatus.DEAD
            self._termination_reason = reason
            self._pause_event.set()  # Release any paused waiters
            self._status_changed.set()
            logger.warning(f"Agent killed: {reason}")

    def block(self, reason: str = "Execution blocked by policy") -> None:
        """Transition to BLOCKED state."""
        with self._lock:
            if self._status == AgentStatus.DEAD:
                raise StateError("Cannot block a terminated agent")
            self._status = AgentStatus.BLOCKED
            self._pause_event.clear()
            self._status_changed.set()
            logger.warning(f"Agent blocked: {reason}")

    def unblock(self) -> None:
        """Transition from BLOCKED back to RUNNING."""
        with self._lock:
            if self._status != AgentStatus.BLOCKED:
                raise StateError(f"Cannot unblock agent in {self._status.value} state")
            self._status = AgentStatus.RUNNING
            self._pause_event.set()
            self._status_changed.set()
            logger.info("Agent unblocked")

    def check_runnable(self) -> None:
        """Check if the agent can execute. Raises TerminatedException if dead,
        blocks if paused/blocked."""
        while True:
            with self._lock:
                status = self._status
                if status == AgentStatus.DEAD:
                    raise TerminatedException(
                        self._termination_reason or "Agent was terminated"
                    )
                if status == AgentStatus.RUNNING:
                    return
                # PAUSED or BLOCKED — will wait below
                event = self._pause_event

            # Wait outside lock to avoid deadlock
            event.wait(timeout=1.0)

    def wait_for_status(self, target: AgentStatus, timeout: Optional[float] = None) -> bool:
        """Wait until the agent reaches a specific status."""
        deadline = time.time() + timeout if timeout else float("inf")
        while time.time() < deadline:
            if self.status == target:
                return True
            self._status_changed.wait(timeout=0.5)
            self._status_changed.clear()
        return False
