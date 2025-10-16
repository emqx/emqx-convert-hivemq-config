# HiveMQ to EMQX Configuration Converter

This tool converts HiveMQ XML configuration files to the EMQX HOCON format.

## Requirements

* Python 3.11 or higher
* [uv](https://github.com/astral-sh/uv) (for environment and dependency management)

## Setup

1. Create the virtual environment:

```bash
uv venv
```

2. Install the required dependencies:

```bash
uv sync
```

## Usage

### Web Interface (Recommended)

The easiest way to use the converter is through the web interface:

1. Start the web server:
```bash
uv run run_web.py
```

2. Open your browser and go to: http://localhost:8080

3. Either upload a HiveMQ XML file or paste the XML content directly

4. Click "Convert to EMQX HOCON" to get the converted configuration

5. Copy the result or download it as a `.hocon` file

### Command Line Interface

To convert a configuration file from the command line, run the `main.py` script, passing the path to your HiveMQ XML file as an argument.

```bash
uv run src/main.py <path-to-hivemq-xml-file>
```

### Example

We extracted configuration examples from the official HiveMQ docker image into `conf` and `extensions` directories.

```bash
uv run src/main.py conf/examples/configuration/config-sample-mqtt.xml
uv run src/main.py extensions/hivemq-kafka-extension/conf/examples/config.xml
```

These will output the converted EMQX HOCON configuration to the console.

```bash
uv run src/main.py conf/examples/configuration/config-sample-mqtt.xml > emqx.hocon
uv run src/main.py extensions/hivemq-kafka-extension/conf/examples/config.xml > emqx.hocon
```

These commands will save the output to `emqx.hocon`.

## Testing the Generated Configuration

You can test the generated configuration using the official EMQX Docker image.

### Prerequisites

* [Docker](https://www.docker.com/get-started) installed and running.

### Steps

#### Run the EMQX Docker Container with empty base.hocon

Create an empty `base.hocon` file, and run the `emqx/emqx-enterprise:5.10.0` Docker image.
Mount `./etc/emqx/ssl` directory, the script will generate certificates if required by the source config, and save them there.

```bash
rm -f base.hocon; touch base.hocon
docker run -d --name emqx-test \
  -p 1883:1883 -p 8883:8883 -p 8083:8083 -p 8084:8084 -p 18083:18083 \
  -v $(pwd)/base.hocon:/opt/emqx/etc/base.hocon:ro \
  -v $(pwd)/etc/emqx/ssl:/etc/emqx/ssl:ro \
  emqx/emqx-enterprise:5.10.0
```
*Note: The `-p` flags map the default EMQX ports to your host machine. Adjust them if your configuration uses different ports.*

#### Generate the EMQX Configuration File

First, run the converter and save the output to a file named `emqx.conf`. For example, using the TLS sample configuration:

```bash
uv run src/main.py conf/examples/configuration/tls/config-sample-mqtt-tls.xml > base.hocon
```

This will also generate the necessary certificate files in the `./etc/emqx/ssl/` directory.

#### Validate the config

Run `emqx check_config` in the running emqx container to validate configuration.

```bash
docker exec -it emqx-test emqx check_config
```

If everything is good, this command will not print anything.
You can then trigger config reload to further validate correctness of TLS configuration, data integrations, etc.

```bash
docker exec -it emqx-test emqx ctl conf load --replace /opt/emqx/etc/base.hocon
load listeners on cluster ok
```

#### Verify Listeners

Once the container is running with new configuration, you can test the listener functionality.

To test a TCP listener on port 1883 you can use [mqttx](https://mqttx.app/downloads) tool:

```bash
mqttx sub -h localhost -p 1883 -q 1 -t test
✔ Connected
✔ Subscribed to test
```

For an SSL listener (e.g., on port 8883), you can use `openssl` to test the connection and inspect the server's certificate:

```bash
# Test the SSL listener connection
openssl s_client -connect localhost:8883
```

If the connection is successful, you will see the server's certificate details and a handshake verification message (e.g., `Verify return code: 0 (ok)`). You can then type MQTT commands or random text to see if the connection stays open. Press `Ctrl+C` to exit.

To inspect the full configuration running inside the container, you can still use `emqx ctl`:
```bash
docker exec emqx-test emqx ctl conf show
```

#### Clean Up

After you're done testing, stop and remove the container:

```bash
docker rm -f emqx-test
```

### Testing Mutual TLS (mTLS)

To test a listener with client authentication set to `REQUIRED`, you need to provide a client certificate and key during the `openssl` connection test.

First, generate the configuration using an example that requires client authentication, like `config-sample-mqtt-tls-client-auth.xml`:

```bash
uv run src/main.py conf/examples/configuration/tls/config-sample-mqtt-tls-client-auth.xml > base.hocon
```

Then, start the EMQX container as described before.

To connect, you will need a client certificate (`client.pem`) and a private key (`client.key`). The certificate must be trusted by the CA certificates configured in the server's truststore (`conf/examples/configuration/tls/truststore.jks`).

The `openssl` command is as follows:
```bash
openssl s_client -connect localhost:8883 -cert client.pem -key client.key
```

**Note:** If you don't have a valid client certificate, you can generate a self-signed one for a quick test:
```bash
openssl req -x509 -newkey rsa:2048 -keyout client.key -out client.pem -sha256 -days 365 -nodes -subj "/CN=MyTestClient"
```

When you use this self-signed certificate, the connection will likely fail verification because the server's truststore doesn't trust it. However, you can observe in the `openssl` output that the server *requests* a client certificate, which confirms that mTLS is correctly configured on the server side. You will see a line like `Acceptable client certificate CA names` in the output.

