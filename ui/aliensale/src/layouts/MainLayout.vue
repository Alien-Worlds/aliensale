<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <header id="main-header">
        <nav class="navbar fixed-top navbar-expand-lg navbar-dark">
          <div class="container">
            <!-- Site Logo -->
            <a id="logo" class="navbar-brand" href="#"><img class="img-fluid" src="https://alienworlds.io/images/our%20logo.png" alt="site logo"></a>
            <!-- Navigation Links -->
            <div class="collapse navbar-collapse" id="navbarSupportedContent">
              <ul class="navbar-nav ml-auto">
                <li class="nav-item">
                  <router-link to="/inventory" class="nav-link">Inventory</router-link>
                </li>
                <li class="nav-item">
                  <router-link to="/buy" class="nav-link">Buy Packs</router-link>
                </li>
                <li class="nav-item">
                  <router-link to="/redeem" class="nav-link">Redeem Voucher</router-link>
                </li>
                <li>
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
                      <b-dropdown-item href="#" @click="login('ethereum')" v-if="!getAccountName.ethereum">Login</b-dropdown-item>
                    </b-dropdown>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </nav>
      </header>

      <div id="main-content">
        <router-view />
      </div>

      <footer id="main-footer">
        <div id="footer">
          <div class="container">
            <div class="row">
              <div class="col-md-12"><a target="_blank" href="https://dacoco.io">Copyright Dacoco GmbH 2020</a> :
                <a href="/terms">USER AGREEMENT / TERMS &amp; CONDITIONS</a> : <a target="_blank" href="https://drive.google.com/file/d/1nlY6SSujin8rmOEqoRDrBq7NK09EKvzh/view?usp=drivesdk">Presentation</a>

                <ul class="social-links">
                  <li><a href="https://www.twitter.com/alienworlds"><font-awesome-icon :icon="{ prefix: 'fab', iconName: 'twitter' }"/></a></li>
                  <li><a href="https://t.me/AlienWorldsOffical"><font-awesome-icon :icon="{ prefix: 'fab', iconName: 'telegram' }"/></a></li>
                  <li><a href="https://medium.com/@alienworlds"><font-awesome-icon :icon="{ prefix: 'fab', iconName: 'medium' }"/></a></li>
                  <li><a href="https://discord.io/AlienWorlds"><font-awesome-icon :icon="{ prefix: 'fab', iconName: 'discord' }"/></a></li>
                </ul>
              </div>
            </div>
          </div><!-- Container End -->
        </div>
      </footer>

    </q-page-container>
  </q-layout>
</template>

<script>
import { mapGetters } from 'vuex'
import { BDropdown, BDropdownItem } from 'bootstrap-vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

export default {
  name: 'MainLayout',
  components: {
    'b-dropdown': BDropdown,
    'b-dropdown-item': BDropdownItem,
    'font-awesome-icon': FontAwesomeIcon
  },
  data () {
    return {
      accountName: this.getAccountName
    }
  },
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
    }
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
    }
  },
  async mounted () {
    await this.$store.dispatch('ual/attemptAutoLogin')
    if (!this.getAccountName.wax) {
      await this.$store.dispatch('ual/renderLoginModal', 'wax', { root: true })
    }
    // this.$store.dispatch('ual/renderLoginModal', 'eos', { root: true })
  }
}
</script>

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
  #footer {
    width: 100%;
    min-height: 70px;
    height: auto;
    background: #070707;
    border-top: 2px solid #E48632;
    padding: 20px 0 0 0;

    a {
      color: #fff;

      :hover {
        color: #e48632
      }
    }

    .social-links {
      float: right;
      li {
        display: inline;
        margin-left: 15px;
      }
    }
  }
</style>
