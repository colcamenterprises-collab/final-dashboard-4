# Deployment Notes

## Critical Fix Applied
The dayjs timezone plugin imports have been updated with `.js` extensions for ES module compatibility:

```typescript
// ✅ Correct (works in production)
import timezone from 'dayjs/plugin/timezone.js'
import utc from 'dayjs/plugin/utc.js'

// ❌ Incorrect (causes deployment crashes)
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
```

## Environment Setup
Ensure these environment variables are configured:
- `LOYVERSE_API_TOKEN`
- `OPENAI_API_KEY` 
- `DATABASE_URL`

## Bangkok Timezone Configuration
All shift calculations use Asia/Bangkok timezone with 5 PM to 3 AM shift windows.
