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
          </div>
          <div v-if="value && value.amount > 0 && !paymentTransactionId">
            <p>Please pay the following amount</p>
            <p class="text-h6">{{ value.amount }} {{ value.symbol }}</p>
            <p>To : {{ value.to }}</p>
          </div>
        </q-card-section>
        <q-card-section>
          <q-btn @click="sendPayment" label="Pay" class="bg-primary text-white" v-if="!paymentTransactionId" />
          <q-btn @click="closeModal" label="Close" class="bg-primary text-white" v-if="paymentTransactionId" />
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>

</template>

<script>
import { mapGetters } from 'vuex'
import Web3 from 'web3'

export default {
  name: 'PaymentRequest',
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
        const resp = await this.$store.dispatch('ual/transact', { actions, network: val.network })
        console.log(resp)
        this.paymentTransactionId = resp.transactionId
      } else if (val.network === 'eth') {
        const { injectedWeb3, web3 } = await this.getWeb3()
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
    async getWeb3 () {
      // Check for injected web3 (mist/metamask)
      var web3js = window.web3
      if (typeof web3js !== 'undefined') {
        var web3 = new Web3(web3js.currentProvider)
        await window.ethereum.enable()
        // console.log(web3)
        return {
          injectedWeb3: await web3.eth.net.isListening(),
          web3
        }
      } else {
        // web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:7545')) GANACHE FALLBACK
        throw new Error('Unable to connect to Metamask')
      }
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
