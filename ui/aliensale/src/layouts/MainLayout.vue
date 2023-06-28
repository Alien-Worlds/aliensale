<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <b class="screen-overlay" @click="toggleMobileNav"></b>

      <header id="main-header">

          <div id="mobile_logo_header">
            <button data-trigger="#navbar_mobile" class="d-lg-none btn btn-warning" type="button" @click="toggleMobileNav">  <font-awesome-icon icon="bars" /> </button>
            <a id="logo" class="navbar-brand" href="https://alienworlds.io"><img class="img-fluid" src="https://alienworlds.io/assets/images/our-logo3-128x50.png" alt="site logo"></a>
          </div>

          <nav id="navbar_mobile" class="mobile-offcanvas navbar navbar-dark">
            <div class="offcanvas-header">
              <button class="btn btn-danger btn-close float-right" @click="toggleMobileNav"> <font-awesome-icon icon="times" /> </button>
            </div>
            <main-menu />
          </nav>

          <nav id="navbar_lg" class="navbar fixed-top navbar-expand-lg navbar-dark">
            <div class="container">
<!--            <button data-trigger="#navbar_main" class="d-lg-none btn btn-warning" type="button" @click="toggleMobileNav"> <font-awesome-icon icon="bars" /> </button>-->
            <a id="logo" class="navbar-brand" href="https://alienworlds.io/"><img class="img-fluid" src="public/images/our-logo3-128x50.png" alt="Alien Worlds"></a>
              <div class="collapse navbar-collapse" id="navbarSupportedContent">
                <main-menu />
              </div>
            </div>
          </nav>
      </header>

      <div id="main-content">
        <router-view />
      </div>

      <footer id="main-footer">
        <div id="footer">
          <div class="container">
            <div class="row">
              <div class="col-md-12"><a target="_blank" href="https://dacoco.io">Copyright Dacoco GmbH 2020</a> :
                <a href="/terms">USER AGREEMENT / TERMS &amp; CONDITIONS</a> : <a target="_blank" href="https://drive.google.com/file/d/1qmkQ33DJ5BWyHY3BKk2kkUdwj-3O1mTS/view">Presentation</a>

                <ul class="social-links">
                  <li><a href="mailto:help@dacoco.io"><font-awesome-icon icon="envelope-square"/></a></li>
                  <li><a href="https://www.twitter.com/alienworlds"><font-awesome-icon :icon="{ prefix: 'fab', iconName: 'twitter' }"/></a></li>
                  <li><a href="https://t.me/AlienWorldsOffical"><font-awesome-icon :icon="{ prefix: 'fab', iconName: 'telegram' }"/></a></li>
                  <li><a href="https://medium.com/@alienworlds"><font-awesome-icon :icon="{ prefix: 'fab', iconName: 'medium' }"/></a></li>
                  <li><a href="https://discord.io/AlienWorlds"><font-awesome-icon :icon="{ prefix: 'fab', iconName: 'discord' }"/></a></li>
                </ul>
              </div>
            </div>
          </div><!-- Container End -->
        </div>
      </footer>

    </q-page-container>
  </q-layout>
</template>

<script>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import MainMenu from 'components/MainMenu'

export default {
  name: 'MainLayout',
  components: {
    'font-awesome-icon': FontAwesomeIcon,
    'main-menu': MainMenu
  },
  data () {
    return {
      accountName: this.getAccountName
    }
  },
  methods: {
    toggleMobileNav (e) {
      e.preventDefault()
      e.stopPropagation()
      const navBar = document.getElementById('navbar_mobile')
      this.toggleClass(navBar, 'show')
      this.toggleClass(document.body, 'offcanvas-active')
      const soEles = Array.from(document.getElementsByClassName('screen-overlay'))
      soEles.forEach(e => {
        this.toggleClass(e, 'show')
      })
    },
    toggleClass (ele, className) {
      if (ele.classList.contains(className)) {
        ele.classList.remove(className)
      } else {
        ele.classList.add(className)
      }
    }
  },
  async mounted () {
    await this.$store.dispatch('ual/attemptAutoLogin')
    // if (!this.getAccountName.wax) {
    //   await this.$store.dispatch('ual/renderLoginModal', 'wax', { root: true })
    // }
    // this.$store.dispatch('ual/renderLoginModal', 'eos', { root: true })
  }
}
</script>

<style lang="scss">
  #footer {
    width: 100%;
    min-height: 70px;
    height: auto;
    background: #070707;
    border-top: 2px solid #E48632;
    padding: 20px 0 0 0;

    a {
      color: #fff;

      :hover {
        color: #e48632
      }
    }

    .social-links {
      float: right;
      li {
        display: inline;
        margin-left: 15px;
      }
    }
  }

</style>
