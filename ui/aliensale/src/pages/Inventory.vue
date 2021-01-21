<template>
  <q-page class="full-width column wrap justify-start content-center planet-bg-page">

    <div class="w-75 sizer">

      <b-button v-if="shineCards.length" @click="cancelShine()" style="float:right" variant="danger">
        <font-awesome-icon icon="times" size="lg"/>
      </b-button>
      <shining :cards="shineCards" :shineData="shineData" id="the-shining" />

      <hr v-if="shineCards.length" />

      <q-dialog v-model="showAsset">
        <div v-if="showAssetData" class="d-flex p-3" style="background-color:#333;">
          <div class="d-flex justify-content-center w-50">
            <img :src="ipfsRoot + showAssetData.data.img" class="mw-100" :alt="showAssetData.name" style="max-height:100%" />
          </div>
          <div class="w-50 p-4">
            <h2>{{showAssetData.name}}</h2>
            <p>{{showAssetData.data.description}}</p>
            <p>Template ID : {{showAssetData.template.template_id}}</p>
            <div v-for="(val, key) in showAssetData.data" :key="key">
              <div v-if="key !== 'img' && key !== 'backimg' && key !== 'name' && key !== 'description'" class="d-flex">
                <div class="w-50">{{key}}</div>
                <div class="w-50">{{val}}</div>
              </div>
            </div>

            <div class="mt-5" v-if="showAssetData.schema.schema_name !== 'land.worlds' && shineData">
              <div v-if="shineData.started">
                <b-button @click="shine(showAssetData.template.template_id, showAssetData.asset_id)">Shine</b-button>
              </div>
              <div v-else>
                <b-button disabled="disabled">Shining Starts in <start-countdown :start="shineData.start_ms" /></b-button>
              </div>

            </div>
            <div v-else class="mt-5">
              <b-button disabled="disabled">Shining not available</b-button>
            </div>

          </div>
        </div>
      </q-dialog>

      <inventory-tabs v-if="!showShine" />

      <div v-if="getAccountName.wax" class="d-flex flex-row flex-wrap">
        <div class="full-width flex" v-if="!showShine">
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
          <div class="d-flex justify-content-center card-item" @click="showCard(card.asset_id)" v-bind:class="{ shine: shineIds.includes(card.asset_id) }">
            <div class="d-flex flex-column flex-wrap">
              <div style="position:relative">
                <div class="mint-number" v-if="card.template_mint > 0">#{{card.template_mint}}</div>
                <img :src="ipfsRoot + card.data.img" class="mw-100" :alt="card.name" />
              </div>
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
import Shining from 'components/Shining'
import { mapGetters } from 'vuex'
import { ExplorerApi } from 'atomicassets'
import { BFormSelect, BButton, BButtonGroup, BButtonToolbar } from 'bootstrap-vue'
import StartCountdown from 'components/StartCountdown'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { scroll } from 'quasar'
const { getScrollTarget, setScrollPosition } = scroll

export default {
  name: 'InventoryPage',
  components: {
    'login-wax': LoginWax,
    shining: Shining,
    'inventory-tabs': InventoryTabs,
    'b-form-select': BFormSelect,
    'b-button': BButton,
    'b-button-group': BButtonGroup,
    'b-button-toolbar': BButtonToolbar,
    'start-countdown': StartCountdown,
    'font-awesome-icon': FontAwesomeIcon
  },
  data () {
    return {
      cards: [],
      dataQuery: {},
      page: 1,
      pageSize: 48,
      filterRarity: '',
      filterSchema: '',
      ipfsRoot: process.env.ipfsRoot,
      showAsset: false,
      showAssetData: null,
      showShine: false,
      shineCards: [],
      shineData: null,
      shineIds: []
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
    async showCard (assetId) {
      console.log('show')
      if (this.showShine) {
        if (this.shineIds.includes(assetId)) {
          this.removeShine(assetId)
        } else {
          this.addShine(assetId)
        }
      } else {
        const card = this.cards.filter(c => c.asset_id === assetId)
        // console.log('Show card', card, this.cards)
        this.showAsset = true
        this.showAssetData = card[0]
        this.shineData = await this.getShiningData(card[0].template.template_id)
        const target = getScrollTarget(document.getElementById('the-shining'))
        setScrollPosition(target, target.offsetTop, 1000)
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
    },
    async shine (templateId, assetId) {
      this.showAsset = false
      this.showShine = true
      this.filterCard(templateId, '')
      this.shineIds = [assetId]
      this.shineCards = this.cards.filter(c => c.asset_id === assetId)
      // this.shineData = await this.getShiningData(templateId)
    },
    addShine (assetId) {
      if (!this.shineIds.includes(assetId)) {
        const sc = this.shineCards
        if (sc.length < 4) {
          sc.push(this.cards.filter(c => c.asset_id === assetId)[0])
          // console.log(sc)
          this.shineIds = sc.map(s => s.asset_id)
          this.shineCards = sc
        }
      }
    },
    removeShine (assetId) {
      if (this.shineIds.includes(assetId)) {
        let sc = this.shineCards
        sc = sc.filter(c => c.asset_id !== assetId)
        this.shineIds = sc.map(s => s.asset_id)
        this.shineCards = sc

        if (!sc.length) {
          this.cancelShine()
        }
      }
    },
    cancelShine () {
      this.showShine = false
      this.shineCards = []
      this.shineIds = []
      this.removeCard()
      this.shineData = null
    },
    async getShiningData (templateId) {
      let sd = null

      const shiningRes = await this.$wax.rpc.get_table_rows({
        code: process.env.shiningContract,
        scope: process.env.shiningContract,
        table: 'lookups',
        lower_bound: templateId,
        upper_bound: templateId,
        limit: 1
      })

      if (shiningRes.rows.length) {
        console.log(shiningRes)
        sd = shiningRes.rows[0]

        if (sd.start_time) {
          const startTimeMs = this.parseDate(sd.start_time)
          const now = (new Date()).getTime()
          // const startTimeMs = now
          // alert(startTimeMs)
          sd.started = (startTimeMs <= now)
          if (startTimeMs > now) {
            sd.start_ms = startTimeMs
          }
        }
      }

      return sd
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
    this.$root.$on('shiningComplete', () => {
      console.log('Shining complete!')
      this.reloadCards()
      this.cancelShine()
    })
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
  .mint-number {
    position:absolute;
    top:-20px;
    right:-20px;
    background-color:rgba(0,0,0,0.7);
    color:#fff;
    padding:6px;
    border-radius:10px;
    text-align:center;
    border: 1px solid #bbb;
    min-width:55px;
    font-size: 0.8rem;
  }
  .shine {
    filter: drop-shadow(0 0 5px #ff0);
  }
</style>
