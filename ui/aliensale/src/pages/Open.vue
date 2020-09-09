<template>
  <q-page class="">
    <div id="video-container">
      <div>
        <video width="100%" height="240" id="pack-open-video">
          <source src="/pack_open.mp4" type="video/mp4">
        </video>
      </div>
    </div>

    <q-dialog v-model="confirmOpenPackShow" persistent transition-show="flip-down" transition-hide="flip-up">
      <q-card v-if="confirmOpenPack">
        <q-card-section>
          <p>Are you sure you want to open this pack?</p>
          <p>{{confirmOpenPack.metadata.name}}</p>

          <b-button-group>
            <b-button variant="primary" @click="openPack(confirmOpenPack)">Yes</b-button>
            <b-button @click="confirmOpenPackShow = false">No</b-button>
          </b-button-group>
        </q-card-section>
      </q-card>
    </q-dialog>

    <div id="pack-reveal-container" v-if="packReveal" class="mt-8">

      <div v-if="waitingPack">
        Waiting for pack open...
      </div>

      <div class="d-flex flex-row flex-nowrap justify-content-center">
        <div style="width:300px;position: absolute; top:20px">
          <div v-for="(card, cardnum) in receivedCards" :key="cardnum" class="flip-card" @click="raiseCard(cardnum)">
            <div class="flip-card-inner">
              <div class="flip-card-front">
                <img src="/card_back.png" style="width:300px;" />
              </div>
              <div class="flip-card-back">
                <img src="/tools/EQ123EG.png" style="width:300px;">
              </div>
            </div>
          </div>
        </div>
        <div class="back-packs-btn" v-if="revealComplete">
          <b-button @click="returnHome()">Return to packs</b-button>
        </div>
      </div>

    </div>

    <div id="open-packs-list" v-if="!inOpening" class="row justify-center">

      <div class="row justify-center text-h1">
        Open Packs
      </div>

      <div class="w-75">
        <div v-if="getAccountName.wax" class="d-flex flex-row flex-wrap">
          <div v-for="pack in packs" :key="pack.symbol" class="p-4 w-25">
            <div v-if="pack.qty" class="d-flex justify-content-center">
              <div class="d-flex flex-column flex-wrap pack" @click="showOpenDialog(pack)">
                <img :src="'https://ipfs.io/ipfs/' + pack.metadata.img" class="mw-100" />
                <div>
                  <div>{{ pack.qty }} packs</div>
                  {{ pack.metadata.name }}
                </div>
                <!-- <div>
                  <b-button @click="openPack(pack)" label="Open one">Open</b-button>
                </div> -->
              </div>

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

      </div>
    </div>
  </q-page>
</template>

<script>
// import { Vue } from 'vue'
import { mapGetters } from 'vuex'
import io from 'socket.io-client'
import { BButton } from 'bootstrap-vue'
let cards = {}

export default {
  name: 'OpenPage',
  components: {
    'b-button': BButton
  },
  data () {
    return {
      packs: [],
      receivedCards: [],
      waitingPack: false,
      packsLoaded: false,
      inOpening: false,
      packReveal: false,
      openingPack: null,
      videoEnded: false,
      revealComplete: false,
      confirmOpenPack: null,
      confirmOpenPackShow: false
    }
  },
  computed: {
    ...mapGetters({
      getAccountName: 'ual/getAccountName'
    })
  },
  methods: {
    returnHome () {
      this.packReveal = false
      this.inOpening = false
      this.receivedCards = []
      this.waitingPack = false
      this.packsLoaded = false
      this.openingPack = null
      this.videoEnded = false
      this.revealComplete = false
      this.confirmOpenPack = null
    },
    async reloadPacks () {
      // console.log('RELOAD PACKS', this.account)
      if (this.getAccountName.wax) {
        const ownedTokens = await this.$wax.rpc.get_currency_balance('pack.worlds', this.getAccountName.wax)
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

        this.packs = packs.filter(p => p.qty) // remove packs with residual entry and no packs
        this.packsLoaded = true
        // console.log('packs', packs)
      }
    },
    async openPack (pack) {
      const sym = pack.symbol
      cards = {}
      this.cards = {}
      this.openingPack = pack

      this.receivedCards = []
      const actions = [{
        account: 'pack.worlds',
        name: 'transfer',
        authorization: [{
          actor: this.getAccountName.wax,
          permission: 'active'
        }],
        data: {
          from: this.getAccountName.wax,
          to: 'open.worlds',
          quantity: `1 ${sym}`,
          memo: 'Pack opening'
        }
      }, {
        account: 'open.worlds',
        name: 'open',
        authorization: [{
          actor: this.getAccountName.wax,
          permission: 'active'
        }],
        data: {
          account: this.getAccountName.wax
        }
      }]
      await this.$store.dispatch('ual/transact', { actions, network: 'wax' })

      this.waitingPack = true
      this.packsLoaded = false
      this.inOpening = true
      this.confirmOpenPackShow = false
      this.$nextTick(() => { window.scrollTo(0, 0) })

      document.getElementById('video-container').style.display = 'block'
      document.getElementById('pack-open-video').style.opacity = 1
      document.getElementById('pack-open-video').play()
      document.getElementById('pack-open-video').addEventListener('transitionend', () => {
        console.log('Video transition end', document.getElementById('pack-open-video').style.opacity)
        this.videoEnded = true
        window.scrollTo(0, 0)
        document.getElementById('video-container').style.display = 'none'
      })
      document.getElementById('pack-open-video').addEventListener('ended', () => {
        console.log('Video end')
        document.getElementById('pack-open-video').style.opacity = 0
      })

      this.reloadPacks()
    },
    startListener () {
      if (this.getAccountName.wax !== null) {
        const atomicEndpoint = this.$config.atomicEndpoint
        this.subscribe(atomicEndpoint, this.getAccountName.wax, (asset) => {
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
    },
    calcStyle (n, len) {
      const delta = 120 // space between cards
      const total = len * delta
      const left = (n / len * total) - ((total - 150) / 2)
      const centreDelta = Math.abs(left)
      const top = 20 + centreDelta / 5
      const rotate = left * 0.05
      return { left, top, rotate }
    },
    revealCard (cardNo) {
      const cards = document.getElementsByClassName('flip-card')
      // console.log(`revealing ${cards.length} cards`, cards, cardNo)
      const { left, top, rotate } = this.calcStyle(cardNo, cards.length)
      // console.log({ left, top, rotate })
      cards[cardNo].style.top = `${top}px`
      cards[cardNo].style.left = `${left}px`
      cards[cardNo].style.transform = `rotate(${rotate}deg)`

      cards[cardNo].addEventListener('transitionend', () => {
        setTimeout(() => { cards[cardNo].classList.add('flipped') }, 500)
        if (cardNo >= cards.length - 1) {
          this.revealComplete = true
        }
      })
    },
    revealPack () {
      for (let c = 0; c < this.openingPack.number_cards; c++) {
        setTimeout(() => { this.revealCard(c) }, 2200 * c)
      }
    },
    raiseCard (cardNum) {
      const cards = document.getElementsByClassName('flip-card')
      // console.log('raising card', cards[cardNum].style.zIndex)
      let raiseCard = true
      if (cards[cardNum].style.zIndex === '10') {
        // card already on top, let it go back to its place
        console.log('lowering card')
        raiseCard = false
      }
      for (let c = 0; c < cards.length; c++) {
        const { top, left, rotate } = this.calcStyle(c, cards.length)
        cards[c].style.zIndex = 0
        cards[c].style.top = `${top}px`
        cards[c].style.left = `${left}px`
        cards[c].style.transform = `rotate(${rotate}deg)`
      }

      if (raiseCard) {
        const { top, left, rotate } = this.calcStyle(cardNum, cards.length)
        cards[cardNum].style.zIndex = 10
        cards[cardNum].style.top = `${top - 20}px`
        cards[cardNum].style.left = `${left}px`
        cards[cardNum].style.transform = `rotate(${rotate}deg)`
      }
    },
    showOpenDialog (pack) {
      this.confirmOpenPack = pack
      this.confirmOpenPackShow = true
    }
  },
  watch: {
    getAccountName (accountName) {
      if (accountName) {
        // load the packs
        this.reloadPacks()
        this.startListener()
      }
    },
    waitingPack (wp) {
      if (wp === false) {
        this.reloadPacks()
      }
    },
    receivedCards (cards) {
      console.log(`${cards.length} cards received, waiting for ${this.openingPack.number_cards}`)
      if (cards.length >= this.openingPack.number_cards) {
        console.log('got all cards')
        this.packReveal = true
      }
    },
    videoEnded (ve) {
      if (ve && this.packReveal) {
        this.$nextTick(this.revealPack.bind(this))
      }
    },
    packReveal (pr) {
      if (pr && this.videoEnded) {
        this.$nextTick(this.revealPack.bind(this))
      }
    }
  },
  async mounted () {
    this.reloadPacks()
    this.startListener()
    window.setInterval(this.reloadPacks, 5000)
  }
}
</script>

<style>
  #video-container {
    position: relative;
    height: calc(100vh - 80px);
    display: none;
  }
  .video-container > div {
    position: absolute;
    height: calc(100vh - 80px);
  }
  #pack-open-video {
    height: calc(100vh - 80px);
    opacity: 0;
    transition: opacity 1.3s;
    transition-timing-function: cubic-bezier(.64,.22,.45,1.26);
  }
  .pack {
    cursor: pointer;
  }

  /* The flip card container - set the width and height to whatever you want. We have added the border property to demonstrate that the flip itself goes out of the box on hover (remove perspective if you don't want the 3D effect */
  .flip-card {
    background-color: transparent;
    width: 300px;
    height: 420px;
    perspective: 1000px; /* Remove this if you don't want the 3D effect */
    position: absolute;
    top: -520px;
    transition: all 0.3s;
    transition-timing-function: cubic-bezier(.64,.22,.45,1.26);
    cursor: pointer;
  }

  /* This container is needed to position the front and back side */
  .flip-card-inner {
    position: relative;
    width: 100%;
    height: 100%;
    text-align: center;
    transition: transform 0.6s;
    transform-style: preserve-3d;
  }

  /* Do an horizontal flip when you move the mouse over the flip box container */
  .flip-card.flipped .flip-card-inner {
    transform: rotateY(180deg);
  }

  /* Position the front and back side */
  .flip-card-front, .flip-card-back {
    position: absolute;
    width: 100%;
    height: 100%;
    -webkit-backface-visibility: hidden; /* Safari */
    backface-visibility: hidden;
  }

  /* Style the front side (fallback if image is missing) */
  .flip-card-front {
    color: black;
  }

  /* Style the back side */
  .flip-card-back {
    color: white;
    transform: rotateY(180deg);
  }

  .back-packs-btn {
    position: absolute;
    top: 490px;
  }

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
