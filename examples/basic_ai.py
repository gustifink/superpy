#!/usr/bin/env python3
"""
SuperPy Example: Basic AI Agent

Minimal example showing how to use SuperPy with a simple AI.
The agent runs right and jumps periodically.

Usage:
    python basic_ai.py path/to/super_mario_world.smc
"""

import argparse
from superpy import SuperPy


def main():
    parser = argparse.ArgumentParser(description="Basic AI for Super Mario World")
    parser.add_argument("rom", help="Path to ROM file")
    parser.add_argument("--frames", type=int, default=3000, help="Frames to run")
    args = parser.parse_args()
    
    print(f"Loading {args.rom}...")
    snes = SuperPy(args.rom)
    
    # Skip title screen
    for _ in range(300):
        snes.step({"Start": True})
    for _ in range(60):
        snes.step({})
    
    print("Playing...")
    jump_timer = 0
    
    for frame in range(args.frames):
        # Simple strategy: run right, jump every 60 frames
        buttons = {"Right": True, "B": True}
        
        if jump_timer > 0:
            buttons["A"] = True
            jump_timer -= 1
        elif frame % 60 == 0:
            jump_timer = 15  # Hold jump for 15 frames
        
        snes.step(buttons)
        
        # Read game state
        x_pos = int.from_bytes(snes.memory[0x94:0x96], 'little')
        coins = int(snes.memory[0xDBF])
        
        if frame % 300 == 0:
            print(f"Frame {frame}: x={x_pos}, coins={coins}")
    
    print(f"\nFinal position: x={x_pos}")
    print(f"Coins collected: {coins}")


if __name__ == "__main__":
    main()
