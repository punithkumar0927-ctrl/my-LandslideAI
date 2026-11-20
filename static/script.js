/**
 * LandslideAI - Frontend Dashboard Application
 * Connects with Flask backend API for ML predictions, live telemetry, and historical analytics.
 * Includes client-side fallbacks for standalone preview.
 */

const riskLevels = {
  LOW: {
    score: 18,
    color: "#28b463",
    recommendation: "Continue routine monitoring and inspect drainage after the next weather cycle.",
  },
  MEDIUM: {
    score: 42,
    color: "#f4b740",
    recommendation: "Increase inspection frequency and verify local drainage and slope movement indicators.",
  },
  HIGH: {
    score: 68,
    color: "#f2994a",
    recommendation: "Restrict access to vulnerable zones, notify local authorities, and prepare emergency response measures.",
  },
  CRITICAL: {
    score: 90,
    color: "#eb5757",
    recommendation: "Immediately warn nearby residents, trigger evacuation instructions if directed by authorities, and prioritize emergency inspection.",
  },
};

const defaultSensorState = {
  rainfall: 62.0,
  soil_moisture: 64.0,
  tilt: 4.5,
  vibration: 41.0,
  temperature: 26.8,
  humidity: 78.0,
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

const MAX_HISTORY_POINTS = 96;
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

/**
 * Local fallback physics & rule evaluator if server is offline
 */
function evaluatePrediction(payload) {
  const rainfall = Number(payload.rainfall) || 0;
  const soil_moisture = Number(payload.soil_moisture) || 0;
  const tilt = Number(payload.tilt) || 0;
  const vibration = Number(payload.vibration) || 0;
  const temperature = Number(payload.temperature) || 0;
  const humidity = Number(payload.humidity) || 0;

  let score = 0;
  const reasons = [];

  if (rainfall > 70) {
    score += 26;
    reasons.push("High rainfall (>70 mm/hr) increases slope runoff and destabilizes topsoil.");
  } else if (rainfall > 40) {
    score += 14;
    reasons.push("Moderate to high rainfall elevating ground saturation.");
  }

  if (soil_moisture > 70) {
    score += 26;
    reasons.push("High soil moisture (>70%) significantly increases pore-water pressure.");
  } else if (soil_moisture > 50) {
    score += 14;
    reasons.push("Elevated soil moisture reducing shear resistance.");
  }

  if (tilt > 5.5) {
    score += 22;
    reasons.push("Slope tilt angle (>5.5°) rising toward critical instability threshold.");
  } else if (tilt > 3.5) {
    score += 12;
    reasons.push("Noticeable slope inclination shift detected by accelerometer.");
  }

  if (vibration > 50) {
    score += 20;
    reasons.push("Vibration sensor detected severe seismic/ground motion activity.");
  } else if (vibration > 25) {
    score += 10;
    reasons.push("Ground vibrations indicate minor sub-surface shifting.");
  }

  if (temperature > 30 || humidity > 85) {
    score += 8;
    reasons.push("Warm, saturated atmospheric conditions accelerate slope weathering.");
  }

  let risk = "LOW";
  if (score >= 75) {
    risk = "CRITICAL";
  } else if (score >= 55) {
    risk = "HIGH";
  } else if (score >= 30) {
    risk = "MEDIUM";
  }

  const finalScore = clamp(Math.round(score * 1.1 + 12), 5, 100);
  const confidence = clamp(68 + finalScore * 0.28, 60, 96);

  const probabilities = {
    LOW: Math.max(0, 100 - finalScore),
    MEDIUM: Math.max(0, Math.min(finalScore, 100 - Math.abs(finalScore - 40))),
    HIGH: Math.max(0, Math.min(finalScore, 100 - Math.abs(finalScore - 65))),
    CRITICAL: Math.max(0, Math.round(Math.max(0, finalScore - 55) * 1.6)),
  };

  const total = Object.values(probabilities).reduce((sum, v) => sum + v, 0) || 1;
  Object.keys(probabilities).forEach((k) => {
    probabilities[k] = Number(((probabilities[k] / total) * 100).toFixed(1));
  });

  return {
    risk,
    risk_level: risk,
    score: finalScore,
    risk_score: finalScore,
    confidence: Number(confidence.toFixed(1)),
    probabilities,
    reasons: reasons.length ? reasons : ["Weather, moisture, and slope behavior remain within a stable range."],
    recommendation: buildRecommendation(risk),
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
    if (!input) continue;
    const value = Number(input.value);

    if (input.value === "" || Number.isNaN(value) || value < field.min || value > field.max) {
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

  if (riskBadge) setRiskBadge(risk, "risk-badge");
  if (predictionBadge) setRiskBadge(risk, "prediction-risk-badge");

  const riskValue = document.getElementById("risk-score");
  const currentConfidence = document.getElementById("confidence");
  if (riskValue) riskValue.textContent = String(score);
  if (currentConfidence) currentConfidence.textContent = `${Number(confidence).toFixed(1)}%`;

  if (riskMeter) {
    riskMeter.style.width = `${Math.max(score, 6)}%`;
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
  if (floatingConfidence) floatingConfidence.textContent = `${Number(confidence).toFixed(1)}% confidence`;
  if (locationStatus) {
    locationStatus.textContent = `${risk.toLowerCase()} risk`;
    locationStatus.style.color = riskColor;
  }

  if (state.marker) {
    state.marker.setStyle({ fillColor: riskColor, color: "#ffffff" });
    state.marker.bindPopup(
      `<strong>Western Ghats Slope A</strong><br><strong>Status:</strong> ${risk} risk<br><strong>Confidence:</strong> ${Number(confidence).toFixed(1)}%`
    );
  }
}

function renderPrediction(result) {
  const risk = result.risk || result.risk_level || "LOW";
  const score = result.score !== undefined ? result.score : (result.risk_score || 25);
  const confidence = result.confidence || 85.0;

  const scoreEl = document.getElementById("prediction-score");
  const confEl = document.getElementById("prediction-confidence");
  const lowEl = document.getElementById("low");
  const medEl = document.getElementById("medium");
  const highEl = document.getElementById("high");
  const critEl = document.getElementById("critical");
  const recEl = document.getElementById("recommendation");
  const reasonsEl = document.getElementById("prediction-reasons");

  if (scoreEl) scoreEl.textContent = String(score);
  if (confEl) confEl.textContent = `${Number(confidence).toFixed(1)}%`;

  const probs = result.probabilities || { LOW: 85, MEDIUM: 10, HIGH: 5, CRITICAL: 0 };
  if (lowEl) lowEl.textContent = `${probs.LOW || 0}%`;
  if (medEl) medEl.textContent = `${probs.MEDIUM || 0}%`;
  if (highEl) highEl.textContent = `${probs.HIGH || 0}%`;
  if (critEl) critEl.textContent = `${probs.CRITICAL || 0}%`;

  if (recEl) recEl.textContent = result.recommendation || buildRecommendation(risk);

  if (reasonsEl && Array.isArray(result.reasons)) {
    reasonsEl.innerHTML = result.reasons.map((item) => `<li>${item}</li>`).join("");
  }

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

  const risk = sensorData.risk || sensorData.risk_level || "LOW";
  const score = sensorData.risk_score !== undefined ? sensorData.risk_score : (sensorData.score || 25);
  const confidence = sensorData.confidence || 85.0;

  const nowFormatted = formatTime(new Date());
  const latestTime = document.getElementById("latest-time");
  const lastSensor = document.getElementById("last-sensor-update");
  const heroUpdated = document.getElementById("hero-last-updated");
  const lastUpdated = document.getElementById("last-updated");

  if (latestTime) latestTime.textContent = nowFormatted;
  if (lastSensor) lastSensor.textContent = nowFormatted;
  if (heroUpdated) heroUpdated.textContent = nowFormatted;
  if (lastUpdated) lastUpdated.textContent = `Last updated: ${nowFormatted}`;

  updateRiskVisuals(risk, score, confidence);

  addHistoryPoint({
    timestamp: sensorData.timestamp || new Date().toISOString(),
    rainfall: Number(sensorData.rainfall),
    soil_moisture: Number(sensorData.soil_moisture),
    tilt: Number(sensorData.tilt),
    vibration: Number(sensorData.vibration),
    temperature: Number(sensorData.temperature),
    humidity: Number(sensorData.humidity),
    risk,
    score,
  });

  renderCharts();
}

async function simulateSensorData() {
  try {
    const response = await fetch("/api/sensor-data");
    if (response.ok) {
      const data = await response.json();
      state.currentSensor = {
        rainfall: Number(data.rainfall),
        soil_moisture: Number(data.soil_moisture),
        tilt: Number(data.tilt),
        vibration: Number(data.vibration),
        temperature: Number(data.temperature),
        humidity: Number(data.humidity),
        risk: data.risk_level || data.risk,
        risk_score: data.risk_score,
        confidence: data.confidence,
        timestamp: data.timestamp,
      };

      if (data.battery !== undefined) {
        const batEl = document.getElementById("battery-level");
        if (batEl) batEl.textContent = `${data.battery}%`;
      }
      if (data.signal_strength !== undefined) {
        const sigEl = document.getElementById("signal-strength");
        if (sigEl) sigEl.textContent = `${data.signal_strength} dBm`;
      }
      if (data.device_status !== undefined) {
        const devEl = document.getElementById("device-status");
        if (devEl) devEl.textContent = data.device_status;
      }
      if (data.network !== undefined) {
        const netEl = document.getElementById("network-status");
        if (netEl) netEl.textContent = data.network;
      }

      renderCurrentSensorInfo(state.currentSensor);
      renderAlerts();
      return;
    }
  } catch (error) {
    // Backend offline: run client-side simulation fallback
  }

  // Client-side simulation fallback
  const nextRain = clamp(defaultSensorState.rainfall + (Math.random() - 0.48) * 20, 8, 140);
  const nextMoisture = clamp(defaultSensorState.soil_moisture + (Math.random() - 0.42) * 22, 18, 95);
  const nextTilt = clamp(defaultSensorState.tilt + (Math.random() - 0.45) * 2.2, 0.8, 14.0);
  const nextVibration = clamp(defaultSensorState.vibration + (Math.random() - 0.45) * 22, 5, 95);
  const nextTemp = clamp(defaultSensorState.temperature + (Math.random() - 0.5) * 3, 18, 36);
  const nextHumidity = clamp(defaultSensorState.humidity + (Math.random() - 0.4) * 16, 40, 96);

  state.currentSensor = {
    rainfall: Number(nextRain.toFixed(1)),
    soil_moisture: Number(nextMoisture.toFixed(1)),
    tilt: Number(nextTilt.toFixed(1)),
    vibration: Number(nextVibration.toFixed(1)),
    temperature: Number(nextTemp.toFixed(1)),
    humidity: Number(nextHumidity.toFixed(1)),
  };

  const evaluated = evaluatePrediction(state.currentSensor);
  state.currentSensor.risk = evaluated.risk;
  state.currentSensor.risk_score = evaluated.score;
  state.currentSensor.confidence = evaluated.confidence;

  defaultSensorState.rainfall = state.currentSensor.rainfall;
  defaultSensorState.soil_moisture = state.currentSensor.soil_moisture;
  defaultSensorState.tilt = state.currentSensor.tilt;
  defaultSensorState.vibration = state.currentSensor.vibration;
  defaultSensorState.temperature = state.currentSensor.temperature;
  defaultSensorState.humidity = state.currentSensor.humidity;

  renderCurrentSensorInfo(state.currentSensor);
  renderSensorHealth();
  renderAlerts();
}

function renderSensorHealth() {
  const deviceStatus = document.getElementById("device-status");
  const batteryLevel = document.getElementById("battery-level");
  const signalStrength = document.getElementById("signal-strength");
  const networkStatus = document.getElementById("network-status");

  if (deviceStatus) deviceStatus.textContent = state.mode === "live" ? "Online" : "Demo Simulation";
  if (batteryLevel) batteryLevel.textContent = state.mode === "demo" ? "94%" : "89%";
  if (signalStrength) signalStrength.textContent = state.mode === "demo" ? "82 dBm" : "76 dBm";
  if (networkStatus) networkStatus.textContent = state.mode === "demo" ? "Connected" : "Live IoT Feed";
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
      if (response.ok) {
        const data = await response.json();
        if (!data.message && data.rainfall !== undefined) {
          state.currentSensor = {
            rainfall: Number(data.rainfall),
            soil_moisture: Number(data.soil_moisture),
            tilt: Number(data.tilt),
            vibration: Number(data.vibration),
            temperature: Number(data.temperature),
            humidity: Number(data.humidity),
            risk: data.risk_level || data.risk,
            risk_score: data.risk_score,
            confidence: data.confidence,
          };
          renderCurrentSensorInfo(state.currentSensor);
          renderAlerts();
        }
      }
    } catch (error) {
      console.warn("Live API unavailable, continuing with cached readings.");
    }
  } else {
    simulateSensorData();
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
  if (state.activeRange === "30d") return 72;
  if (state.activeRange === "7d") return 48;
  return 24;
}

function formatChartLabel(dateString) {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return String(dateString).slice(-8);
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

async function syncBackendHistory() {
  try {
    const response = await fetch("/api/history");
    if (response.ok) {
      const historyData = await response.json();
      if (Array.isArray(historyData) && historyData.length) {
        state.history = historyData.map((entry) => ({
          timestamp: entry.timestamp,
          rainfall: Number(entry.rainfall),
          soil_moisture: Number(entry.soil_moisture),
          tilt: Number(entry.tilt),
          vibration: Number(entry.vibration),
          temperature: Number(entry.temperature),
          humidity: Number(entry.humidity),
          risk: entry.risk_level || entry.risk,
          score: entry.risk_score || 25,
        }));
        renderCharts();
        return;
      }
    }
  } catch (error) {
    // Continue with existing state.history
  }
}

function renderCharts() {
  if (!state.history.length) {
    const now = Date.now();
    state.history = Array.from({ length: 24 }, (_, index) => {
      const time = new Date(now - (23 - index) * 60 * 60 * 1000);
      const fakeSensor = {
        rainfall: Number((30 + Math.random() * 45).toFixed(1)),
        soil_moisture: Number((40 + Math.random() * 35).toFixed(1)),
        tilt: Number((2.5 + Math.random() * 3.5).toFixed(1)),
        vibration: Number((15 + Math.random() * 35).toFixed(1)),
        temperature: Number((23 + Math.random() * 6).toFixed(1)),
        humidity: Number((60 + Math.random() * 25).toFixed(1)),
      };
      const evalRes = evaluatePrediction(fakeSensor);
      return {
        timestamp: time.toISOString(),
        ...fakeSensor,
        risk: evalRes.risk,
        score: evalRes.score,
      };
    });
  }

  const selected = state.history.slice(-getRangeWindow());
  const labels = selected.map((entry) => formatChartLabel(entry.timestamp));
  const rainfall = selected.map((entry) => entry.rainfall);
  const moisture = selected.map((entry) => entry.soil_moisture);
  const tilt = selected.map((entry) => entry.tilt);
  const vibration = selected.map((entry) => entry.vibration);
  const riskScores = selected.map((entry) => entry.score);

  const rainCanvas = document.getElementById("rainChart");
  const moistureCanvas = document.getElementById("moistureChart");
  const tiltCanvas = document.getElementById("tiltChart");
  const riskCanvas = document.getElementById("riskChart");

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true } },
    scales: {
      x: { ticks: { maxTicksLimit: 7 } },
      y: { beginAtZero: false },
    },
  };

  if (rainCanvas) {
    if (state.charts.rain) state.charts.rain.destroy();
    state.charts.rain = new Chart(rainCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Rainfall (mm/hr)",
          data: rainfall,
          borderColor: "#2f80ed",
          backgroundColor: "rgba(47, 128, 237, 0.16)",
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
        }],
      },
      options: commonOptions,
    });
  }

  if (moistureCanvas) {
    if (state.charts.moisture) state.charts.moisture.destroy();
    state.charts.moisture = new Chart(moistureCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Soil moisture (%)",
          data: moisture,
          borderColor: "#28b463",
          backgroundColor: "rgba(40, 180, 99, 0.16)",
          borderWidth: 2.5,
          tension: 0.35,
          fill: true,
        }],
      },
      options: commonOptions,
    });
  }

  if (tiltCanvas) {
    if (state.charts.tilt) state.charts.tilt.destroy();
    state.charts.tilt = new Chart(tiltCanvas, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Tilt angle (°)",
            data: tilt,
            borderColor: "#f4b740",
            backgroundColor: "rgba(244, 183, 64, 0.16)",
            borderWidth: 2.5,
            tension: 0.35,
            fill: true,
          },
          {
            label: "Vibration",
            data: vibration,
            borderColor: "#eb5757",
            backgroundColor: "rgba(235, 87, 87, 0.12)",
            borderWidth: 2,
            tension: 0.35,
            fill: false,
          },
        ],
      },
      options: commonOptions,
    });
  }

  if (riskCanvas) {
    if (state.charts.risk) state.charts.risk.destroy();
    state.charts.risk = new Chart(riskCanvas, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Risk score",
          data: riskScores,
          backgroundColor: riskScores.map((score) => {
            if (score >= 75) return "rgba(235, 87, 87, 0.85)";
            if (score >= 55) return "rgba(242, 153, 74, 0.85)";
            if (score >= 30) return "rgba(244, 183, 64, 0.85)";
            return "rgba(40, 180, 99, 0.85)";
          }),
          borderRadius: 6,
        }],
      },
      options: {
        ...commonOptions,
        scales: {
          x: { ticks: { maxTicksLimit: 7 } },
          y: { beginAtZero: true, max: 100 },
        },
      },
    });
  }
}

function getDefaultAlerts() {
  const now = new Date();
  const generateTime = (minutesAgo) => new Date(now.getTime() - minutesAgo * 60000).toISOString();

  return [
    {
      id: "alert-1",
      timestamp: generateTime(15),
      location: "Site A, Karnataka",
      risk: "HIGH",
      cause: "Sustained rainfall & moisture threshold reached",
      status: "Active",
      acknowledged: false,
    },
    {
      id: "alert-2",
      timestamp: generateTime(65),
      location: "Site A, Karnataka",
      risk: "MEDIUM",
      cause: "Rising tilt angle detected on lower slope",
      status: "Monitoring",
      acknowledged: true,
    },
  ];
}

async function renderAlerts() {
  let alerts = [];

  try {
    const response = await fetch("/api/alerts");
    if (response.ok) {
      const serverAlerts = await response.json();
      if (Array.isArray(serverAlerts) && serverAlerts.length) {
        alerts = serverAlerts;
      }
    }
  } catch (error) {
    // Offline fallback
  }

  if (!alerts.length) {
    const stored = localStorage.getItem(STORAGE_KEY);
    alerts = stored ? JSON.parse(stored) : getDefaultAlerts();
  }

  state.alerts = alerts;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));

  const tbody = document.getElementById("alert-table-body");
  const banner = document.getElementById("alert-banner");
  if (!tbody) return;

  const hasHighUnack = state.alerts.some(
    (a) => ["HIGH", "CRITICAL"].includes(a.risk) && !a.acknowledged
  );

  if (banner) {
    banner.classList.toggle("hidden", !hasHighUnack);
  }

  tbody.innerHTML = state.alerts.map((alert) => {
    const isAck = Boolean(alert.acknowledged);
    const ackClass = isAck ? "acknowledged" : "";
    const risk = alert.risk || "LOW";
    const alertId = alert.id;

    return `
      <tr>
        <td>${new Date(alert.timestamp).toLocaleString()}</td>
        <td>${alert.location || "Site A, Karnataka"}</td>
        <td><span class="alert-tag ${risk.toLowerCase()}">${risk}</span></td>
        <td>${alert.cause || "Environmental risk trigger"}</td>
        <td><span class="status-badge ${ackClass}">${isAck ? "Acknowledged" : (alert.status || "Active")}</span></td>
        <td>
          <button class="action-btn ${ackClass}" type="button" data-alert-id="${alertId}">
            ${isAck ? "Acknowledged" : "Acknowledge"}
          </button>
        </td>
      </tr>
    `;
  }).join("");

  tbody.querySelectorAll(".action-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.alertId;
      const numId = id.replace("alert-", "");

      // Try notifying backend
      try {
        await fetch(`/api/alerts/${numId}/acknowledge`, { method: "POST" });
      } catch (err) {}

      state.alerts = state.alerts.map((a) =>
        a.id === id ? { ...a, acknowledged: true, status: "Acknowledged" } : a
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.alerts));
      renderAlerts();
    });
  });
}

function exportAlertsCsv() {
  const alerts = state.alerts.length ? state.alerts : getDefaultAlerts();
  const rows = [
    ["Timestamp", "Location", "Risk", "Cause", "Status", "Acknowledged"],
    ...alerts.map((a) => [
      new Date(a.timestamp).toISOString(),
      a.location || "Site A, Karnataka",
      a.risk,
      a.cause,
      a.status,
      String(Boolean(a.acknowledged)),
    ]),
  ];

  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "landslide-ai-alerts.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function setupMap() {
  const mapElement = document.getElementById("risk-map");
  if (!mapElement || typeof L === "undefined") return;

  state.map = L.map("risk-map").setView([13.3546, 75.7765], 11);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(state.map);

  state.marker = L.circleMarker([13.3546, 75.7765], {
    radius: 14,
    color: "#ffffff",
    weight: 2,
    fillColor: "#28b463",
    fillOpacity: 0.85,
  }).addTo(state.map);

  state.marker.bindPopup("<strong>Western Ghats Slope A</strong><br>Status: Routine Monitoring");
  state.marker.openPopup();
}

function updateMapRisk() {
  if (!state.marker) return;
  const risk = state.currentSensor.risk || "LOW";
  const color = getRiskColor(risk);
  state.marker.setStyle({ fillColor: color, color: "#ffffff" });
  state.marker.bindPopup(`<strong>Western Ghats Slope A</strong><br>${risk} risk<br>Status: ${risk.toLowerCase()}`);
}

function registerEvents() {
  const form = document.getElementById("prediction-form");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = validatePredictionInputs();
      if (!payload) return;

      const submitBtn = form.querySelector("button[type='submit']");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Analyzing...";
      }

      try {
        const response = await fetch("/api/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error("API call failed");

        const data = await response.json();
        renderPrediction(data);
      } catch (error) {
        console.warn("Prediction API unavailable, using local model simulation:", error);
        const fallback = evaluatePrediction(payload);
        renderPrediction(fallback);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Predict risk";
        }
      }
    });
  }

  document.querySelectorAll(".toggle-btn").forEach((button) => {
    button.addEventListener("click", () => switchMode(button.dataset.mode));
  });

  document.querySelectorAll(".range-btn").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeRange = button.dataset.range;
      document.querySelectorAll(".range-btn").forEach((b) => b.classList.toggle("active", b === button));
      renderCharts();
    });
  });

  const exportBtn = document.getElementById("export-alerts");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportAlertsCsv);
  }
}

async function initializeDashboard() {
  if (!document.getElementById("prediction-form")) return;

  setupMap();
  registerEvents();
  renderSensorHealth();
  await syncBackendHistory();
  await renderAlerts();
  await simulateSensorData();

  // Periodic sensor loop
  setInterval(() => {
    if (state.mode === "demo") {
      simulateSensorData();
    } else if (state.mode === "live") {
      switchMode("live");
    }
  }, 5000);
}

window.addEventListener("DOMContentLoaded", initializeDashboard);
