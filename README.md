# 🎮 SuperPy

**SuperPy** — High-performance Super Nintendo emulation for Python.

[![PyPI version](https://badge.fury.io/py/superpy.svg)](https://pypi.org/project/superpy/)
[![Build](https://github.com/gustifink/superpy/actions/workflows/build.yml/badge.svg)](https://github.com/gustifink/superpy/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

SuperPy wraps the industry-standard **Snes9x** emulator core, letting you control SNES games with Python. Perfect for AI research, reinforcement learning, and retro-gaming automation.

## ✨ Features

- 🚀 **500+ FPS** in warp mode (headless)
- 🧠 **Zero-copy RAM access** — read game state directly as NumPy arrays
- 💾 **Save/Load states** — essential for RL training
- 🎮 **Simple input API** — `{"B": True, "Right": True}`
- 📓 **Jupyter support** — auto-renders screenshots in notebooks
- 🏋️ **Gymnasium compatible** — drop-in for RL frameworks
- 🤖 **Async AI mode** — non-blocking emulation for LLM agents

## ⚡ Performance (Warp Mode)

For AI training, speed is everything. SuperPy's `tick()` method lets you skip rendering for massive speedups:

| Method | Speed | Use Case |
|:-------|:------|:---------|
| `snes.step()` | ~60 FPS | Interactive / debugging |
| `snes.tick(1)` | ~500 FPS | Training with visuals |
| `snes.tick(100, render=False)` | **6000+ FPS** | Pure RL training |

```python
# Simulate 1 hour of gameplay in ~36 seconds
snes.tick(216000, render=False)
```

Run multiple instances in parallel for even faster training!

## 🚀 Quick Start

```bash
pip install superpy
```

```python
from superpy import SuperPy

# Load a ROM
snes = SuperPy("super_mario_world.smc", headless=True)

# Run the game loop
for _ in range(1000):
    # Read game state from RAM
    coins = snes.memory[0xDBF]
    
    # Send controller input
    frame = snes.step({"B": True, "Right": True})

# Save a screenshot
snes.save_screenshot("mario.png")
```

## 🎯 RAM Access (The Matrix Mode)

Read any memory address directly:

```python
# Super Mario World examples
coins = snes.memory[0xDBF]
lives = snes.memory[0xDBE]
mario_x = int.from_bytes(snes.memory[0x94:0x96], 'little')
mario_y = int.from_bytes(snes.memory[0x96:0x98], 'little')
```

## 🕹️ Controller Input

```python
# Dictionary style
snes.step({"A": True, "B": True, "Right": True})

# List style (12 buttons in order)
# A, B, X, Y, L, R, Up, Down, Left, Right, Start, Select
snes.step([True, True, False, False, False, False, False, False, False, True, False, False])
```

## 💾 Save States

```python
# Save current state
state = snes.save_state()

# Try something risky...
for _ in range(100):
    snes.step({"Left": True})

# Rewind time!
snes.load_state(state)
```

## 🏋️ Gymnasium / RL Training

```python
from superpy import SuperPy

snes = SuperPy("game.smc")

# Gymnasium-style API
obs = snes.reset()
for _ in range(10000):
    action = your_agent.predict(obs)
    obs, reward, done, truncated, info = snes.step_gym(action)
    
    # Custom reward from RAM
    reward = snes.memory[0xDBF]  # Use coins as reward
```

## 🤖 Async AI Agent Mode

For LLM-based agents that need time to "think", use `AsyncController` to keep the game running while your AI processes frames:

```python
from superpy import SuperPy, AsyncController
import threading

snes = SuperPy("mario.smc", headless=True)
ctrl = AsyncController(snes)

# Capture frames for AI (runs in emulator thread)
@ctrl.on_frame(interval=10)
def on_frame(frame, ram):
    ai_thread.submit(frame.copy(), ram.copy())

# Your AI queues actions when ready
def on_ai_decision(actions):
    ctrl.queue_action(actions, duration_frames=30)

# Start emulator (non-blocking)
ctrl.start(speed=1.0)  # 1.0 = real-time, 2.0 = 2x, 0 = uncapped

# ... AI runs in separate thread ...

ctrl.stop()
```

See [`examples/async_ai_agent.py`](examples/async_ai_agent.py) for a complete demo.

## 🔧 Development

```bash
git clone --recursive https://github.com/gustifink/superpy
cd superpy
pip install -e ".[dev]"
pytest
```

## 🙏 Acknowledgments

SuperPy is inspired by [PyBoy](https://github.com/Baekalfen/PyBoy), the excellent Game Boy emulator for Python. Thanks to the PyBoy team for pioneering the idea of high-performance emulation APIs optimized for AI research.

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.

SuperPy uses Snes9x, which has its own [licensing terms](https://github.com/snes9xgit/snes9x/blob/master/LICENSE).

---

**Made with ❤️ for the AI and retro-gaming communities**
