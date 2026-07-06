import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { VotacionService } from '../../services/votacion.service';

interface RedAgrupada {
  red: string;
  total: number;
  candidatos: { numero: number; nombre: string; votos: number }[];
}

@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="est-wrap">
      <div class="est-head">
        <div>
          <h1>Panel del Maestro — Estadísticas</h1>
          <p class="est-sub">{{ tituloProceso }}</p>
        </div>
        <button class="est-refrescar" (click)="cargar()" title="Actualizar">&#8635;</button>
      </div>

      <div *ngIf="cargando" class="est-centro">Cargando estadísticas…</div>
      <div *ngIf="errorMsg" class="est-centro est-error">{{ errorMsg }}</div>

      <ng-container *ngIf="!cargando && !errorMsg">
        <!-- RESUMEN -->
        <div class="est-cards">
          <div class="est-card">
            <div class="est-card-val">{{ totalVotos | number }}</div>
            <div class="est-card-lbl">Votos emitidos</div>
          </div>
          <div class="est-card">
            <div class="est-card-val">{{ participacion | number }}</div>
            <div class="est-card-lbl">Participantes (padrón)</div>
          </div>
          <div class="est-card">
            <div class="est-card-val">{{ candidatoLider }}</div>
            <div class="est-card-lbl">Candidato líder</div>
          </div>
        </div>

        <!-- POR CANDIDATO -->
        <div class="est-panel">
          <h2>Resultados por candidato</h2>
          <div class="est-barra-row" *ngFor="let c of porCandidato">
            <div class="est-barra-lbl">
              <span><strong>N° {{ c.numero }}</strong> — {{ c.nombre }}</span>
              <span>{{ c.votos | number }} ({{ pct(c.votos) }}%)</span>
            </div>
            <div class="est-barra-bg">
              <div class="est-barra-fill" [style.width.%]="pct(c.votos)"></div>
            </div>
          </div>
          <p *ngIf="totalVotos === 0" class="est-vacio">Aún no hay votos registrados.</p>
        </div>

        <!-- POR RED -->
        <div class="est-panel">
          <h2>Votos por Red</h2>
          <p class="est-nota">
            El desglose por Red es agregado y anónimo (no revela por quién votó cada persona).
          </p>
          <div class="est-red" *ngFor="let r of redes">
            <div class="est-red-head">
              <strong>{{ r.red }}</strong>
              <span>{{ r.total | number }} votos</span>
            </div>
            <table class="est-tabla">
              <tr *ngFor="let c of r.candidatos">
                <td>N° {{ c.numero }} — {{ c.nombre }}</td>
                <td class="est-num">{{ c.votos | number }}</td>
              </tr>
            </table>
          </div>
          <p *ngIf="redes.length === 0" class="est-vacio">Sin datos por Red.</p>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .est-wrap { max-width: 960px; margin: 0 auto; padding: 28px; font-family: system-ui, sans-serif; }
    .est-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 24px; }
    h1 { color: #1a3d7c; font-size: 24px; margin: 0; }
    .est-sub { color: #64748b; margin: 4px 0 0; font-size: 14px; }
    .est-refrescar {
      width: 40px; height: 40px; border-radius: 10px; border: 1px solid #d0dbe6; background: #fff;
      font-size: 18px; cursor: pointer; color: #1a3d7c; flex-shrink: 0;
    }
    .est-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .est-card { background: #fff; border-radius: 14px; padding: 20px; box-shadow: 0 4px 14px rgba(0,0,0,.06); border-left: 4px solid #1a3d7c; }
    .est-card-val { font-size: 30px; font-weight: 800; color: #1a3d7c; }
    .est-card-lbl { color: #64748b; font-size: 13px; margin-top: 4px; }
    .est-panel { background: #fff; border-radius: 14px; padding: 24px; box-shadow: 0 4px 14px rgba(0,0,0,.06); margin-bottom: 20px; }
    .est-panel h2 { color: #1a3d7c; font-size: 18px; margin: 0 0 16px; }
    .est-barra-row { margin-bottom: 16px; }
    .est-barra-lbl { display: flex; justify-content: space-between; font-size: 14px; color: #334155; margin-bottom: 6px; }
    .est-barra-bg { height: 22px; background: #eef2f7; border-radius: 999px; overflow: hidden; }
    .est-barra-fill { height: 100%; background: linear-gradient(90deg, #2b4c9b, #1a3d7c); border-radius: 999px; transition: width .4s ease; }
    .est-nota { font-size: 12px; color: #8a9bb0; margin: 0 0 14px; }
    .est-red { border: 1px solid #eef1f5; border-radius: 10px; padding: 12px 16px; margin-bottom: 12px; }
    .est-red-head { display: flex; justify-content: space-between; color: #1f2d3d; margin-bottom: 6px; }
    .est-tabla { width: 100%; border-collapse: collapse; }
    .est-tabla td { padding: 5px 0; font-size: 14px; color: #475569; border-top: 1px solid #f1f5f9; }
    .est-num { text-align: right; font-weight: 700; color: #1a3d7c; }
    .est-centro { text-align: center; padding: 40px; color: #64748b; }
    .est-error { color: #dc2626; }
    .est-vacio { color: #94a3b8; text-align: center; padding: 12px; }
  `],
})
export class Estadisticas implements OnInit {
  private vs = inject(VotacionService);

  cargando = true;
  errorMsg = '';
  tituloProceso = '';
  totalVotos = 0;
  participacion = 0;
  porCandidato: { numero: number; nombre: string; votos: number }[] = [];
  redes: RedAgrupada[] = [];

  get candidatoLider(): string {
    if (!this.porCandidato.length || this.totalVotos === 0) return '—';
    const top = [...this.porCandidato].sort((a, b) => b.votos - a.votos)[0];
    return top.votos > 0 ? `N° ${top.numero}` : '—';
  }

  ngOnInit(): void {
    this.cargar();
  }

  pct(votos: number): number {
    return this.totalVotos > 0 ? Math.round((votos / this.totalVotos) * 100) : 0;
  }

  cargar(): void {
    const usuario = this.vs.usuario;
    if (!usuario) return;
    this.cargando = true;
    this.errorMsg = '';
    this.vs.getProceso().subscribe({
      next: ({ proceso }) => {
        if (!proceso) {
          this.cargando = false;
          this.errorMsg = 'No hay un proceso electoral.';
          return;
        }
        this.tituloProceso = proceso.titulo;
        this.vs.estadisticas(proceso.id_proceso, usuario.dni).subscribe({
          next: (data) => {
            this.totalVotos = data.totalVotos || 0;
            this.participacion = data.participacion || 0;
            this.porCandidato = data.porCandidato || [];
            this.redes = this.agruparPorRed(data.porRed || []);
            this.cargando = false;
          },
          error: (err) => {
            this.cargando = false;
            this.errorMsg = err.error?.error || 'No se pudieron cargar las estadísticas.';
          },
        });
      },
      error: () => {
        this.cargando = false;
        this.errorMsg = 'No se pudo cargar el proceso.';
      },
    });
  }

  private agruparPorRed(filas: any[]): RedAgrupada[] {
    const mapa = new Map<string, RedAgrupada>();
    for (const f of filas) {
      if (!mapa.has(f.red)) mapa.set(f.red, { red: f.red, total: 0, candidatos: [] });
      const g = mapa.get(f.red)!;
      g.candidatos.push({ numero: f.numero, nombre: f.nombre, votos: f.votos });
      g.total += f.votos;
    }
    return [...mapa.values()].sort((a, b) => b.total - a.total);
  }
}
