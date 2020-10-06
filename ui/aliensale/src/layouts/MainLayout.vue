<template>
  <q-layout view="lHh Lpr lFf">
    <q-page-container>
      <b class="screen-overlay" @click="toggleMobileNav"></b>

      <header id="main-header">
        <div class="container">

          <div id="mobile_logo_header">
            <button data-trigger="#navbar_mobile" class="d-lg-none btn btn-warning" type="button" @click="toggleMobileNav">  Show navbar </button>
            <a id="logo" class="navbar-brand" href="/"><img class="img-fluid" src="https://alienworlds.io/images/our%20logo.png" alt="site logo"></a>
          </div>

          <nav id="navbar_mobile" class="mobile-offcanvas navbar navbar-dark">
            <div class="offcanvas-header">
              <button class="btn btn-danger btn-close float-right" @click="toggleMobileNav"> &times; </button>
            </div>
            <main-menu />
          </nav>

          <nav id="navbar_lg" class="navbar fixed-top navbar-expand-lg navbar-dark">
            <button data-trigger="#navbar_main" class="d-lg-none btn btn-warning" type="button" @click="toggleMobileNav">  Show navbar </button>
            <a id="logo" class="navbar-brand" href="/"><img class="img-fluid" src="https://alienworlds.io/images/our%20logo.png" alt="site logo"></a>
              <div class="collapse navbar-collapse" id="navbarSupportedContent">
                <main-menu />
              </div>
          </nav>
        </div>
      </header>

      <div id="main-content">
        <router-view />
      </div>

      <footer id="main-footer">
        <div id="footer">
          <div class="container">
            <div class="row">
              <div class="col-md-12"><a target="_blank" href="https://dacoco.io">Copyright Dacoco GmbH 2020</a> :
                <a href="/terms">USER AGREEMENT / TERMS &amp; CONDITIONS</a> : <a target="_blank" href="https://drive.google.com/file/d/1nlY6SSujin8rmOEqoRDrBq7NK09EKvzh/view?usp=drivesdk">Presentation</a>

                <ul class="social-links">
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

  .offcanvas-header{ display:none; }
  .screen-overlay {
    height: 100%;
    z-index: 30;
    position: fixed;
    top: 0;
    left: 0;
    opacity:0;
    visibility:hidden;
    background-color: rgba(34, 34, 34, 0.6);
    transition:opacity .2s linear, visibility .1s, width 1s ease-in;
  }
  .screen-overlay.show {
    transition:opacity .5s ease, width 0s;
    opacity:1;
    width:100%;
    visibility:visible;
  }

  #navbar_mobile, #mobile_logo_header {
    display: none;
  }
  #navbar_mobile {
    overflow: hidden;
  }

</style>
