#!/usr/bin/env python3
"""
Simple script to run the HiveMQ to EMQX converter web application.
"""

import sys
import os

# Add the src directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from web_app import app

if __name__ == '__main__':
    print("Starting HiveMQ to EMQX Converter Web UI...")
    print("Open your browser and go to: http://localhost:8080")
    print("Press Ctrl+C to stop the server")
    app.run(debug=True, host='0.0.0.0', port=8080)