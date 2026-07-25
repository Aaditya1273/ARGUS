import json
import threading
import logging
import time
import websocket

logger = logging.getLogger(__name__)

class ArgusTerminatedException(Exception):
    """Raised when the ARGUS Control Plane forcibly kills the agent execution."""
    pass

class ArgusClient:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(ArgusClient, cls).__new__(cls)
        return cls._instance

    def __init__(self, endpoint="ws://localhost:8080", agent_id="default-agent"):
        if hasattr(self, "_initialized") and self._initialized:
            return
        
        self.endpoint = endpoint
        self.agent_id = agent_id
        self.state = "RUNNING"
        self.ws = None
        self._thread = None
        self._initialized = True
        
        # Connect to control plane
        self._connect()

    def _connect(self):
        def run(*args):
            ws_url = f"{self.endpoint}/api/v1/argus/agent-ws?agent_id={self.agent_id}"
            
            def on_message(ws, message):
                try:
                    data = json.loads(message)
                    command = data.get("command")
                    logger.info(f"[ARGUS Control Plane] Received command: {command}")
                    if command == "KILL":
                        self.state = "DEAD"
                    elif command == "PAUSE":
                        self.state = "PAUSED"
                    elif command == "RESUME":
                        self.state = "RUNNING"
                except Exception as e:
                    logger.error(f"Error parsing ARGUS control message: {e}")

            def on_error(ws, error):
                logger.debug(f"ARGUS WebSocket error: {error}")

            def on_close(ws, close_status_code, close_msg):
                logger.debug("ARGUS WebSocket closed. Reconnecting in 5s...")
                time.sleep(5)
                self._connect()

            def on_open(ws):
                logger.info(f"Connected to ARGUS Control Plane as {self.agent_id}")

            self.ws = websocket.WebSocketApp(ws_url,
                                             on_open=on_open,
                                             on_message=on_message,
                                             on_error=on_error,
                                             on_close=on_close)
            self.ws.run_forever()

        self._thread = threading.Thread(target=run, daemon=True)
        self._thread.start()

    def check_state(self):
        """
        Called before/after operations to enforce runtime state.
        Raises ArgusTerminatedException if Killed.
        Blocks (sleeps) if Paused.
        """
        if self.state == "DEAD":
            raise ArgusTerminatedException("ARGUS Control Plane has forcefully terminated this execution.")
        
        while self.state == "PAUSED":
            logger.info("ARGUS execution PAUSED. Waiting for resume signal...")
            time.sleep(1)

        return True
