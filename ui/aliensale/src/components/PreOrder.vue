<template>
  <div>

    <q-dialog v-model="showPreorderDialog" persistent transition-show="flip-down" transition-hide="flip-up">
      <q-card style="min-width:450px">

        <q-bar class="bg-secondary">
          <div>Edit Preorder</div>
          <q-space />
          <q-btn
            dense
            flat
            icon="close"
            @click="showPreorderDialog = false"
          >
            <q-tooltip content-class="bg-secondary text-white">Close</q-tooltip>
          </q-btn>
        </q-bar>
        <q-card-section>
          <b-form-select v-model="editPreorderPeriod" :options="periodPrices" />
          <qty-control v-model="editPreorderQty" />
          <div>
            Cost: {{editPreorderCost}}
          </div>
          <div v-if="editPreorder">
            Available: {{editPreorder.quantity}}
          </div>
        </q-card-section>

        <q-card-section>
          <b-button @click="doEditPreorder">Update Pre-Order</b-button>
        </q-card-section>
      </q-card>
    </q-dialog>

    <country-select ref="country" @selected="preBid" />
    <payment-request v-model="paymentRequest"></payment-request>

    <div v-if="!auctionData.has_started">
      <h3>Pre-Order</h3>
      <b-form-select v-model="preOrderPeriod" :options="periodPrices" />
      <qty-control v-model="qty" />
      <p class="buy-control"><button type="Buy" class="button" style="display:inline;" @click="startPreOrder">Pre-Order</button></p>
    </div>

    <div style="margin-bottom: 30px" v-if="myPreorders.length">
      <h4 class="highlight" style="margin-bottom:10px">My Pre-Orders</h4>
      <div v-for="preorder of myPreorders" v-bind:key="preorder.preorder_id">
        <div class="d-flex">
          <div class="p-1 flex-grow-1 bd-highlight">Period {{preorder.auction_period}}</div>
          <div class="p-1 flex-grow-1 bd-highlight">{{preorder.number_packs}} packs</div>
          <div class="p-1 flex-grow-1 bd-highlight">{{preorder.quantity}}</div>
          <div class="p-1 flex-grow-1 bd-highlight"><b-button><font-awesome-icon @click="startEditPreorder(preorder)" icon="edit"/></b-button></div>
        </div>
      </div>
    </div>
    <div style="margin-bottom: 30px" v-if="preordersTotal">
      <h4 class="highlight" style="margin-bottom:10px">Pre-Orders</h4>
      <div v-for="price of periodPrices" v-bind:key="price.value">
        <div v-if="preorders[price.value] > 0" class="d-flex">
          <div class="p-1 flex-grow-1 bd-highlight">{{price.text}}</div>
          <div class="p-1 flex-grow-1 bd-highlight">{{preorders[price.value]}}</div>
        </div>
      </div>
    </div>

    <p class="small" v-if="!auctionData.has_started">Packs can be pre-ordered, you will need to pay the full amount of your bid but this will be refunded if you are not successful</p>
    <p class="small" v-if="!auctionData.has_started">At the start of each auction period, the pre-orders from that period will be sold in the order that they were made</p>
    <p class="small" v-if="!auctionData.has_started">Any unsuccessful pre-orders will be refunded at the end of the auction, including partial refunds if pre-orders were modified or part-filled</p>
  </div>
</template>

<script>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { BFormSelect, BButton } from 'bootstrap-vue'
import QtyControl from 'components/QtyControl'
import CountrySelect from 'components/CountrySelect'
import PaymentRequest from 'components/PaymentRequest'
import { Serialize } from 'eosjs'

export default {
  name: 'PreOrder',
  components: {
    'font-awesome-icon': FontAwesomeIcon,
    'b-button': BButton,
    'b-form-select': BFormSelect,
    'payment-request': PaymentRequest,
    'qty-control': QtyControl,
    'country-select': CountrySelect
  },
  props: ['auction-data', 'accounts'],
  computed: {},
  data () {
    return {
      preorders: [],
      myPreorders: [],
      prordersTotal: 0,
      preOrderPeriod: null,
      periodPrices: null,
      qty: 1,
      paymentRequest: null,
      showPreorderDialog: false,
      editPreorder: null,
      editPreorderQty: 0,
      editPreorderPeriod: -1,
      editPreorderCost: 0
    }
  },
  methods: {
    periodData (auctionData) {
      // get all periods and prices for this auction
      const periods = []
      console.log('get periods', auctionData, periods)
      const precisionDivisor = Math.pow(10, auctionData.price_symbol.precision)
      let price = auctionData.start_price
      let period = 0
      periods[period] = {
        price: price,
        price_formatted: `${price / precisionDivisor} ${auctionData.price_symbol.symbol}`,
        period
      }

      price -= auctionData.first_step
      period++
      periods[period] = {
        price: price,
        price_formatted: `${price / precisionDivisor} ${auctionData.price_symbol.symbol}`,
        period
      }

      period++
      while (period < auctionData.period_count) {
        price -= auctionData.price_step
        periods[period] = {
          price: price,
          price_formatted: `${price / precisionDivisor} ${auctionData.price_symbol.symbol}`,
          period
        }
        period++
      }

      return periods
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
    async startPreOrder () {
      // console.log('start pre-bid ', this.qty, this.$refs.country)
      if (!this.accounts.wax) {
        // make sure they are logged in, they will have to click the buy button again
        this.$store.dispatch('ual/renderLoginModal', 'wax', { root: true })
        return
      }
      if (this.preOrderPeriod === null) {
        this.$showError('Please choose the period you would like to bid on')
        return
      }
      this.$refs.country.show(this.auctionData)
    },
    async preBid (country) {
      console.log('bidwax', this.preOrderPeriod, this.accounts.wax, this.qty, this.auctionData, country)
      const account = this.accounts.wax
      const auction = this.auctionData
      const qty = this.qty
      const actions = []
      console.log('AUCTION', auction)

      if (auction.price_symbol.chain === 'wax') {
        actions.push({
          account: 'eosio.token',
          name: 'transfer',
          authorization: [{
            actor: account,
            permission: 'active'
          }],
          data: {
            from: account,
            to: process.env.saleContract,
            quantity: this.priceStrict(auction, this.preOrderPeriod, qty),
            memo: ''
          }
        })
      }

      actions.push({
        account: process.env.saleContract,
        name: 'preorder',
        authorization: [{
          actor: account,
          permission: 'active'
        }],
        data: {
          buyer: account,
          auction_id: auction.auction_id,
          auction_period: this.preOrderPeriod,
          qty,
          referrer: this.$referrer
        }
      })

      let resp = null
      try {
        // const options = { broadcast: false }
        resp = await this.$store.dispatch('ual/transact', { actions, network: 'wax' })
        // console.log(resp)
        let log
        resp.transaction.processed.action_traces.forEach(at => {
          if (at.act.account === process.env.saleContract && at.act.name === 'preorder') {
            at.inline_traces.forEach(it => {
              if (it.act.account === process.env.saleContract && it.act.name === 'logpreorder') {
                log = it.act.data
              }
            })
          }
        })
        // console.log('Preorder log data', log)

        const txId = resp.transactionId || resp.transaction_id

        // register the sale on our server
        this.logSale(country, txId)

        if (auction.price_symbol.chain === 'wax') {
          this.$showSuccess('Your bid has been recorded, please wait until the auction starts')
        } else if (auction.price_symbol.chain === 'ethereum') {
          this.paymentRequest = {
            network: 'ethereum',
            amount: log.foreign_price / Math.pow(10, 18),
            symbol: 'ETH',
            precision: 18,
            to: log.foreign_address,
            memo: ''
          }
        } else if (auction.price_symbol.chain === 'eos') {
          this.paymentRequest = {
            network: 'eos',
            contract: auction.price_symbol.contract,
            amount: log.foreign_price / Math.pow(10, auction.price_symbol.precision),
            symbol: auction.price_symbol.symbol,
            precision: auction.price_symbol.precision,
            from: this.accounts.eos,
            to: process.env.redeemBurnEos,
            memo: log.foreign_address
          }
        }

        setTimeout(async () => {
          this.preorders = await this.getPreorders()
          this.myPreorders = await this.getMyPreorders()
        }, 1000)
      } catch (e) {
        this.$showError(e.message)
      }
      // console.log(actions)

      return resp
    },
    priceStrict (auctionData, period, qty) {
      let price = parseInt(auctionData.start_price)
      if (period > 0) {
        price -= parseInt(auctionData.first_step)
      }

      let count = 1
      while (count < period) {
        price -= parseInt(auctionData.price_step)
        count++
      }

      const priceFormatted = (price * qty) / Math.pow(10, auctionData.price_symbol.precision)

      return `${priceFormatted.toFixed(auctionData.price_symbol.precision)} ${auctionData.price_symbol.symbol}`
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
    async getPreorders () {
      const auctionId = this.auctionData.auction_id
      const numberPeriods = this.auctionData.period_count
      // console.log(auctionId)

      const sb = new Serialize.SerialBuffer({ textEncoder: new TextEncoder(), textDecoder: new TextDecoder() })
      // console.log(packData)
      sb.pushUint32(auctionId)
      sb.pushUint32(0)
      sb.pushUint32(0)
      sb.pushUint32(0)
      // console.log(sb.array)

      // reverse byte ordering for chain query
      const reversedArray = new Uint8Array(4)
      reversedArray.set(sb.array.slice(0, 4).reverse())
      const hexIndex = Buffer.from(reversedArray).toString('hex')
      const key = '0x' + hexIndex + '000000000000000000000000'
      const keyTo = '0x' + hexIndex + 'ffffffffffffffffffffffff'
      // console.log(key)

      const res = await this.$wax.rpc.get_table_rows({
        code: process.env.saleContract,
        scope: process.env.saleContract,
        table: 'preorders',
        key_type: 'i128',
        index_position: 2,
        lower_bound: key,
        upper_bound: keyTo,
        limit: 1000
      })

      // console.log(res)
      const preorders = new Array(numberPeriods)
      preorders.fill(0)
      for (let r = 0; r < res.rows.length; r++) {
        const row = res.rows[r]
        if (!row.paid) {
          continue
        }
        if (typeof preorders[row.auction_period] === 'undefined') {
          preorders[row.auction_period] = 0
        }
        preorders[row.auction_period] += row.number_packs
      }

      this.preordersTotal = preorders.reduce((t, v) => t + v)

      return preorders
    },
    async getMyPreorders () {
      if (!this.accounts.wax) {
        return []
      }
      const auctionId = this.auctionData.auction_id
      // const numberPeriods = this.auctionData.period_count
      // console.log(auctionId)

      const sb = new Serialize.SerialBuffer({ textEncoder: new TextEncoder(), textDecoder: new TextDecoder() })
      // console.log(packData)
      sb.pushName(this.accounts.wax)
      sb.pushNumberAsUint64(auctionId)
      // console.log(sb.array)

      // reverse byte ordering for chain query
      const reversedArray = new Uint8Array(16)
      reversedArray.set(sb.array.slice(0, 8).reverse())
      reversedArray.set(sb.array.slice(8, 16).reverse(), 8)
      const hexIndex = Buffer.from(reversedArray).toString('hex')
      const key = '0x' + hexIndex
      // console.log(key)

      const res = await this.$wax.rpc.get_table_rows({
        code: process.env.saleContract,
        scope: process.env.saleContract,
        table: 'preorders',
        key_type: 'i128',
        index_position: 3,
        lower_bound: key,
        upper_bound: key,
        limit: 100
      })

      const preorders = res.rows.filter(p => {
        return p.paid
      }).map(p => {
        // console.log(p)
        const [amountStr, sym] = p.quantity.split(' ')
        // console.log([amountStr, sym])
        const amount = parseInt(amountStr)
        p.quantity = `${amount} ${sym}`

        p.preorder_time_int = this.parseDate(p.preorder_time)

        p.auction_period = p.auction_period + 1

        return p
      }).sort((a, b) => {
        return (a.preorder_time_int < b.preorder_time_int) ? 1 : -1
      })

      // console.log('my preorders', preorders)

      return preorders
    },
    async startEditPreorder (preorder) {
      this.showPreorderDialog = true
      this.editPreorder = preorder
      this.editPreorderQty = preorder.number_packs
      this.editPreorderPeriod = preorder.auction_period - 1
    },
    updateEditQuote () {
      // console.log(this.editPreorder)
      // const [qtyStr] = this.editPreorder.quantity.split(' ')
      const newPrice = this.editPreorderQty * (this.periodPrices[this.editPreorderPeriod].price / Math.pow(10, this.auctionData.price_symbol.precision))
      // console.log('newPrice', this.auctionData.price_symbol, newPrice, qtyStr)
      this.editPreorderCost = `${newPrice} ${this.auctionData.price_symbol.symbol}`
    },
    async doEditPreorder () {
      console.log(`Update preorder ${this.editPreorder.preorder_id} to period ${this.editPreorderPeriod}, qty ${this.editPreorderQty}`)
      this.showPreorderDialog = false
      const actions = []
      actions.push({
        account: process.env.saleContract,
        name: 'editpreord',
        authorization: [{
          actor: this.accounts.wax,
          permission: 'active'
        }],
        data: {
          preorder_id: this.editPreorder.preorder_id,
          new_auction_period: this.editPreorderPeriod,
          qty: this.editPreorderQty
        }
      })

      try {
        await this.$store.dispatch('ual/transact', { actions, network: 'wax' })

        setTimeout(async () => {
          this.myPreorders = await this.getMyPreorders()
        }, 2000)
      } catch (e) {
        this.$showError(e.message)
      }
    }
  },
  async mounted () {
    this.periodPrices = this.periodData(this.auctionData).map(p => { return { value: p.period, text: `Period ${p.period + 1} - ${p.price_formatted}`, price: p.price } })
    this.preorders = await this.getPreorders()
    this.myPreorders = await this.getMyPreorders()
    setInterval(async () => {
      this.preorders = await this.getPreorders()
    }, 10000)
  },
  watch: {
    editPreorderPeriod: function () {
      this.updateEditQuote()
    },
    editPreorderQty: function () {
      this.updateEditQuote()
    },
    accounts: async function () {
      this.myPreorders = await this.getMyPreorders()
    }
  }
}
</script>
