<template>

  <span>
    <span v-if="remaining.days > 0">{{remaining.days}} days, </span>
    <span v-if="remaining.hours !== '00'">{{remaining.hours}}:</span>
    <span>{{remaining.minutes}}:{{remaining.seconds}}</span>
  </span>

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
      const now = parseInt((new Date().getTime()))
      let remainder = parseInt((now - this.start) / 1000) * -1
      // console.log(remainder)
      let days = Math.floor(remainder / (60 * 60 * 24))
      remainder = remainder % (60 * 60 * 24)
      let hours = Math.floor(remainder / (60 * 60))
      remainder = remainder % (60 * 60)
      let minutes = Math.floor(remainder / 60)
      remainder = remainder % 60
      let seconds = remainder
      if (seconds <= 0 && minutes <= 0 && hours <= 0 && days <= 0) {
        this.$emit('finished')

        days = 0
        seconds = 0
        minutes = 0
        hours = 0
      }
      this.remaining = { days, hours: ('0' + hours).slice(-2), minutes: ('0' + minutes).slice(-2), seconds: ('0' + seconds).slice(-2) }
    }
  },
  async mounted () {
    this.updateRemaining()
    setInterval(this.updateRemaining, 1000)
  }
}
</script>
