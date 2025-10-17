import { ConversionService } from './conversion-service.js';

const conversionService = new ConversionService();

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Serve frontend for root path
    if (request.method === 'GET' && (path === '/' || path === '/index.html')) {
      return serveFrontend();
    }

    // Handle conversion requests
    if (request.method === 'POST' && path === '/convert') {
      return handleConversion(request);
    }

    // 404 for other paths
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};

async function handleConversion(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    let xmlContent: string | null = null;

    // Check if file was uploaded
    const file = formData.get('file') as File;
    if (file && file.name.endsWith('.xml')) {
      xmlContent = await file.text();
    }
    // Check if XML content was pasted
    else {
      const xmlInput = formData.get('xml_content') as string;
      if (xmlInput) {
        xmlContent = xmlInput;
      }
    }

    if (!xmlContent) {
      return createResponse({ error: 'Please provide XML content either by uploading a file or pasting it' }, 400);
    }

    // Convert XML to HOCON
    const result = conversionService.convertXmlToHocon(xmlContent);

    if (result.error) {
      return createResponse({ error: result.error }, 400);
    }

    return createResponse({ hocon: result.hocon });
  } catch (error) {
    console.error('Conversion error:', error);
    return createResponse({
      error: `Conversion error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, 500);
  }
}

function createResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function serveFrontend(): Response {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HiveMQ to EMQX Configuration Converter</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }

        .header {
            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }

        .header h1 {
            font-size: 2.5rem;
            margin-bottom: 10px;
            font-weight: 300;
        }

        .header p {
            font-size: 1.1rem;
            opacity: 0.9;
        }

        .content {
            padding: 40px;
        }

        .input-section {
            margin-bottom: 30px;
        }

        .section-title {
            font-size: 1.3rem;
            margin-bottom: 15px;
            color: #2c3e50;
            font-weight: 500;
        }

        .input-group {
            margin-bottom: 20px;
        }

        .file-upload {
            border: 2px dashed #bdc3c7;
            border-radius: 8px;
            padding: 30px;
            text-align: center;
            transition: all 0.3s ease;
            cursor: pointer;
        }

        .file-upload:hover {
            border-color: #3498db;
            background-color: #f8f9fa;
        }

        .file-upload.dragover {
            border-color: #3498db;
            background-color: #e3f2fd;
        }

        .file-upload input[type="file"] {
            display: none;
        }

        .file-upload-label {
            display: block;
            cursor: pointer;
            color: #7f8c8d;
            font-size: 1.1rem;
        }

        .file-upload-label:hover {
            color: #3498db;
        }

        .file-info {
            margin-top: 10px;
            font-size: 0.9rem;
            color: #95a5a6;
        }

        .divider {
            text-align: center;
            margin: 20px 0;
            position: relative;
        }

        .divider::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 0;
            right: 0;
            height: 1px;
            background: #ecf0f1;
        }

        .divider span {
            background: white;
            padding: 0 20px;
            color: #95a5a6;
            font-size: 0.9rem;
        }

        .textarea-group {
            margin-bottom: 20px;
        }

        textarea {
            width: 100%;
            min-height: 200px;
            padding: 15px;
            border: 2px solid #ecf0f1;
            border-radius: 8px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 14px;
            line-height: 1.5;
            resize: vertical;
            transition: border-color 0.3s ease;
        }

        textarea:focus {
            outline: none;
            border-color: #3498db;
        }

        .button-group {
            display: flex;
            gap: 15px;
            margin-bottom: 30px;
        }

        .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-size: 1rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
            text-align: center;
        }

        .btn-primary {
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
            color: white;
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(52, 152, 219, 0.4);
        }

        .btn-secondary {
            background: #95a5a6;
            color: white;
        }

        .btn-secondary:hover {
            background: #7f8c8d;
        }

        .btn-success {
            background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
            color: white;
        }

        .btn-success:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(39, 174, 96, 0.4);
        }

        .btn-sm {
            padding: 8px 16px;
            font-size: 0.9rem;
        }

        .samples-section {
            margin: 40px 0;
            padding: 30px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e9ecef;
        }

        .samples-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }

        .sample-card {
            background: white;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
            transition: all 0.3s ease;
            cursor: pointer;
        }

        .sample-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            border-color: #3498db;
        }

        .sample-card h3 {
            color: #2c3e50;
            margin-bottom: 10px;
            font-size: 1.1rem;
        }

        .sample-card p {
            color: #7f8c8d;
            font-size: 0.9rem;
            margin-bottom: 15px;
            line-height: 1.4;
        }

        .output-section {
            margin-top: 30px;
        }

        .output-container {
            background: #f8f9fa;
            border: 2px solid #ecf0f1;
            border-radius: 8px;
            padding: 20px;
            min-height: 200px;
        }

        .output-content {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 14px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        .error {
            color: #e74c3c;
            background: #fdf2f2;
            border: 1px solid #fecaca;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
        }

        .success {
            color: #27ae60;
            background: #f0f9f0;
            border: 1px solid #c3e6c3;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
        }

        .loading {
            text-align: center;
            padding: 20px;
            color: #7f8c8d;
        }

        .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-right: 10px;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        .hidden {
            display: none;
        }

        @media (max-width: 768px) {
            .container {
                margin: 10px;
                border-radius: 8px;
            }

            .content {
                padding: 20px;
            }

            .header h1 {
                font-size: 2rem;
            }

            .button-group {
                flex-direction: column;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>HiveMQ to EMQX Converter</h1>
            <p>Convert your HiveMQ XML configuration to EMQX HOCON format</p>
        </div>

        <div class="content">
            <form id="converterForm">
                <div class="input-section">
                    <h2 class="section-title">Upload Configuration File</h2>
                    <div class="input-group">
                        <div class="file-upload" id="fileUpload">
                            <input type="file" id="fileInput" accept=".xml" />
                            <label for="fileInput" class="file-upload-label">
                                📁 Click to upload or drag and drop your XML file here
                            </label>
                            <div class="file-info" id="fileInfo"></div>
                        </div>
                    </div>

                    <div class="divider">
                        <span>OR</span>
                    </div>

                    <h2 class="section-title">Paste XML Configuration</h2>
                    <div class="textarea-group">
                        <textarea
                            id="xmlContent"
                            placeholder="Paste your HiveMQ XML configuration here..."
                        ></textarea>
                    </div>
                </div>

                <div class="samples-section">
                    <h2 class="section-title">Sample Configurations</h2>
                    <p style="margin-bottom: 20px; color: #7f8c8d;">Try these sample HiveMQ configurations to see the converter in action:</p>

                    <div class="samples-grid">
                        <div class="sample-card" data-sample="basic-mqtt">
                            <h3>Basic MQTT</h3>
                            <p>TCP listener with MQTT settings</p>
                            <button class="btn btn-secondary btn-sm">Load Sample</button>
                        </div>

                        <div class="sample-card" data-sample="tcp-websockets">
                            <h3>TCP + WebSockets</h3>
                            <p>Multiple listeners with WebSocket support</p>
                            <button class="btn btn-secondary btn-sm">Load Sample</button>
                        </div>

                        <div class="sample-card" data-sample="restrictions">
                            <h3>Connection Restrictions</h3>
                            <p>Max connections and bandwidth limits</p>
                            <button class="btn btn-secondary btn-sm">Load Sample</button>
                        </div>

                        <div class="sample-card" data-sample="kafka-extension">
                            <h3>Kafka Extension</h3>
                            <p>MQTT to Kafka bridge configuration</p>
                            <button class="btn btn-secondary btn-sm">Load Sample</button>
                        </div>

                        <div class="sample-card" data-sample="tls-websockets">
                            <h3>TLS WebSockets</h3>
                            <p>Secure WebSocket connections</p>
                            <button class="btn btn-secondary btn-sm">Load Sample</button>
                        </div>

                        <div class="sample-card" data-sample="cluster-tcp">
                            <h3>Cluster TCP</h3>
                            <p>Multi-node cluster configuration</p>
                            <button class="btn btn-secondary btn-sm">Load Sample</button>
                        </div>
                    </div>
                </div>

                <div class="button-group">
                    <button type="submit" class="btn btn-primary" id="convertBtn">
                        🔄 Convert to EMQX HOCON
                    </button>
                    <button type="button" class="btn btn-secondary" id="clearBtn">
                        🗑️ Clear All
                    </button>
                </div>
            </form>

            <div class="output-section" id="outputSection" style="display: none;">
                <h2 class="section-title">Converted EMQX Configuration</h2>
                <div class="output-container">
                    <div class="output-content" id="outputContent"></div>
                </div>
                <div class="button-group" style="margin-top: 15px;">
                    <button type="button" class="btn btn-success" id="copyBtn">
                        📋 Copy to Clipboard
                    </button>
                    <button type="button" class="btn btn-secondary" id="downloadBtn">
                        💾 Download as .hocon
                    </button>
                </div>
            </div>

            <div id="messageContainer"></div>
        </div>
    </div>

    <script>
        const form = document.getElementById('converterForm');
        const fileInput = document.getElementById('fileInput');
        const fileUpload = document.getElementById('fileUpload');
        const fileInfo = document.getElementById('fileInfo');
        const xmlContent = document.getElementById('xmlContent');
        const convertBtn = document.getElementById('convertBtn');
        const clearBtn = document.getElementById('clearBtn');
        const outputSection = document.getElementById('outputSection');
        const outputContent = document.getElementById('outputContent');
        const copyBtn = document.getElementById('copyBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        const messageContainer = document.getElementById('messageContainer');

        let currentHoconContent = '';

        // Sample configurations
        const sampleConfigs = {
            'basic-mqtt': \`<?xml version="1.0"?>
<hivemq>
    <listeners>
        <tcp-listener>
            <port>1883</port>
            <bind-address>0.0.0.0</bind-address>
        </tcp-listener>
    </listeners>
    <mqtt>
        <queued-messages>
            <max-queue-size>1000</max-queue-size>
            <strategy>discard</strategy>
        </queued-messages>
        <topic-alias>
            <enabled>true</enabled>
            <max-per-client>5</max-per-client>
        </topic-alias>
        <message-expiry>
            <max-interval>4294967296</max-interval>
        </message-expiry>
        <session-expiry>
            <max-interval>4294967295</max-interval>
        </session-expiry>
        <keep-alive>
            <allow-unlimited>true</allow-unlimited>
            <max-keep-alive>65535</max-keep-alive>
        </keep-alive>
        <packets>
            <max-packet-size>268435460</max-packet-size>
        </packets>
        <receive-maximum>
            <server-receive-maximum>10</server-receive-maximum>
        </receive-maximum>
        <quality-of-service>
            <max-qos>2</max-qos>
        </quality-of-service>
        <wildcard-subscriptions>
            <enabled>true</enabled>
        </wildcard-subscriptions>
        <shared-subscriptions>
            <enabled>true</enabled>
        </shared-subscriptions>
        <subscription-identifier>
            <enabled>true</enabled>
        </subscription-identifier>
        <retained-messages>
            <enabled>true</enabled>
        </retained-messages>
    </mqtt>
</hivemq>\`,

            'tcp-websockets': \`<?xml version="1.0"?>
<hivemq>
    <listeners>
        <tcp-listener>
            <port>1883</port>
            <bind-address>0.0.0.0</bind-address>
        </tcp-listener>
        <websocket-listener>
            <port>8000</port>
            <bind-address>0.0.0.0</bind-address>
            <path>/mqtt</path>
            <subprotocols>
                <subprotocol>mqttv3.1</subprotocol>
                <subprotocol>mqtt</subprotocol>
            </subprotocols>
            <allow-extensions>true</allow-extensions>
        </websocket-listener>
    </listeners>
</hivemq>\`,

            'restrictions': \`<?xml version="1.0"?>
<hivemq>
    <listeners>
        <tcp-listener>
            <port>1883</port>
            <bind-address>0.0.0.0</bind-address>
        </tcp-listener>
    </listeners>
    <restrictions>
        <max-connections>-1</max-connections>
        <max-client-id-length>65535</max-client-id-length>
        <incoming-bandwidth-throttling>0</incoming-bandwidth-throttling>
    </restrictions>
</hivemq>\`,

            'kafka-extension': \`<?xml version="1.0"?>
<hivemq>
    <kafka-configuration>
        <kafka-clusters>
            <kafka-cluster>
                <id>cluster01</id>
                <bootstrap-servers>127.0.0.1:9092</bootstrap-servers>
            </kafka-cluster>
        </kafka-clusters>
        <mqtt-to-kafka-mappings>
            <mqtt-to-kafka-mapping>
                <id>mapping01</id>
                <cluster-id>cluster01</cluster-id>
                <mqtt-topic-filters>
                    <mqtt-topic-filter>#</mqtt-topic-filter>
                </mqtt-topic-filters>
                <kafka-topic>emqx</kafka-topic>
            </mqtt-to-kafka-mapping>
        </mqtt-to-kafka-mappings>
        <kafka-to-mqtt-mappings>
            <kafka-to-mqtt-mapping>
                <id>mapping02</id>
                <cluster-id>cluster01</cluster-id>
                <kafka-topics>
                    <kafka-topic>topic1</kafka-topic>
                    <kafka-topic>topic2</kafka-topic>
                </kafka-topics>
            </kafka-to-mqtt-mapping>
        </kafka-to-mqtt-mappings>
    </kafka-configuration>
</hivemq>\`,

            'tls-websockets': \`<?xml version="1.0"?>
<hivemq>
    <listeners>
        <tcp-listener>
            <port>1883</port>
            <bind-address>0.0.0.0</bind-address>
        </tcp-listener>
        <tls-websocket-listener>
            <port>8084</port>
            <bind-address>0.0.0.0</bind-address>
            <path>/mqtt</path>
            <subprotocols>
                <subprotocol>mqttv3.1</subprotocol>
                <subprotocol>mqtt</subprotocol>
            </subprotocols>
            <tls>
                <keystore>
                    <path>keystore.jks</path>
                    <password>hivemq</password>
                </keystore>
                <truststore>
                    <path>truststore.jks</path>
                    <password>hivemq</password>
                </truststore>
            </tls>
        </tls-websocket-listener>
    </listeners>
</hivemq>\`,

            'cluster-tcp': \`<?xml version="1.0"?>
<hivemq>
    <listeners>
        <tcp-listener>
            <port>1883</port>
            <bind-address>0.0.0.0</bind-address>
        </tcp-listener>
    </listeners>
    <cluster>
        <discovery>
            <multicast>
                <enabled>false</enabled>
            </multicast>
            <static>
                <enabled>true</enabled>
                <seeds>
                    <seed>emqx@127.0.0.1</seed>
                    <seed>emqx@127.0.0.1</seed>
                </seeds>
            </static>
        </discovery>
    </cluster>
</hivemq>\`
        };

        // File upload handling
        fileInput.addEventListener('change', handleFileSelect);
        fileUpload.addEventListener('dragover', handleDragOver);
        fileUpload.addEventListener('dragleave', handleDragLeave);
        fileUpload.addEventListener('drop', handleDrop);

        function handleFileSelect(event) {
            const file = event.target.files[0];
            if (file && (file.type === 'text/xml' || file.name.endsWith('.xml'))) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    xmlContent.value = e.target.result;
                    fileInfo.textContent = \`Selected: \${file.name} (\${(file.size / 1024).toFixed(1)} KB)\`;
                };
                reader.readAsText(file);
            } else {
                showMessage('Please select a valid XML file.', 'error');
            }
        }

        function handleDragOver(event) {
            event.preventDefault();
            fileUpload.classList.add('dragover');
        }

        function handleDragLeave(event) {
            event.preventDefault();
            fileUpload.classList.remove('dragover');
        }

        function handleDrop(event) {
            event.preventDefault();
            fileUpload.classList.remove('dragover');
            const files = event.dataTransfer.files;
            if (files.length > 0) {
                fileInput.files = files;
                handleFileSelect({ target: { files: files } });
            }
        }

        // Form submission
        form.addEventListener('submit', async function(event) {
            event.preventDefault();

            const formData = new FormData();

            if (fileInput.files.length > 0) {
                formData.append('file', fileInput.files[0]);
            } else if (xmlContent.value.trim()) {
                formData.append('xml_content', xmlContent.value);
            } else {
                showMessage('Please provide XML content either by uploading a file or pasting it.', 'error');
                return;
            }

            showLoading();

            try {
                const response = await fetch('/convert', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();

                if (response.ok) {
                    currentHoconContent = data.hocon;
                    outputContent.textContent = data.hocon;
                    outputSection.style.display = 'block';
                    showMessage('Configuration converted successfully!', 'success');
                } else {
                    showMessage(data.error || 'Conversion failed', 'error');
                }
            } catch (error) {
                showMessage('Network error: ' + error.message, 'error');
            } finally {
                hideLoading();
            }
        });

        // Clear button
        clearBtn.addEventListener('click', function() {
            fileInput.value = '';
            xmlContent.value = '';
            fileInfo.textContent = '';
            outputSection.style.display = 'none';
            currentHoconContent = '';
            clearMessages();
        });

        // Copy button
        copyBtn.addEventListener('click', async function() {
            try {
                await navigator.clipboard.writeText(currentHoconContent);
                showMessage('Configuration copied to clipboard!', 'success');
            } catch (error) {
                showMessage('Failed to copy to clipboard', 'error');
            }
        });

        // Download button
        downloadBtn.addEventListener('click', function() {
            const blob = new Blob([currentHoconContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'emqx-config.hocon';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showMessage('Configuration downloaded!', 'success');
        });

        // Sample configuration loading
        document.querySelectorAll('.sample-card').forEach(card => {
            card.addEventListener('click', function() {
                const sampleId = this.getAttribute('data-sample');
                const sampleXml = sampleConfigs[sampleId];
                if (sampleXml) {
                    xmlContent.value = sampleXml;
                    showMessage(\`Loaded \${this.querySelector('h3').textContent} sample configuration\`, 'success');
                    // Auto-convert the sample
                    setTimeout(() => {
                        form.dispatchEvent(new Event('submit'));
                    }, 500);
                }
            });
        });

        function showMessage(message, type) {
            const messageDiv = document.createElement('div');
            messageDiv.className = type;
            messageDiv.textContent = message;
            messageContainer.appendChild(messageDiv);

            setTimeout(() => {
                messageDiv.remove();
            }, 5000);
        }

        function clearMessages() {
            messageContainer.innerHTML = '';
        }

        function showLoading() {
            convertBtn.innerHTML = '<span class="spinner"></span>Converting...';
            convertBtn.disabled = true;
        }

        function hideLoading() {
            convertBtn.innerHTML = '🔄 Convert to EMQX HOCON';
            convertBtn.disabled = false;
        }
    </script>
</body>
</html>
  `;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}
