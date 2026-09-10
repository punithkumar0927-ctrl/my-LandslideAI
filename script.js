const riskLevels = {
  LOW: { score: 18, color: "#28b463", recommendation: "Continue routine monitoring and inspect drainage after the next weather cycle." },
  MEDIUM: { score: 42, color: "#f4b740", recommendation: "Increase inspection frequency and verify local drainage and slope movement indicators." },
  HIGH: { score: 68, color: "#f2994a", recommendation: "Restrict access to vulnerable zones, notify local authorities, and prepare emergency response measures." },
  CRITICAL: { score: 90, color: "#eb5757", recommendation: "Immediately warn nearby residents, trigger evacuation instructions if directed by authorities, and prioritize emergency inspection." },
};

const defaultSensorState = {
  rainfall: 62,
  soil_moisture: 64,
  tilt: 4.5,
  vibration: 41,
  temperature: 26.8,
  humidity: 78,
};

const state = {
  currentSensor: { ...defaultSensorState },
  mode: "demo",
  activeRange: "24h",
  history: [],
  alerts: [],
  map: null,
  marker: null,
  charts: {},
};

const MAX_HISTORY_POINTS = 90;
const STORAGE_KEY = "landslide-ai-alerts";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatTime(date, includeSeconds = true) {
  const pad = (value) => String(value).padStart(2, "0");
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();

  return includeSeconds
    ? `${year}-${month}-${day} ${hh}:${mm}:${ss}`
    : `${year}-${month}-${day}`;
}

function getRiskColor(risk) {
  const colorMap = {
    LOW: "#28b463",
    MEDIUM: "#f4b740",
    HIGH: "#f2994a",
    CRITICAL: "#eb5757",
  };
  return colorMap[risk] || "#2f80ed";
}

function setRiskBadge(risk, elementId) {
  const badge = document.getElementById(elementId);
  if (!badge) return;
  const color = getRiskColor(risk);
  badge.textContent = risk;
  badge.style.background = `${color}1a`;
  badge.style.color = color;
}

function buildRecommendation(risk) {
  return riskLevels[risk]?.recommendation || riskLevels.LOW.recommendation;
}

function evaluatePrediction(payload) {
  const rainfall = Number(payload.rainfall) || 0;
  const soil_moisture = Number(payload.soil_moisture) || 0;
  const tilt = Number(payload.tilt) || 0;
  const vibration = Number(payload.vibration) || 0;
  const temperature = Number(payload.temperature) || 0;
  const humidity = Number(payload.humidity) || 0;

  let score = 0;
  const reasons = [];
  let risk = "LOW";

  if (rainfall > 70) {
    score += 24;
    reasons.push("High rainfall and unstable drainage conditions.");
  } else if (rainfall > 40) {
    score += 12;
  }

  if (soil_moisture > 70) {
    score += 26;
    reasons.push("High soil moisture increases pore-water pressure.");
  } else if (soil_moisture > 50) {
    score += 12;
  }

  if (tilt > 5.5) {
    score += 20;
    reasons.push("Slope tilt is rising toward a critical threshold.");
  } else if (tilt > 3.5) {
    score += 10;
  }

  if (vibration > 55) {
    score += 18;
    reasons.push("Vibration indicates increased ground movement activity.");
  } else if (vibration > 30) {
    score += 8;
  }

  if (temperature > 30 || humidity > 85) {
    score += 10;
    reasons.push("Warm, saturated conditions reduce soil stability.");
  }

  if (score >= 75) {
    risk = "CRITICAL";
  } else if (score >= 55) {
    risk = "HIGH";
  } else if (score >= 30) {
    risk = "MEDIUM";
  } else {
    risk = "LOW";
  }

  let confidence = clamp(62 + score * 0.4, 55, 98);
  confidence = Number(confidence.toFixed(1));

  const raw = {
    LOW: 1.0,
    MEDIUM: 1.2,
    HIGH: 1.7,
    CRITICAL: 2.2,
  };

  const probabilities = {
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    CRITICAL: 0,
  };

  const riskWeights = {
    LOW: 100 - score,
    MEDIUM: Math.max(18, 70 - score / 2),
    HIGH: Math.max(10, score / 2),
    CRITICAL: Math.max(8, score / 1.6),
  };

  const normalized = Object.values(riskWeights).reduce((sum, value) => sum + value, 0) || 1;

  probabilities.LOW = Number(((riskWeights.LOW / normalized) * 100).toFixed(1));
  probabilities.MEDIUM = Number(((riskWeights.MEDIUM / normalized) * 100).toFixed(1));
  probabilities.HIGH = Number(((riskWeights.HIGH / normalized) * 100).toFixed(1));
  probabilities.CRITICAL = Number(((riskWeights.CRITICAL / normalized) * 100).toFixed(1));

  if (risk === "LOW") {
    probabilities.LOW = Math.max(55, probabilities.LOW);
  }
  if (risk === "MEDIUM") {
    probabilities.MEDIUM = Math.max(40, probabilities.MEDIUM);
  }
  if (risk === "HIGH") {
    probabilities.HIGH = Math.max(42, probabilities.HIGH);
  }
  if (risk === "CRITICAL") {
    probabilities.CRITICAL = Math.max(45, probabilities.CRITICAL);
  }

  const total = Object.values(probabilities).reduce((sum, value) => sum + value, 0) || 1;
  Object.keys(probabilities).forEach((key) => {
    probabilities[key] = Number(((probabilities[key] / total) * 100).toFixed(1));
  });

  const finalRisk = risk;
  const recommendation = buildRecommendation(finalRisk);

  return {
    risk: finalRisk,
    score: clamp(Math.round(score * 1.2 + 18), 0, 100),
    confidence,
    probabilities,
    reasons: reasons.length ? reasons : ["Weather, moisture, and slope behavior remain within a stable range."],
    recommendation,
  };
}

function validatePredictionInputs() {
  const fields = [
    { id: "p-rainfall", label: "Rainfall", min: 0, max: 500 },
    { id: "p-moisture", label: "Soil moisture", min: 0, max: 100 },
    { id: "p-tilt", label: "Tilt angle", min: 0, max: 45 },
    { id: "p-vibration", label: "Vibration", min: 0, max: 200 },
    { id: "p-temperature", label: "Temperature", min: -20, max: 60 },
    { id: "p-humidity", label: "Humidity", min: 0, max: 100 },
  ];

  for (const field of fields) {
    const input = document.getElementById(field.id);
    const value = Number(input.value);

    if (!input.value || Number.isNaN(value) || value < field.min || value > field.max) {
      input.focus();
      input.reportValidity();
      return null;
    }
  }

  return {
    rainfall: Number(document.getElementById("p-rainfall").value),
    soil_moisture: Number(document.getElementById("p-moisture").value),
    tilt: Number(document.getElementById("p-tilt").value),
    vibration: Number(document.getElementById("p-vibration").value),
    temperature: Number(document.getElementById("p-temperature").value),
    humidity: Number(document.getElementById("p-humidity").value),
  };
}

function updateRiskVisuals(risk, score, confidence) {
  const riskColor = getRiskColor(risk);
  const riskBadge = document.getElementById("risk-badge");
  const predictionBadge = document.getElementById("prediction-risk-badge");
  const riskMeter = document.getElementById("risk-meter");

  if (riskBadge) {
    setRiskBadge(risk, "risk-badge");
  }
  if (predictionBadge) {
    setRiskBadge(risk, "prediction-risk-badge");
  }

  const riskValue = document.getElementById("risk-score");
  const currentConfidence = document.getElementById("confidence");
  if (riskValue) riskValue.textContent = String(score);
  if (currentConfidence) currentConfidence.textContent = `${confidence.toFixed(1)}%`;
  if (riskMeter) {
    riskMeter.style.width = `${Math.max(score, 4)}%`;
    riskMeter.style.background = `linear-gradient(90deg, ${riskColor}, ${riskColor})`;
  }

  const heroRisk = document.getElementById("hero-risk");
  const floatingRisk = document.getElementById("floating-risk");
  const floatingConfidence = document.getElementById("floating-confidence");
  const locationStatus = document.getElementById("location-status");

  if (heroRisk) heroRisk.textContent = risk;
  if (floatingRisk) {
    floatingRisk.textContent = risk;
    floatingRisk.style.color = riskColor;
  }
  if (floatingConfidence) floatingConfidence.textContent = `${confidence.toFixed(1)}% confidence`;
  if (locationStatus) {
    locationStatus.textContent = `${risk.toLowerCase()} risk`;
    locationStatus.style.color = riskColor;
  }

  if (state.marker) {
    const colorMap = {
      LOW: "#28b463",
      MEDIUM: "#f4b740",
      HIGH: "#f2994a",
      CRITICAL: "#eb5757",
    };
    state.marker.setStyle({ fillColor: colorMap[risk], color: "#ffffff" });
    state.marker.bindPopup(`<strong>Site A</strong><br>${risk} risk<br>Confidence: ${confidence.toFixed(1)}%`);
  }
}

function renderPrediction(result) {
  const risk = result.risk;
  const score = result.score;
  const confidence = result.confidence;

  document.getElementById("prediction-score").textContent = String(score);
  document.getElementById("prediction-confidence").textContent = `${confidence.toFixed(1)}%`;
  document.getElementById("low").textContent = `${result.probabilities.LOW}%`;
  document.getElementById("medium").textContent = `${result.probabilities.MEDIUM}%`;
  document.getElementById("high").textContent = `${result.probabilities.HIGH}%`;
  document.getElementById("critical").textContent = `${result.probabilities.CRITICAL}%`;
  document.getElementById("recommendation").textContent = result.recommendation;
  document.getElementById("prediction-reasons").innerHTML = result.reasons.map((item) => `<li>${item}</li>`).join("");

  updateRiskVisuals(risk, score, confidence);
}

function renderCurrentSensorInfo(sensorData) {
  const targetIds = {
    rainfall: document.getElementById("rainfall"),
    soil_moisture: document.getElementById("moisture"),
    tilt: document.getElementById("tilt"),
    vibration: document.getElementById("vibration"),
    temperature: document.getElementById("temperature"),
    humidity: document.getElementById("humidity"),
  };

  const values = {
    rainfall: Number(sensorData.rainfall).toFixed(1),
    soil_moisture: Number(sensorData.soil_moisture).toFixed(1),
    tilt: Number(sensorData.tilt).toFixed(1),
    vibration: Number(sensorData.vibration).toFixed(1),
    temperature: Number(sensorData.temperature).toFixed(1),
    humidity: Number(sensorData.humidity).toFixed(1),
  };

  Object.entries(targetIds).forEach(([key, element]) => {
    if (element) {
      element.textContent = values[key];
    }
  });

  const riskResult = evaluatePrediction(sensorData);
  const score = riskResult.score;
  const confidence = riskResult.confidence;
  const risk = riskResult.risk;

  document.getElementById("confidence").textContent = `${confidence.toFixed(1)}%`;
  document.getElementById("risk-score").textContent = String(score);
  document.getElementById("latest-time").textContent = formatTime(new Date());
  document.getElementById("last-sensor-update").textContent = formatTime(new Date());
  document.getElementById("hero-last-updated").textContent = formatTime(new Date());
  document.getElementById("last-updated").textContent = `Last updated: ${formatTime(new Date())}`;

  setRiskBadge(risk, "risk-badge");
  updateRiskVisuals(risk, score, confidence);

  if (document.getElementById("prediction-risk-badge").textContent === "--") {
    document.getElementById("prediction-risk-badge").textContent = risk;
  }

  addHistoryPoint({
    timestamp: new Date().toISOString(),
    rainfall: sensorData.rainfall,
    soil_moisture: sensorData.soil_moisture,
    tilt: sensorData.tilt,
    vibration: sensorData.vibration,
    temperature: sensorData.temperature,
    humidity: sensorData.humidity,
    risk,
    score,
  });

  renderCharts();
}

function simulateSensorData() {
  const now = new Date();
  const nextRain = clamp(defaultSensorState.rainfall + (Math.random() - 0.5) * 24, 12, 145);
  const nextMoisture = clamp(defaultSensorState.soil_moisture + (Math.random() - 0.38) * 26, 18, 96);
  const nextTilt = clamp(defaultSensorState.tilt + (Math.random() - 0.45) * 2.4, 0.8, 14.5);
  const nextVibration = clamp(defaultSensorState.vibration + (Math.random() - 0.45) * 24, 8, 100);
  const nextTemp = clamp(defaultSensorState.temperature + (Math.random() - 0.5) * 4, 18, 38);
  const nextHumidity = clamp(defaultSensorState.humidity + (Math.random() - 0.4) * 18, 36, 98);

  state.currentSensor = {
    rainfall: Number(nextRain.toFixed(1)),
    soil_moisture: Number(nextMoisture.toFixed(1)),
    tilt: Number(nextTilt.toFixed(1)),
    vibration: Number(nextVibration.toFixed(1)),
    temperature: Number(nextTemp.toFixed(1)),
    humidity: Number(nextHumidity.toFixed(1)),
  };

  defaultSensorState.rainfall = state.currentSensor.rainfall;
  defaultSensorState.soil_moisture = state.currentSensor.soil_moisture;
  defaultSensorState.tilt = state.currentSensor.tilt;
  defaultSensorState.vibration = state.currentSensor.vibration;
  defaultSensorState.temperature = state.currentSensor.temperature;
  defaultSensorState.humidity = state.currentSensor.humidity;

  renderCurrentSensorInfo(state.currentSensor);
  renderSensorHealth();
  renderAlerts();
  updateMapRisk();

  if (state.mode === "demo") {
    document.getElementById("device-status").textContent = "Online";
    document.getElementById("network-status").textContent = "Connected";
    document.getElementById("battery-level").textContent = `${Math.max(62, 95 - now.getMinutes() * 0.2).toFixed(0)}%`;
    document.getElementById("signal-strength").textContent = `${Math.max(35, 80 + Math.random() * 20).toFixed(0)} dBm`;
  }
}

function renderSensorHealth() {
  const deviceStatus = document.getElementById("device-status");
  const batteryLevel = document.getElementById("battery-level");
  const signalStrength = document.getElementById("signal-strength");
  const networkStatus = document.getElementById("network-status");

  if (deviceStatus) deviceStatus.textContent = state.mode === "live" ? "Online" : "Demo node";
  if (batteryLevel) batteryLevel.textContent = state.mode === "demo" ? "92%" : "89%";
  if (signalStrength) signalStrength.textContent = state.mode === "demo" ? "78 dBm" : "74 dBm";
  if (networkStatus) networkStatus.textContent = state.mode === "demo" ? "Connected" : "Live feed";
}

async function switchMode(mode) {
  state.mode = mode;

  document.querySelectorAll(".toggle-btn").forEach((button) => {
    const isActive = button.dataset.mode === mode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  if (mode === "live") {
    try {
      const response = await fetch("/api/latest");
      if (!response.ok) throw new Error("Live API not available");
      const data = await response.json();
      if (!data.message) {
        state.currentSensor = {
          rainfall: Number(data.rainfall),
          soil_moisture: Number(data.soil_moisture),
          tilt: Number(data.tilt),
          vibration: Number(data.vibration),
          temperature: Number(data.temperature),
          humidity: Number(data.humidity),
        };
        renderCurrentSensorInfo(state.currentSensor);
        renderAlerts();
      }
    } catch (error) {
      console.warn("Using demo data fallback because live API is unavailable.");
      renderCurrentSensorInfo(state.currentSensor);
    }
  } else {
    renderCurrentSensorInfo(state.currentSensor);
    renderAlerts();
  }

  renderSensorHealth();
}

function addHistoryPoint(point) {
  state.history.push(point);
  if (state.history.length > MAX_HISTORY_POINTS) {
    state.history.shift();
  }
}

function getRangeWindow() {
  if (state.activeRange === "30d") return 30 * 24;
  if (state.activeRange === "7d") return 7 * 24;
  return 24;
}

function formatChartLabel(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderCharts() {
  if (!state.history.length) {
    const now = Date.now();
    state.history = Array.from({ length: 48 }, (_, index) => {
      const time = new Date(now - (47 - index) * 60 * 60 * 1000);
      const riskResult = evaluatePrediction({
        rainfall: 50 + Math.random() * 30,
        soil_moisture: 50 + Math.random() * 25,
        tilt: 3 + Math.random() * 4,
        vibration: 20 + Math.random() * 40,
        temperature: 24 + Math.random() * 6,
        humidity: 60 + Math.random() * 25,
      });
      return {
        timestamp: time.toISOString(),
        rainfall: Number((50 + Math.random() * 30).toFixed(1)),
        soil_moisture: Number((50 + Math.random() * 25).toFixed(1)),
        tilt: Number((3 + Math.random() * 4).toFixed(1)),
        vibration: Number((20 + Math.random() * 40).toFixed(1)),
        temperature: Number((24 + Math.random() * 6).toFixed(1)),
        humidity: Number((60 + Math.random() * 25).toFixed(1)),
        risk: riskResult.risk,
        score: riskResult.score,
      };
    });
  }

  const toLabel = (index, arr) => formatChartLabel(arr[index].timestamp);
  const selected = state.history.slice(-getRangeWindow());

  const rainfall = selected.map((entry) => entry.rainfall);
  const moisture = selected.map((entry) => entry.soil_moisture);
  const tilt = selected.map((entry) => entry.tilt);
  const riskScoreValues = selected.map((entry) => entry.score);
  const labels = selected.map((entry) => toLabel(selected.indexOf(entry), selected));

  const chartConfig = (canvasId, label, data, type = "line") => ({
    type,
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: "#2f80ed",
        backgroundColor: "rgba(47, 128, 237, 0.18)",
        borderWidth: 3,
        tension: 0.35,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true } },
      scales: {
        x: { ticks: { maxTicksLimit: 8 } },
        y: { beginAtZero: false },
      },
    },
  });

  if (state.charts.rain) state.charts.rain.destroy();
  state.charts.rain = new Chart(document.getElementById("rainChart"), chartConfig("rainChart", "Rainfall (mm/hr)", rainfall));

  if (state.charts.moisture) state.charts.moisture.destroy();
  state.charts.moisture = new Chart(document.getElementById("moistureChart"), chartConfig("moistureChart", "Soil moisture (%)", moisture));

  if (state.charts.tilt) state.charts.tilt.destroy();
  state.charts.tilt = new Chart(document.getElementById("tiltChart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Tilt angle (°)", data: tilt, borderColor: "#f4b740", backgroundColor: "rgba(244, 183, 64, 0.18)", borderWidth: 3, tension: 0.35, fill: true },
        { label: "Vibration (m/s²)", data: selected.map((entry) => entry.vibration), borderColor: "#eb5757", backgroundColor: "rgba(235, 87, 87, 0.12)", borderWidth: 2, tension: 0.35, fill: false },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { x: { ticks: { maxTicksLimit: 8 } }, y: { beginAtZero: false } },
    },
  });

  if (state.charts.risk) state.charts.risk.destroy();
  state.charts.risk = new Chart(document.getElementById("riskChart"), {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Risk score",
        data: riskScoreValues,
        backgroundColor: riskScoreValues.map((value) => {
          if (value >= 75) return "rgba(235, 87, 87, 0.8)";
          if (value >= 50) return "rgba(242, 153, 74, 0.8)";
          if (value >= 30) return "rgba(244, 183, 64, 0.8)";
          return "rgba(40, 180, 99, 0.8)";
        }),
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { x: { ticks: { maxTicksLimit: 8 } }, y: { beginAtZero: true, max: 100 } },
    },
  });
}

function getDefaultAlerts() {
  const now = new Date();
  const generateTime = (minutesAgo) => new Date(now.getTime() - minutesAgo * 60000).toISOString();

  return [
    { id: "alert-1", timestamp: generateTime(12), location: "Site A, Karnataka", risk: "HIGH", cause: "Sustained rainfall, high moisture", status: "Open", acknowledged: false },
    { id: "alert-2", timestamp: generateTime(48), location: "Site A, Karnataka", risk: "MEDIUM", cause: "Rising tilt angle", status: "Monitoring", acknowledged: true },
    { id: "alert-3", timestamp: generateTime(100), location: "Site A, Karnataka", risk: "CRITICAL", cause: "Slope vibration spike", status: "Escalated", acknowledged: false },
  ];
}

function loadAlertsFromStorage() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const seed = getDefaultAlerts();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length ? parsed : getDefaultAlerts();
  } catch (error) {
    return getDefaultAlerts();
  }
}

function renderAlerts() {
  state.alerts = loadAlertsFromStorage();
  const tbody = document.getElementById("alert-table-body");
  const banner = document.getElementById("alert-banner");
  if (!tbody) return;

  const hasHighRisk = state.alerts.some((alert) => ["HIGH", "CRITICAL"].includes(alert.risk) && !alert.acknowledged);
  if (banner) {
    banner.classList.toggle("hidden", !hasHighRisk);
  }

  tbody.innerHTML = state.alerts.map((alert) => {
    const ackClass = alert.acknowledged ? "acknowledged" : "";
    const statusClass = alert.acknowledged ? "acknowledged" : "";
    return `
      <tr>
        <td>${new Date(alert.timestamp).toLocaleString()}</td>
        <td>${alert.location}</td>
        <td><span class="alert-tag ${alert.risk.toLowerCase()}">${alert.risk}</span></td>
        <td>${alert.cause}</td>
        <td><span class="status-badge ${statusClass}">${alert.status}</span></td>
        <td>
          <button class="action-btn ${ackClass}" type="button" data-alert-id="${alert.id}">${alert.acknowledged ? "Acknowledged" : "Acknowledge"}</button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".action-btn").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.alertId;
      state.alerts = state.alerts.map((alert) => alert.id === id ? { ...alert, acknowledged: true, status: "Acknowledged" } : alert);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.alerts));
      renderAlerts();
    });
  });
}

function exportAlertsCsv() {
  const alerts = loadAlertsFromStorage();
  const rows = [
    ["Timestamp", "Location", "Risk", "Cause", "Status", "Acknowledged"],
    ...alerts.map((alert) => [
      new Date(alert.timestamp).toISOString(),
      alert.location,
      alert.risk,
      alert.cause,
      alert.status,
      String(alert.acknowledged),
    ]),
  ];

  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "landslide-alerts.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function setupMap() {
  if (!document.getElementById("risk-map")) return;

  state.map = L.map("risk-map").setView([13.3546, 75.7765], 9);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(state.map);

  state.marker = L.circleMarker([13.3546, 75.7765], {
    radius: 16,
    color: "#ffffff",
    weight: 2,
    fillColor: "#28b463",
    fillOpacity: 0.85,
  }).addTo(state.map);

  state.marker.bindPopup("<strong>Western Ghats Slope A</strong><br>Low risk");
  state.marker.openPopup();
}

function updateMapRisk() {
  if (!state.marker) return;
  const risk = evaluatePrediction(state.currentSensor).risk;
  const colorMap = {
    LOW: "#28b463",
    MEDIUM: "#f4b740",
    HIGH: "#f2994a",
    CRITICAL: "#eb5757",
  };
  state.marker.setStyle({ fillColor: colorMap[risk], color: "#ffffff" });
  state.marker.bindPopup(`<strong>Western Ghats Slope A</strong><br>${risk} risk<br>Site status: ${risk.toLowerCase()}`);
}

function registerEvents() {
  document.getElementById("prediction-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const payload = validatePredictionInputs();
    if (!payload) return;

    const result = evaluatePrediction(payload);
    renderPrediction(result);
  });

  document.querySelectorAll(".toggle-btn").forEach((button) => {
    button.addEventListener("click", () => switchMode(button.dataset.mode));
  });

  document.querySelectorAll(".range-btn").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeRange = button.dataset.range;
      document.querySelectorAll(".range-btn").forEach((rangeButton) => {
        rangeButton.classList.toggle("active", rangeButton === button);
      });
      renderCharts();
    });
  });

  document.getElementById("export-alerts").addEventListener("click", exportAlertsCsv);
}

function initializeDashboard() {
  if (!document.getElementById("prediction-form")) return;

  renderCurrentSensorInfo(state.currentSensor);
  renderSensorHealth();
  setupMap();
  registerEvents();
  renderAlerts();
  renderCharts();
  renderCurrentSensorInfo(state.currentSensor);

  setInterval(() => {
    if (state.mode === "demo") {
      simulateSensorData();
    }
  }, 5000);
}

window.addEventListener("DOMContentLoaded", initializeDashboard);

