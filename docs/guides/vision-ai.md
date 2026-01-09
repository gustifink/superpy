# Vision AI Guide

Use SuperPy with large language models (LLMs) for vision-based game playing.

## Overview

Modern vision-language models like **Gemini 3 Flash**, **Claude 4**, and **GPT-4o** can analyze game screenshots and decide actions in real-time. This guide shows how to integrate SuperPy with these models.

## Quick Start: Gemini 3 Flash

```python
from superpy import SuperPy
from PIL import Image
import google.generativeai as genai
import json
import io

# Configure Gemini
genai.configure(api_key="YOUR_API_KEY")
model = genai.GenerativeModel("gemini-3-flash")

# Load game
snes = SuperPy("your_game.smc")  # Your legally obtained ROM

# Skip title screen
for _ in range(300):
    snes.step({"Start": True})
for _ in range(60):
    snes.step({})

# Game loop
while True:
    # Get screenshot
    img = Image.fromarray(snes.screen)
    
    # Ask AI what to do
    prompt = """
    You are playing a SNES game. Analyze the screenshot and decide 
    what buttons to press.
    
    Available: Up, Down, Left, Right, A (jump), B (run), X, Y, L, R, Start
    
    Respond with JSON: {"buttons": ["Right", "B"], "reasoning": "..."}
    """
    
    response = model.generate_content([prompt, img])
    
    # Parse response
    try:
        data = json.loads(response.text)
        buttons = {b: True for b in data["buttons"]}
    except:
        buttons = {"Right": True, "B": True}  # Fallback
    
    # Execute action for multiple frames
    snes.tick(6, action=buttons)
```

## Using OpenRouter (Multi-Model)

Access Claude, GPT-4o, Gemini through a single API:

```python
import os
import httpx
import base64
from PIL import Image
from superpy import SuperPy

OPENROUTER_KEY = os.environ.get("OPENROUTER_API_KEY", "")

async def query_ai(screenshot_b64: str, model: str) -> dict:
    """Query vision model for button decisions."""
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {OPENROUTER_KEY}"},
            json={
                "model": model,  # e.g., "google/gemini-3-flash-preview"
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{screenshot_b64}"}},
                        {"type": "text", "text": "What buttons should I press? Reply as JSON."}
                    ]
                }]
            }
        )
        return resp.json()

# Convert screen to base64
def screen_to_b64(snes: SuperPy) -> str:
    img = Image.fromarray(snes.screen)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()
```

## Chain of Thought (CoT)

Enable reasoning transparency with CoT-capable models:

```python
prompt = """
Think step by step:
1. What do you see on screen? (enemies, obstacles, platforms)
2. Where is Mario currently?
3. What is the best action to take?
4. What buttons achieve that action?

Then respond with JSON: {"buttons": [...], "reasoning": "..."}
"""

# Models with good CoT support:
# - google/gemini-3-flash-preview (excellent)
# - anthropic/claude-sonnet-4 (excellent)
# - openai/gpt-4o (good)
```

## Performance Tips

### 1. Frame Batching

AI inference is slow (~500ms). Run multiple game frames per decision:

```python
# Good: 6-10 frames per AI call
snes.tick(8, action=buttons)

# Bad: 1 frame per AI call (too slow)
snes.step(buttons)
```

### 2. Image Scaling

Smaller images = faster inference:

```python
from PIL import Image

# Scale 2x for better AI recognition, but not too large
img = Image.fromarray(snes.screen)
img = img.resize((512, 448), Image.NEAREST)
```

### 3. Async Inference

Run AI inference while game continues:

```python
import asyncio

async def ai_game_loop(snes):
    pending_action = {"Right": True, "B": True}
    
    while True:
        # Start AI inference in background
        ai_task = asyncio.create_task(query_ai(screen_to_b64(snes)))
        
        # Run frames while waiting
        for _ in range(10):
            snes.tick(1, action=pending_action)
            await asyncio.sleep(0)  # Yield
        
        # Get AI result
        result = await ai_task
        pending_action = parse_buttons(result)
```

## Web Demo

Check out the SuperPy AI Player demo for a complete working example:

```bash
cd demo
python server.py
# Open http://localhost:8080
```

Features:

- Real-time WebSocket streaming
- Model selection (Gemini 3, Claude, GPT-4o)
- Chain of thought display
- Stop/Reset controls
