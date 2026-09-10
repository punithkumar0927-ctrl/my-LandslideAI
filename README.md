# LandslideAI

AI-Based Early Warning & Landslide Risk Monitoring System.

## Overview

This repository contains a Flask backend and a static frontend (HTML/CSS/JS) for demonstrating real-time landslide risk monitoring using simulated sensor data and a RandomForest model.

## Local preview URL

This project is configured to run locally at:

[http://127.0.0.1:5000/](http://127.0.0.1:5000/)

This is the intended project website for this repository. It is not a GitHub Pages deployment and should not be replaced with a public GitHub Pages URL.

## Run locally

1. Install dependencies (recommended Python 3.13):
   ```
   py -3.13 -m pip install -r requirements.txt
   ```
2. Start the app:
   ```
   py -3.13 app.py
   ```
3. Open [http://127.0.0.1:5000/](http://127.0.0.1:5000/)

## Structure

- app.py - Flask app and API endpoints
- model/ - trained model and templates
- model/templates/ - HTML templates and static files
- model/templates/static/ - CSS and JS
- train_model.py - example script to generate a demo RandomForest model

## Notes

- This is an academic prototype. Validate before any production or operational use.
