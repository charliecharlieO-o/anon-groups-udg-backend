FROM node:carbon

WORKDIR /app/

COPY package.json .
COPY package-lock.json .

RUN npm install -g node-gyp
RUN npm install --quiet

COPY . .

