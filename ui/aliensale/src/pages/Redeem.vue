<template>
  <q-page class="full-width column wrap justify-start content-center">
    <div>
      <div class="text-h1">Redeem Vouchers</div>

      <div>
        EOS
        <div v-if="!getAccountName.eos">
          <b-button @click="loginEos">Log into EOS</b-button>
        </div>
        <div v-if="!getAccountName.wax">
          <b-button @click="loginWax">Log into WAX</b-button>
        </div>
        <div v-if="getAccountName.eos && redeemable.length">
          You have redeemable tokens!
          <div v-for="token in redeemable" :key="token">
            {{token}} <b-button @click="redeemToken(token)">Redeem</b-button>
          </div>
        </div>
        <div v-if="getAccountName.eos && !redeemable.length">
          No redeemable EOS tokens
        </div>
      </div>

      <div>
        ETH

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
      redeemable: []
    }
  },
  computed: {
    ...mapGetters({
      getAccountName: 'ual/getAccountName'
    })
  },
  methods: {
    async loadRedeemable () {
      // get redeemable tokens on eos
      if (this.getAccountName.eos) {
        const balanceRes = await this.$eos.rpc.get_currency_balance(this.$config.redeemContractEos, this.getAccountName.eos)

        this.redeemable = balanceRes.filter(b => {
          const [amt] = b.split(' ')
          return (amt !== '0')
        })
      }
    },
    async redeemToken (quantity) {
      const actions = []
      actions.push({
        account: this.$config.redeemContractEos,
        name: 'transfer',
        authorization: [{
          actor: this.getAccountName.eos,
          permission: 'active'
        }],
        data: {
          from: this.getAccountName.eos,
          to: this.$config.redeemBurnEos,
          quantity,
          memo: this.getAccountName.wax
        }
      })

      await this.$store.dispatch('ual/transact', { actions, network: 'eos' })

      this.loadRedeemable()
    },
    async loginEos () {
      this.$store.dispatch('ual/renderLoginModal', 'eos', { root: true })
    },
    async loginWax () {
      this.$store.dispatch('ual/renderLoginModal', 'wax', { root: true })
    }
  },
  async mounted () {
    this.loadRedeemable()
  },
  watch: {
    getAccountName (accountName) {
      if (accountName.eos) {
        this.loadRedeemable()
      }
    }
  }
}
</script>
