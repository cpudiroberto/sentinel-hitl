# Etapa 1: Calidad, tests y compilación
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx eslint . --max-warnings 0 && npx vitest run && npm run build

# Etapa 2: Servidor ligero Nginx para producción
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]