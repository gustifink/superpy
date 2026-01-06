cmake_minimum_required(VERSION 3.18)
project(superpy LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Options
option(SUPERPY_HEADLESS "Build without GUI support" ON)
option(SUPERPY_AUDIO "Build with audio support" OFF)

# Find Python and nanobind
find_package(Python 3.9 REQUIRED COMPONENTS Interpreter Development.Module)

# Fetch nanobind
include(FetchContent)
FetchContent_Declare(
    nanobind
    GIT_REPOSITORY https://github.com/wjakob/nanobind.git
    GIT_TAG v2.2.0
)
FetchContent_MakeAvailable(nanobind)
find_package(nanobind CONFIG REQUIRED)

# Snes9x source directory
set(SNES9X_DIR ${CMAKE_CURRENT_SOURCE_DIR}/external/snes9x)

# Core Snes9x sources (headless subset)
set(SNES9X_SOURCES
    ${SNES9X_DIR}/bsx.cpp
    ${SNES9X_DIR}/c4.cpp
    ${SNES9X_DIR}/c4emu.cpp
    ${SNES9X_DIR}/cheats.cpp
    ${SNES9X_DIR}/cheats2.cpp
    ${SNES9X_DIR}/clip.cpp
    ${SNES9X_DIR}/conffile.cpp
    ${SNES9X_DIR}/controls.cpp
    ${SNES9X_DIR}/cpu.cpp
    ${SNES9X_DIR}/cpuexec.cpp
    ${SNES9X_DIR}/cpuops.cpp
    ${SNES9X_DIR}/dma.cpp
    ${SNES9X_DIR}/dsp.cpp
    ${SNES9X_DIR}/dsp1.cpp
    ${SNES9X_DIR}/dsp2.cpp
    ${SNES9X_DIR}/dsp3.cpp
    ${SNES9X_DIR}/dsp4.cpp
    ${SNES9X_DIR}/fxemu.cpp
    ${SNES9X_DIR}/fxinst.cpp
    ${SNES9X_DIR}/gfx.cpp
    ${SNES9X_DIR}/globals.cpp
    ${SNES9X_DIR}/memmap.cpp
    ${SNES9X_DIR}/msu1.cpp
    ${SNES9X_DIR}/movie.cpp
    ${SNES9X_DIR}/obc1.cpp
    ${SNES9X_DIR}/ppu.cpp
    ${SNES9X_DIR}/sa1.cpp
    ${SNES9X_DIR}/sa1cpu.cpp
    ${SNES9X_DIR}/sdd1.cpp
    ${SNES9X_DIR}/sdd1emu.cpp
    ${SNES9X_DIR}/seta.cpp
    ${SNES9X_DIR}/seta010.cpp
    ${SNES9X_DIR}/seta011.cpp
    ${SNES9X_DIR}/seta018.cpp
    ${SNES9X_DIR}/snapshot.cpp
    ${SNES9X_DIR}/spc7110.cpp
    ${SNES9X_DIR}/srtc.cpp
    ${SNES9X_DIR}/tile.cpp
    ${SNES9X_DIR}/tileimpl-n1x1.cpp
    ${SNES9X_DIR}/tileimpl-n2x1.cpp
    ${SNES9X_DIR}/tileimpl-h2x1.cpp
    ${SNES9X_DIR}/bml.cpp
    ${SNES9X_DIR}/sha256.cpp
    ${SNES9X_DIR}/stream.cpp
    ${SNES9X_DIR}/snes9x.cpp
    ${SNES9X_DIR}/statemanager.cpp
    ${SNES9X_DIR}/fscompat.cpp
    # APU integration
    ${SNES9X_DIR}/apu/apu.cpp
    # BSNES APU components
    ${SNES9X_DIR}/apu/bapu/dsp/sdsp.cpp
    ${SNES9X_DIR}/apu/bapu/smp/smp.cpp
    ${SNES9X_DIR}/apu/bapu/smp/smp_state.cpp
)

# JMA (archive) sources
set(SNES9X_JMA_SOURCES
    ${SNES9X_DIR}/jma/7zlzma.cpp
    ${SNES9X_DIR}/jma/crc32.cpp
    ${SNES9X_DIR}/jma/iiostrm.cpp
    ${SNES9X_DIR}/jma/inbyte.cpp
    ${SNES9X_DIR}/jma/jma.cpp
    ${SNES9X_DIR}/jma/lzma.cpp
    ${SNES9X_DIR}/jma/lzmadec.cpp
    ${SNES9X_DIR}/jma/s9x-jma.cpp
    ${SNES9X_DIR}/jma/winout.cpp
)

# Adapter sources
set(SUPERPY_SOURCES
    ${CMAKE_CURRENT_SOURCE_DIR}/src/snes9x_adapter.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/src/bindings.cpp
)

# Combine all sources
set(ALL_SOURCES
    ${SNES9X_SOURCES}
    ${SNES9X_JMA_SOURCES}
    ${SUPERPY_SOURCES}
)

# Create the Python module
nanobind_add_module(_core ${ALL_SOURCES})

# Include directories
target_include_directories(_core PRIVATE
    ${SNES9X_DIR}
    ${SNES9X_DIR}/apu
    ${SNES9X_DIR}/apu/bapu
    ${SNES9X_DIR}/apu/bapu/dsp
    ${SNES9X_DIR}/apu/bapu/smp
    ${SNES9X_DIR}/filter
    ${SNES9X_DIR}/jma
    ${CMAKE_CURRENT_SOURCE_DIR}/src
)

# Compile definitions for headless mode
target_compile_definitions(_core PRIVATE
    RIGHTSHIFT_IS_SAR=1
    ZLIB=1
    HAVE_LIBPNG=0
    HAVE_STRINGS_H=1
    HAVE_STDINT_H=1
    JMA_SUPPORT=1
)

if(SUPERPY_HEADLESS)
    target_compile_definitions(_core PRIVATE SUPERPY_HEADLESS=1)
endif()

if(NOT SUPERPY_AUDIO)
    target_compile_definitions(_core PRIVATE SUPERPY_NO_AUDIO=1)
endif()

# Platform-specific settings
if(APPLE)
    target_compile_definitions(_core PRIVATE MACOSX=1)
elseif(UNIX)
    target_compile_definitions(_core PRIVATE __linux__=1)
elseif(WIN32)
    target_compile_definitions(_core PRIVATE __WIN32__=1)
endif()

# Link zlib for save states
find_package(ZLIB REQUIRED)
target_link_libraries(_core PRIVATE ZLIB::ZLIB)

# Install the module
install(TARGETS _core LIBRARY DESTINATION superpy)
