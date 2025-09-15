# JADDL Admin Setup

## Overview

The JADDL admin system provides secure access to administrative functions for managing the fantasy football league. The admin area is completely separate from the public site and requires authentication.

## Access

- **Admin URL**: `http://localhost:3000/admin` (or your domain + `/admin`)
- **Login URL**: `http://localhost:3000/admin/login`

## Setup

### 1. Environment Variables

Add these variables to your `.env.local` file:

```bash
# Admin Authentication
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here
```

**Important**: Change the default password to something secure!

### 2. Default Credentials

- **Username**: `admin`
- **Password**: Set via `ADMIN_PASSWORD` environment variable

## Features

### Admin Dashboard
- System overview and statistics
- Team management interface
- Content management for articles
- System settings configuration
- Recent activity monitoring

### Security Features
- HTTP-only session cookies
- Secure session tokens (64-character random strings)
- Middleware protection for all admin routes
- Automatic redirect to login for unauthenticated users
- Session verification on every admin page load

## File Structure

```
src/
├── app/
│   ├── (admin)/
│   │   ├── admin/
│   │   │   ├── page.tsx              # Main admin dashboard
│   │   │   ├── admin-dashboard.tsx   # Dashboard component
│   │   │   └── login/
│   │   │       ├── page.tsx          # Login page
│   │   │       └── login-form.tsx    # Login form component
│   │   └── layout.tsx                # Admin layout
│   └── api/
│       └── admin/
│           ├── login/route.ts        # Login API endpoint
│           ├── logout/route.ts       # Logout API endpoint
│           └── verify/route.ts       # Session verification
└── middleware.ts                     # Route protection middleware
```

## Usage

1. Navigate to `/admin` - you'll be redirected to `/admin/login`
2. Enter your admin credentials
3. Access the dashboard with full administrative controls
4. Use the logout button to end your session

## Security Notes

- The admin area is not linked anywhere on the public site
- All admin routes are protected by middleware
- Session tokens are generated using crypto.randomBytes for security
- Cookies are HTTP-only and secure in production
- No admin functionality is exposed to unauthenticated users

## Future Enhancements

The admin system is designed to be extensible. You can add:
- User management
- Content moderation
- League configuration
- Team roster management
- Statistics and analytics
- System monitoring
