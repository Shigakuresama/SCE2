# SCE2 Mobile Web

Mobile-optimized web application for field data collection in the SCE2 rebate automation platform. Provides property viewing, field form submission, photo capture, and digital signature capabilities for mobile devices.

## Features

### 1. Property Display and Navigation
- View property details assigned from desktop webapp
- Navigate between properties in queue
- Display customer information, service dates, and notes
- Clean, mobile-optimized card layout

### 2. Field Data Collection Form
- Multi-section form with all required SCE rebate fields
- Customer information section
- Service details section
- Equipment verification section
- Form validation before submission

### 3. Photo Capture
- Camera integration for on-site photos
- Photo preview before submission
- Support for multiple photos per property
- Automatic camera permission handling

### 4. Digital Signature Capture
- Touch-enabled signature pad for mobile devices
- Mouse support for desktop testing
- Clear signature functionality
- Signature data URI generation for submission

### 5. Queue Management
- Status tracking (pending, in-progress, completed)
- Real-time updates from cloud server
- Filter properties by status

### 6. Responsive Design
- Mobile-first design approach
- Touch-optimized UI components
- Readable text sizes on mobile screens
- Optimized for landscape and portrait orientations

## Prerequisites

- **Node.js** 18+ and npm
- **Cloud Server** running on port 3333 (see `../../cloud-server/README.md`)
- Modern mobile browser with camera support (Chrome Mobile, Safari Mobile)
- For local testing: Device with camera or webcam

## Installation

```bash
# From workspace root
cd packages/mobile-web
npm install
```

## Development

### Start Development Server

```bash
npm run dev
```

The Vite dev server will start on `http://localhost:5174`

### Hot Module Replacement

- Changes to React components auto-refresh
- Styles update without full page reload
- Fast feedback during development

## Production

### Build for Production

```bash
npm run build
```

This creates an optimized production build in the `dist/` directory:
- Minified JavaScript
- Optimized CSS
- Asset hashing for cache busting
- Bundle size reporting

### Preview Production Build

```bash
npm run preview
```

Serves the production build locally on `http://localhost:4174` for testing before deployment.

## Environment Variables

Create `.env` file in `packages/mobile-web/`:

```env
# Cloud Server API endpoint
VITE_API_BASE_URL=http://localhost:3333

# Optional: Enable debug logging
VITE_DEBUG=true
```

**Production Environment:**
```env
VITE_API_BASE_URL=https://your-server.com
```

## Architecture

### Component Structure

```
src/
├── components/
│   ├── PropertyDisplay.tsx      # Property info card
│   ├── FieldForm.tsx            # Multi-section data form
│   ├── PhotoCapture.tsx         # Camera interface
│   ├── SignaturePad.tsx         # Signature capture
│   ├── QueueStatus.tsx          # Status indicator
│   └── MobileLayout.tsx         # Main layout wrapper
├── hooks/
│   ├── useCamera.ts             # Camera access hook
│   ├── useSignature.ts          # Signature state hook
│   └── useMobileNavigation.ts   # Route navigation
├── pages/
│   ├── PropertyList.tsx         # Queue view
│   ├── PropertyDetail.tsx       # Property with form
│   └── SubmitSuccess.tsx        # Confirmation page
├── lib/
│   api.ts                       # API client
│   validation.ts                # Form validation
│   constants.ts                 # App constants
└── main.tsx                     # App entry point
```

### State Management

- **React Router** for navigation and queue management
- **React Hook Form** for form state and validation
- **Custom hooks** for camera and signature functionality
- **API client** for server communication

### Data Flow

```
User Input → Form Component → Validation → API Submit → Update Queue → Navigate Next
              ↓
         Photo Capture → Convert to Base64 → Include in Submit
              ↓
         Signature → Data URI → Include in Submit
```

## API Integration

### Endpoints Used

```typescript
GET    /api/properties                    // Fetch property queue
GET    /api/properties/:id                // Get property details
PUT    /api/properties/:id                // Update property status
POST   /api/properties/:id/field-data     // Submit field data
POST   /api/properties/:id/photos         // Upload photos
POST   /api/properties/:id/signature      // Submit signature
```

### Error Handling

- Network errors display user-friendly messages
- Form validation shows inline errors
- Automatic retry on server disconnect
- Queue refreshes on failed submissions

## Mobile Considerations

### Camera Access
- Requires HTTPS in production (camera API restriction)
- Requests permissions on first use
- Falls back gracefully if camera unavailable
- Supports both rear and front cameras

### Touch Targets
- Minimum 44x44px tap targets (Apple HIG)
- Generous padding on buttons
- Clear visual feedback on touch

### Performance
- Lazy route loading for faster initial load
- Image optimization before upload
- Debounced form updates
- Minimal bundle size (<200KB gzipped)

### Responsive Breakpoints
```css
/* Mobile Portrait */
@media (max-width: 480px)

/* Mobile Landscape */
@media (min-width: 481px) and (max-width: 768px)

/* Tablet/Desktop */
@media (min-width: 769px)
```

## Deployment

### Build Command

```bash
npm run build
```

### Deployment Options

**Static Hosting (Vercel, Netlify, Cloudflare Pages):**
```bash
# Deploy dist/ directory
# Set VITE_API_BASE_URL environment variable
```

**Docker:**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "run", "preview"]
```

**Nginx (Production):**
```nginx
server {
    listen 80;
    root /var/www/mobile-web/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

## Testing

### Manual Testing Checklist

- [ ] View property list
- [ ] Navigate to property detail
- [ ] Fill out all form sections
- [ ] Capture photo with camera
- [ ] Sign signature pad
- [ ] Submit form successfully
- [ ] Verify success message
- [ ] Navigate to next property
- [ ] Test offline behavior (no API)

### Browser Testing

Test on:
- Chrome Mobile (Android)
- Safari Mobile (iOS)
- Desktop Chrome (camera emulator)

## Troubleshooting

### Camera Not Working

**Issue:** Camera permission denied

**Solution:**
- Ensure using HTTPS (required for camera API)
- Check browser permissions settings
- Test on physical device (not all emulators support camera)

**Issue:** Photos not uploading

**Solution:**
- Check photo size (limit to 5MB per photo)
- Verify API endpoint is accessible
- Check console for CORS errors

### Form Validation Errors

**Issue:** Submit button disabled

**Solution:**
- Fill all required fields (marked with *)
- Check field-specific error messages
- Ensure signature is captured if required

### Build Errors

**Issue:** TypeScript errors during build

**Solution:**
```bash
# Check TypeScript version
npm list typescript

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

**Issue:** Large bundle size

**Solution:**
```bash
# Analyze bundle
npm run build -- --mode analyze

# Check for duplicate dependencies
npm ls --depth=0
```

### API Connection Issues

**Issue:** Cannot connect to cloud server

**Solution:**
1. Verify cloud server is running: `curl http://localhost:3333/health`
2. Check `VITE_API_BASE_URL` in `.env`
3. Verify CORS settings in cloud server
4. Check network/firewall settings

## Development Tips

### Efficient Workflow

1. **Use React DevTools** for component inspection
2. **Test on physical device** early and often
3. **Use Chrome DevTools Remote Debugging** for mobile testing
4. **Monitor bundle size** during development

### Debugging Camera Issues

```javascript
// Check camera support in browser console
navigator.mediaDevices?.enumerateDevices()
  .then(devices => console.log(devices))
```

### Testing Without Camera

Use camera emulator in Chrome DevTools:
1. Open DevTools (F12)
2. Click "More tools" → "Sensors"
3. Set "Camera" to a virtual device

## Performance Optimization

### Bundle Size

Target sizes:
- `index.html`: <5KB
- `assets/index-[hash].js`: <200KB gzipped
- `assets/index-[hash].css`: <20KB gzipped

### Load Time Targets

- First Contentful Paint: <1.5s
- Time to Interactive: <3s
- Largest Contentful Paint: <2.5s

### Optimization Techniques

- Route-based code splitting
- Tree shaking for unused code
- CSS purging of unused styles
- Image compression before upload

## Security Considerations

- **HTTPS Required** for production (camera API requirement)
- **Input Validation** on all form fields
- **File Size Limits** for photo uploads
- **API Authentication** via cloud server tokens
- **CORS Restrictions** to authorized origins only

## Contributing

When adding features:

1. Test on multiple mobile devices
2. Ensure touch targets meet accessibility standards
3. Validate on both portrait and landscape orientations
4. Check performance impact on bundle size
5. Update README with new features

## License

Part of SCE2 project. See root LICENSE file.

## Support

For issues or questions:
- Check cloud server logs at `../../cloud-server/logs/`
- Review browser console for client errors
- Test API endpoints directly with Postman
- Document reproducible bugs with device/browser info
