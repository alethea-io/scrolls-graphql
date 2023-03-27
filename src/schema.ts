import Redis from 'ioredis'
import { createSchema } from 'graphql-yoga'

const REDIS_URL = process.env.REDIS_URL ?? 'localhost:6379'

console.info(`Connecting to Redis at ${REDIS_URL}`)

// Create redis client
const redis = new Redis(REDIS_URL)

// Create GraphQL schema
export const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type Query {
      ping: String
      asset_holders_by_asset_id(asset_id: String!, epoch_no: Int, prefix: String): [String]
      balance_by_address(address: String!, prefix: String): Int
      balance_by_stake(stake_address: String!, prefix: String): Int
      txcount_by_address(address: String!, prefix: String): Int
      supply_by_asset(asset_id: String!, prefix: String): Int
    }
  `,
  resolvers: {
    Query: {
      ping: async () => {
        return await redis.ping()
      },
      asset_holders_by_asset_id: async (_, { asset_id, epoch_no=null, prefix=null }) => {
        return await redis.get(
          `${prefix ?? "asset_holders_by_asset_id"}.${asset_id}${epoch_no ? "." + epoch_no.toString() : ""}`
        )
      },
      balance_by_address: async (_, { address, prefix=null }) => {
        return await redis.get(
          `${prefix ?? "balance_by_address"}.${address}`
        )
      },
      balance_by_stake: async (_, { stake_address, prefix=null }) => {
        return await redis.get(
          `${prefix ?? "balance_by_stake"}.${stake_address}`
        )
      },
      txcount_by_address: async (_, { address, prefix=null }) => {
        return await redis.get(
          `${prefix ?? "txcount_by_address"}.${address}`
        )
      },
      supply_by_asset: async (_, { asset_id, prefix=null }) => {
        return await redis.get(
          `${prefix ?? "supply_by_asset"}.${asset_id}`
        )
      },
    }
  }
})