/**
 * SuperPy Python Bindings (nanobind)
 * 
 * Exposes the Snes9x adapter to Python with zero-copy array access.
 */

#include <nanobind/nanobind.h>
#include <nanobind/ndarray.h>
#include <nanobind/stl/string.h>
#include <nanobind/stl/map.h>
#include <nanobind/stl/vector.h>

#include "snes9x_adapter.h"

namespace nb = nanobind;

NB_MODULE(_core, m) {
    m.doc() = "SuperPy: High-performance SNES emulator interface for Python AI research";

    nb::class_<superpy::SuperPyEngine>(m, "Engine")
        .def(nb::init<>())
        .def("load_rom", &superpy::SuperPyEngine::load_rom,
             nb::arg("path"),
             "Load a SNES ROM from the given path")
        
        // step() with dict input
        .def("step", [](superpy::SuperPyEngine& self, const std::map<std::string, bool>& input) {
            uint32_t mask = superpy::SuperPyEngine::buttons_to_mask(input);
            self.step(mask);
        }, nb::arg("input") = std::map<std::string, bool>{},
             "Advance emulation by one frame with optional controller input")
        
        // tick() for fast frame skipping
        .def("tick", [](superpy::SuperPyEngine& self, int count, bool render, const std::map<std::string, bool>& input) {
            uint32_t mask = superpy::SuperPyEngine::buttons_to_mask(input);
            self.tick(count, render, mask);
        }, nb::arg("count") = 1, nb::arg("render") = true, nb::arg("input") = std::map<std::string, bool>{},
             "Run multiple frames. Set render=False for maximum speed (100x+ real-time)")
        
        .def("reset", &superpy::SuperPyEngine::reset,
             "Reset the emulation to initial state")
        
        .def_prop_ro("done", &superpy::SuperPyEngine::is_done,
             "Whether emulation has ended")
        
        .def_prop_ro("frame_count", &superpy::SuperPyEngine::frame_count,
             "Total frames executed since ROM load")
        
        .def_prop_ro("screen", [](superpy::SuperPyEngine& self) {
            // Return screen as numpy array (RGBA, H x W x 4)
            const uint32_t* data = self.get_screen();
            int h = self.get_screen_height();
            int w = self.get_screen_width();
            
            // Shape: (height, width, 4) for RGBA
            size_t shape[3] = {(size_t)h, (size_t)w, 4};
            
            // Zero-copy view into our static buffer
            return nb::ndarray<nb::numpy, uint8_t, nb::shape<224, 256, 4>>(
                (uint8_t*)data,
                3, shape,
                nb::handle()
            );
        }, "Zero-copy view of the SNES screen (224 x 256 x 4 RGBA)")
        
        .def_prop_ro("memory", [](superpy::SuperPyEngine& self) {
            // Return RAM as numpy array (128KB)
            uint8_t* data = self.get_memory();
            size_t size = self.get_memory_size();
            size_t shape[1] = {size};
            
            return nb::ndarray<nb::numpy, uint8_t>(
                data,
                1, shape,
                nb::handle()
            );
        }, "Direct access to SNES RAM (128KB)")
        
        .def("save_state", [](superpy::SuperPyEngine& self) {
            auto state = self.save_state();
            return nb::bytes(reinterpret_cast<const char*>(state.data()), state.size());
        }, "Save current emulator state to bytes")
        
        .def("load_state", [](superpy::SuperPyEngine& self, nb::bytes state) {
            std::vector<uint8_t> data(state.c_str(), state.c_str() + state.size());
            return self.load_state(data);
        }, nb::arg("state"),
             "Load emulator state from bytes");
}
