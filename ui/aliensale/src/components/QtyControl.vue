<template>

  <p class="qty-control">
    <button type="minus" class="button" style="display:inline;" @click="decrementCounter">-</button>
    <input style="display:inline;" size="2" type="buy" ref="counter" name="buyamount" :value="value" min="0" :max="max" @input="onChange">
    <button type="plus" class="button" style="display:inline;" @click="incrementCounter">+</button>
  </p>

</template>

<script>
export default {
  name: 'QtyControl',
  components: {},
  props: ['value'],
  computed: {},
  data () {
    return {
      max: 1000
    }
  },
  methods: {
    onChange () {
      const newVal = this.$refs.counter.value
      this.$emit('input', newVal)
    },
    decrementCounter () {
      const ele = this.$refs.counter
      let currentVal = parseInt(ele.value)
      if (isNaN(currentVal)) {
        currentVal = 0
      }
      if (currentVal > 1) {
        ele.value = currentVal - 1
      }
      this.$emit('input', ele.value)
    },
    incrementCounter () {
      const ele = this.$refs.counter
      let currentVal = parseInt(ele.value)
      if (isNaN(currentVal)) {
        currentVal = 0
      }
      if (currentVal < this.max) {
        ele.value = currentVal + 1
      }
      this.$emit('input', ele.value)
    }
  },
  async mounted () {}
}
</script>
