<template>
  <q-page class="">

    <div class="row justify-center">
      <div class="w-75">
        <div class="d-flex flex-row flex-wrap">
          <div v-for="(auctionData, packSymbol) in auctions" :key="packSymbol" class="p-4 w-50">
            <div class="d-flex flex-row">
              <div class="p-4 w-50">
                <img :src="ipfsRoot + auctionData.img" style="width:75%" />
              </div>

              <div>
                <h2>{{auctionData.name}}</h2>
                <div v-for="sale in auctionData.sales" :key="sale.sale_symbol">
                  <router-link :to="{ name: 'auction', params: { auction_id: sale.auction_id }}">{{ sale.sale_symbol }}</router-link>
                  <p v-if="sale.remaining > 0">{{sale.remaining}} left</p>
                  <p v-if="sale.remaining == 0">SOLD OUT!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script>
export default {
  name: 'BuyIndexPage',
  data () {
    return {
      auctions: [],
      ipfsRoot: process.env.ipfsRoot
    }
  },
  methods: {
    async loadAuctions () {
      const availablePacksRes = await this.$wax.rpc.get_table_rows({ code: 'sale.worlds', scope: 'sale.worlds', table: 'packs' })
      const availablePacks = availablePacksRes.rows.map((p) => {
        p.metadata = JSON.parse(p.metadata)
        const [, sym] = p.pack_asset.quantity.split(' ')
        p.symbol = sym
        return p
      })
      // console.log(availablePacks)

      const res = await this.$wax.rpc.get_table_rows({
        code: 'sale.worlds',
        scope: 'sale.worlds',
        table: 'auctions'
      })

      const auctions = {}

      if (res && res.rows.length) {
        res.rows.forEach(a => {
          const [, saleSymbol] = a.price_symbol.symbol.split(',')
          a.sale_symbol = saleSymbol

          const [quantityRemaining, packSymbol] = a.pack.quantity.split(' ')
          a.quantity_remaining = parseInt(quantityRemaining)

          a.pack = availablePacks.find(p => p.symbol === packSymbol)

          if (typeof auctions[packSymbol] === 'undefined') {
            auctions[packSymbol] = {
              name: a.pack.metadata.name,
              img: a.pack.metadata.img,
              description: a.pack.metadata.name,
              sales: []
            }
          }

          auctions[packSymbol].sales.push({
            remaining: a.quantity_remaining,
            sale_symbol: a.sale_symbol,
            auction_id: a.auction_id
          })
        })
      }

      this.auctions = auctions
    }
  },
  async mounted () {
    this.loadAuctions()
  }
}
</script>
