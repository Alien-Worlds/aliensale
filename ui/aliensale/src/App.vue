<template>
  <div id="q-app">
    <ual vi-if="appName" :appName="appName" :chains="chains" :authenticators="authenticators"/>

    <router-view />
  </div>
</template>
<script>
// import { mapGetters } from 'vuex'
import ual from 'components/ual/ual'
// import { Scatter } from 'ual-scatter'
// import { Ledger } from 'ual-ledger'
// import { Lynx } from 'ual-lynx'
import { Wax } from '@eosdacio/ual-wax'
// import { TokenPocket } from 'ual-token-pocket'
import { Anchor } from 'ual-anchor'

// import Vue from 'vue'

export default {
  name: 'App',
  components: {
    ual
  },
  methods: {
    splitEndpoint (endpoint) {
      const [protocol, hostPort] = endpoint.split('://')
      const [host, portStr] = hostPort.split(':')
      let port = parseInt(portStr)
      if (isNaN(port)) {
        port = (protocol === 'https') ? 443 : 80
      }

      return {
        protocol,
        host,
        port
      }
    }
  },
  data () {
    const appName = 'Alien Worlds'
    const endpointsWax = [process.env.waxEndpoint]
    const endpointsEos = [process.env.eosEndpoint]
    // const network = 'wax'

    const chainsWax = [{
      chainId: process.env.waxChainId,
      rpcEndpoints: [this.splitEndpoint(endpointsWax[0])]
    }]
    const chainsEos = [{
      chainId: process.env.eosChainId,
      rpcEndpoints: [this.splitEndpoint(endpointsEos[0])]
    }]

    const authenticatorsWax = [
      new Wax(chainsWax, { appName }),
      // new Scatter(chainsWax, { appName }),
      // new Ledger(chains),
      // new Lynx(chains, { appName: appName }),
      // new TokenPocket(chains),
      // new SimplEOS(chains),
      new Anchor(chainsWax, { appName })
    ]
    const authenticatorsEos = [
      // new Scatter(chainsEos, { appName }),
      // new Ledger(chains),
      // new Lynx(chains, { appName: appName }),
      // new TokenPocket(chains),
      // new SimplEOS(chains),
      new Anchor(chainsEos, { appName })
    ]

    // this.chains = chains
    // this.authenticators = authenticators
    // this.appName = appName

    const chains = {
      eos: chainsEos,
      wax: chainsWax
    }
    const authenticators = {
      eos: authenticatorsEos,
      wax: authenticatorsWax
    }

    return {
      appName,
      chains,
      authenticators
    }
  }
}
</script>
