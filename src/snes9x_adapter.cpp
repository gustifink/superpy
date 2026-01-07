/**
 * SuperPy Snes9x Adapter
 * 
 * This file provides a headless interface to the Snes9x emulator core.
 * It implements the minimal platform-specific functions required by Snes9x
 * without any GUI dependencies.
 */

#include "snes9x_adapter.h"

// Snes9x headers
#include "snes9x.h"
#include "memmap.h"
#include "apu/apu.h"
#include "gfx.h"
#include "snapshot.h"
#include "controls.h"
#include "display.h"
#include "ppu.h"
#include "cpuexec.h"
#include "movie.h"
#include "fscompat.h"

#include <cstring>
#include <cstdlib>
#include <cstdio>
#include <string>

namespace superpy {

// Global screen buffer (RGBA, up to 512x478 for hi-res/interlaced modes)
static constexpr int SCREEN_WIDTH = SNES_WIDTH;      // 256
static constexpr int SCREEN_HEIGHT = SNES_HEIGHT;    // 224
static constexpr int MAX_SNES_W = MAX_SNES_WIDTH;    // 512
static constexpr int MAX_SNES_H = MAX_SNES_HEIGHT;   // 478

static uint32_t rgba_buffer[MAX_SNES_W * MAX_SNES_H];

SuperPyEngine::SuperPyEngine() : initialized_(false), done_(false), frame_count_(0) {
    memset(&Settings, 0, sizeof(Settings));
}

SuperPyEngine::~SuperPyEngine() {
    if (initialized_) {
        S9xDeinitAPU();
        Memory.Deinit();
        S9xGraphicsDeinit();
    }
}

bool SuperPyEngine::load_rom(const std::string& path) {
    // Initialize settings for headless operation
    Settings.MouseMaster = false;
    Settings.SuperScopeMaster = false;
    Settings.JustifierMaster = false;
    Settings.MultiPlayer5Master = false;
    Settings.FrameTimePAL = 20000;
    Settings.FrameTimeNTSC = 16667;
    Settings.SixteenBitSound = true;
    Settings.Stereo = true;
    Settings.SoundPlaybackRate = 32000;
    Settings.SoundInputRate = 32000;
    Settings.Transparency = true;
    Settings.AutoDisplayMessages = false;
    Settings.InitialInfoStringTimeout = 0;
    Settings.HDMATimingHack = 100;
    Settings.BlockInvalidVRAMAccessMaster = true;
    Settings.StopEmulation = false;
    Settings.SkipFrames = 0;
    Settings.TurboSkipFrames = 15;
    Settings.MaxSpriteTilesPerLine = 34;  // Critical for sprite rendering
    Settings.OneClockCycle = 6;
    Settings.OneSlowClockCycle = 8;
    Settings.TwoClockCycles = 12;
    Settings.CartAName[0] = '\0';
    Settings.CartBName[0] = '\0';

    // Initialize memory
    if (!Memory.Init()) {
        return false;
    }

    // Initialize APU (required even without audio output)
    if (!S9xInitAPU()) {
        Memory.Deinit();
        return false;
    }

    // Initialize sound buffers (also required for timing)
    if (!S9xInitSound(0)) {
        S9xDeinitAPU();
        Memory.Deinit();
        return false;
    }

    // Initialize graphics subsystem
    if (!S9xGraphicsInit()) {
        S9xDeinitAPU();
        Memory.Deinit();
        return false;
    }
    
    // Load the ROM
    if (!Memory.LoadROM(path.c_str())) {
        S9xGraphicsDeinit();
        S9xDeinitAPU();
        Memory.Deinit();
        return false;
    }

    // Set up controls (standard joypad on port 1)
    S9xSetController(0, CTL_JOYPAD, 0, 0, 0, 0);
    S9xSetController(1, CTL_NONE, 0, 0, 0, 0);

    // Try to load SRAM if it exists
    std::string sram_path = path + ".srm";
    Memory.LoadSRAM(sram_path.c_str());

    initialized_ = true;
    return true;
}

void SuperPyEngine::step(uint32_t joypad_state) {
    if (!initialized_) return;

    // Set the joypad state for player 1 (index 0)
    MovieSetJoypad(0, joypad_state);

    // Run one frame
    S9xMainLoop();
    frame_count_++;
}


void SuperPyEngine::tick(int count, bool render, uint32_t joypad_state) {
    if (!initialized_) return;
    
    // Set joypad state
    MovieSetJoypad(0, joypad_state);
    
    // Disable rendering if requested for maximum speed
    bool prev_render = IPPU.RenderThisFrame;
    
    for (int i = 0; i < count; i++) {
        if (!render) {
            IPPU.RenderThisFrame = false;
        }
        
        S9xMainLoop();
        frame_count_++;
        
        if (!render) {
            IPPU.RenderThisFrame = prev_render;
        }
    }
}

void SuperPyEngine::reset() {
    if (initialized_) {
        S9xReset();
    }
}

const uint32_t* SuperPyEngine::get_screen() const {
    // Convert from RGB565 to RGBA8888
    if (!initialized_ || !GFX.Screen) {
        return rgba_buffer;
    }

    const uint16_t* src = GFX.Screen;
    uint32_t* dst = rgba_buffer;
    
    // Use actual rendered dimensions from IPPU (handles hi-res, interlace, etc.)
    int width = IPPU.RenderedScreenWidth > 0 ? IPPU.RenderedScreenWidth : SNES_WIDTH;
    int height = IPPU.RenderedScreenHeight > 0 ? IPPU.RenderedScreenHeight : SNES_HEIGHT;
    int pitch = GFX.Pitch / sizeof(uint16_t);

    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            uint16_t pixel = src[y * pitch + x];
            
            // RGB565 to RGBA8888
            uint8_t r = ((pixel >> 11) & 0x1F) << 3;
            uint8_t g = ((pixel >> 5) & 0x3F) << 2;
            uint8_t b = (pixel & 0x1F) << 3;
            
            // RGBA format (little-endian: 0xAABBGGRR)
            dst[y * width + x] = (0xFF << 24) | (b << 16) | (g << 8) | r;
        }
    }

    return rgba_buffer;
}

int SuperPyEngine::get_screen_width() const {
    // Return actual rendered width (may be 512 for hi-res modes)
    if (initialized_ && IPPU.RenderedScreenWidth > 0) {
        return IPPU.RenderedScreenWidth;
    }
    return SNES_WIDTH;
}

int SuperPyEngine::get_screen_height() const {
    // Return actual rendered height (may be 448/478 for interlaced modes)
    if (initialized_ && IPPU.RenderedScreenHeight > 0) {
        return IPPU.RenderedScreenHeight;
    }
    return SNES_HEIGHT;
}

uint8_t* SuperPyEngine::get_memory() {
    if (!initialized_) return nullptr;
    return Memory.RAM;
}

size_t SuperPyEngine::get_memory_size() const {
    return 0x20000;  // 128KB SNES RAM
}

std::vector<uint8_t> SuperPyEngine::save_state() {
    if (!initialized_) return {};

    // Get the size needed for the freeze
    uint32_t size = S9xFreezeSize();
    if (size == 0) {
        return {};
    }

    std::vector<uint8_t> buffer(size);
    if (!S9xFreezeGameMem(buffer.data(), size)) {
        return {};
    }

    return buffer;
}

bool SuperPyEngine::load_state(const std::vector<uint8_t>& state) {
    if (!initialized_ || state.empty()) return false;

    int result = S9xUnfreezeGameMem(state.data(), state.size());
    return result == SUCCESS;
}

// Static helper to convert button dict to bitmask
uint32_t SuperPyEngine::buttons_to_mask(const std::map<std::string, bool>& buttons) {
    uint32_t mask = 0;
    
    static const std::map<std::string, uint32_t> button_map = {
        {"A", SNES_A_MASK},
        {"B", SNES_B_MASK},
        {"X", SNES_X_MASK},
        {"Y", SNES_Y_MASK},
        {"L", SNES_TL_MASK},
        {"R", SNES_TR_MASK},
        {"Up", SNES_UP_MASK},
        {"Down", SNES_DOWN_MASK},
        {"Left", SNES_LEFT_MASK},
        {"Right", SNES_RIGHT_MASK},
        {"Start", SNES_START_MASK},
        {"Select", SNES_SELECT_MASK},
    };

    for (const auto& [button, pressed] : buttons) {
        if (pressed) {
            auto it = button_map.find(button);
            if (it != button_map.end()) {
                mask |= it->second;
            }
        }
    }

    return mask;
}

} // namespace superpy


// ============================================================================
// Snes9x Platform Stubs (Required by the core)
// ============================================================================

void S9xMessage(int type, int number, const char* message) {
    // Silent in headless mode
}

bool S9xPollButton(uint32 id, bool* pressed) {
    *pressed = false;
    return false;
}

bool S9xPollAxis(uint32 id, int16* value) {
    *value = 0;
    return false;
}

bool S9xPollPointer(uint32 id, int16* x, int16* y) {
    *x = 0;
    *y = 0;
    return false;
}

void S9xToggleSoundChannel(int c) {}
void S9xSetPalette() {}
void S9xSyncSpeed() {}
void S9xAutoSaveSRAM() {}

// File/Directory functions
std::string S9xGetDirectory(enum s9x_getdirtype type) {
    return ".";
}

std::string S9xGetFilename(const char* extension, enum s9x_getdirtype type) {
    return Memory.ROMFilename + extension;
}

std::string S9xGetFilenameInc(const char* extension, enum s9x_getdirtype type) {
    return Memory.ROMFilename + extension;
}

std::string S9xGetFilenameInc(std::string extension, enum s9x_getdirtype type) {
    return Memory.ROMFilename + extension;
}

std::string S9xChooseFilename(bool8 read_only) {
    return "";
}

std::string S9xChooseMovieFilename(bool8 read_only) {
    return "";
}

void S9xExit() {}

// Graphics stubs
bool8 S9xInitUpdate(void) {
    return true;
}

bool8 S9xDeinitUpdate(int width, int height) {
    return true;
}

bool8 S9xContinueUpdate(int width, int height) {
    return true;
}

void S9xSetTitle(const char* title) {}
void S9xProcessEvents(bool8 block) {}
void S9xHandlePortCommand(s9xcommand_t cmd, int16 data1, int16 data2) {}

bool8 S9xMapInput(const char* name, s9xcommand_t* cmd) {
    return false;
}

// Snapshot file functions
bool8 S9xOpenSnapshotFile(const char* filename, bool8 read_only, STREAM* file) {
    *file = OPEN_STREAM(filename, read_only ? "rb" : "wb");
    return *file != NULL;
}

void S9xCloseSnapshotFile(STREAM file) {
    CLOSE_STREAM(file);
}

const char* S9xStringInput(const char* prompt) {
    return "";
}

bool S9xDoScreenshot(int width, int height) {
    return false;
}

const uint16* S9xGetCrosshair(int index) {
    return nullptr;
}

// Sound device stub (required by S9xInitSound in apu.cpp)
bool8 S9xOpenSoundDevice(void) {
    // In headless mode, we don't need actual audio output
    // Return true to indicate "success" so sound buffers are still updated
    return true;
}
