FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
# src/ is bind-mounted at runtime; copy here only as fallback
COPY src ./src
COPY public ./public
EXPOSE 3001
CMD ["npm", "start"]
