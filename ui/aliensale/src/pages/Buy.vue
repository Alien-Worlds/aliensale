<template>
  <q-page class="">
      <div class="row justify-center text-h1">
        Pack Auction
      </div>

      <div class="row justify-center">
        <div class="w-75">
          <div v-for="auction in auctions" :key="auction.auction_id" style="padding:20px 0;border-bottom: 2px solid silver">
            <div class="row" v-if="auction.amount">
              <div class="col-2">
                <img :src="'https://ipfs.io/ipfs/' + auction.pack_data.metadata.img" style="max-width:100px" />
              </div>
              <div class="col-6">
                <p>{{ auction.pack_data.metadata.name }}</p>
              </div>

              <div class="col-4" v-if="!auction.in_rest && auction.has_started">
                <p>Current Price : {{ auction.current_price }}</p>
                <p>Next Price : {{ auction.next_price }}</p>

                <div class="row">
                  <div class="col-4">Quantity</div>
                  <div class="col-4"><b-form-input value="1" type="number" :id="'buyQty' + auction.auction_id" step="1" min="1" :max="auction.amount"></b-form-input></div>
                  <div class="col-4"><b-button label="Buy" @click="startBuy(auction)">Buy</b-button> </div>
                </div>
                <p>({{ auction.amount }} left)</p>
              </div>
              <div class="col-4" v-if="auction.in_rest && auction.has_started">Auction is resting, next price will be {{ auction.next_price }}</div>
              <div class="col-4" v-if="!auction.has_started">Auction has not started yet</div>

              <!-- <div class="col-4">{{ pack.quote_price.quantity }}</div>-->
            </div>
            <div class="row text-red" v-else style="text-decoration: line-through">
              <div class="col-2">
                <img :src="'https://ipfs.io/ipfs/' + auction.pack_data.metadata.img" style="max-width:100px" />
              </div>
              <div class="col-6">{{ auction.pack_data.metadata.name }}</div>
              <div class="col-4">Sold out!</div>
            </div>
          </div>
        </div>
        <div v-if="!auctions.length">
          No packs are available for sale at the moment
        </div>
      </div>

    <!-- <div v-if="showBuyForm" class="q-pa-md">
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
    </div> -->

    <payment-request v-model="paymentRequest"></payment-request>

  </q-page>
</template>

<script>
import { mapGetters } from 'vuex'
import PaymentRequest from 'components/PaymentRequest'
import { BButton, BFormInput /* , BButtonGroup, BButtonToolbar */ } from 'bootstrap-vue'
import { Serialize } from 'eosjs'
let intervalId

export default {
  name: 'BuyPage',
  components: {
    'payment-request': PaymentRequest,
    'b-button': BButton,
    // 'b-button-group': BButtonGroup,
    // 'b-button-toolbar': BButtonToolbar,
    'b-form-input': BFormInput
  },
  data () {
    return {
      packs: this.$packs,
      auctions: [],
      balances: {},
      buyPack: '',
      buyQty: [],
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
    async getPack (packData) {
      const sb = new Serialize.SerialBuffer({ textEncoder: new TextEncoder(), textDecoder: new TextDecoder() })
      // console.log(packData)
      sb.pushName(packData.contract)
      sb.pushSymbolCode(packData.symbol)

      // reverse byte ordering for chain query
      const reversedArray = new Uint8Array(16)
      reversedArray.set(sb.array.slice(0, 8).reverse())
      reversedArray.set(sb.array.slice(8, 16).reverse(), 8)
      const hexIndex = Buffer.from(reversedArray).toString('hex')
      const key = '0x' + hexIndex

      const res = await this.$wax.rpc.get_table_rows({ code: 'sale.worlds', scope: 'sale.worlds', table: 'packs', key_type: 'i128', index_position: 2, lower_bound: key, upper_bound: key })
      if (res.rows.length) {
        return res.rows[0]
      }
      return null
    },
    currentPeriod (auctionData) {
      // console.log('getting current price ', auctionData)
      const offset = (new Date()).getTimezoneOffset() * 60 * 1000
      const now = parseInt((new Date().getTime() + offset) / 1000)
      const auctionStart = Date.parse(auctionData.start_time.replace(/\.[05]00$/, '')) / 1000
      const timeIntoSale = now - auctionStart
      // console.log(new Date(now * 1000), new Date(auctionStart * 1000), timeIntoSale)

      const cycleLength = auctionData.period_length + auctionData.break_length
      const remainder = timeIntoSale % cycleLength
      let periodNumber = (timeIntoSale - remainder) / cycleLength
      if (periodNumber > auctionData.period_count) {
        periodNumber = auctionData.period_count
      }

      return periodNumber
    },
    currentPrice (auctionData) {
      const periodNumber = this.currentPeriod(auctionData)

      const startPrice = parseInt(auctionData.start_price)
      const stepPrice = auctionData.price_step
      const priceSats = startPrice - (stepPrice * periodNumber)
      const price = priceSats / Math.pow(10, auctionData.price_symbol.precision)

      return `${price} ${auctionData.price_symbol.symbol}`
    },
    currentPriceStrict (auctionData, quantity) {
      // DSame as currentPrice but makes sure precision is correct for transfer action
      const [amountStr, sym] = this.currentPrice(auctionData).split(' ')
      const amount = parseFloat(amountStr) * quantity

      return `${amount.toFixed(auctionData.price_symbol.precision)} ${sym}`
    },
    nextPrice (auctionData) {
      const periodNumber = this.currentPeriod(auctionData) + 1
      if (periodNumber > auctionData.period_count) {
        return this.currentPrice(auctionData)
      }

      const startPrice = parseInt(auctionData.start_price)
      const stepPrice = auctionData.price_step

      const priceSats = startPrice - (stepPrice * periodNumber)
      const price = priceSats / Math.pow(10, auctionData.price_symbol.precision)

      return `${price} ${auctionData.price_symbol.symbol}`
    },
    inRestPeriod (auctionData) {
      const offset = (new Date()).getTimezoneOffset() * 60 * 1000
      const periodNumber = this.currentPeriod(auctionData)
      const now = parseInt((new Date().getTime() + offset) / 1000)
      const auctionStart = Date.parse(auctionData.start_time.replace(/\.[05]00$/, '')) / 1000
      const timeIntoSale = now - auctionStart
      // console.log(now, auctionStart, timeIntoSale)

      const cycleLength = auctionData.period_length + auctionData.break_length
      const remainder = timeIntoSale % cycleLength

      return (remainder > auctionData.period_length && periodNumber < auctionData.period_count)
    },
    hasStarted (auctionData) {
      const offset = (new Date()).getTimezoneOffset() * 60 * 1000
      const now = parseInt((new Date().getTime() + offset) / 1000)
      const auctionStart = Date.parse(auctionData.start_time.replace(/\.[05]00$/, '')) / 1000
      const timeIntoSale = now - auctionStart

      return (timeIntoSale >= 0)
    },
    async reloadAuctions () {
      const res = await this.$wax.rpc.get_table_rows({ code: 'sale.worlds', scope: 'sale.worlds', table: 'auctions' })

      const auctions = res.rows.map((a) => {
        const [amount, sym] = a.pack.quantity.split(' ')
        a.amount = parseInt(amount)
        a.sym = sym
        const [pPrecision, pSym] = a.price_symbol.symbol.split(',')
        a.price_symbol.precision = parseInt(pPrecision)
        a.price_symbol.symbol = pSym
        return a
      })

      for (let a = 0; a < auctions.length; a++) {
        const pd = await this.getPack({ contract: 'pack.worlds', symbol: auctions[a].sym })
        pd.metadata = JSON.parse(pd.metadata)
        delete pd.pack_asset
        auctions[a].pack_data = pd

        auctions[a].current_price = this.currentPrice(auctions[a])
        auctions[a].next_price = this.nextPrice(auctions[a])
        auctions[a].in_rest = this.inRestPeriod(auctions[a])
        auctions[a].has_started = this.hasStarted(auctions[a])
      }

      this.auctions = auctions
      // console.log('auctions', this.auctions)
    },
    async createSale (account, qty, auction) {
      console.log('createSale', account, qty, auction)
      // creates the sale on wax and returns the details
      const actions = [{
        account: 'sale.worlds',
        name: 'newinvoice',
        authorization: [{
          actor: account,
          permission: 'active'
        }],
        data: {
          native_address: account,
          auction_id: auction.auction_id,
          qty
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
    async buyWax (account, qty, auction) {
      console.log('buyWax', account, qty, auction)
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
          quantity: this.currentPriceStrict(auction, qty),
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
          auction_id: auction.auction_id,
          qty
        }
      }]
      // console.log(actions)
      const resp = await this.$store.dispatch('ual/transact', { actions, network: 'wax' })
      // console.log(resp)
      return resp
    },
    async buyEos (accounts, qty, auction) {
      if (!this.getAccountName.eos) {
        // make sure they are logged in, they will have to click the buy button again
        this.$store.dispatch('ual/renderLoginModal', 'eos', { root: true })
      }

      // create the sale on wax
      const logData = await this.createSale(accounts.wax, qty, auction)
      if (logData.foreign_address && logData.foreign_price && logData.invoice_id) {
        // log into eos if not already and send the eos payment
        console.log(auction, logData)

        const [precisionStr, symbol] = logData.settlement_currency.symbol.split(',')
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
      }
    },
    async buyEth (account, qty, auction) {
      // const saleSymbol = pack.sale_symbols.filter(s => s.symbol === '18,ETH')[0]
      const logData = await this.createSale(account, qty, auction)
      // console.log(logData)

      if (logData.foreign_address && logData.foreign_price && logData.invoice_id) {
        const nativeAmount = (logData.foreign_price / Math.pow(10, 18))

        this.paymentRequest = {
          network: 'eth',
          amount: nativeAmount,
          symbol: 'ETH',
          precision: 18,
          to: logData.foreign_address,
          memo: ''
        }
      } else {
        alert('Invalid log data :/')
      }
    },
    async startBuy (auctionData) {
      console.log(auctionData)
      const buyQtyEle = document.getElementById(`buyQty${auctionData.auction_id}`)
      if (!buyQtyEle) {
        alert('Could not get quantity')
      }
      let buyQty = parseInt(buyQtyEle.value)
      if (isNaN(buyQty)) {
        buyQty = 1
      }

      console.log(`Buying ${buyQty} of ${auctionData.pack_data.metadata.name}`)

      const currency = auctionData.price_symbol.symbol

      switch (currency) {
        case 'WAX':
          await this.buyWax(this.getAccountName.wax, buyQty, auctionData)
          break
        case 'ETH':
          await this.buyEth(this.getAccountName.wax, buyQty, auctionData)
          break
        default:
          await this.buyEos(this.getAccountName, buyQty, auctionData)
          break
      }
    }
  },
  async mounted () {
    intervalId = window.setInterval(this.reloadAuctions, 5000)
    this.reloadAuctions()
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
