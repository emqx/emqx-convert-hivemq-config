import { BaseConverter } from './base-converter.js';
import { HiveMQConfig, EMQXConfig, MqttEMQXConfig } from '../types.js';

export class RestrictionsConverter extends BaseConverter {
  convert(config: HiveMQConfig): EMQXConfig {
    if (!config.hivemq?.restrictions) {
      return {};
    }

    const restrictions = config.hivemq.restrictions;
    const result: EMQXConfig = {};
    const warnings: string[] = [];
    let maxConnections: number | undefined;

    // Max Connections
    const maxConnectionsValue = restrictions['max-connections'];
    if (maxConnectionsValue !== undefined) {
      if (Number(maxConnectionsValue) === -1) {
        warnings.push(
          'Max connections is set to unlimited (-1). EMQX will use its default connection limits.'
        );
      } else {
        maxConnections = Number(maxConnectionsValue);
      }
    }

    // Max Client ID Length
    const maxClientIdLengthValue = restrictions['max-client-id-length'];
    if (maxClientIdLengthValue !== undefined) {
      if (Number(maxClientIdLengthValue) === 65535) {
        warnings.push(
          'Max client ID length is set to unlimited (65535). EMQX will use its default client ID length limits.'
        );
      } else {
        if (!result.mqtt) {
          result.mqtt = {};
        }
        result.mqtt.max_clientid_len = Number(maxClientIdLengthValue);
      }
    }

    // Incoming Bandwidth Throttling
    const bandwidthThrottlingValue =
      restrictions['incoming-bandwidth-throttling'];
    if (bandwidthThrottlingValue !== undefined) {
      if (Number(bandwidthThrottlingValue) === 0) {
        warnings.push(
          'Incoming bandwidth throttling is set to unlimited (0). EMQX will use its default bandwidth limits.'
        );
      } else {
        warnings.push(
          'Broker-wide incoming bandwidth throttling has no direct mapping. Configure EMQX listener/client rate limits manually.'
        );
      }
    }

    // Store max connections for later use in listener converter
    if (maxConnections !== undefined) {
      (result as any)._max_connections = maxConnections;
    }

    // Add warnings as comments if any
    if (warnings.length > 0) {
      (result as any)._warnings = warnings;
    }

    return result;
  }
}
