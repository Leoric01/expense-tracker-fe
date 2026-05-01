/** Routy levého menu „Finance“ + /trackers (stejný kontext měny a souhrnu v hlavičce). */
export function isFinanceModulePath(pathname: string): boolean {
  if (pathname === '/prehled' || pathname.startsWith('/prehled/')) return true;
  if (pathname === '/categories' || pathname.startsWith('/categories/')) return true;
  if (pathname.startsWith('/transactions')) return true;
  if (pathname === '/trackers' || pathname.startsWith('/trackers/')) return true;
  return false;
}
