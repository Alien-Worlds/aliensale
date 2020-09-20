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
                  <router-link to="/open" class="nav-link">Open Packs</router-link>
                </li>
                <li class="nav-item">
                  <router-link to="/redeem" class="nav-link">Redeem Voucher</router-link>
                </li>
                <li>
                  <div class="row" style="padding-left: 30px">
                    <div><img src="/images/wax-logo-white.png" :class="waxLogoClass" @click="login('wax')" /></div>
                    <div><img src="/images/eos-logo.png" :class="eosLogoClass" @click="login('eos')" /></div>
                  </div>
                </li>
                <li class="nav-item" v-if="getAccountName.wax || getAccountName.eos">
                  <div @click="logout()" style="padding-left: 30px">Logout</div>
                </li>
              </ul>
            </div>
          </div>
        </nav>
      </header>

      <div id="main-content">
        <router-view />
      </div>

    </q-page-container>
  </q-layout>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'MainLayout',
  components: {
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
    }
  },
  methods: {
    async logout () {
      // console.log('logout')
      this.$store.dispatch('ual/logout')
    },
    login (network) {
      this.$store.dispatch('ual/renderLoginModal', network, { root: true })
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

<style>
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
</style>
