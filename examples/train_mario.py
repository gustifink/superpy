#!/usr/bin/env python3
"""
SuperPy Demo: Train a Simple AI

This demonstrates how to use SuperPy for reinforcement learning.
The AI learns to maximize rightward progress using RAM reading.

Usage:
    python train_mario.py path/to/your_game.smc
"""

import argparse
import random
from typing import NamedTuple

import numpy as np


class GameState(NamedTuple):
    """Parsed game state from SNES RAM."""
    x: int
    y: int
    coins: int
    lives: int
    powerup: int
    on_ground: bool
    dying: bool


def read_game_state(memory: np.ndarray) -> GameState:
    """Parse Super Mario World RAM into a structured state."""
    return GameState(
        x=int.from_bytes(memory[0x94:0x96], 'little'),
        y=int.from_bytes(memory[0x96:0x98], 'little'),
        coins=int(memory[0xDBF]),
        lives=int(memory[0xDBE]),
        powerup=int(memory[0x19]),
        on_ground=bool(memory[0x13EF]),
        dying=bool(memory[0x71]),
    )


def compute_reward(prev_state: GameState, curr_state: GameState) -> float:
    """Compute reward based on game state changes."""
    reward = 0.0
    
    # Reward for moving right
    x_delta = curr_state.x - prev_state.x
    reward += x_delta * 0.1
    
    # Reward for collecting coins
    if curr_state.coins > prev_state.coins:
        reward += 10.0
    
    # Penalty for dying
    if curr_state.dying:
        reward -= 100.0
    
    # Reward for powerups
    if curr_state.powerup > prev_state.powerup:
        reward += 50.0
    
    return reward


class SimpleAgent:
    """A simple agent that learns to run right and jump obstacles."""
    
    def __init__(self):
        # Action probabilities: [run_right, jump, run_right+jump]
        self.action_weights = [1.0, 1.0, 1.0]
        self.actions = [
            {"Right": True, "B": True},                    # Run right
            {"Right": True, "B": True, "A": True},         # Run right + jump
            {"Right": True, "B": True, "X": True},         # Run right + spin jump
        ]
    
    def choose_action(self, state: GameState) -> dict:
        """Choose an action based on current state."""
        # Simple heuristic: jump more when not on ground
        if not state.on_ground:
            # Already in air, just hold direction
            return {"Right": True, "B": True}
        
        # Weighted random selection
        total = sum(self.action_weights)
        r = random.random() * total
        cumulative = 0
        for i, w in enumerate(self.action_weights):
            cumulative += w
            if r <= cumulative:
                return self.actions[i]
        return self.actions[0]
    
    def update(self, reward: float, action_idx: int):
        """Update action weights based on reward."""
        # Simple weight update
        self.action_weights[action_idx] += reward * 0.01
        self.action_weights[action_idx] = max(0.1, self.action_weights[action_idx])


def main():
    parser = argparse.ArgumentParser(description="Train a simple AI on Super Mario World")
    parser.add_argument("rom", help="Path to Super Mario World ROM")
    parser.add_argument("--episodes", type=int, default=10, help="Number of episodes")
    parser.add_argument("--frames", type=int, default=3000, help="Max frames per episode")
    parser.add_argument("--headless", action="store_true", default=True, help="Run headless")
    args = parser.parse_args()

    # Import here so CLI help works without the library
    from superpy import SuperPy

    print("🎮 SuperPy Mario Training Demo")
    print("=" * 40)
    
    agent = SimpleAgent()
    best_x = 0
    
    for episode in range(args.episodes):
        snes = SuperPy(args.rom, headless=args.headless)
        
        # Skip intro screens (press start a few times)
        for _ in range(300):
            snes.step({"Start": True})
        for _ in range(60):
            snes.step({})
            
        prev_state = read_game_state(snes.memory)
        episode_reward = 0.0
        max_x = 0
        
        for frame in range(args.frames):
            action = agent.choose_action(prev_state)
            snes.step(action)
            
            curr_state = read_game_state(snes.memory)
            reward = compute_reward(prev_state, curr_state)
            episode_reward += reward
            max_x = max(max_x, curr_state.x)
            
            if curr_state.dying:
                break
            
            prev_state = curr_state
            
            if frame % 500 == 0:
                print(f"  Frame {frame}: x={curr_state.x}, coins={curr_state.coins}")
        
        best_x = max(best_x, max_x)
        print(f"Episode {episode + 1}: reward={episode_reward:.1f}, max_x={max_x}, best_x={best_x}")

    print("\n✨ Training complete!")
    print(f"Best distance: {best_x} pixels")


if __name__ == "__main__":
    main()
