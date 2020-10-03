<template>
  <q-page class="full-width column wrap justify-start content-center">
    <div v-if="getAccountName.wax" class="d-flex flex-row flex-wrap">
      <div v-for="card in cards" :key="card.asset_id" class="p-4 w-25">
        <div class="d-flex justify-content-center">
          <div class="d-flex flex-column flex-wrap">
            <img :src="'https://ipfs.io/ipfs/' + card.data.img" class="mw-100" />
            <!-- <div>
              {{ card.name }}
            </div> -->
          </div>
        </div>
      </div>
    </div>
  </q-page>
</template>

<script>
// import { Vue } from 'vue'
import { mapGetters } from 'vuex'

export default {
  name: 'InventoryPage',
  components: {
  },
  data () {
    return {
      cards: [],
      page: 1
    }
  },
  computed: {
    ...mapGetters({
      getAccountName: 'ual/getAccountName'
    })
  },
  methods: {
    async reloadCards () {
      if (this.getAccountName.wax) {
        const url = `${process.env.atomicEndpoint}/atomicassets/v1/assets?owner=${this.getAccountName.wax}&collection_name=${process.env.collectionName}&page=${this.page}`

        const res = await fetch(url)
        const json = await res.json()

        this.cards = json.data

        console.log('assets', json)

        this.cardsLoaded = true
      }
    }
  },
  watch: {
    getAccountName (accountName) {
      if (accountName) {
        // load the packs
        this.reloadCards()
      }
    }
  },
  async mounted () {
    this.reloadCards()
  }
}
</script>

<style>
  @media (max-width: 576px) {
    .w-25 {
      width: 100% !important;
    }
  }
  @media (max-width: 768px) {
    .w-25 {
      width: 50% !important;
    }
  }
</style>
