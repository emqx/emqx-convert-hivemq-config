import argparse
import xml.etree.ElementTree as ET
from pyhocon import ConfigFactory, HOCONConverter
import os
import subprocess
import shutil
import re
import sys
import math


def deep_merge(source, destination):
    """
    Deep merge source dict into destination dict.
    """
    for key, value in source.items():
        if isinstance(value, dict):
            node = destination.setdefault(key, {})
            deep_merge(value, node)
        else:
            destination[key] = value
    return destination


def run_command(args):
    """Runs a command and returns its output."""
    try:
        process = subprocess.run(args, check=True, capture_output=True, text=True)
        return process.stdout
    except subprocess.CalledProcessError as e:
        print(
            f"""Error running command: {" ".join(args)}
{e.stderr}""",
            file=sys.stderr,
        )
        return None
    except FileNotFoundError:
        print(f"Error: command not found: {args[0]}", file=sys.stderr)
        return None


def check_command_exists(command):
    """Checks if a command exists."""
    return shutil.which(command) is not None


def parse_xml(file_path):
    try:
        tree = ET.parse(file_path)
        return tree.getroot()
    except ET.ParseError as e:
        print(f"Error parsing XML file: {e}", file=sys.stderr)
        return None


def get_text_from_element(element, tag):
    child = element.find(tag)
    if child is not None and child.text:
        return child.text.strip()
    return None


def map_tcp_listener(listener_element):
    port = get_text_from_element(listener_element, "port") or "1883"
    bind_address = get_text_from_element(listener_element, "bind-address") or "0.0.0.0"

    listener_name = "default" if port == "1883" else f"tcp-{port}"

    return {
        "listeners": {
            "tcp": {listener_name: {"enable": True, "bind": f"{bind_address}:{port}"}}
        }
    }


def map_websocket_listener(listener_element):
    port = get_text_from_element(listener_element, "port") or "8083"  # default for ws
    bind_address = get_text_from_element(listener_element, "bind-address") or "0.0.0.0"

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
        print(
            "[Warning] Configuring WebSocket extensions is not supported.",
            file=sys.stderr,
        )

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


def map_tls_settings(tls_element, listener_slug):
    ssl_options = {}
    output_dir = os.path.join("import", "ssl", listener_slug)
    os.makedirs(output_dir, exist_ok=True)
    base_dir = "/etc/emqx/ssl"

    # Client Auth Mode
    auth_mode = get_text_from_element(tls_element, "client-authentication-mode")
    if auth_mode == "NONE":
        ssl_options["verify"] = "verify_none"
    elif auth_mode == "OPTIONAL":
        ssl_options["verify"] = "verify_peer"
        ssl_options["fail_if_no_peer_cert"] = False
    elif auth_mode == "REQUIRED":
        ssl_options["verify"] = "verify_peer"
        ssl_options["fail_if_no_peer_cert"] = True

    # Keystore
    keystore = tls_element.find("keystore")
    if keystore is not None:
        if not check_command_exists("keytool") or not check_command_exists("openssl"):
            print(
                "[Warning] `keytool` or `openssl` not found. Cannot convert JKS files.",
                file=sys.stderr,
            )
            path = get_text_from_element(keystore, "path")
            print(
                f"[Warning] Keystore conversion from {path} is not implemented yet. Please convert JKS to PEM format manually.",
                file=sys.stderr,
            )
            ssl_options["keyfile"] = f"{base_dir}/{listener_slug}/key.pem"
            ssl_options["certfile"] = f"{base_dir}/{listener_slug}/cert.pem"
        else:
            keystore_path = get_text_from_element(keystore, "path")
            keystore_pass = get_text_from_element(keystore, "password") or ""
            pkey_pass = (
                get_text_from_element(keystore, "private-key-password") or keystore_pass
            )

            list_cmd = [
                "keytool",
                "-list",
                "-rfc",
                "-keystore",
                keystore_path,
                "-storepass",
                keystore_pass,
            ]
            keytool_list_output = run_command(list_cmd)
            alias = None
            if keytool_list_output:
                aliases = re.findall(r"Alias name: (.*)", keytool_list_output)
                if aliases:
                    alias = aliases[0]
                    if len(aliases) > 1:
                        print(
                            f"[Warning] Multiple aliases found in keystore, using '{alias}'.",
                            file=sys.stderr,
                        )

            if alias:
                pkcs12_path = os.path.join(output_dir, "keystore.p12")
                import_cmd = [
                    "keytool",
                    "-importkeystore",
                    "-noprompt",
                    "-srckeystore",
                    keystore_path,
                    "-destkeystore",
                    pkcs12_path,
                    "-srcstorepass",
                    keystore_pass,
                    "-deststorepass",
                    keystore_pass,
                    "-srcalias",
                    alias,
                    "-deststoretype",
                    "PKCS12",
                ]
                if pkey_pass:
                    import_cmd.extend(["-srckeypass", pkey_pass])
                run_command(import_cmd)

                key_pem_path = os.path.join(output_dir, "key.pem")
                openssl_key_cmd = [
                    "openssl",
                    "pkcs12",
                    "-in",
                    pkcs12_path,
                    "-nocerts",
                    "-out",
                    key_pem_path,
                    "-passin",
                    f"pass:{keystore_pass}",
                    "-passout",
                    f"pass:{pkey_pass}",
                ]
                run_command(openssl_key_cmd)

                cert_pem_path = os.path.join(output_dir, "cert.pem")
                openssl_cert_cmd = [
                    "openssl",
                    "pkcs12",
                    "-in",
                    pkcs12_path,
                    "-nokeys",
                    "-clcerts",
                    "-out",
                    cert_pem_path,
                    "-passin",
                    f"pass:{keystore_pass}",
                ]
                run_command(openssl_cert_cmd)

                print(
                    f"Extracted private key and certificate from {keystore_path} into {output_dir}.",
                    file=sys.stderr,
                )
                ssl_options["keyfile"] = os.path.join(
                    base_dir, listener_slug, "key.pem"
                )
                ssl_options["certfile"] = os.path.join(
                    base_dir, listener_slug, "cert.pem"
                )
                if pkey_pass:
                    ssl_options["password"] = pkey_pass
            else:
                print(
                    f"[Error] Could not determine alias for keystore {keystore_path}",
                    file=sys.stderr,
                )

    # Truststore
    truststore = tls_element.find("truststore")
    if truststore is not None:
        if not check_command_exists("keytool"):
            print(
                "[Warning] `keytool` not found. Cannot convert JKS truststore.",
                file=sys.stderr,
            )
        else:
            truststore_path = get_text_from_element(truststore, "path")
            truststore_pass = get_text_from_element(truststore, "password") or ""

            list_cmd = [
                "keytool",
                "-list",
                "-rfc",
                "-keystore",
                truststore_path,
                "-storepass",
                truststore_pass,
            ]
            cacert_pem_content = run_command(list_cmd)

            if cacert_pem_content:
                cacert_pem_path = os.path.join(output_dir, "cacert.pem")
                with open(cacert_pem_path, "w") as f:
                    f.write(cacert_pem_content)

                print(
                    f"Extracted CA certificates from {truststore_path} into {output_dir}.",
                    file=sys.stderr,
                )
                ssl_options["cacertfile"] = os.path.join(
                    base_dir, listener_slug, "cacert.pem"
                )

    return ssl_options


def map_tls_tcp_listener(listener_element):
    port = get_text_from_element(listener_element, "port") or "8883"
    bind_address = get_text_from_element(listener_element, "bind-address") or "0.0.0.0"

    listener_name = "default" if port == "8883" else f"ssl-listener-{port}"
    slug = f"ssl-listener-{port}"

    config = {"enable": True, "bind": f"{bind_address}:{port}"}

    tls_element = listener_element.find("tls")
    if tls_element is not None:
        config["ssl_options"] = map_tls_settings(tls_element, slug)

    return {"listeners": {"ssl": {listener_name: config}}}


def map_tls_websocket_listener(listener_element):
    port = get_text_from_element(listener_element, "port") or "8084"
    bind_address = get_text_from_element(listener_element, "bind-address") or "0.0.0.0"

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
        print(
            "[Warning] Configuring WebSocket extensions is not supported.",
            file=sys.stderr,
        )

    config = {"enable": True, "bind": f"{bind_address}:{port}", "websocket": ws_config}

    tls_element = listener_element.find("tls")
    if tls_element is not None:
        config["ssl_options"] = map_tls_settings(tls_element, slug)

    return {"listeners": {"wss": {listener_name: config}}}


def map_mqtt_settings(mqtt_element):
    mqtt_config = {}

    # Queued Messages
    queued_messages = mqtt_element.find("queued-messages")
    if queued_messages is not None:
        max_queue_size = get_text_from_element(queued_messages, "max-queue-size")
        if max_queue_size:
            mqtt_config["max_mqueue_len"] = int(max_queue_size)
        strategy = get_text_from_element(queued_messages, "strategy")
        if strategy and strategy not in ["discard", "discard-oldest"]:
            print(f"[Warning] Unsupported queue strategy: {strategy}", file=sys.stderr)

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
        if allow_unlimited == "false" or (max_keep_alive and max_keep_alive != "65535"):
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


def map_restrictions(restrictions_element):
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


def convert_hivemq_to_emqx(root):
    config = {}

    listeners = root.find("listeners")
    if listeners is not None:
        for listener in listeners:
            listener_config = None
            if listener.tag == "tcp-listener":
                listener_config = map_tcp_listener(listener)
            elif listener.tag == "websocket-listener":
                listener_config = map_websocket_listener(listener)
            elif listener.tag == "tls-tcp-listener":
                listener_config = map_tls_tcp_listener(listener)
            elif listener.tag == "tls-websocket-listener":
                listener_config = map_tls_websocket_listener(listener)

            if listener_config:
                deep_merge(listener_config, config)

    mqtt = root.find("mqtt")
    if mqtt is not None:
        mqtt_config = map_mqtt_settings(mqtt)
        deep_merge(mqtt_config, config)

    restrictions = root.find("restrictions")
    if restrictions is not None:
        restrictions_config = map_restrictions(restrictions)
        max_conns = restrictions_config.pop("_post_max_connections", None)
        deep_merge(restrictions_config, config)
        if max_conns and "listeners" in config:
            for listener_type in config["listeners"]:
                for listener_name in config["listeners"][listener_type]:
                    config["listeners"][listener_type][listener_name][
                        "max_connections"
                    ] = max_conns

    return config


def main():
    parser = argparse.ArgumentParser(
        description="Convert HiveMQ XML config to EMQX HOCON format."
    )
    parser.add_argument("input_file", help="Path to the HiveMQ XML configuration file.")
    args = parser.parse_args()

    root = parse_xml(args.input_file)
    if root is None:
        return

    emqx_config_dict = convert_hivemq_to_emqx(root)

    if emqx_config_dict:
        hocon_config = HOCONConverter.to_hocon(
            ConfigFactory.from_dict(emqx_config_dict)
        )
        print(hocon_config)


if __name__ == "__main__":
    main()
