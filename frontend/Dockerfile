# Образ фронтенда Vibe Chicken: сборка Vite + nginx.
# BASE_PATH — префикс публикации: «/chicken/» за системным nginx на VPS
# (deploy/nginx-system.conf.example), «/» в корне домена (Timeweb App Platform).
# Влияет и на сборку Vite (base), и на nginx-локации (sed в конфиге ниже).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG BASE_PATH=/chicken/
ENV BASE_PATH=$BASE_PATH
RUN npm run build

FROM nginx:alpine
ARG BASE_PATH=/chicken/
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Параметризуем префикс: /chicken → BASE_PATH без завершающего слэша.
# При BASE_PATH=/ строка "location = /chicken {...}" становится "location =  {...}"
# (недопустимо) — редирект корня не нужен, вырезаем её.
RUN sed -i "s|/chicken|${BASE_PATH%/}|g" /etc/nginx/conf.d/default.conf \
    && if [ "${BASE_PATH%/}" = "" ]; then \
         sed -i '/location =  {/,/}/d' /etc/nginx/conf.d/default.conf; \
       fi
EXPOSE 80
