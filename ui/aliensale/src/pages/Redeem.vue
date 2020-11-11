<template>
  <q-page class="full-width column wrap justify-start content-center planet-bg-page">
    <div class="text-h1">Claim Airdrop</div>

    <p><a href="https://docs.google.com/spreadsheets/d/1YzxPsf_6fs_HmNmhNtkVBLCDYUBpiNnlfVF7ViC-p2A/edit" target="_blank">View list of Ethereum addresses entitled to airdrop</a></p>

    <div class="d-flex flex-row flex-wrap">

      <div class="p-4 w-50">
        <h2>EOS</h2>
        <div v-if="!getAccountName.eos">
          <b-button @click="loginEos">Login to EOS</b-button>
        </div>

        <div v-if="getAccountName.eos && redeemableEos.length">
          You have an airdrop to claim!
          <div v-for="token in redeemableEos" :key="token">
            {{token}} <b-button @click="redeemTokenEos(token)">Claim</b-button>
          </div>
        </div>
        <div v-if="getAccountName.eos && !redeemableEos.length">
          No airdropped EOS tokens
        </div>
      </div>

      <div class="p-4 w-50">
        <h2>ETH</h2>

        <div v-if="!getAccountName.ethereum">
          <b-button @click="loginEthereum">Login to Metamask</b-button>
        </div>

        <div v-if="getAccountName.ethereum && redeemableEthereum.length">
          You have an airdrop to claim!
          <div v-for="row in redeemableEthereum" :key="row.ethswap_id">
            {{row.quantity}} <b-button @click="redeemTokenEthereum(row.ethswap_id)">Claim</b-button>
          </div>
        </div>
        <div v-if="getAccountName.ethereum && !redeemableEthereum.length">
          No airdropped ETH tokens
        </div>
      </div>
    </div>
  </q-page>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'RedeemPage',
  components: {},
  data () {
    return {
      redeemableEos: [],
      redeemableEthereum: []
    }
  },
  computed: {
    ...mapGetters({
      getAccountName: 'ual/getAccountName'
    })
  },
  methods: {
    async loadRedeemableEos () {
      // get redeemable tokens on eos
      if (this.getAccountName.eos) {
        const balanceRes = await this.$eos.rpc.get_currency_balance(process.env.redeemContractEos, this.getAccountName.eos)

        this.redeemableEos = balanceRes.filter(b => {
          const [amt] = b.split(' ')
          return (amt !== '0')
        })
      }
    },
    async loadRedeemableEthereum () {
      // get redeemable tokens on eos
      if (this.getAccountName.ethereum) {
        const key = this.getAccountName.ethereum.toLowerCase() + '0'.repeat(24)
        // console.log(key)
        const res = await this.$wax.rpc.get_table_rows({
          code: process.env.saleContract,
          scope: process.env.saleContract,
          table: 'ethswaps',
          key_type: 'i256',
          index_position: 3,
          lower_bound: key,
          upper_bound: key
        })
        console.log('key res', res)
        if (res.rows.length) {
          this.redeemableEthereum = res.rows.filter(r => !r.complete)
        }
      }
    },
    async redeemTokenEos (quantity) {
      if (!this.getAccountName.wax) {
        // make sure they are logged in, they will have to click the buy button again
        this.$store.dispatch('ual/renderLoginModal', 'wax', { root: true })
      }
      const actions = []
      actions.push({
        account: process.env.redeemContractEos,
        name: 'transfer',
        authorization: [{
          actor: this.getAccountName.eos,
          permission: 'active'
        }],
        data: {
          from: this.getAccountName.eos,
          to: process.env.redeemBurnEos,
          quantity,
          memo: this.getAccountName.wax
        }
      })

      try {
        await this.$store.dispatch('ual/transact', { actions, network: 'eos' })

        this.loadRedeemableEos()
      } catch (e) {
        this.$showError(e.message)
      }
    },
    async redeemTokenEthereum (id) {
      if (!this.getAccountName.wax) {
        // make sure they are logged in, they will have to click the buy button again
        this.$store.dispatch('ual/renderLoginModal', 'wax', { root: true })
      }
      // console.log('Redeem ETH')
      const { injectedWeb3, web3 } = await this.$web3()
      if (injectedWeb3) {
        // console.log('have web3')
        const ethAccount = await web3.eth.getAccounts()
        // console.log(ethAccount)
        const signature = await web3.eth.personal.sign(this.getAccountName.wax, ethAccount[0])
        // console.log(signature)
        const resp = await fetch(`${process.env.redeemServer}/redeem`, {
          method: 'POST',
          body: JSON.stringify({
            account: this.getAccountName.wax,
            signature,
            id
          })
        })
        const json = await resp.json()
        if (json.success) {
          this.$showSuccess('Redemption successful, the pack will be in your WAX account soon')
        } else {
          this.$showError(json.error)
        }
      } else {
        this.$showError('Could not load Web3, please make sure you are logged in and Metamask is set up correctly')
      }
    },
    async loginEos () {
      this.$store.dispatch('ual/renderLoginModal', 'eos', { root: true })
    },
    async loginEthereum () {
      const { injectedWeb3, web3 } = await this.$web3()
      // console.log(injectedWeb3, web3)

      if (injectedWeb3) {
        const ethAccount = await web3.eth.getAccounts()
        this.$store.commit('ual/setAccountName', { network: 'ethereum', accountName: ethAccount[0] })
      }
    }
  },
  async mounted () {
    this.loadRedeemableEos()
    this.loadRedeemableEthereum()
  },
  watch: {
    getAccountName (accountName) {
      if (accountName.eos) {
        this.loadRedeemableEos()
      }
      if (accountName.ethereum) {
        this.loadRedeemableEthereum()
      }
    }
  }
}
</script>
