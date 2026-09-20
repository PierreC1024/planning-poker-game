FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist
COPY server.js ./server.js
COPY server ./server

# Cloud Run sets PORT; default to 8080
ENV PORT=8080

CMD ["node", "server.js"]

