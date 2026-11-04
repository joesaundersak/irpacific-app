import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'IR Pacific Operations',
    short_name: 'IR Pacific',
    description: 'Operations management platform for Interior Resources',
    start_url: '/',
    display: 'standalone',
    background_color: '#EEEEEE',
    theme_color: '#1A7B84',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  }
}
