import os
os.environ["FLASK_SKIP_DOTENV"] = "1"
import random
import sqlite3
from datetime import datetime

import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, render_template, request, send_from_directory
try:
    from flask_cors import CORS
except ImportError:
    CORS = None

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Support standard Flask directory structure while maintaining backward compatibility
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates") if os.path.isdir(os.path.join(BASE_DIR, "templates")) else BASE_DIR
STATIC_DIR = os.path.join(BASE_DIR, "static") if os.path.isdir(os.path.join(BASE_DIR, "static")) else (
    os.path.join(BASE_DIR, "templates", "static") if os.path.isdir(os.path.join(BASE_DIR, "templates", "static")) else BASE_DIR
)

app = Flask(
    __name__,
    template_folder=TEMPLATES_DIR,
    static_folder=STATIC_DIR,
)
app.config["TEMPLATES_AUTO_RELOAD"] = True
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0
if CORS:
    CORS(app)

# -----------------------------------------
# ML Model Loading
# -----------------------------------------

MODEL_PATH = os.path.join(BASE_DIR, "model", "landslide_model.pkl")
LEGACY_MODEL_PATH = os.path.join(BASE_DIR, "landslide_model.pkl")

if not os.path.exists(MODEL_PATH) and os.path.exists(LEGACY_MODEL_PATH):
    MODEL_PATH = LEGACY_MODEL_PATH

model = None
if os.path.exists(MODEL_PATH):
    try:
        model = joblib.load(MODEL_PATH)
    except Exception as exc:
        print(f"Warning: Failed to load model from {MODEL_PATH}: {exc}")

if os.environ.get("VERCEL"):
    DATABASE = "/tmp/landslide.db"
    ORIGINAL_DB = os.path.join(BASE_DIR, "landslide.db")
    if not os.path.exists(DATABASE) and os.path.exists(ORIGINAL_DB):
        try:
            import shutil
            shutil.copy2(ORIGINAL_DB, DATABASE)
        except Exception:
            pass
else:
    DATABASE = os.path.join(BASE_DIR, "landslide.db")

# -----------------------------------------
# Risk Names Mapping
# -----------------------------------------

RISK_NAMES = {
    0: "LOW",
    1: "MEDIUM",
    2: "HIGH",
    3: "CRITICAL",
}

# -----------------------------------------
# Database Operations
# -----------------------------------------


def get_db():
    conn = sqlite3.connect(DATABASE, timeout=15.0)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
    except Exception:
        try:
            conn.execute("PRAGMA journal_mode=DELETE;")
        except Exception:
            pass
    return conn


def create_database():
    conn = get_db()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            rainfall REAL,
            soil_moisture REAL,
            tilt REAL,
            vibration REAL,
            temperature REAL,
            humidity REAL,
            risk TEXT,
            confidence REAL,
            risk_score INTEGER,
            risk_level TEXT
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            location TEXT DEFAULT 'Site A, Karnataka',
            risk TEXT,
            message TEXT,
            cause TEXT DEFAULT 'High rainfall and saturated soil',
            status TEXT DEFAULT 'Active',
            action TEXT DEFAULT 'Increase monitoring frequency',
            acknowledged INTEGER DEFAULT 0
        )
    """)

    # Ensure schema migrations for readings table
    existing_reading_cols = {row[1] for row in conn.execute("PRAGMA table_info(readings)").fetchall()}
    for col, definition in (("risk_score", "INTEGER"), ("risk_level", "TEXT")):
        if col not in existing_reading_cols:
            conn.execute(f"ALTER TABLE readings ADD COLUMN {col} {definition}")

    # Ensure schema migrations for alerts table
    existing_alert_cols = {row[1] for row in conn.execute("PRAGMA table_info(alerts)").fetchall()}
    for col, definition in (
        ("location", "TEXT DEFAULT 'Site A, Karnataka'"),
        ("cause", "TEXT DEFAULT 'High rainfall and saturated soil'"),
        ("status", "TEXT DEFAULT 'Active'"),
        ("action", "TEXT DEFAULT 'Increase monitoring frequency'"),
        ("acknowledged", "INTEGER DEFAULT 0"),
    ):
        if col not in existing_alert_cols:
            conn.execute(f"ALTER TABLE alerts ADD COLUMN {col} {definition}")

    # Seed initial readings if table is empty
    reading_count = conn.execute("SELECT COUNT(*) FROM readings").fetchone()[0]
    if reading_count == 0:
        now = datetime.now()
        sample_readings = [
            (
                now.strftime("%Y-%m-%d %H:%M:%S"),
                42.0, 54.0, 2.8, 22.0, 26.7, 68.0,
                "LOW", 74.4, 25, "LOW"
            ),
            (
                now.strftime("%Y-%m-%d %H:%M:%S"),
                58.0, 61.0, 3.8, 30.0, 27.1, 73.0,
                "MEDIUM", 81.8, 45, "MEDIUM"
            ),
            (
                now.strftime("%Y-%m-%d %H:%M:%S"),
                72.0, 76.0, 5.9, 56.0, 28.2, 80.0,
                "HIGH", 88.6, 68, "HIGH"
            ),
            (
                now.strftime("%Y-%m-%d %H:%M:%S"),
                84.0, 82.0, 7.1, 68.0, 27.8, 85.0,
                "CRITICAL", 93.3, 88, "CRITICAL"
            ),
        ]
        conn.executemany("""
            INSERT INTO readings
            (timestamp, rainfall, soil_moisture, tilt, vibration, temperature, humidity, risk, confidence, risk_score, risk_level)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, sample_readings)

    # Seed initial alerts if empty
    alert_count = conn.execute("SELECT COUNT(*) FROM alerts").fetchone()[0]
    if alert_count == 0:
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        conn.executemany("""
            INSERT INTO alerts (timestamp, location, risk, message, cause, status, action, acknowledged)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            (
                now_str,
                "Site A, Karnataka",
                "HIGH",
                "High landslide risk detected near Site A.",
                "Sustained heavy rainfall and saturated slope",
                "Active",
                "Send inspection team and notify residents",
                0
            ),
            (
                now_str,
                "Site A, Karnataka",
                "MEDIUM",
                "Moderate slope movement detected.",
                "Elevated soil moisture and tilt angle shifting",
                "Monitoring",
                "Increase inspection frequency",
                1
            ),
        ])

    conn.commit()
    conn.close()


# -----------------------------------------
# Payload Parsing & Validation
# -----------------------------------------


def parse_sensor_payload(data):
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object.")

    required = [
        "rainfall",
        "soil_moisture",
        "tilt",
        "vibration",
        "temperature",
        "humidity",
    ]

    for field in required:
        if field not in data:
            raise ValueError(f"Missing required field: {field}")

    normalized = {}
    for field in required:
        val = data[field]
        if isinstance(val, bool):
            raise ValueError(f"Field '{field}' must be numeric.")

        try:
            num = float(val)
        except (TypeError, ValueError):
            raise ValueError(f"Field '{field}' must be numeric.")

        if num != num or num in (float("inf"), float("-inf")):
            raise ValueError(f"Field '{field}' must be a finite number.")

        normalized[field] = num

    return normalized


# -----------------------------------------
# Risk & Physics Scoring
# -----------------------------------------


def calculate_score(payload):
    score = (
        payload["rainfall"] * 0.35
        + payload["soil_moisture"] * 0.30
        + payload["tilt"] * 2.2
        + min(payload["vibration"], 100) * 0.25
    )
    return min(100, max(0, round(score)))


def risk_from_score(score):
    if score >= 75:
        return "CRITICAL"
    if score >= 55:
        return "HIGH"
    if score >= 30:
        return "MEDIUM"
    return "LOW"


def recommendation_for(risk):
    return {
        "LOW": "Continue routine monitoring and inspect drainage after the next weather cycle.",
        "MEDIUM": "Increase inspection frequency and verify local drainage and slope movement indicators.",
        "HIGH": "Restrict access to vulnerable zones, notify local authorities, and prepare emergency response measures.",
        "CRITICAL": "Immediately warn nearby residents, trigger evacuation instructions if directed by authorities, and prioritize emergency inspection.",
    }.get(risk, "Continue routine monitoring.")


def generate_reasons(payload):
    reasons = []

    if payload["rainfall"] > 70:
        reasons.append("High rainfall (>70 mm/hr) increases slope runoff and destabilizes topsoil.")
    elif payload["rainfall"] > 40:
        reasons.append("Moderate to high rainfall elevating ground saturation.")

    if payload["soil_moisture"] > 70:
        reasons.append("High soil moisture (>70%) significantly increases pore-water pressure.")
    elif payload["soil_moisture"] > 50:
        reasons.append("Elevated soil moisture reducing shear resistance.")

    if payload["tilt"] > 5.5:
        reasons.append("Slope tilt angle (>5.5°) rising toward critical instability threshold.")
    elif payload["tilt"] > 3.5:
        reasons.append("Noticeable slope inclination shift detected by accelerometer.")

    if payload["vibration"] > 50:
        reasons.append("Vibration sensor detected severe seismic/ground motion activity.")
    elif payload["vibration"] > 25:
        reasons.append("Ground vibrations indicate minor sub-surface shifting.")

    if payload["temperature"] > 30 or payload["humidity"] > 85:
        reasons.append("Warm, saturated atmospheric conditions accelerate slope weathering.")

    if not reasons:
        reasons.append("Weather, moisture, and slope behavior remain within a stable range.")

    return reasons


def model_prediction_details(payload):
    columns = ["rainfall", "soil_moisture", "tilt", "vibration", "temperature", "humidity"]
    rule_score = calculate_score(payload)
    rule_risk = risk_from_score(rule_score)

    probabilities = {
        "LOW": max(0.0, round(100.0 - rule_score, 1)),
        "MEDIUM": max(0.0, round(min(rule_score, 100 - abs(rule_score - 40)), 1)),
        "HIGH": max(0.0, round(min(rule_score, 100 - abs(rule_score - 65)), 1)),
        "CRITICAL": max(0.0, round(max(0, rule_score - 60) * 1.5, 1)),
    }

    confidence = round(65.0 + rule_score * 0.3, 1)

    if model is not None:
        try:
            features = pd.DataFrame([[payload[c] for c in columns]], columns=columns)
            proba_array = model.predict_proba(features)[0]
            classes = list(model.classes_)
            model_probs = {}
            for cls_idx, p in zip(classes, proba_array):
                name = RISK_NAMES.get(int(cls_idx), "LOW")
                model_probs[name] = round(float(p) * 100, 1)

            for k in RISK_NAMES.values():
                if k not in model_probs:
                    model_probs[k] = 0.0

            probabilities = model_probs
            confidence = round(float(max(proba_array)) * 100, 1)
            predicted_class = int(model.predict(features)[0])
            model_risk = RISK_NAMES.get(predicted_class, rule_risk)

            if rule_risk in ("HIGH", "CRITICAL"):
                risk = rule_risk
            else:
                risk = model_risk
        except Exception:
            risk = rule_risk
    else:
        risk = rule_risk

    total_p = sum(probabilities.values()) or 1.0
    probabilities = {k: round((v / total_p) * 100, 1) for k, v in probabilities.items()}

    reasons = generate_reasons(payload)
    recommendation = recommendation_for(risk)

    return {
        "risk": risk,
        "risk_level": risk,
        "risk_score": rule_score,
        "score": rule_score,
        "confidence": confidence,
        "probabilities": probabilities,
        "recommendation": recommendation,
        "reasons": reasons,
    }


def save_reading(data):
    conn = get_db()
    conn.execute(
        """
        INSERT INTO readings
        (timestamp, rainfall, soil_moisture, tilt, vibration, temperature, humidity, risk, confidence, risk_score, risk_level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            data["timestamp"],
            data["rainfall"],
            data["soil_moisture"],
            data["tilt"],
            data["vibration"],
            data["temperature"],
            data["humidity"],
            data["risk_level"],
            data["confidence"],
            data["risk_score"],
            data["risk_level"],
        ),
    )

    if data["risk_level"] in ("HIGH", "CRITICAL"):
        cause_desc = f"Rainfall {data['rainfall']} mm/hr, moisture {data['soil_moisture']}%, tilt {data['tilt']}°"
        conn.execute(
            """
            INSERT INTO alerts (timestamp, location, risk, message, cause, status, action, acknowledged)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                data["timestamp"],
                "Site A, Karnataka",
                data["risk_level"],
                f"{data['risk_level']} landslide risk detected.",
                cause_desc,
                "Active" if data["risk_level"] == "CRITICAL" else "Monitoring",
                recommendation_for(data["risk_level"]),
                0,
            ),
        )

    conn.commit()
    conn.close()


def generate_sensor_data(override_payload=None):
    payload = {
        "rainfall": round(random.uniform(8, 92), 1),
        "soil_moisture": round(random.uniform(25, 88), 1),
        "tilt": round(random.uniform(0.8, 8.2), 2),
        "vibration": round(random.uniform(8, 70), 1),
        "temperature": round(random.uniform(20, 33), 1),
        "humidity": round(random.uniform(52, 94), 1),
    }

    if override_payload:
        payload.update(override_payload)

    pred = model_prediction_details(payload)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    return {
        **payload,
        "timestamp": now_str,
        "risk": pred["risk"],
        "risk_level": pred["risk_level"],
        "risk_score": pred["risk_score"],
        "score": pred["score"],
        "confidence": pred["confidence"],
        "probabilities": pred["probabilities"],
        "recommendation": pred["recommendation"],
        "reasons": pred["reasons"],
        "device_status": "Online",
        "battery": random.randint(85, 99),
        "signal_strength": random.randint(70, 88),
        "network": "Connected",
    }


# -----------------------------------------
# Web Routes
# -----------------------------------------


@app.route("/")
def home():
    return render_template("index.html")


# Static file fallback handlers
@app.route("/style.css")
def serve_root_style():
    for d in [STATIC_DIR, os.path.join(BASE_DIR, "templates", "static"), BASE_DIR]:
        if os.path.exists(os.path.join(d, "style.css")):
            return send_from_directory(d, "style.css")
    return "/* style.css not found */", 404


@app.route("/script.js")
def serve_root_script():
    for d in [STATIC_DIR, os.path.join(BASE_DIR, "templates", "static"), BASE_DIR]:
        if os.path.exists(os.path.join(d, "script.js")):
            return send_from_directory(d, "script.js")
    return "// script.js not found", 404


# -----------------------------------------
# AI Prediction Endpoints
# -----------------------------------------


@app.route("/predict", methods=["POST"])
@app.route("/api/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True)

    try:
        payload = parse_sensor_payload(data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    result = model_prediction_details(payload)
    result["timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    return jsonify(result)


# -----------------------------------------
# Sensor Data Endpoints
# -----------------------------------------


@app.route("/api/sensor-data")
def sensor_data():
    data = generate_sensor_data()
    save_reading(data)
    return jsonify(data)


@app.route("/api/sensor", methods=["POST"])
def sensor_device_data():
    data = request.get_json(silent=True)

    try:
        payload = parse_sensor_payload(data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    # Calculate real risk for the received hardware sensor values
    reading = generate_sensor_data(override_payload=payload)
    save_reading(reading)

    return jsonify({
        "status": "success",
        "risk": reading["risk_level"],
        "confidence": reading["confidence"],
    })


# -----------------------------------------
# Historical Data & Latest Readings
# -----------------------------------------


@app.route("/api/readings")
def readings():
    conn = get_db()
    rows = conn.execute("""
        SELECT *
        FROM readings
        ORDER BY id DESC
        LIMIT 30
    """)
    result = [dict(row) for row in rows]
    conn.close()
    return jsonify(result)


@app.route("/api/history")
def history():
    conn = get_db()
    rows = conn.execute("""
        SELECT timestamp, rainfall, soil_moisture, tilt, vibration, temperature, humidity,
               risk, risk_score, risk_level, confidence
        FROM readings
        ORDER BY id DESC
        LIMIT 48
    """).fetchall()
    conn.close()
    return jsonify([dict(row) for row in reversed(rows)])


@app.route("/api/latest")
def latest():
    conn = get_db()
    row = conn.execute("""
        SELECT *
        FROM readings
        ORDER BY id DESC
        LIMIT 1
    """).fetchone()
    conn.close()

    if row is None:
        return jsonify({"message": "No sensor data available"})

    return jsonify(dict(row))


# -----------------------------------------
# Alerts Endpoints
# -----------------------------------------


@app.route("/api/alerts")
def alerts():
    conn = get_db()
    rows = conn.execute("""
        SELECT id, timestamp, location, risk, message, cause, status, action, acknowledged
        FROM alerts
        ORDER BY id DESC
        LIMIT 20
    """).fetchall()
    conn.close()

    result = []
    for row in rows:
        result.append({
            "id": f"alert-{row['id']}",
            "timestamp": row["timestamp"],
            "location": row["location"] or "Site A, Karnataka",
            "risk": row["risk"],
            "message": row["message"],
            "cause": row["cause"] or f"{row['risk']} risk trigger",
            "status": "Acknowledged" if row["acknowledged"] else (row["status"] or "Active"),
            "action": row["action"] or recommendation_for(row["risk"]),
            "acknowledged": bool(row["acknowledged"]),
        })

    return jsonify(result)


@app.route("/api/alerts/<int:alert_id>/acknowledge", methods=["POST"])
def acknowledge_alert(alert_id):
    conn = get_db()
    conn.execute(
        "UPDATE alerts SET acknowledged = 1, status = 'Acknowledged' WHERE id = ?",
        (alert_id,)
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "acknowledged", "id": alert_id})


# -----------------------------------------
# Server Startup
# -----------------------------------------

create_database()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting LandslideAI server on http://localhost:{port}/ and http://127.0.0.1:{port}/")
    try:
        import socket
        from werkzeug.serving import make_server

        sock = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
        sock.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        sock.bind(("::", port))
        sock.listen(128)

        server = make_server("::", port, app, fd=sock.fileno(), threaded=True)
        server.serve_forever()
    except Exception as exc:
        app.run(
            host="0.0.0.0",
            port=port,
            debug=False,
            load_dotenv=False,
        )
