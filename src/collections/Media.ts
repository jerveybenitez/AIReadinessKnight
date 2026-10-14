import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: {
    // M14(b): media is immutable once uploaded — and since M14(a) the art uploads are
    // content-hashed (`name@2x.<hash>.webp`), so a long-lived immutable cache can never serve
    // stale bytes after a re-wire (new bytes are a new URL; see ADR 0006). Without the hash this
    // header would be a stale-by-construction bug under `art:wire --replace`, which recreates a
    // doc under the SAME filename with different bytes.
    modifyResponseHeaders: ({ headers }) => {
      headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    },
  },
}
