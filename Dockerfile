FROM node:20-alpine

WORKDIR /app

# Копіюємо файли залежностей
COPY package*.json ./

# Встановлюємо ВСІ залежності (включно з dev, щоб був nodemon)
RUN npm install

# Копіюємо код
COPY . .

# Порт сервера
EXPOSE 3000

# Запуск через nodemon (скрипт dev з package.json)
CMD ["npm", "run", "dev"]
