<template>
  <div>
    <div v-if="account.wax">
      <div v-for="pack in packs" :key="pack.symbol">
        <div v-if="pack.qty">
          <img :src="pack.img" />
          {{ pack.qty }}
          {{ pack.metadata.name }}
          <q-btn @click="openPack(pack.symbol)" label="Open one" />
        </div>
      </div>
      <div v-if="!packs.length && packsLoaded">
        No packs
      </div>
    </div>
    <div v-else>
      <div v-if="!account.wax">
        Please log in to view cards
      </div>
      <div v-else-if="!packsLoaded">
        Loading...
      </div>
    </div>

    <div v-if="waitingPack">
      Waiting for pack open...
    </div>

    <div v-for="(card, cardnum) in receivedCards" :key="cardnum">
        <p>{{ card.name }} - {{ card.rarity }} {{ card.shine }}</p>
    </div>
  </div>

</template>

<script>
import { mapGetters } from 'vuex'
import io from 'socket.io-client'
let cards = {}

export default {
  name: 'PackDisplay',
  props: {
    account: {
      type: String,
      default: ''
    }
  },
  data () {
    return {
      packs: [],
      receivedCards: [],
      waitingPack: false,
      packsLoaded: false
    }
  },
  computed: {
    ...mapGetters({
      getAccountName: 'ual/getAccountName'
    })
  },
  methods: {
    async reloadPacks () {
      // console.log('RELOAD PACKS', this.account)
      if (this.account.wax) {
        const ownedTokens = await this.$wax.rpc.get_currency_balance('pack.worlds', this.account.wax)
        const availableTokensRes = await this.$wax.rpc.get_table_rows({ code: 'sale.worlds', scope: 'sale.worlds', table: 'packs' })
        const availableTokens = availableTokensRes.rows.map((p) => {
          p.metadata = JSON.parse(p.metadata)
          const [, sym] = p.pack_asset.quantity.split(' ')
          p.symbol = sym
          return p
        })

        // console.log('owned tokens', ownedTokens)
        // console.log('available tokens', availableTokens)
        const ownedIndex = {}
        ownedTokens.forEach((ot) => {
          const [oa, os] = ot.split(' ')
          ownedIndex[os] = parseInt(oa)
        })
        const packs = []
        availableTokens.forEach(pt => {
          // const [qtyStr, sym] = pt.split(' ')
          const sym = pt.symbol
          if (typeof ownedIndex[sym] !== 'undefined') {
            // const qty = parseInt(qtyStr)
            const qty = ownedIndex[sym]
            pt.qty = qty
            packs.push(pt)
          }
        })

        this.packs = packs
        this.packsLoaded = true
        // console.log('packs', packs)
      } else {

      }
    },
    async openPack (sym) {
      console.log(`Open pack ${sym}`)
      cards = {}

      this.receivedCards = []
      const actions = [{
        account: 'pack.worlds',
        name: 'transfer',
        authorization: [{
          actor: this.account.wax,
          permission: 'active'
        }],
        data: {
          from: this.account.wax,
          to: 'open.worlds',
          quantity: `1 ${sym}`,
          memo: 'Pack opening'
        }
      }, {
        account: 'open.worlds',
        name: 'open',
        authorization: [{
          actor: this.account.wax,
          permission: 'active'
        }],
        data: {
          account: this.account.wax
        }
      }]
      await this.$store.dispatch('ual/transact', { actions, network: 'wax' })

      this.waitingPack = true
      this.packsLoaded = false

      this.reloadPacks()
    },
    startListener () {
      if (this.account.wax !== null) {
        const atomicEndpoint = 'https://test.wax.api.atomicassets.io'
        this.subscribe(atomicEndpoint, this.account.wax, (asset) => {
          // console.log(asset)
          // console.log('got asset', asset)
          cards[asset.asset_id] = asset.data
          this.receivedCards = Object.values(cards)
          this.waitingPack = false
        })
      }
    },
    async subscribe (atomicEndpoint, account, callback) {
      console.log(`Subscribing to ${atomicEndpoint}`)

      const socketT = io(`${atomicEndpoint}/atomicassets/v1/transfers`)

      socketT.on('new_transfer', (data) => {
        console.log('transfer', data)
        if (data.transfer.recipient_name === account && data.transfer.sender_name === 'open.worlds') {
          data.transfer.assets.forEach(callback)
        }
      })

      const socketA = io(`${atomicEndpoint}/atomicassets/v1/assets`)

      socketA.on('new_asset', (data) => {
        console.log('new_asset', account, data)
        if (data.asset.owner === account) {
          callback(data.asset)
        }
      })
    }
  },
  watch: {
    account (accountName) {
      if (accountName) {
        // load the packs
        this.reloadPacks()
        this.startListener()
      }
    }
  },
  async mounted () {
    this.reloadPacks()
    this.startListener()
    window.setInterval(this.reloadPacks, 3000)
  }
}
</script>
