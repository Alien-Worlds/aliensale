export function setShouldRenderLoginModal (state, payload) {
  state.showLoginModal = payload
}

export function setCurrentNetwork (state, payload) {
  state.currentNetwork = payload
}

export function setSigningOverlay (state, payload) {
  state.signingOverlay = Object.assign(state.signingOverlay, payload)
}

export function setUAL (state, payload) {
  state.UAL = payload
}

export function setActiveAuthenticator (state, payload) {
  state.activeAuthenticator[payload.network] = payload.authenticator
}

export function setAuthenticatorUser (state, payload) {
  // state.authenticatorUser[payload.network] = payload.user
}

export function setSESSION (state, payload) {
  payload.data.timestamp = new Date().getTime()
  state.SESSION[payload.network] = Object.assign(state.SESSION[payload.network], payload.data)
}

export function setAccountName (state, payload) {
  state.accountName[payload.network] = payload.accountName
  console.log('Set account name', payload)
}

export function setPaymentInfo (state, payload) {
  state.paymentInfo = payload
}
