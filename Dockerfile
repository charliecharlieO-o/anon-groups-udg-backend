FROM node:carbon

WORKDIR /app/

COPY package.json .

RUN apt-get update
RUN apt-get install build-essential
RUN npm install --quiet

COPY . .

