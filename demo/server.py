"""
SuperPy AI Player Demo
A web-based SNES emulator controlled by an AI model (Gemini 3 Flash).
"""

import asyncio
import base64
import io
import json
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
import httpx
import numpy as np
from PIL import Image

# Import SuperPy
import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
from superpy._core import Engine

app = FastAPI(title="SuperPy AI Player")

# Global state
engine: Engine = None
running = False
active_websockets = set()


def buttons_to_dict(buttons: list[str]) -> dict[str, bool]:
    """Convert list of button names to dict for step() API."""
    return {btn: True for btn in buttons}


def get_screen_image() -> str:
    """Get current screen as base64 PNG."""
    global engine
    if engine is None:
        return ""
    
    try:
        screen = engine.screen
        if screen is None:
            return ""
        
        arr = np.array(screen, dtype=np.uint8)
        if arr.size == 0:
            return ""
        
        try:
            arr = arr.reshape((224, 256, 4))
        except ValueError as e:
            print(f"Screen reshape error: {e}")
            return ""
        
        img = Image.fromarray(arr, mode='RGBA')
        img = img.resize((512, 448), Image.NEAREST)
        
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        return base64.b64encode(buffer.getvalue()).decode('utf-8')
    except Exception as e:
        print(f"Screen capture error: {e}")
        return ""


async def query_ai(screenshot_b64: str, game_state: dict, api_key: str, model: str) -> dict:
    """Ask AI model what buttons to press. Returns buttons, reasoning, and full response."""
    
    if not api_key or len(api_key) < 10:
        return {
            "buttons": ["Right"],
            "reasoning": "No API key provided",
            "thinking": None
        }
    
    prompt = """You are playing a SNES game. Analyze the screenshot and decide what buttons to press.

Current Game State:
- Player X position: {x_pos}
- Coins collected: {coins}
- Lives remaining: {lives}

Available SNES buttons: Up, Down, Left, Right, A (jump), B (run/spin), X, Y, L, R, Start, Select

Your goal is to progress through the level. Common strategies:
- Hold Right + B to run right
- Press A to jump over obstacles and enemies
- Time your jumps carefully

Think step by step about what you see and what action to take.

Respond with ONLY a JSON object:
{{"buttons": ["Right", "B"], "reasoning": "Brief explanation of your decision"}}"""

    messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{screenshot_b64}"}
                },
                {"type": "text", "text": prompt.format(**game_state)}
            ]
        }
    ]
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": messages,
                    "max_tokens": 300
                }
            )
            resp.raise_for_status()
            data = resp.json()
            
            content = data["choices"][0]["message"]["content"]
            
            # Extract thinking/reasoning from full response
            full_response = content
            
            # Parse JSON from response
            start, end = content.find('{'), content.rfind('}') + 1
            if start >= 0 and end > start:
                parsed = json.loads(content[start:end])
                return {
                    "buttons": parsed.get("buttons", ["Right"]),
                    "reasoning": parsed.get("reasoning", ""),
                    "thinking": full_response  # Full chain of thought
                }
            
            return {
                "buttons": ["Right"],
                "reasoning": "Parse error",
                "thinking": full_response
            }
        except Exception as e:
            print(f"AI error: {e}")
            return {
                "buttons": ["Right"],
                "reasoning": str(e)[:50],
                "thinking": None
            }


def get_game_state() -> dict:
    """Read game state from RAM."""
    global engine
    if engine is None:
        return {"x_pos": 0, "coins": 0, "lives": 0}
    
    try:
        mem = np.array(engine.memory, dtype=np.uint8)
        return {
            "x_pos": int(mem[0x94]) + int(mem[0x95]) * 256,
            "coins": int(mem[0x0DBF]),
            "lives": int(mem[0x0DBE])
        }
    except:
        return {"x_pos": 0, "coins": 0, "lives": 0}


def reset_engine():
    """Reset and reinitialize the engine."""
    global engine, running
    running = False
    engine = None


@app.get("/")
async def index():
    return FileResponse(Path(__file__).parent / "index.html")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    global engine, running, active_websockets
    
    await websocket.accept()
    active_websockets.add(websocket)
    
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            
            if action == "load":
                # Reset previous state
                running = False
                
                rom = data.get("rom", "your_game.sfc")
                rom_path = Path(__file__).parent.parent / rom
                
                print(f"Loading ROM: {rom_path}")
                
                engine = Engine()
                success = engine.load_rom(str(rom_path))
                
                print(f"ROM loaded: {success}")
                
                if success:
                    # Auto-skip title screen
                    for i in range(10):
                        engine.step({"Start": True})
                        for _ in range(30):
                            engine.step({})
                    
                    screen = get_screen_image()
                    print(f"Screen b64 length: {len(screen)}")
                    
                    await websocket.send_json({
                        "type": "loaded",
                        "success": True
                    })
                    await websocket.send_json({
                        "type": "frame",
                        "screen": screen,
                        "state": get_game_state()
                    })
                else:
                    await websocket.send_json({
                        "type": "loaded",
                        "success": False,
                        "error": "ROM load failed"
                    })
            
            elif action == "step":
                if engine is None:
                    continue
                
                buttons = data.get("buttons", [])
                btn_dict = buttons_to_dict(buttons)
                
                for _ in range(2):
                    engine.step(btn_dict)
                
                await websocket.send_json({
                    "type": "frame",
                    "screen": get_screen_image(),
                    "state": get_game_state()
                })
            
            elif action == "ai_step":
                if engine is None:
                    continue
                
                api_key = data.get("api_key", "")
                model = data.get("model", "google/gemini-3-flash-preview")
                
                screen = get_screen_image()
                state = get_game_state()
                
                ai_resp = await query_ai(screen, state, api_key, model)
                buttons = ai_resp.get("buttons", ["Right"])
                btn_dict = buttons_to_dict(buttons)
                
                for _ in range(6):
                    engine.step(btn_dict)
                
                await websocket.send_json({
                    "type": "ai_frame",
                    "screen": get_screen_image(),
                    "state": get_game_state(),
                    "buttons": buttons,
                    "reasoning": ai_resp.get("reasoning", ""),
                    "thinking": ai_resp.get("thinking")  # Full chain of thought
                })
            
            elif action == "run_ai":
                if engine is None:
                    continue
                
                running = True
                api_key = data.get("api_key", "")
                model = data.get("model", "google/gemini-3-flash-preview")
                
                print(f"Starting AI loop with model: {model}")
                
                while running:
                    screen = get_screen_image()
                    state = get_game_state()
                    
                    ai_resp = await query_ai(screen, state, api_key, model)
                    buttons = ai_resp.get("buttons", ["Right"])
                    btn_dict = buttons_to_dict(buttons)
                    
                    # Run frames with the chosen buttons
                    for _ in range(8):
                        if engine and running:
                            engine.step(btn_dict)
                    
                    if not running:
                        break
                    
                    await websocket.send_json({
                        "type": "ai_frame",
                        "screen": get_screen_image(),
                        "state": get_game_state(),
                        "buttons": buttons,
                        "reasoning": ai_resp.get("reasoning", ""),
                        "thinking": ai_resp.get("thinking")
                    })
                    
                    # Check for stop command (non-blocking)
                    try:
                        msg = await asyncio.wait_for(
                            websocket.receive_json(), timeout=0.05
                        )
                        if msg.get("action") == "stop":
                            print("Stop command received")
                            running = False
                            break
                    except asyncio.TimeoutError:
                        pass
                
                print("AI loop stopped")
                await websocket.send_json({"type": "stopped"})
            
            elif action == "stop":
                print("Stop action received")
                running = False
                await websocket.send_json({"type": "stopped"})
            
            elif action == "reset":
                running = False
                if engine:
                    engine.reset()
                    for i in range(10):
                        engine.step({"Start": True})
                        for _ in range(30):
                            engine.step({})
                    await websocket.send_json({
                        "type": "frame",
                        "screen": get_screen_image(),
                        "state": get_game_state()
                    })
            
            elif action == "disconnect":
                # Clean disconnect from client
                print("Client disconnecting cleanly")
                running = False
                break
    
    except WebSocketDisconnect:
        print("Client disconnected")
        running = False
    except Exception as e:
        print(f"WebSocket error: {e}")
        running = False
    finally:
        active_websockets.discard(websocket)
        if len(active_websockets) == 0:
            # No more clients, reset engine
            print("No active clients, resetting engine")
            reset_engine()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
