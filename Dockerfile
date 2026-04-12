FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --production

COPY . .

RUN apk add --no-cache tini && tini --user nginx -g -p /

RUN npm run build

EXPOSE 3001

ENV NODE_ENV=production

USER node

ENTRYPOINT ["tini", "--", "node", "server/index.js"]
