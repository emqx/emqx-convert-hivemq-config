from mappers.base_mapper import BaseMapper
from utils.xml import get_text_from_element


class RestrictionsMapper(BaseMapper):
    def map(self, restrictions_element):
        restrictions_config = {}
        max_connections = get_text_from_element(restrictions_element, "max-connections")
        if max_connections and max_connections != "-1":
            restrictions_config["_post_max_connections"] = int(max_connections)

        max_client_id_length = get_text_from_element(
            restrictions_element, "max-client-id-length"
        )
        if max_client_id_length and max_client_id_length != "65535":
            if "mqtt" not in restrictions_config:
                restrictions_config["mqtt"] = {}
            restrictions_config["mqtt"]["max_clientid_len"] = int(max_client_id_length)

        incoming_bandwidth_throttling = get_text_from_element(
            restrictions_element, "incoming-bandwidth-throttling"
        )
        if incoming_bandwidth_throttling and incoming_bandwidth_throttling != "0":
            if "mqtt" not in restrictions_config:
                restrictions_config["mqtt"] = {}
            if "limiter" not in restrictions_config["mqtt"]:
                restrictions_config["mqtt"]["limiter"] = {}
            restrictions_config["mqtt"]["limiter"]["bytes_rate"] = (
                f"{incoming_bandwidth_throttling}b/s"
            )

        return restrictions_config
