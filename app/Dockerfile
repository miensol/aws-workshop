FROM --platform=linux/amd64 node:14

WORKDIR /srv

COPY *.json ./

RUN npm ci --production

COPY dist ./dist

CMD npm run start:prod
