/**
 * @fileoverview EcoPulse 2.0 — Application Logic & State Controller
 * @description Manages the full application lifecycle: carbon footprint
 *   calculations, Three.js 3D globe rendering, Gemini AI eco-coaching,
 *   impact simulation, action planning, and global comparison charts.
 *
 * Architecture:
 *   ─ SECTION 1 ─ Security Utilities         (sanitizeHTML, etc.)
 *   ─ SECTION 2 ─ Global Data & Emissions     (EMISSIONS_FACTORS, CITY_HOTSPOTS)
 *   ─ SECTION 3 ─ Tab Routing Config          (TABS constant)
 *   ─ SECTION 4 ─ State Management            (state, load/save)
 *   ─ SECTION 5 ─ Routing & Navigation        (initTabRouting, switchView)
 *   ─ SECTION 6 ─ Calculator & Carbon Engine  (runEcoSenseCalculator, etc.)
 *   ─ SECTION 7 ─ 3D Globe Rendering          (initThreeGlobe, animateGlobe)
 *   ─ SECTION 8 ─ AI Eco-Coach Chat           (setupChatbot, fetchGeminiCoachAdvice)
 *   ─ SECTION 9 ─ Global Comparison Tab       (updateComparisonTab)
 *   ─ SECTION 10 ─ Bootstrap                 (DOMContentLoaded)
 *
 * @version 2.0.0
 * @license MIT
 *
 * SECURITY NOTE: GEMINI_API_KEY is intentionally left empty here.
 * The real API credential is stored as a Vercel environment variable and
 * accessed exclusively via the /api/coach serverless proxy route, ensuring
 * it is never exposed to the client-side JavaScript bundle.
 */

'use strict';

// ================= SECTION 1 — SECURITY UTILITIES =================

/**
 * Precomputed HTML escape map for performance.
 * @type {Readonly<Record<string, string>>}
 */
const HTML_ESCAPE_MAP = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;',
  '/': '&#x2F;'
});

/**
 * Sanitizes raw user input to prevent Cross-Site Scripting (XSS) and
 * prompt-injection attacks before any string is rendered via innerHTML.
 * Escapes the six HTML-dangerous characters in a single pass using a fast regex map.
 *
 * @security This function MUST be called on all user-supplied strings before
 *   they are inserted into innerHTML. It is the primary XSS defense layer.
 * @param {string} text - Raw user-supplied string
 * @returns {string} HTML-safe escaped string, safe for innerHTML insertion
 */
function sanitizeHTML(text) {
  if (typeof text !== 'string') return '';
  return text.trim().replace(/[&<>"'\/]/g, (char) => HTML_ESCAPE_MAP[char] || char);
}

/**
 * Recursively sanitizes objects to remove prototype pollution keys (__proto__, constructor, prototype).
 * Prevents malicious JSON inputs from overriding core JavaScript object prototypes.
 *
 * @security Run this on all parsed JSON data (like local storage loading) before using it.
 * @param {*} obj - The input object or value to sanitize
 * @returns {*} Cleaned object copy with dangerous prototype keys excluded
 */
function stripDangerousKeys(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(stripDangerousKeys);
  }
  const cleanObj = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
      cleanObj[key] = stripDangerousKeys(value);
    }
  }
  return cleanObj;
}

// ================= SECTION 2 — GLOBAL DATA & CALCULATIONS =================

/** Compile-time API key placeholder. The real key is a Vercel env var. */
const GEMINI_API_KEY = '';


// Standard daily carbon factors (kg CO2e per day)
// Fix #17: Added 'electric' commute key to align with state.quizAnswers.commuteMode mapping.
const EMISSIONS_FACTORS = {
  commute: {
    'drive-alone': 0.22, // Petrol/Diesel Car   (kg CO2e / km)
    'electric':    0.05, // Electric Vehicle     (kg CO2e / km) — grid-charged
    'twowheeler':  0.10, // Two-Wheeler          (kg CO2e / km)
    'transit':     0.03, // Public Transit       (kg CO2e / km)
    'active':      0.00  // Walk / Bicycle / None(kg CO2e / km)
  },
  diet: {
    'meat-heavy':  8.3,  // Meat Heavy           (kg CO2e / day)
    'balanced':    5.6,  // Balanced/Flexitarian (kg CO2e / day)
    'vegetarian':  2.8,  // Indian Vegetarian    (kg CO2e / day)
    'vegan':       1.5   // Plant-based / Vegan  (kg CO2e / day)
  }
};

// Daily checklists to subtract footprint in real-time
const CHECKLIST_ACTIONS = [
  {
    id: 'commute-green',
    title: 'Took green transit today',
    desc: 'Switched commute to metro, shared transit, or active cycling.',
    impact: -4.5
  },
  {
    id: 'diet-veg',
    title: 'Ate purely plant-based meals',
    desc: 'Substituted dairy and meat products for grains, legumes and veggies.',
    impact: -2.2
  },
  {
    id: 'smart-ac',
    title: 'Optimized AC & cooling',
    desc: 'Kept AC temperature at 26\u00B0C or switched to fans in empty rooms.',
    impact: -1.8
  },
  {
    id: 'plug-unplug',
    title: 'Unplugged vampire loads',
    desc: 'Unplugged electronics and chargers when not active.',
    impact: -0.8
  },
  {
    id: 'wash-sun',
    title: 'Sun-dried garments',
    desc: 'Utilized traditional outdoor balcony line drying rather than dryer spins.',
    impact: -1.2
  },
  {
    id: 'cloth-bag',
    title: 'Used cotton sabzi bags',
    desc: 'Brought reusable fabric totes to vendor stalls to bypass single-use plastic.',
    impact: -0.6
  }
];

// Pinned global city nodes data
const CITY_HOTSPOTS = [
  {
    name: 'Reykjavik, Iceland',
    lat: 64.1466,
    lon: -21.9426,
    intensity: 12,
    desc: 'Ultra-low carbon power grid fueled by 100% renewable geothermal heat and hydro-power.',
    color: '#10b981', // green
    textColor: 'text-emerald-400'
  },
  {
    name: 'New York, USA',
    lat: 40.7128,
    lon: -74.0060,
    intensity: 280,
    desc: 'Moderate emissions grid consisting of natural gas turbines, nuclear power, and small solar shares.',
    color: '#f59e0b', // orange
    textColor: 'text-amber-400'
  },
  {
    name: 'New Delhi, India',
    lat: 28.6139,
    lon: 77.2090,
    intensity: 680,
    desc: 'High carbon grid load driven heavily by domestic coal combustion. Growing solar shares.',
    color: '#f43f5e', // red
    textColor: 'text-rose-500'
  },
  {
    name: 'Sydney, Australia',
    lat: -33.8688,
    lon: 151.2093,
    intensity: 590,
    desc: 'Carbon heavy grid transitioning away from coal base units. Strong rooftop solar penetration.',
    color: '#f59e0b', // orange
    textColor: 'text-amber-500'
  }
];

// ================= SECTION 3 — TAB ROUTING CONFIG =================
// Fix #12: Single source of truth for tab definitions — eliminates duplication
// between initTabRouting() and switchView() which previously defined identical arrays.
const TABS = [
  { id: 'dashboard', btn: 'nav-dashboard', mobileBtn: 'nav-dashboard-mobile', view: 'tab-dashboard-view' },
  { id: 'globe',     btn: 'nav-globe',     mobileBtn: 'nav-globe-mobile',     view: 'tab-globe-view'      },
  { id: 'coach',     btn: 'nav-coach',     mobileBtn: 'nav-coach-mobile',     view: 'tab-coach-view'      },
  { id: 'compare',   btn: 'nav-compare',   mobileBtn: 'nav-compare-mobile',   view: 'tab-compare-view'    }
];

// ================= SECTION 4 — STATE MANAGEMENT =================
let state = {
  // Calculator inputs
  vehicleType: 'Car (Petrol/Diesel)',
  dailyDistance: 15,
  daysPerWeek: 5,
  monthlyElectricity: 150,
  dietPreference: 'Mixed',
  recyclingHabits: 'Sometimes',

  // Calculated values
  monthlyEmissions: 288,
  sustainabilityScore: 64,
  transportShare: 65,
  energyShare: 123,
  lifestyleShare: 100,

  // Simulator
  drivingReduction: 0,
  energyReduction: 0,

  // Planner
  reductionGoal: 20,

  // Compatibility / Legacy values for Coach & Compare
  dailyScore: 9.6,
  dailyBaseScore: 9.6,
  earthsNeeded: 2.8,
  completedActions: [],
  geminiKey: '',
  quizAnswers: {
    commuteDist: 15,
    commuteMode: 'drive-alone',
    diet: 'mixed',
    energyBill: 1200,
    energyAc: 0,
    energyGas: 0,
    solar: false
  }
};

// ================= THREE.JS GLOBE GLOBALS =================
let scene, camera, renderer;
let earthGroup, earthMesh, atmosphereMesh;
let cityMeshes = [];
let animId = null;

// ================= INITIALIZATION & SETUP =================

document.addEventListener('DOMContentLoaded', () => {
  loadSavedState();
  initTabRouting();
  syncInputsFromState();
  setupEcoSenseCalculatorEvents();
  setupChatbot();

  // Start Three.js Globe rendering
  initThreeGlobe();

  // Perform first calculations
  runEcoSenseCalculator();

  // Set default view to dashboard
  switchView('dashboard');

  // Generate default plan on load
  generateActionPlan();
});

/**
 * Loads the application state from local storage.
 * Recursively strips prototype pollution keys to ensure runtime safety.
 * Always overrides the loaded API key with the blank compile-time constant.
 *
 * @security Prevents prototype pollution by sanitizing storage input keys.
 * @returns {void}
 */
function loadSavedState() {
  const localData = localStorage.getItem('ecosense_state');
  if (localData) {
    try {
      const parsed = JSON.parse(localData);
      const cleanParsed = stripDangerousKeys(parsed);
      state = { ...state, ...cleanParsed };
    } catch (e) {
      console.warn('Could not parse saved state, starting fresh:', e);
    }
  }

  // Fix #16: Always override the persisted key with the compile-time constant.
  // GEMINI_API_KEY is intentionally left empty here — the real credential is stored
  // as a Vercel environment variable and accessed securely via the /api/coach proxy
  // route. This override prevents a locally saved stale key from ever shadowing the
  // server-side credential or inadvertently exposing it in localStorage.
  state.geminiKey = GEMINI_API_KEY;
}

/**
 * Saves the active state variables to local storage as a JSON string.
 *
 * @returns {void}
 */
function saveStateToStorage() {
  localStorage.setItem('ecosense_state', JSON.stringify({
    vehicleType: state.vehicleType,
    dailyDistance: state.dailyDistance,
    daysPerWeek: state.daysPerWeek,
    monthlyElectricity: state.monthlyElectricity,
    dietPreference: state.dietPreference,
    recyclingHabits: state.recyclingHabits,
    monthlyEmissions: state.monthlyEmissions,
    sustainabilityScore: state.sustainabilityScore,
    transportShare: state.transportShare,
    energyShare: state.energyShare,
    lifestyleShare: state.lifestyleShare,
    drivingReduction: state.drivingReduction,
    energyReduction: state.energyReduction,
    reductionGoal: state.reductionGoal,
    completedActions: state.completedActions
  }));
}

/**
 * Syncs the in-memory state variables to the corresponding DOM input/slider elements.
 *
 * @returns {void}
 */
function syncInputsFromState() {
  const fields = {
    'vehicle-type': state.vehicleType,
    'daily-distance': state.dailyDistance,
    'days-per-week': state.daysPerWeek,
    'monthly-electricity': state.monthlyElectricity,
    'diet-preference': state.dietPreference,
    'recycling-habits': state.recyclingHabits
  };

  for (const [id, val] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (el && val !== undefined) {
      el.value = val;
    }
  }

  const goalSlider = document.getElementById('reduction-goal');
  if (goalSlider && state.reductionGoal !== undefined) {
    goalSlider.value = state.reductionGoal;
  }

  const drivingSlider = document.getElementById('reduce-driving-slider');
  if (drivingSlider && state.drivingReduction !== undefined) {
    drivingSlider.value = state.drivingReduction;
  }

  const energySlider = document.getElementById('reduce-energy-slider');
  if (energySlider && state.energyReduction !== undefined) {
    energySlider.value = state.energyReduction;
  }
}

// ================= SECTION 5 — ROUTING & TAB NAVIGATION =================

/**
 * Initializes tab routing by binding click event listeners to the desktop
 * and mobile navigation buttons. Also configures standard WAI-ARIA keyboard
 * arrow-key navigation for the tablist buttons.
 *
 * @returns {void}
 */
function initTabRouting() {
  // Fix #12: Use the module-level TABS constant instead of a duplicate local array.
  const tabs = TABS;

  tabs.forEach(tab => {
    // Desktop Nav Click
    const btnEl = document.getElementById(tab.btn);
    if (btnEl) {
      btnEl.addEventListener('click', () => {
        switchView(tab.id);
      });
    }

    // Mobile Nav Click
    const mobileBtnEl = document.getElementById(tab.mobileBtn);
    if (mobileBtnEl) {
      mobileBtnEl.addEventListener('click', () => {
        switchView(tab.id);
      });
    }
  });

  // WAI-ARIA Arrow key tab-list routing for keyboard accessibility
  const desktopNav = document.querySelector('nav[role="tablist"]');
  if (desktopNav) {
    desktopNav.addEventListener('keydown', (e) => {
      const activeEl = document.activeElement;
      if (!activeEl || activeEl.getAttribute('role') !== 'tab') return;
      
      const buttons = Array.from(desktopNav.querySelectorAll('[role="tab"]'));
      const index = buttons.indexOf(activeEl);
      if (index === -1) return;

      let nextIdx = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        nextIdx = (index + 1) % buttons.length;
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        nextIdx = (index - 1 + buttons.length) % buttons.length;
      } else if (e.key === 'Home') {
        nextIdx = 0;
      } else if (e.key === 'End') {
        nextIdx = buttons.length - 1;
      }

      if (nextIdx !== -1) {
        e.preventDefault();
        const targetTab = buttons[nextIdx];
        targetTab.focus();
        const tabConf = tabs.find(t => t.btn === targetTab.id);
        if (tabConf) {
          switchView(tabConf.id);
        }
      }
    });
  }
}

/**
 * Transitions the visible tab panel and updates all nav button states.
 * Also manages:
 *   • ARIA — sets aria-selected=true/false on tab buttons (Accessibility)
 *   • State — stores active selection in state.currentTab
 *   • Globe — resizes canvas on globe entry; pauses render loop on other tabs (Efficiency)
 *   • Compare — re-syncs chart data when entering the compare tab
 *
 * @param {string} tabId - The target tab identifier ('dashboard'|'globe'|'coach'|'compare')
 * @returns {void}
 */
function switchView(tabId) {
  // Fix #12: Use the module-level TABS constant instead of a duplicate local array.
  const tabs = TABS;

  // Track the active tab in state
  state.currentTab = tabId;

  tabs.forEach(t => {
    const viewEl     = document.getElementById(t.view);
    const btnEl      = document.getElementById(t.btn);
    const mobileBtnEl = document.getElementById(t.mobileBtn);
    const isActive   = t.id === tabId;

    if (isActive) {
      if (viewEl) viewEl.classList.remove('hidden');
      // Set active desktop class + ARIA
      if (btnEl) {
        btnEl.className = "flex items-center gap-4 px-4 py-3.5 rounded-xl font-heading font-semibold text-sm transition-all duration-300 text-left text-teal-400 bg-teal-500/10 border border-teal-500/20 shadow-[0_0_15px_rgba(20,184,166,0.15)]";
        btnEl.setAttribute('aria-selected', 'true');
        btnEl.setAttribute('tabindex', '0');
      }
      // Set active mobile class
      if (mobileBtnEl) {
        mobileBtnEl.className = "flex flex-col items-center justify-center gap-1 text-teal-400 transition-all";
        mobileBtnEl.setAttribute('aria-selected', 'true');
      }
    } else {
      if (viewEl) viewEl.classList.add('hidden');
      // Set inactive desktop class + ARIA
      if (btnEl) {
        btnEl.className = "flex items-center gap-4 px-4 py-3.5 rounded-xl font-heading font-semibold text-sm transition-all duration-300 text-left text-slate-400 hover:text-slate-200 hover:bg-white/5";
        btnEl.setAttribute('aria-selected', 'false');
        btnEl.setAttribute('tabindex', '-1');
      }
      // Set inactive mobile class
      if (mobileBtnEl) {
        mobileBtnEl.className = "flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-slate-200 transition-all";
        mobileBtnEl.setAttribute('aria-selected', 'false');
      }
    }
  });

  // ── Globe tab: manage Three.js render loop (Efficiency) ──────────────────
  // Only run the costly WebGL render loop when the globe panel is visible.
  if (tabId === 'globe') {
    handleResize();
    if (typeof animateGlobe === 'function' && !animId) {
      animateGlobe(); // resume on enter
    }
  } else {
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  }

  // Re-sync comparisons if entering compare tab
  if (tabId === 'compare') {
    updateComparisonTab();
  }
}

// ================= SECTION 6 — CALCULATOR & CARBON ENGINE =================

/**
 * Registers DOM event listeners for all calculator input fields, action buttons,
 * simulator sliders, and the action planner goal slider.
 * Must be called once during DOMContentLoaded initialization.
 * @returns {void}
 */
function setupEcoSenseCalculatorEvents() {
  const inputs = [
    'vehicle-type', 'daily-distance', 'days-per-week', 
    'monthly-electricity', 'diet-preference', 'recycling-habits'
  ];

  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => runEcoSenseCalculator());
      el.addEventListener('change', () => runEcoSenseCalculator());
    }
  });

  const calcBtn = document.getElementById('calculate-btn');
  if (calcBtn) {
    calcBtn.addEventListener('click', () => {
      runEcoSenseCalculator();
      calcBtn.innerText = 'Impact Calculated! ✓';
      calcBtn.className = "w-full mt-4 bg-emerald-500 hover:bg-emerald-600 text-white font-heading font-bold py-2.5 rounded-xl text-xs transition-all duration-300 shadow-[0_0_15px_rgba(16,185,129,0.25)]";
      setTimeout(() => {
        calcBtn.innerText = 'Calculate My Impact';
        calcBtn.className = "w-full mt-4 bg-teal-500 hover:bg-teal-600 text-white font-heading font-bold py-2.5 rounded-xl text-xs transition-all duration-300 shadow-[0_0_15px_rgba(20,184,166,0.25)]";
      }, 1500);
    });
  }

  // Simulator Sliders
  const drivingSlider = document.getElementById('reduce-driving-slider');
  if (drivingSlider) {
    drivingSlider.addEventListener('input', () => updateSimulatorUI());
  }

  const energySlider = document.getElementById('reduce-energy-slider');
  if (energySlider) {
    energySlider.addEventListener('input', () => updateSimulatorUI());
  }

  // Planner Goal Slider
  const goalSlider = document.getElementById('reduction-goal');
  if (goalSlider) {
    // Fix #6: Also regenerate the action plan items when the goal percentage changes.
    // Previously only the label text updated; the plan list stayed stale.
    goalSlider.addEventListener('input', () => {
      updateActionPlannerUI();
      generateActionPlan();
    });
  }

  // Generate Plan button
  const generateBtn = document.getElementById('generate-plan-btn');
  if (generateBtn) {
    generateBtn.addEventListener('click', () => generateActionPlan());
  }
}

/**
 * Reads all calculator input fields, computes transport/energy/lifestyle
 * emissions and a sustainability score [0–100], persists results to state,
 * then calls the downstream UI update functions.
 *
 * Emissions model:
 *   transport  = dailyDistance × daysPerWeek × 4.33 weeks/mo × vehicleFactor
 *   energy     = monthlyKwh × 0.82 (Indian grid: kg CO₂e/kWh)
 *   lifestyle  = dietFactor + recyclingFactor
 *   score      = clamp(0, 100, round(100 − total ÷ 5))
 *
 * @returns {void}
 */
function runEcoSenseCalculator() {
  const vehicleType = document.getElementById('vehicle-type').value;
  const dailyDistance = parseFloat(document.getElementById('daily-distance').value) || 0;
  const daysPerWeek = parseFloat(document.getElementById('days-per-week').value) || 0;
  const monthlyElectricity = parseFloat(document.getElementById('monthly-electricity').value) || 0;
  const dietPreference = document.getElementById('diet-preference').value;
  const recyclingHabits = document.getElementById('recycling-habits').value;

  // Save inputs to state
  state.vehicleType = vehicleType;
  state.dailyDistance = dailyDistance;
  state.daysPerWeek = daysPerWeek;
  state.monthlyElectricity = monthlyElectricity;
  state.dietPreference = dietPreference;
  state.recyclingHabits = recyclingHabits;

  // Transport calculation
  // Factors: Petrol/Diesel Car = 0.20, Electric Car = 0.05, Two-Wheeler = 0.10, Public Transit = 0.03, None = 0.00
  let transportFactor = 0.0;
  if (vehicleType === 'Car (Petrol/Diesel)') transportFactor = 0.20;
  else if (vehicleType === 'Car (Electric)') transportFactor = 0.05;
  else if (vehicleType === 'Two-Wheeler') transportFactor = 0.10;
  else if (vehicleType === 'Public Transit') transportFactor = 0.03;

  const transportEmissions = dailyDistance * daysPerWeek * 4.33 * transportFactor;

  // Energy calculation
  const energyEmissions = monthlyElectricity * 0.82;

  // Lifestyle calculation
  // Diet: Mixed = 90, Vegetarian = 50, Vegan = 30
  // Recycling: Never = 30, Sometimes = 10, Always = 0
  let dietFactor = 90;
  if (dietPreference === 'Vegetarian') dietFactor = 50;
  else if (dietPreference === 'Vegan') dietFactor = 30;

  let recyclingFactor = 10;
  if (recyclingHabits === 'Never') recyclingFactor = 30;
  else if (recyclingHabits === 'Always') recyclingFactor = 0;

  const lifestyleEmissions = dietFactor + recyclingFactor;

  // Total monthly emissions
  const totalEmissions = transportEmissions + energyEmissions + lifestyleEmissions;

  // Sustainability score
  // Fix #4: Calibrated formula — 0 kg/mo = 100 score, 500 kg/mo = 0 score.
  // Previous divider (8.0) was arbitrary and the floor was 10, which hid poor performance.
  const score = Math.max(0, Math.min(100, Math.round(100 - (totalEmissions / 5.0))));

  // Save results to state
  state.monthlyEmissions = totalEmissions;
  state.sustainabilityScore = score;
  state.transportShare = transportEmissions;
  state.energyShare = energyEmissions;
  state.lifestyleShare = lifestyleEmissions;

  // Update legacy daily scores for compatibility
  state.dailyScore = totalEmissions / 30.0;
  state.dailyBaseScore = totalEmissions / 30.0;
  state.earthsNeeded = parseFloat((0.5 + (state.dailyScore / 5.0) * 1.0).toFixed(1));

  // Sync quizAnswers structure for AI coach prompt context compatibility.
  // Fix #7: solar is NOT inferred from vehicle type — they are unrelated properties.
  // Fix #17: commuteMode values now align with EMISSIONS_FACTORS.commute keys,
  //          including the new 'electric' key so NaN is avoided in offline AI responses.
  state.quizAnswers = {
    commuteDist: dailyDistance,
    commuteMode: vehicleType === 'Car (Petrol/Diesel)' ? 'drive-alone'
      : (vehicleType === 'Car (Electric)'  ? 'electric'
      : (vehicleType === 'Two-Wheeler'     ? 'twowheeler'
      : (vehicleType === 'Public Transit'  ? 'transit' : 'active'))),
    diet: dietPreference.toLowerCase(),
    energyBill: Math.round(monthlyElectricity * 8), // rough bill estimate (₹/mo)
    energyAc: 0,
    energyGas: 0,
    solar: false // Solar panel ownership is a separate user input, not inferred from the vehicle
  };

  saveStateToStorage();

  // Update UI Elements
  updateCalculatorUI();
}

/**
 * Syncs the computed carbon metrics from state to the corresponding HTML progress bars,
 * text share indicators, and sustainability score rings/labels in the Dashboard view.
 *
 * @returns {void}
 */
function updateCalculatorUI() {
  // 1. Carbon Footprint display
  const footprintEl = document.getElementById('carbon-footprint');
  if (footprintEl) {
    footprintEl.innerText = Math.round(state.monthlyEmissions);
  }

  // Progress share text
  const txtTransportShare = document.getElementById('txt-transport-share');
  if (txtTransportShare) txtTransportShare.innerText = `${Math.round(state.transportShare)} kg`;
  
  const txtEnergyShare = document.getElementById('txt-energy-share');
  if (txtEnergyShare) txtEnergyShare.innerText = `${Math.round(state.energyShare)} kg`;

  const txtLifestyleShare = document.getElementById('txt-lifestyle-share');
  if (txtLifestyleShare) txtLifestyleShare.innerText = `${Math.round(state.lifestyleShare)} kg`;

  // Progress bars widths (normalize relative to total or fixed max)
  const total = Math.max(1, state.transportShare + state.energyShare + state.lifestyleShare);
  
  const barTransport = document.getElementById('bar-transport');
  if (barTransport) barTransport.style.width = `${(state.transportShare / total) * 100}%`;

  const barEnergy = document.getElementById('bar-energy');
  if (barEnergy) barEnergy.style.width = `${(state.energyShare / total) * 100}%`;

  const barLifestyle = document.getElementById('bar-lifestyle');
  if (barLifestyle) barLifestyle.style.width = `${(state.lifestyleShare / total) * 100}%`;

  // 2. Sustainability Score
  const scoreEl = document.getElementById('sustainability-score');
  if (scoreEl) scoreEl.innerText = state.sustainabilityScore;

  // Radial stroke update
  const circleEl = document.getElementById('score-circle-stroke');
  if (circleEl) {
    const offset = 264 - (state.sustainabilityScore / 100) * 264;
    circleEl.style.strokeDashoffset = offset;
    
    // Color coding matching score
    if (state.sustainabilityScore >= 80) {
      circleEl.setAttribute('stroke', '#10b981'); // Green
    } else if (state.sustainabilityScore >= 50) {
      circleEl.setAttribute('stroke', '#eab308'); // Yellow
    } else {
      circleEl.setAttribute('stroke', '#f43f5e'); // Red
    }
  }

  const statusEl = document.getElementById('sustainability-status');
  if (statusEl) {
    if (state.sustainabilityScore >= 80) {
      statusEl.innerText = '🌏 Optimal';
      statusEl.className = 'text-base font-extrabold text-emerald-400 font-heading flex items-center gap-1';
    } else if (state.sustainabilityScore >= 50) {
      statusEl.innerText = '🌏 Improving';
      statusEl.className = 'text-base font-extrabold text-yellow-400 font-heading flex items-center gap-1';
    } else {
      statusEl.innerText = '🌏 Deficit';
      statusEl.className = 'text-base font-extrabold text-rose-500 font-heading flex items-center gap-1';
    }
  }

  // 3. Update AI recommendations & Simulator & Action planner inputs/outputs
  updateAIRecommendations();
  updateSimulatorUI();
  updateActionPlannerUI();
}

/**
 * Evaluates active state parameters and dynamically renders customized carbon-reduction
 * recommendation cards as semantic <article> elements under the AI Assistant panel.
 *
 * @returns {void}
 */
function updateAIRecommendations() {
  const container = document.getElementById('recommendations-container');
  if (!container) return;

  container.innerHTML = '';
  let recommendations = [];

  if (state.recyclingHabits === 'Sometimes' || state.recyclingHabits === 'Never') {
    recommendations.push({
      title: 'Improve Recycling Habits',
      desc: 'Set up separate bins for plastic, paper, and metal to reduce lifestyle landfill waste.',
      offset: 20
    });
  }

  if (state.dietPreference === 'Mixed') {
    recommendations.push({
      title: 'Adopt a Plant-Based Diet',
      desc: 'Transition meals to plant-based items. Vegetarian diet halves lifestyle food emissions.',
      offset: 40
    });
  }

  if (state.vehicleType === 'Car (Petrol/Diesel)') {
    const weeklyTravel = state.dailyDistance * state.daysPerWeek;
    if (weeklyTravel > 20) {
      recommendations.push({
        title: 'Switch Commute to Transit/Bike',
        desc: 'Utilize public transit or a bicycle for daily commuting to bypass fuel combustion.',
        offset: 50
      });
    }
    recommendations.push({
      title: 'Switch to Electric Vehicle',
      desc: 'An electric vehicle reduces transport baseline carbon output by up to 75%.',
      offset: 45
    });
  }

  if (state.monthlyElectricity > 100) {
    recommendations.push({
      title: 'Optimize AC and Cooling',
      desc: 'Set AC to 26°C, unplug standby electronics, and use natural ventilation when possible.',
      offset: 30
    });
  }

  // If no recommendations, add a fallback
  if (recommendations.length === 0) {
    recommendations.push({
      title: 'Maintain Eco-Friendly Habits',
      desc: 'You have chosen highly sustainable lifestyle configurations. Keep inspiring others!',
      offset: 0
    });
  }

  let totalOffset = 0;

  recommendations.forEach(rec => {
    totalOffset += rec.offset;
    const card = document.createElement('article');
    card.className = "p-3.5 rounded-xl border border-white/5 bg-slate-900/40 flex justify-between items-center gap-3";
    card.innerHTML = `
      <div class="flex flex-col gap-0.5">
        <span class="text-xs font-bold text-white font-heading">${rec.title}</span>
        <span class="text-[10px] text-slate-400 leading-relaxed">${rec.desc}</span>
      </div>
      <span class="text-xs font-heading font-extrabold px-2 py-1 rounded bg-teal-500/15 text-teal-400 whitespace-nowrap">
        ↓ ${rec.offset} kg
      </span>
    `;
    container.appendChild(card);
  });

  const totalImprovementEl = document.getElementById('txt-total-improvement');
  if (totalImprovementEl) {
    totalImprovementEl.innerText = totalOffset;
  }
}

/**
 * Updates the Impact Simulator panel UI. Reads the slider values, enforces constraints based on
 * computed transport/energy carbon shares, clamps visual thumb positions, and projects final savings.
 *
 * @returns {void}
 */
function updateSimulatorUI() {
  const drivingSlider = document.getElementById('reduce-driving-slider');
  const energySlider = document.getElementById('reduce-energy-slider');

  if (!drivingSlider || !energySlider) return;

  const maxDriving = Math.round(state.transportShare);
  const maxEnergy = Math.round(state.energyShare);

  drivingSlider.max = maxDriving;
  energySlider.max = maxEnergy;

  // Fix #5: Explicitly clamp and reassign slider values when the calculated max drops.
  // Setting .value programmatically causes the browser to reposition the thumb
  // immediately, preventing the visual desync the user would otherwise see.
  if (parseInt(drivingSlider.value) > maxDriving) {
    drivingSlider.value = maxDriving;
  }
  if (parseInt(energySlider.value) > maxEnergy) {
    energySlider.value = maxEnergy;
  }

  state.drivingReduction = parseInt(drivingSlider.value) || 0;
  state.energyReduction = parseInt(energySlider.value) || 0;

  // Update text values
  document.getElementById('sim-driving-val').innerText = `-${state.drivingReduction} kg`;
  document.getElementById('sim-energy-val').innerText = `-${state.energyReduction} kg`;

  const totalEmissions = state.monthlyEmissions;
  const afterEmissions = Math.max(0, totalEmissions - state.drivingReduction - state.energyReduction);
  const reductionPercent = totalEmissions > 0 ? ((totalEmissions - afterEmissions) / totalEmissions) * 100 : 0;

  document.getElementById('sim-current').innerText = `${Math.round(totalEmissions)} kg`;
  document.getElementById('sim-after').innerText = `${Math.round(afterEmissions)} kg`;
  document.getElementById('sim-reduction').innerText = `${reductionPercent.toFixed(1)}%`;
}

/**
 * Syncs the Carbon Action Planner target slider percentage configuration to the active UI state and label.
 *
 * @returns {void}
 */
function updateActionPlannerUI() {
  const goalSlider = document.getElementById('reduction-goal');
  const goalVal = document.getElementById('reduction-goal-val');
  if (goalSlider && goalVal) {
    goalVal.innerText = `${goalSlider.value}% Goal`;
    state.reductionGoal = parseInt(goalSlider.value);
  }
}

/**
 * Generates a structured 30-day carbon action plan list based on the user's active reduction target.
 * Renders plan items as semantic <li> elements to populate the parent <ol> container.
 *
 * @returns {void}
 */
function generateActionPlan() {
  const container = document.getElementById('plan-output-container');
  if (!container) return;

  container.innerHTML = '';
  const goal = state.reductionGoal;
  
  let plans = [
    { day: 'Days 1-5', title: 'Set cooling units to 26°C', desc: 'Saves around 10% of home energy emissions immediately.' },
    { day: 'Days 6-10', title: 'Introduce Meatless meals', desc: 'Try replacing dairy/meat lunches with vegetable proteins.' }
  ];

  if (goal >= 20) {
    plans.push({ day: 'Days 11-15', title: 'Carpool or Shared Transit', desc: 'Shift travel trips to shared vans or local metro options.' });
  }
  if (goal >= 30) {
    plans.push({ day: 'Days 16-20', title: 'Unplug Standby Devices', desc: 'Prevent vampire power draw on appliances when inactive.' });
  }
  if (goal >= 40) {
    plans.push({ day: 'Days 21-25', title: 'Air Dry Clothes', desc: 'Ditch heavy washer heating coils for natural balcony line drying.' });
  }
  if (goal >= 50) {
    plans.push({ day: 'Days 26-30', title: 'Implement Zero-Waste Sourcing', desc: 'Use canvas shopping bags to fully refuse vendor plastic bags.' });
  }

  plans.forEach((plan, idx) => {
    const item = document.createElement('li');
    item.className = "flex items-start gap-3 p-2.5 rounded-lg bg-white/5 border border-white/5 text-xs text-slate-300";
    item.innerHTML = `
      <span class="mt-0.5 w-5 h-5 shrink-0 flex items-center justify-center rounded-full bg-violet-500/20 border border-violet-500/30 text-[10px] font-extrabold text-violet-400 font-heading">${idx + 1}</span>
      <div class="flex flex-col gap-0.5">
        <span class="font-bold text-white font-heading">${plan.day}: ${plan.title}</span>
        <span class="text-[10px] text-slate-400 leading-relaxed">${plan.desc}</span>
      </div>
    `;
    container.appendChild(item);
  });
}

// ================= THREE.JS GLOBE WORKSPACE =================

/**
 * autoRotate — pauses when the user grabs the globe, resumes 1.5 s after release.
 * Declared at module scope so animateGlobe() and setupGlobeDrag() can share it.
 */
let autoRotate = true;

/**
 * Initializes the Three.js WebGL 3D Globe visualization.
 * Creates the scene, camera, renderer, lighting, earth geometries, custom shaders,
 * loads the Earth texture, sets up city hotspot markers, and binds drag/resize events.
 *
 * @returns {void}
 */
function initThreeGlobe() {
  const canvasTarget = document.getElementById('canvas-3d-target');
  const globeWrap = document.getElementById('globe-container');
  if (!canvasTarget || !globeWrap) return;

  // Measure the visible wrapper — canvasTarget may report 0 height before CSS layout
  const width = globeWrap.clientWidth || 520;
  const height = globeWrap.clientHeight || 460;

  // ──── Scene & Camera ──────────────────────────────────────────────────────────
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
  camera.position.z = 2.65;

  // ──── Renderer ──────────────────────────────────────────────────────────
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // Position canvas absolutely so it fills canvasTarget regardless of flex/height cascade
  renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
  canvasTarget.appendChild(renderer.domElement);

  // ──── Earth Group ──────────────────────────────────────────────────────────
  earthGroup = new THREE.Group();
  scene.add(earthGroup);

  // ──── Three-point Lighting ──────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0x334d88, 0.60));        // cool-blue sky scatter
  const sunLight = new THREE.DirectionalLight(0xfff6e0, 1.30);
  sunLight.position.set(5, 3, 5);
  scene.add(sunLight);
  const fillLight = new THREE.DirectionalLight(0x1a2855, 0.38); // back-left fill
  fillLight.position.set(-4, -2, -4);
  scene.add(fillLight);

  // ──── Earth Surface Shaders ──────────────────────────────────────────────────────────
  const earthVS = `
    varying vec3 vNormal;
    varying vec2 vUv;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const earthFS = `
    uniform sampler2D u_earthTexture;
    uniform float     u_health;        // 1.0 = pristine, 0.0 = heavily polluted
    uniform float     u_textureReady;  // 1.0 once CDN texture has loaded
    varying vec3 vNormal;
    varying vec2 vUv;

    void main() {
      vec3 N = normalize(vNormal);

      // Base colour: real texture or ocean-blue placeholder
      vec3 albedo;
      if (u_textureReady > 0.5) {
        albedo = texture2D(u_earthTexture, vUv).rgb;
      } else {
        albedo = vec3(0.05, 0.22, 0.60); // placeholder ocean blue
      }

      // Diffuse + 0.35 ambient floor (dark side stays colored, not black)
      vec3  lightDir = normalize(vec3(2.5, 1.5, 3.0));
      float diff     = max(dot(N, lightDir), 0.0);
      float light    = 0.35 + 0.65 * diff;

      // Health-based pollution desaturation
      vec3 polluted  = albedo * vec3(0.60, 0.50, 0.38);
      vec3 litAlbedo = mix(polluted, albedo, u_health);

      // Specular glint on ocean pixels (blue-dominant heuristic)
      float ocean = clamp((albedo.b - max(albedo.r, albedo.g)) * 4.0, 0.0, 1.0);
      vec3  H     = normalize(lightDir + vec3(0.0, 0.0, 1.0));
      float spec  = pow(max(dot(N, H), 0.0), 80.0) * ocean * diff * 0.55;

      // Inner atmospheric rim glow
      float rim      = pow(1.0 - max(dot(N, vec3(0.0, 0.0, 1.0)), 0.0), 4.0);
      vec3  cleanAtm = vec3(0.05, 0.78, 0.96);
      vec3  smogAtm  = vec3(0.96, 0.46, 0.06);
      vec3  atm      = mix(smogAtm, cleanAtm, u_health) * rim * 0.38;

      gl_FragColor = vec4(litAlbedo * light + vec3(spec) + atm, 1.0);
    }
  `;

  // 1x1 placeholder blue pixel so the globe renders immediately while CDN loads
  const placeholderPx = new Uint8Array([18, 60, 160, 255]);
  const placeholderTex = new THREE.DataTexture(placeholderPx, 1, 1, THREE.RGBAFormat);
  placeholderTex.needsUpdate = true;

  const earthMat = new THREE.ShaderMaterial({
    vertexShader: earthVS,
    fragmentShader: earthFS,
    uniforms: {
      u_earthTexture: { value: placeholderTex },
      u_health: { value: 0.80 },
      u_textureReady: { value: 0.0 }
    }
  });

  // ──── Real Earth Texture (CORS-enabled CDN) ───────────────────────────────────
  // Loads the three-globe package's equirectangular Blue-Marble day map.
  const TX_PRIMARY = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-day.jpg';
  const TX_FALLBACK = 'https://unpkg.com/three-globe/example/img/earth-day.jpg';

  /**
   * Loads the Earth texture from primary CDN URL or attempts fallback URL if loading fails.
   *
   * @param {string} url - Primary CDN URL for the texture image
   * @param {string|null} fallbackUrl - Fallback URL to try if the primary URL fails
   * @returns {void}
   */
  function loadEarthTexture(url, fallbackUrl) {
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        earthMat.uniforms.u_earthTexture.value = tex;
        earthMat.uniforms.u_textureReady.value = 1.0;
      },
      undefined,
      () => { if (fallbackUrl) loadEarthTexture(fallbackUrl, null); }
    );
  }
  loadEarthTexture(TX_PRIMARY, TX_FALLBACK);

  // ──── Earth Sphere Mesh ──────────────────────────────────────────────────────────
  earthMesh = new THREE.Mesh(new THREE.SphereGeometry(1.0, 64, 64), earthMat);
  earthGroup.add(earthMesh);

  // ──── Outer Atmosphere Glow Shell (BackSide + Additive blending) ────────────────
  const atmMat = new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vNormal;
      uniform float u_health;
      void main() {
        vec3 N = normalize(vNormal);
        // BackSide normals point inward — negative dot product = silhouette rim
        float facing = max(0.0, -dot(N, vec3(0.0, 0.0, 1.0)));
        float rim    = pow(facing, 2.2);
        vec3  clean  = vec3(0.08, 0.84, 1.00);
        vec3  smog   = vec3(1.00, 0.46, 0.05);
        gl_FragColor = vec4(mix(smog, clean, u_health) * 1.55, rim * 0.90);
      }
    `,
    uniforms: { u_health: { value: 0.80 } },
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false
  });
  atmosphereMesh = new THREE.Mesh(new THREE.SphereGeometry(1.068, 32, 32), atmMat);
  scene.add(atmosphereMesh);

  // ──── City Hotspot Markers ──────────────────────────────────────────────────────
  // radius 1.02 floats markers just above the surface to avoid z-fighting.
  CITY_HOTSPOTS.forEach((city, index) => {
    const pos = latLonToVector3(city.lat, city.lon, 1.02);

    // Solid glowing dot (small sphere)
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, 10, 10),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(city.color) })
    );
    dot.position.copy(pos);
    earthGroup.add(dot);

    // Translucent ring oriented tangent to the sphere surface
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.024, 0.040, 22),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(city.color),
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78
      })
    );
    ring.position.copy(pos);
    ring.lookAt(pos.clone().multiplyScalar(3.0));
    earthGroup.add(ring);

    cityMeshes.push(dot); // store dot for 2D projection

    const markerEl = document.getElementById(`marker-${index}`);
    if (markerEl) {
      markerEl.addEventListener('mouseenter', () => displayCityDetails(city));
      markerEl.addEventListener('click', () => displayCityDetails(city));
    }
  });

  // ──── Drag + animation ────────────────────────────────────────────────────────
  setupGlobeDrag(globeWrap); // attach to the card wrapper for full hit-area coverage
  animateGlobe();
  window.addEventListener('resize', handleResize);
}

/**
 * Converts geographic latitude and longitude coordinates in degrees into a 3D Cartesian Vector3 position.
 * Aligns mapping structure with SphereGeometry texture coordinates.
 *
 * @param {number} lat - Latitude in degrees (-90 to 90)
 * @param {number} lon - Longitude in degrees (-180 to 180)
 * @param {number} [radius=1.0] - Sphere radius
 * @returns {THREE.Vector3} Cartesian 3D coordinates representing the location
 */
function latLonToVector3(lat, lon, radius = 1.0) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/**
 * Populates the city details card overlay below the globe with parameters of the hovered/clicked city.
 *
 * @param {Object} city - The city hotspot metadata object containing name, intensity, desc, and color
 * @returns {void}
 */
function displayCityDetails(city) {
  document.getElementById('city-card-name').innerText = city.name;
  const intensityEl = document.getElementById('city-card-intensity');
  intensityEl.innerText = `${city.intensity} g CO\u2082/kWh`;
  document.getElementById('city-card-desc').innerText = city.desc;
  const indicator = document.getElementById('city-card-indicator');
  indicator.style.backgroundColor = city.color;
  intensityEl.style.borderColor = city.color;
  intensityEl.style.color = city.color;
}

/**
 * Configures interactive pointer event listeners for the Earth Globe container to allow rotation.
 * Pauses auto-rotation on pointerdown, rotates the globe based on delta movements, clamps the
 * vertical rotation, and resumes auto-rotation with a delay upon release.
 *
 * @param {HTMLElement} container - The DOM wrapper element capturing pointer movements
 * @returns {void}
 */
function setupGlobeDrag(container) {
  let isDragging = false;
  let prevX = 0, prevY = 0;

  container.style.cursor = 'grab';

  container.addEventListener('pointerdown', (e) => {
    isDragging = true;
    autoRotate = false;
    prevX = e.clientX;
    prevY = e.clientY;
    container.setPointerCapture(e.pointerId);
    container.style.cursor = 'grabbing';
  });

  container.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    earthGroup.rotation.y += (e.clientX - prevX) * 0.006;
    earthGroup.rotation.x = Math.max(
      -Math.PI / 2.5,
      Math.min(Math.PI / 2.5, earthGroup.rotation.x + (e.clientY - prevY) * 0.006)
    );
    prevX = e.clientX;
    prevY = e.clientY;
  });

  const endDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    container.style.cursor = 'grab';
    setTimeout(() => { autoRotate = true; }, 1500);
  };
  container.addEventListener('pointerup', endDrag);
  container.addEventListener('pointercancel', endDrag);
  // Fix #2: pointerleave intentionally omitted.
  // setPointerCapture() keeps routing pointer events to this element even when the
  // cursor strays outside its bounds, so pointerleave fired spuriously mid-drag and
  // abruptly terminated the rotation. pointerup + pointercancel are sufficient.
}

// â”€â”€ Render Loop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let targetHealth = 0.80;
let currentHealth = 0.80;

/**
 * Main WebGL rendering animation loop for the Three.js Earth Globe.
 * Calculates environmental health scaling, updates shader uniforms, performs auto-rotation,
 * and handles screen projection of city markers in real time.
 *
 * @returns {void}
 */
function animateGlobe() {
  animId = requestAnimationFrame(animateGlobe);

  // Dynamic aspect ratio and size synchronization check to prevent layout desyncs
  const wrap = document.getElementById('canvas-3d-target') || document.getElementById('globe-container');
  if (wrap && renderer && camera) {
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w > 0 && h > 0) {
      const canvas = renderer.domElement;
      if (canvas.width !== w || canvas.height !== h) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    }
  }

  if (earthMesh && earthMesh.material) {
    targetHealth = Math.min(1.0, Math.max(0.0, 1.0 - state.dailyScore / 24.0));
    currentHealth += (targetHealth - currentHealth) * 0.055;
    earthMesh.material.uniforms.u_health.value = currentHealth;
  }
  if (atmosphereMesh && atmosphereMesh.material) {
    atmosphereMesh.material.uniforms.u_health.value = currentHealth;
  }

  // Atmosphere status badge
  const dot = document.getElementById('globe-smog-indicator');
  const txt = document.getElementById('globe-smog-text');
  if (dot && txt) {
    if (currentHealth >= 0.7) {
      dot.className = 'w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]';
      txt.innerText = 'Oasis Atmos'; txt.className = 'text-emerald-400';
    } else if (currentHealth >= 0.4) {
      dot.className = 'w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b]';
      txt.innerText = 'Moderate Smog Haze'; txt.className = 'text-amber-400';
    } else {
      dot.className = 'w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]';
      txt.innerText = 'Distressed Industrial Smog'; txt.className = 'text-rose-500';
    }
  }

  if (autoRotate) earthGroup.rotation.y += 0.0020;

  projectCityMarkers();
  renderer.render(scene, camera);
}

/**
 * Projects each 3D city marker's world position onto 2D screen pixels.
 * Uses backface culling checks to determine visibility, then updates positions and display states
 * of corresponding HTML marker overlay elements.
 *
 * @returns {void}
 */
function projectCityMarkers() {
  const wrap = document.getElementById('canvas-3d-target') || document.getElementById('globe-container');
  if (!wrap || !renderer) return;
  const W = wrap.clientWidth, H = wrap.clientHeight;
  const v = new THREE.Vector3();

  CITY_HOTSPOTS.forEach((city, index) => {
    const mesh = cityMeshes[index];
    if (!mesh) return;
    mesh.getWorldPosition(v);
    // Fix #15: Correct backface culling — a marker is visible when the vector from
    // it to the camera and the surface normal both point into the same hemisphere.
    // The previous formula had the operand order wrong (< 0 instead of > 0).
    const toCamera = camera.position.clone().sub(v);
    const normal   = v.clone().normalize();
    const visible  = toCamera.dot(normal) > 0;
    const el = document.getElementById(`marker-${index}`);
    if (!el) return;
    if (visible) {
      const p = v.clone().project(camera);
      // Translate by -5px horizontally instead of -50% to align the center of the 10px dot exactly with its 3D coordinates.
      el.style.transform = `translate(-5px,-50%) translate(${(p.x * 0.5 + 0.5) * W}px,${(-p.y * 0.5 + 0.5) * H}px)`;
      el.style.display = 'flex'; // flex to layout marker-dot + label side by side (fix #14)
    } else {
      el.style.display = 'none';
    }
  });
}

/**
 * Resizes the Three.js WebGL renderer size and updates the perspective camera aspect ratio
 * dynamically on browser window resizing.
 *
 * @returns {void}
 */
function handleResize() {
  const wrap = document.getElementById('globe-container');
  if (!wrap || !renderer || !camera) return;
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if (!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

// ================= ECO-COACH INTERACTIVE CHATBOT LOGIC =================

/**
 * Initializes the Eco-Coach Spark chatbot workspace by binding form submit event handlers,
 * suggested chat bubbles click handlers, and clear chat triggers.
 *
 * @returns {void}
 */
function setupChatbot() {
  const form = document.getElementById('chat-input-form');
  const input = document.getElementById('chat-user-message-input');
  const clearBtn = document.getElementById('btn-clear-chat');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    if (!msg) return;

    input.value = '';

    // Append user bubble
    appendMessage('User', msg);

    // Add typing loader
    const loaderId = appendTypingIndicator();

    try {
      // Connect / Fetch Advice response from Gemini Engine
      const advice = await fetchGeminiCoachAdvice(msg);
      removeTypingIndicator(loaderId);
      appendMessage('Spark', advice);
    } catch (err) {
      console.error('Chat error catch:', err);
      removeTypingIndicator(loaderId);
      appendMessage('Spark', 'Pardon me, my neural linkage experienced a connection error. Check your network or verify the Google Gemini API key configuration settings.');
    }
  });

  // Setup suggest triggers
  const suggestionBtns = document.querySelectorAll('.chat-bubble-suggestion');
  suggestionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      input.value = btn.innerText;
      // Fix #1: Must set bubbles:true and cancelable:true so the async submit
      // handler (which calls e.preventDefault()) actually fires on the event.
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
  });

  clearBtn.addEventListener('click', () => {
    const chatContainer = document.getElementById('chat-messages-container');
    chatContainer.innerHTML = '';
    triggerSparkAdvice('welcome');
  });

  // Render initial Spark greeting message
  triggerSparkAdvice('welcome');
}

/**
 * Programmatically triggers simulated messages from Spark based on context scenarios (like welcome or onboarding).
 *
 * @param {string} scenario - The trigger context scenario ('welcome'|'onboarding_finished')
 * @returns {void}
 */
function triggerSparkAdvice(scenario) {
  if (scenario === 'welcome') {
    appendMessage('Spark', "Greetings! I'm Spark, your environmental pocket coach. I analyze your footprint and metrics to help you make carbon-saving habits. Ask me for specific tips or tap a suggestion bubble below!");
  } else if (scenario === 'onboarding_finished') {
    const greeting = `Onboarding complete! I've analyzed your initial lifestyle inputs. Your calculated daily carbon score starts at **${state.dailyBaseScore.toFixed(1)} kg CO\u2082e**, demanding **${state.earthsNeeded.toFixed(1)} Earths**. Let's start ticking off green habits on the Dashboard checklist to lower these metrics!`;
    appendMessage('Spark', greeting);
  }
}

/**
 * Appends a bubble to the chatbot conversation message history log.
 * Sanitizes user input before rendering.
 *
 * @security User inputs are sanitized using sanitizeHTML to prevent XSS injection.
 * @param {string} sender - The message sender ('User'|'Spark')
 * @param {string} text - Message text payload to display
 * @returns {void}
 */
function appendMessage(sender, text) {
  const container = document.getElementById('chat-messages-container');
  if (!container) return;

  const msgDiv = document.createElement('div');
  const isUser = sender === 'User';

  if (isUser) {
    // Fix #3: Delegate to the module-level sanitizeHTML() security utility.
    // This prevents XSS — e.g. <img src=x onerror=alert(1)> — and ensures
    // the escaping logic is defined and maintained in exactly one place.
    const safeText = sanitizeHTML(text);
    msgDiv.className = "flex justify-end items-end gap-3.5 max-w-[85%] self-end animate-[fadeIn_0.25s_ease-out]";
    msgDiv.innerHTML = `
      <div class="flex flex-col items-end gap-1">
        <span class="text-[10px] font-bold text-slate-400 font-heading">You</span>
        <div class="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm text-slate-200 rounded-br-none leading-relaxed">
          ${safeText}
        </div>
      </div>
    `;
  } else {
    msgDiv.className = "flex justify-start items-end gap-3.5 max-w-[85%] self-start animate-[fadeIn_0.25s_ease-out]";
    msgDiv.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-500 to-indigo-500 flex items-center justify-center shadow-[0_0_10px_rgba(139,92,246,0.2)] shrink-0 select-none">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5">
          <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path>
          <path d="M12 8a8 8 0 0 1 8 8v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a8 8 0 0 1 8-8z"></path>
        </svg>
      </div>
      <div class="flex flex-col items-start gap-1">
        <span class="text-[10px] font-bold text-slate-400 font-heading">Spark</span>
        <div class="px-4 py-3 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-sm text-violet-200 rounded-bl-none leading-relaxed prose-invert">
          ${text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}
        </div>
      </div>
    `;
  }

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

/**
 * Appends a typing loader indicator bubble to the conversation log.
 *
 * @returns {string|null} The DOM element ID of the typing indicator card, or null
 */
function appendTypingIndicator() {
  const container = document.getElementById('chat-messages-container');
  if (!container) return null;

  const id = 'loader-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = "flex justify-start items-center gap-3.5 self-start";
  div.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-500 to-indigo-500 flex items-center justify-center shrink-0">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5">
        <path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path>
        <path d="M12 8a8 8 0 0 1 8 8v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a8 8 0 0 1 8-8z"></path>
      </svg>
    </div>
    <div class="glass-panel border-glow-violet px-4 py-3 rounded-2xl flex items-center gap-1">
      <span class="typing-dot w-2 h-2 rounded-full bg-violet-400"></span>
      <span class="typing-dot w-2 h-2 rounded-full bg-violet-400"></span>
      <span class="typing-dot w-2 h-2 rounded-full bg-violet-400"></span>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}

/**
 * Removes the dynamic typing loader indicator bubble from the conversation log.
 *
 * @param {string} id - The DOM element ID of the loader to remove
 * @returns {void}
 */
function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

// ================= GEMINI API REQUEST INTERFACES =================

/**
 * Dispatches an asynchronous request containing the user message and computed carbon context
 * to the Vercel proxy. Falls back to direct client-side requests or a simulated offline engine if needed.
 *
 * @param {string} userPrompt - Raw message text sent by the user
 * @returns {Promise<string>} Resolve to Spark's string reply
 */
async function fetchGeminiCoachAdvice(userPrompt) {
  // Build context payload injection referencing metrics
  // Fix #13: state.completedActions is always empty because the checklist UI has
  // not been implemented yet. The '|| None' fallback already handles this gracefully
  // and correctly signals to Gemini that no habits have been logged today.
  const activeHabits = state.completedActions.map(id => {
    const action = CHECKLIST_ACTIONS.find(a => a.id === id);
    return action ? action.title : id;
  }).join(', ') || 'None';

  const systemContext = `You are Spark, an environmental pocket coach in the EcoPulse 2.0 app.
The user's current environmental metrics are:
- Daily Active Carbon Footprint: ${state.dailyScore.toFixed(1)} kg CO2e (Onboarding baseline: ${state.dailyBaseScore.toFixed(1)} kg)
- Earth Score: ${state.earthsNeeded.toFixed(1)} Earths needed
- Checklist habits completed today: [${activeHabits}]
- Profile details: Travel distance of ${state.quizAnswers.commuteDist} km using ${state.quizAnswers.commuteMode}, diet is ${state.quizAnswers.diet}, home energy bill is \u20B9${state.quizAnswers.energyBill}/mo, AC usage is ${state.quizAnswers.energyAc} hrs/day, renewable solar option is ${state.quizAnswers.solar ? 'Active' : 'Inactive'}.

Provide a highly personalized, practical response in 2-3 sentences. Reference their specific metrics (Carbon score or Earths score) and suggest high-impact choices. Keep your answer encouraging and modern.`;

  // 1. Try Vercel Serverless Function First
  try {
    const response = await fetch('/api/coach', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: userPrompt,
        context: systemContext
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.text) {
        return data.text;
      }
    }
  } catch (e) {
    console.warn('Vercel API route not responding, checking client-side key config:', e);
  }

  // 2. Fallback to client-side key (if hardcoded)
  if (state.geminiKey) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${state.geminiKey}`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: `${systemContext}\n\nUser Question: ${userPrompt}` }]
            }
          ]
        })
      });

      if (response.ok) {
        const json = await response.json();
        if (json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0]) {
          return json.candidates[0].content.parts[0].text.trim();
        }
      }
    } catch (err) {
      console.error('Client-side API call failed:', err);
    }
  }

  // 3. Fallback to simulated offline responses
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(getSimulatedOfflineResponse(userPrompt, systemContext));
    }, 950);
  });
}

/**
 * Offline simulation fallback logic. Parses query intent and runs heuristic arithmetic calculations
 * based on current state variables to reply immediately with helpful, context-accurate answers.
 *
 * @param {string} prompt - Raw query string
 * @param {string} context - Injected system metrics context
 * @returns {string} Simulated environmental advice response string
 */
function getSimulatedOfflineResponse(prompt, context) {
  const query = prompt.toLowerCase();

  let resp = "";
  if (query.includes('lower') || query.includes('earth score') || query.includes('reduce')) {
    resp = `To reduce your **${state.earthsNeeded.toFixed(1)} Earths** budget score, I suggest checking off more items on your daily checklist. Adding solar cells or transitioning to electric commuting will also cut your baseline emissions profile substantially.`;
  } else if (query.includes('biggest') || query.includes('carbon source') || query.includes('highest')) {
    // Math logic based on current inputs
    const commuteFactor = EMISSIONS_FACTORS.commute[state.quizAnswers.commuteMode] || 0;
    const commuteC = state.quizAnswers.commuteDist * commuteFactor;
    const dietC = EMISSIONS_FACTORS.diet[state.quizAnswers.diet] || 0;
    const energyC = (state.quizAnswers.energyBill * 0.0033) + (state.quizAnswers.energyAc * 1.2) + (state.quizAnswers.energyGas * 1.4);

    if (commuteC > dietC && commuteC > energyC) {
      resp = `Your biggest daily carbon driver is **commute travel** generating **${commuteC.toFixed(1)} kg CO\u2082e**. Shifting your mode from ${state.quizAnswers.commuteMode} to public transit or cycling will make the biggest dent in your footprint.`;
    } else if (dietC > commuteC && dietC > energyC) {
      resp = `Your **diet choices** represent your highest emissions driver at **${dietC.toFixed(1)} kg CO\u2082e**. Transitioning to a vegetarian or plant-based diet will reduce this metric by up to 70% instantly.`;
    } else {
      resp = `Your **home energy utility load** is your biggest emission source at **${energyC.toFixed(1)} kg CO\u2082e**. Swapping standard appliances for high-efficiency ones and managing AC cooling hours will yield massive reductions.`;
    }
  } else if (query.includes('delhi') || query.includes('grid') || query.includes('india')) {
    resp = `New Delhi's grid intensity stands high at **680 g CO\u2082/kWh** due to its heavy reliance on regional coal power plants. Shifting utility consumption to daytime solar slots helps drive down coal demands.`;
  } else if (query.includes('reykjavik') || query.includes('iceland')) {
    resp = `Reykjavik showcases grid excellence at just **12 g CO\u2082/kWh** by leveraging geothermal hot springs and hydro turbines. It serves as a benchmark model for urban grid cleanups globally.`;
  } else if (query.includes('new york') || query.includes('sydney')) {
    resp = `Both New York (280 g CO\u2082/kWh) and Sydney (590 g CO\u2082/kWh) are scaling solar grid capacities, although coal and natural gas base loads still present key carbon challenges.`;
  } else {
    // General tailored greeting fallback
    resp = `Under your current lifestyle, your daily score sits at **${state.dailyScore.toFixed(1)} kg CO\u2082e**. Completing habits like eating vegetarian meals and drying clothes naturally reduces your footprint in real-time. Keep it up!`;
  }

  return resp;
}

// ================= GLOBAL CARBON COMPARISONS TAB DATA & LOGIC =================

const COUNTRY_COMPARISONS = [
  {
    code: 'IN',
    name: 'India',
    emissions: 1.9,
    fact: 'India has one of the lowest per-capita carbon intensities among G20 nations, largely due to low-meat diets, high public transit usage, and growing residential solar.',
    color: 'from-emerald-500 to-teal-400',
    colorHex: '#10b981'
  },
  {
    code: 'WO',
    name: 'World Average',
    emissions: 4.7,
    fact: 'The current global average per capita. To limit warming to 1.5°C, the IPCC estimates that global per-capita emissions must drop below 2.0 tons by 2030.',
    color: 'from-cyan-500 to-blue-500',
    colorHex: '#3b82f6'
  },
  {
    code: 'DE',
    name: 'Germany',
    emissions: 7.7,
    fact: 'Germany features aggressive renewable targets (Energiewende) but faces grid challenges due to nuclear phaseouts and natural gas dependency for winter heating.',
    color: 'from-amber-500 to-yellow-500',
    colorHex: '#f59e0b'
  },
  {
    code: 'CN',
    name: 'China',
    emissions: 8.0,
    fact: 'China leads the world in absolute wind and solar installs, but its per-capita footprint is high due to coal-intensive manufacturing and heavy industrial output.',
    color: 'from-orange-500 to-red-500',
    colorHex: '#f97316'
  },
  {
    code: 'IS',
    name: 'Iceland',
    emissions: 9.2,
    fact: 'Iceland relies almost 100% on hydro and geothermal for domestic electricity and heating, but high per-capita smelting and flight transport drive up absolute scores.',
    color: 'from-indigo-500 to-violet-500',
    colorHex: '#6366f1'
  },
  {
    code: 'US',
    name: 'United States',
    emissions: 14.4,
    fact: 'The US has high per-capita emissions driven by single-occupancy vehicle commutes, large suburban houses, high heating/cooling loads, and heavy consumer goods demand.',
    color: 'from-rose-500 to-pink-500',
    colorHex: '#f43f5e'
  },
  {
    code: 'AU',
    name: 'Australia',
    emissions: 15.0,
    fact: 'Australia is coal-dependent for utility base grids, has high per-capita transport miles, and features high consumption metrics despite massive residential solar growth.',
    color: 'from-rose-600 to-red-600',
    colorHex: '#dc2626'
  }
];

let selectedCompareCountryCode = 'IN';

/**
 * Renders the Global Comparison tab. Computes the user's annualized footprint,
 * compiles comparison data for country list benchmarks, sorts them, and updates
 * the dynamic comparison list elements.
 *
 * @returns {void}
 */
function updateComparisonTab() {
  const container = document.getElementById('compare-bars-list');
  if (!container) return;

  const userTons = (state.dailyScore * 365) / 1000;
  document.getElementById('txt-compare-user-tons').innerText = userTons.toFixed(1);

  // Analyze user vs standards
  const summaryEl = document.getElementById('txt-compare-analysis-summary');
  if (userTons <= 1.9) {
    summaryEl.innerHTML = `Outstanding! Your annual emissions of <strong>${userTons.toFixed(1)} tons</strong> are below the average per-capita emissions of India (1.9 tons). You are living highly sustainably!`;
  } else if (userTons <= 4.7) {
    summaryEl.innerHTML = `Great work! Your annual emissions of <strong>${userTons.toFixed(1)} tons</strong> are below the global average limit of 4.7 tons. Keep checking daily habits to align closer with low-carbon benchmarks.`;
  } else {
    summaryEl.innerHTML = `Your annualized emissions sit at <strong>${userTons.toFixed(1)} tons</strong>, which exceeds the global per-capita average of 4.7 tons. Try adjusting AC cooling hours or commuting modes to lower this footprint.`;
  }

  // Combine user and country list for sorting
  const items = [
    ...COUNTRY_COMPARISONS,
    {
      code: 'USER',
      name: 'Your Current Footprint',
      emissions: userTons,
      fact: 'Your carbon footprint calculated in real-time from onboarding utilities and daily habits checklist.',
      color: 'from-teal-400 to-indigo-500',
      colorHex: '#14b8a6',
      isUser: true
    }
  ];

  // Sort by emissions ascending
  items.sort((a, b) => a.emissions - b.emissions);

  // Find max emissions to scale bar widths
  const maxEmissions = Math.max(...items.map(item => item.emissions));

  container.innerHTML = '';

  items.forEach(item => {
    const pct = (item.emissions / maxEmissions) * 100;
    const barWrap = document.createElement('button');
    barWrap.type = 'button';

    if (item.isUser) {
      barWrap.className = "w-full text-left p-3 rounded-xl border border-teal-500 bg-teal-500/10 shadow-[0_0_15px_rgba(20,184,166,0.15)] flex flex-col gap-1.5 transition-all duration-300 transform scale-[1.01] hover:scale-[1.02]";
    } else {
      const isSelected = item.code === selectedCompareCountryCode;
      barWrap.className = `w-full text-left p-3 rounded-xl border transition-all duration-300 flex flex-col gap-1.5 ${isSelected ? 'border-violet-500 bg-violet-500/5' : 'border-white/5 hover:border-white/10 bg-white/5'}`;
    }

    barWrap.innerHTML = `
      <div class="flex justify-between items-center text-xs">
        <span class="font-heading font-extrabold ${item.isUser ? 'text-teal-400' : 'text-slate-200'}">${item.name} ${item.isUser ? '⭐' : ''}</span>
        <span class="font-bold text-slate-400">${item.emissions.toFixed(1)} tons</span>
      </div>
      <div class="w-full bg-slate-950/40 rounded-full h-3.5 overflow-hidden border border-white/5">
        <div class="bg-gradient-to-r ${item.color || 'from-violet-500 to-indigo-500'} h-full rounded-full transition-all duration-500" style="width: ${pct}%"></div>
      </div>
    `;

    barWrap.addEventListener('click', () => {
      if (!item.isUser) {
        selectedCompareCountryCode = item.code;
      }
      displayCompareSpotlight(item, userTons);
      // Re-render list to reflect selected styling
      updateComparisonTab();
    });

    container.appendChild(barWrap);
  });

  // Load selected country in spotlight
  const spotlightItem = items.find(item => item.code === selectedCompareCountryCode) || COUNTRY_COMPARISONS[0];
  displayCompareSpotlight(spotlightItem, userTons);
}

/**
 * Updates the Spotlight Detail panel with specific stats and metrics for the selected country.
 *
 * @param {Object} item - The selected country comparison data object
 * @param {number} userTons - The user's annualized footprint in tons
 * @returns {void}
 */
function displayCompareSpotlight(item, userTons) {
  document.getElementById('txt-compare-spotlight-name').innerText = item.name;
  document.getElementById('txt-compare-spotlight-val').innerText = item.emissions.toFixed(1);
  document.getElementById('txt-compare-spotlight-desc').innerText = item.fact;

  const bullet = document.getElementById('compare-spotlight-bullet');
  bullet.style.backgroundColor = item.colorHex || '#c084fc';

  if (item.isUser) {
    document.getElementById('lbl-compare-spotlight-sub').innerText = 'Active Projection';
    document.getElementById('txt-compare-spotlight-ratio').innerText = '100% (Base)';
    document.getElementById('txt-compare-spotlight-fact').innerText = 'This is your calculated carbon footprint, reflecting baseline inputs and completed checklist items.';
  } else {
    document.getElementById('lbl-compare-spotlight-sub').innerText = 'Country Spotlight';
    const ratio = userTons / item.emissions;
    let ratioText = '';
    if (ratio < 1.0) {
      ratioText = `${(ratio * 100).toFixed(0)}% of their average (${(1 / ratio).toFixed(1)}x smaller)`;
      document.getElementById('txt-compare-spotlight-fact').innerText = `Awesome! Your footprint is smaller than the per-capita average of ${item.name} by ${(1 / ratio).toFixed(1)}x.`;
    } else {
      ratioText = `${(ratio * 100).toFixed(0)}% of their average (${ratio.toFixed(1)}x larger)`;
      document.getElementById('txt-compare-spotlight-fact').innerText = `Your footprint is currently ${ratio.toFixed(1)}x larger than the per-capita average of ${item.name}.`;
    }
    document.getElementById('txt-compare-spotlight-ratio').innerText = ratioText;
  }
}

/* =========================================================
   Page Visibility API Handling
   ========================================================= */

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Suspend Three.js WebGL rendering loop to conserve battery/resources
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
  } else {
    // Resume render loop if the active view tab is the 3D globe
    if (state.currentTab === 'globe' && !animId) {
      animateGlobe();
    }
  }
});
