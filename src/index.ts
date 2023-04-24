import * as dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import { createYoga, YogaInitialContext } from 'graphql-yoga'
import Redis from 'ioredis'
import { schema } from './schema'

const PORT = process.env.PORT || 4000
const REDIS_URL = process.env.REDIS_URL || 'localhost:6379'

export interface GraphQLContext extends YogaInitialContext {
  redis: Redis
}

const main = async () => {
  // Create redis instance
  console.info(`Connecting to Redis at ${REDIS_URL}`)
  const redis = new Redis(REDIS_URL)

  // Create a Yoga instance with a GraphQL schema.
  const yoga = createYoga({
    schema: schema,
    context: ({request}) => ({
      request,
      redis: redis
    })
  })

  // Create express server
  const server = express()

  // Set base path for graphql api
  server.use('/graphql', yoga)

  // Start the server
  server.listen(PORT, () => {
    console.info(`Server is running on http://localhost:${PORT}/graphql`)
  })
}

main()