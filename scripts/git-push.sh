#!/usr/bin/env bash
MSG="$1"

function commit_all_if_needed() {
  git add -A
  if [ -n "$MSG" ]; then
    git commit -m "$MSG" || echo "No changes to commit or commit failed"
  else
    git commit -m "chore: save changes" || echo "No changes to commit or commit failed"
  fi
}

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
commit_all_if_needed
echo "Pushing branch '$BRANCH' to origin..."
git push origin "$BRANCH"
echo "Done."
