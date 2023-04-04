import Redis from 'ioredis'
import { createSchema } from 'graphql-yoga'

const zip = (a: any, b: any) => a.map((k: any, i: string | number) => [k, b[i]]);

const REDIS_URL = process.env.REDIS_URL ?? 'localhost:6379'

console.info(`Connecting to Redis at ${REDIS_URL}`)

// Create redis client
const redis = new Redis(REDIS_URL)

// Create GraphQL schema
export const schema = createSchema({
  typeDefs: /* GraphQL */ `

    type TokenBalance {
      policy_id: String
      name: String
      quantity: Float
    }

    type TokenType {
      token_count: Int
      tokens: [TokenBalance]
      nft_count: Int
      nfts: [TokenBalance]
      ada_handle_count: Int
      ada_handles: [TokenBalance]
    }

    type Address {
      balance(prefix: String): Float
      tokens(prefix: String): TokenType
      tx_count(prefix: String): Int
    }

    type StakeKey {
      balance(prefix: String): Float
      tokens(prefix: String): TokenType
      tx_count(prefix: String): Int
    }

    type AddressBalance {
      address: String
      quantity: Float
    }

    type StakeKeyBalance {
      stake_key: String
      quantity: Float
    }

    type Token {
      supply(prefix: String): Float
      addresses(prefix: String, epoch_no: Int): [AddressBalance]
      stake_keys(prefix: String, epoch_no: Int): [StakeKeyBalance]
      tx_count(prefix: String): Int
    }

    type Query {
      ping: String
      address(address: String!): Address
      stake_key(stake_key: String!): StakeKey
      token(asset: String!): Token
    }
  `,
  resolvers: {
    Query: {
      ping: async () => {
        return await redis.ping()
      },
      address: async (_, { address }) => ({ address }),
      stake_key: async (_, { stake_key }) => ({ stake_key }),
      token: async (_, { asset }) => ({ asset }),
    },
    Address: {
      balance: async (parent, { prefix=null }) => {
        return await redis.get(
          `${prefix ?? "balance_by_address"}.${parent.address}`
        )
      },
      tokens: async (parent, { prefix=null }) => {
        let assets_by_address = await redis.zrange(
          `${prefix ?? "assets_by_address"}.${parent.address}`,
          1,
          '+inf',
          'BYSCORE',
          "WITHSCORES",
        )
        
        let assets = assets_by_address
          .filter(i => !isNaN(parseInt(i)))
          .map(i => 'supply_by_asset.' + i.replace('.', ''))
        console.log(assets)
        let supply = await redis.mget(...assets)
        let supply_by_asset = zip(assets, supply)

        var tokens = []
        var nfts = []
        var ada_handles = []
        for (var i = 0; i < assets_by_address.length; i+=2) {
          let subject = assets_by_address[i]
          let quantity = parseInt(assets_by_address[i+1])

          let token = {
            policy_id: subject.split('.')[0],
            name: subject.split('.')[1],
            quantity: quantity,
          }

          let supply = supply_by_asset['supply_by_asset.' + token.policy_id + token.name]
          if(supply > 1) {
            tokens.push(token)
          } else {
            nfts.push(token)
          }

          if(token.policy_id == 'f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a') {
            ada_handles.push(token)
          }
        }

        return {
          token_count: tokens.length,
          tokens: tokens,
          nft_count: nfts.length,
          nfts: nfts,
          ada_handle_count: ada_handles.length,
          ada_handles: ada_handles
        }
      },
      tx_count: async (parent, { prefix=null }) => {
        return await redis.get(
          `${prefix ?? "txcount_by_address"}.${parent.address}`
        )
      },
    },
    StakeKey: {
      balance: async (parent, { prefix=null }) => {
        return await redis.get(
          `${prefix ?? "balance_by_stake_key"}.${parent.stake_key}`
        )
      },
      tokens: async (parent, { prefix=null }) => {
        let assets_by_stake_key = await redis.zrange(
          `${prefix ?? "assets_by_stake_key"}.${parent.stake_key}`,
          1,
          '+inf',
          'BYSCORE',
          "WITHSCORES",
        )

        let assets = assets_by_stake_key
          .filter(i => !isNaN(parseInt(i)))
          .map(i => 'supply_by_asset.' + i.replace('.', ''))

        let supply = await redis.mget(...assets)
        let supply_by_asset = zip(assets, supply)

        var tokens = []
        var nfts = []
        var ada_handles = []
        for (var i = 0; i < assets_by_stake_key.length; i+=2) {
          let subject = assets_by_stake_key[i]
          let quantity = parseInt(assets_by_stake_key[i+1])

          let token = {
            policy_id: subject.split('.')[0],
            name: subject.split('.')[1],
            quantity: quantity,
          }

          let supply = supply_by_asset['supply_by_asset.' + token.policy_id + token.name]
          if(supply > 1) {
            tokens.push(token)
          } else {
            nfts.push(token)
          }

          if(token.policy_id == 'f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a') {
            ada_handles.push(token)
          }
        }

        return {
          token_count: tokens.length,
          tokens: tokens,
          nft_count: nfts.length,
          nfts: nfts,
          ada_handle_count: ada_handles.length,
          ada_handles: ada_handles,
        }
      },
      tx_count: async (parent, { prefix=null }) => {
        return await redis.get(
          `${prefix ?? "tx_count_by_stake_key"}.${parent.stake_key}`
        )
      },
    },
    Token: {
      supply: async (parent, { prefix=null }) => {
        return await redis.get(
          `${prefix ?? "supply_by_asset"}.${parent.asset}`
        )
      },
      addresses: async (parent, { epoch_no=null, prefix=null }) => {
        let asset = parent.asset.slice(0, 56) + '.' + parent.asset.slice(56)
        let addresses_by_asset = await redis.zrange(
          `${prefix ?? "addresses_by_asset"}.${asset}${epoch_no ? "." + epoch_no.toString() : ""}`,
          1,
          '+inf',
          'BYSCORE',
          "WITHSCORES",
        )
        
        var addresses = []
        for (var i = 0; i < addresses_by_asset.length; i+=2) {
          let address = addresses_by_asset[i]
          let quantity = parseInt(addresses_by_asset[i+1])

          addresses.push({
            address: address,
            quantity: quantity,
          })
        }
        
        return addresses
      },
      stake_keys: async (parent, { epoch_no=null, prefix=null }) => {
        let asset = parent.asset.slice(0, 56) + '.' + parent.asset.slice(56)
        let stake_keys_by_asset = await redis.zrange(
          `${prefix ?? "stake_keys_by_asset"}.${asset}${epoch_no ? "." + epoch_no.toString() : ""}`,
          1,
          '+inf',
          'BYSCORE',
          "WITHSCORES",
        )
        
        var stake_keys = []
        for (var i = 0; i < stake_keys_by_asset.length; i+=2) {
          let stake_key = stake_keys_by_asset[i]
          let quantity = parseInt(stake_keys_by_asset[i+1])

          stake_keys.push({
            stake_key: stake_key,
            quantity: quantity,
          })
        }
        
        return stake_keys
      },
      tx_count: async (parent, { prefix=null }) => {
        let asset = parent.asset.slice(0, 56) + '.' + parent.asset.slice(56)
        return await redis.get(
          `${prefix ?? "tx_count_by_asset"}.${asset}`
        )
      },
    }
  }
})