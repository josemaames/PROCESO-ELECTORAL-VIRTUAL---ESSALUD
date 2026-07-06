import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/** Requiere sesión (llegar por SSO desde SOMOS). */
export const sesionGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (localStorage.getItem('votacion_usuario')) return true;
  router.navigate(['/bienvenida']);
  return false;
};

/** Requiere ser maestro/admin. */
export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const raw = localStorage.getItem('votacion_usuario');
  const u = raw ? JSON.parse(raw) : null;
  if (u?.esAdmin) return true;
  router.navigate(['/bienvenida']);
  return false;
};
