# Используем официальный образ Node.js
FROM node:20-alpine

# Устанавливаем pnpm (установится последняя стабильная версия)
RUN npm install -g pnpm

# Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# Копируем package.json и pnpm-lock.yaml для установки зависимостей
COPY package.json pnpm-lock.yaml ./

# Устанавливаем зависимости
RUN pnpm install

# Копируем оставшиеся файлы в контейнер
COPY . .

# Указываем команду для запуска
CMD ["pnpm", "run", "distribution"]

# Открываем порт 4500
EXPOSE 4500

