import { BaseConverter } from './base-converter.js';
import { HiveMQConfig, EMQXConfig } from '../types.js';

export class ControlCenterConverter extends BaseConverter {
  convert(config: HiveMQConfig): EMQXConfig {
    if (!config.hivemq?.['control-center']) {
      return {};
    }

    const controlCenter = config.hivemq['control-center'];
    this.warn(
      'Control Center users, roles and HTTPS settings require manual migration to the EMQX Dashboard.'
    );
    if (this.getTextContent(controlCenter, 'enabled') === 'false') return {};

    if (!controlCenter.listeners?.http) {
      return {};
    }

    const httpListener = controlCenter.listeners.http;
    const port = this.getTextContent(httpListener, 'port') || '18083';
    const bindAddress =
      this.getTextContent(httpListener, 'bind-address') || '0.0.0.0';

    // Convert to EMQX dashboard configuration
    const dashboardConfig = {
      listeners: {
        http: {
          bind: `${bindAddress === 'localhost' ? '127.0.0.1' : bindAddress}:${port}`,
        },
      },
    };

    return { dashboard: dashboardConfig };
  }
}
