<template>
  <div>
    <country-select ref="country" @selected="preBid" />

    <h3>Pre-Bid</h3>
    <b-form-select v-model="preBidPeriod" :options="periodPrices" />
    <qty-control v-model="qty" />
    <p class="buy-control"><button type="Buy" class="button" style="display:inline;" @click="startPreBid">Bid</button></p>
    <p>Packs can be pre-bid, you will need to pay the full amount of your bid but this will be refunded if you are not successful</p>
  </div>
</template>

<script>
import { BFormSelect } from 'bootstrap-vue'
import QtyControl from 'components/QtyControl'
import CountrySelect from 'components/CountrySelect'
import { Serialize } from 'eosjs'

export default {
  name: 'PreBid',
  components: {
    'b-form-select': BFormSelect,
    'qty-control': QtyControl,
    'country-select': CountrySelect
  },
  props: ['auction-data', 'accounts'],
  computed: {},
  data () {
    return {
      preBidPeriod: null,
      periodPrices: null,
      qty: 1
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
    async startPreBid () {
      // console.log('start pre-bid ', this.qty, this.$refs.country)
      if (!this.accounts.wax) {
        // make sure they are logged in, they will have to click the buy button again
        this.$store.dispatch('ual/renderLoginModal', 'wax', { root: true })
        return
      }
      if (this.preBidPeriod === null) {
        this.$showError('Please choose the period you would like to bid on')
        return
      }
      this.$refs.country.show(this.auctionData)
    },
    async preBid (country) {
      // console.log('bidwax', this.preBidPeriod, this.accounts.wax, this.qty, this.auctionData, country)
      const account = this.accounts.wax
      const auction = this.auctionData
      const qty = this.qty

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
          quantity: this.priceStrict(auction, this.preBidPeriod, qty),
          memo: ''
        }
      }, {
        account: process.env.saleContract,
        name: 'reserve',
        authorization: [{
          actor: account,
          permission: 'active'
        }],
        data: {
          buyer: account,
          auction_id: auction.auction_id,
          auction_period: this.preBidPeriod,
          qty,
          referrer: this.$referrer
        }
      }]

      let resp = null
      try {
        // const options = { broadcast: false }
        resp = await this.$store.dispatch('ual/transact', { actions, network: 'wax' })
        // console.log(resp)

        const txId = resp.transactionId || resp.transaction_id

        // register the sale on our server
        this.logSale(country, txId)

        this.$showSuccess('Your bid has been recorded, please wait until the auction starts')
      } catch (e) {
        this.$showError(e.message)
      }
      console.log(actions)

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
    async getBids () {
      const auctionId = this.auctionData.auction_id
      const numberPeriods = this.auctionData.period_count
      console.log(auctionId)

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
      console.log(key)

      const res = await this.$wax.rpc.get_table_rows({
        code: process.env.saleContract,
        scope: process.env.saleContract,
        table: 'reservations',
        key_type: 'i128',
        index_position: 2,
        lower_bound: key,
        upper_bound: keyTo
      })

      console.log(res)
      const bids = new Array(numberPeriods)
      bids.fill(0)
      for (let r = 0; r < res.rows.length; r++) {
        const row = res.rows[r]
        if (typeof bids[row.auction_period] === 'undefined') {
          bids[row.auction_period] = 0
        }
        bids[row.auction_period] += row.number_packs
      }

      return bids
    }
  },
  async mounted () {
    this.periodPrices = this.periodData(this.auctionData).map(p => { return { value: p.period, text: `Period ${p.period + 1} - ${p.price_formatted}` } })
    this.bids = await this.getBids()
    console.log(this.bids)
  }
}
</script>
