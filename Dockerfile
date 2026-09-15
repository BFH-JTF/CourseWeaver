FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY server ./server
COPY tsconfig.server.json ./
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["npx", "tsx", "server/index.ts"]