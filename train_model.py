import os
import joblib
import pandas as pd

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

# ---------------------------------------
# Create demonstration training dataset
# ---------------------------------------

data = {
    "rainfall": [
        5, 10, 15, 20, 25,
        30, 35, 40, 45, 50,
        55, 60, 65, 70, 75,
        80, 85, 90, 95, 100
    ],

    "soil_moisture": [
        20, 25, 28, 32, 35,
        40, 43, 47, 50, 55,
        58, 62, 67, 70, 75,
        78, 82, 87, 92, 95
    ],

    "tilt": [
        0.5, 0.8, 1.0, 1.2, 1.5,
        1.8, 2.0, 2.3, 2.5, 2.8,
        3.2, 3.5, 4.0, 4.5, 5.0,
        5.5, 6.0, 7.0, 8.0, 10.0
    ],

    "vibration": [
        10, 12, 15, 17, 20,
        22, 25, 28, 30, 32,
        35, 40, 45, 50, 55,
        60, 65, 70, 80, 90
    ],

    "temperature": [
        24, 24, 25, 25, 26,
        26, 27, 27, 27, 28,
        28, 28, 29, 29, 29,
        30, 30, 30, 31, 31
    ],

    "humidity": [
        45, 48, 50, 52, 55,
        58, 60, 62, 65, 67,
        70, 72, 75, 78, 80,
        82, 85, 88, 92, 95
    ],

    # 0 = LOW
    # 1 = MEDIUM
    # 2 = HIGH
    # 3 = CRITICAL

    "risk": [
        0, 0, 0, 0, 0,
        0, 1, 1, 1, 1,
        1, 1, 2, 2, 2,
        2, 2, 3, 3, 3
    ]
}

df = pd.DataFrame(data)

X = df[
    [
        "rainfall",
        "soil_moisture",
        "tilt",
        "vibration",
        "temperature",
        "humidity"
    ]
]

y = df["risk"]

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.25,
    random_state=42,
    stratify=y
)

model = RandomForestClassifier(
    n_estimators=100,
    random_state=42
)

model.fit(X_train, y_train)

predictions = model.predict(X_test)

accuracy = accuracy_score(y_test, predictions)

print("Model Accuracy:", accuracy)

os.makedirs("model", exist_ok=True)

joblib.dump(model, "model/landslide_model.pkl")

print("Model saved successfully.")
