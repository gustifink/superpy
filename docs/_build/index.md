# SuperPy Documentation

**SuperPy** — High-performance SNES emulation for AI research.

## 🚀 Quick Start

```python
from superpy import SuperPy

snes = SuperPy("super_mario_world.smc")

# Run at 60 FPS
for _ in range(1000):
    snes.step({"Right": True, "B": True})

# WARP SPEED: 6000+ FPS
snes.tick(216000, render=False)  # 1 hour of gameplay in ~36 seconds
```

## 📚 Quick Links

| Guide | Description |
|-------|-------------|
| [API Reference](superpy.html) | Full API documentation |
| [RL Training Guide](guides/rl-training.html) | Train agents with PPO/DQN |
| [RAM Maps](guides/ram-maps.html) | Memory addresses for popular games |
| [Vision AI](guides/vision-ai.html) | Use with Gemini/Claude/GPT-4o |

## ⚡ Performance

| Method | Speed | Use Case |
|--------|-------|----------|
| `step()` | ~60 FPS | Interactive |
| `tick(1)` | ~1,800 FPS | Training with visuals |
| `tick(n, render=False)` | **3,400+ FPS** | Pure RL training |

## 🔧 Installation

```bash
pip install superpy

# With Gymnasium support
pip install superpy[gym]

# All extras
pip install superpy[all]
```
