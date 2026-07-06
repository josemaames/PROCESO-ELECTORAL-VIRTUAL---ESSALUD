import { Component, inject, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

/**
 * Aterrizaje del SSO desde SOMOS. El backend valida el token y redirige aquí
 * con la sesión en base64 (?u=). Aquí se guarda en localStorage y se enruta:
 * maestro → estadísticas, votante → bienvenida.
 */
@Component({
  selector: 'app-sso',
  standalone: true,
  template: `<div class="sso-cargando">{{ mensaje }}</div>`,
  styles: [`
    .sso-cargando {
      display: flex; height: 100vh; align-items: center; justify-content: center;
      font-family: system-ui, sans-serif; font-size: 16px; color: #555;
    }
  `],
})
export class Sso implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  mensaje = 'Ingresando…';

  ngOnInit(): void {
    const u = this.route.snapshot.queryParamMap.get('u');
    if (!u) {
      this.mensaje = 'Enlace de ingreso inválido.';
      this.router.navigate(['/bienvenida']);
      return;
    }
    try {
      const json = decodeURIComponent(escape(atob(u)));
      const usuario = JSON.parse(json);
      localStorage.setItem('votacion_usuario', JSON.stringify(usuario));
      this.router.navigate([usuario.esAdmin ? '/estadisticas' : '/bienvenida']);
    } catch {
      this.mensaje = 'No se pudo procesar el ingreso.';
      this.router.navigate(['/bienvenida']);
    }
  }
}
