import os
import tempfile
import xml.etree.ElementTree as ET
import logging
from flask import Flask, render_template, request, jsonify, flash
from werkzeug.utils import secure_filename
from pyhocon import ConfigFactory, HOCONConverter
import re

from converter import HiveMQToEMQXConverter

app = Flask(__name__)
app.secret_key = 'your-secret-key-change-in-production'

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Allowed file extensions
ALLOWED_EXTENSIONS = {'xml'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def post_process_hocon(hocon_string):
    """Workaround for pyhocon list formatting by ensuring lists are comma-separated."""
    # This regex finds a `seeds = [ ... ]` block.
    # It captures the part before the content, the content itself, and the closing bracket.
    seeds_pattern = re.compile(r"(seeds\s*=\s*\[)(.*?)(\])", re.DOTALL)

    def replacer(match):
        opening = match.group(1)  # 'seeds = ['
        content = match.group(2)  # The content inside the brackets
        closing = match.group(3)  # ']'

        # Split the content into lines, strip whitespace, and filter out empty lines.
        lines = [line.strip() for line in content.split("\n") if line.strip()]

        # Join the lines with a comma and a newline for correct HOCON array formatting.
        # Indent each line for readability.
        corrected_content = ",\n        ".join(lines)

        # Add indentation to the first line and newlines around the content.
        return f"{opening}\n        {corrected_content}\n    {closing}"

    return seeds_pattern.sub(replacer, hocon_string)

def convert_xml_to_hocon(xml_content):
    """Convert XML content to HOCON format."""
    try:
        # Parse XML from string
        root = ET.fromstring(xml_content)
        
        # Convert using the existing converter
        converter = HiveMQToEMQXConverter()
        emqx_config_dict = converter.convert(root)
        
        if not emqx_config_dict:
            return None, "Failed to convert configuration"
        
        # Convert to HOCON
        hocon_config = HOCONConverter.to_hocon(
            ConfigFactory.from_dict(emqx_config_dict)
        )
        
        # Apply post-processing for cluster config
        if "cluster" in emqx_config_dict:
            hocon_config = post_process_hocon(hocon_config)
        
        return hocon_config, None
        
    except ET.ParseError as e:
        return None, f"Error parsing XML: {str(e)}"
    except Exception as e:
        logger.error(f"Conversion error: {str(e)}")
        return None, f"Conversion error: {str(e)}"

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/convert', methods=['POST'])
def convert():
    try:
        xml_content = None
        
        # Check if file was uploaded
        if 'file' in request.files:
            file = request.files['file']
            if file and file.filename and allowed_file(file.filename):
                xml_content = file.read().decode('utf-8')
            else:
                return jsonify({'error': 'Please upload a valid XML file'}), 400
        
        # Check if XML content was pasted
        elif 'xml_content' in request.form:
            xml_content = request.form['xml_content']
        
        if not xml_content:
            return jsonify({'error': 'Please provide XML content either by uploading a file or pasting it'}), 400
        
        # Convert XML to HOCON
        hocon_result, error = convert_xml_to_hocon(xml_content)
        
        if error:
            return jsonify({'error': error}), 400
        
        return jsonify({'hocon': hocon_result})
        
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        return jsonify({'error': f'Unexpected error: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8080)