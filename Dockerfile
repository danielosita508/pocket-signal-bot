FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Hugging Face Spaces runs on non-root user 1000 by default
RUN useradd -m -u 1000 user
USER user

ENV NODE_ENV=production

CMD ["node", "index.js"]
