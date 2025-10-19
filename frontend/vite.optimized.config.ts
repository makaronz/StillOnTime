import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import { bundleAnalyzer } from '@rollup/plugin-bundle-analyzer'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Enable Fast Refresh
      fastRefresh: true,

      // Optimize JSX
      jsxRuntime: 'automatic',

      // Enable React optimization
      babel: {
        plugins: [
          // Tree shaking for React
          ['babel-plugin-transform-react-remove-prop-types', { removeImport: true }],
          // Optimize imports
          ['babel-plugin-import', {
            libraryName: 'lucide-react',
            libraryDirectory: 'es/icons',
            camel2DashComponentName: false,
          }, 'lucide-react'],
        ],
      },
    }),

    // Bundle analyzer for development
    process.env.ANALYZE === 'true' && visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),

    // Rollup bundle analyzer
    process.env.ANALYZE === 'true' && bundleAnalyzer({
      analyzerMode: 'server',
      analyzerPort: 8888,
    }),
  ].filter(Boolean),

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',

    // Optimize chunks for better caching
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // React and related libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],

          // UI libraries
          'ui-vendor': ['lucide-react', 'clsx', 'tailwind-merge'],

          // Form libraries
          'form-vendor': ['react-hook-form', '@hookform/resolvers'],

          // Chart libraries
          'chart-vendor': ['recharts'],

          // State management
          'state-vendor': ['zustand'],

          // Date utilities
          'date-vendor': ['date-fns'],

          // HTTP client
          'http-vendor': ['axios'],

          // Toast notifications
          'toast-vendor': ['react-hot-toast'],

          // Development tools
          'dev-vendor': process.env.NODE_ENV === 'development' ? [
            '@tanstack/react-query-devtools',
          ] : [],
        },

        // Optimize chunk naming for caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
          if (facadeModuleId) {
            const fileName = path.basename(facadeModuleId, path.extname(facadeModuleId))
            if (fileName === 'main') return 'assets/[name].[hash].js'
            return 'assets/[name]-[hash].js'
          }
          return 'assets/chunk-[hash].js'
        },

        // Optimize asset naming
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || []
          const ext = info[info.length - 1]

          if (/\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/i.test(assetInfo.name || '')) {
            return 'assets/media/[name].[hash].[ext]'
          }

          if (/\.(png|jpe?g|gif|svg)(\?.*)?$/i.test(assetInfo.name || '')) {
            return 'assets/images/[name].[hash].[ext]'
          }

          if (/\.(woff2?|eot|ttf|otf)(\?.*)?$/i.test(assetInfo.name || '')) {
            return 'assets/fonts/[name].[hash].[ext]'
          }

          return `assets/${ext}/[name].[hash].[ext]`
        },
      },
    },

    // Target modern browsers for better optimization
    target: 'esnext',

    // Minification options
    minify: 'terser',
    terserOptions: {
      compress: {
        // Remove console.log in production
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: true,

        // Additional optimizations
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
      mangle: {
        // Preserve class names for debugging
        keep_classnames: process.env.NODE_ENV === 'development',
        keep_fnames: process.env.NODE_ENV === 'development',
      },
    },

    // Optimize CSS
    cssCodeSplit: true,

    // Chunk size warning limit
    chunkSizeWarningLimit: 1000,

    // Enable CSS code splitting
    cssMinify: true,
  },

  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'lucide-react',
      'clsx',
      'tailwind-merge',
      'react-hook-form',
      '@hookform/resolvers',
      'recharts',
      'zustand',
      'date-fns',
      'axios',
      'react-hot-toast',
    ],

    exclude: [
      // Exclude large dependencies from pre-bundling
      '@tanstack/react-query-devtools',
    ],
  },

  // Define environment variables
  define: {
    // Remove process.env from production build
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),

    // Enable performance monitoring
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),

    // Analytics tracking
    __ANALYTICS_ENABLED__: JSON.stringify(process.env.NODE_ENV === 'production'),
  },

  // CSS optimizations
  css: {
    // Enable CSS modules for component-scoped styles
    modules: {
      localsConvention: 'camelCase',
    },

    // PostCSS configuration
    postcss: {
      plugins: [
        // Autoprefixer for browser compatibility
        'autoprefixer',

        // CSS nano for minification in production
        ...(process.env.NODE_ENV === 'production' ? ['cssnano'] : []),
      ],
    },

    // Enable CSS preprocessing
    preprocessorOptions: {
      scss: {
        additionalData: `@import "@/styles/variables.scss";`,
      },
    },
  },

  // Experimental features
  experimental: {
    // Enable build optimizations
    renderBuiltUrl: (filename, { hostType }) => {
      if (hostType === 'js') {
        return { js: `/${filename}` }
      } else {
        return { relative: true }
      }
    },
  },

  // Preview configuration
  preview: {
    port: 3000,
    open: true,
  },

  // Test configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],

    // Coverage configuration
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },

    // Performance testing
    benchmark: {
      include: ['src/**/*.test.{ts,tsx}'],
      exclude: ['node_modules/'],
    },
  },

  // ESBuild configuration
  esbuild: {
    // Drop console and debugger in production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],

    // Optimize for modern browsers
    target: 'es2020',

    // Enable tree shaking
    treeShaking: true,

    // Minify identifiers
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true,
  },
})