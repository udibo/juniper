#!/bin/bash
# Makes the repository consistent with a newly released version: bumps the
# @udibo/juniper range in every example, template and tutorial deno.json, then
# re-resolves deno.lock so it agrees with them.
#
# Called by semantic-release during the prepare step. The lockfile is already in
# the release commit's assets, but nothing regenerated it — so every release
# shipped a lock still naming the previous version, and the next PR failed CI's
# frozen install before its own change could be reviewed. That happened for
# 0.9.2 (#104) and again for 0.9.3 (#108).

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version>"
  exit 1
fi

FILES=(
  "example/deno.json"
  "templates/minimal/deno.json"
  "templates/postgres/deno.json"
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

# ./src is a workspace member, so @udibo/juniper resolves locally rather than
# from JSR — this works here in `prepare`, before the publish step has pushed
# the new version. Deno keeps every already-locked specifier as it is, so the
# only churn is the ranges the loop above just changed.
#
# That local resolution is why src/deno.json must already carry $VERSION:
# semantic-release-jsr's prepare sets it, and it is listed before this script in
# .releaserc.json for that reason. Run by hand out of that order, `deno install`
# would go looking for an unpublished version on JSR and fail obscurely, so say
# what is actually wrong.
SRC_VERSION=$(grep -m1 '"version"' src/deno.json | sed 's/.*"version": *"\([^"]*\)".*/\1/')
if [ "$SRC_VERSION" != "$VERSION" ]; then
  echo "Error: src/deno.json is $SRC_VERSION, not $VERSION." >&2
  echo "The lockfile resolves @udibo/juniper from the workspace, so src must be" >&2
  echo "bumped first. semantic-release-jsr does that; set it yourself if you are" >&2
  echo "running this script directly." >&2
  exit 1
fi

echo "Re-resolving deno.lock"
deno install --quiet
