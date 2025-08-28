from utils.dict import deep_merge
from mappers.listeners import (
    TCPListenerMapper,
    WebSocketListenerMapper,
    TLSTCPListenerMapper,
    TLSWebSocketListenerMapper,
)
from mappers.mqtt import MqttMapper
from mappers.restrictions import RestrictionsMapper


class HiveMQToEMQXConverter:
    def __init__(self):
        self.mappers = {
            "tcp-listener": TCPListenerMapper(),
            "websocket-listener": WebSocketListenerMapper(),
            "tls-tcp-listener": TLSTCPListenerMapper(),
            "tls-websocket-listener": TLSWebSocketListenerMapper(),
            "mqtt": MqttMapper(),
            "restrictions": RestrictionsMapper(),
        }

    def convert(self, root):
        config = {}

        listeners = root.find("listeners")
        if listeners is not None:
            for listener_element in listeners:
                mapper = self.mappers.get(listener_element.tag)
                if mapper:
                    listener_config = mapper.map(listener_element)
                    deep_merge(listener_config, config)

        mqtt = root.find("mqtt")
        if mqtt is not None:
            mapper = self.mappers.get("mqtt")
            if mapper:
                mqtt_config = mapper.map(mqtt)
                deep_merge(mqtt_config, config)

        restrictions = root.find("restrictions")
        if restrictions is not None:
            mapper = self.mappers.get("restrictions")
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
