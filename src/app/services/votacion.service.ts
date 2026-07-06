import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Candidato {
  id_candidato: number;
  numero: number;
  nombre: string;
  cargo?: string;
  descripcion?: string;
  foto_url?: string;
}

export interface Proceso {
  id_proceso: number;
  titulo: string;
  descripcion?: string;
  condiciones_uso?: string;
}

export interface SesionVotante {
  dni: string;
  nombre: string;
  correo?: string;
  red?: string | null;
  esAdmin: boolean;
}

@Injectable({ providedIn: 'root' })
export class VotacionService {
  private http = inject(HttpClient);

  get usuario(): SesionVotante | null {
    const raw = localStorage.getItem('votacion_usuario');
    return raw ? JSON.parse(raw) : null;
  }

  getProceso(): Observable<{ proceso: Proceso | null; candidatos: Candidato[] }> {
    return this.http.get<{ proceso: Proceso | null; candidatos: Candidato[] }>('/api/proceso');
  }

  estadoVoto(dni: string, proceso: number): Observable<{ yaVoto: boolean }> {
    return this.http.get<{ yaVoto: boolean }>(
      `/api/estado-voto?dni=${encodeURIComponent(dni)}&proceso=${proceso}`,
    );
  }

  votar(body: {
    dni: string;
    nombre: string;
    red?: string | null;
    id_candidato: number;
    id_proceso: number;
    acepto: boolean;
  }): Observable<{ ok: boolean; mensaje: string }> {
    return this.http.post<{ ok: boolean; mensaje: string }>('/api/votar', body);
  }

  estadisticas(proceso: number, dni: string): Observable<any> {
    return this.http.get<any>(`/api/estadisticas?proceso=${proceso}&dni=${encodeURIComponent(dni)}`);
  }
}
