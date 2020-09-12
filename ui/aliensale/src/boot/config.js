
export default ({ Vue }) => {
  Vue.prototype.$config = {
    waxEndpoint: 'https://testnet.waxsweden.org',
    eosEndpoint: 'https://jungle3.eosdac.io',
    atomicEndpoint: 'https://test.wax.api.atomicassets.io',
    collectionName: 'alien.worlds',
    redeemContractEos: 'alienpromopk',
    redeemBurnEos: 'alienworlds1'
  }
}
