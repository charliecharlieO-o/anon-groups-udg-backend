FROM node:carbon

WORKDIR /app/

COPY package.json .
COPY package-lock.json .

RUN npm i -g node-gyp
RUN npm i

COPY . .
