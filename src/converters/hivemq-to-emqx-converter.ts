import { HiveMQConfig, EMQXConfig } from '../types.js';
import { ListenerConverter } from './listener-converter.js';
import { MqttConverter } from './mqtt-converter.js';
import { RestrictionsConverter } from './restrictions-converter.js';
import { ClusterConverter } from './cluster-converter.js';
import { ControlCenterConverter } from './control-center-converter.js';
import { KafkaConverter } from './kafka-converter.js';

export class HiveMQToEMQXConverter {
  convert(config: HiveMQConfig): EMQXConfig {
    const result: EMQXConfig = {};
    const warnings: string[] = [];
    const warn = (message: string) => warnings.push(message);
    const converters = [
      new ListenerConverter(warn),
      new MqttConverter(warn),
      new RestrictionsConverter(warn),
      new ClusterConverter(warn),
      new ControlCenterConverter(warn),
      new KafkaConverter(warn),
    ];

    for (const converter of converters) {
      const converted = converter.convert(config);
      this.deepMerge(result, converted);
    }

    // Apply max connections from restrictions to all listeners
    this.applyMaxConnections(result);

    const supported = new Set([
      'listeners',
      'mqtt',
      'restrictions',
      'cluster',
      'control-center',
      'kafka-configuration',
    ]);
    for (const section of Object.keys(config.hivemq)) {
      if (!section.startsWith('@_') && !supported.has(section)) {
        warn(
          `The HiveMQ ${section} section is not converted. Migrate it manually.`
        );
      }
    }
    result._warnings = [...new Set([...(result._warnings ?? []), ...warnings])];

    return result;
  }

  private deepMerge(target: any, source: any): any {
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

  private applyMaxConnections(config: EMQXConfig): void {
    const maxConnections = (config as any)._max_connections;
    delete (config as any)._max_connections;
    if (maxConnections === undefined || !config.listeners) {
      return;
    }

    // Apply max connections to all listeners
    for (const listenerType in config.listeners) {
      const listeners =
        config.listeners[listenerType as keyof typeof config.listeners];
      if (listeners && typeof listeners === 'object') {
        for (const listenerName in listeners) {
          const listener = listeners[listenerName as keyof typeof listeners];
          if (listener && typeof listener === 'object' && listener.bind) {
            (listener as any).max_connections = maxConnections;
          }
        }
      }
    }
  }
}
