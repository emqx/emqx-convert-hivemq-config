export interface HiveMQConfig {
  hivemq: {
    listeners?: {
      'tcp-listener'?: TcpListener[];
      'websocket-listener'?: WebSocketListener[];
      'tls-tcp-listener'?: TlsTcpListener[];
      'tls-websocket-listener'?: TlsWebSocketListener[];
    };
    mqtt?: MqttConfig;
    cluster?: ClusterConfig;
    restrictions?: RestrictionsConfig;
    'control-center'?: ControlCenterConfig;
    'kafka-configuration'?: KafkaConfiguration;
  };
}

export interface TcpListener {
  port?: string;
  'bind-address'?: string;
}

export interface WebSocketListener {
  port?: string;
  'bind-address'?: string;
  path?: string;
  name?: string;
  subprotocols?: {
    subprotocol?: string[];
  };
  'allow-extensions'?: string;
}

export interface TlsTcpListener {
  port?: string;
  'bind-address'?: string;
  tls?: TlsConfig;
}

export interface TlsWebSocketListener {
  port?: string;
  'bind-address'?: string;
  path?: string;
  tls?: TlsConfig;
}

export interface TlsConfig {
  'client-authentication-mode'?: 'NONE' | 'OPTIONAL' | 'REQUIRED';
  keystore?: KeystoreConfig;
  truststore?: TruststoreConfig;
}

export interface KeystoreConfig {
  path?: string;
  password?: string;
  'private-key-password'?: string;
}

export interface TruststoreConfig {
  path?: string;
  password?: string;
}

export interface MqttConfig {
  'queued-messages'?: {
    'max-queue-size'?: string;
    strategy?: string;
  };
  'topic-alias'?: {
    enabled?: string;
    'max-per-client'?: string;
  };
  'message-expiry'?: {
    'max-interval'?: string;
  };
  'session-expiry'?: {
    'max-interval'?: string;
  };
  'keep-alive'?: {
    'allow-unlimited'?: string;
    'max-keep-alive'?: string;
  };
  packets?: {
    'max-packet-size'?: string;
  };
  'receive-maximum'?: any;
  'quality-of-service'?: {
    'max-qos'?: string;
  };
  'wildcard-subscriptions'?: {
    enabled?: string;
  };
  'shared-subscriptions'?: {
    enabled?: string;
  };
  'subscription-identifier'?: {
    enabled?: string;
  };
  'retained-messages'?: {
    enabled?: string;
  };
}

export interface ClusterConfig {
  enabled?: string;
  discovery?: {
    static?: {
      node?: Array<{
        host?: string;
      }>;
    };
  };
  transport?: {
    tcp?: any;
  };
}

export interface RestrictionsConfig {
  'max-connections'?: string;
  'max-client-id-length'?: string;
  'incoming-bandwidth-throttling'?: string;
}

export interface ControlCenterConfig {
  listeners?: {
    http?: {
      port?: string;
      'bind-address'?: string;
    };
  };
}

export interface EMQXConfig {
  listeners?: {
    tcp?: Record<string, TcpListenerConfig>;
    ssl?: Record<string, SslListenerConfig>;
    ws?: Record<string, WsListenerConfig>;
    wss?: Record<string, WssListenerConfig>;
  };
  mqtt?: MqttEMQXConfig;
  cluster?: ClusterEMQXConfig;
  dashboard?: {
    listeners: {
      http: {
        bind: string;
      };
    };
  };
  bridges?: {
    kafka?: KafkaBridgeEMQXConfig;
  };
}

export interface TcpListenerConfig {
  enable: boolean;
  bind: string;
  max_connections?: number;
}

export interface SslListenerConfig {
  enable: boolean;
  bind: string;
  ssl_options?: SslOptions;
  max_connections?: number;
}

export interface WsListenerConfig {
  enable: boolean;
  bind: string;
  websocket: WebSocketOptions;
  max_connections?: number;
}

export interface WssListenerConfig {
  enable: boolean;
  bind: string;
  websocket: WebSocketOptions;
  ssl_options?: SslOptions;
  max_connections?: number;
}

export interface WebSocketOptions {
  fail_if_no_subprotocol: boolean;
  mqtt_path?: string;
  supported_subprotocols?: string;
}

export interface SslOptions {
  verify?: 'verify_none' | 'verify_peer';
  fail_if_no_peer_cert?: boolean;
  keyfile?: string;
  certfile?: string;
  cacertfile?: string;
  password?: string;
}

export interface MqttEMQXConfig {
  max_mqueue_len?: number;
  max_topic_alias?: number;
  message_expiry_interval?: string;
  session_expiry_interval?: string;
  max_packet_size?: number;
  max_qos_allowed?: number;
  wildcard_subscription?: boolean;
  shared_subscription?: boolean;
  retain_available?: boolean;
  max_clientid_len?: number;
  limiter?: {
    bytes_rate?: string;
  };
}

export interface ClusterEMQXConfig {
  discovery_strategy: string;
  static: {
    seeds: string[];
  };
}

// Kafka Extension Types
export interface KafkaConfiguration {
  'kafka-clusters'?: {
    'kafka-cluster'?: KafkaCluster[];
  };
  'mqtt-to-kafka-mappings'?: {
    'mqtt-to-kafka-mapping'?: MqttToKafkaMapping[];
  };
  'kafka-to-mqtt-mappings'?: {
    'kafka-to-mqtt-mapping'?: KafkaToMqttMapping[];
  };
}

export interface KafkaCluster {
  id?: string;
  'bootstrap-servers'?: string;
  tls?: KafkaTlsConfig;
  authentication?: KafkaAuthConfig;
}

export interface KafkaTlsConfig {
  enabled?: boolean;
  keystore?: KeystoreConfig;
  truststore?: TruststoreConfig;
}

export interface KafkaAuthConfig {
  plain?: {
    username?: string;
    password?: string;
  };
  'scram-sha256'?: {
    username?: string;
    password?: string;
  };
  'scram-sha512'?: {
    username?: string;
    password?: string;
  };
}

export interface MqttToKafkaMapping {
  id?: string;
  'cluster-id'?: string;
  'mqtt-topic-filters'?: {
    'mqtt-topic-filter'?: string[];
  };
  'kafka-topic'?: string;
  'kafka-acks'?: 'ZERO' | 'ONE' | 'ALL';
}

export interface KafkaToMqttMapping {
  id?: string;
  'cluster-id'?: string;
  'kafka-topics'?: {
    'kafka-topic'?: string[];
  };
  'mqtt-topics'?: {
    'mqtt-topic'?: string[];
  };
}

// EMQX Kafka Bridge Types
export interface KafkaBridgeEMQXConfig {
  connectors?: {
    kafka_producer?: Record<string, KafkaConnectorConfig>;
    kafka_consumer?: Record<string, KafkaConnectorConfig>;
  };
  actions?: {
    kafka_producer?: Record<string, KafkaActionConfig>;
  };
  sources?: {
    kafka_consumer?: Record<string, KafkaSourceConfig>;
  };
  rule_engine?: {
    rules?: Record<string, KafkaRuleConfig>;
  };
}

export interface KafkaConnectorConfig {
  bootstrap_hosts: string;
  ssl?: {
    enable?: boolean;
    keyfile?: string;
    certfile?: string;
    cacertfile?: string;
  };
  authentication?: {
    mechanism?: 'plain' | 'scram_sha_256' | 'scram_sha_512';
    username?: string;
    password?: string;
  };
}

export interface KafkaActionConfig {
  connector: string;
  parameters: {
    topic: string;
    acks?: string;
  };
}

export interface KafkaSourceConfig {
  connector: string;
  parameters: {
    topic: string;
  };
  enable: boolean;
}

export interface KafkaRuleConfig {
  sql: string;
  actions: string[];
  enable: boolean;
}
