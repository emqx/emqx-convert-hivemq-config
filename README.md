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

To convert a configuration file, run the `main.py` script, passing the path to your HiveMQ XML file as an argument.

```bash
uv run main.py <path-to-hivemq-xml-file>
```

### Example

```bash
uv run main.py hmq-config-examples/config-sample-mqtt.xml
```

The script will output the converted EMQX HOCON configuration to the console.

## Testing the Generated Configuration

You can test the generated configuration using the official EMQX Docker image.

### Prerequisites

* [Docker](https://www.docker.com/get-started) installed and running.

### Steps

#### Generate the EMQX Configuration File

First, run the converter and save the output to a file named `emqx.conf`. For example, using the TLS sample configuration:

```bash
uv run main.py hmq-config-examples/tls/config-sample-mqtt-tls.xml > base.hocon
```

This will also generate the necessary certificate files in the `import/ssl/` directory.

#### Run the EMQX Docker Container

Now, run the `emqx/emqx-enterprise:5.10.0` Docker image. You'll need to mount the `emqx.conf` file and the generated certificates into the container.

```bash
docker run -d --name emqx-test \
  -p 1883:1883 -p 8883:8883 -p 8083:8083 -p 8084:8084 -p 18083:18083 \
  -v $(pwd)/base.hocon:/opt/emqx/etc/base.hocon:ro \
  -v $(pwd)/import/ssl:/etc/emqx/ssl:ro \
  emqx/emqx-enterprise:5.10.0
```
*Note: The `-p` flags map the default EMQX ports to your host machine. Adjust them if your configuration uses different ports.*

#### Verify EMQX Startup

Check the container logs to ensure that EMQX has started successfully.

```bash
docker logs -f emqx-test
```

Look for a log entry like `EMQX 5.10.0 is running`. Press `Ctrl+C` to exit the logs.

#### Verify the Configuration

Once the container is running, you can test the listener functionality.

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
uv run main.py hmq-config-examples/tls/config-sample-mqtt-tls-client-auth.xml > base.hocon
```

Then, start the EMQX container as described before.

To connect, you will need a client certificate (`client.pem`) and a private key (`client.key`). The certificate must be trusted by the CA certificates configured in the server's truststore (`hmq-config-examples/tls/truststore.jks`).

The `openssl` command is as follows:
```bash
openssl s_client -connect localhost:8883 -cert client.pem -key client.key
```

**Note:** If you don't have a valid client certificate, you can generate a self-signed one for a quick test:
```bash
openssl req -x509 -newkey rsa:2048 -keyout client.key -out client.pem -sha256 -days 365 -nodes -subj "/CN=MyTestClient"
```

When you use this self-signed certificate, the connection will likely fail verification because the server's truststore doesn't trust it. However, you can observe in the `openssl` output that the server *requests* a client certificate, which confirms that mTLS is correctly configured on the server side. You will see a line like `Acceptable client certificate CA names` in the output.

