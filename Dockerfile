# Closet — production image for Railway (or any container host).
# Multi-stage: install → build → slim runtime with Next.js standalone output.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* vars are inlined at build time. The production image always runs
# with live Twilio SMS, so bake the flag in here (Railway's runtime var only
# reaches server code, not the client bundle).
ENV NEXT_PUBLIC_SMS_LIVE=1
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Docker sets HOSTNAME to the container id; Next standalone would bind only to
# that and Railway can't reach it. Force binding on all interfaces.
ENV HOSTNAME=0.0.0.0
# Mutable state (JSON db + uploaded photos) lives here.
# On Railway: attach a Volume and set its mount path to /data.
# Runs as root — Railway mounts the volume root-owned, and containers are
# already isolated, so a non-root user only causes EACCES on the volume.
ENV DATA_DIR=/data
RUN mkdir -p /data

COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
