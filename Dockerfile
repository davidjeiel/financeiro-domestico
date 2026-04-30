# syntax=docker/dockerfile:1

# Build stage
FROM node:20-slim AS builder

# Build-time args for VITE_* frontend variables (optional — leave blank for local/no-OAuth mode)
ARG VITE_OAUTH_PORTAL_URL=""
ARG VITE_APP_ID="financeiro-local"
ENV VITE_OAUTH_PORTAL_URL=$VITE_OAUTH_PORTAL_URL
ENV VITE_APP_ID=$VITE_APP_ID

WORKDIR /app

# Install patch utility
RUN apt-get update && apt-get install -y --no-install-recommends patch && rm -rf /var/lib/apt/lists/*

# Copy package files and patches
COPY package.json ./
COPY patches ./patches

# Install all dependencies with npm (stable in container environments)
RUN npm install --legacy-peer-deps

# Apply wouter patch manually (replaces pnpm's automatic patch application)
RUN node -e " \
  const fs = require('fs'); \
  const file = 'node_modules/wouter/src/index.js'; \
  let c = fs.readFileSync(file, 'utf8'); \
  if (!c.includes('__WOUTER_ROUTES__')) { \
    const target = 'for (const element of flattenChildren(children)) {'; \
    const inject = '// Collect all route paths to window object\n  if (typeof window !== \'undefined\') {\n    if (!window.__WOUTER_ROUTES__) window.__WOUTER_ROUTES__ = [];\n    flattenChildren(children).forEach(function(e) {\n      if (e && e.props && e.props.path && !window.__WOUTER_ROUTES__.includes(e.props.path)) window.__WOUTER_ROUTES__.push(e.props.path);\n    });\n  }\n\n  '; \
    if (!c.includes(target)) { console.error('Wouter patch target not found'); process.exit(1); } \
    fs.writeFileSync(file, c.replace(target, inject + target)); \
    console.log('Wouter patch applied'); \
  } else { console.log('Wouter already patched, skipping'); } \
"

# Copy source code
COPY . .

# Build the application (Vite + esbuild)
RUN npm run build

# Prune devDependencies for smaller runtime image
RUN npm prune --production --legacy-peer-deps

# Runtime stage
FROM node:20-slim

WORKDIR /app

# Copy pruned node_modules and built output from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle
COPY package.json ./

EXPOSE 3000

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]
