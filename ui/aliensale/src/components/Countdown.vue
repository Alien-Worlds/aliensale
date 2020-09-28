<template>

  <span><span v-if="remaining.hours !== '00'">{{remaining.hours}}:</span><span>{{remaining.minutes}}:{{remaining.seconds}}</span></span>

</template>

<script>

export default {
  name: 'Countdown',
  components: {},
  props: ['start', 'period'],
  computed: {

  },
  data () {
    return {
      remaining: {}
    }
  },
  methods: {
    updateRemaining: function () {
      const diff = parseInt((Date.now() - this.start) / 1000)
      let remainder = this.period - (diff % this.period)
      const hours = Math.floor(remainder / (60 * 60))
      remainder = remainder % (60 * 60)
      const minutes = Math.floor(remainder / 60)
      remainder = remainder % 60
      const seconds = remainder
      this.remaining = { hours: ('0' + hours).slice(-2), minutes: ('0' + minutes).slice(-2), seconds: ('0' + seconds).slice(-2) }
    }
  },
  async mounted () {
    this.updateRemaining()
    setInterval(this.updateRemaining, 1000)
  }
}
</script>
