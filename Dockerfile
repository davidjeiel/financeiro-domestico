# ---- build stage ----
FROM node:22-slim AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile

COPY . .

# O Client ID do Google é embutido no build (é público, não é segredo).
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN pnpm build

# ---- runtime stage: arquivos estáticos servidos pelo nginx ----
FROM nginx:alpine AS runner

COPY --from=builder /app/dist/public /usr/share/nginx/html
# Fallback de SPA: rotas do app caem no index.html
RUN printf 'server {\n  listen 3000;\n  root /usr/share/nginx/html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 3000
