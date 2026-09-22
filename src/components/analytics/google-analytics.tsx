import Script from 'next/script';

/**
 * Google Analytics 4, mounted once in the root layout.
 *
 * The root layout at `src/app/layout.tsx` is the only one that renders `<html>`
 * — `(admin)/layout.tsx` and `(pages)/teams/layout.tsx` nest inside it — so
 * putting the tag here covers every route in the app and cannot double up.
 * **Do not add it to a page or a nested layout as well**; two copies on a page
 * double every hit.
 *
 * `next/script` rather than raw `<script>` tags: React strips a bare inline
 * script's contents on the server, and Next dedupes a Script by `id` if a route
 * ever mounts it twice. `afterInteractive` is where Google's own Next.js
 * guidance puts gtag — it still loads on the first paint of every page, and
 * blocking on an analytics beacon before hydration would cost more than it
 * measures.
 *
 * Development is excluded so localhost traffic does not land in the property.
 * Vercel builds — preview and production alike — run with NODE_ENV=production,
 * so both report.
 */

/** The measurement ID is public by design: it ships in the page to every visitor. */
const GA_MEASUREMENT_ID = 'G-ZELWB9K8VC';

export function GoogleAnalytics() {
  if (process.env.NODE_ENV !== 'production') return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`}
      </Script>
    </>
  );
}
