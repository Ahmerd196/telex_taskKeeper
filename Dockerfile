FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm i
COPY tsconfig.json ./
COPY src ./src
RUN npm install --silent
RUN npm run build

FROM node:18-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json /app/
COPY --from=builder /app/dist ./dist
RUN npm ci --only=production --silent || true
EXPOSE 4000
CMD ["node", "dist/index.js"]
