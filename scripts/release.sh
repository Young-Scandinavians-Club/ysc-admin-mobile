#!/usr/bin/env bash
# release.sh - Cut a new release: bump the version in app.json + package.json,
# commit, tag, and push to main.
#
# Pushing the v* tag triggers the "Release build" GitHub Actions workflow
# (.github/workflows/release-build.yml), which builds internal-distribution
# iOS/Android binaries against the prod backend and publishes their install
# links to the tag's GitHub Release.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_JSON="$PROJECT_ROOT/app.json"
PACKAGE_JSON="$PROJECT_ROOT/package.json"

# Terminal colors — no-ops when not attached to a TTY (CI, piped output).
if [ -t 1 ] && command -v tput >/dev/null 2>&1; then
  BOLD=$(tput bold); RESET=$(tput sgr0)
  RED=$(tput setaf 1); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3); TEAL=$(tput setaf 6)
else
  BOLD=""; RESET=""; RED=""; GREEN=""; YELLOW=""; TEAL=""
fi

usage() {
  echo "Usage: $0 [TAG]"
  echo ""
  echo "Cuts a new release by:"
  echo "  1. Reviewing commits and diffs since the previous release tag"
  echo "  2. Updating the version in app.json and package.json"
  echo "  3. Committing and tagging (v<version>)"
  echo "  4. Pushing the commit and tag to main"
  echo ""
  echo "After push, the \"Release build\" workflow builds prod iOS/Android binaries"
  echo "and attaches their install links to the GitHub Release for the tag."
  echo ""
  echo "TAG: version tag (e.g. v1.2.0 or 1.2.0). If omitted, prompts (default: minor"
  echo "     bump from the highest v* tag, or the current app.json version if none)."
  exit 1
}

case "${1:-}" in -h | --help) usage ;; esac

# Current marketing version as recorded in app.json (expo.version).
current_version() {
  sed -n 's/.*"version": "\([^"]*\)".*/\1/p' "$APP_JSON" | head -n 1
}

# Highest existing v* tag by semver (e.g. v1.12.0 over v1.11.9). Empty if none.
highest_version_tag() {
  git -C "$PROJECT_ROOT" tag -l 'v*' 2>/dev/null | LC_ALL=C sort -V | tail -n 1
}

# Next minor from semver core x.y.z (e.g. 1.2.3 -> 1.3.0).
next_minor() {
  local base="${1#v}"
  if [[ "$base" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+) ]]; then
    echo "${BASH_REMATCH[1]}.$((BASH_REMATCH[2] + 1)).0"
  else
    echo "0.1.0"
  fi
}

# True when $1 is strictly greater than $2 (semver; uses sort -V).
semver_gt() {
  [ "$1" != "$2" ] && [ "$(printf '%s\n' "$1" "$2" | LC_ALL=C sort -Vr | head -n 1)" = "$1" ]
}

validate_version_format() {
  if [[ ! "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
    echo "${RED}Error: invalid version format. Use semver (e.g. 1.2.0 or v1.2.0)${RESET}"
    exit 1
  fi
}

normalize_tag_inputs() {
  GIT_TAG="$1"
  [[ "$GIT_TAG" =~ ^v ]] || GIT_TAG="v$1"
  APP_VERSION="${GIT_TAG#v}"
}

# Set the (single) "version" key in app.json and package.json to $1, touching
# only that line so prettier-formatted JSON stays byte-for-byte otherwise.
write_version() {
  local version="$1" file
  for file in "$APP_JSON" "$PACKAGE_JSON"; do
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$version\"/" "$file"
    else
      sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$version\"/" "$file"
    fi
  done
}

# Print commits and diffs that will ship (previous v* tag..HEAD), then confirm.
review_release_diff() {
  local prev_tag="$1" range commit_count show_diff confirm

  echo "${BOLD}═══════════════════════════════════════════════════════════════════════════${RESET}"
  echo "${BOLD}                     Review changes for $GIT_TAG${RESET}"
  echo "${BOLD}═══════════════════════════════════════════════════════════════════════════${RESET}"
  echo ""

  if [ -z "$prev_tag" ]; then
    echo "${YELLOW}No previous v* tag — cannot bound a release range. Skipping diff review.${RESET}"
    echo ""
  else
    range="${prev_tag}..HEAD"
    commit_count="$(git rev-list --count "$range")"
    echo "${TEAL}Range: ${BOLD}${range}${RESET} ${TEAL}(plus the version bump commit)${RESET}"
    echo ""

    if [ "$commit_count" -eq 0 ]; then
      echo "${YELLOW}No commits since ${prev_tag}. This release would only contain the version bump.${RESET}"
      echo ""
    else
      echo "${TEAL}Commits (${commit_count}):${RESET}"
      git log --oneline --no-decorate "$range"
      echo ""
      echo "${TEAL}Diffstat:${RESET}"
      git diff --stat "$range"
      echo ""
      read -rp "Show full diff? [y/N] " show_diff
      if [[ "$show_diff" =~ ^[Yy]$ ]]; then
        echo ""
        git --no-pager diff "$range"
        echo ""
      fi
    fi
  fi

  read -rp "Proceed with release ${GIT_TAG}? [y/N] " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "${YELLOW}Aborted. No changes made.${RESET}"
    exit 0
  fi
  echo ""
}

TAG="${1:-}"

cd "$PROJECT_ROOT"

# Refuse to run with a dirty tree.
if [ -n "$(git status --porcelain)" ]; then
  echo "${RED}Error: working directory has uncommitted changes. Commit or stash them first.${RESET}"
  git status --short
  exit 1
fi

# Must be on main.
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  echo "${RED}Error: must be on main branch (current: $BRANCH)${RESET}"
  exit 1
fi

# Sync with remote so tags/versions match origin before prompting or validating.
echo "${TEAL}Syncing with origin/main...${RESET}"
git pull --rebase origin main
git fetch -q --tags origin 2>/dev/null || true
echo "${GREEN}✓ Up to date with origin/main${RESET}"
echo ""

HIGHEST_TAG="$(highest_version_tag)"

if [ -n "$TAG" ]; then
  normalize_tag_inputs "$TAG"
  validate_version_format "$APP_VERSION"
else
  echo "${BOLD}Cut a new release${RESET}"
  echo ""
  if [ -n "$HIGHEST_TAG" ]; then
    echo "${TEAL}Highest release tag (semver): ${BOLD}${HIGHEST_TAG}${RESET}"
    DEFAULT_VERSION="$(next_minor "$HIGHEST_TAG")"
  else
    echo "${TEAL}Highest release tag (semver): ${BOLD}(none yet)${RESET}"
    DEFAULT_VERSION="$(current_version)"
    [ -n "$DEFAULT_VERSION" ] || DEFAULT_VERSION="0.1.0"
  fi
  echo ""
  echo "${TEAL}Press ${BOLD}Enter${RESET}${TEAL} for ${BOLD}v${DEFAULT_VERSION}${RESET}${TEAL}, or type another version (e.g. v1.0.0 or 1.0.0).${RESET}"
  read -rp "Version tag: " TAG
  [ -n "$TAG" ] || TAG="v${DEFAULT_VERSION}"
  normalize_tag_inputs "$TAG"
  validate_version_format "$APP_VERSION"
fi

# Re-check the highest tag after any concurrent fetches during the prompt.
HIGHEST_TAG="$(highest_version_tag)"

if git rev-parse "$GIT_TAG" >/dev/null 2>&1; then
  echo "${RED}Error: tag $GIT_TAG already exists${RESET}"
  exit 1
fi

if [ -n "$HIGHEST_TAG" ] && ! semver_gt "$APP_VERSION" "${HIGHEST_TAG#v}"; then
  echo "${RED}Error: version $APP_VERSION must be greater than latest release $HIGHEST_TAG${RESET}"
  exit 1
fi

review_release_diff "$HIGHEST_TAG"

echo "${BOLD}═══════════════════════════════════════════════════════════════════════════${RESET}"
echo "${BOLD}                           Creating release $GIT_TAG${RESET}"
echo "${BOLD}═══════════════════════════════════════════════════════════════════════════${RESET}"
echo ""

echo "${TEAL}[1/4] Updating version to $APP_VERSION in app.json and package.json...${RESET}"
write_version "$APP_VERSION"
echo "${GREEN}✓ Versions updated${RESET}"
echo ""

echo "${TEAL}[2/4] Committing version bump...${RESET}"
git add "$APP_JSON" "$PACKAGE_JSON"
git commit -m "Bump version to $APP_VERSION"
echo "${GREEN}✓ Committed${RESET}"
echo ""

echo "${TEAL}[3/4] Creating git tag $GIT_TAG...${RESET}"
git tag "$GIT_TAG"
echo "${GREEN}✓ Tag created${RESET}"
echo ""

echo "${TEAL}[4/4] Pushing to main...${RESET}"
git push origin main
git push origin "$GIT_TAG"
echo "${GREEN}✓ Pushed to origin${RESET}"
echo ""

echo "${BOLD}═══════════════════════════════════════════════════════════════════════════${RESET}"
echo "${GREEN}${BOLD}                      Release $GIT_TAG created successfully!${RESET}"
echo "${BOLD}═══════════════════════════════════════════════════════════════════════════${RESET}"
echo ""
echo "${TEAL}Next: watch the GitHub Actions \"Release build\" workflow for this tag —${RESET}"
echo "${TEAL}it attaches the iOS/Android install links to the GitHub Release when done.${RESET}"
