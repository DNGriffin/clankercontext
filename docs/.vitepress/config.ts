import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'ClankerContext',
  description: 'Documentation for ClankerContext — a Chrome Extension that generates LLM-optimized context for AI coding tools.',
  base: '/docs/',

  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/docs/icon.png' }],
  ],

  themeConfig: {
    logo: '/icon.png',

    nav: [
      { text: 'Home', link: 'https://dngriffin.github.io/clankercontext/' },
      { text: 'Quick Start', link: '/quick-start' },
      {
        text: 'Features',
        items: [
          { text: 'Element Capture', link: '/element-capture' },
          { text: 'Integrations', link: '/integrations' },
        ],
      },
      {
        text: 'Customization',
        items: [
          { text: 'Prompt Templates', link: '/prompt-templates' },
          { text: 'Custom Attributes', link: '/custom-attributes' },
        ],
      },
      {
        text: 'Install',
        link: 'https://chromewebstore.google.com/detail/clankercontext/jenjdejjifbfmlbipddgoohgboapbjhi',
      },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Introduction', link: '/' },
          { text: 'Quick Start', link: '/quick-start' },
        ],
      },
      {
        text: 'Core Features',
        items: [
          { text: 'Element Capture', link: '/element-capture' },
          { text: 'Integrations', link: '/integrations' },
        ],
      },
      {
        text: 'Customization',
        items: [
          { text: 'Prompt Templates', link: '/prompt-templates' },
          { text: 'Custom Attributes', link: '/custom-attributes' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/DNGriffin/clankercontext' },
    ],

    editLink: {
      pattern: 'https://github.com/DNGriffin/clankercontext/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    search: {
      provider: 'local',
    },
  },
})
