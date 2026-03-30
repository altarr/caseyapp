# Spec: In grobomo/claude-portable (git clone https://github.com/grobomo/claude-portable.git), create scripts/submit-task-setup.sh -- a cross-platform (Mac + Windows Git Bash) setup script that team members can run with curl|bash. It should: 1) Download submit-task.py to ~/.local/bin/ (create dir if needed), 2) Prompt for dispatcher URL (default: http://3.131.126.72:8080) and API token, 3) Save config to ~/.boothapp-dispatcher.json, 4) Add ~/.local/bin to PATH in .bashrc/.zshrc if not already there, 5) Test connection by hitting /health endpoint, 6) Print usage instructions. Also create the submit-task.py CLI that reads the config and POSTs to /api/tasks/submit with: task description, repo (default altarr/boothapp), submitter name, priority. PR to main.

## Problem Statement
In grobomo/claude-portable (git clone https://github.com/grobomo/claude-portable.git), create scripts/submit-task-setup.sh -- a cross-platform (Mac + Windows Git Bash) setup script that team members can run with curl|bash. It should: 1) Download submit-task.py to ~/.local/bin/ (create dir if needed), 2) Prompt for dispatcher URL (default: http://3.131.126.72:8080) and API token, 3) Save config to ~/.boothapp-dispatcher.json, 4) Add ~/.local/bin to PATH in .bashrc/.zshrc if not already there, 5) Test connection by hitting /health endpoint, 6) Print usage instructions. Also create the submit-task.py CLI that reads the config and POSTs to /api/tasks/submit with: task description, repo (default altarr/boothapp), submitter name, priority. PR to main.

## Success Criteria
- [ ] Task completed as described
- [ ] Tests pass
- [ ] PR created with clear description
