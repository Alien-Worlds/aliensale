<template>
  <div>
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
export default {
  name: 'InventoryTabs',
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
