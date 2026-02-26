# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
CMD ["node", "dist/index.js"]

FROM node:20-alpine AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]
