# Run quick compile + endpoint tests for the LandslideAI app
import sys
from app import app

c = app.test_client()

r1 = c.post('/predict', json={'rainfall':'80','soil_moisture':75,'tilt':'5.2','vibration':'70','temperature':'25','humidity':'82'})
print('PREDICT_OK', r1.status_code, r1.get_json().get('risk'))

r2 = c.post('/predict', json={})
print('PREDICT_BAD', r2.status_code, r2.get_json().get('error'))

r3 = c.post('/api/sensor', json={'rainfall':'12','soil_moisture':14,'tilt':'2.1','vibration':'20','temperature':'24','humidity':'60'})
print('SENSOR_OK', r3.status_code, r3.get_json().get('status'))

r4 = c.post('/api/sensor', json={'rainfall':'oops','soil_moisture':14,'tilt':'2.1','vibration':'20','temperature':'24','humidity':'60'})
print('SENSOR_BAD', r4.status_code, r4.get_json().get('error'))
