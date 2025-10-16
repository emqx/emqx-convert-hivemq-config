import { XMLParser } from 'fast-xml-parser';
import { HiveMQConfig } from './types.js';

export class XMLParserService {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      trimValues: true
    });
  }

  parse(xmlContent: string): HiveMQConfig {
    try {
      const parsed = this.parser.parse(xmlContent);
      
      // The parser returns the root element directly
      // We need to wrap it in the expected structure
      if (parsed.hivemq) {
        return parsed as HiveMQConfig;
      }
      
      // If the root element is not 'hivemq', wrap it
      return {
        hivemq: parsed
      } as HiveMQConfig;
    } catch (error) {
      throw new Error(`Failed to parse XML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}