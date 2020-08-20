
import { Api, JsonRpc } from '@jafri/eosjs2'
const { TextDecoder, TextEncoder } = require('text-encoding')

export default ({ Vue }) => {
  const rpc = new JsonRpc(['https://testnet.waxsweden.org'])
  Vue.prototype.$wax = new Api({
    rpc,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder()
  })
}
