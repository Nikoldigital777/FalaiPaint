import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, X, Image, VenetianMask, User, Palette, FileImage } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  type: "background" | "mask" | "pose" | "style" | "lut";
  value?: string;
  onChange: (url: string) => void;
  className?: string;
}

const uploadConfig = {
  background: {
    icon: Image,
    title: "Background Scene",
    description: "Drop background image or click to browse",
    hint: "Recommended: 1024x1024px, JPG/PNG"
  },
  mask: {
    icon: VenetianMask,
    title: "Inpainting Mask", 
    description: "Drop mask image or click to browse",
    hint: "White = inpaint area, Black = preserve"
  },
  pose: {
    icon: User,
    title: "Pose Reference",
    description: "Drop pose reference or click to browse", 
    hint: "Person in desired pose position"
  },
  style: {
    icon: Palette,
    title: "Style Reference",
    description: "Drop style guide image or click to browse",
    hint: "Reference for color, mood, and aesthetic"
  },
  lut: {
    icon: FileImage,
    title: "LUT File (Optional)",
    description: "Drop color grading LUT or click to browse",
    hint: "For advanced color matching"
  }
};

export function FileUpload({ type, value, onChange, className }: FileUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const config = uploadConfig[type];
  const Icon = config?.icon || Upload;

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      onChange(result.url);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  }, [onChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const removeFile = () => {
    onChange('');
    setError(null);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <label className="block text-sm font-medium text-gray-700" data-testid={`label-${type}-upload`}>
        {config.title}
      </label>
      
      {value ? (
        <div className="relative">
          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <img 
              src={value} 
              alt={`${config.title} preview`}
              className="w-full h-32 object-cover"
              data-testid={`img-${type}-preview`}
            />
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2"
            onClick={removeFile}
            data-testid={`button-remove-${type}`}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
            isDragActive 
              ? "border-secondary bg-secondary/10" 
              : "border-gray-300 hover:border-secondary",
            isUploading && "pointer-events-none opacity-50"
          )}
          data-testid={`dropzone-${type}`}
        >
          <input {...getInputProps()} />
          
          {isUploading ? (
            <div className="space-y-2">
              <Upload className="w-8 h-8 text-secondary mx-auto animate-pulse" />
              <p className="text-sm text-gray-600">Uploading...</p>
              <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
            </div>
          ) : (
            <>
              <Icon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">{config.description}</p>
              <p className="text-xs text-gray-400 mt-1">{config.hint}</p>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600" data-testid={`error-${type}-upload`}>
          {error}
        </p>
      )}
    </div>
  );
}
