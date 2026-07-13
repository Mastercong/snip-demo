import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { LinksService } from './links.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  urlInput = signal('');
  successMessage = signal('');
  errorMessage = signal('');
  isLoading = signal(false);

  constructor(public linksService: LinksService) {}

  get links() {
    return this.linksService.links;
  }

  ngOnInit() {
    this.linksService.loadLinks();
  }

  createLink() {
    const url = this.urlInput().trim();

    if (!url) {
      this.errorMessage.set('Please enter a URL');
      return;
    }

    if (!this.isValidUrl(url)) {
      this.errorMessage.set('URL must start with http:// or https://');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.linksService.createLink(url).subscribe({
      next: (link) => {
        this.successMessage.set(`Short link created: ${link.shortUrl}`);
        this.urlInput.set('');
        this.isLoading.set(false);
        this.linksService.loadLinks();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.error || 'Failed to create link');
      }
    });
  }

  private isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

