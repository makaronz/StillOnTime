/**
 * Bundle size analyzer utility for development
 */

interface BundleChunk {
  name: string;
  size: number;
  path: string;
}

interface BundleInfo {
  totalSize: number;
  chunks: BundleChunk[];
}

// Mock bundle analyzer for development
// In a real implementation, this would analyze the webpack/vite bundle
export const getBundleInfo = async (): Promise<BundleInfo> => {
  // For now, return mock data
  // In production, this would parse the actual bundle manifest
  return {
    totalSize: 1024 * 1024 * 2.5, // 2.5 MB
    chunks: [
      {
        name: "main.js",
        size: 1024 * 512, // 512 KB
        path: "/assets/main.js"
      },
      {
        name: "vendor.js",
        size: 1024 * 1024, // 1 MB
        path: "/assets/vendor.js"
      },
      {
        name: "react.js",
        size: 1024 * 256, // 256 KB
        path: "/assets/react.js"
      },
      {
        name: "styles.css",
        size: 1024 * 128, // 128 KB
        path: "/assets/styles.css"
      }
    ]
  };
};

export const analyzeBundle = async (): Promise<void> => {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  const bundleInfo = await getBundleInfo();

  console.group("📦 Bundle Analysis");
  console.log(`Total Size: ${(bundleInfo.totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total Chunks: ${bundleInfo.chunks.length}`);

  bundleInfo.chunks
    .sort((a, b) => b.size - a.size)
    .forEach((chunk, index) => {
      console.log(
        `${index + 1}. ${chunk.name}: ${(chunk.size / 1024).toFixed(1)} KB`
      );
    });

  console.groupEnd();
};

export default {
  getBundleInfo,
  analyzeBundle
};