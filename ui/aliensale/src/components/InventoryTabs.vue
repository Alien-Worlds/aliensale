<template>
  <div v-if="getAccountName.wax">
    <ul class="nav nav-pills">
      <li class="nav-item">
        <router-link to="/inventory" class="nav-link" :class="activeClass('cards')">Cards</router-link>
      </li>
      <li class="nav-item">
        <router-link to="/inventory/packs" class="nav-link" :class="activeClass('packs')">Packs</router-link>
      </li>
    </ul>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
export default {
  name: 'InventoryTabs',
  computed: {
    ...mapGetters({
      getAccountName: 'ual/getAccountName'
    })
  },
  methods: {
    activeClass: function (...names) {
      for (const name of names) {
        if (name === this.$route.name) {
          return 'active'
        }
      }
    }
  }
}
</script>
