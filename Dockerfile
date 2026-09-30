FROM node:20-alpine

WORKDIR /app

COPY . .

EXPOSE 8766

CMD ["node", "servidor.js"]
