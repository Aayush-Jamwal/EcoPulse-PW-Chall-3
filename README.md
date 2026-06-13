# 🌍 EcoPulse 2.0 — Active Carbon & Planetary Metrics

**EcoPulse 2.0** is an interactive ecological footprint calculator, real-time daily habit tracker, 3D atmospheric globe visualization, and context-aware Gemini AI coaching assistant. It is built to help users measure, understand, and reduce their daily carbon emissions through actionable habits.

---

## ✨ Key Features

1. **Onboarding Carbon Footprint Calculator**
   * Computes your daily baseline carbon emissions (in kg CO₂e) and planetary budget (number of Earths needed if everyone lived like you) based on:
     * Commute mileage & travel mode (Petrol/Diesel Car, Two-wheeler, Public Transit, Active Walking/Cycling).
     * Daily nutrition preferences (Non-Vegetarian, Flexitarian, Vegetarian, Plant-based/Vegan).
     * Home utilities (electricity bill, AC usage hours, cooking LPG gas cylinders, and renewable solar panel offsets).
2. **Interactive 3D Earth Globe**
   * Built with **Three.js** custom shaders.
   * Renders dynamic atmospheric glow overlays that transition visually between clean ("Oasis") and smog-filled based on the user's active carbon score.
   * Features interactive glowing city hotspots (Reykjavik, New York, New Delhi, Sydney) displaying regional utility power grid carbon intensities in real-time.
3. **Daily Habits Checklist**
   * Dynamic checkable items (e.g., green transit, plant-based meals, AC optimization, solar panel use) that subtract carbon weight and update your Earth score in real-time.
4. **Spark: Gemini AI Eco-Coach**
   * A tailored, context-aware chatbot powered by **Google Gemini 1.5 Flash**.
   * Offers highly personalized, encouraging advice by automatically reading your active carbon balance, completed checklist habits, and baseline calculations.

---

## 🛠️ Technology Stack

* **Structure & UI:** HTML5 (Semantic Structure)
* **Styling:** Tailwind CSS (v3 via CDN) and Custom Vanilla CSS (Glassmorphism, aurora glow components)
* **3D Globe:** Three.js (WebGL renderer, custom fragment and vertex shaders, mathematical latitude/longitude node positioning)
* **Intelligence:** Google Gemini AI (Generative Language API v1beta)
* **Development Server:** `http-server`

---

## 🚀 Quick Start

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed.

### Setup & Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Aayush-Jamwal/EcoPulse-PW-Chall-3.git
   cd EcoPulse-PW-Chall-3
   ```
2. Install the development server:
   ```bash
   npm install
   ```
3. Run the development server locally:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to:
   👉 **http://localhost:8080**

---

## 🔑 Activating Gemini AI Coaching
By default, the application runs using a high-fidelity simulated offline engine. To enable **live Gemini AI suggestions**:
1. Open [app.js](file:///c:/Prompt%20Wars/Challenge%203-%20CArbon%20Footprint/app.js) in your text editor.
2. Locate the global constant at the very top of the file:
   ```javascript
   // Hardcoded Gemini API Key (set this to your free Gemini key to enable live AI coaching out of the box)
   const GEMINI_API_KEY = 'YOUR_API_KEY_HERE';
   ```
3. Replace `'YOUR_API_KEY_HERE'` with your free Gemini API Key from Google AI Studio and save the file.
4. Commit and push the updates to deploy to Vercel.

---

## 📂 Project Structure

```text
├── index.html       # Main application interface and layouts
├── app.js           # Core application state controller, footprint calculator, and Three.js globe logic
├── styles.css       # Custom Glassmorphism styles and background glowing blobs ("Aurora Ice" theme)
├── favicon.svg      # Flattened vector favicon logo for the browser tab
├── package.json     # Node scripts and development dependencies
└── README.md        # Documentation
```

---

## 🎨 Design Theme ("Aurora Ice")
EcoPulse 2.0 implements a premium dark-mode interface styled with vibrant teal, soft violet, and ice-blue glassmorphic panels. Subtle micro-animations, glowing borders, and smooth transitions ensure a visual experience that reacts dynamically to the user's eco-conscious inputs.
