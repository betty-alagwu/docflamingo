#!/bin/bash

if ! command -v license-checker &> /dev/null; then
    echo "Installing license-checker..."
    npm install -g license-checker
else
    echo "license-checker is already installed."
fi

chmod +x .github/scripts/setup-license-checker.sh
