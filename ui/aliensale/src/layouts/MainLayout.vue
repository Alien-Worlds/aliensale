<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <nav>
        <router-link to="/buy">Buy Packs</router-link> |
        <router-link to="/open">Open Packs</router-link>
      </nav>
      <div v-if="getAccountName.wax">Logged in as {{ getAccountName.wax }} on wax</div>
      <div v-if="getAccountName.eos">Logged in as {{ getAccountName.eos }} on eos</div>

      <q-btn @click="logout">Logout</q-btn>

      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'MainLayout',
  components: {},
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
