# scrolls-graphql

A simple graphql endpoint for querying the scrolls cache

## Run locally
```bash
git clone https://github.com/alethea-io/scrolls-graphql.git
cd scrolls-graphql

yarn dev 

or

yarn build && yarn start
```

## Build Docker image

```bash
git clone https://github.com/alethea-io/scrolls-graphql.git
cd scrolls-graphql

docker build . -t scrolls-graphql
```

## Run with docker compose

See examples folder for running scrolls with the full graphql api stack using docker compose.
