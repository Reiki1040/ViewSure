# ViewSure Architecture Documentation

## Overview

ViewSure is a React-based web application for projection preparation and accessibility analysis. The application provides tools for loading presentation files (PDF, PPTX, images), adjusting brightness/contrast, analyzing WCAG compliance, and exporting optimized PDFs.

## Architecture Principles

### 1. Separation of Concerns
- **State Management**: Centralized in custom hooks (`useAppState`, `useLoadingState`)
- **Rendering Logic**: Isolated in WebGL renderer and resource managers
- **Business Logic**: Separated into service layers (`ExportService`)
- **UI Components**: Pure presentation with minimal logic

### 2. Performance Optimization
- **Memoization**: Heavy use of `useMemo`, `useCallback`, and stable references
- **WebGL**: GPU-accelerated rendering for real-time adjustments
- **Lazy Loading**: Code splitting for large dependencies (PDF.js, pptx-preview)
- **Efficient Re-renders**: Minimized state updates and proper dependency arrays

### 3. Error Resilience
- **Error Boundaries**: Structured error handling with recovery options
- **Graceful Degradation**: Fallbacks for unsupported features
- **User Feedback**: Clear status messages and loading indicators

## Core Architecture

### State Management Hierarchy

```
App
├── useAppState (Core application state)
├── useLoadingState (Loading states)
├── useErrorHandler (Error management)
├── useProjectionRenderer (WebGL rendering)
└── useWcagHelper (Accessibility analysis)
```

### Data Flow

1. **File Upload** → `FileUploader` → `useAppState.handleFileSelected` → `ProjectionAsset`
2. **Rendering** → `useProjectionRenderer` → WebGL Canvas → Display
3. **User Adjustments** → Control Events → State Updates → WebGL Uniforms
4. **Export** → `ExportService` → PDF Generation → Download

## Key Components

### 1. App Component
- **Role**: Main application orchestrator
- **Responsibilities**:
  - Routing between Landing and Studio views
  - Coordinating between hooks and services
  - Handling global keyboard shortcuts
  - Managing application lifecycle

### 2. useAppState Hook
- **Purpose**: Centralized state management
- **State Managed**:
  - File assets and metadata
  - Adjustment values (brightness, contrast)
  - Navigation state (current frame, page count)
  - UI state (status messages, aspect ratios)

### 3. useProjectionRenderer Hook
- **Purpose**: WebGL-based image rendering and manipulation
- **Architecture**:
  ```
  useProjectionRenderer
  ├── WebGLResourceManager (WebGL context management)
  ├── Tone Mapping (WASM-based adjustments)
  ├── Projector Effects (Preview simulation)
  └── Frame Capture (Export functionality)
  ```

### 4. ExportService
- **Purpose**: PDF generation and file export
- **Features**:
  - Multi-page PDF generation
  - Progress tracking
  - Error recovery
  - Memory management

## File Structure

```
src/
├── components/          # React components
│   ├── App.tsx         # Main application
│   ├── FileUploader.tsx
│   └── ProjectionViewport.tsx
├── hooks/              # Custom React hooks
│   ├── useAppState.ts
│   ├── useProjectionRenderer.ts
│   ├── useWcagHelper.ts
│   └── useErrorHandler.ts
├── services/           # Business logic services
│   └── exportService.ts
├── lib/                # Low-level libraries
│   └── webgl/
├── utils/              # Utility functions
│   ├── fileLoader.ts
│   ├── pdf.ts
│   ├── constants.ts
│   └── webgl.ts
├── types/              # TypeScript definitions
│   ├── app.ts
│   ├── projector.ts
│   └── projects.ts
└── docs/               # Documentation
    └── ARCHITECTURE.md
```

## Performance Considerations

### 1. Rendering Optimization
- **Request Animation Frame**: Batched updates for smooth 60fps
- **Texture Management**: Efficient WebGL texture handling
- **Memory Management**: Proper disposal of resources (ImageBitmap, WebGL)

### 2. State Optimization
- **Stable References**: `useStableCallback` for event handlers
- **Memoized Values**: `useMemo` for expensive computations
- **Selective Updates**: Granular state updates to prevent re-renders

### 3. Asset Loading
- **Progressive Loading**: Load PDF pages on demand
- **Caching**: In-memory cache for rendered pages
- **Lazy Imports**: Dynamic imports for large libraries

## Error Handling Strategy

### 1. Error Categories
- **File Errors**: Unsupported formats, load failures
- **Render Errors**: WebGL context loss, texture issues
- **Export Errors**: PDF generation failures
- **Analysis Errors**: WCAG compliance checks

### 2. Recovery Patterns
- **Automatic Retry**: For transient network errors
- **Graceful Degradation**: Fallback to basic functionality
- **User Recovery**: Clear error messages with recovery steps

## Security Considerations

### 1. File Handling
- **MIME Type Validation**: Strict file type checking
- **Size Limits**: Maximum file size enforcement
- **Sandboxing**: Secure rendering environment

### 2. Data Privacy
- **Client-Only Processing**: No server uploads
- **Memory Cleanup**: Proper disposal of sensitive data
- **No Persistence**: Session-only data storage

## Browser Compatibility

### Supported Browsers
- Chrome 90+ (Full WebGL 2.0 support)
- Firefox 88+ (Full feature support)
- Safari 14+ (WebGL 2.0 with some limitations)
- Edge 90+ (Chromium-based)

### Feature Detection
- WebGL 2.0 for advanced rendering
- WASM support for tone mapping
- File API for uploads
- Canvas for fallback rendering

## Development Guidelines

### 1. Code Style
- TypeScript for type safety
- Functional components with hooks
- Immutable state updates
- Consistent error handling

### 2. Testing Strategy
- Unit tests for utilities and services
- Integration tests for component interactions
- Visual regression tests for rendering

### 3. Performance Monitoring
- Bundle size tracking
- Render performance metrics
- Memory usage monitoring

## Future Enhancements

### 1. Technical Debt
- [ ] Add comprehensive test coverage
- [ ] Implement proper error boundaries
- [ ] Add performance monitoring
- [ ] Improve accessibility of UI components

### 2. Feature Roadmap
- [ ] Collaborative editing
- [ ] Advanced color correction
- [ ] Projector profile management
- [ ] Offline functionality

## Conclusion

The ViewSure architecture follows modern React patterns with a clear separation of concerns, performance optimization, and robust error handling. The modular design allows for easy maintenance and future enhancements while providing a smooth user experience for presentation preparation and accessibility analysis.