#!/bin/sh
set -e

# Create storage directories after volume mount, ensure appuser can write
mkdir -p /app/storage/sessions /app/storage/temp
chown -R appuser:appuser /app/storage

# Switch to appuser and run the command
exec gosu appuser "$@"
