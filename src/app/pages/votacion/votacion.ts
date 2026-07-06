import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { VotacionService, Candidato, Proceso } from '../../services/votacion.service';

type Estado = 'cargando' | 'sinProceso' | 'condiciones' | 'seleccion' | 'yaVoto' | 'exito';

@Component({
  selector: 'app-votacion',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="vot-wrap">
      <div class="vot-card">

        <!-- CARGANDO -->
        <div *ngIf="estado === 'cargando'" class="vot-centro">Cargando…</div>

        <!-- SIN PROCESO -->
        <div *ngIf="estado === 'sinProceso'" class="vot-centro">
          <h2>No hay un proceso electoral abierto</h2>
          <p>Vuelve a intentarlo cuando la votación esté habilitada.</p>
        </div>

        <!-- YA VOTÓ -->
        <div *ngIf="estado === 'yaVoto'" class="vot-centro vot-exito">
          <div class="vot-check">&#10003;</div>
          <h2>Ya registraste tu voto</h2>
          <p>Tu participación en este proceso ya fue registrada. Gracias.</p>
        </div>

        <!-- SELECCIÓN -->
        <ng-container *ngIf="estado === 'seleccion'">
          <h1>{{ proceso?.titulo }}</h1>
          <p class="vot-instr">Elige tu candidato. Recuerda: <strong>solo puedes votar una vez</strong>.</p>

          <div class="vot-candidatos">
            <button
              *ngFor="let c of candidatos"
              class="vot-candidato"
              [class.sel]="candidatoSel?.id_candidato === c.id_candidato"
              (click)="candidatoSel = c"
            >
              <div class="vot-num">{{ c.numero }}</div>
              <div class="vot-cand-info">
                <div class="vot-cand-nombre">{{ c.nombre }}</div>
                <div class="vot-cand-cargo" *ngIf="c.cargo">{{ c.cargo }}</div>
              </div>
              <div class="vot-radio" [class.on]="candidatoSel?.id_candidato === c.id_candidato"></div>
            </button>
          </div>

          <p class="vot-error" *ngIf="error">{{ error }}</p>

          <button class="vot-btn" [disabled]="!candidatoSel || enviando" (click)="abrirConfirmar()">
            Registrar voto
          </button>
        </ng-container>

        <!-- ÉXITO -->
        <div *ngIf="estado === 'exito'" class="vot-centro vot-exito">
          <div class="vot-check">&#10003;</div>
          <h2>¡Voto registrado con éxito!</h2>
          <p>Has concluido con tu votación. Gracias por participar.</p>
        </div>
      </div>
    </div>

    <!-- MODAL CONDICIONES DE USO -->
    <div class="vot-overlay" *ngIf="estado === 'condiciones'">
      <div class="vot-modal">
        <h2>Condiciones de uso</h2>
        <pre class="vot-condiciones">{{ proceso?.condiciones_uso }}</pre>
        <button class="vot-btn" (click)="aceptarCondiciones()">Aceptar</button>
      </div>
    </div>

    <!-- MODAL CONFIRMAR VOTO -->
    <div class="vot-overlay" *ngIf="mostrarConfirmar">
      <div class="vot-modal">
        <h2>Confirma tu voto</h2>
        <p class="vot-confirm-txt">
          Vas a votar por <strong>{{ candidatoSel?.nombre }}</strong>
          (N° {{ candidatoSel?.numero }}). Esta acción es <strong>irreversible</strong>.
        </p>
        <div class="vot-modal-btns">
          <button class="vot-btn-sec" (click)="mostrarConfirmar = false" [disabled]="enviando">Cancelar</button>
          <button class="vot-btn" (click)="confirmarVoto()" [disabled]="enviando">
            {{ enviando ? 'Registrando…' : 'Confirmar voto' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .vot-wrap {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #e8f0fb, #f4f7fb); padding: 24px;
      font-family: system-ui, sans-serif;
    }
    .vot-card {
      background: #fff; border-radius: 18px; box-shadow: 0 12px 40px rgba(0,0,0,.12);
      max-width: 620px; width: 100%; padding: 36px;
    }
    h1 { color: #1a3d7c; font-size: 22px; margin: 0 0 8px; text-align: center; }
    .vot-instr { color: #475569; text-align: center; margin: 0 0 24px; }
    .vot-candidatos { display: flex; flex-direction: column; gap: 12px; }
    .vot-candidato {
      display: flex; align-items: center; gap: 16px; padding: 16px; cursor: pointer;
      background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 14px; text-align: left;
      transition: all .15s;
    }
    .vot-candidato:hover { border-color: #93b4e6; }
    .vot-candidato.sel { border-color: #1a3d7c; background: #eef4fc; }
    .vot-num {
      width: 42px; height: 42px; border-radius: 50%; background: #1a3d7c; color: #fff;
      display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; flex-shrink: 0;
    }
    .vot-cand-info { flex: 1; }
    .vot-cand-nombre { font-weight: 700; color: #1f2d3d; font-size: 16px; }
    .vot-cand-cargo { font-size: 13px; color: #64748b; }
    .vot-radio { width: 22px; height: 22px; border-radius: 50%; border: 2px solid #cbd5e1; flex-shrink: 0; }
    .vot-radio.on { border-color: #1a3d7c; background: #1a3d7c; box-shadow: inset 0 0 0 4px #fff; }
    .vot-btn {
      width: 100%; background: #1a3d7c; color: #fff; border: none; border-radius: 10px;
      padding: 14px; font-size: 16px; font-weight: 700; cursor: pointer; margin-top: 24px; transition: background .15s;
    }
    .vot-btn:hover:not(:disabled) { background: #142f61; }
    .vot-btn:disabled { opacity: .5; cursor: not-allowed; }
    .vot-btn-sec {
      flex: 1; background: #fff; color: #64748b; border: 1.5px solid #cbd5e1; border-radius: 10px;
      padding: 14px; font-weight: 600; cursor: pointer; margin-top: 24px;
    }
    .vot-error { color: #dc2626; text-align: center; margin-top: 12px; }
    .vot-centro { text-align: center; padding: 30px 10px; }
    .vot-centro h2 { color: #1a3d7c; }
    .vot-exito .vot-check {
      width: 68px; height: 68px; border-radius: 50%; background: #16a34a; color: #fff;
      font-size: 38px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
    }
    .vot-overlay {
      position: fixed; inset: 0; background: rgba(15,30,60,.55); display: flex;
      align-items: center; justify-content: center; padding: 24px; z-index: 100;
    }
    .vot-modal {
      background: #fff; border-radius: 16px; max-width: 520px; width: 100%; padding: 30px;
      font-family: system-ui, sans-serif;
    }
    .vot-modal h2 { color: #1a3d7c; margin: 0 0 16px; }
    .vot-condiciones {
      white-space: pre-wrap; font-family: system-ui, sans-serif; font-size: 14px; color: #334155;
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; margin: 0;
      max-height: 320px; overflow: auto;
    }
    .vot-confirm-txt { color: #334155; font-size: 15px; line-height: 1.6; }
    .vot-modal-btns { display: flex; gap: 12px; }
  `],
})
export class Votacion implements OnInit {
  private vs = inject(VotacionService);
  private router = inject(Router);

  estado: Estado = 'cargando';
  proceso: Proceso | null = null;
  candidatos: Candidato[] = [];
  candidatoSel: Candidato | null = null;
  mostrarConfirmar = false;
  enviando = false;
  error = '';

  ngOnInit(): void {
    const usuario = this.vs.usuario;
    if (!usuario) {
      this.router.navigate(['/bienvenida']);
      return;
    }
    this.vs.getProceso().subscribe({
      next: ({ proceso, candidatos }) => {
        if (!proceso) {
          this.estado = 'sinProceso';
          return;
        }
        this.proceso = proceso;
        this.candidatos = candidatos;
        this.vs.estadoVoto(usuario.dni, proceso.id_proceso).subscribe({
          next: ({ yaVoto }) => {
            this.estado = yaVoto ? 'yaVoto' : 'condiciones';
          },
          error: () => (this.estado = 'condiciones'),
        });
      },
      error: () => (this.estado = 'sinProceso'),
    });
  }

  aceptarCondiciones() {
    this.estado = 'seleccion';
  }

  abrirConfirmar() {
    if (!this.candidatoSel) return;
    this.error = '';
    this.mostrarConfirmar = true;
  }

  confirmarVoto() {
    const usuario = this.vs.usuario;
    if (!usuario || !this.candidatoSel || !this.proceso) return;
    this.enviando = true;
    this.vs
      .votar({
        dni: usuario.dni,
        nombre: usuario.nombre,
        red: usuario.red,
        id_candidato: this.candidatoSel.id_candidato,
        id_proceso: this.proceso.id_proceso,
        acepto: true,
      })
      .subscribe({
        next: () => {
          this.enviando = false;
          this.mostrarConfirmar = false;
          this.estado = 'exito';
        },
        error: (err) => {
          this.enviando = false;
          this.mostrarConfirmar = false;
          if (err.status === 409) {
            this.estado = 'yaVoto';
          } else {
            this.error = err.error?.error || 'No se pudo registrar el voto. Intenta de nuevo.';
          }
        },
      });
  }
}
