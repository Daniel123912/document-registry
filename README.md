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
  seed/                  демо-пользователи
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
npm run seed
npm run dev
```

4. Frontend:

```powershell
cd frontend
npm install
npm run dev
```

## Демо-пользователи

- Ответственный: `responsible@bakor.local` / `admin1234`
- Сотрудники (40 шт.): `employee@bakor.local`, `employee2@bakor.local` … `employee40@bakor.local` / `user1234`

## Порты

- Frontend: `http://127.0.0.1:5173`
- Backend API: `http://127.0.0.1:4011`
