<template>
  <q-page class="full-width column wrap justify-start content-center planet-bg-page">
    <div class="w-75">

      <inventory-tabs />

      <div v-if="getAccountName.wax" class="d-flex flex-row flex-wrap">
        <div class="full-width flex">
          <div class="w-25">
            <label>
              Rarity
              <b-form-select id="filter-rarity" @change="updateFilter" v-model="filterRarity">
                <option value="">All</option>
                <option value="Common">Common</option>
                <option value="Rare">Rare</option>
                <option value="Epic">Epic</option>
                <option value="Legendary">Legendary</option>
                <option value="Mythical">Mythical</option>
              </b-form-select>
            </label>
          </div>
          <div class="w-25">
            <label>
              Type
              <b-form-select id="filter-schema" @change="updateFilter" v-model="filterSchema">
                <option value="">All</option>
                <option value="faces.worlds">Avatars</option>
                <option value="crew.worlds">Minions</option>
                <option value="arms.worlds">Weapons</option>
                <option value="tool.worlds">Tools</option>
                <option value="land.worlds">Land</option>
              </b-form-select>
            </label>
          </div>
          <div class="w-25">
            <label>
              Page
              <b-button-toolbar key-nav aria-label="Toolbar with button groups">
                <b-button-group class="mx-1">
                  <b-button @click="decreasePage" :disabled="page === 1">&lsaquo;</b-button>
                  <input type="text" v-model="page" @change="updateFilter" min="1" style="width:2em;text-align:center" readonly />
                  <b-button @click="increasePage" :disabled="cards.length !== pageSize">&rsaquo;</b-button>
                </b-button-group>
              </b-button-toolbar>
            </label>
          </div>
          <div class="w-25" v-if="dataQuery.name">
            <label>
              Card
            </label>
            <p><b-button @click="removeCard">&#x274C;</b-button> {{dataQuery.name}}</p>
          </div>
        </div>
        <div v-for="card in cards" :key="card.asset_id" class="p-4 w-25">
          <div class="d-flex justify-content-center card-item" @click="filterCard(card.template.template_id, card.data.name)">
            <div class="d-flex flex-column flex-wrap">
              <img :src="ipfsRoot + card.data.img" class="mw-100" :alt="card.name" />
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
import InventoryTabs from 'components/InventoryTabs'
import { mapGetters } from 'vuex'
import { ExplorerApi } from 'atomicassets'
import { BFormSelect, BButton, BButtonGroup, BButtonToolbar } from 'bootstrap-vue'

export default {
  name: 'InventoryPage',
  components: {
    'login-wax': LoginWax,
    'inventory-tabs': InventoryTabs,
    'b-form-select': BFormSelect,
    'b-button': BButton,
    'b-button-group': BButtonGroup,
    'b-button-toolbar': BButtonToolbar
  },
  data () {
    return {
      cards: [],
      dataQuery: {},
      page: 1,
      pageSize: 48,
      filterRarity: '',
      filterSchema: '',
      ipfsRoot: process.env.ipfsRoot
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
        console.log(filter)
        const options = {
          owner: this.getAccountName.wax,
          collection_name: process.env.collectionName
        }
        if (filter.schema) {
          options.schema_name = filter.schema
        }
        if (filter.template) {
          options.template_id = filter.template
        }
        delete filter.schema
        delete filter.name
        delete filter.template
        if (filter.rarity === '') {
          delete filter.rarity
        }
        const assets = await atomic.getAssets(options, this.page, this.pageSize, filter)
        this.cards = assets

        this.cardsLoaded = true
      }
    },
    updateFilter () {
      const filter = JSON.parse(JSON.stringify(this.dataQuery))

      filter.rarity = this.filterRarity
      filter.schema = this.filterSchema
      delete filter.template
      delete filter.name
      this.page = 1

      this.dataQuery = filter

      this.reloadCards()
    },
    filterCard (templateId, name) {
      const filter = JSON.parse(JSON.stringify(this.dataQuery))
      filter.template = templateId
      filter.name = name
      this.dataQuery = filter
      if (this.page !== 1) {
        this.page = 1
      } else {
        this.reloadCards()
      }
    },
    removeCard () {
      const filter = JSON.parse(JSON.stringify(this.dataQuery))
      delete filter.template
      delete filter.name
      this.dataQuery = filter
      if (this.page !== 1) {
        this.page = 1
      } else {
        this.reloadCards()
      }
    },
    increasePage () {
      if (this.cards.length === this.pageSize) {
        this.page++
      }
    },
    decreasePage () {
      if (this.page > 1) {
        this.page--
      }
    }
  },
  watch: {
    getAccountName (accountName) {
      if (accountName) {
        // load the packs
        this.reloadCards()
      }
    },
    page () {
      this.reloadCards()
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
  .card-item {
    cursor: pointer
  }
</style>
