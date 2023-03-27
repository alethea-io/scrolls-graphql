import express from 'express'
import { createYoga } from 'graphql-yoga'
import { schema } from './schema'

const PORT = process.env.PORT ?? 4000

// Create express server
const server = express()

// Create a Yoga instance with a GraphQL schema.
const yoga = createYoga({ schema })

// Set base path for graphql api
server.use('/graphql', yoga)

// Start the server
server.listen(PORT, () => {
  console.info(`Server is running on http://localhost:${PORT}/graphql`)
})