FROM oven/bun AS installer

WORKDIR /home/bun/app
COPY package*.json ./
COPY bun.lockb ./

RUN bun install

FROM node:22-alpine AS builder

WORKDIR /home/node/app

COPY --from=installer /home/bun/app/node_modules ./node_modules
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src

RUN npx tsc

FROM node:22-alpine

WORKDIR /home/node/app

COPY --from=installer /home/bun/app/node_modules ./node_modules
COPY --from=builder /home/node/app/dist ./dist
COPY package*.json ./

RUN mkdir -p pdfs processed images

EXPOSE 3000

CMD [ "node", "dist/app.js" ]
