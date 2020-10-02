
export default ({ Vue, urlPath }) => {
  const [, search] = urlPath.split('?')
  let referrerAccount = ''
  if (typeof search !== 'undefined') {
    const referrerPart = search.split('&').filter(s => s.substr(0, 2) === 'r=')
    if (referrerPart.length) {
      [, referrerAccount] = referrerPart[0].split('=')
    }
  }
  console.log(`Referrer = ${referrerAccount}`)
  Vue.prototype.$referrer = referrerAccount
}
