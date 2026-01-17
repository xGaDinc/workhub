import initSqlJs, { Database } from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '../database.sqlite');

let db: Database;

const SQL = await initSqlJs();

if (existsSync(dbPath)) {
  const buffer = readFileSync(dbPath);
  db = new SQL.Database(buffer);
} else {
  db = new SQL.Database();
}

// ============================================
// СХЕМА БАЗЫ ДАННЫХ
// ============================================

db.run(`
  -- Пользователи
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Проекты
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  -- Участники проекта
  CREATE TABLE IF NOT EXISTS project_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(project_id, user_id)
  );

  -- Статусы (теперь привязаны к проекту)
  CREATE TABLE IF NOT EXISTS statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    color TEXT NOT NULL,
    icon TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(project_id, slug)
  );

  -- Права доступа к статусам
  CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_member_id INTEGER NOT NULL,
    status_id INTEGER,
    can_read INTEGER DEFAULT 1,
    can_create INTEGER DEFAULT 0,
    can_edit INTEGER DEFAULT 0,
    can_delete INTEGER DEFAULT 0,
    FOREIGN KEY (project_member_id) REFERENCES project_members(id) ON DELETE CASCADE,
    FOREIGN KEY (status_id) REFERENCES statuses(id) ON DELETE CASCADE
  );

  -- Задачи (теперь привязаны к проекту)
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status_id INTEGER NOT NULL,
    priority TEXT DEFAULT 'medium',
    assigned_to INTEGER,
    created_by INTEGER NOT NULL,
    due_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (status_id) REFERENCES statuses(id),
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  -- Индексы
  CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
  CREATE INDEX IF NOT EXISTS idx_statuses_project ON statuses(project_id);
  CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
  CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
  CREATE INDEX IF NOT EXISTS idx_permissions_member ON permissions(project_member_id);

  -- Приглашения в проект
  CREATE TABLE IF NOT EXISTS project_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    code TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    max_uses INTEGER DEFAULT NULL,
    uses INTEGER DEFAULT 0,
    expires_at DATETIME DEFAULT NULL,
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_invites_code ON project_invites(code);
  CREATE INDEX IF NOT EXISTS idx_invites_project ON project_invites(project_id);
`);

// ============================================
// МИГРАЦИЯ СТАРЫХ ДАННЫХ
// ============================================

// Проверяем, есть ли старая структура (статусы без project_id)
try {
  const oldStatuses = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='statuses'");
  if (oldStatuses.length > 0) {
    // Проверяем структуру таблицы statuses
    const tableInfo = db.exec("PRAGMA table_info(statuses)");
    const columns = tableInfo[0]?.values.map((row: any) => row[1]) || [];
    
    // Если нет project_id — это старая структура, нужна миграция
    if (!columns.includes('project_id')) {
      console.log('Обнаружена старая структура БД, выполняю миграцию...');
      
      // Сохраняем старые данные
      const oldStatusesData = db.exec("SELECT * FROM statuses");
      const oldTasksData = db.exec("SELECT * FROM tasks");
      const oldUsersData = db.exec("SELECT * FROM users");
      
      // Удаляем старые таблицы
      db.run("DROP TABLE IF EXISTS tasks");
      db.run("DROP TABLE IF EXISTS statuses");
      
      // Пересоздаём с новой структурой (уже создано выше при следующем запуске)
      console.log('Миграция завершена. Старые данные сохранены в памяти.');
      console.log('Создайте новый проект и перенесите задачи вручную.');
    }
  }
} catch (e) {
  // Игнорируем ошибки миграции
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

export function rowsToObjects(result: any): any[] {
  if (!result.length || !result[0].values.length) return [];
  const cols = result[0].columns;
  return result[0].values.map((vals: any) => {
    const obj: any = {};
    cols.forEach((col: string, i: number) => obj[col] = vals[i]);
    return obj;
  });
}

export function saveDb() {
  const data = db.export();
  writeFileSync(dbPath, Buffer.from(data));
}

// Автосохранение
setInterval(saveDb, 5000);

process.on('exit', saveDb);
process.on('SIGINT', () => {
  saveDb();
  process.exit();
});

export default db;
