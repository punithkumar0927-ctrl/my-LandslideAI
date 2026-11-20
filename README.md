# 🌍 LandslideAI

## AI-Based Early Warning & Landslide Risk Monitoring System

LandslideAI is an academic prototype designed to demonstrate real-time landslide-risk monitoring using environmental sensor data, physical heuristic scoring, and a trained machine-learning model.

The project features a **Flask backend**, an interactive **HTML5/CSS3/JavaScript dashboard**, an **SQLite database**, **ESP32 IoT sensor firmware**, and a trained **Random Forest Classifier** to generate risk predictions, monitor slope stability, and provide early warning insights through a web interface.

> ⚠️ **Important Disclaimer:** This project is an educational and engineering prototype. It must not be used for real-life disaster emergencies, official public evacuation warnings, or life-critical operational deployment without geotechnical field validation, certified sensors, site-specific historical records, safety testing, and government-authorized monitoring processes.

---

## 🚀 Key Features

- 🌧️ **Simulated & Live IoT Sensor Telemetry**: Continuous monitoring of rainfall intensity, soil moisture, slope tilt angle, vibration, ambient temperature, and relative humidity.
- 🤖 **Random Forest AI Model**: Multi-class risk prediction (LOW, MEDIUM, HIGH, CRITICAL) trained using Scikit-Learn with probability distribution output.
- 🧭 **Hybrid Decision-Support Engine**: Combines geotechnical threshold rules with machine-learning confidence scoring.
- 🗺️ **Interactive Site Map**: Leaflet.js mapping centered on monitored slope areas (Western Ghats, Karnataka) with dynamic color-coded risk markers.
- 📊 **Real-Time Analytics & Trends**: Dynamic Chart.js visualizations for rainfall, soil moisture, tilt & vibration, and risk scores across configurable time windows (24h, 7d, 30d).
- 🚨 **Automated Alert Center**: Auto-logs critical and high-risk events to SQLite, supports operator acknowledgment, and enables CSV export.
- 🔌 **Hardware IoT Integration**: Complete ESP32 Arduino C++ firmware (`landslide_esp32.ino`) integrating MPU6050 accelerometer, DHT22 sensor, soil moisture, and rain sensors with HTTP POST reporting.
- 🧪 **Automated Verification Suite**: Built-in test client (`run_checks.py` & `run_checks.bat`) verifying all endpoints, model inference, and edge cases.

---

## 🎯 Project Objective

The objective of LandslideAI is to demonstrate how IoT sensor arrays and machine learning can be combined to support proactive early-warning systems for vulnerable slope areas. By tracking sudden accelerations in pore-water pressure (soil saturation), sustained precipitation, and micro-movements (tilt and vibration), the system flags hazardous slope conditions before catastrophic slope failure occurs.

---

## 🛠️ Technologies & Libraries

- **Backend**: Python 3.13, Flask 3.0.3, Flask-CORS 5.0.0, Gunicorn 23.0.0
- **Machine Learning**: Scikit-Learn 1.5.2, NumPy 2.2.1, Pandas 2.2.3, Joblib 1.4.2
- **Database**: SQLite 3 (WAL mode enabled)
- **Frontend**: HTML5, Modern CSS3 (Grid & Flexbox), Vanilla JavaScript (ES6+), Leaflet.js 1.9.4, Chart.js
- **IoT Firmware**: C++, ESP32 Core, Adafruit MPU6050, DHT sensor library, HTTPClient

---

## 🧠 Machine Learning Model

The predictive engine uses a **Random Forest Classifier** trained on geotechnical and environmental parameters:

- **Input Features**:
  1. `rainfall` (mm/hr)
  2. `soil_moisture` (%)
  3. `tilt` (degrees inclination)
  4. `vibration` (intensity score / ground acceleration)
  5. `temperature` (°C)
  6. `humidity` (%)
- **Output Classes**:
  - `LOW` (Score < 30): Stable slope conditions, routine monitoring.
  - `MEDIUM` (Score 30–54): Elevated moisture/tilt, increase inspection frequency.
  - `HIGH` (Score 55–74): Saturated ground and noticeable slope movement, notify response teams.
  - `CRITICAL` (Score ≥ 75): Dangerous slope failure probability, issue urgent advisory.

---

## 📁 Project Structure

```text
my-LandslideAI/
│
├── app.py                     # Flask application server & REST API
├── index.html                 # Root frontend dashboard template
├── script.js                  # Frontend client logic & chart orchestration
├── style.css                  # Responsive stylesheet & UI styling
├── train_model.py             # Script to train & serialize the Random Forest model
├── landslide_esp32.ino        # ESP32 firmware for physical sensor hardware
├── requirements.txt           # Python package dependencies
├── README.md                  # Project documentation
├── .gitignore                 # Git ignore rules
│
├── landslide.db               # SQLite database (readings & alerts)
├── landslide_model.pkl        # Serialized Random Forest model artifact
│
├── run_checks.py              # Automated test suite for endpoints & ML model
├── run_checks.bat             # Windows one-click verification script
│
├── templates/                 # Flask template directory
│   ├── index.html             # Rendered web dashboard
│   └── static/                # Static assets for template rendering
│       ├── script.js
│       └── style.css
│
├── static/                    # Standard Flask static assets folder
│   ├── script.js
│   └── style.css
│
└── model/                     # Trained model storage directory
    └── landslide_model.pkl    # Serialized model
```

---

## 💻 Installation & Setup

### Prerequisites

- **Python 3.10 to 3.13** installed
- **Git**
- Modern web browser (Chrome, Edge, Firefox, Safari)
- **Arduino IDE** (only required if uploading code to physical ESP32 boards)

### 1. Clone the Repository

```bash
git clone https://github.com/punithkumar0927-ctrl/my-LandslideAI.git
cd my-LandslideAI
```

### 2. Install Dependencies

On Windows with Python 3.13:
```bash
py -3.13 -m pip install -r requirements.txt
```

On Linux / macOS or standard Python:
```bash
pip install -r requirements.txt
```

### 3. (Optional) Train the Machine Learning Model

To retrain the model and regenerate `model/landslide_model.pkl`:
```bash
python train_model.py
```

---

## ▶️ Running the Application

### Start the Flask Server

On Windows:
```bash
py -3.13 app.py
```

On Linux / macOS:
```bash
python app.py
```

### Open the Dashboard

Navigate to:
[http://127.0.0.1:5000/](http://127.0.0.1:5000/)

---

## 🌐 API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Serves the main LandslideAI dashboard interface. |
| `GET` | `/api/sensor-data` | Generates a new simulated sensor reading, evaluates risk, logs to database, and returns JSON. |
| `POST` | `/api/predict` | Accepts sensor values in JSON and returns ML prediction, probabilities, score, and reasons. |
| `POST` | `/predict` | Legacy prediction route matching `/api/predict`. |
| `GET` | `/api/latest` | Returns the most recent reading from the SQLite database. |
| `GET` | `/api/history` | Returns recent chronological readings for populating trend charts. |
| `GET` | `/api/readings` | Returns recent raw readings list. |
| `GET` | `/api/alerts` | Returns active high/critical landslide alerts. |
| `POST` | `/api/alerts/<id>/acknowledge` | Acknowledges an alert in the database. |
| `POST` | `/api/sensor` | Ingestion endpoint for ESP32 hardware devices. Evaluates and stores telemetry. |

---

## 🔌 ESP32 Hardware Integration

The file `landslide_esp32.ino` provides firmware for an ESP32 microcontroller with:
- **Analog Soil Moisture Sensor** on Pin 34
- **Raindrop Sensor** on Pin 35
- **Vibration Sensor** on Pin 32
- **MPU6050 Accelerometer / Gyroscope** over I2C (Pins 21 SDA, 22 SCL)
- **DHT22 Temperature & Humidity Sensor** on Pin 4
- **LED & Buzzer Indicators** (Pins 25, 26, 27, 14)

### Quick Setup:
1. Open `landslide_esp32.ino` in Arduino IDE.
2. Update `WIFI_SSID` and `WIFI_PASSWORD`.
3. Set `SERVER` to your server's local IP address (e.g., `http://192.168.1.100:5000/api/sensor`).
4. Select your ESP32 board and upload the sketch.

---

## 🧪 Running Verification Tests

Run the test suite to verify backend routes, database integrity, and ML inference:

On Windows:
```bash
py -3.13 run_checks.py
```
Or double-click `run_checks.bat`.

Expected output:
```text
=== LandslideAI Verification Checks ===
[PASS] HOME_PAGE -> Got: 200, Expected: 200
[PASS] SENSOR_DATA_GET -> Got: 200, Expected: 200
[PASS] HISTORY_GET -> Got: 200, Expected: 200
[PASS] ALERTS_GET -> Got: 200, Expected: 200
[PASS] LATEST_GET -> Got: 200, Expected: 200
[PASS] READINGS_GET -> Got: 200, Expected: 200
[PASS] API_PREDICT_POST -> Got: 200, Expected: 200
[PASS] ROOT_PREDICT_POST -> Got: 200, Expected: 200
[PASS] BAD_PREDICT_EMPTY -> Got: 400, Expected: 400
[PASS] BAD_PREDICT_NON_NUMERIC -> Got: 400, Expected: 400
[PASS] LEGACY_SENSOR_POST -> Got: 200, Expected: 200
[PASS] LEGACY_SENSOR_BAD -> Got: 400, Expected: 400
[PASS] STYLE_CSS_GET -> Got: 200, Expected: 200
[PASS] SCRIPT_JS_GET -> Got: 200, Expected: 200
[PASS] PREDICTION_STRUCTURE -> Risk: HIGH, Score: 73, Conf: 74.0%
[PASS] ML_MODEL_LOADED -> RandomForestClassifier is active
=======================================
SUCCESS: All verification checks passed!
```

---

## 👨‍💻 Author

**Punith Kumar AB**  
B.E. Artificial Intelligence and Machine Learning  
- GitHub: [@punithkumar0927-ctrl](https://github.com/punithkumar0927-ctrl)  
- LinkedIn: [Punith Kumar AB](https://www.linkedin.com/in/punithkumarab)  

---

## 📜 License

This project is created for educational, research, and prototype demonstration purposes.
