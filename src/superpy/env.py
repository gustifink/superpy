"""
SuperPy Gymnasium Environment

Provides a standardized RL interface for SNES games.
"""

from __future__ import annotations

from typing import Any, SupportsFloat

import numpy as np

try:
    import gymnasium as gym
    from gymnasium import spaces
    HAS_GYMNASIUM = True
except ImportError:
    HAS_GYMNASIUM = False


if HAS_GYMNASIUM:
    from . import SuperPy

    class SuperPyEnv(gym.Env):
        """
        Gymnasium environment wrapper for SuperPy.
        
        Provides a standardized RL interface for SNES games with
        configurable frame skipping, reward addresses, and observation modes.
        
        Example:
            >>> import gymnasium as gym
            >>> env = gym.make("SuperPy-v0", rom_path="your_game.smc")
            >>> obs, info = env.reset()
            >>> obs, reward, terminated, truncated, info = env.step(action)
        
        Args:
            rom_path: Path to the SNES ROM file
            render_mode: "rgb_array" for visual obs, None for headless
            frame_skip: Frames to skip per step (default 4)
            reward_address: RAM address to read reward delta from
            max_episode_steps: Maximum steps before truncation
        """
        
        metadata = {"render_modes": ["rgb_array", "human"], "render_fps": 60}
        
        def __init__(
            self,
            rom_path: str,
            render_mode: str | None = None,
            frame_skip: int = 4,
            reward_address: int | None = None,
            max_episode_steps: int = 10000,
        ):
            super().__init__()
            
            self.rom_path = rom_path
            self.render_mode = render_mode
            self.frame_skip = frame_skip
            self.reward_address = reward_address
            self.max_episode_steps = max_episode_steps
            
            self._snes: SuperPy | None = None
            self._step_count = 0
            self._prev_reward_value = 0
            
            # Action space: 12 buttons (can be extended to discrete)
            self.action_space = spaces.MultiBinary(12)
            
            # Observation space: 224x256x4 RGBA screen
            self.observation_space = spaces.Box(
                low=0, high=255,
                shape=(224, 256, 4),
                dtype=np.uint8
            )
        
        def reset(
            self, *, seed: int | None = None, options: dict | None = None
        ) -> tuple[np.ndarray, dict]:
            super().reset(seed=seed)
            
            self._snes = SuperPy(self.rom_path, headless=True)
            self._step_count = 0
            self._prev_reward_value = 0
            
            # Skip intro screens (common for SNES games)
            for _ in range(300):
                self._snes.step({"Start": True})
            for _ in range(60):
                self._snes.step({})
            
            return self._snes.screen.copy(), {"frame": self._snes.frame_count}
        
        def step(
            self, action: np.ndarray
        ) -> tuple[np.ndarray, SupportsFloat, bool, bool, dict[str, Any]]:
            if self._snes is None:
                raise RuntimeError("Environment not reset. Call reset() first.")
            
            # Convert action array to button dict
            buttons = dict(zip(SuperPy.BUTTONS, action.astype(bool)))
            
            # Frame skip with tick for speed
            for _ in range(self.frame_skip):
                self._snes.step(buttons)
            
            self._step_count += 1
            
            # Compute reward from RAM (if configured)
            reward = 0.0
            if self.reward_address is not None:
                curr = int(self._snes.memory[self.reward_address])
                reward = float(curr - self._prev_reward_value)
                self._prev_reward_value = curr
            
            terminated = self._snes.done
            truncated = self._step_count >= self.max_episode_steps
            
            return (
                self._snes.screen.copy(),
                reward,
                terminated,
                truncated,
                {"frame": self._snes.frame_count, "step": self._step_count}
            )
        
        def render(self) -> np.ndarray | None:
            if self.render_mode == "rgb_array" and self._snes:
                return self._snes.screen[:, :, :3]  # RGB only
            return None
        
        def close(self):
            self._snes = None
else:
    # Stub class when gymnasium is not installed
    class SuperPyEnv:
        def __init__(self, *args, **kwargs):
            raise ImportError(
                "gymnasium is required for SuperPyEnv. "
                "Install with: pip install superpy[gym]"
            )
