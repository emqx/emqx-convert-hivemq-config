import { XMLParserService } from './xml-parser.js';
import { HiveMQToEMQXConverter } from './converters/hivemq-to-emqx-converter.js';
import { HOCONGenerator } from './hocon-generator.js';

export class ConversionService {
  private xmlParser: XMLParserService;
  private converter: HiveMQToEMQXConverter;
  private hoconGenerator: HOCONGenerator;

  constructor() {
    this.xmlParser = new XMLParserService();
    this.converter = new HiveMQToEMQXConverter();
    this.hoconGenerator = new HOCONGenerator();
  }

  convertXmlToHocon(xmlContent: string): { hocon: string; error?: string } {
    try {
      // Parse XML
      const hivemqConfig = this.xmlParser.parse(xmlContent);

      // Convert to EMQX config
      const emqxConfig = this.converter.convert(hivemqConfig);

      // Generate HOCON
      let hocon = this.hoconGenerator.generate(emqxConfig);

      // Post-process for proper formatting
      // hocon = this.hoconGenerator.postProcess(hocon);

      return { hocon };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown conversion error';
      return { hocon: '', error: errorMessage };
    }
  }
}
