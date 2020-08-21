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
                  <router-link to="/buy" class="nav-link">Buy Packs</router-link>
                </li>
                <li class="nav-item">
                  <router-link to="/open" class="nav-link">Open Packs</router-link>
                </li>
                <li class="nav-item">
                  <router-link to="/redeem" class="nav-link">Redeem Voucher</router-link>
                </li>
                <li>
                  <div v-if="getAccountName.wax">Logged in as {{ getAccountName.wax }} on wax</div>
                  <div v-if="getAccountName.eos">Logged in as {{ getAccountName.eos }} on eos</div>

                  <b-button @click="logout">Logout</b-button>
                </li>
              </ul>
            </div>
          </div>
        </nav>
      </header>

      <!-- <nav>
        <router-link to="/buy">Buy Packs</router-link> |
        <router-link to="/open">Open Packs</router-link>
      </nav>
      <div v-if="getAccountName.wax">Logged in as {{ getAccountName.wax }} on wax</div>
      <div v-if="getAccountName.eos">Logged in as {{ getAccountName.eos }} on eos</div>

      <q-btn @click="logout">Logout</q-btn> -->

      <div id="main-content">
        <router-view />
      </div>

    </q-page-container>
  </q-layout>
</template>

<script>
import { mapGetters } from 'vuex'
import { BButton } from 'bootstrap-vue'

export default {
  name: 'MainLayout',
  components: {
    'b-button': BButton
  },
  data () {
    return {
      accountName: this.getAccountName
    }
  },
  computed: {
    ...mapGetters({
      getAccountName: 'ual/getAccountName'
    })
  },
  methods: {
    async logout () {
      console.log('logout')
      this.$store.dispatch('ual/logout')
    }
  },
  async mounted () {
    this.$store.dispatch('ual/renderLoginModal', 'wax', { root: true })
    // this.$store.dispatch('ual/renderLoginModal', 'eos', { root: true })
  }
}
</script>
