#include <WiFi.h>
#include <HTTPClient.h>

#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>

#include "DHT.h"


// =====================================
// WIFI
// =====================================

const char* WIFI_SSID = "YOUR_WIFI_NAME";

const char* WIFI_PASSWORD =
    "YOUR_WIFI_PASSWORD";


// =====================================
// SERVER
// =====================================

// Replace with the IP address of
// the computer running Flask.

const char* SERVER =
    "http://192.168.1.100:5000/api/sensor";


// =====================================
// PINS
// =====================================

#define SOIL_PIN 34

#define RAIN_PIN 35

#define VIBRATION_PIN 32

#define RED_LED 25

#define YELLOW_LED 26

#define GREEN_LED 27

#define BUZZER 14

#define DHT_PIN 4


// =====================================
// DHT
// =====================================

#define DHTTYPE DHT22

DHT dht(
    DHT_PIN,
    DHTTYPE
);


// =====================================
// MPU6050
// =====================================

Adafruit_MPU6050 mpu;


// =====================================
// SETUP
// =====================================

void setup() {

    Serial.begin(115200);


    pinMode(
        SOIL_PIN,
        INPUT
    );

    pinMode(
        RAIN_PIN,
        INPUT
    );

    pinMode(
        VIBRATION_PIN,
        INPUT
    );


    pinMode(
        RED_LED,
        OUTPUT
    );

    pinMode(
        YELLOW_LED,
        OUTPUT
    );

    pinMode(
        GREEN_LED,
        OUTPUT
    );

    pinMode(
        BUZZER,
        OUTPUT
    );


    dht.begin();


    // MPU6050

    if (!mpu.begin()) {

        Serial.println(
            "MPU6050 not found!"
        );

        while (1) {

            delay(1000);

        }

    }


    // WiFi

    WiFi.begin(
        WIFI_SSID,
        WIFI_PASSWORD
    );


    Serial.print(
        "Connecting to WiFi"
    );


    while (
        WiFi.status()
        != WL_CONNECTED
    ) {

        delay(500);

        Serial.print(".");

    }


    Serial.println();

    Serial.println(
        "WiFi connected!"
    );

    Serial.println(
        WiFi.localIP()
    );

}


// =====================================
// LOOP
// =====================================

void loop() {


    // -------------------------------
    // Soil
    // -------------------------------

    int soilRaw =
        analogRead(SOIL_PIN);


    float soilMoisture =
        map(
            soilRaw,
            4095,
            0,
            0,
            100
        );


    soilMoisture =
        constrain(
            soilMoisture,
            0,
            100
        );


    // -------------------------------
    // Rain
    // -------------------------------

    int rainRaw =
        analogRead(RAIN_PIN);


    float rainfall =
        map(
            rainRaw,
            4095,
            0,
            0,
            100
        );


    rainfall =
        constrain(
            rainfall,
            0,
            100
        );


    // -------------------------------
    // Vibration
    // -------------------------------

    int vibrationRaw =
        analogRead(
            VIBRATION_PIN
        );


    float vibration =
        map(
            vibrationRaw,
            0,
            4095,
            0,
            100
        );


    // -------------------------------
    // MPU6050
    // -------------------------------

    sensors_event_t a;
    sensors_event_t g;
    sensors_event_t temp;


    mpu.getEvent(
        &a,
        &g,
        &temp
    );


    float tilt =
        abs(
            atan2(
                a.acceleration.x,
                a.acceleration.z
            )
        ) * 57.2958;


    // -------------------------------
    // DHT22
    // -------------------------------

    float temperature =
        dht.readTemperature();


    float humidity =
        dht.readHumidity();


    if (isnan(temperature)) {

        temperature = 25;

    }


    if (isnan(humidity)) {

        humidity = 60;

    }


    // -------------------------------
    // Serial output
    // -------------------------------

    Serial.println(
        "-------------------------"
    );

    Serial.print(
        "Rainfall: "
    );

    Serial.println(
        rainfall
    );


    Serial.print(
        "Soil Moisture: "
    );

    Serial.println(
        soilMoisture
    );


    Serial.print(
        "Tilt: "
    );

    Serial.println(
        tilt
    );


    Serial.print(
        "Vibration: "
    );

    Serial.println(
        vibration
    );


    Serial.print(
        "Temperature: "
    );

    Serial.println(
        temperature
    );


    Serial.print(
        "Humidity: "
    );

    Serial.println(
        humidity
    );


    // -------------------------------
    // Send to Flask
    // -------------------------------

    sendData(
        rainfall,
        soilMoisture,
        tilt,
        vibration,
        temperature,
        humidity
    );


    delay(5000);

}


// =====================================
// SEND DATA
// =====================================

void sendData(

    float rainfall,
    float soilMoisture,
    float tilt,
    float vibration,
    float temperature,
    float humidity

) {


    if (
        WiFi.status()
        != WL_CONNECTED
    ) {

        Serial.println(
            "WiFi disconnected"
        );

        return;

    }


    HTTPClient http;


    http.begin(
        SERVER
    );


    http.addHeader(
        "Content-Type",
        "application/json"
    );


    String json = "{";

    json += "\"rainfall\":";
    json += rainfall;

    json += ",\"soil_moisture\":";
    json += soilMoisture;

    json += ",\"tilt\":";
    json += tilt;

    json += ",\"vibration\":";
    json += vibration;

    json += ",\"temperature\":";
    json += temperature;

    json += ",\"humidity\":";
    json += humidity;

    json += "}";


    Serial.println(
        json
    );


    int response =
        http.POST(json);


    Serial.print(
        "HTTP Response: "
    );

    Serial.println(
        response
    );


    if (response > 0) {

        String result =
            http.getString();

        Serial.println(
            result
        );

    }


    http.end();

}