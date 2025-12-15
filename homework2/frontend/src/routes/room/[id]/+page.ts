import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
  return {
    sessionId: params.id
  };
};

// Disable prerendering and SSR for this dynamic route
export const prerender = false;
export const ssr = false;

