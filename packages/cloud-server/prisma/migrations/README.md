# Prisma Migrations

This directory contains database migrations.

## Development

To apply schema changes:
```bash
cd packages/cloud-server
npm run db:push  # Skip migration files, update dev database directly
```

## Production

To create migration files:
```bash
npm run db:migrate  # Creates migration file in this folder
npm run db:migrate  # Applies migration
```

## Current Schema

- Property: Tracks addresses through scrape → field → submit workflow
- Document: Stores metadata for uploaded files (photos, signatures, bills)
- Route: Groups properties for batch processing
