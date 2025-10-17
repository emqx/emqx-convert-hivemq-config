import { HiveMQConfig, EMQXConfig } from '../types.js';

export abstract class BaseConverter {
  abstract convert(config: HiveMQConfig): EMQXConfig;

  protected deepMerge(target: any, source: any): any {
    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        if (
          !target[key] ||
          typeof target[key] !== 'object' ||
          Array.isArray(target[key])
        ) {
          target[key] = {};
        }
        this.deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  protected getTextContent(element: any, tagName: string): string | undefined {
    if (!element || !element[tagName]) return undefined;
    const value = element[tagName];
    return typeof value === 'string' ? value.trim() : String(value);
  }

  protected getArrayContent(element: any, tagName: string): string[] {
    if (!element || !element[tagName]) return [];
    const items = element[tagName];
    if (Array.isArray(items)) {
      return items
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
    }
    return typeof items === 'string' ? [items.trim()] : [];
  }
}
