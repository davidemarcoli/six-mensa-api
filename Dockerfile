FROM oven/bun AS installer

WORKDIR /home/bun/app
COPY package*.json ./
COPY bun.lockb ./

RUN bun install

FROM node:22-alpine AS builder

RUN mkdir -p /home/node/app/node_modules && chown -R node:node /home/node/app

COPY --from=installer /home/bun/app/node_modules ./node_modules

WORKDIR /home/node/app

COPY package*.json ./

USER node

COPY --chown=node:node dist/* .

EXPOSE 3000

CMD [ "node", "index.js" ]