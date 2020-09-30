<template>
  <q-page class="">
    <h1>Buy!</h1>
    <p>This is a temporary page and will be replaced with a hardcoded one</p>
    <div v-for="auction in auctions" :key="auction.auction_id">
      <router-link :to="{ name: 'auction', params: { auction_id: 0 }}">Auction for {{ auction.pack.quantity }}</router-link>
    </div>
  </q-page>
</template>

<script>
export default {
  name: 'BuyIndexPage',
  data () {
    return {
      auctions: []
    }
  },
  methods: {
    async loadAuctions () {
      const res = await this.$wax.rpc.get_table_rows({
        code: 'sale.worlds',
        scope: 'sale.worlds',
        table: 'auctions'
      })

      this.auctions = res.rows
    }
  },
  async mounted () {
    this.loadAuctions()
  }
}
</script>
