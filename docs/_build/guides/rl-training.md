# Reinforcement Learning Guide

Train AI agents to play SNES games using SuperPy with popular RL frameworks.

## Quick Start with Stable-Baselines3

```python
from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import SubprocVecEnv
from superpy import SuperPyEnv

# Create environment
env = SuperPyEnv(
    rom_path="super_mario_world.smc",
    reward_address=0xDBF,  # Coins as reward
    frame_skip=4,
)

# Train PPO agent
model = PPO("CnnPolicy", env, verbose=1)
model.learn(total_timesteps=100_000)

# Save trained model
model.save("mario_ppo")
```

## Performance Tips

### 1. Use Warp Speed

```python
# Inside custom environment step()
self.snes.tick(4, render=False)  # 4x faster than step()
```

### 2. Parallel Environments

```python
def make_env(rom_path):
    def _init():
        return SuperPyEnv(rom_path)
    return _init

# 8 parallel environments
envs = SubprocVecEnv([make_env("mario.smc") for _ in range(8)])
model = PPO("CnnPolicy", envs, verbose=1)
```

### 3. Custom Rewards from RAM

```python
class MarioEnv(SuperPyEnv):
    def step(self, action):
        obs, _, terminated, truncated, info = super().step(action)
        
        # Read game state from RAM
        x_pos = int.from_bytes(self._snes.memory[0x94:0x96], 'little')
        coins = int(self._snes.memory[0xDBF])
        
        # Custom reward function
        reward = (x_pos - self.prev_x) * 0.1 + coins * 10
        self.prev_x = x_pos
        
        return obs, reward, terminated, truncated, info
```

## Example: DQN Agent

```python
from stable_baselines3 import DQN

env = SuperPyEnv("mario.smc")
model = DQN(
    "CnnPolicy", 
    env,
    buffer_size=10000,
    learning_starts=1000,
    verbose=1
)
model.learn(total_timesteps=50_000)
```

## Observation Space

The default observation is `224x256x4` RGBA pixels. For CNN policies:

```python
# Grayscale + downscale wrapper
from gymnasium.wrappers import GrayScaleObservation, ResizeObservation

env = SuperPyEnv("mario.smc")
env = GrayScaleObservation(env)
env = ResizeObservation(env, (84, 84))
```

## Action Space

Default: `MultiBinary(12)` — 12 SNES buttons.

For discrete action space:

```python
from gymnasium.wrappers import ActionWrapper

class DiscreteActions(ActionWrapper):
    """Map discrete actions to button combinations."""
    
    ACTIONS = [
        {"Right": True, "B": True},           # Run right
        {"Right": True, "B": True, "A": True}, # Run + jump
        {"Left": True, "B": True},            # Run left
        {},                                     # Idle
    ]
    
    def action(self, action_idx):
        return self.ACTIONS[action_idx]
```
