<template>
  <q-page class="full-width column wrap justify-start content-center">
    <div>
      <div class="text-h1">Open Packs</div>

      <pack-display :account="getAccountName"></pack-display>
    </div>
  </q-page>
</template>

<script>
import { mapGetters } from 'vuex'
import PackDisplay from 'components/PackDisplay'

export default {
  name: 'OpenPage',
  components: {
    'pack-display': PackDisplay
  },
  computed: {
    ...mapGetters({
      getAccountName: 'ual/getAccountName'
    })
  }
}
</script>
