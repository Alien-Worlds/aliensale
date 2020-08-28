<template>
  <q-page class="">
      <div class="row justify-center text-h1">
        Buy Packs
      </div>

      <div class="row justify-center">
        <div v-if="!showBuyForm">
          <div v-for="pack in packs" :key="pack.symbol">
            <div class="row" v-if="balances[pack.symbol]">
              <div class="col-6">{{ pack.metadata.name }}</div>
              <div class="col-4">{{ pack.quote_price.quantity }}</div>
              <div class="col-2"><b-button label="Buy" @click="showBuy(pack)">Buy</b-button> ({{ balances[pack.symbol] }} left)</div>
            </div>
            <div class="row text-red" v-else style="text-decoration: line-through">
              <div class="col-6">{{ pack.metadata.name }}</div>
              <div class="col-4">{{ pack.quote_price.quantity }}</div>
              <div class="col-2">Sold out!</div>
            </div>
          </div>
        </div>
        <div v-if="!packs.length">
          No packs are available for sale at the moment
        </div>
      </div>

    <div v-if="showBuyForm" class="q-pa-md">
      <div class="row justify-center mb-4">
        <div class="row justify-center">
          Quantity
          <b-form-input  type="number" v-model="buyQty" step="1" min="1" :max="maxBuy"></b-form-input>
        </div>
      </div>

      <div class="row justify-center">

        <b-button-toolbar key-nav>
          <b-button-group class="mx-1">
            <b-button @click="hideBuyForm()" label="back">Back</b-button>
          </b-button-group>
          <b-button-group class="mx-1">
            <div v-for="(sale_symbol, index) in buyPack.sale_symbols" :key="sale_symbol.symbol.split(',')[1]">
              <b-button @click="startBuy(index)">Buy with {{sale_symbol.symbol.split(',')[1]}}</b-button>
            </div>
          </b-button-group>
        </b-button-toolbar>

      </div>
    </div>

    <payment-request v-model="paymentRequest"></payment-request>

  </q-page>
</template>

<script>
import { mapGetters } from 'vuex'
import PaymentRequest from 'components/PaymentRequest'
import { BButton, BFormInput, BButtonGroup, BButtonToolbar } from 'bootstrap-vue'
let intervalId

export default {
  name: 'BuyPage',
  components: {
    'payment-request': PaymentRequest,
    'b-button': BButton,
    'b-button-group': BButtonGroup,
    'b-button-toolbar': BButtonToolbar,
    'b-form-input': BFormInput
  },
  data () {
    return {
      packs: this.$packs,
      balances: {},
      showBuyForm: false,
      buyPack: '',
      buyQty: 1,
      paymentRequest: null
    }
  },
  computed: {
    ...mapGetters({
      getAccountName: 'ual/getAccountName'
    }),
    maxBuy () {
      let max = 25
      if (this.buySymbol && this.balances[this.buySymbol] < 25) {
        max = this.balances[this.buySymbol]
      }
      return max
    }
  },
  methods: {
    async reloadPacks () {
      const res = await this.$wax.rpc.get_table_rows({ code: 'sale.worlds', scope: 'sale.worlds', table: 'packs' })
      const balancesRes = await this.$wax.rpc.get_currency_balance('pack.worlds', 'sale.worlds')
      const balances = {}
      for (let i = 0; i < balancesRes.length; i++) {
        const [b, s] = balancesRes[i].split(' ')
        balances[s] = parseInt(b)
      }
      this.balances = balances

      const packs = res.rows.map((p) => {
        p.metadata = JSON.parse(p.metadata)
        const [, sym] = p.pack_asset.quantity.split(' ')
        p.symbol = sym
        return p
      }).filter(p => p.allow_sale)

      this.packs = packs
      console.log('packs', packs)
    },
    showBuy (pack) {
      // console.log(pack)
      this.showBuyForm = true
      this.buyPack = pack
    },
    hideBuyForm () {
      this.showBuyForm = false
    },
    async createSale (account, qty, pack, saleSymbol) {
      console.log('createSale', account, qty, pack, saleSymbol)
      const foreignChain = saleSymbol.chain
      // creates the sale on wax and returns the details
      // void createsale(name native_address, vector<extended_asset> items, name foreign_chain, extended_symbol settlement_currency);
      const actions = [{
        account: 'sale.worlds',
        name: 'createsale',
        authorization: [{
          actor: account,
          permission: 'active'
        }],
        data: {
          native_address: account,
          items: [{ contract: 'pack.worlds', quantity: `${qty} ${pack.symbol}` }],
          foreign_chain: foreignChain,
          settlement_currency: { contract: saleSymbol.contract, sym: saleSymbol.symbol }
        }
      }]
      console.log('createsale actions', actions)
      const createResp = await this.$store.dispatch('ual/transact', { actions, network: 'wax' })
      // console.log(createResp)
      if (createResp.status === 'executed' && createResp.wasBroadcast) {
        const logData = createResp.transaction.processed.action_traces[0].inline_traces[0].act.data
        // console.log('create data', logData)

        return logData
      }

      return null
    },
    async buyWax (account, nativeAmount, qty, pack) {
      console.log('buyWax', account, nativeAmount, qty, pack)
      const actions = [{
        account: 'eosio.token',
        name: 'transfer',
        authorization: [{
          actor: account,
          permission: 'active'
        }],
        data: {
          from: account,
          to: 'sale.worlds',
          quantity: `${nativeAmount.toFixed(8)} WAX`,
          memo: ''
        }
      }, {
        account: 'sale.worlds',
        name: 'buy',
        authorization: [{
          actor: account,
          permission: 'active'
        }],
        data: {
          buyer: account,
          pack_id: pack.pack_id,
          qty
        }
      }]
      const resp = await this.$store.dispatch('ual/transact', { actions, network: 'wax' })
      // console.log(resp)
      return resp
    },
    async buyEos (accounts, qty, pack, foreignSym) {
      if (!this.getAccountName.eos) {
        // make sure they are logged in, they will have to click the buy button again
        this.$store.dispatch('ual/renderLoginModal', 'eos', { root: true })
        return
      }

      // create the sale on wax
      // let resp = null
      console.log('create sale for pack', pack)
      const saleSymbol = pack.sale_symbols.filter(s => {
        const re = new RegExp(`,${foreignSym}$`)
        return re.test(s.symbol)
      })[0]
      console.log('saleSymbol', saleSymbol)
      const logData = await this.createSale(accounts.wax, qty, pack, saleSymbol)
      console.log('sale log', logData)
      if (logData.foreign_address && logData.foreign_price && logData.sale_id) {
        // log into eos if not already and send the eos payment

        const [precisionStr, symbol] = logData.settlement_currency.sym.split(',')
        const precision = parseInt(precisionStr)

        const nativeAmount = (logData.foreign_price / Math.pow(10, precision)).toFixed(precision)

        this.paymentRequest = {
          network: 'eos',
          amount: nativeAmount,
          contract: logData.settlement_currency.contract,
          symbol,
          precision,
          from: accounts.eos,
          to: 'alienworlds1',
          memo: logData.foreign_address
        }
      } else {
        console.error('Failed to fetch sale data', logData)
      }
      // return resp
    },
    async buyEth (account, qty, pack) {
      const saleSymbol = pack.sale_symbols.filter(s => s.symbol === '18,ETH')[0]
      const logData = await this.createSale(account, qty, pack, saleSymbol)

      if (logData.foreign_address && logData.foreign_price && logData.sale_id) {
        const nativeAmount = (logData.foreign_price / Math.pow(10, 18))

        this.paymentRequest = {
          network: 'eth',
          amount: nativeAmount,
          symbol: 'ETH',
          precision: 18,
          to: logData.foreign_address,
          memo: ''
        }
      }
    },
    async startBuy (saleIndex) {
      const pack = this.buyPack

      const [priceStr] = pack.quote_price.quantity.split(' ')
      const price = parseFloat(priceStr)
      const payAmount = price * this.buyQty

      const currency = pack.sale_symbols[saleIndex].symbol.split(',')[1]

      console.log('startBuy', currency)

      switch (currency) {
        case 'WAX':
          await this.buyWax(this.getAccountName.wax, payAmount, this.buyQty, pack)
          break
        case 'ETH':
          await this.buyEth(this.getAccountName.wax, this.buyQty, pack)
          break
        default:
          await this.buyEos(this.getAccountName, this.buyQty, pack, currency)
          break
      }
    }
  },
  async mounted () {
    intervalId = window.setInterval(this.reloadPacks, 5000)
    this.reloadPacks()
  },
  async beforeDestroy () {
    if (intervalId) {
      console.log('clearing interval')
      window.clearInterval(intervalId)
      intervalId = null
    }
  }
}
</script>
