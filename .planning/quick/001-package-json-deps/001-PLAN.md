# Package.json Dependencies & Scripts Update

## Goal
Update the existing package.json to match the requested spec: correct description, add missing scripts (start:presenter, export), add npm dependencies, run npm install.

## Success Criteria
- [ ] description = "AI-Powered Trade Show Demo Capture"
- [ ] scripts include: start:watcher, start:presenter, test, analyze, export
- [ ] dependencies include: @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, express, cors, helmet
- [ ] engines.node >= 18
- [ ] npm install succeeds and node_modules + package-lock.json created
