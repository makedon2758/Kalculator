Param(
    [string]$Message = ""
)

function Commit-AllIfNeeded($msg) {
    git add -A
    try {
        if ($msg -and $msg.Trim() -ne "") {
            git commit -m $msg
        } else {
            # try commit with a default message, if nothing to commit this will exit non-zero
            git commit -m "chore: save changes"
        }
    } catch {
        Write-Output "No changes to commit or commit failed: $_"
    }
}

# Ensure we're in the repo root or a git repo
if (-not (Test-Path .git)) {
    Write-Output "Warning: .git not found in current directory. Ensure you run this from repository root or from inside the repo."
}

$branch = git rev-parse --abbrev-ref HEAD 2>$null
if (-not $branch) { $branch = 'main' }

Commit-AllIfNeeded $Message

Write-Output "Pushing branch '$branch' to origin..."
git push origin $branch

Write-Output "Done."
