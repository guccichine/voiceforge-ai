# VoiceForge AI

A modern voice cloner & synthesizer web app that matches the Figma design.

## Live Demo

Open the raw files or enable GitHub Pages on this repo.

**Quick start:**
1. Download or clone this repo
2. Open `index.html` in Chrome / Edge / Firefox
3. Allow microphone if you want to record

## Features

- **Dashboard** – stats + quick synthesize
- **Clone Voice** – upload files or record from mic (simulated training)
- **Synthesize** – full TTS with rate & pitch controls + waveform
- **Voice Library** – manage cloned + system voices
- Dark theme matching the original Figma design
- Works 100% in the browser (Web Speech API)
- Data saved in localStorage

## Important Note

True neural voice cloning (training a model on your voice samples) requires specialized ML infrastructure (e.g. Tortoise, Coqui, RVC, OpenVoice, etc.).

This app **simulates** the cloning experience and uses your browser’s built-in speech synthesis voices for actual audio output. It is a fully functional UI + working synthesizer.

## Figma Design

Original design: https://www.figma.com/design/zJaEb5NtGJdTqPzIEglWiT
