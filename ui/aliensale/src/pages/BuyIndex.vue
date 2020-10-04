<template>
  <q-page class="planet-bg-page">

    <div class="row justify-center">
      <div class="w-75">
        <div class="d-flex flex-row flex-wrap">
          <div v-for="(auctionData, packSymbol) in auctions" :key="packSymbol" class="p-4 w-50">
            <div class="d-flex flex-row">
              <div class="p-4 w-50">
                <img :src="ipfsRoot + auctionData.img" style="width:75%" class="pack-img" />
              </div>

              <div class="row justify-center">
                <h2 class="highlight">{{auctionData.name}}</h2>
                <div style="margin-bottom:100px">
                  <div v-for="sale in auctionData.sales" :key="sale.sale_symbol">
                    <router-link :to="{ name: 'auction', params: { auction_id: sale.auction_id }}" class="btn btn-secondary">{{ sale.sale_symbol }} Sale</router-link>
                    <p v-if="sale.remaining > 0">{{sale.remaining}} left</p>
                    <p v-if="sale.remaining == 0">SOLD OUT!</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </q-page>
</template>

<style lang="scss">
  @keyframes shake {
    0% { transform: translate(1px, 1px) rotate(0deg); }
    10% { transform: translate(-1px, -2px) rotate(-1deg); }
    20% { transform: translate(-3px, 0px) rotate(1deg); }
    30% { transform: translate(3px, 2px) rotate(0deg); }
    40% { transform: translate(1px, -1px) rotate(1deg); }
    50% { transform: translate(-1px, 2px) rotate(-1deg); }
    60% { transform: translate(-3px, 1px) rotate(0deg); }
    70% { transform: translate(3px, 1px) rotate(-1deg); }
    80% { transform: translate(-1px, -1px) rotate(1deg); }
    90% { transform: translate(1px, 2px) rotate(0deg); }
    100% { transform: translate(1px, -2px) rotate(-1deg); }
  }

  .pack-img:hover {
    animation: shake 0.5s;
    animation-iteration-count: infinite;
  }

  .highlight {
    background: linear-gradient(167deg, rgba(23,22,21,0.6152836134453781) 9%, rgba(21,34,34,1) 100%, rgba(34,34,34,1) 100%);
    border-color: #88aadd;
    color: #DDD;
    display: block;
    height: auto;
    width: auto;
    margin-left: auto;
    margin-right: auto;
    margin-top: 0px;
    margin-bottom: 20px;
    padding: 5px 15px;
    outline: none;
    transition: all 0.2s ease;
    cursor: pointer;
    border-radius: 15px;

    &:after {
      border-top: 2px solid;
      border-color: #E48632;
      content: "";
      display: block;
      height: 1px;
      width: 60px;
      margin: 13px auto 0 auto;
    }
  }
  .planet-bg-buy {
    background-image: url(/images/planetopen.png);
    background-position: bottom center;
    margin-bottom: 50px;
    background-repeat: no-repeat;
  }

</style>

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
