#!/bin/bash

# Quick change logger for NEXT.md
# Usage: ./scripts/log-change.sh "Description of what was done"

if [ $# -eq 0 ]; then
    echo "Usage: ./scripts/log-change.sh 'Description of what was done'"
    exit 1
fi

CHANGE_DESC="$1"
DATE=$(date +"%Y-%m-%d")
TEMP_FILE=$(mktemp)

# Add the new change to the Recent Changes Log section
awk -v change="$DATE: $CHANGE_DESC" '
/^## Recent Changes Log/ {
    print $0
    print "- " change
    next
}
{ print }
' NEXT.md > "$TEMP_FILE"

mv "$TEMP_FILE" NEXT.md
echo "✅ Logged change: $CHANGE_DESC"
