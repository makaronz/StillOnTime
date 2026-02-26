# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS prod
WORKDIR /usr/share/nginx/html
COPY --from=build /app/dist .
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

FROM node:20-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
