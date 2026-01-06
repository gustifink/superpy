"""
SuperPy Test Suite

These tests verify the library loads and exports the expected API.
Full emulation tests require a ROM file.
"""

import pytest


def test_import():
    """Test that SuperPy can be imported."""
    from superpy import SuperPy, __version__
    assert __version__ == "0.2.0"


def test_buttons_defined():
    """Test that button constants are defined."""
    from superpy import SuperPy
    assert len(SuperPy.BUTTONS) == 12
    assert "A" in SuperPy.BUTTONS
    assert "B" in SuperPy.BUTTONS
    assert "Start" in SuperPy.BUTTONS


def test_screen_dimensions():
    """Test screen dimension constants."""
    from superpy import SuperPy
    assert SuperPy.SCREEN_WIDTH == 256
    assert SuperPy.SCREEN_HEIGHT == 224


# ROM-dependent tests - skip if no ROM available
@pytest.fixture
def test_rom(tmp_path):
    """Create a minimal test ROM (or skip if impossible)."""
    # In real tests, you'd provide a path to a test ROM
    pytest.skip("No test ROM available")


@pytest.mark.skip(reason="Requires ROM file")
def test_load_rom(test_rom):
    """Test ROM loading."""
    from superpy import SuperPy
    snes = SuperPy(test_rom)
    assert snes.frame_count == 0


@pytest.mark.skip(reason="Requires ROM file")  
def test_step(test_rom):
    """Test frame stepping."""
    from superpy import SuperPy
    snes = SuperPy(test_rom)
    frame = snes.step({"Right": True})
    assert frame.shape == (224, 256, 4)
    assert snes.frame_count == 1


@pytest.mark.skip(reason="Requires ROM file")
def test_memory_access(test_rom):
    """Test RAM access."""
    from superpy import SuperPy
    snes = SuperPy(test_rom)
    assert len(snes.memory) == 131072  # 128KB


@pytest.mark.skip(reason="Requires ROM file")
def test_save_load_state(test_rom):
    """Test state save/load."""
    from superpy import SuperPy
    snes = SuperPy(test_rom)
    
    # Step forward
    for _ in range(60):
        snes.step({})
    
    # Save state
    state = snes.save_state()
    assert len(state) > 0
    
    # Step more
    frame_before = snes.frame_count
    for _ in range(60):
        snes.step({})
    
    # Load state
    snes.load_state(state)
    # Note: frame_count is Python-side, not saved in state
