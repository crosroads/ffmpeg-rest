FROM jrottenberg/ffmpeg:7.1-scratch AS ffmpeg

FROM node:22.20.0-alpine AS base

# Install fontconfig and fonts for ASS subtitle rendering BEFORE copying FFmpeg libs
# ttf-liberation includes Liberation Sans (metrically compatible with Arial)
RUN apk add --no-cache \
    fontconfig \
    ttf-dejavu \
    ttf-liberation \
    && fc-cache -f

COPY --from=ffmpeg /bin/ffmpeg /bin/ffmpeg
COPY --from=ffmpeg /bin/ffprobe /bin/ffprobe
COPY --from=ffmpeg /lib /lib

WORKDIR /app

FROM base AS deps

ENV HUSKY=0

COPY package*.json ./
COPY .husky/install.mjs .husky/install.mjs
RUN npm ci --omit=dev

FROM base AS build

ENV HUSKY=0

COPY package*.json ./
COPY .husky/install.mjs .husky/install.mjs
RUN npm ci

COPY . .
RUN npm run build

FROM base AS runtime

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --chown=nodejs:nodejs package*.json ./

USER nodejs

EXPOSE 3000

CMD ["npm", "start"]
