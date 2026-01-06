/**
 * SuperPy Snes9x Adapter Header
 * AI-ready SNES emulation interface
 */

#pragma once

#include <string>
#include <map>
#include <vector>
#include <cstdint>

namespace superpy {

class SuperPyEngine {
public:
    SuperPyEngine();
    ~SuperPyEngine();

    // ROM management
    bool load_rom(const std::string& path);
    void reset();

    // Emulation - takes raw joypad bitmask
    void step(uint32_t joypad_state);
    
    // Fast frame skipping
    // count: number of frames to run
    // render: if false, skip rendering for maximum speed
    void tick(int count = 1, bool render = true, uint32_t joypad_state = 0);
    
    bool is_done() const { return done_; }

    // Get current frame counter
    uint32_t frame_count() const { return frame_count_; }

    // Screen access (returns RGBA buffer)
    const uint32_t* get_screen() const;
    int get_screen_width() const;
    int get_screen_height() const;

    // Memory access (128KB SNES RAM)
    uint8_t* get_memory();
    size_t get_memory_size() const;

    // State management
    std::vector<uint8_t> save_state();
    bool load_state(const std::vector<uint8_t>& state);

    // Helper to convert button dict to mask
    static uint32_t buttons_to_mask(const std::map<std::string, bool>& buttons);

private:
    bool initialized_;
    bool done_;
    uint32_t frame_count_;
};

} // namespace superpy

// Forward declare some Snes9x initialization helpers
void S9xInitGFX();
