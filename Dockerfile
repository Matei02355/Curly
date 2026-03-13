FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .

RUN npm run prisma:generate
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
