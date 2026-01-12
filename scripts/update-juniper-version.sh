#!/bin/bash
# Updates @udibo/juniper version in example, template, and tutorial deno.json files
# Called by semantic-release during the prepare step

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  exit 1
fi

FILES=(
  "example/deno.json"
  "templates/minimal/deno.json"
  "templates/tailwindcss/deno.json"
  "templates/tanstack/deno.json"
  "tutorials/blog/deno.json"
)

for FILE in "${FILES[@]}"; do
  if [ -f "$FILE" ]; then
    sed -i "s|\"@udibo/juniper\": \"jsr:@udibo/juniper@^[0-9]*\.[0-9]*\.[0-9]*\"|\"@udibo/juniper\": \"jsr:@udibo/juniper@^$VERSION\"|g" "$FILE"
    echo "Updated $FILE to version ^$VERSION"
  else
    echo "Warning: $FILE not found"
  fi
done
