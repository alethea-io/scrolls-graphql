import { createSchema } from 'graphql-yoga'
import Redis from 'ioredis';
import { GraphQLContext } from "./index";

const AssetFingerprint = require('@emurgo/cip14-js').default;

const MAX_SET_SIZE = 1e6

// Create GraphQL schema
export const schema = createSchema<GraphQLContext>({
  typeDefs: /* GraphQL */ `

    type TokenBalance {
      idx: Int
      policy_id: String
      name: String
      fingerprint: String
      quantity: Float
    }

    type TokenType {
      count: Int
      tokens: [TokenBalance]
    }

    type Address {
      balance(prefix: String): Float
      tokens(prefix: String): TokenType
      nfts(prefix: String): TokenType
      ada_handles(prefix: String): TokenType
      tx_count(prefix: String): Int
    }

    type StakeKey {
      balance(prefix: String): Float
      tokens(prefix: String): TokenType
      nfts(prefix: String): TokenType
      ada_handles(prefix: String): TokenType
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
      address_count(prefix: String, epoch_no: Int): Int
      stake_keys(prefix: String, epoch_no: Int): [StakeKeyBalance]
      stake_key_count(prefix: String, epoch_no: Int): Int
      tx_count(prefix: String): Int
    }

    type Query {
      scrolls_address(address: String!): Address
      scrolls_stake_key(stake_key: String!): StakeKey
      scrolls_token(policy_id: String!, name: String!): Token
    }
  `,
  resolvers: {
    Query: {
      scrolls_address: async (_, { address }) => ({ address }),
      scrolls_stake_key: async (_, { stake_key }) => ({ stake_key }),
      scrolls_token: async (_, { policy_id, name }) => ({ policy_id, name }),
    },
    Address: {
      balance: async (parent, { prefix=null }, { redis }) => {
        return await redis.get(
          `${prefix ?? "balance_by_address"}.${parent.address}`
        )
      },
      tokens: async (parent, { cursor=0, limit=MAX_SET_SIZE, prefix=null }, { redis }) => {
        return getTokensByAddress(parent, "fungible", limit, cursor, prefix, redis)
      },
      nfts: async (parent, { cursor=0, limit=MAX_SET_SIZE, prefix=null }, { redis }) => {
        return getTokensByAddress(parent, "nft", limit, cursor, prefix, redis)
      },
      ada_handles: async (parent, { cursor=0, limit=MAX_SET_SIZE, prefix=null }, { redis }) => {
        return getTokensByAddress(parent, "handle", limit, cursor, prefix, redis)
      },
      tx_count: async (parent, { prefix=null }, { redis }) => {
        return await redis.get(
          `${prefix ?? "txcount_by_address"}.${parent.address}`
        )
      },
    },
    StakeKey: {
      balance: async (parent, { prefix=null }, { redis }) => {
        return await redis.get(
          `${prefix ?? "balance_by_stake_key"}.${parent.stake_key}`
        )
      },
      tokens: async (parent, { cursor=0, limit=MAX_SET_SIZE, prefix=null }, { redis }) => {
        return getTokensByAddress(parent, "fungible", limit, cursor, prefix, redis)
      },
      nfts: async (parent, { cursor=0, limit=MAX_SET_SIZE, prefix=null }, { redis }) => {
        return getTokensByAddress(parent, "nft", limit, cursor, prefix, redis)
      },
      ada_handles: async (parent, { cursor=0, limit=MAX_SET_SIZE, prefix=null }, { redis }) => {
        return getTokensByAddress(parent, "handle", limit, cursor, prefix, redis)
      },
      tx_count: async (parent, { prefix=null }, { redis }) => {
        return await redis.get(
          `${prefix ?? "tx_count_by_stake_key"}.${parent.stake_key}`
        )
      },
    },
    Token: {
      supply: async (parent, { prefix=null }, { redis }) => {
        let asset = `${parent.policy_id.slice(2)}${parent.name.slice(2)}`
        console.log(asset)
        return await redis.get(
          `${prefix ?? "supply_by_asset"}.${asset}`
        )
      },
      addresses: async (parent, { epoch_no = null, prefix = null }, { redis }) => {
        return getAddressesByAsset(parent, "addresses", epoch_no, prefix, redis);
      },
      address_count: async (parent, { epoch_no = null, prefix = null }, { redis }) => {
        return getAddressCountByAsset(parent, "addresses", epoch_no, prefix, redis);
      },
      stake_keys: async (parent, { epoch_no = null, prefix = null }, { redis }) => {
        return getAddressesByAsset(parent, "stake_keys", epoch_no, prefix, redis);
      },
      stake_key_count: async (parent, { epoch_no = null, prefix = null }, { redis }) => {
        return getAddressCountByAsset(parent, "stake_keys", epoch_no, prefix, redis);
      },
      tx_count: async (parent, { prefix=null }, { redis }) => {
        let asset = `${parent.policy_id.slice(2)}.${parent.name.slice(2)}`
        console.log(asset)
        return await redis.get(
          `${prefix ?? "tx_count_by_asset"}.${asset}`
        )
      },
    }
  }
})

async function getTokensByAddress(
  parent: any, 
  tokenType: string, 
  limit: number, 
  cursor: number, 
  prefix: string, 
  redis: Redis
) {

  var key;
  var keyPrefix;

  if("address" in parent) {
    key = parent.address
    keyPrefix = prefix ?? "assets_by_address"
  } else if("stake_key" in parent) {
    key = parent.stake_key
    keyPrefix = prefix ?? "assets_by_stake_key"
  } else return

  let assetsByKey = tokenType == "nft" || tokenType == "handle"
    ? await redis.zrange(`${keyPrefix}.${key}`, 1, 1, "BYSCORE", "WITHSCORES")
    : await redis.zrange(`${keyPrefix}.${key}`, 1, MAX_SET_SIZE, "WITHSCORES")

  if(assetsByKey.length == 0) return 
  
  // Get supply of each asset
  var assetList = []
  for (var i = 0; i < assetsByKey.length; i+=2) {
    assetList.push('supply_by_asset.' + assetsByKey[i].replace('.', ''))
  }
  let supplyList = await redis.mget(...assetList)

  var tokens = []
  for (var i = 0; i < assetsByKey.length; i+=2) {
    let subject = assetsByKey[i]
    let quantity = parseFloat(assetsByKey[i+1])

    let policy_id = subject.split('.')[0];
    let name = subject.split('.')[1];

    const fingerprint: string = AssetFingerprint.fromParts(
      Buffer.from(policy_id, 'hex'), 
      Buffer.from(name, 'hex')
    );

    let token = {
      idx: i/2,
      policy_id: `\\x${policy_id}`,
      name: `\\x${name}`,
      fingerprint: fingerprint,
      quantity: quantity,
    }

    let supply = parseFloat(supplyList[i/2] ?? "0")

    switch(tokenType) {
      case "fungible":
        if(supply > 1) 
          tokens.push(token)
        break
      case "nft":
        if(supply == 1)
          tokens.push(token)
        break
      case "handle":
        if(token.policy_id == 'f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a')
          tokens.push(token)
        break
      default:
        continue
    }
  }

  return {
    count: tokens.length,
    tokens: tokens.slice(cursor, cursor + limit),
  }
}

async function getAddressesByAsset(
  parent: any,
  addressType: string,
  epoch_no: number | null,
  prefix: string,
  redis: Redis
) {
  let asset = `${parent.policy_id.slice(2)}${parent.name.slice(2)}`
  let key_prefix = prefix ?? `${addressType}_by_asset`
  let key = `${key_prefix}.${asset}${epoch_no ? "." + epoch_no.toString() : ""}`;
  
  let addressesByAsset = await redis.zrange(
    key,
    1,
    MAX_SET_SIZE,
    'BYSCORE',
    "WITHSCORES",
  );

  var addressKeyName;
  switch(addressType) {
    case "addresses":
      addressKeyName = "address"
      break
    case "stake_keys":
      addressKeyName = "stake_key"
      break
    default:
      return
  }

  var addresses = [];
  for (var i = 0; i < addressesByAsset.length; i += 2) {
    let item = addressesByAsset[i];
    let quantity = parseFloat(addressesByAsset[i + 1]);

    addresses.push({
      [addressKeyName]: item,
      quantity: quantity,
    });
  }
  
  return addresses;
}

async function getAddressCountByAsset(
  parent: any,
  addressType: string,
  epoch_no: number | null,
  prefix: string,
  redis: Redis
) {
  let asset = `${parent.policy_id.slice(2)}${parent.name.slice(2)}`
  let key_prefix = prefix ?? `${addressType}_by_asset`
  let key = `${key_prefix}.${asset}${epoch_no ? "." + epoch_no.toString() : ""}`;

  return await redis.zcard(key);
}