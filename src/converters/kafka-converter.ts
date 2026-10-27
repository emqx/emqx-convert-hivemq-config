import { BaseConverter } from './base-converter.js';
import {
  HiveMQConfig,
  EMQXConfig,
  KafkaBridgeEMQXConfig,
  KafkaConnectorConfig,
  KafkaActionConfig,
  KafkaSourceConfig,
  KafkaRuleConfig,
} from '../types.js';

export class KafkaConverter extends BaseConverter {
  convert(config: HiveMQConfig): EMQXConfig {
    if (!config.hivemq?.['kafka-configuration']) {
      return {};
    }

    const kafkaConfig = config.hivemq['kafka-configuration'];
    this.warn(
      'Kafka mappings are templates. Review topics, payloads, consumer groups, delivery semantics and credentials before applying them.'
    );
    const result: any = {};

    // Map clusters to connectors
    const connectors = this.mapClustersToConnectors(kafkaConfig);
    if (Object.keys(connectors).length > 0) {
      result.connectors = connectors;
    }

    // Map MQTT to Kafka mappings to actions and rules
    const { actions, rules } = this.mapMqttToKafka(kafkaConfig);
    if (Object.keys(actions).length > 0) {
      result.actions = actions;
    }
    if (Object.keys(rules).length > 0) {
      result.rule_engine = { rules };
    }

    // Map Kafka to MQTT mappings to sources and additional rules
    const { sources, kafkaToMqttRules } = this.mapKafkaToMqtt(kafkaConfig);
    if (Object.keys(sources).length > 0) {
      result.sources = sources;
    }
    if (Object.keys(kafkaToMqttRules).length > 0) {
      if (!result.rule_engine) {
        result.rule_engine = { rules: {} };
      }
      Object.assign(result.rule_engine.rules, kafkaToMqttRules);
    }

    return result;
  }

  private mapClustersToConnectors(
    kafkaConfig: any
  ): Record<string, Record<string, KafkaConnectorConfig>> {
    const connectors = { kafka_producer: {}, kafka_consumer: {} };

    if (!kafkaConfig['kafka-clusters']?.['kafka-cluster']) {
      return connectors;
    }

    const clusters = Array.isArray(
      kafkaConfig['kafka-clusters']['kafka-cluster']
    )
      ? kafkaConfig['kafka-clusters']['kafka-cluster']
      : [kafkaConfig['kafka-clusters']['kafka-cluster']];

    for (const cluster of clusters) {
      const clusterId = this.getTextContent(cluster, 'id');
      const bootstrapHosts = this.getTextContent(cluster, 'bootstrap-servers');

      if (!clusterId || !bootstrapHosts) {
        this.warn(
          'Skipped a Kafka cluster without an ID or bootstrap servers.'
        );
        continue;
      }
      this.validateId(clusterId);

      const connectorConfig: any = {
        bootstrap_hosts: bootstrapHosts,
        enable: true,
      };

      // Add TLS configuration if present
      if (cluster.tls) {
        const tlsEnabled = this.getTextContent(cluster.tls, 'enabled');
        if (tlsEnabled === 'true') {
          this.warn(
            'Kafka TLS requires PEM certificate files. Convert Java keystores and replace the generated paths.'
          );
          connectorConfig.ssl = {
            enable: true,
            keyfile: '/path/to/key.pem',
            certfile: '/path/to/cert.pem',
            cacertfile: '/path/to/cacert.pem',
          };
        }
      }

      // Add authentication if present
      if (cluster.authentication) {
        if (cluster.authentication.plain) {
          connectorConfig.authentication = {
            mechanism: 'plain',
            username:
              this.getTextContent(cluster.authentication.plain, 'username') ||
              '',
            password:
              this.getTextContent(cluster.authentication.plain, 'password') ||
              '',
          };
        } else if (cluster.authentication['scram-sha256']) {
          connectorConfig.authentication = {
            mechanism: 'scram_sha_256',
            username:
              this.getTextContent(
                cluster.authentication['scram-sha256'],
                'username'
              ) || '',
            password:
              this.getTextContent(
                cluster.authentication['scram-sha256'],
                'password'
              ) || '',
          };
        } else if (cluster.authentication['scram-sha512']) {
          connectorConfig.authentication = {
            mechanism: 'scram_sha_512',
            username:
              this.getTextContent(
                cluster.authentication['scram-sha512'],
                'username'
              ) || '',
            password:
              this.getTextContent(
                cluster.authentication['scram-sha512'],
                'password'
              ) || '',
          };
        }
      }

      (connectors.kafka_producer as any)[clusterId] = connectorConfig;
      (connectors.kafka_consumer as any)[clusterId] = connectorConfig;
    }

    return connectors;
  }

  private mapMqttToKafka(kafkaConfig: any): {
    actions: Record<string, Record<string, KafkaActionConfig>>;
    rules: Record<string, KafkaRuleConfig>;
  } {
    const actions = { kafka_producer: {} };
    const rules = {};

    if (!kafkaConfig['mqtt-to-kafka-mappings']?.['mqtt-to-kafka-mapping']) {
      return { actions, rules };
    }

    const mappings = Array.isArray(
      kafkaConfig['mqtt-to-kafka-mappings']['mqtt-to-kafka-mapping']
    )
      ? kafkaConfig['mqtt-to-kafka-mappings']['mqtt-to-kafka-mapping']
      : [kafkaConfig['mqtt-to-kafka-mappings']['mqtt-to-kafka-mapping']];

    for (const mapping of mappings) {
      const mappingId = this.getTextContent(mapping, 'id');
      const clusterId = this.getTextContent(mapping, 'cluster-id');
      const kafkaTopic = this.getTextContent(mapping, 'kafka-topic');
      const topicFilters = mapping['mqtt-topic-filters'];

      if (!mappingId || !clusterId || !kafkaTopic || !topicFilters) {
        this.warn('Skipped an incomplete MQTT-to-Kafka mapping.');
        continue;
      }
      this.validateId(mappingId);
      this.validateId(clusterId);

      const mqttTopicFilters = this.getArrayContent(
        topicFilters,
        'mqtt-topic-filter'
      );
      if (mqttTopicFilters.length === 0) {
        continue;
      }

      // Create action named after the mapping ID
      const actionName = mappingId;
      const acks = this.getTextContent(mapping, 'kafka-acks');
      const actionConfig: any = {
        connector: clusterId,
        enable: true,
        parameters: {
          message: {
            value: '${.}',
          },
          topic: kafkaTopic,
          ...(acks && { acks: acks.toLowerCase() }),
        },
      };
      (actions.kafka_producer as any)[actionName] = actionConfig;

      // Create rule named after the mapping
      const ruleName = `mqtt-to-kafka-mapping-${mappingId}`;
      const fromClause = mqttTopicFilters
        .map((topic) => this.sqlTopic(topic))
        .join(',');
      const ruleConfig: KafkaRuleConfig = {
        sql: `SELECT * FROM ${fromClause}`,
        actions: [`kafka_producer:${actionName}`],
        enable: true,
      };
      (rules as any)[ruleName] = ruleConfig;
    }

    return { actions, rules };
  }

  private mapKafkaToMqtt(kafkaConfig: any): {
    sources: Record<string, Record<string, KafkaSourceConfig>>;
    kafkaToMqttRules: Record<string, any>;
  } {
    const sources = { kafka_consumer: {} };
    const kafkaToMqttRules = {};

    if (!kafkaConfig['kafka-to-mqtt-mappings']?.['kafka-to-mqtt-mapping']) {
      return { sources, kafkaToMqttRules };
    }

    const mappings = Array.isArray(
      kafkaConfig['kafka-to-mqtt-mappings']['kafka-to-mqtt-mapping']
    )
      ? kafkaConfig['kafka-to-mqtt-mappings']['kafka-to-mqtt-mapping']
      : [kafkaConfig['kafka-to-mqtt-mappings']['kafka-to-mqtt-mapping']];

    for (const mapping of mappings) {
      const sourceNames: string[] = [];
      const mappingId = this.getTextContent(mapping, 'id');
      const clusterId = this.getTextContent(mapping, 'cluster-id');
      const kafkaTopics = mapping['kafka-topics'];

      if (!mappingId || !clusterId || !kafkaTopics) {
        this.warn('Skipped an incomplete Kafka-to-MQTT mapping.');
        continue;
      }
      this.validateId(mappingId);
      this.validateId(clusterId);

      const topics = this.getArrayContent(kafkaTopics, 'kafka-topic');
      for (const kafkaTopic of topics) {
        if (!kafkaTopic) continue;

        // Create source named with cluster and topic
        const sourceName = `${clusterId}-${kafkaTopic}`;
        const sourceConfig: KafkaSourceConfig = {
          connector: clusterId,
          parameters: {
            topic: kafkaTopic,
          },
          enable: true,
        };
        (sources.kafka_consumer as any)[sourceName] = sourceConfig;
        sourceNames.push(`$bridges/kafka_consumer:${sourceName}`);
      }

      // Create rule for Kafka to MQTT mapping
      if (sourceNames.length > 0) {
        const ruleName = `kafka-to-mqtt-mapping-${mappingId}`;
        const ruleConfig = {
          actions: [
            {
              args: {
                topic: 'kafka',
              },
              function: 'republish',
            },
          ],
          enable: true,
          sql: `SELECT * FROM ${sourceNames.map((name) => this.sqlTopic(name)).join(',')}`,
        };
        (kafkaToMqttRules as any)[ruleName] = ruleConfig;
      }
    }

    return { sources, kafkaToMqttRules };
  }

  private validateId(id: string): void {
    if (
      !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id) ||
      ['constructor', 'prototype'].includes(id)
    ) {
      throw new Error(
        'Kafka IDs must contain only letters, digits, underscores or hyphens and cannot be reserved property names.'
      );
    }
  }

  private sqlTopic(topic: string): string {
    // EMQX rule SQL does not provide a general-purpose parameter interface.
    if (/[\x00-\x1f'\\]/.test(topic))
      throw new Error(
        'Kafka rule topics containing quotes, backslashes or control characters require manual migration.'
      );
    return `'${topic}'`;
  }
}
