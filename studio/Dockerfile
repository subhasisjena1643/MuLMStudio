# µLM Studio — frontend
#
# Build (local backend on the host machine's :8002):
#   docker build -t mulm-frontend .
#
# Build (backend deployed elsewhere):
#   docker build -t mulm-frontend \
#     --build-arg VITE_BACKEND_URL=https://your-backend-host.example.com \
#     .
#
# Run:
#   docker run -p 8080:80 mulm-frontend
#
# IMPORTANT: VITE_BACKEND_URL must be a URL the *browser* can reach — Vite
# bakes it into the static JS at build time (see build-arg above), so it
# can never be "localhost meaning inside this container" — it has to be
# wherever the backend is actually publicly reachable from. See
# src/config.js.

# ── Stage 1: build the static assets ────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_BACKEND_URL=http://localhost:8002
ARG VITE_DEMO_MODE=false
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}
ENV VITE_DEMO_MODE=${VITE_DEMO_MODE}

RUN npm run build

# ── Stage 2: serve with nginx ────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
