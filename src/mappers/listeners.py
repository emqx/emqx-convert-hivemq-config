import logging
from mappers.base_mapper import BaseMapper
from utils.xml import get_text_from_element
from utils.certs import map_tls_settings


class TCPListenerMapper(BaseMapper):
    def map(self, listener_element):
        port = get_text_from_element(listener_element, "port") or "1883"
        bind_address = (
            get_text_from_element(listener_element, "bind-address") or "0.0.0.0"
        )

        listener_name = "default" if port == "1883" else f"tcp-{port}"

        return {
            "listeners": {
                "tcp": {
                    listener_name: {"enable": True, "bind": f"{bind_address}:{port}"}
                }
            }
        }


class TLSTCPListenerMapper(BaseMapper):
    def map(self, listener_element):
        port = get_text_from_element(listener_element, "port") or "8883"
        bind_address = (
            get_text_from_element(listener_element, "bind-address") or "0.0.0.0"
        )

        listener_name = "default" if port == "8883" else f"ssl-listener-{port}"
        slug = f"ssl-listener-{port}"

        config = {"enable": True, "bind": f"{bind_address}:{port}"}

        tls_element = listener_element.find("tls")
        if tls_element is not None:
            config["ssl_options"] = map_tls_settings(tls_element, slug)

        return {"listeners": {"ssl": {listener_name: config}}}


class WebSocketListenerMapper(BaseMapper):
    def map(self, listener_element):
        port = get_text_from_element(listener_element, "port") or "8083"
        bind_address = (
            get_text_from_element(listener_element, "bind-address") or "0.0.0.0"
        )

        listener_name = "default" if port == "8083" else f"ws-listener-{port}"

        ws_config = {"fail_if_no_subprotocol": True}

        path = get_text_from_element(listener_element, "path")
        if path:
            ws_config["mqtt_path"] = path

        subprotocols_element = listener_element.find("subprotocols")
        if subprotocols_element is not None:
            subprotocols = [
                sp.text.strip()
                for sp in subprotocols_element.findall("subprotocol")
                if sp.text
            ]
            if subprotocols:
                ws_config["supported_subprotocols"] = subprotocols

        allow_extensions = get_text_from_element(listener_element, "allow-extensions")
        if allow_extensions and allow_extensions == "true":
            logging.warning("Configuring WebSocket extensions is not supported.")

        return {
            "listeners": {
                "ws": {
                    listener_name: {
                        "enable": True,
                        "bind": f"{bind_address}:{port}",
                        "websocket": ws_config,
                    }
                }
            }
        }


class TLSWebSocketListenerMapper(BaseMapper):
    def map(self, listener_element):
        port = get_text_from_element(listener_element, "port") or "8084"
        bind_address = (
            get_text_from_element(listener_element, "bind-address") or "0.0.0.0"
        )

        listener_name = "default" if port == "8084" else f"wss-listener-{port}"
        slug = f"wss-listener-{port}"

        ws_config = {"fail_if_no_subprotocol": True}
        path = get_text_from_element(listener_element, "path")
        if path:
            ws_config["mqtt_path"] = path

        subprotocols_element = listener_element.find("subprotocols")
        if subprotocols_element is not None:
            subprotocols = [
                sp.text.strip()
                for sp in subprotocols_element.findall("subprotocol")
                if sp.text
            ]
            if subprotocols:
                ws_config["supported_subprotocols"] = subprotocols

        allow_extensions = get_text_from_element(listener_element, "allow-extensions")
        if allow_extensions and allow_extensions == "true":
            logging.warning("Configuring WebSocket extensions is not supported.")

        config = {
            "enable": True,
            "bind": f"{bind_address}:{port}",
            "websocket": ws_config,
        }

        tls_element = listener_element.find("tls")
        if tls_element is not None:
            config["ssl_options"] = map_tls_settings(tls_element, slug)

        return {"listeners": {"wss": {listener_name: config}}}
