#!/usr/bin/env bash
set -euo pipefail
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT

# EMQX checks PEM files even for disabled TLS listeners. These certificates
# exist only for the maintained fixtures; user input is never rewritten.
openssl req -x509 -newkey rsa:2048 -nodes -keyout "$scratch/key.pem" \
  -out "$scratch/cert.pem" -days 1 -subj /CN=localhost >/dev/null 2>&1
cp "$scratch/cert.pem" "$scratch/cacert.pem"
chmod 755 "$scratch"
chmod 644 "$scratch/"*

count=0
failures=0
# Use only maintained examples. Local extension downloads are not test inputs.
while IFS= read -r config; do
  options=()
  case "$config" in
    *cluster*) options+=(--restart) ;;
    *kafka*) options+=(--check-only) ;; # A Kafka cluster is a separate prerequisite.
  esac
  printf '\nTesting %s\n' "$config"
  if ! bash "$repo/scripts/test-emqx.sh" ${options[@]+"${options[@]}"} --mount "$scratch:/path/to" "$repo/$config"; then
    failures=$((failures + 1))
  fi
  count=$((count + 1))
done < "$repo/test/emqx-inputs.txt"
if [ "$failures" -gt 0 ]; then
  printf '\n%s of %s EMQX configuration cases failed.\n' "$failures" "$count" >&2
  exit 1
fi
printf '\nAll %s EMQX configuration cases passed.\n' "$count"
