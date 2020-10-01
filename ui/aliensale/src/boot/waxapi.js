
import { Api, JsonRpc } from '@jafri/eosjs2'
const { TextDecoder, TextEncoder } = require('text-encoding')

export default ({ Vue }) => {
  const rpc = new JsonRpc([process.env.waxEndpoint])
  Vue.prototype.$wax = new Api({
    rpc,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder()
  })

  const eosRpc = new JsonRpc([process.env.eosEndpoint])
  Vue.prototype.$eos = new Api({
    rpc: eosRpc,
    textDecoder: new TextDecoder(),
    textEncoder: new TextEncoder()
  })
}
