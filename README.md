# Реестр БАКОР

Документооборот: черновики, версии, назначение сотрудников и ознакомление.

## Стек

- `frontend/` — React + Vite
- `backend/` — Node.js + Express
- База — локальный PostgreSQL (Docker не нужен)

## Где что лежит

```
backend/src/
  server.js              точка входа: middleware и роуты
  config.js              порт, JWT, папка uploads
  auth.js                пароли, JWT, проверка роли
  db/                    подключение к базе и SQL-схема
  routes/                HTTP-эндпоинты (auth, users, documents, reports)
  services/              бизнес-логика документов и отчетов
  middleware/            asyncHandler и обработка ошибок
  utils/                 файлы, имена, сериализация
  seed/                  инициализация схемы БД (без демо-пользователей)
backend/tests/           тесты схемы и имен файлов

frontend/src/
  App.jsx                состояние приложения и обработчики
  pages/                 экраны (логин)
  components/            сайдбар, список, модалки, карточка документа
  api/client.js          запросы к backend
  utils/                 даты и имена файлов
  constants.js           типы документов и сортировка
  styles/                CSS
```

## Хранение данных

В проекте **нет SQLite-файла**. Данные разделены на два места.

### 1. PostgreSQL — метаданные

Физические файлы базы **не лежат в папке проекта**. Они живут в установленном PostgreSQL.

| Что | Где |
| --- | --- |
| Хост / порт | `localhost` / `5432` |
| База | `my_project_db` |
| Пользователь / пароль | `postgres` / `123456` |
| Подключение | `DB_*` в `backend/.env` |
| Схема таблиц | `backend/src/db/schema.js` (создаётся при старте API) |

Таблицы:

- `users` — сотрудники, роли, хеш пароля
- `documents` — реквизиты, статус, автор, путь к файлу черновика
- `document_versions` — версии опубликованного файла (`file_path`)
- `document_assignments` — кому назначен документ
- `document_acknowledgements` — ознакомление с версией

### 2. `backend/uploads/` — сами документы

PDF, Word, Excel и изображения пишутся на диск, не в PostgreSQL.

| Что | Где |
| --- | --- |
| Папка | `backend/uploads/documents/<id>/` (создаётся при старте) |
| Имя файла | `draft.pdf`, `v2.docx` и т.п. |
| Оригинальное имя | колонки `draft_original_filename` / `original_filename` в БД |
| Путь в БД | относительный ключ, например `documents/42/v2.pdf` |
| Скачивание | `GET /documents/:id/file` (только после авторизации) |

Связь: база хранит **относительный путь**, файл лежит в `uploads`. Папка `uploads` не в git. При удалении документа файлы тоже удаляются. Без обоих мест реестр неполный.

### Бэкап

Копируйте данные PostgreSQL и папку `backend/uploads/`. Одна база без файлов или файлы без базы — неполный архив.

Восстановление дампа на VPS (PostgreSQL в Docker, как в `deploy/remote-setup.sh`):

```bash
# с вашего ПК (PowerShell), файл в каталог приложения на сервере
scp "backup/my_project_db_2026-10-13.sql" root@151.248.113.156:/opt/bakor-docflow/backup.sql

# на сервере
cd /opt/bakor-docflow
docker compose exec -T postgres psql -U postgres -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'my_project_db' AND pid <> pg_backend_pid();"
docker compose exec -T postgres psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS my_project_db;"
docker compose exec -T postgres psql -U postgres -d postgres -c "CREATE DATABASE my_project_db;"
docker compose exec -T postgres psql -U postgres -d my_project_db < backup.sql
pm2 restart bakor-api
```

Если `psql` ругается на `\restrict` (дамп с PostgreSQL 18, на сервере 17), обновите контейнер до `postgres:18` в `docker-compose.yml` или переснимите дамп без restrict-опций с той же major-версией, что на сервере.

## Быстрый старт

1. Убедитесь, что локальный PostgreSQL запущен и есть база `my_project_db`:

```sql
CREATE DATABASE my_project_db;
```

2. Скопируйте `.env` файлы:

- `backend/.env.example` → `backend/.env`
- `frontend/.env.example` → `frontend/.env`

3. Backend:

```powershell
cd backend
npm install
npm run dev
```

4. Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Сотрудников в репозитории не создаётся: после старта API добавьте учётки в [панели модератора](http://127.0.0.1:5173/moderator) (логин/пароль — `MODERATOR_LOGIN` / `MODERATOR_PASSWORD` в `backend/.env`).

## Порты

- Frontend: `http://127.0.0.1:5173`
- Backend API: `http://127.0.0.1:4011`

## Сервер (VPS)

Публичный сайт: [https://docs.nerohub.ru/](https://docs.nerohub.ru/) (A-запись `docs.nerohub.ru` → `151.248.113.156`). Nginx отдаёт `frontend/dist` и проксирует API на `127.0.0.1:4011` (см. `deploy/remote-setup.sh`).

Подключение домена и HTTPS на уже работающем VPS:

```bash
ssh root@151.248.113.156
cd /opt/bakor-docflow
git pull
CERTBOT_EMAIL=ваш@email.ru bash deploy/configure-domain.sh docs.nerohub.ru
```

Скрипт обновит nginx, выпустит сертификат Let's Encrypt, пропишет `APP_PUBLIC_URL=https://docs.nerohub.ru` и перезапустит API.

При сборке фронта для сервера **не задавайте** `VITE_API_URL` (или оставьте пустым): браузер обращается к тому же адресу, что и страница. Локально в `frontend/.env` укажите `VITE_API_URL=http://localhost:4011`.

Первичная установка на чистый VPS (root, Ubuntu/Debian):

```bash
curl -fsSL https://raw.githubusercontent.com/Daniel123912/document-registry/master/deploy/remote-setup.sh | bash
```

После изменений в репозитории на сервере:

```bash
bash /opt/bakor-docflow/deploy/update-app.sh
```

Только пересобрать фронт:

```bash
bash /opt/bakor-docflow/deploy/update-frontend.sh
```
