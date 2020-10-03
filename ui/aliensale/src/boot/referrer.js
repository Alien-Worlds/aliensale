
export default ({ Vue, urlPath }) => {
  let referrerAccount = ''
  if (localStorage) {
    referrerAccount = localStorage.getItem('referrer') || ''
  }
  if (!referrerAccount) {
    const [, search] = urlPath.split('?')
    if (typeof search !== 'undefined') {
      const referrerPart = search.split('&').filter(s => s.substr(0, 2) === 'r=')
      if (referrerPart.length) {
        [, referrerAccount] = referrerPart[0].split('=')
      }
    }
  }

  if (localStorage && referrerAccount) {
    localStorage.setItem('referrer', referrerAccount)
  }

  console.log(`Referrer = ${referrerAccount}`)
  Vue.prototype.$referrer = referrerAccount
}
