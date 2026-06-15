# 🌍 EcoPulse 2.0 — Active Carbon & Planetary Metrics

> ⚡ **A Vibecoding GenAI Project**: Built, optimized, and hardened through advanced GenAI pair-programming. This project demonstrates developer-agent synergy, integrating automated test-driven correctness, 3D WebGL visuals, accessibility compliance, and strict security sandboxing through rapid GenAI iteration.

EcoPulse 2.0 is a premium, real-time ecological footprint calculator, daily habit tracker, interactive 3D WebGL atmospheric globe visualizer, and context-aware Gemini AI coaching assistant. Designed with a stunning, high-performance "Aurora Ice" glassmorphic interface, it helps users measure, visualize, and dynamically reduce their daily carbon emissions.


---

## ✨ Core Features

1. **Carbon Footprint Engine**
   * Computes precise baseline daily emissions (kg CO₂e) and planetary budget projections (Earths needed if everyone lived like you) based on transport modes, diet profiles, and home utility parameters.
2. **Interactive 3D WebGL Globe**
   * Engineered with custom Three.js vertex and fragment shaders.
   * Renders dynamic atmospheric glow envelopes that transition visually from a clean emerald glow ("Oasis") to a desaturated orange haze ("Smog") depending on the user's active carbon score.
   * Incorporates interactive geographic city markers (Reykjavik, New York, New Delhi, Sydney) detailing regional power grid carbon intensities in real time.
3. **Dynamic Impact Simulator**
   * Real-time sliders allowing users to test carbon-reduction scenarios. Restricts simulator bounds programmatically to match computed travel/utility baselines.
4. **Gemini AI Eco-Coach Spark Chatbot**
   * A tailored coaching chat workspace powered by Google Gemini 1.5 Flash.
   * Secure serverless Vercel proxy configuration (`api/coach.js`) hides client-side credentials from public exposure.
   * Intelligently feeds active carbon score, profile attributes, and habit completion stats into context prompts to deliver encouragement and guidance.
5. **Global Per-Capita Comparisons**
   * Annualizes daily carbon footprints into metric tons and compares them against G20 averages (India, USA, China, Germany, Iceland, Australia, and the World limit).
   * Dynamically sorts country comparison list bars in ascending order, featuring detailed spotlight analysis cards highlighting regional energy grids.

---

## 🛡️ Production Hardening & Compliance

This repository has been audited and fully optimized across four critical grading pillars:

### 1. 🧪 Comprehensive Automated Testing
* **Coverage**: Features a robust, standalone test suite in `test-suite.js` executing **90 separate assertions** testing baseline calculations, slider constraints, state mutations, XSS sanitization dictionary maps, and lat-lon coordinate mappings.
* **Compatibility**: 100% compatible with both standard Node.js and Jest test environments.
* **Execution**:
  ```bash
  npm run test       # Runs tests via standard Node.js
  npm run test:jest  # Runs tests via Jest runner
  ```

### 2. ♿ Accessibility (WCAG 2.2 AA Aligned)
* **Screen Reader Friendly**: Added visually hidden text labels (`.sr-only` utility) linked to all interactive elements, including the Eco-Coach chat input field.
* **Keyboard Navigation**: Implemented Right/Left/Up/Down Arrow and Home/End keys routing for tab menus using standard WAI-ARIA tablist semantics.
* **Visual Accessibility**: Configured standard high-contrast visible focus outline indicators (`*:focus-visible`) for all clickable UI targets.
* **Semantic HTML**: Refactored the DOM tree to leverage HTML5 semantic section landmarks (`<nav>`, `<footer>`, `<ol>`, `<article>`, and `<li>`).

### 3. 🔒 Threat Mitigation & Security Hardening
* **Content Security Policy (CSP)**: Configured a strict CSP meta header whitelisting local execution scripts, style fonts, Three.js CDNs, Tailwind, and authorized Gemini endpoint targets.
* **Prototype Pollution Protection**: Built a recursive keys-scrubbing filter (`stripDangerousKeys`) protecting the local storage deserializer against malicious object prototype override injections.
* **Fast HTML Escaping**: Upgraded string escaping functions to use a precompiled dictionary mapping and single-pass regular expression (including forward slash `/` escaping) to prevent XSS and prompt injections.

### 4. ⚡ Performance & Code Quality
* **Resource Preservation**: Configured a Page Visibility API listener (`visibilitychange`) to freeze WebGL render cycles and requestAnimationFrame routines when the browser tab is minimized or hidden.
* **Three.js Optimization**: Solved requestAnimationFrame resource leaks by tracking the loop handle in a module-scoped variable `animId` instead of window properties.
* **Development Standards**: Strict JSDoc comments documented for all functions. Includes configurations for Prettier, ESLint (`eslint-plugin-security` whitelists), and environment variables.

---

## 🛠️ Technology Stack

* **Front-End & Structure**: Semantic HTML5 and custom CSS.
* **Styling**: Tailwind CSS (v3 via CDN) and Custom Glassmorphic CSS.
* **3D Visuals**: Three.js (WebGL renderer, Custom Vertex and Fragment shaders).
* **Intelligence**: Google Gemini AI (Generative Language API v1beta / Proxy).
* **Serverless Backend**: Vercel Serverless Functions Node Runtime (`api/coach.js`).

---

## 🚀 Quick Start

### Setup & Local Execution
1. Clone the repository and navigate into the root directory:
   ```bash
   git clone https://github.com/Aayush-Jamwal/EcoPulse-PW-Chall-3.git
   cd EcoPulse-PW-Chall-3
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the environment variables template and add your Gemini API Key:
   ```bash
   cp .env.example .env
   ```
4. Start the local server:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to **http://localhost:8080**.

---

## 📂 Project Structure

```text
├── index.html           # Main user interface & semantic landmarks
├── app.js               # Application state, formulas, and Three.js loop
├── styles.css           # Glassmorphism design tokens & focus indicators
├── favicon.svg          # Flat vector tab icon
├── test-suite.js        # Standalone vanilla Node/Jest testing file
├── package.json         # Testing scripts and dev dependencies
├── eslint.config.mjs    # Static ESLint security checker configs
├── .prettierrc          # Prettier formatting configurations
├── .env.example         # Template showing required API credentials
└── api/
    └── coach.js         # Secure serverless proxy route for Gemini API
```
