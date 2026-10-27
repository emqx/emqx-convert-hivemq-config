# HiveMQ to EMQX Configuration Converter

Convert **HiveMQ XML** broker and Kafka extension configurations into **EMQX 6.3.2** HOCON. Includes a local browser interface, HTTP API, CLI, migration notes, examples, and automated tests. Uses the same local workflow and interface as the [Mosquitto converter](https://github.com/emqx/emqx-convert-mosquitto-config).

## Quick start

Requires **Node.js 22+** and **pnpm 11.15.1** (pinned in `package.json`). Docker is optional, for EMQX integration tests.

```bash
pnpm install
pnpm dev
# Open http://127.0.0.1:8787
```

Paste XML, upload a file, or choose an example. Convert, review the migration notes, then copy or download the HOCON. Editing the input clears the previous result so an outdated conversion cannot be downloaded accidentally.

The browser connects to a local Node.js server. Configuration text is processed in memory and is not logged, persisted, or sent to an external service. Referenced certificate, schema and credential files are never fetched. No cloud account is required.

`pnpm dev` builds and starts the server. After building, use `pnpm start`, `pnpm start --port 9000`, or `PORT=9000 pnpm start`. The server binds to `127.0.0.1` and rejects foreign hosts and cross-origin conversion requests.

### CLI

```bash
pnpm build
node dist/cli.js conf/config.xml -o emqx.hocon
node dist/cli.js extensions/hivemq-kafka-extension/conf/examples/config.xml --json
cat config.xml | node dist/cli.js -
node dist/cli.js --help
```

HOCON goes to stdout unless `-o` is supplied. Migration notes go to stderr and appear as comments in the HOCON. `--json` returns `hocon`, `warnings`, `disabledListeners`, and the structured `config`. `--strict` exits with code 2 and writes no output if any warning remains; conversion and argument errors exit with code 1.

A library caller can import `ConversionService` and call `convertXmlToHocon(xml)`. Conversion errors return `result.error` and an empty HOCON string.

## Conversion coverage

The converter accepts a `<hivemq>` root or a standalone `<kafka-configuration>` root. It validates XML syntax, rejects DTD/custom entity declarations, and bounds nesting. The bundled XSD files document the input examples; conversion does not perform complete XSD validation.

| HiveMQ setting                                     | EMQX output / behavior                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| TCP listeners                                      | Bind addresses and ports, including IPv4/IPv6 and `localhost`                                           |
| WebSocket listeners                                | Bind addresses, MQTT path and subprotocols                                                              |
| TLS TCP / WebSocket listeners                      | Client certificate verification settings and PEM placeholders; listeners remain disabled pending review |
| Queued messages and topic aliases                  | Queue length and maximum topic aliases                                                                  |
| Session / message expiry                           | EMQX expiry settings, with warnings about MQTT 5 differences                                            |
| Packet size, QoS, retained messages, subscriptions | MQTT limits and capability switches                                                                     |
| Connection / client ID restrictions                | Per-listener connection limits and maximum client ID length                                             |
| Static cluster discovery                           | `emqx@host` seed names, with node/network migration notes                                               |
| Control Center HTTP listener                       | EMQX Dashboard HTTP bind address                                                                        |
| Kafka clusters                                     | Producer/consumer connectors, SASL authentication and TLS placeholders                                  |
| MQTT → Kafka mappings                              | Producer actions and routing rules                                                                      |
| Kafka → MQTT mappings                              | Consumer sources and republish rule templates                                                           |

When a `<listeners>` section is present, unused stock MQTT listeners (`tcp`, `ssl`, `ws`, `wss`, `quic`) are disabled. Named listeners already present in an existing EMQX installation can still be merged with the output. A configuration containing only MQTT settings or Kafka mappings leaves listener configuration untouched.

### Manual migration

- **Authentication and authorization:** Broker XML does not capture the policies implemented by HiveMQ extensions. Migrate users, credentials, ACLs and security extensions separately before exposing EMQX listeners. Their policies are not inferred or installed by this tool.
- **TLS:** Java keystores and truststores are not converted. Export PEM files, replace `/path/to/*.pem`, review TLS versions/ciphers, and only then enable the generated TLS listeners. Example keystore paths and passwords are placeholders; key material is not distributed with this repository.
- **Clustering:** Review node names, the shared cookie, DNS and distribution ports. HiveMQ cluster TCP ports do not map directly to Erlang distribution. Other discovery methods require manual configuration.
- **Dashboard and APIs:** Control Center users, roles and HTTPS settings are not migrated. HiveMQ REST/health APIs are reported for manual migration.
- **MQTT behavior:** Session/message expiry and queue overflow semantics differ between brokers. Keepalive restrictions, receive-maximum settings and subscription-identifier restrictions have migration notes. Broker-wide bandwidth limits need a separate EMQX rate-limit policy.
- **Kafka:** Review every generated connector, action, source and rule. Kafka-to-MQTT rules currently republish to the literal topic `kafka`; adapt the topic and payload to your application. Consumer groups, delivery semantics and advanced mapping options require review. Inline SASL credentials are preserved in the result, so treat generated HOCON/JSON as sensitive. Kafka TLS also needs PEM paths.
- **Other extensions and broker state:** Security/database/cloud extensions, retained data and client sessions are not imported. Unsupported top-level broker sections produce warnings. Nested options outside the coverage above may require additional manual work.

## Apply the result

Review the HOCON and migration notes, supply certificate files, and validate it on a **fresh EMQX 6.3.2 instance**:

```bash
# Place the reviewed configuration in /opt/emqx/etc/base.hocon on the EMQX host.
emqx check_config
```

Existing `cluster.hocon`, `emqx.conf`, environment variables and Dashboard changes can override or merge with `base.hocon`. Validate the effective configuration and MQTT behavior in staging before replacing a broker.

Cluster discovery is a startup setting. The stock `emqx.conf` explicitly selects manual discovery; place the reviewed `cluster` section there (or remove the conflicting setting) and restart EMQX to use static seeds.

## HTTP API

```bash
curl http://127.0.0.1:8787/convert \
  -H 'Content-Type: application/xml' --data-binary @config.xml

curl http://127.0.0.1:8787/convert -F file=@config.xml
```

`POST /convert` accepts `application/xml`, `text/xml`, `text/plain`, JSON `{ "config": "..." }`, or an uploaded `file`. Legacy JSON/form field `xml_content` is also supported. Responses contain the same fields as CLI `--json`. Missing/malformed configurations return 400, bodies over 1 MiB return 413, and unsupported content types return 415. Use the CLI for larger files.

## Development and tests

```bash
pnpm install --frozen-lockfile
pnpm type-check
pnpm format:check
pnpm test
pnpm test:emqx
pnpm test:emqx:config conf/config.xml
```

`pnpm test` covers XML validation, conversions, warnings, HOCON escaping, CLI behavior, HTTP requests and server protections. It also checks integration-runner failure handling using a Docker stub.

`pnpm test:emqx` tests the real HOCON verifier, then runs the 13 maintained XML examples listed in `test/emqx-inputs.txt` against isolated **EMQX 6.3.2** containers. Each broker case converts the XML, runs `emqx check_config`, loads the output, reads the runtime configuration, and compares every generated setting after EMQX schema normalization. Static clustering uses restart loading. TLS listeners are tested in their disabled, pending-migration state. The Kafka example receives schema validation only because a running Kafka cluster and reviewed mappings are separate prerequisites.

The runner accepts a file or stdin, works from other directories, stops at the first failed stage, and removes its container on success or failure. It publishes no host ports. Logs, generated HOCON and runtime dumps stay in the ignored `test-results/emqx/` directory; they can contain credentials from your input.

```bash
# After pnpm build:
cat config.xml | bash scripts/test-emqx.sh
bash scripts/test-emqx.sh --restart conf/examples/configuration/cluster/config-sample-cluster-tcp.xml
bash scripts/test-emqx.sh --check-only extensions/hivemq-kafka-extension/conf/examples/config.xml
bash scripts/test-emqx.sh --mount /absolute/local/certs:/path/to config.xml
```

`--mount` accepts explicit read-only certificate/support directories. EMQX checks PEM files even for disabled TLS listeners; supply those files before loading a TLS conversion. The maintained suite generates temporary self-signed PEM files for its fixtures and removes them afterward. `EMQX_IMAGE` overrides the image for additional compatibility checks. Configuration acceptance and runtime equality do not establish MQTT traffic, TLS handshake, access-control or Kafka delivery behavior.

The optional `docker-compose-emqx-kafka.yml` sandbox pins EMQX 6.3.2 and Kafka 4.4.0, binds published ports to loopback, and creates test topics. Use `kafka.emqx.io:9092` for connectors running inside that Compose network. It does not automatically load converted configurations.

```text
src/
  xml-parser.ts                # Validated XML input
  converters/                  # Listener, MQTT, restriction, cluster, Dashboard and Kafka mappings
  hocon-generator.ts           # Escaped HOCON and migration comments
  conversion-service.ts        # Shared CLI/HTTP/library API
  cli.ts                       # Local file, stdin and output handling
  http-handler.ts              # HTTP routing, uploads and request limits
  server.ts                    # Local Node.js server
  frontend.ts                  # Browser interface
  examples.ts                  # Interactive samples
conf/                          # Broker schemas and sample XML
extensions/hivemq-kafka-extension/ # Kafka schema and sample XML
test/                          # Unit, HTTP, CLI and integration tests
scripts/                       # Build cleanup and EMQX validation runner
```

GitHub Actions runs frozen pnpm installs, formatting, type checking and unit/API tests on Node.js 22 and 24, plus real EMQX validation on Node.js 22.

## Contributing

Keep conversion logic in the shared service/converter modules, add regression coverage for behavior changes, and run the checks above. Include only synthetic configurations in tests and issues; remove credentials, private keys and customer identifiers. See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow.

## References and license

- [HiveMQ configuration reference](https://docs.hivemq.com/hivemq/latest/user-guide/configuration.html)
- [EMQX 6.3.2 release](https://github.com/emqx/emqx/releases/tag/6.3.2) and [schema source](https://github.com/emqx/emqx/blob/6.3.2/apps/emqx/src/emqx_schema.erl)
- [Apache Kafka 4.4.0 release](https://kafka.apache.org/blog/2026/10/22/apache-kafka-4.4.0-release-announcement/)

Licensed under [Apache-2.0](LICENSE).
