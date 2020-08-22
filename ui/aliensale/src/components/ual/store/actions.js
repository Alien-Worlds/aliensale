
export async function renderLoginModal ({ commit }, network) {
  commit('setShouldRenderLoginModal', true)
  commit('setCurrentNetwork', network)
  commit('bar_msg', `Log into ${network} network`)
}

export async function logout ({ state, commit }) {
  // console.log('logout')
  const activeAuth = state.activeAuthenticator
  if (activeAuth) {
    console.log(activeAuth)
    for (const network in activeAuth) {
      const aa = activeAuth[network]
      console.log(`Logging out from authenticator: ${aa.getStyle().text}`)

      aa
        .logout()
        .then(() => {
          console.log('Logged out!')
          commit('setActiveAuthenticator', false)
          commit('setAccountName', { network, accountName: null })
          commit('setSESSION', { data: { accountName: null, authenticatorName: null }, network })
        })
        .catch(e => {
          console.log(`An error occured while attempting to logout from authenticator: ${aa.getStyle().text}`, e)
        })
    }
  } else {
    console.log('No active authenticator found, you must be logged in before logging out.')
  }
}

export async function waitForAuthenticatorToLoad (_ = {}, authenticator) {
  return new Promise(resolve => {
    if (!authenticator.isLoading()) {
      resolve()
      return
    }
    const authenticatorIsLoadingCheck = setInterval(() => {
      if (!authenticator.isLoading()) {
        clearInterval(authenticatorIsLoadingCheck)
        resolve()
      }
    }, 250)
  })
}
export async function attemptAutoLogin ({ state, commit, dispatch }) {
  let { accountName, authenticatorName } = state.SESSION

  // check we dont have old formats
  if (accountName && typeof accountName === 'string') {
    accountName = null
  }
  if (authenticatorName && typeof authenticatorName === 'string') {
    authenticatorName = null
  }

  if (accountName && authenticatorName) {
    commit('setAccountName', accountName)
    console.log(`have account name and authenticator name ${accountName} ${authenticatorName}`)
    // dispatch('user/loggedInRoutine', accountName, { root: true })

    window.setTimeout(async () => {
      const authenticator = state.UAL.authenticators.find(a => a.getStyle().text === authenticatorName)
      if (!authenticator) {
        console.log(`Could not find authenticator ${authenticatorName}`)
        commit('setSESSION', { accountName: null, authenticatorName: null })
        return
      }
      await authenticator.reset()
      await authenticator.init()
      await dispatch('waitForAuthenticatorToLoad', authenticator)
      if (authenticator.initError) {
        console.log(
          `Attempt to auto login with authenticator ${authenticatorName} failed.`
        )
        authenticator.reset()
        // await dispatch('attemptAutoLogin')

        commit('setSESSION', { accountName: null, authenticatorName: null })
        return
      }

      console.log(`Auto login for ${accountName}`)

      authenticator
        .login(accountName)
        .then(() => {
          commit('setSESSION', { accountName, authenticatorName })
          commit('setActiveAuthenticator', authenticator)
          commit('setAccountName', accountName)
          dispatch('user/loggedInRoutine', accountName, { root: true })
        })
        .catch(e => {
          commit('setSESSION', { accountName: null, authenticatorName: null })
          console.log('auto login error', e, e.cause)
        })
    }, 500)
  } else {
    console.log('cannot autologin')
  }
}

export async function transact ({ state, dispatch, commit }, payload) {
  const { actions, network } = payload
  console.log(`Sending transaction on ${network}`, actions)
  const { accountName, authenticatorName, permission } = state.SESSION[network]
  console.log(`transact with stored state ${authenticatorName} ${accountName}@${permission}`, state.activeAuthenticator[network].users)
  // commit('setSigningOverlay', { show: true, status: 0, msg: 'Waiting for Signature', isShowCloseButton: false })
  const activeAuthenticator = state.activeAuthenticator[network]
  let user
  for (let u = 0; u < activeAuthenticator.users.length; u++) {
    if (await activeAuthenticator.users[u].getAccountName() === accountName) {
      user = activeAuthenticator.users[u]
    }
  }
  console.log('Users', user, activeAuthenticator.users)
  const copiedActions = actions.map((action, index) => {
    if (!action.authorization) {
      action.authorization = [{ actor: accountName, permission }]
    }
    return action
  })
  let res = null
  try {
    res = await user.signTransaction({ actions: copiedActions }, { broadcast: true })
    // afterTransact()
  } catch (e) {
    const [errMsg, errCode] = parseUalError(e)
    throw new Error(errMsg, errCode)
  }
  await commit('setSigningOverlay', { show: false, status: 0 })

  return res
}

export function hideSigningOverlay ({ commit }, ms = 10000) {
  return new Promise(resolve => {
    setTimeout(() => {
      commit('setSigningOverlay', { show: false, status: 0 })
      resolve()
    }, ms)
  })
}

function parseUalError (error) {
  let cause = 'unknown cause'
  let errorCode = ''
  if (error.cause) {
    cause = error.cause.reason || error.cause.message || 'Report this error to the eosDAC devs to enhance the UX'
    errorCode = error.cause.code || error.cause.errorCode
  } else if (error.message) {
    cause = error.message
    errorCode = error.code
  }
  return [cause, errorCode]
}
