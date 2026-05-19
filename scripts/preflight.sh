#!/usr/bin/env bash
# Pre-flight checks for kw-research PRs. Run before committing.
set -e
cd "$(git rev-parse --show-toplevel)"

fail=0
check() {
  local label="$1"; shift
  if eval "$@" > /tmp/preflight.out 2>&1; then
    echo "  ✓ $label"
  else
    echo "  ✗ $label"
    sed 's/^/    /' /tmp/preflight.out
    fail=1
  fi
}

echo "== Lint =="
check "eslint" "npm run lint --silent"

echo "== Typecheck =="
check "tsc strict" "npm run typecheck --silent"

echo "== Tests =="
check "vitest" "npm test --silent"

echo "== Grep checks =="

zero_or_fail() {
  local label="$1"; shift
  local count
  count=$(eval "$@" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$count" = "0" ]; then
    echo "  ✓ $label"
  else
    echo "  ✗ $label ($count hits)"
    eval "$@" 2>/dev/null | head -10 | sed 's/^/    /'
    fail=1
  fi
}

zero_or_fail "no raw hex in src/components"   "grep -rEn '#[0-9a-fA-F]{3,8}' src/components | grep -vE '(test|spec|stories|snap|eslint-disable)'"
zero_or_fail "no rgba() in src/components"    "grep -rEn 'rgba?\(' src/components | grep -vE '(test|spec)'"
zero_or_fail "no arbitrary shadows"           "grep -rEn 'shadow-\[' src/components"
zero_or_fail "no console.log in src/server"   "grep -rEn 'console\.(log|debug|info)' src/server"
zero_or_fail "no @ts-ignore without reason"   "grep -rEn '@ts-ignore' src --include='*.ts' --include='*.tsx' | grep -v '// ts-ignore-reason:'"

if grep -qrE 'kw-research-theme' src; then
  echo "  ✓ theme storage key present"
else
  echo "  ✗ theme storage key 'kw-research-theme' missing"
  fail=1
fi

echo
if [ $fail -eq 0 ]; then
  echo "All checks passed."
else
  echo "Some checks failed."
  exit 1
fi
