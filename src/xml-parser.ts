import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { HiveMQConfig } from './types.js';

export class XMLParserService {
  private parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    // Keep identifiers, passwords, zero and false exactly as XML text.
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    maxNestedTags: 128,
  });

  parse(xmlContent: string): HiveMQConfig {
    if (!xmlContent.trim())
      throw new Error('Provide a non-empty XML configuration.');
    if (/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xmlContent)) {
      throw new Error('DTD and custom entity declarations are not supported.');
    }
    const validation = XMLValidator.validate(xmlContent);
    if (validation !== true) {
      throw new Error(
        `Invalid XML at line ${validation.err.line}, column ${validation.err.col}.`
      );
    }
    let parsed;
    try {
      parsed = this.parser.parse(xmlContent);
    } catch {
      throw new Error(
        'Could not parse XML. Check the document structure and nesting depth.'
      );
    }
    const roots = Object.keys(parsed).filter((key) => !key.startsWith('?'));
    if (
      roots.length !== 1 ||
      !['hivemq', 'kafka-configuration'].includes(roots[0] ?? '')
    ) {
      throw new Error(
        'Expected a <hivemq> or <kafka-configuration> root element.'
      );
    }
    const root = roots[0]!;
    const content = parsed[root] === '' ? {} : parsed[root];
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      throw new Error('The XML root must contain configuration elements.');
    }
    return root === 'hivemq'
      ? { hivemq: content }
      : { hivemq: { 'kafka-configuration': content } };
  }
}
