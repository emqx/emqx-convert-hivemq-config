import argparse
import xml.etree.ElementTree as ET
import sys
import re
from pyhocon import ConfigFactory, HOCONConverter

from converter import HiveMQToEMQXConverter


def parse_xml(file_path):
    try:
        tree = ET.parse(file_path)
        return tree.getroot()
    except ET.ParseError as e:
        print(f"Error parsing XML file: {e}", file=sys.stderr)
        return None


def post_process_hocon(hocon_string):
    """Workaround for pyhocon list formatting by ensuring lists are comma-separated."""
    # This regex finds a `seeds = [ ... ]` block.
    # It captures the part before the content, the content itself, and the closing bracket.
    seeds_pattern = re.compile(r"(seeds\s*=\s*\[)(.*?)(\])", re.DOTALL)

    def replacer(match):
        opening = match.group(1)  # 'seeds = ['
        content = match.group(2)  # The content inside the brackets
        closing = match.group(3)  # ']'

        # Split the content into lines, strip whitespace, and filter out empty lines.
        lines = [line.strip() for line in content.split("\n") if line.strip()]

        # Join the lines with a comma and a newline for correct HOCON array formatting.
        # Indent each line for readability.
        corrected_content = ",\n        ".join(lines)

        # Add indentation to the first line and newlines around the content.
        return f"{opening}\n        {corrected_content}\n    {closing}"

    return seeds_pattern.sub(replacer, hocon_string)


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

        # If cluster config is present, apply the formatting fix.
        if "cluster" in emqx_config_dict:
            hocon_config = post_process_hocon(hocon_config)

        print(hocon_config)


if __name__ == "__main__":
    main()
