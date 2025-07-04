import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  get<T>(endpoint: string, params: any = {}): Observable<T> {
    let httpParams = new HttpParams();
    for (const key in params) {
      if (params.hasOwnProperty(key)) {
        httpParams = httpParams.set(key, params[key]);
      }
    }
    
    // Remove leading slash from endpoint to avoid double slashes
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    return this.http.get<T>(`${this.apiUrl}/${cleanEndpoint}`, { params: httpParams });
  }

  post<T>(endpoint: string, data: any = {}): Observable<T> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    return this.http.post<T>(`${this.apiUrl}/${cleanEndpoint}`, data);
  }

  put<T>(endpoint: string, data: any = {}): Observable<T> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    return this.http.put<T>(`${this.apiUrl}/${cleanEndpoint}`, data);
  }

  delete<T>(endpoint: string): Observable<T> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    return this.http.delete<T>(`${this.apiUrl}/${cleanEndpoint}`);
  }
}