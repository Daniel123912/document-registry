# Bakor Docflow Standalone

Отдельная версия приложения без WordPress.

## Стек

- `frontend/`: React + Vite
- `backend/`: Node.js + Express
- PostgreSQL через `docker-compose.yml` (необязательно)
- Локально документы сохраняются в `backend/data/` и не пропадают после перезапуска

## Быстрый старт

1. Запустите PostgreSQL:

```powershell
docker compose up -d
```

2. Создайте `.env` файлы:

- скопируйте `backend/.env.example` в `backend/.env`
- скопируйте `frontend/.env.example` в `frontend/.env`

3. Запустите backend:

```powershell
cd backend
npm run seed
npm run dev
```

4. Запустите frontend:

```powershell
cd frontend
npm run dev
```

## Демо-пользователи

- Ответственный: `responsible@bakor.local` / `admin1234`
- Сотрудник: `employee@bakor.local` / `user1234`

## Порты по умолчанию

- Frontend: `http://127.0.0.1:5173`
- Backend API: `http://127.0.0.1:4011`
