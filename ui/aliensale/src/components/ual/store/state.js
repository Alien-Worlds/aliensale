export default {
  showLoginModal: false,
  signingOverlay: {
    show: false,
    status: '', // 0=wait for sig, 1=success, 2=error
    msg: '',
    isShowCloseButton: true
  },
  activeAuthenticator: {},
  authenticatorUser: {},
  currentNetwork: null,
  UAL: {},
  accountName: {
    wax: null,
    eos: null,
    eth: null
  },
  SESSION: {
    wax: {
      accountName: null,
      authenticatorName: null,
      timestamp: null
    },
    eos: {
      accountName: null,
      authenticatorName: null,
      timestamp: null
    },
    eth: {
      accountName: null,
      authenticatorName: null,
      timestamp: null
    }
  },
  paymentInfo: null
}
