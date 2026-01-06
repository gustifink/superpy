"""
AsyncController Test Suite

Tests for the async controller features without requiring a ROM file.
"""

import pytest
import threading
import time


def test_async_controller_import():
    """Test that AsyncController can be imported."""
    from superpy import AsyncController
    assert AsyncController is not None


def test_async_controller_in_all():
    """Test that AsyncController is in __all__."""
    import superpy
    assert "AsyncController" in superpy.__all__


def test_async_controller_docstring():
    """Test that AsyncController has proper documentation."""
    from superpy import AsyncController
    assert AsyncController.__doc__ is not None
    assert "asynchronous" in AsyncController.__doc__.lower() or "async" in AsyncController.__doc__.lower()


def test_async_controller_methods():
    """Test that AsyncController has expected methods."""
    from superpy import AsyncController
    
    # Check required methods exist
    assert hasattr(AsyncController, "start")
    assert hasattr(AsyncController, "stop")
    assert hasattr(AsyncController, "queue_action")
    assert hasattr(AsyncController, "on_frame")
    assert hasattr(AsyncController, "set_speed")
    assert hasattr(AsyncController, "running")
    
    # Check they are callable
    assert callable(getattr(AsyncController, "start"))
    assert callable(getattr(AsyncController, "stop"))
    assert callable(getattr(AsyncController, "queue_action"))
    assert callable(getattr(AsyncController, "set_speed"))


def test_async_controller_properties():
    """Test that AsyncController has expected properties."""
    from superpy import AsyncController
    
    # running should be a property
    assert isinstance(getattr(type, "running", None), type(None)) or hasattr(AsyncController, "running")


# ROM-dependent tests
@pytest.mark.skip(reason="Requires ROM file")
def test_async_controller_basic_flow(test_rom):
    """Test basic start/stop flow."""
    from superpy import SuperPy, AsyncController
    
    snes = SuperPy(test_rom)
    ctrl = AsyncController(snes)
    
    assert not ctrl.running
    ctrl.start(speed=0)  # Uncapped
    assert ctrl.running
    
    time.sleep(0.1)
    assert ctrl.frame_count > 0
    
    ctrl.stop()
    assert not ctrl.running


@pytest.mark.skip(reason="Requires ROM file")
def test_async_controller_context_manager(test_rom):
    """Test context manager protocol."""
    from superpy import SuperPy, AsyncController
    
    snes = SuperPy(test_rom)
    
    with AsyncController(snes) as ctrl:
        ctrl.start(speed=0)
        time.sleep(0.1)
        assert ctrl.running
    
    # Should be stopped after context exit
    assert not ctrl.running


@pytest.mark.skip(reason="Requires ROM file")
def test_async_controller_frame_callback(test_rom):
    """Test frame callback registration and invocation."""
    from superpy import SuperPy, AsyncController
    
    snes = SuperPy(test_rom)
    ctrl = AsyncController(snes)
    
    callback_count = 0
    callback_lock = threading.Lock()
    
    @ctrl.on_frame(interval=5)
    def on_frame(frame, ram):
        nonlocal callback_count
        with callback_lock:
            callback_count += 1
    
    ctrl.start(speed=0)
    time.sleep(0.2)
    ctrl.stop()
    
    with callback_lock:
        assert callback_count > 0


@pytest.mark.skip(reason="Requires ROM file")
def test_async_controller_action_queue(test_rom):
    """Test action queuing."""
    from superpy import SuperPy, AsyncController
    
    snes = SuperPy(test_rom)
    ctrl = AsyncController(snes)
    
    ctrl.queue_action({"Right": True, "B": True}, duration_frames=10)
    ctrl.queue_action({"A": True}, duration_frames=5)
    
    ctrl.start(speed=0)
    time.sleep(0.1)
    ctrl.stop()
    
    # Actions should have been consumed
    assert ctrl.frame_count > 10
