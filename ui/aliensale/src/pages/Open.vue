<template>
  <q-page class="">

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

    <div id="video-container" v-if="openingPack">
      <div>
        <video width="100%" height="240" id="pack-open-video">
          <source :src="'/videos/' + openingPack.symbol + '_open.mp4'" type="video/mp4">
        </video>
      </div>
    </div>

    <div id="waiting-container" v-if="waitingPack && !packReveal && videoEnded">
      Waiting for pack open...
    </div>

    <div id="pack-reveal-container" v-if="packReveal" class="mt-8">

      <div class="d-flex flex-row flex-nowrap justify-content-center">
        <div style="width:300px;position: absolute; top:20px">
          <div v-for="(card, cardnum) in receivedCards" :key="cardnum" class="flip-card" @click="raiseCard(cardnum)">
            <div class="flip-card-inner" :class="'rarity-' + card.rarity.toLowerCase()">
              <div class="flip-card-front">
                <img :src="'https://ipfs.io/ipfs/' + card.img" style="width:300px;" />
              </div>
              <div class="flip-card-back">
                <img :src="'https://ipfs.io/ipfs/' + card.backimg" style="width:300px;">
              </div>
            </div>
          </div>
          <!-- Trilium card -->
          <div v-if="receivedTrilium > 0" class="flip-card" @click="raiseCard('trilium')">
            <div class="flip-card-inner rarity-trilium">
              <div class="flip-card-front">
                <img src="https://ipfs.io/ipfs/QmXnU2R7FG931FgP5ayT1EVTdCoi7NCC5noUktmVLXNUxz" style="width:300px;" />
                <div class="flip-card-tlm">
                  {{receivedTrilium}} TLM
                </div>
              </div>
              <div class="flip-card-back">
                <img src="https://ipfs.io/ipfs/QmW4Uzxj54kouPUM9q4r3FZz5mDqnJ86McJ39pGFLwpByM" style="width:300px;">
              </div>
            </div>
          </div>

        </div>
        <div class="back-packs-btn" v-if="revealComplete">
          <b-button @click="returnHome()">Return to packs</b-button>
        </div>
      </div>

    </div>

    <div id="open-packs-list-container" v-if="!inOpening" class="row justify-center">

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
// import io from 'socket.io-client'
import { BButton } from 'bootstrap-vue'
import fetch from 'node-fetch'
// let cards = {}

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
      confirmOpenPackShow: false,
      receivedTrilium: 0,
      manualFlip: false
    }
  },
  computed: {
    ...mapGetters({
      getAccountName: 'ual/getAccountName'
    })
  },
  methods: {
    returnHome () {
      this.inOpening = false
      this.packReveal = false
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
      // cards = {}
      // this.cards = {}
      this.openingPack = pack

      this.receivedCards = []
      this.revealComplete = false

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
      try {
        const res = await this.$store.dispatch('ual/transact', { actions, network: 'wax' })
        if (!res) {
          return
        }

        // Start polling for openlog action
        this.startPoll(res)

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
      } catch (e) {
        if (e.message.indexOf('Packs are already deposited') > -1) {
          console.log('open in progress')
          const actions = [{
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

          try {
            await this.$store.dispatch('ual/transact', { actions, network: 'wax' })
          } catch (e) {
            this.$showError(e.message)
          }
        } else {
          this.$showError(e.message)
        }
      }
    },
    startPoll (res) {
      this.pollTimer = setInterval(() => { this.poll(res.transaction.processed.block_time) }, 1000)
    },
    async poll (checkDate) {
      const url = `${this.$config.waxEndpoint}/v2/history/get_actions?account=${this.getAccountName.wax}&after=${checkDate}&filter=open.worlds:logopen`
      const res = await fetch(url)
      const json = await res.json()
      if (json.actions.length) {
        clearInterval(this.pollTimer)
        const cards = []
        const actionData = json.actions[0].act.data
        const templateIds = actionData.chosen_cards.map(c => c.template_id).filter(c => `${c}` !== '0')
        const templateUrl = `${this.$config.atomicEndpoint}/atomicassets/v1/templates?ids=${templateIds.join(',')}`
        const templatesRes = await fetch(templateUrl)
        const templates = await templatesRes.json()
        templateIds.forEach((tId) => {
          const template = templates.data.find(t => `${t.template_id}` === `${tId}`)
          cards.push(template.immutable_data)
        })
        // assets for land
        const assetIds = actionData.chosen_cards.map(c => c.asset_id).filter(c => `${c}` !== '0')
        const assetUrl = `${this.$config.atomicEndpoint}/atomicassets/v1/assets?ids=${assetIds.join(',')}`
        const assetsRes = await fetch(assetUrl)
        const assets = await assetsRes.json()
        assetIds.forEach((aId) => {
          const asset = assets.data.find(t => `${t.asset_id}` === `${aId}`)
          cards.push(asset.data)
        })

        this.receivedCards = cards

        // Check if any trilium is in the pack
        // console.log(actionData)
        const [tlmStr] = actionData.ft_bonus.split(' ')
        this.receivedTrilium = parseFloat(tlmStr).toFixed(2)
      }
    },
    flipCard (cardNo, callback = null) {
      const cardsElements = document.getElementsByClassName('flip-card')
      if (cardNo === 'trilium') {
        cardNo = cardsElements.length - 1
      }
      console.log(`Flipping card ${cardNo}`)
      cardsElements[cardNo].classList.add('flipped')
      if (callback) {
        callback(cardNo)
      }
    },
    calcStyle (n, len) {
      console.log(`Calc position for ${n} of ${len}`)
      const delta = 120 // space between cards
      const total = len * delta
      const left = (n / len * total) - ((total - 150) / 2)
      const centreDelta = Math.abs(left)
      const top = 20 + centreDelta / 5
      const rotate = left * 0.05
      return { left, top, rotate }
    },
    revealCard (cardNo, flip = true) {
      const cardsElements = document.getElementsByClassName('flip-card')
      console.log(`revealing ${cardsElements.length} cardsElements`, cardsElements, cardNo)
      const { left, top, rotate } = this.calcStyle(cardNo, cardsElements.length)
      console.log({ left, top, rotate })

      let revealDelay = 800
      if (cardsElements[cardNo].firstChild.classList.contains('rarity-epic')) {
        revealDelay = 1200
      } else if (cardsElements[cardNo].firstChild.classList.contains('rarity-legendary')) {
        revealDelay = 2500
      }
      const flipCardFn = () => {
        console.log('flip transition end listener, going to flip in ', revealDelay)
        setTimeout(() => {
          this.flipCard(cardNo, (cardNo) => {
            if (cardNo >= cardsElements.length - 1) {
              this.revealComplete = true
            } else {
              setTimeout(() => { this.revealCard(cardNo + 1) }, 1200)
            }
          })
        }, revealDelay)
      }
      if (flip) {
        cardsElements[cardNo].addEventListener('transitionend', flipCardFn)
      }

      if (cardNo === 0) {
        setTimeout(() => {
          cardsElements[cardNo].style.top = `${top}px`
          cardsElements[cardNo].style.left = `${left}px`
          cardsElements[cardNo].style.transform = `rotate(${rotate}deg)`
        }, 1000)
      } else {
        cardsElements[cardNo].style.top = `${top}px`
        cardsElements[cardNo].style.left = `${left}px`
        cardsElements[cardNo].style.transform = `rotate(${rotate}deg)`
      }
    },
    revealPack () {
      console.log('revealPack')
      this.revealCard(0)
    },
    raiseCard (cardNum) {
      if (!this.revealComplete && !this.manualFlip) {
        // switch to manual mode, dont raise cards
        const cardsElements = document.getElementsByClassName('flip-card')
        for (let c = 0; c < cardsElements.length; c++) {
          this.revealCard(c, false)
        }

        if (cardsElements[cardNum].style.zIndex === '10') {
          cardsElements[cardNum].style.zIndex = 0
        } else {
          cardsElements[cardNum].style.zIndex = 10
        }
        this.revealComplete = true
        this.manualFlip = true

        return
      }
      if (this.manualFlip) {
        this.flipCard(cardNum)
      }

      this.revealComplete = true

      const cardsElements = document.getElementsByClassName('flip-card')
      // console.log('raising card', cardsElements[cardNum].style.zIndex)
      let raiseCard = true
      if (cardsElements[cardNum].style.zIndex === '10') {
        // card already on top, let it go back to its place
        console.log('lowering card')
        raiseCard = false
      }
      for (let c = 0; c < cardsElements.length; c++) {
        const { top, left, rotate } = this.calcStyle(c, cardsElements.length)
        cardsElements[c].style.zIndex = 0
        cardsElements[c].style.top = `${top}px`
        cardsElements[c].style.left = `${left}px`
        cardsElements[c].style.transform = `rotate(${rotate}deg)`
      }

      if (raiseCard) {
        const { top, left, rotate } = this.calcStyle(cardNum, cardsElements.length)
        cardsElements[cardNum].style.zIndex = 10
        cardsElements[cardNum].style.top = `${top - 20}px`
        cardsElements[cardNum].style.left = `${left}px`
        cardsElements[cardNum].style.transform = `rotate(${rotate}deg)`
      }
    },
    showOpenDialog (pack) {
      this.$swal({
        title: 'Are you sure you want to open this pack?',
        text: pack.metadata.name,
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Yes, open it!'
      }).then((result) => {
        if (result.isConfirmed) {
          this.openPack(pack)
        }
      })
    }
  },
  watch: {
    getAccountName (accountName) {
      if (accountName) {
        // load the packs
        this.reloadPacks()
        // this.startListener()
      }
    },
    waitingPack (wp) {
      if (wp === false) {
        this.reloadPacks()
      }
    },
    receivedCards (cards) {
      if (this.openingPack) {
        console.log(`${cards.length} cards received, waiting for ${this.openingPack.number_cards}`)
        if (cards.length >= this.openingPack.number_cards) {
          console.log('got all cards')
          // shuffle cards
          for (var i = cards.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1))
            var temp = cards[i]
            cards[i] = cards[j]
            cards[j] = temp
          }
          this.packReveal = true
        }
      }
    },
    videoEnded (ve) {
      if (ve && this.packReveal) {
        console.log('Video has ended, going to reveal pack on next tick')
        this.$nextTick(this.revealPack.bind(this))
      } else if (ve) {
        console.log('Video has ended but packReveal is not set')
        this.waitingPack = true
      }
    },
    packReveal (pr) {
      if (pr && this.videoEnded) {
        this.$nextTick(this.revealPack.bind(this))
      } else if (pr) {
        console.log('Packreveal is set but video not ended yet')
      }
    }
  },
  async mounted () {
    this.reloadPacks()
    // this.startListener()
    // window.setInterval(this.reloadPacks, 5000)
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
  .flip-card .flip-card-inner {
    transform: rotateY(180deg);
  }
  .flip-card.flipped .flip-card-inner {
    transform: rotateY(0deg);
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

  .flip-card-tlm {
    position: relative;
    bottom: 173px;
    color: #232323;
    font-size: 1.6em;
    text-shadow: -1px -1px 0 #fff, 1px -1px 0 #333, -1px 1px 0 #000, 1px 1px 0 #000;
  }

  /* Style the back side */
  .flip-card-back {
    color: white;
    transform: rotateY(180deg);
  }

  /* Glow effects for special cards */
  @keyframes legendary-glow {
    0% {
      -webkit-filter: drop-shadow(0 0 2px #f0a600);
      filter: drop-shadow(0 0 2px #f0a600);
    }
    100% {
      -webkit-filter: drop-shadow(0 0 40px #f0a600);
      filter: drop-shadow(0 0 40px #f0a600);
    }
  }
  @keyframes mythical-glow {
    0% {
      -webkit-filter: drop-shadow(0 0 2px #9f2729);
      filter: drop-shadow(0 0 2px #9f2729);
    }
    100% {
      -webkit-filter: drop-shadow(0 0 60px #9f2729);
      filter: drop-shadow(0 0 60px #9f2729);
    }
  }
  .flip-card-inner.rarity-rare .flip-card-back {
    filter: drop-shadow(0 0 5px #62c7e0);
  }
  .flip-card-inner.rarity-epic .flip-card-back {
    filter: drop-shadow(0 0 20px #9749c9);
  }
  .flip-card .flip-card-inner.rarity-legendary .flip-card-back {
    animation: legendary-glow 1s alternate infinite;
  }
  .flip-card-inner.rarity-mythical .flip-card-back {
    animation: mythical-glow 1s alternate infinite;
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
