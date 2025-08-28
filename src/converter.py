from utils.dict import deep_merge
from mappers.listeners import (
    TCPListenerMapper,
    WebSocketListenerMapper,
    TLSTCPListenerMapper,
    TLSWebSocketListenerMapper,
)
from mappers.mqtt import MqttMapper
from mappers.restrictions import RestrictionsMapper
from mappers.cluster import ClusterMapper
from mappers.kafka_extension import KafkaExtensionMapper


class HiveMQToEMQXConverter:
    def __init__(self):
        self.mappers = {
            # Core mappers
            "hivemq": self._convert_core_config,
            # Extension mappers
            "kafka-configuration": KafkaExtensionMapper(),
        }
        self.core_mappers = {
            "tcp-listener": TCPListenerMapper(),
            "websocket-listener": WebSocketListenerMapper(),
            "tls-tcp-listener": TLSTCPListenerMapper(),
            "tls-websocket-listener": TLSWebSocketListenerMapper(),
            "mqtt": MqttMapper(),
            "restrictions": RestrictionsMapper(),
            "cluster": ClusterMapper(),
        }

    def convert(self, root):
        mapper = self.mappers.get(root.tag)
        if hasattr(mapper, "map"):
            return mapper.map(root)
        elif callable(mapper):
            return mapper(root)
        else:
            # Default to core config conversion for backward compatibility
            return self._convert_core_config(root)

    def _convert_core_config(self, root):
        config = {}

        listeners = root.find("listeners")
        if listeners is not None:
            for listener_element in listeners:
                mapper = self.core_mappers.get(listener_element.tag)
                if mapper:
                    listener_config = mapper.map(listener_element)
                    deep_merge(listener_config, config)

        mqtt = root.find("mqtt")
        if mqtt is not None:
            mapper = self.core_mappers.get("mqtt")
            if mapper:
                mqtt_config = mapper.map(mqtt)
                deep_merge(mqtt_config, config)

        cluster = root.find("cluster")
        if cluster is not None:
            mapper = self.core_mappers.get("cluster")
            if mapper:
                cluster_config = mapper.map(cluster)
                deep_merge(cluster_config, config)

        restrictions = root.find("restrictions")
        if restrictions is not None:
            mapper = self.core_mappers.get("restrictions")
            if mapper:
                restrictions_config = mapper.map(restrictions)
                max_conns = restrictions_config.pop("_post_max_connections", None)
                deep_merge(restrictions_config, config)
                if max_conns and "listeners" in config:
                    for listener_type in config["listeners"]:
                        for listener_name in config["listeners"][listener_type]:
                            config["listeners"][listener_type][listener_name][
                                "max_connections"
                            ] = max_conns

        return config
