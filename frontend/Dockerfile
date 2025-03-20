FROM node:alpine

WORKDIR /app

RUN npm install --global pm2

COPY ./package*.json ./

RUN npm ci --legacy-peer-deps

COPY . .

RUN npm run build

EXPOSE 3000

USER node

CMD ["pm2-runtime", "npm", "--", "start"]