FROM node:16.18.1

WORKDIR /app
COPY . .
RUN npm install && npm run build

CMD npm run start
