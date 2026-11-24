# Публикация в Timeweb Cloud App Platform

App Platform умеет деплоить из Docker Compose, но с ограничениями
(https://timeweb.cloud/docs/apps/deploying-with-docker-compose):
директива `volumes` запрещена → постоянного тома нет, содержимое контейнера
пропадает при каждом повторном деплое. Поэтому для App Platform используется
отдельный манифест и S3-синхронизация базы.

## Что готово в репозитории

- `docker-compose.app-platform.yml` — манифест без запрещённых директив,
  хост-порт 8080 (80/443 заняты платформой), `BASE_PATH=/` (корень техдомена).
- `backend/app/services/s3_backup.py` — S3-клиент (AWS SigV4 на httpx, без
  новых зависимостей): restore последнего бэкапа при старте (если локальной
  БД нет) + выгрузка каждого нового бэкапа в бакет.
- `backend/app/services/backup.py` — `run_backup` после создания локальной
  копии заливает её в S3 (если заданы `CHICKEN_S3_*`).
- `backend/app/main.py` — lifespan перед миграциями разворачивает БД из S3.

## Шаг 1. Object Storage (S3) в Timeweb Cloud

1. Панель → «Object Storage» → создать бакет (например `chicken-backups`).
2. Создать ключи доступа (Access key / Secret key).
3. Endpoint вида `https://s3.timeweb.cloud`.

## Шаг 2. Создание приложения

1. App Platform → «Создать» → подключить GitHub-репозиторий `Alozar91/vibe-chicken`
   (или по URL — тогда без автодеплоя), ветка `master`.
2. Фреймворк: **Docker Compose**. Путь до директории проекта: пусто
   (`docker-compose.app-platform.yml` лежит в корне; если платформа требует
   имя строго `docker-compose.yml` — см. «Если нужен стандартный манифест»).
3. Регион и конфигурация: минимальный тариф (1 CPU / 1 ГБ ОЗУ — с запасом).
4. Переменные (блок «Расширенные настройки»):
   - `CHICKEN_ADMIN_PASSWORD` — пароль администратора при первом запуске (обязателен);
   - `CHICKEN_SESSION_HTTPS_ONLY=true`;
   - `CHICKEN_S3_ENDPOINT_URL`, `CHICKEN_S3_BUCKET`, `CHICKEN_S3_ACCESS_KEY_ID`,
     `CHICKEN_S3_SECRET_ACCESS_KEY` — из шага 1.
5. Путь проверки состояния: `/api/health` (compose-healthcheck платформа
   для compose-деплоев не использует — путь в панели обязателен).
   Важно: `depends_on: condition: service_healthy` в манифесте недопустим —
   compose-healthcheck платформа игнорирует, и ожидание healthy висит до
   таймаута деплоя («Container ... Waiting»). Поэтому во фронтенда
   depends_on убран: nginx отдаёт 502 первые секунды, пока бэкенд стартует.
6. Запустить деплой. Технический домен с SSL выдаётся автоматически.

## Если нужен стандартный манифест

Если панель ищет только `docker-compose.yml` в корне, положите рядом копию:

```bash
cp docker-compose.app-platform.yml docker-compose.yml
```

и закоммитьте (на VPS при этом продолжайте использовать
`docker compose -f docker-compose.app-platform.yml`, либо переименуйте
VPS-вариант в `docker-compose.vps.yml`).

## Обновления

При включённом автодеплое — просто `git push` в `master`. Иначе — кнопка
«Деплой» в панели. При каждом деплое: контейнер стартует с пустым /app/data →
restore последнего бэкапа из S3 → миграции → приложение. Потеря данных между
ночными бэкапами: до суток (как и на VPS).

## Ограничения

- Данные переживают деплой только через S3: изменения за последние часы до
  деплоя сохраняются, только если был бэкап (ночной 03:00 или ручной в UI).
  Перед обновлением можно нажать «Создать бэкап» в настройках приложения.
- Порты 80/443 в compose-манифесте запрещены (используется 8080).
- Свой SSL-сертификат загрузить нельзя — используется Let's Encrypt платформы.

## Про healthcheck (частый вопрос поддержки)

В манифесте для App Platform healthcheck-блок backend **не нужен и не
используется** — платформа игнорирует compose-healthchecks для Compose-деплоев.
Живость проверяет «Путь проверки состояния» из панели (`/api/health`).

На VPS-манифесте (`docker-compose.yml`) healthcheck есть, и команда там —
`python -c "import urllib.request; ..."`: в образе `python:3.12-slim` нет
`curl` и `wget`, поэтому классический `curl -f http://localhost/health`
упал бы с «command not found» и контейнер вечно оставался unhealthy.
