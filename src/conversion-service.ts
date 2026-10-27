import { XMLParserService } from './xml-parser.js';
import { HiveMQToEMQXConverter } from './converters/hivemq-to-emqx-converter.js';
import { HOCONGenerator } from './hocon-generator.js';
import { EMQXConfig } from './types.js';

export interface ConversionResult {
  hocon: string;
  warnings: { message: string }[];
  disabledListeners: string[];
  config?: EMQXConfig;
  error?: string;
}

export class ConversionService {
  convertXmlToHocon(xmlContent: string): ConversionResult {
    try {
      const parsed = new XMLParserService().parse(xmlContent);
      const config = new HiveMQToEMQXConverter().convert(parsed);
      const warnings = (config._warnings ?? []).map((message) => ({ message }));
      const disabledListeners: string[] = [];
      for (const [type, listeners] of Object.entries(config.listeners ?? {})) {
        for (const [name, listener] of Object.entries(listeners)) {
          if (!listener.enable && listener.bind)
            disabledListeners.push(`${type}:${name}`);
        }
      }
      const hocon = new HOCONGenerator().generate(config);
      delete config._warnings;
      return { hocon, warnings, disabledListeners, config };
    } catch (error) {
      return {
        hocon: '',
        warnings: [],
        disabledListeners: [],
        error:
          error instanceof Error ? error.message : 'Unknown conversion error',
      };
    }
  }
}
