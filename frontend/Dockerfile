# Образ фронтенда Vibe Chicken: сборка Vite + nginx.
# BASE_PATH — префикс публикации за системным nginx (по умолчанию /chicken/).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG BASE_PATH=/chicken/
ENV BASE_PATH=$BASE_PATH
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
