import sys
from mappers.base_mapper import BaseMapper
from utils.xml import get_text_from_element
from pyhocon.config_tree import ConfigList


class ClusterMapper(BaseMapper):
    def map(self, cluster_element):
        enabled = get_text_from_element(cluster_element, "enabled")
        if enabled != "true":
            return {}

        cluster_config = {"discovery_strategy": "static", "static": {"seeds": []}}

        discovery_element = cluster_element.find("discovery")
        if discovery_element is None:
            return {}

        static_element = discovery_element.find("static")
        if static_element is None:
            return {}

        nodes = []
        for node_element in static_element.findall("node"):
            host = get_text_from_element(node_element, "host")
            if host:
                nodes.append(f"emqx@{host}")

        if not nodes:
            return {}

        cluster_config["static"]["seeds"] = ConfigList(nodes)

        transport = cluster_element.find("transport")
        if transport is not None and transport.find("tcp") is not None:
            print(
                "[Warning] TCP transport settings for clustering are not directly convertible. EMQX uses Erlang distribution for node communication. Please review your EMQX node and networking setup.",
                file=sys.stderr,
            )

        return {"cluster": cluster_config}
