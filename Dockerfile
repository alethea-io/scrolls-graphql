FROM node:18-alpine as builder
WORKDIR /app

COPY .env .
COPY package.json .
COPY yarn.lock .
COPY tsconfig.json .
COPY src src

RUN yarn install
RUN yarn build


FROM node:18-alpine as final
WORKDIR /app

COPY .env .
COPY package.json .
COPY yarn.lock .
COPY --from=builder ./app/build ./build

RUN yarn install --production

CMD [ "yarn", "start" ]