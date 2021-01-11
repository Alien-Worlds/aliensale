<template>
  <div>
    <div id="video-box" :style="'display:' + ((showVideo)?'block':'none')">
      <video id="shine-video"></video>
    </div>

    <q-dialog id="shined-overlay" v-model="showShinedModal" transition-show="slide-up">
      <img :src="ipfsRoot + shinedCard.immutable_data.img" class="mw-100 shined-card" v-if="shinedCard" :alt="shinedCard.name" style="max-height:90vh" />
    </q-dialog>

    <div v-if="cards.length" style="padding:20px" class="shine-container">
      <div class="d-flex justify-content-around">
        <div class="flex-fill" style="text-align:center">
          <img :src="ipfsRoot + fromCard.immutable_data.img" class="mw-100 thumbnail" :alt="fromCard.name" />
          <p>{{fromCard.name}} ({{fromCard.immutable_data.shine}})</p>
        </div>
        <div class="d-flex align-content-center flex-wrap">
          <div>
            <font-awesome-icon icon="arrow-right" size="5x"/>
          </div>
        </div>
        <div class="flex-fill" style="text-align:center">
          <img :src="ipfsRoot + toCard.immutable_data.img" class="mw-100 thumbnail" :alt="toCard.name" />
          <p>{{toCard.name}} ({{toCard.immutable_data.shine}})</p>
        </div>
      </div>

      <div class="d-flex">
        <div class="flex-fill">
          Combining mints :
          {{cardMints.join(', ')}}
        </div>
        <div class="flex-fill">
          Cost : {{shineData.cost}}
        </div>
      </div>

      <div class="d-flex align-items-end flex-column">
        <div v-if="cards.length === shineData.qty" class="p2">
          <b-button @click="submitShine()" variant="success">Start Shining</b-button>
        </div>
        <div v-else>
          Please choose {{shineData.qty - cards.length}} more cards to shine
        </div>
      </div>

    </div>
  </div>
</template>

<style lang="scss">
  .q-dialog__backdrop {
    background: rgba(0, 0, 0, 0.9);
  }
  .thumbnail {
    max-height: 180px;
    filter: drop-shadow(0 0 2px #fff);
  }
  .shine-container {
    background-color: #333;
    border-radius: 5px;
    padding: 10px;
    .thumbnail {
      margin-bottom: 10px;
    }
  }
  #video-box {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 10000;
    >video {
      width: 100%;
      height: auto;
    }
  }

  .shined-card {
    animation: card-glow 1s alternate infinite;
  }
  @keyframes card-glow {
    0% {
      -webkit-filter: drop-shadow(0 0 2px #fff);
      filter: drop-shadow(0 0 2px #fff);
    }
    100% {
      -webkit-filter: drop-shadow(0 0 40px #fff);
      filter: drop-shadow(0 0 40px #fff);
    }
  }
</style>
<script>
import { mapGetters } from 'vuex'
import { ExplorerApi } from 'atomicassets'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

export default {
  name: 'Shining',
  components: {
    'font-awesome-icon': FontAwesomeIcon
  },
  props: ['cards', 'shineData'],
  data () {
    return {
      ipfsRoot: process.env.ipfsRoot,
      shineIds: [],
      cardMints: [],
      fromCard: null,
      toCard: null,
      shinedCard: null,
      showShinedModal: false,
      showVideo: false
    }
  },
  computed: {
    ...mapGetters({
      getAccountName: 'ual/getAccountName'
    }),
    showDialog () {
      return this.baseShowDialog && !this.getAccountName.wax
    }
  },
  methods: {
    async submitShine () {
      if (!this.shineData) {
        return
      }

      const account = this.getAccountName.wax
      console.log('cards!', this.cards)
      const shineIds = this.cards.map(s => s.asset_id)

      const actions = [{
        account: 'alien.worlds',
        name: 'transfer',
        authorization: [{
          actor: account,
          permission: 'active'
        }],
        data: {
          from: account,
          to: process.env.shiningContract,
          quantity: this.shineData.cost,
          memo: 'Shining'
        }
      }, {
        account: 'atomicassets',
        name: 'transfer',
        authorization: [{
          actor: account,
          permission: 'active'
        }],
        data: {
          from: account,
          to: process.env.shiningContract,
          asset_ids: shineIds,
          memo: 'Shining'
        }
      }]

      const retVal = null

      try {
        const shineResp = await this.$store.dispatch('ual/transact', { actions, network: 'wax' })
        console.log(shineResp)

        console.log('shine actions', actions)
        this.shinedCard = this.toCard
        this.showVideo = true
        const video = document.getElementById('shine-video')
        video.src = '/videos/' + this.toCard.immutable_data.shine.toLowerCase() + '_shine.mp4'
        video.play()
        video.addEventListener('ended', () => {
          console.log('Video end')
          this.showVideo = false
          this.showShinedModal = true

          this.$root.$emit('shiningComplete', true)
        })

        /*
        if (shineResp.status === 'executed') {
          const txId = shineResp.transactionId || shineResp.transaction_id
          const logData = shineResp.transaction.processed.action_traces[0].inline_traces[0].act.data
          logData.transaction_id = txId
          retVal = logData
        } */
      } catch (e) {
        this.$showError(e.message)
      }

      return retVal
    },
    async loadShineCards () {
      if (!this.shineData || !this.shineData.from) {
        return
      }
      const atomic = new ExplorerApi(process.env.atomicEndpoint, 'atomicassets', { fetch, rateLimit: 4 })
      this.fromCard = await atomic.getTemplate(process.env.collectionName, this.shineData.from)
      this.toCard = await atomic.getTemplate(process.env.collectionName, this.shineData.to)
    }
  },
  watch: {
    cards () {
      console.log('cards Cahnged', this.cards)
      this.cardMints = this.cards.map(c => c.template_mint)
    },
    shineData () {
      console.log(this.shineData)
      this.loadShineCards()
    }
  }
}
</script>
