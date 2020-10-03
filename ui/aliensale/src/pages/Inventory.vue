<template>
  <q-page class="full-width column wrap justify-start content-center">
    <div class="w-75 planet-bg">
      <div v-if="getAccountName.wax" class="d-flex flex-row flex-wrap">
        <div class="full-width flex">
          <div class="w-20">Filter</div>
          <div>
            <select id="filter-rarity" @change="updateFilter" v-model="filterRarity">
              <option value="">All</option>
              <option value="Common">Common</option>
              <option value="Rare">Rare</option>
              <option value="Epic">Epic</option>
              <option value="Legendary">Legendary</option>
              <option value="Mythical">Mythical</option>
            </select>
          </div>
          <div>
            <select id="filter-rarity" @change="updateFilter" v-model="filterSchema">
              <option value="">All</option>
              <option value="faces.worlds">Avatars</option>
              <option value="crew.worlds">Minions</option>
              <option value="arms.worlds">Weapons</option>
              <option value="tool.worlds">Tools</option>
              <option value="land.worlds">Land</option>
            </select>
          </div>
          <div>
            <input type="number" v-model="page" @change="updateFilter" min="1" />
          </div>
        </div>
        <div v-for="card in cards" :key="card.asset_id" class="p-4 w-25">
          <div class="d-flex justify-content-center">
            <div class="d-flex flex-column flex-wrap">
              <img :src="'https://ipfs.io/ipfs/' + card.data.img" class="mw-100" />
            </div>
          </div>
        </div>
      </div>
      <div v-else>
        <login-wax />
      </div>
    </div>
  </q-page>
</template>

<script>
import LoginWax from 'components/LoginWax'
import { mapGetters } from 'vuex'
import { ExplorerApi } from 'atomicassets'

export default {
  name: 'InventoryPage',
  components: {
    'login-wax': LoginWax
  },
  data () {
    return {
      cards: [],
      dataQuery: {},
      page: 1,
      filterRarity: '',
      filterSchema: ''
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
        const atomic = new ExplorerApi(process.env.atomicEndpoint, 'atomicassets', { fetch, rateLimit: 4 })
        const filter = JSON.parse(JSON.stringify(this.dataQuery))
        const options = {
          owner: this.getAccountName.wax,
          collection_name: process.env.collectionName
        }
        if (filter.schema) {
          options.schema_name = filter.schema
        }
        delete filter.schema
        if (filter.rarity === '') {
          delete filter.rarity
        }
        const assets = await atomic.getAssets(options, this.page, 100, filter)
        this.cards = assets

        this.cardsLoaded = true
      }
    },
    updateFilter () {
      const filter = {}

      filter.rarity = this.filterRarity
      filter.schema = this.filterSchema

      this.dataQuery = filter

      this.reloadCards()
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
