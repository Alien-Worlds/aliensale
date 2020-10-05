
const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/Index.vue') }
    ]
  },
  {
    path: '/buy',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/BuyIndex.vue') },
      { name: 'auction', path: '/buy/:auction_id', component: () => import('pages/Buy.vue') }
    ]
  },
  {
    path: '/redeem',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/Redeem.vue') }
    ]
  },
  {
    path: '/inventory',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { name: 'cards', path: '/inventory', component: () => import('pages/Inventory.vue') },
      { name: 'packs', path: '/inventory/packs', component: () => import('pages/Open.vue') }
    ]
  },
  {
    path: '/terms',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/Terms.vue') }
    ]
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '*',
    component: () => import('pages/Error404.vue')
  }
]

export default routes
