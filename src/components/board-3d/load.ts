/**
 * Loads the 3D view (and three.js with it) as its own chunk. The only way
 * the rest of the app may reach board-3d - importing it directly would pull
 * three.js into the main bundle (scripts/check-bundle.mjs fails if it does).
 */
export const load3DView = () => import('./board-3d');
