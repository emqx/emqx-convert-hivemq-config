# HiveMQ to EMQX Configuration Converter

An application with web interface that converts HiveMQ XML configuration files to EMQX HOCON format.

## Quick Start

### Prerequisites

* [Node.js](https://nodejs.org/) (v18 or later)
* [pnpm](https://pnpm.io/) package manager

```bash
pnpm install
pnpm run dev # press 'b' to open a browser
```

Or use CLI

```bash
pnpm run build
node dist/cli.js config.xml -o output.hocon
```

## Deployment

### Cloudflare Workers

1. **Login to Cloudflare**:

```bash
npx wrangler login
```

2. **Deploy**:

```bash
pnpm run deploy
```

## Development

### Project Structure

```
src/
├── types.ts                    # TypeScript type definitions
├── converters/                 # Conversion logic modules
│   ├── base-converter.ts      # Base converter class
│   ├── listener-converter.ts  # Listener conversion
│   ├── mqtt-converter.ts      # MQTT settings conversion
│   ├── restrictions-converter.ts
│   ├── cluster-converter.ts
│   ├── control-center-converter.ts
│   └── hivemq-to-emqx-converter.ts
├── xml-parser.ts              # XML parsing service
├── hocon-generator.ts         # HOCON output generation
├── conversion-service.ts      # Main conversion orchestrator
├── cli.ts                     # Command line interface
└── worker.ts                  # Cloudflare Worker entry point

dist/                          # Compiled JavaScript (generated)
├── worker.js                  # Compiled Cloudflare Worker
├── cli.js                     # Compiled CLI
└── ...                        # Other compiled files
```

### Adding New Converters

1. Create a new converter class extending `BaseConverter`
2. Implement the `convert()` method
3. Add the converter to `HiveMQToEMQXConverter`
4. Add corresponding types to `types.ts`

### Testing

The conversion logic is tested with sample configurations in the `conf/` directory.

#### Testing with EMQX

To verify that the generated configuration works with a real EMQX instance:

```bash
node dist/cli.js conf/config.xml > output.hocon
docker run -d --name emqx-test \
 -p 1883:1883 -p 8883:8883 -p 8083:8083 -p 8084:8084 -p 18083:18083 \
 -v $(pwd)/etc/emqx/ssl:/etc/emqx/ssl:ro \
 emqx/emqx-enterprise:6.0.0
for i in {1..30}; do if docker exec emqx-test emqx ctl status > /dev/null 2>&1; then break; fi; done
docker cp output.hocon emqx-test:/opt/emqx/etc/
docker exec emqx-test emqx ctl conf load etc/output.hocon
docker rm -f emqx-test
rm -f output.hocon
```

## Troubleshooting

### Debug Mode

Enable debug logging by setting `NODE_ENV=development`:

```bash
NODE_ENV=development node dist/cli.js config.xml
```
