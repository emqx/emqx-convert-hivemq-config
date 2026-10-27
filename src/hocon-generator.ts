import { EMQXConfig } from './types.js';

/** Emit literal strings and keys; user content must never become HOCON syntax. */
export class HOCONGenerator {
  generate(config: EMQXConfig): string {
    const lines = [
      '# Converted from HiveMQ XML for EMQX 6.3.2.',
      '# Review migration notes before applying this configuration.',
      '',
    ];
    this.generateObject(config, lines, 0);
    return lines.join('\n') + '\n';
  }

  private key(value: string): string {
    return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(value)
      ? value
      : JSON.stringify(value);
  }

  private scalar(value: unknown): string {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error('Configuration contains an invalid numeric value.');
    }
    return JSON.stringify(value);
  }

  private generateObject(
    obj: Record<string, any>,
    lines: string[],
    indent: number
  ): void {
    const pad = '  '.repeat(indent);
    if (Array.isArray(obj._warnings)) {
      for (const warning of obj._warnings) {
        for (const line of String(warning).split(/\r\n|\r|\n/))
          lines.push(`${pad}# WARNING: ${line}`);
      }
      if (obj._warnings.length) lines.push('');
    }
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null || key === '_warnings')
        continue;
      const name = this.key(key);
      if (Array.isArray(value)) {
        lines.push(`${pad}${name} = [`);
        for (const [index, item] of value.entries()) {
          const comma = index < value.length - 1 ? ',' : '';
          if (item !== null && typeof item === 'object') {
            lines.push(`${pad}  {`);
            this.generateObject(item, lines, indent + 2);
            lines.push(`${pad}  }${comma}`);
          } else lines.push(`${pad}  ${this.scalar(item)}${comma}`);
        }
        lines.push(`${pad}]`);
      } else if (typeof value === 'object') {
        lines.push(`${pad}${name} {`);
        this.generateObject(value, lines, indent + 1);
        lines.push(`${pad}}`);
      } else lines.push(`${pad}${name} = ${this.scalar(value)}`);
    }
  }
}
