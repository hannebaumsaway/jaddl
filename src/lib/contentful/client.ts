import { createClient } from 'contentful';
import type { ContentfulClientApi, CreateClientParams } from 'contentful';

const space = process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID;
const accessToken = process.env.NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN;
const previewAccessToken = process.env.CONTENTFUL_PREVIEW_ACCESS_TOKEN;

if (!space || !accessToken) {
  throw new Error(
    'Contentful space ID and access token must be provided. Check your environment variables.'
  );
}

// Client for published content
const clientConfig: CreateClientParams = {
  space,
  accessToken,
};

export const contentfulClient: ContentfulClientApi<any> = createClient(clientConfig);

// Preview client for draft content (if preview token is available)
export const previewClient: ContentfulClientApi<any> | null = previewAccessToken
  ? createClient({
      space,
      accessToken: previewAccessToken,
      host: 'preview.contentful.com',
    })
  : null;

// Helper function to get the appropriate client based on preview mode
export function getContentfulClient(preview = false): ContentfulClientApi<any> {
  if (preview && previewClient) {
    return previewClient;
  }
  return contentfulClient;
}
