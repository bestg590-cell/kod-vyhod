const path = require('path');
const express = require('express');
const { DatabaseSync } = require('node:sqlite');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- БАЗА ДАННЫХ ----------
const db = new DatabaseSync(path.join(__dirname, 'db.sqlite'));
db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    kind TEXT NOT NULL,
    price INTEGER NOT NULL,
    players TEXT NOT NULL,
    age TEXT NOT NULL,
    badge TEXT NOT NULL,
    description TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL,
    date_full TEXT NOT NULL,
    time TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    players INTEGER NOT NULL,
    team TEXT,
    comment TEXT,
    price INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Заполняем квесты, если база пустая
const roomsCount = db.prepare('SELECT COUNT(*) AS c FROM rooms').get().c;
if (roomsCount === 0) {
  const insert = db.prepare(`
    INSERT INTO rooms (title, difficulty, kind, price, players, age, badge, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const seed = [
    ['Чернобыль: Отсчет до катастрофы', 'Сложный', 'Chernobyl', 4500, '2–6', '16+', 'СЛОЖНЫЙ', '1986 год, пульт управления атомной электростанции зафиксировал критический сбой в работе 4 энерго-блока.'],
    ['Ограбление Казино "Монте Карло"', 'Средний', 'Casino', 4000, '3–6', '14+', 'СРЕДНИЙ', 'Ваша банда идет на дело века - вскрыть главное подземное хранилище элитного казино.'],
    ['Проклятие гробницы Анубиса', 'Легкий', 'Tomb', 3700, '2–6', '10+', 'ЛЕГКИЙ', 'Вы группа исследователей, оказавшиеся в ловушке древней египетской пирамиды.'],
    ['Закрытый морг №4', 'Сложный', 'Mortuary', 4800, '2–6', '18+', 'СЛОЖНЫЙ', 'В городском морге во время ночной смены прекратилась связь. Прибыв на вызов, вы оказываетесь заперты в коридорах среди холодильных камер.'],
  ];
  for (const row of seed) insert.run(...row);
  console.log('База заполнена стартовыми квестами.');
}

// ---------- API ----------
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Список квестов (можно фильтровать ?difficulty=Сложный)
app.get('/api/rooms', (req, res) => {
  const { difficulty } = req.query;
  let rows;
  if (difficulty && difficulty !== 'Все') {
    rows = db.prepare('SELECT * FROM rooms WHERE difficulty = ?').all(difficulty);
  } else {
    rows = db.prepare('SELECT * FROM rooms').all();
  }
  res.json(rows);
});

// Один квест
app.get('/api/rooms/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Квест не найден' });
  res.json(row);
});

// Создание брони
app.post('/api/bookings', (req, res) => {
  const { room_id, date_full, time, name, phone, email, players, team, comment } = req.body || {};

  if (!room_id || !date_full || !time || !name || !phone || !email || !players) {
    return res.status(400).json({ error: 'Заполните обязательные поля' });
  }
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    return res.status(400).json({ error: 'Проверьте номер телефона' });
  }
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(room_id);
  if (!room) return res.status(404).json({ error: 'Квест не найден' });

  const info = db.prepare(`
    INSERT INTO bookings (room_id, date_full, time, name, phone, email, players, team, comment, price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(room_id, date_full, time, name, phone, email, Number(players), team || null, comment || null, room.price);

  res.status(201).json({ id: Number(info.lastInsertRowid), ok: true });
});

// Список броней
app.get('/api/bookings', (req, res) => {
  const rows = db.prepare(`
    SELECT b.*, r.title AS room_title
    FROM bookings b JOIN rooms r ON r.id = b.room_id
    ORDER BY b.id DESC
  `).all();
  res.json(rows);
});

// Все прочие пути → index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});