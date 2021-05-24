/** @type {import('@docusaurus/types').DocusaurusConfig} */
module.exports = {
  title: 'Fronts',
  tagline: 'A progressive micro frontends framework for building Web applications',
  url: 'https://unadlib.github.io',
  baseUrl: '/fronts/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',
  organizationName: 'unadlib', // Usually your GitHub org/user name.
  projectName: 'fronts', // Usually your repo name.
  themeConfig: {
    navbar: {
      title: 'Fronts',
      logo: {
        alt: 'A progressive micro frontends framework for building Web applications',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'doc',
          docId: 'intro',
          position: 'left',
          label: 'Tutorial',
        },
        {to: '/blog', label: 'Blog', position: 'left'},
        {
          href: 'https://github.com/facebook/docusaurus',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Tutorial',
              to: '/docs/intro',
            },
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'Stack Overflow',
              href: 'https://stackoverflow.com/questions/tagged/fronts',
            },
            {
              label: 'Discord',
              href: 'https://discordapp.com/invite/fronts',
            },
            // {
            //   label: 'Twitter',
            //   href: 'https://twitter.com/fronts',
            // },
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'Blog',
              to: '/blog',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/unadlib/fronts',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Fronts Project, Inc. Built with Docusaurus.`,
    },
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          editUrl:
            'https://github.com/facebook/docusaurus/edit/master/website/',
        },
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          editUrl:
            'https://github.com/facebook/docusaurus/edit/master/website/blog/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
};
