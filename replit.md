# SDXL Lifestyle Photography Pipeline

## Overview

This project is a full-stack web application for AI-powered lifestyle photography generation. It enables photographers to generate photorealistic human figures in existing background scenes using advanced AI models including SDXL Inpainting, ControlNet, and LoRA. The system is designed for Carlos San Juan's lifestyle photography workflow, allowing seamless integration of AI-generated subjects into real background photographs while maintaining photographic quality and consistency.

The application provides a complete pipeline from asset upload through generation to quality assessment, with real-time progress tracking and comprehensive metrics reporting.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **React with TypeScript**: Modern component-based UI built with React 18 and TypeScript for type safety
- **Tailwind CSS + shadcn/ui**: Utility-first styling with a comprehensive component library for consistent design
- **Vite**: Fast development server and build tool optimized for modern web development
- **TanStack Query**: Robust data fetching and caching with automatic background updates and error handling
- **Wouter**: Lightweight client-side routing solution

### Backend Architecture
- **Express.js**: RESTful API server with middleware for request logging and error handling
- **TypeScript**: End-to-end type safety across the entire application stack
- **In-Memory Storage**: Simple storage implementation with interface for future database integration
- **Multer**: File upload handling with validation and size limits for image assets

### Data Storage Solutions
- **Drizzle ORM**: Type-safe database toolkit configured for PostgreSQL with schema-first approach
- **PostgreSQL**: Relational database for storing projects, variants, and quality metrics
- **Neon Database**: Serverless PostgreSQL provider for scalable cloud hosting
- **File Storage**: Local file system for development with support for external storage services

### Authentication and Authorization
- **Session-based Authentication**: Uses connect-pg-simple for PostgreSQL session storage
- **File Access Control**: CORS-enabled file serving with appropriate security headers
- **API Security**: Request validation and error handling middleware

### AI/ML Integration
- **fal.ai API**: SDXL ControlNet Union endpoint for AI image generation
- **ControlNet**: Pose and depth control for realistic subject placement
- **LoRA Support**: Custom model fine-tuning capabilities for style consistency
- **Quality Assessment**: Framework for SSIM, pose accuracy, and color delta (ΔE00) metrics

### Key Design Patterns
- **Repository Pattern**: Storage abstraction layer allowing multiple backend implementations
- **Component Composition**: Modular UI components with consistent prop interfaces
- **Progressive Enhancement**: Graceful degradation and loading states throughout the application
- **Real-time Updates**: Polling-based progress tracking with automatic UI updates

## External Dependencies

### AI/ML Services
- **fal.ai**: Primary AI image generation service using SDXL ControlNet Union API
- **Neon Database (@neondatabase/serverless)**: Serverless PostgreSQL hosting platform

### UI Framework
- **Radix UI**: Headless component primitives for accessibility and keyboard navigation
- **shadcn/ui**: Pre-built component library built on Radix UI with Tailwind styling
- **Lucide React**: Comprehensive icon library with consistent design

### Development Tools
- **Vite**: Development server and build tool with hot module replacement
- **Drizzle Kit**: Database migration and schema management toolkit
- **TypeScript**: Static type checking and improved developer experience

### File Handling
- **Multer**: Multipart form data parsing for file uploads
- **React Dropzone**: Drag-and-drop file upload interface with validation

### State Management
- **TanStack Query**: Server state management with caching and synchronization
- **React Hook Form**: Form state management with validation
- **Zod**: Runtime type validation and schema parsing

### Utilities
- **date-fns**: Date manipulation and formatting utilities
- **clsx + tailwind-merge**: Conditional CSS class name management
- **nanoid**: URL-safe unique ID generation