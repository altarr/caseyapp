# S3 Cache Optimization

## Goal
Optimize S3 operations for the presenter server with in-memory LRU caching, batch requests, parallel downloads, and response time logging to make the UI feel snappy.

## Success Criteria
1. `infra/s3-cache.js` exists with LRU cache (configurable TTL, default 60s)
2. Session list uses `ListObjectsV2` with prefix instead of individual `GetObject` calls
3. Session detail fetches metadata, clicks, transcript, analysis in parallel via `Promise.all`
4. Response time logging on all cached routes
5. Cache is integrated into presenter server routes
6. All existing routes continue to work
