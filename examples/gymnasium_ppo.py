#!/usr/bin/env python3
"""
SuperPy Example: Train a PPO Agent

This example shows how to train a PPO agent using Stable-Baselines3.
The agent learns to maximize rightward progress using score as reward.

Requirements:
    pip install superpy[gym] stable-baselines3 shimmy

Usage:
    python gymnasium_ppo.py path/to/your_game.smc
"""

import argparse
import numpy as np

# Check dependencies
try:
    from stable_baselines3 import PPO
    from stable_baselines3.common.vec_env import DummyVecEnv, SubprocVecEnv
    from stable_baselines3.common.callbacks import EvalCallback
except ImportError:
    print("Please install: pip install stable-baselines3")
    exit(1)

try:
    import gymnasium as gym
    from gymnasium import spaces
    from gymnasium.wrappers import GrayScaleObservation, ResizeObservation, FrameStack
except ImportError:
    print("Please install: pip install gymnasium")
    exit(1)

from superpy import SuperPy


class SNESEnv(gym.Env):
    """
    Custom SNES environment with progress-based rewards.
    
    Rewards:
        - +0.1 per pixel moved right
        - +10 per coin collected
        - -50 for dying
    """
    
    metadata = {"render_modes": ["rgb_array"]}
    
    # Discrete action space for stability
    ACTIONS = [
        {},                                      # 0: Idle
        {"Right": True},                         # 1: Walk right
        {"Right": True, "B": True},              # 2: Run right
        {"Right": True, "A": True},              # 3: Jump right
        {"Right": True, "B": True, "A": True},   # 4: Run + jump right
        {"Left": True},                          # 5: Walk left
        {"A": True},                             # 6: Jump
    ]
    
    def __init__(self, rom_path: str, frame_skip: int = 4):
        super().__init__()
        self.rom_path = rom_path
        self.frame_skip = frame_skip
        self._snes = None
        
        # Discrete actions for stable training
        self.action_space = spaces.Discrete(len(self.ACTIONS))
        
        # Grayscale 84x84 observation (standard for Atari-style RL)
        self.observation_space = spaces.Box(
            low=0, high=255, shape=(84, 84, 1), dtype=np.uint8
        )
        
        self._prev_x = 0
        self._prev_coins = 0
        self._step_count = 0
        self._max_steps = 4500  # ~5 minutes at 60fps / 4 frame skip
    
    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        
        self._snes = SuperPy(self.rom_path, headless=True)
        
        # Skip title screen
        for _ in range(300):
            self._snes.step({"Start": True})
        for _ in range(60):
            self._snes.step({})
        
        self._prev_x = self._read_x()
        self._prev_coins = self._read_coins()
        self._step_count = 0
        
        return self._get_obs(), {}
    
    def step(self, action):
        buttons = self.ACTIONS[action]
        
        # Frame skip with tick for speed
        for _ in range(self.frame_skip):
            self._snes.step(buttons)
        
        self._step_count += 1
        
        # Read game state
        curr_x = self._read_x()
        curr_coins = self._read_coins()
        dying = self._snes.memory[0x71] != 0
        
        # Compute reward
        reward = 0.0
        reward += (curr_x - self._prev_x) * 0.1  # Progress reward
        reward += (curr_coins - self._prev_coins) * 10  # Coin reward
        if dying:
            reward -= 50
        
        self._prev_x = curr_x
        self._prev_coins = curr_coins
        
        terminated = dying
        truncated = self._step_count >= self._max_steps
        
        return self._get_obs(), reward, terminated, truncated, {
            "x_pos": curr_x,
            "coins": curr_coins,
        }
    
    def _get_obs(self):
        """Get 84x84 grayscale observation."""
        from PIL import Image
        
        screen = self._snes.screen[:, :, :3]  # RGB
        img = Image.fromarray(screen)
        img = img.convert("L")  # Grayscale
        img = img.resize((84, 84), Image.BILINEAR)
        return np.array(img)[:, :, np.newaxis]
    
    def _read_x(self):
        return int.from_bytes(self._snes.memory[0x94:0x96], 'little')
    
    def _read_coins(self):
        return int(self._snes.memory[0xDBF])
    
    def render(self):
        return self._snes.screen[:, :, :3]


def make_env(rom_path: str):
    """Factory function for creating environments."""
    def _init():
        env = SNESEnv(rom_path)
        env = FrameStack(env, num_stack=4)  # Stack 4 frames for temporal info
        return env
    return _init


def main():
    parser = argparse.ArgumentParser(description="Train PPO on an SNES game")
    parser.add_argument("rom", help="Path to SNES game ROM")
    parser.add_argument("--timesteps", type=int, default=100_000, help="Total training timesteps")
    parser.add_argument("--envs", type=int, default=4, help="Number of parallel environments")
    parser.add_argument("--save", default="snes_ppo", help="Model save path")
    args = parser.parse_args()
    
    print("🎮 SuperPy PPO Training")
    print("=" * 50)
    print(f"ROM: {args.rom}")
    print(f"Timesteps: {args.timesteps:,}")
    print(f"Parallel Envs: {args.envs}")
    print()
    
    # Create vectorized environment
    if args.envs > 1:
        env = SubprocVecEnv([make_env(args.rom) for _ in range(args.envs)])
    else:
        env = DummyVecEnv([make_env(args.rom)])
    
    # Create PPO model
    model = PPO(
        "CnnPolicy",
        env,
        verbose=1,
        learning_rate=2.5e-4,
        n_steps=128,
        batch_size=256,
        n_epochs=4,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.1,
        ent_coef=0.01,
        tensorboard_log="./logs/",
    )
    
    print("Training...")
    model.learn(total_timesteps=args.timesteps)
    
    # Save model
    model.save(args.save)
    print(f"\n✅ Model saved to {args.save}.zip")
    
    # Quick evaluation
    print("\nEvaluating trained agent...")
    eval_env = DummyVecEnv([make_env(args.rom)])
    obs = eval_env.reset()
    total_reward = 0
    for _ in range(1000):
        action, _ = model.predict(obs, deterministic=True)
        obs, reward, done, info = eval_env.step(action)
        total_reward += reward[0]
        if done[0]:
            break
    
    print(f"Evaluation reward: {total_reward:.1f}")
    print(f"Final X position: {info[0].get('x_pos', 0)}")


if __name__ == "__main__":
    main()
