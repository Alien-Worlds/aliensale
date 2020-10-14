<script>
import countryList from 'country-list'

export default {
  name: 'CountrySelect',
  components: {},
  props: {
    value: {
      type: String
    }
  },
  computed: {},
  data () {
    return {
      max: 1000
    }
  },
  methods: {
    show (auctionData) {
      console.log('Show country!!')
      this.$swal({
        title: 'Please Confirm',
        preConfirm: () => {
          const over18Ele = document.getElementById('agree18')
          const agreeTermsEle = document.getElementById('agreeterms')
          const countryEle = document.getElementById('country')
          if (!over18Ele.checked) {
            this.showBuyError('You must check the box to say you are over 18')
            return false
          } else if (!agreeTermsEle.checked) {
            this.showBuyError('You must agree to the terms')
            return false
          } else if (!countryEle.value) {
            this.showBuyError('Please choose your country')
            return false
          }

          // country = countryEle.value

          return true
        },
        html: this.getConfirmHTML(auctionData)
      }).then(async res => {
        // console.log(res)
        if (!res.isConfirmed) {
          console.log('Dialog not confirmed')
          return
        }

        const country = document.getElementById('country').value
        // console.log('blah', country)
        this.$emit('selected', country)
      })
    },
    showBuyError (msg) {
      const err = document.getElementById('buy-confirm-error')
      err.innerHTML = msg
    },
    getCountryDropdownHTML () {
      // console.log(countryList.getData())
      const countries = countryList.getData().sort((a, b) => (a.name < b.name) ? -1 : 1).map(d => {
        d.name = d.name.replace('of Great Britain and Northern Ireland', '')
        return d
      })
      const special = ['GB', 'US', 'CA', 'ES', 'CN', 'KR']
      const specialCountries = countries.filter(c => special.includes(c.code))

      const selectList = document.createElement('select')
      selectList.id = 'country'

      const optiona = document.createElement('option')
      optiona.value = ''
      optiona.text = 'Choose Country'
      selectList.appendChild(optiona)

      const optionb = document.createElement('option')
      optionb.value = ''
      optionb.text = '-----------------------------------'
      optionb.disabled = true
      selectList.appendChild(optionb)

      for (let i = 0; i < specialCountries.length; i++) {
        const option = document.createElement('option')
        option.value = specialCountries[i].code
        option.text = specialCountries[i].name
        selectList.appendChild(option)
      }

      const option = document.createElement('option')
      option.value = ''
      option.text = '-----------------------------------'
      option.disabled = true
      selectList.appendChild(option)

      for (let i = 0; i < countries.length; i++) {
        const option = document.createElement('option')
        option.value = countries[i].code
        option.text = countries[i].name
        selectList.appendChild(option)
      }

      return selectList.outerHTML
    },
    getConfirmHTML (auctionData) {
      const html = '<div>' +
          '<p>Please confirm you would like to buy the following pack</p>' +
          `<p>${auctionData.pack_data.metadata.name}</p>` +
          '<p>' +
          '<label>' + this.getCountryDropdownHTML() + '</label>' +
          '<label><input type="checkbox" id="agree18" class="checkb"> I am over 18</label>' +
          '<br><label><input type="checkbox" id="agreeterms" class="checkb"> I have read the terms and conditions</label>' +
          '</p>' +
          '<div id="buy-confirm-error"></div></div>'
      return html
    }
  },
  async mounted () {}
}
</script>
