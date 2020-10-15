<template>
  <ul class="navbar-nav">
    <li class="nav-item">
      <a href="https://alienworlds.io" class="nav-link"><span @click="toggleMobileNav">Main Website</span></a>
    </li>
    <li class="nav-item">
      <router-link to="/inventory" class="nav-link"><span @click="toggleMobileNav">Inventory</span></router-link>
    </li>
    <li class="nav-item">
      <router-link to="/" class="nav-link"><span @click="toggleMobileNav">Buy Packs</span></router-link>
    </li>
    <li class="nav-item">
      <router-link to="/redeem" class="nav-link"><span @click="toggleMobileNav">Claim Airdrop</span></router-link>
    </li>
    <li id="login-buttons">
      <div class="row" style="padding-left: 30px">
        <b-dropdown style="margin-right:20px">
          <template v-slot:button-content>
            <img src="/images/wax-logo-white.png" :class="waxLogoClass" />
          </template>
          <b-dropdown-item href="#" disabled v-if="getAccountName.wax">{{getAccountName.wax}}</b-dropdown-item>
          <b-dropdown-item href="#" @click="login('wax')" v-if="!getAccountName.wax">Login</b-dropdown-item>
          <b-dropdown-item href="#" @click="logout('wax')" v-if="getAccountName.wax">Logout</b-dropdown-item>
        </b-dropdown>
        <!-- <b-dropdown style="margin-right:20px">
          <template v-slot:button-content>
            <img src="/images/eos-logo.png" :class="eosLogoClass" />
          </template>
          <b-dropdown-item href="#" disabled v-if="getAccountName.eos">{{getAccountName.eos}}</b-dropdown-item>
          <b-dropdown-item href="#" @click="login('eos')" v-if="!getAccountName.eos">Login</b-dropdown-item>
          <b-dropdown-item href="#" @click="logout('eos')" v-if="getAccountName.eos">Logout</b-dropdown-item>
        </b-dropdown> -->
        <b-dropdown>
          <template v-slot:button-content>
            <img src="/images/ethereum-logo.png" :class="ethereumLogoClass" />
          </template>
          <b-dropdown-item href="#" disabled v-if="getAccountName.ethereum">{{getAccountName.ethereum}}</b-dropdown-item>
          <b-dropdown-item href="#" @click="getReferralLink('ethereum')" v-if="getAccountName.ethereum">Get Referral Link</b-dropdown-item>
          <b-dropdown-item href="#" @click="login('ethereum')" v-if="!getAccountName.ethereum">Login</b-dropdown-item>
        </b-dropdown>
      </div>
    </li>
  </ul>
</template>

<style lang="scss">
  .login {
    height: 25px;
    cursor: pointer;
  }
  .wax-login {}
  .wax-login-inactive {
    opacity: 0.5;
    filter: grayscale(100%);
  }
  .eos-login {}
  .eos-login-inactive {
    opacity: 0.5;
  }
  .ethereum-login {}
  .ethereum-login-inactive {
    opacity: 0.5;
    filter: grayscale(100%);
  }
</style>

<script>
import { mapGetters } from 'vuex'
export default {
  name: 'MainMenu',
  computed: {
    ...mapGetters({
      getAccountName: 'ual/getAccountName'
    }),
    waxLogoClass () {
      return (this.getAccountName.wax) ? 'login wax-login' : 'login wax-login-inactive'
    },
    eosLogoClass () {
      return (this.getAccountName.eos) ? 'login eos-login' : 'login eos-login-inactive'
    },
    ethereumLogoClass () {
      return (this.getAccountName.ethereum) ? 'login ethereum-login' : 'login ethereum-login-inactive'
    },
    ...mapGetters({
      getAccountName: 'ual/getAccountName'
    })
  },
  methods: {
    async logout (network) {
      console.log('logout of network ', network)
      this.$store.dispatch('ual/logout', network)
    },
    async login (network) {
      if (network === 'ethereum') {
        const { injectedWeb3, web3 } = await this.$web3()
        // console.log(injectedWeb3, web3)

        if (injectedWeb3) {
          const ethAccount = await web3.eth.getAccounts()
          // console.log(ethAccount)
          this.$store.commit('ual/setAccountName', { network: 'ethereum', accountName: ethAccount[0] })
        }
      } else {
        this.$store.dispatch('ual/renderLoginModal', network, { root: true })
      }
    },
    getReferralLink (network) {
      if (this.getAccountName[network]) {
        this.toggleMobileNav()
        const u = new URL(document.location.href)
        const refLink = `${u.origin}/?r=${this.getAccountName[network]}`
        this.$swal({
          title: 'Referral Link',
          html: 'Use the following link to refer other users.  You will receve commission for every purchase made using this link' +
                  '<p><a href="' + refLink + '">' + refLink + '</a></p>'
        })
      }
    },
    toggleMobileNav (e) {
      const navBar = document.getElementById('navbar_mobile')
      this.toggleClass(navBar, 'show')
      this.toggleClass(document.body, 'offcanvas-active')
      const soEles = Array.from(document.getElementsByClassName('screen-overlay'))
      soEles.forEach(e => {
        this.toggleClass(e, 'show')
      })
    },
    toggleClass (ele, className) {
      if (ele.classList.contains(className)) {
        ele.classList.remove(className)
      } else {
        ele.classList.add(className)
      }
    }
  }
}
</script>
