from flask import Flask, render_template, request, jsonify
import sqlite3
import joblib
import os
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(
    __name__,
    template_folder=BASE_DIR,
    static_folder=BASE_DIR,
)

MODEL_PATH = os.path.join(BASE_DIR, "landslide_model.pkl")
LEGACY_MODEL_PATH = os.path.join(BASE_DIR, "landslide_model.pk1")

if not os.path.exists(MODEL_PATH) and os.path.exists(LEGACY_MODEL_PATH):
    MODEL_PATH = LEGACY_MODEL_PATH

model = joblib.load(MODEL_PATH)

DATABASE = os.path.join(BASE_DIR, "landslide.db")

# -----------------------------------------
# Database
# -----------------------------------------


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
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
            confidence REAL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            risk TEXT,
            message TEXT
        )
    """)

    if conn.execute("SELECT COUNT(*) FROM readings").fetchone()[0] == 0:
        now = datetime.now()
        sample_readings = [
            (now.strftime("%Y-%m-%d %H:%M:%S"), 42, 54, 2.8, 22, 26.7, 68, "LOW", 74.4),
            (now.strftime("%Y-%m-%d %H:%M:%S"), 58, 61, 3.8, 30, 27.1, 73, "MEDIUM", 81.8),
            (now.strftime("%Y-%m-%d %H:%M:%S"), 72, 76, 5.9, 56, 28.2, 80, "HIGH", 88.6),
            (now.strftime("%Y-%m-%d %H:%M:%S"), 84, 82, 7.1, 68, 27.8, 85, "CRITICAL", 93.3),
        ]

        conn.executemany(
            """
            INSERT INTO readings
            (timestamp, rainfall, soil_moisture, tilt, vibration, temperature, humidity, risk, confidence)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            sample_readings,
        )

    if conn.execute("SELECT COUNT(*) FROM alerts").fetchone()[0] == 0:
        conn.execute(
            """
            INSERT INTO alerts (timestamp, risk, message)
            VALUES (?, ?, ?)
            """,
            (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "HIGH", "High rainfall and saturated soil detected near Site A."),
        )

    conn.commit()
    conn.close()

# -----------------------------------------
# Risk names
# -----------------------------------------


risk_names = {
    0: "LOW",
    1: "MEDIUM",
    2: "HIGH",
    3: "CRITICAL"
}


def parse_sensor_payload(data):
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object.")

    required = [
        "rainfall",
        "soil_moisture",
        "tilt",
        "vibration",
        "temperature",
        "humidity"
    ]

    for field in required:
        if field not in data:
            raise ValueError(f"Missing required field: {field}")

    normalized = {}

    for field in required:
        value = data[field]
        if isinstance(value, bool):
            raise ValueError(f"Field '{field}' must be numeric.")

        try:
            numeric_value = float(value)
        except (TypeError, ValueError):
            raise ValueError(f"Field '{field}' must be numeric.")

        if numeric_value != numeric_value or numeric_value in (float("inf"), float("-inf")):
            raise ValueError(f"Field '{field}' must be a finite number.")

        normalized[field] = numeric_value

    return normalized

# -----------------------------------------
# Home
# -----------------------------------------


@app.route("/")
def home():
    return render_template("index.html")

# -----------------------------------------
# AI Prediction
# -----------------------------------------


@app.route("/predict", methods=["POST"])
def predict():

    data = request.get_json(silent=True)

    try:
        payload = parse_sensor_payload(data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    rainfall = payload["rainfall"]
    soil_moisture = payload["soil_moisture"]
    tilt = payload["tilt"]
    vibration = payload["vibration"]
    temperature = payload["temperature"]
    humidity = payload["humidity"]

    features = [[
        rainfall,
        soil_moisture,
        tilt,
        vibration,
        temperature,
        humidity
    ]]

    prediction = model.predict(features)[0]

    probabilities = model.predict_proba(features)[0]

    risk = risk_names[int(prediction)]

    confidence = round(
        max(probabilities) * 100,
        2
    )

    probability_result = {
        "LOW": 0,
        "MEDIUM": 0,
        "HIGH": 0,
        "CRITICAL": 0
    }

    for index, probability in enumerate(probabilities):

        probability_result[
            risk_names[index]
        ] = round(probability * 100, 2)

    timestamp = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    # -------------------------------------
    # Save reading
    # -------------------------------------

    conn = get_db()

    conn.execute("""
        INSERT INTO readings
        (
            timestamp,
            rainfall,
            soil_moisture,
            tilt,
            vibration,
            temperature,
            humidity,
            risk,
            confidence
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        timestamp,
        rainfall,
        soil_moisture,
        tilt,
        vibration,
        temperature,
        humidity,
        risk,
        confidence
    ))

    # -------------------------------------
    # Alert
    # -------------------------------------

    if risk in ["HIGH", "CRITICAL"]:

        message = (
            f"{risk} landslide risk detected. "
            f"Please increase monitoring."
        )

        conn.execute("""
            INSERT INTO alerts
            (timestamp, risk, message)
            VALUES (?, ?, ?)
        """, (
            timestamp,
            risk,
            message
        ))

    conn.commit()
    conn.close()

    recommendation = get_recommendation(risk)

    return jsonify({
        "risk": risk,
        "confidence": confidence,
        "probabilities": probability_result,
        "recommendation": recommendation,
        "timestamp": timestamp
    })

# -----------------------------------------
# Recommendation
# -----------------------------------------


def get_recommendation(risk):

    if risk == "LOW":
        return "Normal monitoring recommended."

    if risk == "MEDIUM":
        return "Increase monitoring frequency."

    if risk == "HIGH":
        return "High risk detected. Prepare warning procedures."

    if risk == "CRITICAL":
        return "Critical risk detected. Follow local emergency procedures."

    return "Continue monitoring."

# -----------------------------------------
# Latest readings
# -----------------------------------------


@app.route("/api/readings")
def readings():

    conn = get_db()

    rows = conn.execute("""
        SELECT *
        FROM readings
        ORDER BY id DESC
        LIMIT 20
    """).fetchall()

    conn.close()

    result = []

    for row in rows:

        result.append({
            "timestamp": row["timestamp"],
            "rainfall": row["rainfall"],
            "soil_moisture": row["soil_moisture"],
            "tilt": row["tilt"],
            "vibration": row["vibration"],
            "temperature": row["temperature"],
            "humidity": row["humidity"],
            "risk": row["risk"],
            "confidence": row["confidence"]
        })

    return jsonify(result)

# -----------------------------------------
# Latest reading
# -----------------------------------------


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
        return jsonify({
            "message": "No sensor data available"
        })

    return jsonify({
        "timestamp": row["timestamp"],
        "rainfall": row["rainfall"],
        "soil_moisture": row["soil_moisture"],
        "tilt": row["tilt"],
        "vibration": row["vibration"],
        "temperature": row["temperature"],
        "humidity": row["humidity"],
        "risk": row["risk"],
        "confidence": row["confidence"]
    })

# -----------------------------------------
# Alerts
# -----------------------------------------


@app.route("/api/alerts")
def alerts():

    conn = get_db()

    rows = conn.execute("""
        SELECT *
        FROM alerts
        ORDER BY id DESC
        LIMIT 20
    """).fetchall()

    conn.close()

    result = []

    for row in rows:

        result.append({
            "timestamp": row["timestamp"],
            "risk": row["risk"],
            "message": row["message"]
        })

    return jsonify(result)

# -----------------------------------------
# ESP32 API
# -----------------------------------------


@app.route("/api/sensor", methods=["POST"])
def sensor_data():

    data = request.get_json(silent=True)

    try:
        payload = parse_sensor_payload(data)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    features = [[
        payload["rainfall"],
        payload["soil_moisture"],
        payload["tilt"],
        payload["vibration"],
        payload["temperature"],
        payload["humidity"]
    ]]

    prediction = model.predict(features)[0]

    probabilities = model.predict_proba(features)[0]

    risk = risk_names[int(prediction)]

    confidence = round(
        max(probabilities) * 100,
        2
    )

    timestamp = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    conn = get_db()

    conn.execute("""
        INSERT INTO readings
        (
            timestamp,
            rainfall,
            soil_moisture,
            tilt,
            vibration,
            temperature,
            humidity,
            risk,
            confidence
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        timestamp,
        payload["rainfall"],
        payload["soil_moisture"],
        payload["tilt"],
        payload["vibration"],
        payload["temperature"],
        payload["humidity"],
        risk,
        confidence
    ))

    if risk in ["HIGH", "CRITICAL"]:

        message = (
            f"{risk} landslide risk detected."
        )

        conn.execute("""
            INSERT INTO alerts
            (timestamp, risk, message)
            VALUES (?, ?, ?)
        """, (
            timestamp,
            risk,
            message
        ))

    conn.commit()
    conn.close()

    return jsonify({
        "status": "success",
        "risk": risk,
        "confidence": confidence
    })

# -----------------------------------------
# Run server
# -----------------------------------------


if __name__ == "__main__":

    create_database()

    app.run(
        host="127.0.0.1",
        port=5000,
        debug=False
    )

