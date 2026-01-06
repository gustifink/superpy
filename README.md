# 🎮 SuperPy

**SuperPy** — High-performance Super Nintendo emulation for Python.

[![PyPI version](https://badge.fury.io/py/superpy.svg)](https://pypi.org/project/superpy/)
[![Build](https://github.com/superpy/superpy/actions/workflows/build.yml/badge.svg)](https://github.com/superpy/superpy/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

SuperPy wraps the industry-standard **Snes9x** emulator core, letting you control SNES games with Python. Perfect for AI research, reinforcement learning, and retro-gaming automation.

## ✨ Features

- �� **500+ FPS** in warp mode (headless)
- 🧠 **Zero-copy RAM access** — read game state directly as NumPy arrays
- 💾 **Save/Load states** — essential for RL training
- 🎮 **Simple input API** — `{"B": True, "Right": True}`
- 📓 **Jupyter support** — auto-renders screenshots in notebooks
- 🏋️ **Gymnasium compatible** — drop-in for RL frameworks


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

## 📊 RAM Maps

Check out our community-maintained RAM maps for popular games:
- [Super Mario World](ram_maps/super_mario_world.json)
- [The Legend of Zelda: A Link to the Past](ram_maps/zelda_alttp.json)
- [Super Metroid](ram_maps/super_metroid.json)

**Contribute your own!** RAM maps are a great first contribution.

## 🔧 Development

```bash
git clone --recursive https://github.com/superpy/superpy
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
