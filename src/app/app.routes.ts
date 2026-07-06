import { Routes } from '@angular/router';

import { Sso } from './pages/sso/sso';
import { Bienvenida } from './pages/bienvenida/bienvenida';
import { Votacion } from './pages/votacion/votacion';
import { Estadisticas } from './pages/estadisticas/estadisticas';
import { sesionGuard, adminGuard } from './guards/sesion-guard';

export const routes: Routes = [
  { path: '', redirectTo: 'bienvenida', pathMatch: 'full' },
  { path: 'sso', component: Sso },
  { path: 'bienvenida', component: Bienvenida },
  { path: 'votacion', component: Votacion, canActivate: [sesionGuard] },
  { path: 'estadisticas', component: Estadisticas, canActivate: [adminGuard] },
  { path: '**', redirectTo: 'bienvenida' },
];
