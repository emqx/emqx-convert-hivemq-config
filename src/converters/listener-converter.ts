import { BaseConverter } from './base-converter.js';
import { isIP } from 'node:net';
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
    result.listeners = {
      tcp: { default: { enable: false } },
      ssl: { default: { enable: false } },
      ws: { default: { enable: false } },
      wss: { default: { enable: false } },
      quic: { default: { enable: false } },
    };

    // Convert TCP listeners
    if (listeners['tcp-listener']) {
      const tcpListeners = Array.isArray(listeners['tcp-listener'])
        ? listeners['tcp-listener']
        : [listeners['tcp-listener']];
      Object.assign(
        result.listeners.tcp!,
        this.convertTcpListeners(tcpListeners)
      );
    }

    // Convert WebSocket listeners
    if (listeners['websocket-listener']) {
      const wsListeners = Array.isArray(listeners['websocket-listener'])
        ? listeners['websocket-listener']
        : [listeners['websocket-listener']];
      Object.assign(
        result.listeners.ws!,
        this.convertWebSocketListeners(wsListeners)
      );
    }

    // Convert TLS TCP listeners
    if (listeners['tls-tcp-listener']) {
      const tlsTcpListeners = Array.isArray(listeners['tls-tcp-listener'])
        ? listeners['tls-tcp-listener']
        : [listeners['tls-tcp-listener']];
      Object.assign(
        result.listeners.ssl!,
        this.convertTlsTcpListeners(tlsTcpListeners)
      );
    }

    // Convert TLS WebSocket listeners
    if (listeners['tls-websocket-listener']) {
      const tlsWsListeners = Array.isArray(listeners['tls-websocket-listener'])
        ? listeners['tls-websocket-listener']
        : [listeners['tls-websocket-listener']];
      Object.assign(
        result.listeners.wss!,
        this.convertTlsWebSocketListeners(tlsWsListeners)
      );
    }

    return result;
  }

  private bind(address: string, port: string): string {
    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
      throw new Error('Listener ports must be integers from 1 to 65535.');
    }
    const host =
      address === 'localhost' ? '127.0.0.1' : address.replace(/^\[|\]$/g, '');
    if (!isIP(host))
      throw new Error(
        'Listener bind addresses must be literal IP addresses or localhost.'
      );
    return `${isIP(host) === 6 ? `[${host}]` : host}:${port}`;
  }

  private name(listeners: Record<string, unknown>, preferred: string): string {
    let name = preferred;
    for (let suffix = 2; Object.hasOwn(listeners, name); suffix++) {
      name = `${preferred}-${suffix}`;
    }
    return name;
  }

  private convertTcpListeners(
    listeners: any[]
  ): Record<string, TcpListenerConfig> {
    const result: Record<string, TcpListenerConfig> = {};

    for (const listener of listeners) {
      const port = this.getTextContent(listener, 'port') || '1883';
      const bindAddress =
        this.getTextContent(listener, 'bind-address') || '0.0.0.0';
      const listenerName = this.name(
        result,
        port === '1883' ? 'default' : `tcp-${port}`
      );

      result[listenerName] = {
        enable: true,
        bind: this.bind(bindAddress, port),
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
      const listenerName = this.name(
        result,
        port === '8000' ? 'default' : `ws-${port}`
      );

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
        bind: this.bind(bindAddress, port),
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
      const listenerName = this.name(
        result,
        port === '8883' ? 'default' : `ssl-${port}`
      );

      const config: SslListenerConfig = {
        enable: false,
        bind: this.bind(bindAddress, port),
      };

      if (listener.tls) {
        config.ssl_options = this.convertTlsConfig(listener.tls);
      }

      result[listenerName] = config;
      this.warn(
        `TLS listener ssl:${listenerName} is disabled. Convert Java keystores to PEM, replace the certificate paths and review TLS options before enabling it.`
      );
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
      const listenerName = this.name(
        result,
        port === '8084' ? 'default' : `wss-${port}`
      );

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
        enable: false,
        bind: this.bind(bindAddress, port),
        websocket: websocketOptions,
      };

      if (listener.tls) {
        config.ssl_options = this.convertTlsConfig(listener.tls);
      }

      result[listenerName] = config;
      this.warn(
        `TLS listener wss:${listenerName} is disabled. Convert Java keystores to PEM, replace the certificate paths and review TLS options before enabling it.`
      );
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

    // File contents are never read. Certificate conversion is a manual step.
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
