<template>
  <q-page class="planet-bg-page buy-page">
      <div class="row justify-center">
        <div class="w-75 sizer">
          <div v-if="showLoginModal && !getAccountName.wax">
            <login-wax />
          </div>
          <div v-else>
            <div class="row justify-center text-h1 main-title">
              {{ auction.pack_data.metadata.name }}
            </div>
            <div class="row">
              <div id="full-row" class="row text-center">
                <div class="col-md-1 unbox">
                </div>
                <div class="col-md-3">

                  <img  :src="ipfsRoot + auction.pack_data.metadata.img" class="img-fluid b-lazy pack b-loaded pack-img" alt="Pack">

                </div>
                <div class="col-lg-1 unbox"></div>
                <div class="col-lg-3 unbox2">

                  <h2 class="highlight" v-if="auction.amount">
                    <div class="colored">{{ auction.amount }} Packs remaining</div>
                  </h2>

                  <h2>{{ auction.pack_data.number_cards }} Items</h2>

                  <div id="description" v-html="auction.pack_data.metadata.description"></div>

                </div>
                <div class="col-lg-1 unbox">
                </div>
                <div class="col-lg-3 unbox2">
                  <div v-if="auction.has_started && auction.amount > 0">
                    <country-select ref="country" @selected="startBuy" />

                    <h2 class="highlight">
                      <span class="colored">
                        Current price <div class="price">{{ auction.current_price }}</div>
                      </span>
                    </h2>

                    <qty-control v-model="buyQty" :max="auction.amount" />

                    <p class="buy-control"><button type="Buy" class="button" style="display:inline;" @click="preBuy">Buy Now</button></p>

                    <div v-if="auction.current_period < auction.period_count">
                      <h2 class="highlight">
<!--                        {{auction.start_time}}-->
                        <span>Price drop in <countdown :start="parseDate(auction.start_time)" :period="auction.period_length" :cooldown="auction.break_length" v-on:finished="finishedPeriod()" v-on:cooldown="finishedPeriod()" /></span>
                      </h2>
                      Next price <div class="next-price highlight">{{ auction.next_price }}</div>
                    </div>
                    <div v-else>
                      Lowest price reached
                    </div>
                  </div>
                  <div v-else-if="!auction.has_started">
                    <h2 class="colored">Sale starts in : <start-countdown :start="parseDate(auction.start_time)" /></h2>
                  </div>
                  <div v-if="!auction.amount" class="sold-out">
                    Sold Out!
                  </div>

                  <div>
                    <pre-order :auction-data="auction" :accounts="getAccountName" />
                  </div>

                  <div class="col-lg-1 unbox"></div>

                </div>

              </div>

            </div>

          </div>
        </div>
      </div>

    <payment-request v-model="paymentRequest"></payment-request>

  </q-page>
</template>

<style>
  .main-title {
    padding-bottom: 30px;
    font-size: 4rem;
  }
  h2 {
    font-size: 1.50rem;
    font-weight: 500;
  }
  .highlight {
    background: linear-gradient(167deg, rgba(23,22,21,0.6152836134453781) 9%, rgba(21,34,34,1) 100%, rgba(34,34,34,1) 100%);
    Border-color: #88aadd;
    color: #DDD;
    font-family: nasalization;
    display: block;
    height: auto;
    max-height: 1000px;
    width: auto;
    margin-left: auto;
    margin-right: auto;
    margin-top: 0px;
    margin-bottom: 40px;
    padding: 25px 5px 15px 5px;
    outline: none;
    transition: all 0.2s ease;
    cursor: pointer;
    border-radius: 15px;
    width: 100%;
    text-align: center;
  }
  .highlight::after {
    border-top: 2px solid;
    border-color: #E48632;
    content: "";
    display: block;
    height: 1px;
    width: 60px;
    margin: 13px auto 0 auto;
  }
  #description .highlight {
    margin-bottom: 0;
  }
  #description ul {
    margin-top: 2.4rem;
  }
  .small {
    font-size: 0.8rem;
  }
  .colored {
    color: #E48632;
  }
  .price {
    font-size: 2rem;
  }
  .next-price {
    font-size: 1.4rem;
  }
  .unbox2 {
    background-color: #111111;
    opacity: 0.9;
  }
  label {
    cursor: pointer;
  }
  .checkb {
    display: inline-block;
    height: 14px;
  }
  .short-hr-center::after {
    border-top: 2px solid;
    border-color: #E48632;
    content: "";
    display: block;
    height: 1px;
    width: 60px;
    margin: 13px auto 0 auto;
  }
  ul {
    list-style-type: none;
    padding: 0;
  }
  li.planet, #description li {
    text-align: left;
    background: url(/images/planet_icon.png) no-repeat left top;
    padding-left: 34px;
    padding-bottom: 2px;
    font-family: nasalization;
    font-size: 1.08rem;
  }
  .button {
    background: #E48632;
    border: none;
    color: #FFF;
    font-family: nasalization;
    font-weight: 500;
    display: block;
    height: auto;
    width: auto;
    margin-left: auto;
    margin-right: auto;
    margin-top: 20px;
    margin-bottom: 20px;
    padding: 5px 15px;
    outline: none;
    transition: all 0.2s ease;
    cursor: pointer;
    border-radius: 10px;
  }
  #buy-confirm-error {
    color: red;
  }
  .sold-out {
    color: red;
    text-decoration: line-through;
    font-size: 2rem;
  }
  #country {
    width: 100%;
    padding: 10px;
  }
</style>

<script>
import { mapGetters } from 'vuex'
import LoginWax from 'components/LoginWax'
import PaymentRequest from 'components/PaymentRequest'
import Countdown from 'components/Countdown'
import StartCountdown from 'components/StartCountdown'
import PreOrder from 'components/PreOrder'
import CountrySelect from 'components/CountrySelect'
import QtyControl from 'components/QtyControl'
import { Serialize } from 'eosjs'
let intervalId

export default {
  name: 'BuyPage',
  components: {
    'login-wax': LoginWax,
    'payment-request': PaymentRequest,
    countdown: Countdown,
    'start-countdown': StartCountdown,
    'pre-order': PreOrder,
    'country-select': CountrySelect,
    'qty-control': QtyControl
  },
  data () {
    return {
      packs: this.$packs,
      auction: null,
      balances: {},
      buyPack: '',
      buyQty: 1,
      paymentRequest: null,
      ipfsRoot: process.env.ipfsRoot,
      showLoginModal: false
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

      const res = await this.$wax.rpc.get_table_rows({
        code: process.env.saleContract,
        scope: process.env.saleContract,
        table: 'packs',
        key_type: 'i128',
        index_position: 2,
        lower_bound: key,
        upper_bound: key
      })
      if (res.rows.length) {
        return res.rows[0]
      }
      return null
    },
    parseDate (fullStr) {
      const [fullDate] = fullStr.split('.')
      const [dateStr, timeStr] = fullDate.split('T')
      const [year, month, day] = dateStr.split('-')
      const [hourStr, minuteStr, secondStr] = timeStr.split(':')

      const dt = new Date()
      dt.setUTCFullYear(year)
      dt.setUTCMonth(month - 1)
      dt.setUTCDate(day)
      dt.setUTCHours(hourStr)
      dt.setUTCMinutes(minuteStr)
      dt.setUTCSeconds(secondStr)

      return dt.getTime()
    },
    currentPeriod (auctionData) {
      const now = parseInt((new Date().getTime()) / 1000)

      const auctionStart = this.parseDate(auctionData.start_time.replace(/\.[05]00$/, '')) / 1000
      const timeIntoSale = now - auctionStart

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
      // console.log(`Start prioce ${startPrice}`)
      const stepPrice = auctionData.price_step
      const firstStepPrice = auctionData.first_step
      let priceSats = startPrice
      if (periodNumber >= 1) {
        priceSats -= firstStepPrice
        priceSats -= stepPrice * (periodNumber - 1)
      }
      const price = priceSats / Math.pow(10, auctionData.price_symbol.precision)
      // console.log(`startPrice ${startPrice}, stepPrice ${stepPrice}, firstStepPrice ${firstStepPrice}, priceSats ${priceSats}, price ${price}, periodNumber ${periodNumber}`)

      return `${price} ${auctionData.price_symbol.symbol}`
    },
    currentPriceStrict (auctionData, quantity) {
      // Same as currentPrice but makes sure precision is correct for transfer action
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
      const firstStepPrice = auctionData.first_step
      const stepPrice = auctionData.price_step
      console.log(`first step price = ${firstStepPrice}, this period = ${periodNumber}`)

      let priceSats = startPrice
      if (periodNumber >= 1) {
        priceSats -= firstStepPrice
        priceSats -= stepPrice * (periodNumber - 1)
      }
      const price = priceSats / Math.pow(10, auctionData.price_symbol.precision)

      return `${price} ${auctionData.price_symbol.symbol}`
    },
    inRestPeriod (auctionData) {
      const offset = (new Date()).getTimezoneOffset() * 60 * 1000
      const periodNumber = this.currentPeriod(auctionData)
      const now = parseInt((new Date().getTime() + offset) / 1000)
      const auctionStart = this.parseDate(auctionData.start_time.replace(/\.[05]00$/, '')) / 1000
      const timeIntoSale = now - auctionStart
      // console.log(now, auctionStart, timeIntoSale)

      const cycleLength = auctionData.period_length + auctionData.break_length
      const remainder = timeIntoSale % cycleLength

      return (remainder > auctionData.period_length && periodNumber < auctionData.period_count)
    },
    hasStarted (auctionData) {
      const now = parseInt((new Date().getTime()) / 1000)
      const auctionStart = this.parseDate(auctionData.start_time.replace(/\.[05]00$/, '')) / 1000
      const timeIntoSale = now - auctionStart

      return (timeIntoSale >= 0)
    },
    async loadAuction () {
      const auctionId = this.$route.params.auction_id
      const res = await this.$wax.rpc.get_table_rows({
        code: process.env.saleContract,
        scope: process.env.saleContract,
        table: 'auctions',
        lower_bound: auctionId,
        upper_bound: auctionId
      })

      if (!res.rows.length) {
        this.$showError('Auction not found')
        return
      }

      const auctionData = res.rows[0]
      const [amount, sym] = auctionData.pack.quantity.split(' ')
      auctionData.amount = parseInt(amount)
      auctionData.sym = sym
      const [pPrecision, pSym] = auctionData.price_symbol.symbol.split(',')
      auctionData.price_symbol.precision = parseInt(pPrecision)
      auctionData.price_symbol.symbol = pSym

      const pd = await this.getPack({ contract: process.env.packContract, symbol: auctionData.sym })
      pd.metadata = JSON.parse(pd.metadata)
      delete pd.pack_asset
      auctionData.pack_data = pd

      auctionData.current_price = this.currentPrice(auctionData)
      auctionData.current_period = this.currentPeriod(auctionData)
      auctionData.next_price = this.nextPrice(auctionData)
      auctionData.in_rest = this.inRestPeriod(auctionData)
      auctionData.has_started = this.hasStarted(auctionData)

      // auctionData.periods = this.periodData(auctionData)
      // console.log('auctions', this.auctions)

      // this.periodPrices = auctionData.periods.map(p => { return { value: p.period, text: `Period ${p.period + 1} - ${p.price_formatted}` } })
      this.auction = auctionData
    },
    async createSale (account, qty, auction, country) {
      console.log('createSale', account, qty, auction, country)
      // creates the sale on wax and returns the details
      const actions = [{
        account: process.env.saleContract,
        name: 'newinvoice',
        authorization: [{
          actor: account,
          permission: 'active'
        }],
        data: {
          native_address: account,
          auction_id: auction.auction_id,
          qty,
          referrer: this.$referrer
        }
      }]

      let retVal = null

      try {
        console.log('createsale actions', actions)
        const createResp = await this.$store.dispatch('ual/transact', { actions, network: 'wax' })
        if (createResp.status === 'executed') {
          const txId = createResp.transactionId || createResp.transaction_id
          const logData = createResp.transaction.processed.action_traces[0].inline_traces[0].act.data
          // console.log('create data', logData)

          logData.transaction_id = txId
          // register the sale on our server
          this.logSale(country, txId)
          retVal = logData
        }
      } catch (e) {
        this.$showError(e.message)
      }

      return retVal
    },
    async logSale (country, txId) {
      try {
        const saleRes = await fetch(`${process.env.saleServer}/sale`, {
          method: 'POST',
          body: JSON.stringify({ country, txId })
        })
        const saleResJson = await saleRes.json()
        if (!saleResJson.success) {
          throw new Error(`Failed to confirm sale - ${saleResJson.error}`)
        }
        console.log(saleResJson)
      } catch (e) {
        setTimeout(() => {
          this.logSale(country, txId)
        }, 2000)
      }
    },
    async buyWax (account, qty, auction, country) {
      console.log('buyWax', account, qty, auction, country)
      const actions = [{
        account: 'eosio.token',
        name: 'transfer',
        authorization: [{
          actor: account,
          permission: 'active'
        }],
        data: {
          from: account,
          to: process.env.saleContract,
          quantity: this.currentPriceStrict(auction, qty),
          memo: ''
        }
      }, {
        account: process.env.saleContract,
        name: 'buy',
        authorization: [{
          actor: account,
          permission: 'active'
        }],
        data: {
          buyer: account,
          auction_id: auction.auction_id,
          qty,
          referrer: this.$referrer
        }
      }]
      // console.log(actions)
      let resp = null
      try {
        // const options = { broadcast: false }
        resp = await this.$store.dispatch('ual/transact', { actions, network: 'wax' })
        // console.log(resp)

        const txId = resp.transactionId || resp.transaction_id

        // register the sale on our server
        this.logSale(country, txId)

        this.$showSuccess('Your pack has been purchased successfully, please wait a few moments and it will appear in your inventory')
      } catch (e) {
        this.$showError(e.message)
      }

      // console.log(resp)
      return resp
    },
    async buyEos (accounts, qty, auction, country) {
      if (!this.getAccountName.eos) {
        // make sure they are logged in, they will have to click the buy button again
        this.$store.dispatch('ual/renderLoginModal', 'eos', { root: true })
      }

      // create the sale on wax
      const logData = await this.createSale(accounts.wax, qty, auction, country)
      if (logData.foreign_address && logData.foreign_price && typeof logData.invoice_id !== 'undefined') {
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
          to: process.env.redeemBurnEos,
          memo: logData.foreign_address
        }
      }
    },
    async buyEth (account, qty, auction, country) {
      // const saleSymbol = pack.sale_symbols.filter(s => s.symbol === '18,ETH')[0]
      const logData = await this.createSale(account, qty, auction, country)
      console.log('sale log data', logData)

      if (logData.foreign_address && logData.foreign_price && typeof logData.invoice_id !== 'undefined') {
        const nativeAmount = (logData.foreign_price / Math.pow(10, 18))

        this.paymentRequest = {
          network: 'ethereum',
          amount: nativeAmount,
          symbol: 'ETH',
          precision: 18,
          to: logData.foreign_address,
          memo: ''
        }
      } else {
        this.$showError('Invalid log data :/')
      }
    },
    preBuy () {
      this.$refs.country.show(this.auction)
    },
    async startBuy (country) {
      if (!this.getAccountName.wax) {
        this.showLoginModal = true
        return
      }
      console.log('start buy')
      const auctionData = this.auction
      const buyQty = this.buyQty

      console.log(`Buying ${buyQty} of ${auctionData.pack_data.metadata.name} from account ${this.getAccountName.wax}`)

      const currency = auctionData.price_symbol.symbol

      switch (currency) {
        case 'WAX':
          await this.buyWax(this.getAccountName.wax, buyQty, auctionData, country)
          break
        case 'ETH':
          await this.buyEth(this.getAccountName.wax, buyQty, auctionData, country)
          break
        default:
          await this.buyEos(this.getAccountName, buyQty, auctionData, country)
          break
      }
    },
    finishedPeriod () {
      // console.log('Finished period!!')
      this.loadAuction()
    }
  },
  async mounted () {
    intervalId = window.setInterval(this.loadAuction, 5000)
    this.loadAuction()
  },
  watch: {
    $route: function () {
      this.loadAuction()
    }
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
