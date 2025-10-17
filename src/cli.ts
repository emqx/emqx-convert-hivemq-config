#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { ConversionService } from './conversion-service.js';
import { resolve } from 'path';

interface CliOptions {
  input: string;
  output?: string;
  help: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    input: '',
    output: undefined,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '-h' || arg === '--help') {
      options.help = true;
    } else if (arg === '-o' || arg === '--output') {
      options.output = args[++i];
    } else if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    } else if (!options.input) {
      options.input = arg;
    } else {
      console.error(`Unexpected argument: ${arg}`);
      process.exit(1);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
HiveMQ to EMQX Configuration Converter

Usage:
  node cli.js <input-file> [options]

Arguments:
  <input-file>    Path to HiveMQ XML configuration file

Options:
  -o, --output    Output file path (default: stdout)
  -h, --help      Show this help message

Examples:
  node cli.js config.xml
  node cli.js config.xml -o output.hocon
  node cli.js config.xml --output /path/to/output.hocon

Environment:
  NODE_ENV=development  Enable debug logging
`);
}

async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help || !options.input) {
    printHelp();
    process.exit(options.help ? 0 : 1);
  }

  try {
    // Read input file
    const inputPath = resolve(options.input);
    const xmlContent = readFileSync(inputPath, 'utf-8');

    if (process.env.NODE_ENV === 'development') {
      console.error(`Reading file: ${inputPath}`);
    }

    // Convert XML to HOCON
    const conversionService = new ConversionService();
    const result = conversionService.convertXmlToHocon(xmlContent);

    if (result.error) {
      throw new Error(result.error);
    }

    if (process.env.NODE_ENV === 'development') {
      console.error('Conversion completed successfully');
    }

    // Output result
    if (options.output) {
      const outputPath = resolve(options.output);
      writeFileSync(outputPath, result.hocon, 'utf-8');
      console.error(`Output written to: ${outputPath}`);
    } else {
      console.log(result.hocon);
    }
  } catch (error) {
    console.error(
      'Error:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

main().catch((error) => {
  console.error('Fatal Error:', error.message);
  process.exit(1);
});
