const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { program } = require('commander');
const swaggerUi = require('swagger-ui-express');

//Налаштування параметрів командного рядка
program
  .requiredOption('-h, --host <host>', 'адреса сервера')
  .requiredOption('-p, --port <port>', 'порт сервера')
  .requiredOption('-c, --cache <dir>', 'шлях до директорії кешу');

program.parse(process.argv);

const options = program.opts();
const host = options.host;
const port = Number(options.port);
const cacheDir = options.cache;

//Створення директорії кешу, якщо її немає
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
  console.log(`Створено директорію кешу: ${cacheDir}`);
}

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//Налаштування multer для завантаження файлів у кеш-папку
const upload = multer({ dest: cacheDir });

//Тимчасове "сховище" інвентаря у памʼяті
let inventory = [];
let nextId = 1;

//Пошук елемента за ID
function findItem(id) {
  return inventory.find((item) => item.id === Number(id));
}

//Формування JSON-відповіді для елемента
function itemToJson(item, includePhotoLink = true) {
  const jsonItem = {
    id: item.id.toString(),
    inventory_name: item.inventory_name,
    description: item.description,
  };

  if (item.photoFile && includePhotoLink) {
    jsonItem.photo_url = `/inventory/${item.id}/photo`;
  }

  return jsonItem;
}

//Повернення форми реєстрації
app.get('/RegisterForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'RegisterForm.html'));
});

//Повернення форми пошуку
app.get('/SearchForm.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'SearchForm.html'));
});

//Апі ендпоінти

//Реєстрація нового інвентарного об’єкта з фото
app.post('/register', upload.single('photo'), (req, res) => {
  const name = req.body.inventory_name;
  const description = req.body.description || '';
  const photo = req.file;

  //Перевірка, щоб назва була обов’язковою
  if (!name || name.trim() === '') {
    if (photo && fs.existsSync(photo.path)) {
      fs.unlinkSync(photo.path); // видаляємо файл, якщо імʼя некоректне
    }
    return res.status(400).send("inventory_name є обов'язковим");
  }

  //Створення нового елемента
  const newItem = {
    id: nextId++,
    inventory_name: name,
    description: description,
    photoFile: photo ? photo.filename : null,
  };

  inventory.push(newItem);

  res.status(201).json(itemToJson(newItem));
});

//Отримання всього списку інвентаря
app.get('/inventory', (req, res) => {
  const list = inventory.map((item) => itemToJson(item));
  res.status(200).json(list);
});

//Отримання одного елемента за його ID
app.get('/inventory/:id', (req, res) => {
  const item = findItem(req.params.id);

  if (!item) {
    return res.status(404).send('Not found');
  }

  res.status(200).json(itemToJson(item));
});

//Оновлення назви та опису елемента за ID
app.put('/inventory/:id', (req, res) => {
  const item = findItem(req.params.id);

  if (!item) {
    return res.status(404).send('Not found');
  }

  if (req.body.inventory_name) {
    item.inventory_name = req.body.inventory_name;
  }
  if (req.body.description) {
    item.description = req.body.description;
  }

  res.status(200).json(itemToJson(item));
});

//Видалення елемента інвентаря за ID
app.delete('/inventory/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = inventory.findIndex((item) => item.id === id);
  const item = findItem(id);

  if (index === -1) {
    return res.status(404).send('Not found');
  }

  // Якщо є фото то видаляємо файл
  if (item.photoFile) {
    const photoPath = path.join(cacheDir, item.photoFile);
    if (fs.existsSync(photoPath)) {
      fs.unlinkSync(photoPath);
    }
  }

  inventory.splice(index, 1);

  res.status(200).send('Deleted');
});

//Повернення фото елемента за ID
app.get('/inventory/:id/photo', (req, res) => {
  const item = findItem(req.params.id);

  if (!item || !item.photoFile) {
    return res.status(404).send('Not found');
  }

  res.setHeader('Content-Type', 'image/jpeg');
  res.status(200).sendFile(item.photoFile, { root: cacheDir }, (err) => {
    if (err && !res.headersSent) {
      res.status(404).send('Photo file not found on server');
    }
  });
});

//Оновлення фото елемента
app.put('/inventory/:id/photo', upload.single('photo'), (req, res) => {
  const item = findItem(req.params.id);
  const photo = req.file;

  if (!item) {
    if (photo && fs.existsSync(photo.path)) {
      fs.unlinkSync(photo.path);
    }
    return res.status(404).send('Not found');
  }

  if (!photo) {
    return res.status(400).send('photo is required');
  }

  // Видалення старого фото
  if (item.photoFile) {
    const oldPhotoPath = path.join(cacheDir, item.photoFile);
    if (fs.existsSync(oldPhotoPath)) {
      fs.unlinkSync(oldPhotoPath);
    }
  }

  item.photoFile = photo.filename;

  res.status(200).json(itemToJson(item));
});

// Пошук елемента за ID через форму
app.post('/search', (req, res) => {
  const id = req.body.id;
  const includePhoto = req.body.includePhoto !== undefined;

  const item = findItem(id);

  if (!item) {
    return res.status(404).send('Not found');
  }

  const result = itemToJson(item, false);

  if (includePhoto && item.photoFile) {
    result.photo_url = `/inventory/${item.id}/photo`;
  }

  res.status(200).json(result);
});

//Swagger документація
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Сервіс інвентаризації (Лабораторна робота №6)',
    version: '1.0.0',
    description: 'API для ведення обліку інвентарних речей.',
  },
  paths: {
    '/register': { post: { summary: 'Реєстрація нового інвентаря' } },
    '/inventory': { get: { summary: 'Отримання повного списку' } },
    '/inventory/{id}': {
      get: { summary: 'Отримання одного елемента' },
      put: { summary: 'Оновлення елемента' },
      delete: { summary: 'Видалення елемента' },
    },
    '/inventory/{id}/photo': {
      get: { summary: 'Отримання фото' },
      put: { summary: 'Оновлення фото' },
    },
    '/search': { post: { summary: 'Пошук елемента за ID' } },
    '/RegisterForm.html': { get: { summary: 'HTML форма реєстрації' } },
    '/SearchForm.html': { get: { summary: 'HTML форма пошуку' } },
  },
};

// Підключення Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Відомі маршрути та дозволені методи
const knownRoutes = [
  { pattern: /^\/register$/, methods: ['POST'] },
  { pattern: /^\/inventory$/, methods: ['GET'] },
  { pattern: /^\/inventory\/[^\/]+$/, methods: ['GET', 'PUT', 'DELETE'] },
  { pattern: /^\/inventory\/[^\/]+\/photo$/, methods: ['GET', 'PUT'] },
  { pattern: /^\/search$/, methods: ['POST'] },
  { pattern: /^\/RegisterForm\.html$/, methods: ['GET'] },
  { pattern: /^\/SearchForm\.html$/, methods: ['GET'] },
  { pattern: /^\/docs.*$/, methods: ['GET'] },
];

// Якщо шлях існує, але метод неправильний то 405
app.use((req, res, next) => {
  const route = knownRoutes.find((r) => r.pattern.test(req.path));
  if (route && !route.methods.includes(req.method)) {
    return res.status(405).send('Method not allowed');
  }
  next();
});

// Якщо шлях не існує то 404
app.use((req, res) => {
  res.status(404).send('Not found');
});

const server = http.createServer(app);

server.listen(port, host, () => {
  console.log(`http://${host}:${port}`);
});