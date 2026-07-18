Run after deployment to link the committed image assets to the live POS menu records:

```bash
node --env-file=.env scripts/apply-pos-item-images.mjs
```

The script is safe to run repeatedly.
