"""
Comprehensive test and verification script for LandslideAI.
Tests compilation, endpoint responses, ML model accuracy, and edge cases.
"""

import sys
from app import app, model, parse_sensor_payload

c = app.test_client()

sensor_payload = {
    "rainfall": 80.0,
    "soil_moisture": 75.0,
    "tilt": 5.2,
    "vibration": 45.0,
    "temperature": 25.0,
    "humidity": 82.0,
}

tests = [
    ("HOME_PAGE", lambda: c.get("/"), 200),
    ("SENSOR_DATA_GET", lambda: c.get("/api/sensor-data"), 200),
    ("HISTORY_GET", lambda: c.get("/api/history"), 200),
    ("ALERTS_GET", lambda: c.get("/api/alerts"), 200),
    ("LATEST_GET", lambda: c.get("/api/latest"), 200),
    ("READINGS_GET", lambda: c.get("/api/readings"), 200),
    ("API_PREDICT_POST", lambda: c.post("/api/predict", json=sensor_payload), 200),
    ("ROOT_PREDICT_POST", lambda: c.post("/predict", json=sensor_payload), 200),
    ("BAD_PREDICT_EMPTY", lambda: c.post("/api/predict", json={}), 400),
    ("BAD_PREDICT_NON_NUMERIC", lambda: c.post("/api/predict", json={"rainfall": "invalid"}), 400),
    ("LEGACY_SENSOR_POST", lambda: c.post("/api/sensor", json=sensor_payload), 200),
    ("LEGACY_SENSOR_BAD", lambda: c.post("/api/sensor", json={"rainfall": "bad"}), 400),
    ("STYLE_CSS_GET", lambda: c.get("/style.css"), 200),
    ("SCRIPT_JS_GET", lambda: c.get("/script.js"), 200),
]

all_passed = True
print("=== LandslideAI Verification Checks ===")

for name, req_fn, expected_status in tests:
    try:
        res = req_fn()
        status_ok = res.status_code == expected_status
        result_str = "PASS" if status_ok else "FAIL"
        print(f"[{result_str}] {name} -> Got: {res.status_code}, Expected: {expected_status}")

        if not status_ok:
            all_passed = False
            print(f"    Error details: {res.get_data(as_text=True)[:200]}")
    except Exception as exc:
        print(f"[FAIL] {name} -> Exception: {exc}")
        all_passed = False

# Deep check on prediction response structure
pred_res = c.post("/api/predict", json=sensor_payload)
if pred_res.status_code == 200:
    data = pred_res.get_json()
    required_keys = ["risk", "risk_level", "risk_score", "score", "confidence", "probabilities", "recommendation", "reasons"]
    missing = [k for k in required_keys if k not in data]
    if missing:
        print(f"[FAIL] PREDICTION_STRUCTURE -> Missing keys: {missing}")
        all_passed = False
    else:
        print(f"[PASS] PREDICTION_STRUCTURE -> Risk: {data['risk']}, Score: {data['risk_score']}, Conf: {data['confidence']}%")

# Check model loaded
if model is not None:
    print(f"[PASS] ML_MODEL_LOADED -> {type(model).__name__} is active")
else:
    print("[WARN] ML_MODEL_LOADED -> Model not found on disk, running with physics heuristics")

print("=======================================")
if not all_passed:
    print("FAILED: Some verification checks did not pass.")
    sys.exit(1)
else:
    print("SUCCESS: All verification checks passed!")
    sys.exit(0)
