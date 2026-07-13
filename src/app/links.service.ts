import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { signal } from '@angular/core';

export interface Link {
  code: string;
  url: string;
  shortUrl: string;
  hits: number;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class LinksService {
  private readonly apiUrl = 'http://localhost:3000/api/links';
  links = signal<Link[]>([]);

  constructor(private http: HttpClient) {}

  createLink(url: string) {
    return this.http.post<Link>(this.apiUrl, { url });
  }

  getLinks() {
    return this.http.get<Link[]>(this.apiUrl);
  }

  loadLinks() {
    this.getLinks().subscribe({
      next: (links) => this.links.set(links),
      error: (err) => console.error('Failed to load links', err)
    });
  }
}
