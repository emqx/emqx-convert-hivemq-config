import sys
import math
from mappers.base_mapper import BaseMapper
from utils.xml import get_text_from_element


class MqttMapper(BaseMapper):
    def map(self, mqtt_element):
        mqtt_config = {}

        # Queued Messages
        queued_messages = mqtt_element.find("queued-messages")
        if queued_messages is not None:
            max_queue_size = get_text_from_element(queued_messages, "max-queue-size")
            if max_queue_size:
                mqtt_config["max_mqueue_len"] = int(max_queue_size)
            strategy = get_text_from_element(queued_messages, "strategy")
            if strategy and strategy not in ["discard", "discard-oldest"]:
                print(
                    f"[Warning] Unsupported queue strategy: {strategy}", file=sys.stderr
                )

        # Topic Alias
        topic_alias = mqtt_element.find("topic-alias")
        if topic_alias is not None:
            enabled = get_text_from_element(topic_alias, "enabled")
            if enabled == "false":
                mqtt_config["max_topic_alias"] = 0
            else:
                max_per_client = get_text_from_element(topic_alias, "max-per-client")
                if max_per_client:
                    mqtt_config["max_topic_alias"] = int(max_per_client)

        # Message Expiry
        message_expiry = mqtt_element.find("message-expiry")
        if message_expiry is not None:
            max_interval = get_text_from_element(message_expiry, "max-interval")
            if max_interval:
                print(
                    "[Warning] Limiting message expiry interval for MQTTv5 publishers is not supported.",
                    file=sys.stderr,
                )
                mqtt_config["message_expiry_interval"] = f"{max_interval}s"

        # Session Expiry
        session_expiry = mqtt_element.find("session-expiry")
        if session_expiry is not None:
            max_interval = get_text_from_element(session_expiry, "max-interval")
            if max_interval:
                mqtt_config["session_expiry_interval"] = f"{max_interval}s"

        # Keep Alive
        keep_alive = mqtt_element.find("keep-alive")
        if keep_alive is not None:
            allow_unlimited = get_text_from_element(keep_alive, "allow-unlimited")
            max_keep_alive = get_text_from_element(keep_alive, "max-keep-alive")
            if allow_unlimited == "false" or (
                max_keep_alive and max_keep_alive != "65535"
            ):
                print(
                    "[Warning] Limiting MQTT client keep-alive interval is not supported.",
                    file=sys.stderr,
                )

        # Packets
        packets = mqtt_element.find("packets")
        if packets is not None:
            max_packet_size = get_text_from_element(packets, "max-packet-size")
            if max_packet_size:
                size = int(max_packet_size)
                # VLI calculation from Elixir script
                vli_size = math.ceil(math.log2(size) / 7) if size > 0 else 0
                size = size - vli_size - 1
                mqtt_config["max_packet_size"] = max(1, size)

        # Receive Maximum
        receive_maximum = mqtt_element.find("receive-maximum")
        if receive_maximum is not None:
            print(
                "[Warning] Limiting Server Receive Maximum is not supported.",
                file=sys.stderr,
            )

        # Quality of Service
        quality_of_service = mqtt_element.find("quality-of-service")
        if quality_of_service is not None:
            max_qos = get_text_from_element(quality_of_service, "max-qos")
            if max_qos:
                mqtt_config["max_qos_allowed"] = int(max_qos)

        # Wildcard Subscriptions
        wildcard_subscriptions = mqtt_element.find("wildcard-subscriptions")
        if wildcard_subscriptions is not None:
            enabled = get_text_from_element(wildcard_subscriptions, "enabled")
            if enabled:
                mqtt_config["wildcard_subscription"] = enabled == "true"

        # Shared Subscriptions
        shared_subscriptions = mqtt_element.find("shared-subscriptions")
        if shared_subscriptions is not None:
            enabled = get_text_from_element(shared_subscriptions, "enabled")
            if enabled:
                mqtt_config["shared_subscription"] = enabled == "true"

        # Subscription Identifier
        subscription_identifier = mqtt_element.find("subscription-identifier")
        if subscription_identifier is not None:
            enabled = get_text_from_element(subscription_identifier, "enabled")
            if enabled == "false":
                print(
                    "[Warning] Restricting MQTTv5 Subscription Identifiers is not supported.",
                    file=sys.stderr,
                )

        # Retained Messages
        retained_messages = mqtt_element.find("retained-messages")
        if retained_messages is not None:
            enabled = get_text_from_element(retained_messages, "enabled")
            if enabled:
                mqtt_config["retain_available"] = enabled == "true"

        return {"mqtt": mqtt_config} if mqtt_config else {}
