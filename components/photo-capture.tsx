"use client";

import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Video, X } from "lucide-react";
import Image from "next/image";

interface PhotoCaptureProps {
  onPhotoSelected: (file: File) => void;
  previewUrl?: string;
}

export function PhotoCapture({
  onPhotoSelected,
  previewUrl,
}: PhotoCaptureProps) {
  const [preview, setPreview] = useState<string | undefined>(previewUrl);
  const [previewType, setPreviewType] = useState<"image" | "video">("image");
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCapturing(true);
      }
    } catch (error) {
      console.error("Failed to access camera:", error);
      alert("Unable to access camera. Please check permissions.");
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext("2d");
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);

        const imageUrl = canvasRef.current.toDataURL("image/jpeg", 0.9);
        setPreview(imageUrl);
        setPreviewType("image");

        // Convert canvas to blob and create File
        canvasRef.current.toBlob(
          (blob) => {
            if (blob) {
              const file = new File([blob], `photo-${Date.now()}.jpg`, {
                type: "image/jpeg",
              });
              onPhotoSelected(file);
            }
          },
          "image/jpeg",
          0.9,
        );

        stopCamera();
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      setIsCapturing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVideo = file.type.startsWith("video/");
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      setPreviewType(isVideo ? "video" : "image");
      onPhotoSelected(file);
    }
  };

  const clearPhoto = () => {
    if (preview && preview.startsWith("blob:")) {
      URL.revokeObjectURL(preview);
    }
    setPreview(undefined);
    setPreviewType("image");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  if (preview) {
    return (
      <Card className="p-6 bg-card border border-border">
        <div className="space-y-4">
          <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-secondary">
            {previewType === "video" ? (
              <video
                src={preview}
                controls
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <Image
                src={preview}
                alt="Captured photo"
                fill
                className="object-cover"
              />
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={clearPhoto} variant="outline" className="flex-1">
              <X className="w-4 h-4 mr-2" />
              Retake
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (isCapturing) {
    return (
      <Card className="p-6 bg-card border border-border">
        <div className="space-y-4">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full rounded-lg bg-secondary"
          />
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-2">
            <Button
              onClick={capturePhoto}
              className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <Camera className="w-4 h-4 mr-2" />
              Take Photo
            </Button>
            <Button onClick={stopCamera} variant="outline" className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-card border border-border">
      <div className="space-y-4">
        <div className="text-center space-y-2">
          <div className="text-4xl mb-4">📸</div>
          <p className="text-sm text-muted-foreground">
            Ready to capture this moment?
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            onClick={startCamera}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Camera className="w-4 h-4 mr-2" />
            Take a Photo
          </Button>
          <Button
            onClick={() => videoInputRef.current?.click()}
            variant="outline"
            className="w-full"
          >
            <Video className="w-4 h-4 mr-2" />
            Record a Video
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Photo or Video
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            capture="environment"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>
      </div>
    </Card>
  );
}
