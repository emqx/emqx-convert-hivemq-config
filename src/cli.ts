#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { ConversionService } from './conversion-service.js';

const help = `HiveMQ to EMQX Configuration Converter

Usage: hivemq-convert <config.xml|-> [options]

Options:
  -o, --output <path>  Write HOCON (or JSON) to a file instead of stdout
  --json               Return HOCON, migration warnings and structured config
  --strict             Exit with code 2 and write no output if warnings remain
  -h, --help           Show this help

Examples:
  node dist/cli.js conf/config.xml -o emqx.hocon
  cat config.xml | node dist/cli.js -
  node dist/cli.js config.xml --json
`;

function main(): void {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) {
    console.log(help);
    return;
  }
  let input: string | undefined;
  let output: string | undefined;
  let json = false;
  let strict = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '-o' || arg === '--output') {
      output = args[++i];
      if (!output || output.startsWith('-'))
        throw new Error(`${arg} requires an output path.`);
    } else if (arg === '--json') json = true;
    else if (arg === '--strict') strict = true;
    else if (arg.startsWith('-') && arg !== '-')
      throw new Error(`Unknown option: ${arg}`);
    else if (input !== undefined)
      throw new Error(`Unexpected argument: ${arg}`);
    else input = arg;
  }
  if (!input)
    throw new Error(
      'Provide an XML file or - for stdin. Use --help for examples.'
    );
  const result = new ConversionService().convertXmlToHocon(
    readFileSync(input === '-' ? 0 : input, 'utf8')
  );
  if (result.error) throw new Error(result.error);
  for (const warning of result.warnings)
    console.error(`Warning: ${warning.message}`);
  if (strict && result.warnings.length) {
    process.exitCode = 2;
    return;
  }
  const text = json ? JSON.stringify(result, null, 2) + '\n' : result.hocon;
  if (output) writeFileSync(output, text, { encoding: 'utf8', mode: 0o600 });
  else process.stdout.write(text);
}

try {
  main();
} catch (error) {
  console.error(
    `Error: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
}
