import Vue from 'vue'
import VueSweetalert2 from 'vue-sweetalert2'

const options = {
  confirmButtonColor: '#41b882',
  cancelButtonColor: '#c52323'
}

Vue.use(VueSweetalert2, options)
Vue.prototype.$showError = (err) => {
  err = err.replace('assertion failure with message: ', '')
  Vue.swal({
    title: 'Error!',
    text: err,
    icon: 'error'
  })
}
Vue.prototype.$showSuccess = (msg) => {
  Vue.swal({
    title: 'Success!',
    text: msg,
    icon: 'success'
  })
}
