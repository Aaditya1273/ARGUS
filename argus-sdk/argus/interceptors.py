import functools
import inspect
from .client import ArgusClient

def enforce(func):
    """
    Decorator to wrap any AI execution loop or tool call.
    It checks the ARGUS state before and after the execution,
    allowing the Control Plane to Kill, Pause, or Resume the agent.
    """
    if inspect.iscoroutinefunction(func):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            client = ArgusClient()
            client.check_state()  # Pre-execution check
            result = await func(*args, **kwargs)
            client.check_state()  # Post-execution check
            return result
        return async_wrapper
    else:
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            client = ArgusClient()
            client.check_state()  # Pre-execution check
            result = func(*args, **kwargs)
            client.check_state()  # Post-execution check
            return result
        return sync_wrapper
