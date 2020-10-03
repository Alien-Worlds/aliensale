<template>
  <div>
    <q-dialog v-model="showDialog" persistent transition-show="flip-down" transition-hide="flip-up">
      <q-card style="min-width:450px">
        <q-bar class="bg-secondary">
          <div>Payment Requested</div>
          <q-space />
          <q-btn
                  dense
                  flat
                  icon="close"
                  @click="closeModal"
          >
            <q-tooltip content-class="bg-secondary text-white">Close</q-tooltip>
          </q-btn>
        </q-bar>
        <q-card-section content-class="text-primary">
          <div v-if="paymentTransactionId">
            <p>Payment completed with transaction id:</p>
            <p class="text-bold">{{ paymentTransactionId }}</p>
            <p v-if="value.symbol !== 'WAX'">You must wait for the required number of confirmations before the packs are transferred to you</p>
          </div>
          <div v-if="value && value.amount > 0 && !paymentTransactionId">
            <p>Please pay the following amount</p>
            <p class="text-h6">{{ value.amount }} {{ value.symbol }}</p>
            <p>To : {{ value.to }}</p>
          </div>
        </q-card-section>
        <q-card-section>
          <b-button @click="sendPayment" class="bg-primary text-white" v-if="!paymentTransactionId">Pay</b-button>

          <b-button-toolbar key-nav aria-label="Toolbar with button groups">
            <b-button-group class="mx-1">
              <b-button @click="closeModal" class="bg-primary text-white" v-if="paymentTransactionId">Close</b-button>
            </b-button-group>
            <b-button-group class="mx-1">
              <b-button @click="closeModal" to="/open" class="bg-primary text-white" v-if="paymentTransactionId">Open Packs</b-button>
            </b-button-group>
          </b-button-toolbar>

        </q-card-section>
      </q-card>
    </q-dialog>
  </div>

</template>

<script>
import { mapGetters } from 'vuex'
import { BButton, BButtonGroup, BButtonToolbar } from 'bootstrap-vue'

export default {
  name: 'PaymentRequest',
  components: {
    'b-button': BButton,
    'b-button-group': BButtonGroup,
    'b-button-toolbar': BButtonToolbar
  },
  props: ['value'],
  computed: {
    ...mapGetters({
      getAccountName: 'ual/getAccountName'
    })
  },
  data () {
    return {
      showDialog: false,
      paymentTransactionId: null
    }
  },
  methods: {
    async sendPayment () {
      const val = this.value

      if (val.network === 'eos') {
        console.log('val changed', val)
        const actions = [{
          account: val.contract,
          name: 'transfer',
          authorization: [{
            actor: val.from,
            permission: 'active'
          }],
          data: {
            from: val.from,
            to: val.to,
            quantity: `${parseFloat(val.amount).toFixed(val.precision)} ${val.symbol}`,
            memo: val.memo
          }
        }]
        try {
          const resp = await this.$store.dispatch('ual/transact', { actions, network: val.network })
          console.log(resp)
          this.paymentTransactionId = resp.transactionId
        } catch (e) {
          this.$showError(e.message)
        }
      } else if (val.network === 'eth') {
        const { injectedWeb3, web3 } = await this.$web3()
        console.log(injectedWeb3, web3)

        if (injectedWeb3) {
          const ethAccount = await web3.eth.getAccounts()

          // console.log(`Buy with ETH ${ethAccount[0]} ${qty} ${pack}, current balance is ${ethAccount}`)
          const trxData = {
            from: ethAccount[0],
            to: val.to,
            value: val.amount * Math.pow(10, 18),
            data: ''
          }
          console.log(`Sending ${val.amount} ETH to ${val.to} from ${ethAccount[0]}`, trxData)

          web3.eth.sendTransaction(trxData, (err, transactionHash) => {
            if (!err) {
              console.log(transactionHash)
              this.paymentTransactionId = transactionHash
            }
          })
        }
      }

      // this.showDialog = false
    },
    closeModal () {
      this.showDialog = false
      this.paymentTransactionId = null
    }
  },
  watch: {
    value (v) {
      this.value = v
      if (v) {
        this.showDialog = true
      } else {
        this.showDialog = false
      }
    }
  },
  async mounted () {

  }
}
</script>
