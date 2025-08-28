import subprocess
import shutil
import sys


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
