FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci --legacy-peer-deps
COPY src ./src
COPY public ./public
RUN chown -R node:node /app
EXPOSE 3001
USER node
CMD ["npm", "start"]
