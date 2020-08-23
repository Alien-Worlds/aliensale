<template>
  <q-page class="full-width column wrap justify-start content-center">
    <div>
      <div class="text-h1">Redeem Vouchers</div>

    </div>
  </q-page>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'RedeemPage',
  components: {},
  computed: {
    ...mapGetters({
      getAccountName: 'ual/getAccountName'
    })
  }
}
</script>
