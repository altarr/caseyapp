# Spec: In grobomo/claude-portable (git clone https://github.com/grobomo/claude-portable.git), fix two bugs in scripts/git-dispatch.py: BUG 1 - git_pull() function uses 'git pull with rebase' which permanently breaks the repo when merge conflicts occur. The dispatcher never makes local changes, so replace the pull logic with: fetch from origin, then force-sync local main to match origin/main exactly. This prevents the repo from ever getting stuck. BUG 2 - S3 heartbeat bucket name is wrong. Search for 'claude-portable-state' anywhere in the file and change it to 'hackathon26-state'. The correct bucket is hackathon26-state-752266476357. PR to main.

## Problem Statement
In grobomo/claude-portable (git clone https://github.com/grobomo/claude-portable.git), fix two bugs in scripts/git-dispatch.py: BUG 1 - git_pull() function uses 'git pull with rebase' which permanently breaks the repo when merge conflicts occur. The dispatcher never makes local changes, so replace the pull logic with: fetch from origin, then force-sync local main to match origin/main exactly. This prevents the repo from ever getting stuck. BUG 2 - S3 heartbeat bucket name is wrong. Search for 'claude-portable-state' anywhere in the file and change it to 'hackathon26-state'. The correct bucket is hackathon26-state-752266476357. PR to main.

## Success Criteria
- [ ] Task completed as described
- [ ] Tests pass
- [ ] PR created with clear description
