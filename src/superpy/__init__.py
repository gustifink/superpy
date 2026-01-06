"""
SuperPy: High-Performance SNES Emulator Interface for Python

High-performance SNES emulation designed for AI research, reinforcement learning,
and retro-gaming automation.

Example:
    >>> from superpy import SuperPy
    >>> snes = SuperPy("super_mario_world.smc")
    >>> for _ in range(1000):
    ...     frame = snes.step({"B": True, "Right": True})
    >>> print(f"Coins: {snes.memory[0xDBF]}")
"""

from __future__ import annotations

import numpy as np
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from numpy.typing import NDArray

try:
    from ._core import Engine
except ImportError as e:
    raise ImportError(
        "Failed to import SuperPy C++ core. "
        "If installing from source, ensure you have CMake and a C++ compiler. "
        f"Original error: {e}"
    ) from e

__version__ = "0.2.0"
__all__ = ["SuperPy", "AsyncController", "__version__"]


class SuperPy:
    """
    High-performance SNES emulator for Python.
    
    Wraps the Snes9x emulator core with a Pythonic interface optimized
    for AI training and game automation.
    
    Args:
        rom_path: Path to the SNES ROM file (.smc, .sfc, .zip)
        headless: Run without display (default True for speed)
        speed_limit: FPS limit, 0 = unlimited "warp mode" (default 0)
    
    Example:
        >>> snes = SuperPy("mario.smc", headless=True)
        >>> while not snes.done:
        ...     frame = snes.step({"Right": True, "B": True})
        ...     coins = snes.memory[0xDBF]
    """
    
    # SNES button names for reference
    BUTTONS = ("A", "B", "X", "Y", "L", "R", "Up", "Down", "Left", "Right", "Start", "Select")
    
    # Screen dimensions (base - actual may vary by graphics mode)
    SCREEN_WIDTH = 256    # Standard width
    SCREEN_HEIGHT = 224   # Standard height
    MAX_WIDTH = 512       # Hi-res modes (Mode 5/6)
    MAX_HEIGHT = 478      # Interlaced modes
    
    def __init__(
        self, 
        rom_path: str, 
        headless: bool = True,
        speed_limit: int = 0
    ) -> None:
        self._engine = Engine()
        self._headless = headless
        self._speed_limit = speed_limit
        self._frame_count = 0
        
        if not self._engine.load_rom(rom_path):
            raise RuntimeError(f"Failed to load ROM: {rom_path}")
    
    def step(
        self, 
        action: dict[str, bool] | list[bool] | None = None
    ) -> NDArray[np.uint8]:
        """
        Advance emulation by one frame.
        
        Args:
            action: Controller input as either:
                - dict mapping button names to pressed state
                  e.g., {"B": True, "Right": True}
                - list of 12 booleans in BUTTONS order
                - None for no input
        
        Returns:
            The current screen as a numpy array (H x W x 4 RGBA)
        """
        # Convert list to dict if needed
        if isinstance(action, list):
            if len(action) != len(self.BUTTONS):
                raise ValueError(f"Action list must have {len(self.BUTTONS)} elements")
            action = {btn: pressed for btn, pressed in zip(self.BUTTONS, action)}
        
        self._engine.step(action or {})
        self._frame_count += 1
        
        return self.screen
    
    def step_gym(
        self, 
        action: dict[str, bool] | list[bool] | None = None
    ) -> tuple[NDArray[np.uint8], float, bool, bool, dict]:
        """
        Gymnasium-compatible step function.
        
        Returns:
            Tuple of (observation, reward, terminated, truncated, info)
            Note: reward is always 0.0 - use RAM reading for custom rewards
        """
        obs = self.step(action)
        return obs, 0.0, self.done, False, {"frame": self._frame_count}
    def tick(
        self, 
        count: int = 1, 
        render: bool = True,
        action: dict[str, bool] | list[bool] | None = None
    ) -> int:
        """
        Run multiple frames at maximum speed (warp mode).
        
        This is the key method for AI training.
        With render=False, achieves 100x+ real-time (6000+ FPS).
        
        Args:
            count: Number of frames to execute
            render: If False, skip PPU rendering for maximum speed
            action: Controller input to hold during all frames
        
        Returns:
            Number of frames executed
        
        Example:
            >>> # Simulate 1 hour of gameplay in ~36 seconds
            >>> snes.tick(216000, render=False)
            
            >>> # Fast-forward with held buttons
            >>> snes.tick(600, render=False, action={"Right": True, "B": True})
        """
        # Convert list to dict if needed
        if isinstance(action, list):
            if len(action) != len(self.BUTTONS):
                raise ValueError(f"Action list must have {len(self.BUTTONS)} elements")
            action = {btn: pressed for btn, pressed in zip(self.BUTTONS, action)}
        
        self._engine.tick(count, render, action or {})
        self._frame_count += count
        return count
    
    @property
    def screen(self) -> NDArray[np.uint8]:
        """
        Zero-copy view of the SNES screen buffer.
        
        Returns:
            numpy array with RGBA pixel data.
            Shape varies by graphics mode:
            - Standard: (224, 256, 4)
            - Hi-res (Mode 5/6): (224, 512, 4)
            - Interlaced: up to (478, 512, 4)
        """
        return self._engine.screen
    
    @property
    def memory(self) -> NDArray[np.uint8]:
        """
        Direct access to SNES RAM (128KB).
        
        Use this to read game state like health, score, position, etc.
        Memory addresses vary by game - check RAM maps for your game.
        
        Example:
            >>> coins = snes.memory[0xDBF]  # Super Mario World coins
            >>> mario_x = int.from_bytes(snes.memory[0x94:0x96], 'little')
        
        Returns:
            numpy array view of the 128KB RAM
        """
        return self._engine.memory
    
    @property
    def done(self) -> bool:
        """Whether the emulation has ended."""
        return self._engine.done
    
    @property
    def frame_count(self) -> int:
        """Number of frames executed since ROM load."""
        return self._frame_count
    
    def reset(self) -> NDArray[np.uint8]:
        """
        Reset the game to initial state.
        
        Returns:
            The initial screen observation
        """
        self._engine.reset()
        self._frame_count = 0
        return self.screen
    
    def save_state(self) -> bytes:
        """
        Save the complete emulator state.
        
        Returns:
            State data as bytes (can be saved to file or kept in memory)
        
        Example:
            >>> state = snes.save_state()
            >>> # ... do something risky ...
            >>> snes.load_state(state)  # Rewind time!
        """
        return bytes(self._engine.save_state())
    
    def load_state(self, state: bytes) -> None:
        """
        Restore a previously saved state.
        
        Args:
            state: State data from save_state()
        """
        if not self._engine.load_state(list(state)):
            raise RuntimeError("Failed to load state")
    
    def save_screenshot(self, path: str) -> None:
        """
        Save the current screen to an image file.
        
        Requires the 'image' optional dependency (pillow).
        
        Args:
            path: Output file path (e.g., "screenshot.png")
        """
        try:
            from PIL import Image
        except ImportError:
            raise ImportError(
                "Pillow is required for screenshots. "
                "Install with: pip install superpy[image]"
            )
        
        img = Image.fromarray(self.screen, mode="RGBA")
        img.save(path)
    
    def __repr__(self) -> str:
        return f"SuperPy(frame={self._frame_count}, done={self.done})"
    
    # Jupyter notebook integration
    def _repr_png_(self) -> bytes:
        """Render screen in Jupyter notebooks."""
        try:
            from PIL import Image
            import io
            img = Image.fromarray(self.screen, mode="RGBA")
            # Scale up 2x for visibility
            img = img.resize((512, 448), Image.NEAREST)
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            return buf.getvalue()
        except ImportError:
            return None


# Export Gymnasium environment
from .env import SuperPyEnv

# Export async controller
from .async_controller import AsyncController

__all__ = ["SuperPy", "SuperPyEnv", "AsyncController", "__version__"]

# Register with gymnasium
try:
    import gymnasium as gym
    gym.register(
        id="SuperPy-v0",
        entry_point="superpy.env:SuperPyEnv",
    )
except ImportError:
    pass  # gymnasium not installed
