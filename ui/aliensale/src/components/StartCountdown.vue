<template>

  <span><span v-if="remaining.hours !== '00'">{{remaining.hours}}:</span><span>{{remaining.minutes}}:{{remaining.seconds}}</span></span>

</template>

<script>

export default {
  name: 'StartCountdown',
  components: {},
  props: ['start'],
  computed: {

  },
  data () {
    return {
      remaining: {}
    }
  },
  methods: {
    updateRemaining: function () {
      const offset = (new Date()).getTimezoneOffset() * 60 * 1000
      const now = parseInt((new Date().getTime() + offset))
      let remainder = parseInt((now - this.start) / 1000) * -1
      const hours = Math.floor(remainder / (60 * 60))
      remainder = remainder % (60 * 60)
      const minutes = Math.floor(remainder / 60)
      remainder = remainder % 60
      const seconds = remainder
      if (seconds === 0 && minutes === 0 && hours === 0) {
        this.$emit('finished')
      }
      this.remaining = { hours: ('0' + hours).slice(-2), minutes: ('0' + minutes).slice(-2), seconds: ('0' + seconds).slice(-2) }
    }
  },
  async mounted () {
    this.updateRemaining()
    setInterval(this.updateRemaining, 1000)
  }
}
</script>
