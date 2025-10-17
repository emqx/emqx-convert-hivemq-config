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
    const maxConnectionsValue = restrictions['max-connections'];
    if (
      maxConnectionsValue !== undefined &&
      Number(maxConnectionsValue) !== -1
    ) {
      maxConnections = Number(maxConnectionsValue);
    }

    // Max Client ID Length
    const maxClientIdLengthValue = restrictions['max-client-id-length'];
    if (
      maxClientIdLengthValue !== undefined &&
      Number(maxClientIdLengthValue) !== 65535
    ) {
      if (!result.mqtt) {
        result.mqtt = {};
      }
      result.mqtt.max_clientid_len = Number(maxClientIdLengthValue);
    }

    // Incoming Bandwidth Throttling
    const bandwidthThrottlingValue =
      restrictions['incoming-bandwidth-throttling'];
    if (
      bandwidthThrottlingValue !== undefined &&
      Number(bandwidthThrottlingValue) !== 0
    ) {
      if (!result.mqtt) {
        result.mqtt = {};
      }
      if (!result.mqtt.limiter) {
        result.mqtt.limiter = {};
      }
      result.mqtt.limiter.bytes_rate = `${bandwidthThrottlingValue}b/s`;
    }

    // Store max connections for later use in listener converter
    if (maxConnections) {
      (result as any)._max_connections = maxConnections;
    }

    return result;
  }
}
