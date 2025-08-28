import os
import re
import logging
from utils.shell import run_command, check_command_exists
from utils.xml import get_text_from_element


def map_tls_settings(tls_element, listener_slug):
    ssl_options = {}
    output_dir = os.path.join("etc", "emqx", "ssl", listener_slug)
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
            logging.warning(
                "`keytool` or `openssl` not found. Cannot convert JKS files."
            )
            path = get_text_from_element(keystore, "path")
            logging.warning(
                f"Keystore conversion from {path} is not implemented yet. Please convert JKS to PEM format manually."
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
                        logging.warning(
                            f"Multiple aliases found in keystore, using '{alias}'."
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

                logging.info(
                    f"Extracted private key and certificate from {keystore_path} into {output_dir}."
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
                logging.error(f"Could not determine alias for keystore {keystore_path}")

    # Truststore
    truststore = tls_element.find("truststore")
    if truststore is not None:
        if not check_command_exists("keytool"):
            logging.warning("`keytool` not found. Cannot convert JKS truststore.")
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

                logging.info(
                    f"Extracted CA certificates from {truststore_path} into {output_dir}."
                )
                ssl_options["cacertfile"] = os.path.join(
                    base_dir, listener_slug, "cacert.pem"
                )

    return ssl_options
