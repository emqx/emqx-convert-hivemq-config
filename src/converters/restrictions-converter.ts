import { BaseConverter } from './base-converter.js';
import { HiveMQConfig, EMQXConfig, MqttEMQXConfig } from '../types.js';

export class RestrictionsConverter extends BaseConverter {
  convert(config: HiveMQConfig): EMQXConfig {
    if (!config.hivemq?.restrictions) {
      return {};
    }

    const restrictions = config.hivemq.restrictions;
    const result: EMQXConfig = {};
    let maxConnections: number | undefined;

    // Max Connections
    const maxConnectionsStr = this.getTextContent(restrictions, 'max-connections');
    if (maxConnectionsStr && maxConnectionsStr !== '-1') {
      maxConnections = parseInt(maxConnectionsStr, 10);
    }

    // Max Client ID Length
    const maxClientIdLength = this.getTextContent(restrictions, 'max-client-id-length');
    if (maxClientIdLength && maxClientIdLength !== '65535') {
      if (!result.mqtt) {
        result.mqtt = {};
      }
      result.mqtt.max_clientid_len = parseInt(maxClientIdLength, 10);
    }

    // Incoming Bandwidth Throttling
    const bandwidthThrottling = this.getTextContent(restrictions, 'incoming-bandwidth-throttling');
    if (bandwidthThrottling && bandwidthThrottling !== '0') {
      if (!result.mqtt) {
        result.mqtt = {};
      }
      if (!result.mqtt.limiter) {
        result.mqtt.limiter = {};
      }
      result.mqtt.limiter.bytes_rate = `${bandwidthThrottling}b/s`;
    }

    // Store max connections for later use in listener converter
    if (maxConnections) {
      (result as any)._max_connections = maxConnections;
    }

    return result;
  }
}