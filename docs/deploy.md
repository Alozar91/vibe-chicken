# Публикация на VPS (Docker + системный nginx)

Стек публикации: два контейнера (бэкенд FastAPI + фронтенд nginx), данные в
Docker-volume. SSL терминирует **системный** nginx сервера — он не входит в
проект и лишь проксирует префикс `/chicken` на контейнер фронтенда.

```
браузер ──https──> системный nginx (:443, SSL)
                      │  location /chicken → proxy_pass http://127.0.0.1:8080
                      ▼
             контейнер frontend (nginx, порт 80 → хост :8080)
                ├── /chicken/…          → статика (сборка Vite)
                └── /chicken/api/…      → прокси на контейнер backend (:8000)
                                             └── SQLite + бэкапы в volume /app/data
```

Наружу выставлен только порт фронтенда (`CHICKEN_PORT`, по умолчанию 8080).
Бэкенд доступен только внутри compose-сети.

## 1. Установка Docker

```bash
curl -fsSL https://get.docker.com | sh
```

## 2. Получение кода и настройка

```bash
cd /opt
git clone https://github.com/Alozar91/vibe-chicken.git
cd vibe-chicken
cp deploy/.env.example .env
nano .env   # задать CHICKEN_ADMIN_PASSWORD (обязательно) и при желании CHICKEN_PORT
```

Переменные `.env` (образец — `deploy/.env.example`):

| Переменная                  | Назначение                                            | По умолчанию |
|-----------------------------|-------------------------------------------------------|--------------|
| `CHICKEN_PORT`              | порт на хосте для системного nginx                    | `8080`       |
| `CHICKEN_ADMIN_PASSWORD`    | пароль администратора при **первом** запуске          | — (обязателен) |
| `CHICKEN_ADMIN_USERNAME`    | логин администратора                                  | `admin`      |
| `CHICKEN_SESSION_HTTPS_ONLY`| кука сессии только по https                           | `true`       |
| `CHICKEN_SECRET_KEY`        | ключ подписи сессий (иначе генерируется в volume)     | —            |
| `CHICKEN_DATA_DIR`          | абсолютный путь каталога данных (иначе named volume)  | —            |

## 3. Запуск

```bash
docker compose up -d --build
```

При старте бэкенд сам накатывает миграции Alembic; администратор создаётся,
если в БД ещё нет пользователей.

## 4. Системный nginx

Скопировать сниппет и подключить в нужный `server`-блок с SSL:

```bash
sudo cp deploy/nginx-system.conf.example /etc/nginx/snippets/vibe-chicken.conf
```

```nginx
server {
    listen 443 ssl;
    server_name example.com;
    # ... ssl_certificate и прочее ...

    include snippets/vibe-chicken.conf;
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Приложение доступно по адресу `https://example.com/chicken/`.

## 5. Обновление

```bash
cd /opt/vibe-chicken
git pull
docker compose up -d --build
```

## 6. Перенос существующих данных (с машины разработки)

Если ферма уже ведётся, базу можно забрать с собой — данные на сервере
записываются в volume при первом запуске:

```bash
cd /opt/vibe-chicken
docker compose up -d --build   # создаёт volume и накатывает миграции
docker compose down            # останавливаем, чтобы БД не была открыта

docker run --rm \
  -v vibe-chicken_chicken-data:/data \
  -v "$PWD/backend/data":/src:ro \
  alpine cp /src/app.db /data/app.db

docker compose up -d
```

(имя volume уточнить: `docker volume ls | grep chicken`)
Бэкапы и ночной шедулер дальше работают уже на сервере.

## 7. Данные и бэкапы

По умолчанию всё состояние живёт в Docker-volume `chicken-data` (полное имя —
`vibe-chicken_chicken-data`; внутри контейнера — `/app/data`): `app.db`,
ночные бэкапы `app-YYYY-MM-DD-HHMM.db`, `secret.key`.

**Вариант «данные в каталоге хоста»**: задайте в `.env` абсолютный путь —

```
CHICKEN_DATA_DIR=/srv/chicken
```

и после `docker compose up -d` данные будут лежать в обычном каталоге
(те же `app.db`, `backups/`, `secret.key`), доступном rsync/restic/любым
бэкап-агентам без docker-команд. Путь должен быть абсолютным.

Забрать бэкап на хост (при volume; при bind mount файлы уже на хосте):

```bash
docker compose cp backend:/app/data/backups/. ./backups/
```

Восстановление из бэкапа (контейнеры должны быть остановлены):

```bash
docker compose down
# bind mount:
cp app-2026-11-24-0300.db /srv/chicken/app.db
# или volume:
docker run --rm -v vibe-chicken_chicken-data:/data -v "$PWD":/src alpine \
    sh -c "cp /src/app-2026-11-24-0300.db /data/app.db"
docker compose up -d
```

(имя volume уточнить: `docker volume ls | grep chicken`)

## 8. Переход с volume на каталог (bind mount) без потери данных

Если стек уже работает на volume и нужно переключить на `CHICKEN_DATA_DIR`:

```bash
cd /opt/vibe-chicken

# 1) остановить стек (БД не должна писаться во время копирования)
docker compose down

# 2) перенести содержимое volume в каталог хоста
sudo mkdir -p /srv/chicken
sudo docker run --rm \
  -v vibe-chicken_chicken-data:/data:ro \
  -v /srv/chicken:/out \
  alpine sh -c "cp -a /data/. /out/"

# 3) проверить, что на месте app.db, backups/, secret.key
sudo ls -lh /srv/chicken /srv/chicken/backups

# 4) добавить в .env строку CHICKEN_DATA_DIR=/srv/chicken
#    (docker-compose.yml править не нужно)

# 5) запустить и проверить
docker compose up -d
curl -s http://localhost:8080/chicken/api/health
docker compose exec backend ls /app/data/backups
```

Старый volume не удалять (`docker volume rm`), пока новая схема не проверена —
это страховка. Каталогу не нужны особые права: контейнер работает от root,
как и внутри volume.

## Замечания по путям `/chicken`

Префикс учёт на всех уровнях:

- **сборка Vite** — `BASE_PATH=/chicken/` (аргумент Dockerfile): ассеты в
  `index.html` получаются `/chicken/assets/…`;
- **React Router** — `basename={import.meta.env.BASE_URL}`, все `to=` в коде
  остаются без изменений;
- **API-клиент** — пути строятся от `import.meta.env.BASE_URL`, в dev это `/`
  (прокси Vite), в проде `/chicken/`;
- **nginx контейнера** — отдаёт статику через `alias` и снимает префикс
  `/chicken` перед проксированием на FastAPI (бэкенд продолжает видеть `/api/…`);
- в самом бэкенде префикс не фигурирует — роуты неизменны (`/api/…`).

Локальная разработка не затронута: без `BASE_PATH` база остаётся `/`.
