import argparse
import xml.etree.ElementTree as ET
import sys
from pyhocon import ConfigFactory, HOCONConverter

from converter import HiveMQToEMQXConverter


def parse_xml(file_path):
    try:
        tree = ET.parse(file_path)
        return tree.getroot()
    except ET.ParseError as e:
        print(f"Error parsing XML file: {e}", file=sys.stderr)
        return None


def main():
    parser = argparse.ArgumentParser(
        description="Convert HiveMQ XML config to EMQX HOCON format."
    )
    parser.add_argument("input_file", help="Path to the HiveMQ XML configuration file.")
    args = parser.parse_args()

    root = parse_xml(args.input_file)
    if root is None:
        return

    converter = HiveMQToEMQXConverter()
    emqx_config_dict = converter.convert(root)

    if emqx_config_dict:
        hocon_config = HOCONConverter.to_hocon(
            ConfigFactory.from_dict(emqx_config_dict)
        )
        print(hocon_config)


if __name__ == "__main__":
    main()
