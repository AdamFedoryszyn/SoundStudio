# FL Clone 🎹

**FL Clone** is an independent, FL Studio-inspired music production application built with Electron, JavaScript, and the Web Audio API. It combines a step sequencer, piano roll, song arrangement, mixer, and modular audio engine in a desktop application.

The goal is to provide a compact and intuitive digital audio workstation (DAW) for programming beats, composing melodies, arranging complete songs, shaping sounds, recording samples, and exporting audio.

## ✨ Features

### 🎛️ Step Sequencer & Patterns
- 16 instrument and sample channels
- Six drum synthesizers and six melodic synthesizers
- Four independent patterns: A, B, C, and D
- 16, 32, or 64 steps per pattern
- Adjustable BPM and swing
- Per-step velocity, accent, probability, ratchets, and micro-timing
- Global humanization controls for timing and velocity

### 🎹 Piano Roll
- Create, select, move, and delete notes
- Multi-note selection and group editing
- Copy and paste, quantization, and note-length editing
- Velocity editing
- Undo and redo
- Context menus for quick access to editing tools

### 🎬 Song Arrangement
- Timeline-based arrangement with pattern clips
- Move, duplicate, and arrange clips
- Song looping and synchronized playhead
- Central scheduler for accurate playback timing

### 📈 Automation
- Automate volume, panning, filters, and supported effect parameters
- Automation clips and control points
- Linear, smoothed, and hold interpolation modes
- Audio-time-synchronized parameter changes

### 🎚️ Mixer & Effects
- Channel volume, panning, mute, and solo
- Master output and reverb send bus
- Modular per-channel effect chains
- EQ, delay, distortion, compressor, and chorus
- Per-channel filter cutoff and resonance

### 🎙️ Samples & Audio Export
- Four sample channels for importing custom audio files
- Persistent sample storage using IndexedDB
- Microphone recording for creating custom samples
- WAV export using OfflineAudioContext
- 16-bit or 24-bit PCM export at 44.1 kHz or 48 kHz

### 💾 Projects & Storage
- Automatic local saving
- JSON project import and export
- Versioned project formats and migration paths
- Electron desktop application for Windows

## 🛠️ Technology Stack

- **JavaScript** — application logic and data model
- **Web Audio API** — instruments, audio routing, and effects
- **Electron** — desktop application framework
- **HTML & CSS** — user interface
- **IndexedDB** — persistent audio sample storage
- **OfflineAudioContext** — offline audio rendering for WAV export

## 🚀 Getting Started

### Prerequisites

- Node.js
- npm

### Install dependencies

Clone or download the repository, open a terminal in the project directory, and run:

```bash
npm install
```

### Start the application

```bash
npm start
```

### Build for Windows

```bash
npm run dist:win
```

Refer to the project files and build instructions for additional setup details.

## 📌 Project Status

FL Clone is an actively evolving music production project. Development focuses on improving the production workflow, precise note editing, reliable audio playback, and a modular architecture that supports future features.

New functionality is designed to integrate with the existing application while preserving project compatibility and musical data.

## 🗺️ Roadmap

Potential future improvements include:

- Expanded MIDI input and output support
- Advanced sample editing and slicing
- Additional instruments and synthesizer controls
- More audio effects and routing options
- Improved arrangement and editing tools
- Portable project packages
- Additional export options and workflow enhancements

## ⚖️ Disclaimer

FL Clone is an independent software project inspired by digital audio workstations. It is not an official Image-Line product and is not affiliated with or endorsed by Image-Line or the creators of FL Studio.

## 📄 License

See the repository's license file for the applicable license terms. Before distributing the project, verify that the license covers the application and that all third-party dependencies and assets comply with their respective licenses.
