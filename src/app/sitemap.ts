import { MetadataRoute } from 'next';

/**
 * Dynamic sitemap for Virtual Breadboard Lab
 * Next.js 16 App Router will auto-generate sitemap.xml from this file
 * https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://vbl.eproject.tech';
  const lastModified = new Date();

  return [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    // Add future tutorial pages here as you create them
    // Example:
    // {
    //   url: `${baseUrl}/tutorials/555-timer-circuit`,
    //   lastModified,
    //   changeFrequency: 'monthly',
    //   priority: 0.8,
    // },
    // {
    //   url: `${baseUrl}/tutorials/logic-gates-basics`,
    //   lastModified,
    //   changeFrequency: 'monthly',
    //   priority: 0.8,
    // },
    // {
    //   url: `${baseUrl}/faq`,
    //   lastModified,
    //   changeFrequency: 'monthly',
    //   priority: 0.7,
    // },
  ];
}
