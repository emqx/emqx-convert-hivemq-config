import { EMQXConfig } from './types.js';

export class HOCONGenerator {
  generate(config: EMQXConfig): string {
    const lines: string[] = [];
    this.generateObject(config, lines, 0);
    return lines.join('\n');
  }

  private generateObject(obj: any, lines: string[], indent: number): void {
    const indentStr = '  '.repeat(indent);
    
    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        continue;
      }

      if (Array.isArray(value)) {
        this.generateArray(key, value, lines, indent);
      } else if (typeof value === 'object') {
        lines.push(`${indentStr}${key} {`);
        this.generateObject(value, lines, indent + 1);
        lines.push(`${indentStr}}`);
      } else if (typeof value === 'string') {
        lines.push(`${indentStr}${key} = "${value}"`);
      } else if (typeof value === 'boolean') {
        lines.push(`${indentStr}${key} = ${value}`);
      } else if (typeof value === 'number') {
        lines.push(`${indentStr}${key} = ${value}`);
      }
    }
  }

  private generateArray(key: string, arr: any[], lines: string[], indent: number): void {
    const indentStr = '  '.repeat(indent);
    
    if (arr.length === 0) {
      lines.push(`${indentStr}${key} = []`);
      return;
    }

    lines.push(`${indentStr}${key} = [`);
    
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      if (typeof item === 'string') {
        lines.push(`${indentStr}  "${item}"`);
      } else if (typeof item === 'number') {
        lines.push(`${indentStr}  ${item}`);
      } else if (typeof item === 'boolean') {
        lines.push(`${indentStr}  ${item}`);
      } else if (typeof item === 'object') {
        lines.push(`${indentStr}  {`);
        this.generateObject(item, lines, indent + 2);
        lines.push(`${indentStr}  }`);
      }
      
      if (i < arr.length - 1) {
        lines[lines.length - 1] += ',';
      }
    }
    
    lines.push(`${indentStr}]`);
  }

}