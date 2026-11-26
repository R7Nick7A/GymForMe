FROM node:24-slim

WORKDIR /app

# Устанавливаем зависимости бэкенда
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install --omit=dev --no-audit --no-fund || true

# Копируем код бэкенда и собранный фронтенд
COPY backend/ ./backend/
COPY frontend/dist ./frontend/dist

WORKDIR /app/backend

ENV PORT=3100
EXPOSE 3100

CMD ["node", "server.js"]
