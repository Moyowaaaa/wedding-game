import { PhotoGallery } from '@/components/photo-gallery';

export const metadata = {
  title: 'Wedding Photo Gallery',
  description: 'View all the photos from our wedding celebration!',
};

export default function GalleryPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
            Our Wedding Celebration
          </h1>
          <p className="text-lg text-muted-foreground">
            Moments captured by our wonderful guests
          </p>
        </div>

        <PhotoGallery />
      </div>
    </main>
  );
}
