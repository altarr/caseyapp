# Setup Demo PC Script

## Goal
Create `scripts/setup-demo-pc.sh` that configures a fresh demo PC for BoothApp with interactive checks and guided setup.

## Success Criteria
1. Checks Chrome is installed
2. Prints instructions for installing extension in developer mode
3. Creates .env from .env.example with prompted values
4. Tests S3 connectivity using AWS CLI
5. Tests audio device detection via ffmpeg
6. Prints clear instructions for each step
7. Exits 0 if all prerequisites met
8. Branch, commit, push, PR to main
