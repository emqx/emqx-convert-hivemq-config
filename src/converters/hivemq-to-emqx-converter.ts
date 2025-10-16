import { HiveMQConfig, EMQXConfig } from '../types.js';
import { ListenerConverter } from './listener-converter.js';
import { MqttConverter } from './mqtt-converter.js';
import { RestrictionsConverter } from './restrictions-converter.js';
import { ClusterConverter } from './cluster-converter.js';
import { ControlCenterConverter } from './control-center-converter.js';

export class HiveMQToEMQXConverter {
  private converters = [
    new ListenerConverter(),
    new MqttConverter(),
    new RestrictionsConverter(),
    new ClusterConverter(),
    new ControlCenterConverter()
  ];

  convert(config: HiveMQConfig): EMQXConfig {
    const result: EMQXConfig = {};

    for (const converter of this.converters) {
      const converted = converter.convert(config);
      this.deepMerge(result, converted);
    }

    // Apply max connections from restrictions to all listeners
    this.applyMaxConnections(result);

    return result;
  }

  private deepMerge(target: any, source: any): any {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
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
    if (!maxConnections || !config.listeners) {
      return;
    }

    // Remove the temporary property
    delete (config as any)._max_connections;

    // Apply max connections to all listeners
    for (const listenerType in config.listeners) {
      const listeners = config.listeners[listenerType as keyof typeof config.listeners];
      if (listeners && typeof listeners === 'object') {
        for (const listenerName in listeners) {
          const listener = listeners[listenerName as keyof typeof listeners];
          if (listener && typeof listener === 'object') {
            (listener as any).max_connections = maxConnections;
          }
        }
      }
    }
  }
}