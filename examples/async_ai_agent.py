#!/usr/bin/env python3
"""
SuperPy Example: Async AI Agent

Demonstrates how to use AsyncController for non-blocking AI integration.
The emulator runs continuously while an "AI" processes frames in a separate thread.

Usage:
    python async_ai_agent.py path/to/super_mario_world.smc
"""

import argparse
import threading
import time
import random

from superpy import SuperPy, AsyncController


def main():
    parser = argparse.ArgumentParser(
        description="Async AI agent demo for SuperPy"
    )
    parser.add_argument("rom", help="Path to ROM file")
    parser.add_argument(
        "--duration", type=float, default=30.0, 
        help="Duration in seconds (default: 30)"
    )
    parser.add_argument(
        "--speed", type=float, default=1.0,
        help="Emulation speed (1.0 = real-time, 2.0 = 2x, 0 = uncapped)"
    )
    args = parser.parse_args()
    
    print(f"Loading {args.rom}...")
    snes = SuperPy(args.rom, headless=True)
    
    # Skip title screen
    print("Skipping title screen...")
    for _ in range(300):
        snes.step({"Start": True})
    for _ in range(60):
        snes.step({})
    
    # Create async controller
    ctrl = AsyncController(snes)
    
    # Shared state for AI thread
    latest_frame = None
    latest_ram = None
    frame_lock = threading.Lock()
    ai_decisions = 0
    
    @ctrl.on_frame(interval=10)
    def capture_frame(frame, ram):
        """Capture frames for AI processing (runs every 10 frames)."""
        nonlocal latest_frame, latest_ram
        with frame_lock:
            latest_frame = frame.copy()
            latest_ram = ram.copy()
    
    def ai_loop():
        """Simulated AI loop - processes frames and queues actions."""
        nonlocal ai_decisions
        
        while ctrl.running:
            # Check for available frame
            with frame_lock:
                frame = latest_frame
                ram = latest_ram
            
            if frame is None:
                time.sleep(0.1)
                continue
            
            # Simulate AI "thinking" (replace with actual LLM call)
            # In real usage: actions = call_llm(frame)
            think_time = random.uniform(0.5, 2.0)  # Simulated 0.5-2s inference
            time.sleep(think_time)
            
            # Simulated AI decision (random but reasonable)
            actions = {
                "Right": True,
                "B": random.random() > 0.3,  # Run most of the time
                "A": random.random() > 0.7,  # Jump sometimes
            }
            
            # Queue action for 30 frames (0.5 seconds at 60fps)
            if ctrl.running:
                ctrl.queue_action(actions, duration_frames=30)
                ai_decisions += 1
                
                # Read game state from RAM
                x_pos = int.from_bytes(ram[0x94:0x96], 'little')
                coins = int(ram[0xDBF])
                print(
                    f"  AI Decision #{ai_decisions}: "
                    f"x={x_pos}, coins={coins}, "
                    f"actions={actions}"
                )
    
    # Start emulator FIRST (so ctrl.running is True for AI thread)
    print(f"\nStarting emulator at {args.speed}x speed...")
    print(f"Running for {args.duration} seconds...\n")
    ctrl.start(speed=args.speed)
    
    # Now start AI thread
    ai_thread = threading.Thread(target=ai_loop, daemon=True)
    ai_thread.start()
    
    # Let it run for specified duration
    start_time = time.time()
    try:
        while time.time() - start_time < args.duration:
            time.sleep(1.0)
            elapsed = time.time() - start_time
            fps = ctrl.frame_count / elapsed if elapsed > 0 else 0
            print(
                f"  Status: {ctrl.frame_count} frames, "
                f"{fps:.1f} FPS, "
                f"{ai_decisions} AI decisions"
            )
    except KeyboardInterrupt:
        print("\nInterrupted by user")
    
    # Stop gracefully
    ctrl.stop()
    
    # Final stats
    total_time = time.time() - start_time
    print(f"\n{'='*50}")
    print(f"Final Statistics:")
    print(f"  Total frames: {ctrl.frame_count}")
    print(f"  Total time: {total_time:.1f}s")
    print(f"  Average FPS: {ctrl.frame_count / total_time:.1f}")
    print(f"  AI decisions made: {ai_decisions}")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()
