"""
SuperPy Async Controller

Provides non-blocking emulator control for AI agent integration.
The emulator runs in a background thread while AI processes frames asynchronously.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from typing import TYPE_CHECKING, Callable, Any

import numpy as np

if TYPE_CHECKING:
    from . import SuperPy
    from numpy.typing import NDArray


class AsyncController:
    """
    Asynchronous controller for SuperPy emulator.
    
    Runs the emulator in a background thread, allowing AI agents to
    process frames without blocking game execution.
    
    Example:
        >>> from superpy import SuperPy, AsyncController
        >>> snes = SuperPy("your_game.sfc", headless=True)
        >>> ctrl = AsyncController(snes)
        >>> 
        >>> @ctrl.on_frame(interval=10)
        ... def on_new_frame(frame, ram):
        ...     # Send to AI asynchronously
        ...     ai_thread.submit(frame, ram)
        >>> 
        >>> ctrl.start(speed=1.0)  # Run at real-time
        >>> # ... AI queues actions via ctrl.queue_action(...)
        >>> ctrl.stop()
    
    Args:
        superpy: The SuperPy emulator instance to control
    """
    
    def __init__(self, superpy: "SuperPy") -> None:
        self._snes = superpy
        self._thread: threading.Thread | None = None
        self._running = False
        self._stop_event = threading.Event()
        
        # Speed control: frames per second target (0 = uncapped)
        self._target_fps = 60.0
        self._speed = 1.0
        self._speed_lock = threading.Lock()
        
        # Thread-safe action queue: (buttons_dict, remaining_frames)
        self._action_queue: deque[tuple[dict[str, bool], int]] = deque()
        self._action_lock = threading.Lock()
        self._current_action: dict[str, bool] = {}
        self._action_frames_left = 0
        
        # Frame callbacks: list of (callback, interval, frame_counter)
        self._callbacks: list[tuple[Callable[[NDArray, NDArray], Any], int, int]] = []
        self._callback_lock = threading.Lock()
        
        # Stats
        self._frame_count = 0
        self._stats_lock = threading.Lock()
    
    @property
    def running(self) -> bool:
        """Whether the emulator loop is currently running."""
        return self._running
    
    @property
    def frame_count(self) -> int:
        """Number of frames executed since start()."""
        with self._stats_lock:
            return self._frame_count
    
    def start(self, speed: float = 1.0) -> None:
        """
        Start the emulator loop in a background thread.
        
        Args:
            speed: Emulation speed multiplier.
                   1.0 = real-time (60 FPS)
                   2.0 = double speed (120 FPS)
                   0 = uncapped (maximum speed)
        
        Raises:
            RuntimeError: If already running
        """
        if self._running:
            raise RuntimeError("AsyncController is already running")
        
        self._speed = speed
        self._target_fps = 60.0 * speed if speed > 0 else 0
        self._stop_event.clear()
        self._running = True
        self._frame_count = 0
        
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
    
    def stop(self) -> None:
        """
        Stop the emulator loop and wait for the thread to finish.
        """
        if not self._running:
            return
        
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=2.0)
        self._running = False
        self._thread = None
    
    def set_speed(self, speed: float) -> None:
        """
        Dynamically change the emulation speed.
        
        Args:
            speed: Speed multiplier (1.0 = real-time, 0 = uncapped)
        """
        with self._speed_lock:
            self._speed = speed
            self._target_fps = 60.0 * speed if speed > 0 else 0
    
    def queue_action(
        self, 
        buttons: dict[str, bool], 
        duration_frames: int = 1
    ) -> None:
        """
        Queue an action to be applied on subsequent frames.
        
        Actions are consumed by the emulator loop. Multiple actions
        can be queued and will be processed in order.
        
        Args:
            buttons: Dictionary of button states (e.g., {"B": True, "Right": True})
            duration_frames: Number of frames to hold this action
        
        Example:
            >>> ctrl.queue_action({"B": True, "Right": True}, duration_frames=30)
            >>> # Mario will run right and jump for 30 frames
        """
        with self._action_lock:
            self._action_queue.append((buttons.copy(), duration_frames))
    
    def clear_actions(self) -> None:
        """Clear all queued actions."""
        with self._action_lock:
            self._action_queue.clear()
            self._current_action = {}
            self._action_frames_left = 0
    
    def on_frame(
        self, 
        interval: int = 1
    ) -> Callable[[Callable[[NDArray, NDArray], Any]], Callable[[NDArray, NDArray], Any]]:
        """
        Decorator to register a frame callback.
        
        The callback receives the current frame and RAM on every Nth frame.
        Callbacks run in the emulator thread, so they should be fast
        (just copy data for async processing).
        
        Args:
            interval: Call the callback every N frames (default: every frame)
        
        Returns:
            Decorator function
        
        Example:
            >>> @ctrl.on_frame(interval=10)
            ... def on_new_frame(frame, ram):
            ...     # Runs every 10 frames
            ...     latest_frame = frame.copy()
        """
        def decorator(func: Callable[[NDArray, NDArray], Any]) -> Callable[[NDArray, NDArray], Any]:
            with self._callback_lock:
                # Store (callback, interval, counter)
                self._callbacks.append((func, interval, 0))
            return func
        return decorator
    
    def add_frame_callback(
        self, 
        callback: Callable[[NDArray, NDArray], Any], 
        interval: int = 1
    ) -> None:
        """
        Register a frame callback (non-decorator version).
        
        Args:
            callback: Function to call with (frame, ram)
            interval: Call every N frames
        """
        with self._callback_lock:
            self._callbacks.append((callback, interval, 0))
    
    def remove_frame_callback(
        self, 
        callback: Callable[[NDArray, NDArray], Any]
    ) -> None:
        """Remove a previously registered callback."""
        with self._callback_lock:
            self._callbacks = [
                (cb, interval, counter) 
                for cb, interval, counter in self._callbacks 
                if cb is not callback
            ]
    
    def _get_current_action(self) -> dict[str, bool]:
        """Get the current action, consuming from queue if needed."""
        with self._action_lock:
            # Check if current action expired
            if self._action_frames_left <= 0:
                # Try to get next action from queue
                if self._action_queue:
                    self._current_action, self._action_frames_left = self._action_queue.popleft()
                else:
                    self._current_action = {}
                    self._action_frames_left = 0
            
            # Decrement remaining frames
            if self._action_frames_left > 0:
                self._action_frames_left -= 1
            
            return self._current_action.copy()
    
    def _run_callbacks(self) -> None:
        """Run frame callbacks that are due."""
        frame = self._snes.screen
        ram = self._snes.memory
        
        with self._callback_lock:
            updated_callbacks = []
            for callback, interval, counter in self._callbacks:
                counter += 1
                if counter >= interval:
                    try:
                        callback(frame, ram)
                    except Exception as e:
                        # Log but don't crash the loop
                        print(f"Frame callback error: {e}")
                    counter = 0
                updated_callbacks.append((callback, interval, counter))
            self._callbacks = updated_callbacks
    
    def _run_loop(self) -> None:
        """Main emulator loop running in background thread."""
        frame_time = 1.0 / 60.0  # Base frame time
        
        while not self._stop_event.is_set():
            loop_start = time.perf_counter()
            
            # Get current action
            action = self._get_current_action()
            
            # Step the emulator
            self._snes.step(action)
            
            # Update stats
            with self._stats_lock:
                self._frame_count += 1
            
            # Run callbacks
            self._run_callbacks()
            
            # Speed control
            with self._speed_lock:
                target_fps = self._target_fps
            
            if target_fps > 0:
                # Calculate sleep time to maintain target FPS
                elapsed = time.perf_counter() - loop_start
                target_frame_time = 1.0 / target_fps
                sleep_time = target_frame_time - elapsed
                
                if sleep_time > 0:
                    time.sleep(sleep_time)
    
    def __enter__(self) -> "AsyncController":
        """Context manager entry."""
        return self
    
    def __exit__(self, *args) -> None:
        """Context manager exit - ensures stop is called."""
        self.stop()
    
    def __repr__(self) -> str:
        status = "running" if self._running else "stopped"
        return f"AsyncController({status}, frames={self.frame_count}, speed={self._speed})"
