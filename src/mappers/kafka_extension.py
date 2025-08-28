from mappers.base_mapper import BaseMapper
from utils.xml import get_text_from_element


class KafkaExtensionMapper(BaseMapper):
    def map(self, root_element):
        config = {}

        kafka_clusters = self._map_clusters_to_connectors(root_element)
        if kafka_clusters:
            config["connectors"] = kafka_clusters

        # In EMQX, Kafka ingress (MQTT->Kafka) and egress (Kafka->MQTT) are configured differently.
        # Ingress is via rules, Egress is via sources.
        ingress_actions, ingress_rules = self._map_mqtt_to_kafka(root_element)
        if ingress_actions:
            config["actions"] = ingress_actions
        if ingress_rules:
            config["rule_engine"] = {"rules": ingress_rules}

        egress_sources = self._map_kafka_to_mqtt(root_element)
        if egress_sources:
            config["sources"] = egress_sources

        return config

    def _map_clusters_to_connectors(self, root_element):
        connectors = {"kafka_producer": {}, "kafka_consumer": {}}
        clusters_element = root_element.find("kafka-clusters")
        if clusters_element is None:
            return {}

        for cluster_element in clusters_element.findall("kafka-cluster"):
            cluster_id = get_text_from_element(cluster_element, "id")
            if not cluster_id:
                continue

            bootstrap_hosts = get_text_from_element(
                cluster_element, "bootstrap-servers"
            )
            if not bootstrap_hosts:
                continue

            connector_config = {"bootstrap_hosts": bootstrap_hosts}
            connectors["kafka_producer"][cluster_id] = connector_config
            connectors["kafka_consumer"][cluster_id] = connector_config

        return connectors

    def _map_mqtt_to_kafka(self, root_element):
        actions = {"kafka_producer": {}}
        rules = {}
        mappings_element = root_element.find("mqtt-to-kafka-mappings")
        if mappings_element is None:
            return {}, {}

        for mapping_element in mappings_element.findall("mqtt-to-kafka-mapping"):
            mapping_id = get_text_from_element(mapping_element, "id")
            cluster_id = get_text_from_element(mapping_element, "cluster-id")
            kafka_topic = get_text_from_element(mapping_element, "kafka-topic")
            filters_element = mapping_element.find("mqtt-topic-filters")

            if not all(
                [mapping_id, cluster_id, kafka_topic, filters_element is not None]
            ):
                continue

            mqtt_topic_filters = [
                f.text.strip()
                for f in filters_element.findall("mqtt-topic-filter")
                if f.text
            ]
            if not mqtt_topic_filters:
                continue

            # Name the action after the kafka topic, as per the user's hocon
            action_name = kafka_topic
            action_config = {
                "connector": cluster_id,
                "parameters": {"topic": kafka_topic},
            }
            actions["kafka_producer"][action_name] = action_config

            # Name the rule based on the mapping id or topic
            rule_name = f"mqtt_to_{kafka_topic.replace('-', '_')}"
            from_clause = ", ".join(f'"{topic}"' for topic in mqtt_topic_filters)
            rule_config = {
                "sql": f"SELECT * FROM {from_clause}",
                "actions": [f"kafka_producer:{action_name}"],
                "enable": True,
            }
            rules[rule_name] = rule_config

        return actions, rules

    def _map_kafka_to_mqtt(self, root_element):
        sources = {"kafka_consumer": {}}
        mappings_element = root_element.find("kafka-to-mqtt-mappings")
        if mappings_element is None:
            return {}

        for mapping_element in mappings_element.findall("kafka-to-mqtt-mapping"):
            cluster_id = get_text_from_element(mapping_element, "cluster-id")
            kafka_topics_element = mapping_element.find("kafka-topics")

            if not all([cluster_id, kafka_topics_element is not None]):
                continue

            # Create a separate source for each topic
            for topic_element in kafka_topics_element.findall("kafka-topic"):
                kafka_topic = topic_element.text.strip()
                if not kafka_topic:
                    continue

                # Name the source after the kafka topic
                source_name = kafka_topic
                source_config = {
                    "connector": cluster_id,
                    "parameters": {"topic": kafka_topic},
                    "enable": True,
                }
                sources["kafka_consumer"][source_name] = source_config

        return sources
