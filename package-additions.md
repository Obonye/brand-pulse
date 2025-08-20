# Package Dependencies for AI Reports

Add these dependencies to your package.json:

## Required Dependencies

```bash
# PDF Generation
npm install puppeteer
npm install @types/puppeteer

# Template Engine
npm install handlebars
npm install @types/handlebars

# Excel/CSV Export
npm install xlsx
npm install @types/xlsx

# Optional: For advanced PDF features
npm install html-pdf-node
npm install @types/html-pdf-node
```

## Package.json additions:

```json
{
  "dependencies": {
    "puppeteer": "^21.0.0",
    "handlebars": "^4.7.8",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@types/puppeteer": "^19.0.0",
    "@types/handlebars": "^4.1.0",
    "@types/xlsx": "^0.0.36"
  }
}
```

## Docker Considerations

If using Docker, add these to your Dockerfile:

```dockerfile
# Install Chrome dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Chrome path for Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
```

## Environment Variables

Add to your .env:

```env
# PDF Generation Settings
PDF_TIMEOUT=60000
PDF_MAX_CONCURRENT=5
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Report Settings
REPORT_CACHE_TTL=3600
REPORT_MAX_SIZE_MB=50
```