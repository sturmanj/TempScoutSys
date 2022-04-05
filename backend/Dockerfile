FROM node:16

WORKDIR /scoutSys/backend

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000 5000

CMD [ "node", "server.js" ]