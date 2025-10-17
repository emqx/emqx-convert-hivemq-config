import { BaseConverter } from './base-converter.js';
import {
  HiveMQConfig,
  EMQXConfig,
  TcpListenerConfig,
  SslListenerConfig,
  WsListenerConfig,
  WssListenerConfig,
  WebSocketOptions,
  SslOptions,
} from '../types.js';

export class ListenerConverter extends BaseConverter {
  convert(config: HiveMQConfig): EMQXConfig {
    const result: EMQXConfig = {};

    if (!config.hivemq?.listeners) {
      return result;
    }

    const listeners = config.hivemq.listeners;
    result.listeners = {};

    // Convert TCP listeners
    if (listeners['tcp-listener']) {
      const tcpListeners = Array.isArray(listeners['tcp-listener'])
        ? listeners['tcp-listener']
        : [listeners['tcp-listener']];
      result.listeners.tcp = this.convertTcpListeners(tcpListeners);
    }

    // Convert WebSocket listeners
    if (listeners['websocket-listener']) {
      const wsListeners = Array.isArray(listeners['websocket-listener'])
        ? listeners['websocket-listener']
        : [listeners['websocket-listener']];
      result.listeners.ws = this.convertWebSocketListeners(wsListeners);
    }

    // Convert TLS TCP listeners
    if (listeners['tls-tcp-listener']) {
      const tlsTcpListeners = Array.isArray(listeners['tls-tcp-listener'])
        ? listeners['tls-tcp-listener']
        : [listeners['tls-tcp-listener']];
      result.listeners.ssl = this.convertTlsTcpListeners(tlsTcpListeners);
    }

    // Convert TLS WebSocket listeners
    if (listeners['tls-websocket-listener']) {
      const tlsWsListeners = Array.isArray(listeners['tls-websocket-listener'])
        ? listeners['tls-websocket-listener']
        : [listeners['tls-websocket-listener']];
      result.listeners.wss = this.convertTlsWebSocketListeners(tlsWsListeners);
    }

    return result;
  }

  private convertTcpListeners(
    listeners: any[]
  ): Record<string, TcpListenerConfig> {
    const result: Record<string, TcpListenerConfig> = {};

    for (const listener of listeners) {
      const port = this.getTextContent(listener, 'port') || '1883';
      const bindAddress =
        this.getTextContent(listener, 'bind-address') || '0.0.0.0';
      const listenerName = port === '1883' ? 'default' : `tcp-${port}`;

      result[listenerName] = {
        enable: true,
        bind: `${bindAddress}:${port}`,
      };
    }

    return result;
  }

  private convertWebSocketListeners(
    listeners: any[]
  ): Record<string, WsListenerConfig> {
    const result: Record<string, WsListenerConfig> = {};

    for (const listener of listeners) {
      const port = this.getTextContent(listener, 'port') || '8000';
      const bindAddress =
        this.getTextContent(listener, 'bind-address') || '0.0.0.0';
      const listenerName = port === '8000' ? 'default' : `ws-${port}`;

      const websocketOptions: WebSocketOptions = {
        fail_if_no_subprotocol: true,
      };

      const path = this.getTextContent(listener, 'path');
      if (path) {
        websocketOptions.mqtt_path = path;
      }

      const subprotocols = this.getArrayContent(
        listener.subprotocols,
        'subprotocol'
      );
      if (subprotocols.length > 0) {
        websocketOptions.supported_subprotocols =
          this.mapSubprotocols(subprotocols);
      }

      result[listenerName] = {
        enable: true,
        bind: `${bindAddress}:${port}`,
        websocket: websocketOptions,
      };
    }

    return result;
  }

  private convertTlsTcpListeners(
    listeners: any[]
  ): Record<string, SslListenerConfig> {
    const result: Record<string, SslListenerConfig> = {};

    for (const listener of listeners) {
      const port = this.getTextContent(listener, 'port') || '8883';
      const bindAddress =
        this.getTextContent(listener, 'bind-address') || '0.0.0.0';
      const listenerName = port === '8883' ? 'default' : `ssl-${port}`;

      const config: SslListenerConfig = {
        enable: true,
        bind: `${bindAddress}:${port}`,
      };

      if (listener.tls) {
        config.ssl_options = this.convertTlsConfig(listener.tls);
      }

      result[listenerName] = config;
    }

    return result;
  }

  private mapSubprotocols(subprotocols: string[]): string {
    const mappedSubprotocols = subprotocols.map((proto) => {
      switch (proto) {
        case 'mqttv3.1':
          return 'mqtt-v3.1.1';
        case 'mqtt':
          return 'mqtt';
        case 'mqttv3.1.1':
          return 'mqtt-v3.1.1';
        case 'mqttv5':
          return 'mqtt-v5';
        default:
          return proto; // Keep as-is if no mapping found
      }
    });
    return mappedSubprotocols.join(', ');
  }

  private convertTlsWebSocketListeners(
    listeners: any[]
  ): Record<string, WssListenerConfig> {
    const result: Record<string, WssListenerConfig> = {};

    for (const listener of listeners) {
      const port = this.getTextContent(listener, 'port') || '8084';
      const bindAddress =
        this.getTextContent(listener, 'bind-address') || '0.0.0.0';
      const listenerName = port === '8084' ? 'default' : `wss-${port}`;

      const websocketOptions: WebSocketOptions = {
        fail_if_no_subprotocol: true,
      };

      const path = this.getTextContent(listener, 'path');
      if (path) {
        websocketOptions.mqtt_path = path;
      }

      const subprotocols = this.getArrayContent(
        listener.subprotocols,
        'subprotocol'
      );
      if (subprotocols.length > 0) {
        websocketOptions.supported_subprotocols =
          this.mapSubprotocols(subprotocols);
      }

      const config: WssListenerConfig = {
        enable: true,
        bind: `${bindAddress}:${port}`,
        websocket: websocketOptions,
      };

      if (listener.tls) {
        config.ssl_options = this.convertTlsConfig(listener.tls);
      }

      result[listenerName] = config;
    }

    return result;
  }

  private convertTlsConfig(tls: any): SslOptions {
    const sslOptions: SslOptions = {};

    const authMode = this.getTextContent(tls, 'client-authentication-mode');
    switch (authMode) {
      case 'NONE':
        sslOptions.verify = 'verify_none';
        break;
      case 'OPTIONAL':
        sslOptions.verify = 'verify_peer';
        sslOptions.fail_if_no_peer_cert = false;
        break;
      case 'REQUIRED':
        sslOptions.verify = 'verify_peer';
        sslOptions.fail_if_no_peer_cert = true;
        break;
    }

    // Note: Certificate conversion from JKS to PEM is not supported in Workers
    // Users will need to convert certificates manually
    if (tls.keystore) {
      sslOptions.keyfile = '/path/to/key.pem';
      sslOptions.certfile = '/path/to/cert.pem';
    }

    if (tls.truststore) {
      sslOptions.cacertfile = '/path/to/cacert.pem';
    }

    return sslOptions;
  }
}
