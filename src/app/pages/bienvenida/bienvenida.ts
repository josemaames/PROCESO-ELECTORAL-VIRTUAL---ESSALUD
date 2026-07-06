import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { VotacionService } from '../../services/votacion.service';

@Component({
  selector: 'app-bienvenida',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bienv-wrap">
      <div class="bienv-card">
        <div class="bienv-logo">EsSalud</div>

        <ng-container *ngIf="usuario; else sinSesion">
          <h1>Bienvenido(a) al proceso electoral virtual</h1>
          <p class="bienv-sub">
            Estás en la plataforma de <strong>votación</strong> para la
            Elección de Representante de los Servidores ante el
            <strong>Comité de Planificación de la Capacitación</strong> del Seguro Social de Salud.
          </p>

          <div class="bienv-datos">
            <div><span>Votante</span><strong>{{ usuario.nombre || '—' }}</strong></div>
            <div><span>DNI</span><strong>{{ usuario.dni }}</strong></div>
            <div><span>Red</span><strong>{{ usuario.red || '—' }}</strong></div>
          </div>

          <p class="bienv-aviso">
            Tu voto es <strong>personal, secreto e irreversible</strong>. Solo podrás votar una vez.
          </p>

          <button class="bienv-btn" (click)="continuar()">Continuar a votar</button>

          <button *ngIf="usuario.esAdmin" class="bienv-btn-sec" (click)="verEstadisticas()">
            Ver estadísticas (maestro)
          </button>
        </ng-container>

        <ng-template #sinSesion>
          <h1>Acceso restringido</h1>
          <p class="bienv-sub">
            Para votar debes ingresar desde el portal <strong>SOMOS EsSalud</strong>,
            en la opción <strong>Votación</strong>. No es posible acceder directamente.
          </p>
        </ng-template>
      </div>
    </div>
  `,
  styles: [`
    .bienv-wrap {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #e8f0fb, #f4f7fb); padding: 24px;
      font-family: system-ui, sans-serif;
    }
    .bienv-card {
      background: #fff; border-radius: 18px; box-shadow: 0 12px 40px rgba(0,0,0,.12);
      max-width: 560px; width: 100%; padding: 40px; text-align: center;
    }
    .bienv-logo {
      display: inline-block; background: #1a3d7c; color: #fff; font-weight: 800;
      padding: 8px 18px; border-radius: 10px; letter-spacing: 1px; margin-bottom: 20px;
    }
    h1 { color: #1a3d7c; font-size: 24px; margin: 0 0 12px; }
    .bienv-sub { color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 20px; }
    .bienv-datos {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 20px 0;
      text-align: left;
    }
    .bienv-datos div {
      background: #f1f6fb; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column;
    }
    .bienv-datos span { font-size: 11px; color: #8a9bb0; text-transform: uppercase; }
    .bienv-datos strong { font-size: 14px; color: #1f2d3d; }
    .bienv-aviso {
      background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412;
      border-radius: 10px; padding: 12px; font-size: 13px; margin: 20px 0;
    }
    .bienv-btn {
      width: 100%; background: #1a3d7c; color: #fff; border: none; border-radius: 10px;
      padding: 14px; font-size: 16px; font-weight: 700; cursor: pointer; transition: background .15s;
    }
    .bienv-btn:hover { background: #142f61; }
    .bienv-btn-sec {
      width: 100%; margin-top: 10px; background: transparent; color: #1a3d7c;
      border: 1.5px solid #1a3d7c; border-radius: 10px; padding: 12px; font-weight: 600; cursor: pointer;
    }
  `],
})
export class Bienvenida {
  private router = inject(Router);
  private vs = inject(VotacionService);
  usuario = this.vs.usuario;

  continuar() {
    this.router.navigate(['/votacion']);
  }
  verEstadisticas() {
    this.router.navigate(['/estadisticas']);
  }
}
