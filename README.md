# ToDoList Pro

Многопользовательское приложение для управления задачами с проектами, ролями и гибкими правами доступа.

## Возможности

- ✅ Множество проектов
- ✅ Роли в проекте (владелец, админ, участник, наблюдатель)
- ✅ Гибкие права доступа к статусам (читать, создавать, редактировать, удалять)
- ✅ Drag & Drop задач между статусами
- ✅ Кастомные статусы/колонки
- ✅ Приоритеты и дедлайны
- ✅ Назначение исполнителей
- ✅ Фильтрация и сортировка
- ✅ JWT авторизация

## Запуск

### Backend
```bash
cd backend
npm install
npm run dev
```
Сервер запустится на http://localhost:3000

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Приложение откроется на http://localhost:5173

## Роли и права

| Роль | Описание |
|------|----------|
| **Владелец** | Создатель проекта. Полный доступ, может удалить проект |
| **Администратор** | Управление участниками и настройками, полный доступ к задачам |
| **Участник** | Настраиваемые права на статусы |
| **Наблюдатель** | Только просмотр (read-only) |

### Права на статусы

Для участников и наблюдателей можно настроить права отдельно для каждого статуса:
- **Читать** — видеть задачи в статусе
- **Создавать** — создавать задачи в статусе
- **Редактировать** — редактировать и перемещать задачи
- **Удалять** — удалять задачи

## API

### Auth
- `POST /api/auth/register` — регистрация
- `POST /api/auth/login` — вход
- `GET /api/auth/me` — текущий пользователь
- `GET /api/auth/users` — список пользователей

### Projects
- `GET /api/projects` — мои проекты
- `POST /api/projects` — создать проект
- `GET /api/projects/:id` — получить проект
- `PATCH /api/projects/:id` — обновить проект
- `DELETE /api/projects/:id` — удалить проект

### Project Members
- `GET /api/projects/:id/members` — участники проекта
- `POST /api/projects/:id/members` — добавить участника
- `PATCH /api/projects/:id/members/:memberId` — изменить роль
- `DELETE /api/projects/:id/members/:memberId` — удалить участника
- `GET /api/projects/:id/members/:memberId/permissions` — права участника
- `PUT /api/projects/:id/members/:memberId/permissions` — установить права

### Tasks
- `GET /api/tasks/project/:projectId` — задачи проекта
- `POST /api/tasks/project/:projectId` — создать задачу
- `PATCH /api/tasks/:id` — обновить задачу
- `DELETE /api/tasks/:id` — удалить задачу

### Statuses
- `GET /api/statuses/project/:projectId` — статусы проекта
- `POST /api/statuses/project/:projectId` — создать статус
- `PATCH /api/statuses/:id` — обновить статус
- `DELETE /api/statuses/:id` — удалить статус
- `PUT /api/statuses/project/:projectId/reorder` — изменить порядок

## Технологии

**Backend:** Node.js, Express, TypeScript, SQLite (sql.js), JWT, bcrypt

**Frontend:** React, TypeScript, Vite, Tailwind CSS, @dnd-kit, Axios
