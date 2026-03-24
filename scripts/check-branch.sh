#!/usr/bin/env bash
# check-branch.sh — Pre-commit hook: reject direct commits to main
#
# Installation:
#   cp scripts/check-branch.sh .git/hooks/pre-commit
#   chmod +x .git/hooks/pre-commit
#
# All agents must work on feature branches. Only Code Reviewers may merge to main.
# See CLAUDE.md § "NO COMMITS WITHOUT CODE REVIEW".

CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null)

if [ "$CURRENT_BRANCH" = "main" ]; then
  echo ""
  echo "  ✗ ERROR: Direct commits to 'main' are not allowed."
  echo ""
  echo "  All work must go through a feature branch and code review."
  echo "  Create a branch for your work:"
  echo ""
  echo "    git checkout -b <agent-name>/<issue-id>"
  echo ""
  echo "  Example:"
  echo "    git checkout -b backend-architect/dcp-884-metrics-api"
  echo ""
  echo "  When done, set your issue to in_review and wait for CR1/CR2 to merge."
  echo ""
  exit 1
fi

exit 0
