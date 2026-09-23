# 🌍 LandslideAI

## AI-Based Early Warning & Landslide Risk Monitoring System

LandslideAI is an academic prototype designed to demonstrate landslide-risk monitoring using simulated environmental sensor data and a machine-learning model.

The project uses a Flask backend, HTML/CSS/JavaScript frontend, SQLite database, ESP32 sensor code, and a trained Random Forest model to generate risk predictions and display landslide-monitoring information through a web interface.

> ⚠️ **Important:** This project is an educational prototype. It must not be used for real emergency decisions, public warnings, or operational deployment without expert validation, verified sensors, historical field data, safety testing, and government-authorized monitoring processes.

## 🚀 Features

- 🌧️ Simulated environmental sensor monitoring
- 🤖 Random Forest machine-learning model for landslide-risk prediction
- 📊 Risk-level prediction and display
- 🌡️ Environmental parameter monitoring
- 🗄️ SQLite database for data storage
- 🔌 ESP32 sensor integration example
- 🌐 Flask backend with API endpoints
- 📱 Responsive web interface
- 🧪 Local validation and project-check scripts
- ⚡ Lightweight and easy-to-run academic prototype

## 🎯 Project Objective

The objective of LandslideAI is to demonstrate how machine learning and sensor data can be combined to support an early-warning concept for landslide-risk monitoring.

The project analyzes environmental conditions such as rainfall, soil moisture, temperature, humidity, vibration, slope-related values, or other available sensor inputs to estimate a possible risk level.

## 🛠️ Technologies Used

- Python
- Flask
- Scikit-learn
- Random Forest
- Pandas
- NumPy
- Joblib
- SQLite
- HTML5
- CSS3
- JavaScript
- C++
- Arduino IDE
- ESP32
- Git and GitHub

## 🧠 Machine-Learning Model

The project uses a **Random Forest** model for landslide-risk prediction.

Random Forest is an ensemble machine-learning algorithm that combines multiple decision trees to make more stable predictions. The model uses available environmental and sensor-related input features to estimate landslide-risk levels.

Possible output categories can include:

```text
Low Risk
Moderate Risk
High Risk
Critical Risk
```

> The displayed risk categories are for demonstration purposes and must not be interpreted as an official emergency warning.

## 📁 Project Structure

```text
my-LandslideAI/
│
├── app.py                    # Flask app and API endpoints
├── index.html                # Frontend interface
├── requirements.txt          # Python dependencies
├── README.md                 # Project documentation
├── .gitignore                # Files ignored by Git
│
├── landslide.db              # SQLite database
├── landslide_model.pkl       # Trained Random Forest model
├── landslide_esp32.ino       # ESP32 / Arduino sensor code
│
├── run_checks.py             # Python validation checks
├── run_checks.bat            # Windows script for validation checks
│
└── model/                    # Model and application resources
    ├── templates/            # HTML templates
    └── static/               # CSS and JavaScript files
```

## 💻 Installation

### Prerequisites

Install the following before running the project:

- Python 3.13 recommended
- pip
- Git
- Web browser
- Arduino IDE, only if you want to use the ESP32 code

## ▶️ Run Locally

### 1. Clone the Repository

```bash
git clone [https://github.com/punithkumar0927-ctrl/my-LandslideAI.git](https://github.com/punithkumar0927-ctrl/my-LandslideAI.git)
```

### 2. Open the Project Folder

```bash
cd my-LandslideAI
```

### 3. Install Dependencies

For Windows with Python 3.13:

```bash
py -3.13 -m pip install -r requirements.txt
```

For normal Python installation:

```bash
pip install -r requirements.txt
```

### 4. Start the Flask Application

For Windows with Python 3.13:

```bash
py -3.13 app.py
```

For normal Python installation:

```bash
python app.py
```

### 5. Open in Browser

Open this URL in your browser:

```text
http://127.0.0.1:5000/
```

## 🔌 ESP32 Sensor Integration

The file below contains example Arduino/ESP32 code:

```text
landslide_esp32.ino
```

You can open it using the Arduino IDE.

Basic steps:

1. Install Arduino IDE.
2. Install ESP32 board support in Arduino IDE.
3. Connect the ESP32 board to your computer.
4. Open `landslide_esp32.ino`.
5. Update Wi-Fi credentials and server IP address if required.
6. Select the correct ESP32 board and COM port.
7. Upload the code.
8. Monitor sensor output through Serial Monitor.

> Do not connect unverified sensor hardware to a real warning or emergency communication system.

## 🧪 Run Validation Checks

For Windows, you can run:

```bash
run_checks.bat
```

Or run the Python validation script:

```bash
python run_checks.py
```

These checks help verify that the main project files and setup are working correctly.

## 🌐 API Endpoints

The Flask backend provides API endpoints for communication between the frontend, simulated sensors, database, and machine-learning model.

Main logic is available in:

```text
app.py
```

Possible backend responsibilities include:

- Receiving sensor data
- Validating input values
- Loading the trained machine-learning model
- Generating risk predictions
- Saving readings to the SQLite database
- Returning prediction results to the frontend

## 📊 Example Workflow

```text
Sensor Data / Simulated Data
            ↓
Flask Backend
            ↓
Data Validation
            ↓
Random Forest Model
            ↓
Landslide Risk Prediction
            ↓
SQLite Database Storage
            ↓
Web Dashboard Display
```

## 📌 Example Input Parameters

Depending on the project configuration, the model may use environmental values such as:

- Rainfall level
- Soil moisture
- Temperature
- Humidity
- Vibration
- Soil movement
- Water level
- Slope angle
- Pressure
- Location data

The exact input fields depend on the implementation in `app.py` and the trained model.

## ⚠️ Limitations

- This project uses simulated or prototype-level sensor data.
- The model may not be trained on verified real-world landslide events.
- Real landslide prediction requires geological studies, weather data, terrain mapping, ground sensors, and expert review.
- Predictions can contain errors or false alarms.
- The system is not a replacement for official government disaster-management systems.
- The project must not be used for emergency evacuation or public safety decisions without proper validation.

## 🚀 Future Improvements

- Integrate live rainfall APIs.
- Add real IoT sensor data collection.
- Add GPS location tracking.
- Add weather-forecast integration.
- Improve the model using verified historical landslide data.
- Add deep-learning models for satellite-image analysis.
- Add real-time notifications through SMS or email.
- Add a map-based dashboard using Leaflet or Google Maps.
- Add user authentication.
- Deploy the Flask backend on Render, Railway, or PythonAnywhere.
- Add a cloud database such as Firebase, PostgreSQL, or MongoDB.
- Add model-performance metrics and feature importance charts.
- Add a Streamlit or React dashboard.

## 📸 Screenshots

Add screenshots of your application here after taking them.

```markdown





```

## 🔗 Repository Links

- GitHub Repository: [my-LandslideAI](https://github.com/punithkumar0927-ctrl/my-LandslideAI)
- GitHub Profile: [@punithkumar0927-ctrl](https://github.com/punithkumar0927-ctrl)
- Releases: [View Releases](https://github.com/punithkumar0927-ctrl/my-LandslideAI/releases)
- Deployments: [View Deployments](https://github.com/punithkumar0927-ctrl/my-LandslideAI/deployments)

## 👨‍💻 Author

**Punith Kumar AB**

B.E. Artificial Intelligence and Machine Learning

- GitHub: [@punithkumar0927-ctrl](https://github.com/punithkumar0927-ctrl)
- Portfolio: Add your portfolio link
- LinkedIn: Add your LinkedIn profile link

## 📜 License

This project is created for academic, educational, and learning purposes.

---

⭐ If you find this project useful, consider giving the repository a star.
