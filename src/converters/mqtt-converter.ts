import { BaseConverter } from './base-converter.js';
import { HiveMQConfig, EMQXConfig, MqttEMQXConfig } from '../types.js';

export class MqttConverter extends BaseConverter {
  convert(config: HiveMQConfig): EMQXConfig {
    if (!config.hivemq?.mqtt) {
      return {};
    }

    const mqttConfig = config.hivemq.mqtt;
    const emqxMqtt: MqttEMQXConfig = {};

    // Queued Messages
    if (mqttConfig['queued-messages']) {
      const queuedMessages = mqttConfig['queued-messages'];
      const maxQueueSize = this.getTextContent(
        queuedMessages,
        'max-queue-size'
      );
      if (maxQueueSize) {
        emqxMqtt.max_mqueue_len = parseInt(maxQueueSize, 10);
      }

      const strategy = this.getTextContent(queuedMessages, 'strategy');
      if (!strategy || strategy === 'discard') {
        this.warn(
          'HiveMQ discards new arrivals when the message queue is full; EMQX discards the oldest queued message. Review queue overflow behavior.'
        );
      }
      if (strategy && !['discard', 'discard-oldest'].includes(strategy)) {
        this.warn(`Unsupported queue strategy: ${strategy}`);
      }
    }

    // Topic Alias
    if (mqttConfig['topic-alias']) {
      const topicAlias = mqttConfig['topic-alias'];
      const enabled = this.getTextContent(topicAlias, 'enabled');
      if (enabled === 'false') {
        emqxMqtt.max_topic_alias = 0;
      } else {
        const maxPerClient = this.getTextContent(topicAlias, 'max-per-client');
        if (maxPerClient) {
          emqxMqtt.max_topic_alias = parseInt(maxPerClient, 10);
        }
      }
    }

    // Message Expiry
    if (mqttConfig['message-expiry']) {
      const messageExpiry = mqttConfig['message-expiry'];
      const maxInterval = this.getTextContent(messageExpiry, 'max-interval');
      if (maxInterval) {
        this.warn(
          'Limiting message expiry interval for MQTTv5 publishers is not supported.'
        );
        emqxMqtt.message_expiry_interval = `${maxInterval}s`;
      }
    }

    // Session Expiry
    if (mqttConfig['session-expiry']) {
      const sessionExpiry = mqttConfig['session-expiry'];
      const maxInterval = this.getTextContent(sessionExpiry, 'max-interval');
      if (maxInterval) {
        emqxMqtt.session_expiry_interval = `${maxInterval}s`;
      }
    }

    // Keep Alive
    if (mqttConfig['keep-alive']) {
      const keepAlive = mqttConfig['keep-alive'];
      const allowUnlimited = this.getTextContent(keepAlive, 'allow-unlimited');
      const maxKeepAlive = this.getTextContent(keepAlive, 'max-keep-alive');
      if (
        allowUnlimited === 'false' ||
        (maxKeepAlive && maxKeepAlive !== '65535')
      ) {
        this.warn('Limiting MQTT client keep-alive interval is not supported.');
      }
    }

    // Packets
    if (mqttConfig.packets) {
      const maxPacketSize = this.getTextContent(
        mqttConfig.packets,
        'max-packet-size'
      );
      if (maxPacketSize) {
        const size = parseInt(maxPacketSize, 10);
        // VLI calculation from original Python code
        const vliSize = size > 0 ? Math.ceil(Math.log2(size) / 7) : 0;
        const adjustedSize = size - vliSize - 1;
        emqxMqtt.max_packet_size = Math.max(1, adjustedSize);
      }
    }

    // Receive Maximum
    if (mqttConfig['receive-maximum']) {
      this.warn('Limiting Server Receive Maximum is not supported.');
    }

    // Quality of Service
    if (mqttConfig['quality-of-service']) {
      const qos = mqttConfig['quality-of-service'];
      const maxQos = this.getTextContent(qos, 'max-qos');
      if (maxQos) {
        emqxMqtt.max_qos_allowed = parseInt(maxQos, 10);
      }
    }

    // Wildcard Subscriptions
    if (mqttConfig['wildcard-subscriptions']) {
      const wildcardSubs = mqttConfig['wildcard-subscriptions'];
      const enabled = this.getTextContent(wildcardSubs, 'enabled');
      if (enabled) {
        emqxMqtt.wildcard_subscription = enabled === 'true';
      }
    }

    // Shared Subscriptions
    if (mqttConfig['shared-subscriptions']) {
      const sharedSubs = mqttConfig['shared-subscriptions'];
      const enabled = this.getTextContent(sharedSubs, 'enabled');
      if (enabled) {
        emqxMqtt.shared_subscription = enabled === 'true';
      }
    }

    // Subscription Identifier
    if (mqttConfig['subscription-identifier']) {
      const subId = mqttConfig['subscription-identifier'];
      const enabled = this.getTextContent(subId, 'enabled');
      if (enabled === 'false') {
        this.warn(
          'Restricting MQTTv5 Subscription Identifiers is not supported.'
        );
      }
    }

    // Retained Messages
    if (mqttConfig['retained-messages']) {
      const retainedMsgs = mqttConfig['retained-messages'];
      const enabled = this.getTextContent(retainedMsgs, 'enabled');
      if (enabled) {
        emqxMqtt.retain_available = enabled === 'true';
      }
    }

    return Object.keys(emqxMqtt).length > 0 ? { mqtt: emqxMqtt } : {};
  }
}
